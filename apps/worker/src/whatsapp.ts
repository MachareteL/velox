import QRCode from "qrcode";
import { SupabaseClient } from "@supabase/supabase-js";
import { Mutex } from "async-mutex";
import {
  recordCapturedCall,
  recordSystemLog,
  updateSessionStatus,
} from "@velox/database";
import { VeloxScraper } from "./scraper";
import { WhatsAppProvider, IncomingMessagePayload } from "./whatsapp-provider";
import { BaileysProvider, purgeBaileysSessionDir } from "./baileys-provider";
import { WorkerLogger, LoggerFactory } from "./logger";

/**
 * Extrai a ChaveConvite da URL enviada pela seguradora.
 */
function extractChaveConvite(urlStr: string): string | null {
  try {
    const urlObj = new URL(urlStr);
    return urlObj.searchParams.get("ChaveConvite");
  } catch {
    const match = urlStr.match(/ChaveConvite=([a-f0-9\-]+)/i);
    return match ? match[1] : null;
  }
}

/**
 * Interface com todas as métricas de observabilidade do Worker.
 */
export interface WorkerMetrics {
  tenantId: string;
  workerState: string;
  isActive: boolean;
  isConnected: boolean;
  workerUptimeSeconds: number;
  sessionUptimeSeconds: number;
  lastMessageReceivedAt: string | null;
  lastEventAt: string | null;
  lastAuthenticatedAt: string | null;
  lastReadyAt: string | null;
  lastDisconnectedAt: string | null;
  lastReconnectAt: string | null;
  reconnectAttempts: number;
  reconnectAttemptsTotal: number;
  memoryUsageMb: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
  };
}

export type WorkerState =
  | "STARTING"
  | "CONNECTING"
  | "CONNECTED"
  | "DEGRADED"
  | "RECONNECTING"
  | "DISCONNECTED"
  | "NEED_QR"
  | "STOPPING"
  | "STOPPED";

export class WhatsAppWorker {
  private provider!: WhatsAppProvider;
  private scraper: VeloxScraper;
  private inviteRegex: RegExp;
  private logger: WorkerLogger;

  // Trava de exclusão mútua em nível de Worker
  private actionLock = new Mutex();

  // Máquina de estados explícita garante proteção contra race conditions
  private state: WorkerState = "STOPPED";
  private isActive: boolean = true;
  private isConnected: boolean = false;

  // Watchdog
  private watchdogTimer: NodeJS.Timeout | null = null;

  // Anti-Spam e Limites
  private qrCount: number = 0;
  private maxQrAttempts: number = 8;

  // Reconexão e Cooldowns
  private reconnectAttempts: number = 0;
  private reconnectAttemptsTotal: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private authTimeoutTimer: NodeJS.Timeout | null = null;

  // Instrumentação e Telemetria (Timestamps de Ciclo de Vida)
  private workerStartTimestamp: number = Date.now();
  private sessionStartTimestamp: number = 0;
  private lastMessageReceivedAt: number = 0;
  private lastEventAt: number = Date.now();
  private lastAuthenticatedAt: number = 0;
  private lastReadyAt: number = 0;
  private lastDisconnectedAt: number = 0;
  private lastReconnectAt: number = 0;

  constructor(
    private tenantId: string,
    private sessionId: string,
    private supabase: SupabaseClient,
    targetRegexPattern?: string,
    private phoneNumber?: string | null,
    logger?: WorkerLogger
  ) {
    this.logger = logger || LoggerFactory.forTenant(this.tenantId, this.sessionId);
    const defaultPattern =
      "https?:\\/\\/(?:[a-z0-9\\-]+\\.)*veloxcontactcenter\\.com\\.br\\/[^\\s\"'>]*ChaveConvite=[a-f0-9\\-]+";
    this.inviteRegex = new RegExp(
      targetRegexPattern || process.env.TARGET_REGEX || defaultPattern,
      "i"
    );
    this.scraper = new VeloxScraper(
      parseInt(process.env.HTTP_TIMEOUT || "5000", 10),
      this.logger
    );

    this.provider = this.createProvider();
  }

  public getLogger(): WorkerLogger {
    return this.logger;
  }

  private createProvider(operationId?: string): WhatsAppProvider {
    const provider = new BaileysProvider(this.tenantId, this.logger);
    this.setupListenersForProvider(provider, operationId);
    return provider;
  }

  public setIsActive(active: boolean): void {
    const previous = this.isActive;
    this.isActive = active;
    if (previous !== active) {
      this.logger.worker(
        "AUTOMATION_TOGGLED",
        `Estado da automação alterado para tenant ${this.tenantId}: ${active ? "LIGADO" : "PAUSADO"}`,
        { active }
      );
    }
  }

  public async restartForFreshAuth(phoneNumber?: string | null, operationId?: string): Promise<void> {
    return this.actionLock.runExclusive(async () => {
      this.logger.worker(
        "WORKER_RESTART",
        `Forçando reinicialização limpa de autenticação Baileys para tenant ${this.tenantId}...`,
        { operationId }
      );
      this.phoneNumber = phoneNumber !== undefined ? phoneNumber : this.phoneNumber;
      this.qrCount = 0;

      await this.stopInternal(operationId, "FRESH_AUTH_RESTART");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      purgeBaileysSessionDir(this.tenantId, this.logger);
      this.provider = this.createProvider(operationId);
      await this.startInternal(operationId, "FRESH_AUTH_RESTART");
    });
  }

  public getPhoneNumber(): string | null | undefined {
    return this.phoneNumber;
  }

  /**
   * Um worker é considerado existente/ativo se estiver em qualquer estado não final.
   * Retorna false apenas se estiver expressamente parando ou encerrado.
   */
  public isRunning(): boolean {
    return this.state !== "STOPPED" && this.state !== "STOPPING";
  }

  public getWorkerState(): WorkerState {
    return this.state;
  }

  /**
   * Único ponto de escrita no banco de dados para evitar atualizações desnecessárias.
   * Transita a máquina de estados local e reflete a fonte da verdade no Supabase.
   */
  private async changeState(
    newState: WorkerState,
    qrDataUrl: string | null = null,
    pairingCode: string | null = null,
    reason?: string,
    source?: string,
    operationId?: string
  ): Promise<void> {
    if (this.state === newState && !qrDataUrl && !pairingCode) return;

    const previousState = this.state;
    this.state = newState;

    this.logger.fsm(previousState, newState, reason, source, { operationId });

    // Mapeamento para o status esperado no BD
    let dbStatus: any = "DISCONNECTED";
    if (newState === "STARTING" || newState === "CONNECTING")
      dbStatus = "AUTHENTICATING";
    else if (newState === "RECONNECTING")
      dbStatus = previousState === "CONNECTED" || previousState === "RECONNECTING" ? "CONNECTED" : "AUTHENTICATING";
    else if (newState === "CONNECTED") dbStatus = "CONNECTED";
    else if (newState === "NEED_QR") dbStatus = "DISCONNECTED_NEED_QR";
    else if (
      newState === "STOPPED" ||
      newState === "STOPPING" ||
      newState === "DISCONNECTED" ||
      newState === "DEGRADED"
    )
      dbStatus = "DISCONNECTED";

    try {
      await updateSessionStatus(
        this.supabase,
        this.sessionId,
        dbStatus,
        qrDataUrl,
        process.env.WORKER_ID || "vps-worker-01",
        pairingCode,
        this.phoneNumber || null
      );
    } catch (err: any) {
      this.logger.error(`[Worker FSM] Erro ao sincronizar DB para tenant ${this.tenantId}:`, err);
    }
  }

  private startWatchdog(): void {
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);

    this.watchdogTimer = setInterval(async () => {
      if (this.state === "CONNECTED") {
        const isOpen = this.provider?.isSocketOpen();
        let pingOk = false;
        if (isOpen && typeof this.provider.sendPing === "function") {
          pingOk = await this.provider.sendPing();
        }

        if (!isOpen || !pingOk) {
          this.logger.watchdog(
            "GHOST_SESSION_DETECTED",
            `Sessão fantasma detectada (Worker CONNECTED mas Ping de aplicação falhou) para tenant ${this.tenantId}.`
          );
          await this.changeState("DEGRADED", null, null, "Ghost Session / Ping Failed", "WATCHDOG");
          await this.handleDisconnected("Watchdog Ghost Session Detected", false, undefined, undefined, "WATCHDOG");
        }
      }
    }, 15000);
  }

  private stopWatchdog(): void {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  public async requestPairingCodeOnDemand(phoneNumber: string, operationId?: string): Promise<string | null> {
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    this.phoneNumber = cleanPhone;
    this.qrCount = 0;

    if (!this.isRunning()) {
      this.logger.info(`Robô estava pausado/parado. Reiniciando cliente para tenant ${this.tenantId}...`);
      await this.start(operationId, "PAIRING_CODE_REQUEST");
      return null;
    }

    try {
      this.logger.info(`Solicitando Código de Pareamento sob demanda para número ${cleanPhone}...`);
      const pairingCode = await this.provider.requestPairingCode(cleanPhone);
      this.logger.info(`Código de Pareamento gerado sob demanda: ${pairingCode}`);

      await this.changeState("NEED_QR", null, pairingCode, "Pairing Code Generated", "PAIRING_REQUEST", operationId);

      await recordSystemLog(this.supabase, {
        tenant_id: this.tenantId,
        level: "INFO",
        event_type: "PAIRING_CODE_GENERATED",
        message: `Código de Pareamento por telefone gerado com sucesso: ${pairingCode}`,
        details: { phoneNumber: cleanPhone, pairingCode, operationId },
      });

      return pairingCode;
    } catch (pairErr: any) {
      const errMsg = pairErr?.message || String(pairErr || "");
      this.logger.error("Erro ao solicitar Código de Pareamento sob demanda:", pairErr);

      await recordSystemLog(this.supabase, {
        tenant_id: this.tenantId,
        level: "ERROR",
        event_type: "PAIRING_CODE_ERROR",
        message: `Falha ao gerar código por telefone: ${errMsg}`,
        details: { phoneNumber: cleanPhone, error: errMsg, operationId },
      });

      return null;
    }
  }

  // ── Event Wiring ──────────────────────────────────────────────────────

  private setupListenersForProvider(provider: WhatsAppProvider, operationId?: string): void {
    provider.on("qr", (qr) => this.handleQrGenerated(qr, operationId));
    provider.on("authenticated", () => this.handleAuthenticated(operationId));
    provider.on("ready", () => this.handleReady(operationId));
    provider.on("disconnected", (reason, isLoggedOut, statusCode) =>
      this.handleDisconnected(reason, isLoggedOut, statusCode, operationId, "SOCKET")
    );
    provider.on("message", (msg) => this.handleIncomingMessage(msg, operationId));
  }

  // ── Lifecycle Event Handlers ──────────────────────────────────────────

  private async handleQrGenerated(qrText: string, operationId?: string): Promise<void> {
    this.lastEventAt = Date.now();
    this.qrCount++;

    if (this.qrCount > this.maxQrAttempts) {
      if (this.qrCount === this.maxQrAttempts + 1) {
        this.logger.warn(
          `Limite de ${this.maxQrAttempts} renovações de QR Code atingido para tenant ${this.tenantId}. Encerrando socket inativo...`
        );
        await this.changeState("DISCONNECTED", null, null, "QR Code limit reached", "ANTI_SPAM", operationId);
        await this.stop(operationId, "ANTI_SPAM_LIMIT");
      }
      return;
    }

    this.logger.info(`Geração de autenticação #${this.qrCount}/${this.maxQrAttempts} recebida para tenant ${this.tenantId}`);

    try {
      const qrDataUrl = await QRCode.toDataURL(qrText);
      await this.changeState("NEED_QR", qrDataUrl, null, "QR Generated", "BAILEYS_SOCKET", operationId);

      await recordSystemLog(this.supabase, {
        tenant_id: this.tenantId,
        level: "INFO",
        event_type: "QR_GENERATED",
        message: "Novo Código de Conexão (QR Code) gerado via Baileys.",
      });
    } catch (err: any) {
      this.logger.error("Erro ao converter QR Code:", err);
    }
  }

  private async handleAuthenticated(operationId?: string): Promise<void> {
    this.lastEventAt = Date.now();
    this.lastAuthenticatedAt = Date.now();
    this.logger.info(`Conexão autenticada/reconectando para tenant ${this.tenantId}...`);

    await this.changeState("CONNECTING", null, null, "Session Authenticated", "BAILEYS_SOCKET", operationId);

    await recordSystemLog(this.supabase, {
      tenant_id: this.tenantId,
      level: "INFO",
      event_type: "SESSION_AUTHENTICATED",
      message: "Autenticação Baileys em andamento...",
    });
  }

  private async handleReady(operationId?: string): Promise<void> {
    this.lastEventAt = Date.now();
    this.lastReadyAt = Date.now();
    this.logger.socket("SOCKET_READY", `Socket WhatsApp conectado e PRONTO para tenant ${this.tenantId}`);
    this.isConnected = true;
    this.reconnectAttempts = 0;

    if (this.authTimeoutTimer) {
      clearTimeout(this.authTimeoutTimer);
      this.authTimeoutTimer = null;
    }

    await this.changeState("CONNECTED", null, null, "Socket Ready", "BAILEYS_SOCKET", operationId);

    await recordSystemLog(this.supabase, {
      tenant_id: this.tenantId,
      level: "INFO",
      event_type: "SESSION_READY",
      message: "WhatsApp Baileys conectado e pronto para automação.",
    });
  }

  /**
   * Handler de desconexão com lógica de logout vs reconexão com backoff exponencial.
   */
  private async handleDisconnected(
    reason: string,
    isLoggedOut: boolean,
    statusCode?: number,
    operationId?: string,
    source: string = "SOCKET"
  ): Promise<void> {
    return this.actionLock.runExclusive(async () => {
      this.lastEventAt = Date.now();
      this.lastDisconnectedAt = Date.now();
      this.isConnected = false;

      this.logger.socket("SOCKET_DISCONNECTED", `WhatsApp desconectado para tenant ${this.tenantId}`, {
        reason,
        isLoggedOut,
        statusCode,
        operationId,
        source,
      });

      // ── Cenário 1: Logout explícito (loggedOut / 401 / multideviceMismatch) ──
      if (isLoggedOut) {
        this.logger.worker(
          "SESSION_PURGE_CONFIRMED_LOGOUT",
          `Logout explícito ou credenciais revogadas para tenant ${this.tenantId}. Expurgando pasta e solicitando QR...`,
          { statusCode, operationId }
        );
        this.qrCount = 0;
        this.reconnectAttempts = 0;
        await this.stopInternal(operationId, "LOGGED_OUT");
        await new Promise((res) => setTimeout(res, 1000));
        
        this.logger.worker(
          "SESSION_PURGE",
          `Expurgando pasta de sessão do tenant ${this.tenantId}...`,
          { operationId }
        );
        purgeBaileysSessionDir(this.tenantId, this.logger);

        await this.changeState("NEED_QR", null, null, "Logged Out - Purged Credentials", source, operationId);

        await recordSystemLog(this.supabase, {
          tenant_id: this.tenantId,
          level: "WARN",
          event_type: "SESSION_LOGOUT",
          message: "Sessão desautorizada detectada. Pasta de sessão expurgada.",
        });

        try {
          this.provider = this.createProvider(operationId);
          await this.startInternal(operationId, "RESTART_AFTER_LOGOUT");
        } catch (restartErr: any) {
          this.logger.error("Erro ao reiniciar worker após logout:", restartErr);
        }
        return;
      }

      // ── Cenário 2: Restart Required (515) — reconexão imediata sem penalidade ──
      if (statusCode === 515) {
        this.logger.info(
          `Servidor WhatsApp solicitou restart (515) para tenant ${this.tenantId}. Reconectando imediatamente...`
        );
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(async () => {
          try {
            await this.provider.reconnect(operationId);
          } catch (err: any) {
            this.logger.error("Erro ao reconectar após restart 515:", err);
          }
        }, 3000);
        return;
      }

      // ── Cenário 3: Erro transitório / badSession (500) — reconectar com backoff (SEM apagar pasta!) ──
      if (statusCode === 500 || reason.includes("badSession")) {
        this.logger.worker(
          "BAD_SESSION_RECOVERY",
          `Erro 500/badSession detectado para tenant ${this.tenantId}. Iniciando recuperação sem expurgar sessão.`,
          { statusCode, reason, operationId }
        );
      }

      await this.changeState("RECONNECTING", null, null, `Disconnected: ${reason}`, source, operationId);

      this.reconnectAttempts++;
      this.reconnectAttemptsTotal++;
      this.lastReconnectAt = Date.now();

      if (this.reconnectAttempts > this.maxReconnectAttempts) {
        this.logger.error(
          `Limite de reconexões atingido (${this.reconnectAttempts - 1}/${this.maxReconnectAttempts}) para tenant ${this.tenantId}. Parando tentativas automáticas.`
        );
        await this.changeState("DISCONNECTED", null, null, "Max Reconnect Attempts Exceeded", "RECONNECT_LIMIT", operationId);

        await recordSystemLog(this.supabase, {
          tenant_id: this.tenantId,
          level: "ERROR",
          event_type: "RECONNECT_LIMIT_REACHED",
          message: `Limite de ${this.maxReconnectAttempts} tentativas de reconexão atingido. Worker parado. Intervenção manual necessária.`,
          details: {
            reconnectAttempts: this.reconnectAttempts - 1,
            lastReason: reason,
            lastStatusCode: statusCode,
          },
        });
        return;
      }

      const isUndefinedStatus = statusCode === undefined;
      const baseDelay = isUndefinedStatus ? 5000 : 2000;
      const backoffDelayMs = Math.min(
        60000,
        Math.pow(2, this.reconnectAttempts) * baseDelay + Math.floor(Math.random() * 1000)
      );
      this.logger.info(
        `Agendando reconexão automática #${this.reconnectAttempts}/${this.maxReconnectAttempts} em ${(
          backoffDelayMs / 1000
        ).toFixed(1)}s...`
      );

      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(async () => {
        try {
          this.logger.info(`Executando reconexão para tenant ${this.tenantId}...`);
          await this.provider.reconnect(operationId);
        } catch (err: any) {
          this.logger.error("Erro ao reconectar sessão salva:", err);
        }
      }, backoffDelayMs);
    });
  }

  // ── Message Processing Pipeline ───────────────────────────────────────

  private async handleIncomingMessage(msg: IncomingMessagePayload, operationId?: string): Promise<void> {
    if (!msg || !msg.body) {
      this.logger.debug(`[WhatsAppWorker] handleIncomingMessage chamado com payload nulo ou sem body`);
      return;
    }

    this.lastEventAt = Date.now();
    this.lastMessageReceivedAt = Date.now();

    this.logger.info(`[WhatsAppWorker] 🔍 Avaliando mensagem recebida de ${msg.from} [ID: ${msg.id}]`, {
      category: "MESSAGE_EVALUATION",
      event: "MESSAGE_EVALUATED",
      from: msg.from,
      msgId: msg.id,
      bodySnippet: msg.body.slice(0, 150),
      operationId,
    });

    const match = msg.body.match(this.inviteRegex);
    if (!match) {
      this.logger.info(`[WhatsAppWorker] Mensagem de ${msg.from} não contém link de convite Velox`, {
        category: "MESSAGE_EVALUATION",
        event: "MESSAGE_NO_INVITE_MATCH",
        from: msg.from,
        msgId: msg.id,
        bodySnippet: msg.body.slice(0, 150),
        operationId,
      });
      return;
    }

    const targetUrl = match[0];
    this.logger.info(`🎉 Convite Velox capturado no WhatsApp! Link: ${targetUrl}`, { operationId });

    if (!this.isActive) {
      this.logger.warn(`Automação pausada pelo prestador. Ignorando convite: ${targetUrl}`);
      await recordSystemLog(this.supabase, {
        tenant_id: this.tenantId,
        level: "WARN",
        event_type: "AUTOMATION_PAUSED",
        message: "Convite recebido mas ignorado pois a automação está pausada pelo prestador.",
        details: { url: targetUrl, operationId },
      });
      return;
    }

    try {
      const chaveConvite = extractChaveConvite(targetUrl);
      const allocation = await this.resolveFleetAllocation(targetUrl, chaveConvite, operationId);

      if (!allocation) return;

      const { isDuplicate, availableVehicle } = allocation;

      setImmediate(async () => {
        await this.executeInviteAcceptance(targetUrl, isDuplicate, availableVehicle, operationId);
      });
    } catch (err: any) {
      this.logger.error("Erro ao verificar capacidade da frota:", err);
    }
  }

  private async resolveFleetAllocation(
    targetUrl: string,
    chaveConvite: string | null,
    operationId?: string
  ): Promise<{ isDuplicate: boolean; availableVehicle: any } | null> {
    let isDuplicate = false;

    if (chaveConvite) {
      const { data: existingCalls } = await this.supabase
        .from("captured_calls")
        .select("id")
        .eq("tenant_id", this.tenantId)
        .ilike("url", `%${chaveConvite}%`)
        .limit(1);

      if (existingCalls && existingCalls.length > 0) {
        isDuplicate = true;
      }
    } else {
      const { data: existingCalls } = await this.supabase
        .from("captured_calls")
        .select("id")
        .eq("tenant_id", this.tenantId)
        .eq("url", targetUrl)
        .limit(1);

      if (existingCalls && existingCalls.length > 0) {
        isDuplicate = true;
      }
    }

    if (isDuplicate) {
      this.logger.warn(
        `⚠️ Chamado duplicado identificado (${
          chaveConvite ? `ChaveConvite: ${chaveConvite}` : targetUrl
        }). Nenhum veículo adicional será alocado, procedendo com a requisição de aceite.`
      );

      await recordSystemLog(this.supabase, {
        tenant_id: this.tenantId,
        level: "WARN",
        event_type: "DUPLICATE_CALL_DETECTED",
        message: `Chamado duplicado identificado (${
          chaveConvite ? `ChaveConvite: ${chaveConvite}` : targetUrl
        }). Nenhum veículo adicional alocado.`,
        details: { url: targetUrl, chaveConvite, operationId },
      });

      return { isDuplicate: true, availableVehicle: null };
    }

    const { data: vehicles } = await this.supabase
      .from("vehicles")
      .select("*")
      .eq("tenant_id", this.tenantId)
      .eq("is_active", true);

    const fleetCapacity = vehicles && vehicles.length > 0 ? vehicles.length : 1;

    const { data: calls } = await this.supabase
      .from("captured_calls")
      .select("*")
      .eq("tenant_id", this.tenantId)
      .eq("status", "SUCCESS")
      .is("completed_at", null);

    const now = Date.now();
    const activeCalls = (calls || []).filter((call) => {
      const createdAtMs = new Date(call.created_at).getTime();
      const durationMin = call.previa_minutos || 50;
      const expiresAtMs = createdAtMs + durationMin * 60 * 1000;
      return now < expiresAtMs;
    });

    if (activeCalls.length >= fleetCapacity) {
      this.logger.warn(
        `Capacidade máxima da frota atingida (${activeCalls.length}/${fleetCapacity} atendimentos ativos). Ignorando convite.`
      );

      await recordSystemLog(this.supabase, {
        tenant_id: this.tenantId,
        level: "WARN",
        event_type: "FLEET_CAPACITY_REACHED",
        message: `Capacidade da frota atingida (${activeCalls.length}/${fleetCapacity} veículos em atendimento). Convite não aceito automaticamente.`,
        details: {
          url: targetUrl,
          activeCallsCount: activeCalls.length,
          fleetCapacity,
          operationId,
        },
      });
      return null;
    }

    const assignedVehicleIds = new Set(
      activeCalls.map((c) => c.vehicle_id).filter(Boolean)
    );
    const availableVehicle =
      (vehicles || []).find((v) => !assignedVehicleIds.has(v.id)) || null;

    return { isDuplicate: false, availableVehicle };
  }

  private async executeInviteAcceptance(
    targetUrl: string,
    isDuplicate: boolean,
    availableVehicle: any,
    operationId?: string
  ): Promise<void> {
    try {
      const result = await this.scraper.processarConvite(targetUrl);
      const previaMinutos = result.previaValor ?? 50;

      const responsePayloadToRecord = {
        ...(result.responsePayload || {}),
        debugInfo: result.debugInfo || null,
        attemptsMade: result.attemptsMade,
        payloadSent: result.payload || null,
        isDuplicate: isDuplicate || undefined,
        operationId,
      };

      if (!isDuplicate) {
        await recordCapturedCall(this.supabase, {
          tenant_id: this.tenantId,
          url: result.url,
          distancia_km: result.distanciaKm,
          previa_valor: result.previaValor,
          previa_minutos: previaMinutos,
          vehicle_id: availableVehicle?.id || null,
          duration_ms: result.durationMs,
          status: result.success ? "SUCCESS" : "FAILED",
          response_payload: responsePayloadToRecord,
          error_message: result.errorMessage || null,
        });
      }

      await recordSystemLog(this.supabase, {
        tenant_id: this.tenantId,
        level: result.success ? "INFO" : "ERROR",
        event_type: result.success ? "HTTP_POST_SUCCESS" : "HTTP_POST_ERROR",
        message: result.success
          ? `Convite aceito com sucesso em ${result.durationMs}ms${
              availableVehicle
                ? ` | Veículo: ${availableVehicle.title}`
                : isDuplicate
                ? " | Duplicado (sem novo veículo)"
                : ""
            }.`
          : `Falha no aceite do convite: ${result.errorMessage}`,
        details: {
          url: targetUrl,
          durationMs: result.durationMs,
          vehicleId: availableVehicle?.id || null,
          isDuplicate,
          statusCode: result.statusCode,
          debugInfo: result.debugInfo,
          operationId,
        },
      });
    } catch (asyncErr: any) {
      this.logger.error("Erro crítico no processamento assíncrono do convite:", asyncErr);
      try {
        await recordSystemLog(this.supabase, {
          tenant_id: this.tenantId,
          level: "ERROR",
          event_type: "ASYNC_INVITE_PROCESSING_ERROR",
          message: `Exceção capturada em setImmediate: ${asyncErr?.message}`,
          details: { url: targetUrl, error: asyncErr?.stack, operationId },
        });
      } catch (_) {}
    }
  }

  // ── Internal Unlocked Methods ──────────────────────────────────────────

  private async startInternal(operationId?: string, source: string = "INTERNAL"): Promise<void> {
    if (this.isRunning() || this.state === "STOPPING") {
      this.logger.worker(
        "WORKER_START_SKIPPED",
        `Worker já está ativo (Estado: ${this.state}) para tenant ${this.tenantId}. Ignorando startInternal.`,
        { operationId, state: this.state }
      );
      return;
    }

    await this.changeState("STARTING", null, null, "Starting worker internal", source, operationId);
    this.sessionStartTimestamp = Date.now();
    this.lastMessageReceivedAt = Date.now();
    this.lastEventAt = Date.now();

    this.logger.worker("WORKER_START", `Inicializando socket Baileys para tenant ${this.tenantId}...`, { operationId, source });
    await (this.provider as BaileysProvider).start(operationId);

    this.startWatchdog();
  }

  private async stopInternal(operationId?: string, source: string = "INTERNAL"): Promise<void> {
    if (this.state === "STOPPED" || this.state === "STOPPING") {
      return;
    }

    await this.changeState("STOPPING", null, null, "Stopping worker internal", source, operationId);
    this.stopWatchdog();
    this.isConnected = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.authTimeoutTimer) {
      clearTimeout(this.authTimeoutTimer);
      this.authTimeoutTimer = null;
    }

    if (this.provider) {
      await this.provider.stop();
    }
    await this.changeState("STOPPED", null, null, "Worker stopped internal", source, operationId);
  }

  // ── Lifecycle Control ─────────────────────────────────────────────────

  public async start(operationId?: string, source: string = "EXTERNAL"): Promise<void> {
    return this.actionLock.runExclusive(async () => {
      await this.startInternal(operationId, source);
    });
  }

  public async stop(operationId?: string, source: string = "EXTERNAL"): Promise<void> {
    return this.actionLock.runExclusive(async () => {
      await this.stopInternal(operationId, source);
    });
  }

  // ── Observability ─────────────────────────────────────────────────────

  public getMetrics(): WorkerMetrics {
    const now = Date.now();
    const mem = process.memoryUsage();

    return {
      tenantId: this.tenantId,
      workerState: this.state,
      isActive: this.isActive,
      isConnected: this.isConnected,
      workerUptimeSeconds: Math.floor((now - this.workerStartTimestamp) / 1000),
      sessionUptimeSeconds: this.sessionStartTimestamp
        ? Math.floor((now - this.sessionStartTimestamp) / 1000)
        : 0,
      lastMessageReceivedAt: this.lastMessageReceivedAt
        ? new Date(this.lastMessageReceivedAt).toISOString()
        : null,
      lastEventAt: this.lastEventAt ? new Date(this.lastEventAt).toISOString() : null,
      lastAuthenticatedAt: this.lastAuthenticatedAt
        ? new Date(this.lastAuthenticatedAt).toISOString()
        : null,
      lastReadyAt: this.lastReadyAt ? new Date(this.lastReadyAt).toISOString() : null,
      lastDisconnectedAt: this.lastDisconnectedAt
        ? new Date(this.lastDisconnectedAt).toISOString()
        : null,
      lastReconnectAt: this.lastReconnectAt
        ? new Date(this.lastReconnectAt).toISOString()
        : null,
      reconnectAttempts: this.reconnectAttempts,
      reconnectAttemptsTotal: this.reconnectAttemptsTotal,
      memoryUsageMb: {
        rss: Math.round(mem.rss / (1024 * 1024)),
        heapTotal: Math.round(mem.heapTotal / (1024 * 1024)),
        heapUsed: Math.round(mem.heapUsed / (1024 * 1024)),
      },
    };
  }
}
