import QRCode from "qrcode";
import { SupabaseClient } from "@supabase/supabase-js";
import {
  recordCapturedCall,
  recordSystemLog,
  updateSessionStatus,
} from "@velox/database";
import { VeloxScraper } from "./scraper";
import { calcularPrevia } from "./calculator";
import { WhatsAppProvider, IncomingMessagePayload } from "./whatsapp-provider";
import { BaileysProvider, purgeBaileysSessionDir } from "./baileys-provider";

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

export class WhatsAppWorker {
  private provider!: WhatsAppProvider;
  private scraper: VeloxScraper;
  private inviteRegex: RegExp;

  // Máquina de estados explícita para evitar race conditions
  private state: "STOPPED" | "STARTING" | "RUNNING" | "RECOVERING" | "STOPPING" = "STOPPED";
  private isActive: boolean = true;
  private isConnected: boolean = false;

  // Anti-Spam e Limites
  private qrCount: number = 0;
  private maxQrAttempts: number = 8;

  // Reconexão e Cooldowns
  private reconnectAttempts: number = 0;
  private reconnectAttemptsTotal: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectCooldownWindowMs: number = 10 * 60 * 1000;
  private lastReconnectTime: number = 0;
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
    private phoneNumber?: string | null
  ) {
    const defaultPattern =
      "https:\\/\\/prestador\\.veloxcontactcenter\\.com\\.br\\/prestador\\/ConvitePrestador\\/VisualizarConvite\\?ChaveConvite=[a-f0-9\\-]+";
    this.inviteRegex = new RegExp(
      targetRegexPattern || process.env.TARGET_REGEX || defaultPattern,
      "i"
    );
    this.scraper = new VeloxScraper(
      parseInt(process.env.HTTP_TIMEOUT || "5000", 10)
    );

    this.provider = this.createProvider();
  }

  private createProvider(): WhatsAppProvider {
    const provider = new BaileysProvider(this.tenantId);
    this.setupListenersForProvider(provider);
    return provider;
  }

  public setIsActive(active: boolean): void {
    const previous = this.isActive;
    this.isActive = active;
    if (previous !== active) {
      console.log(
        `[Worker] Estado da automação alterado para tenant ${this.tenantId}: ${
          active ? "LIGADO" : "PAUSADO"
        }`
      );
    }
  }

  public async restartForFreshAuth(phoneNumber?: string | null): Promise<void> {
    console.log(
      `[Worker] Forçando reinicialização limpa de autenticação Baileys para tenant ${this.tenantId}...`
    );
    this.phoneNumber = phoneNumber !== undefined ? phoneNumber : this.phoneNumber;
    this.qrCount = 0;
    await this.stop();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    purgeBaileysSessionDir(this.tenantId);
    this.provider = this.createProvider();
    await this.start();
  }

  public getPhoneNumber(): string | null | undefined {
    return this.phoneNumber;
  }

  public isRunning(): boolean {
    return this.state === "RUNNING" || this.state === "STARTING";
  }

  public getWorkerState(): string {
    return this.state;
  }

  public async requestPairingCodeOnDemand(phoneNumber: string): Promise<string | null> {
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    this.phoneNumber = cleanPhone;
    this.qrCount = 0;

    if (!this.isRunning()) {
      console.log(
        `[Worker] Robô estava pausado/parado. Reiniciando cliente para tenant ${this.tenantId}...`
      );
      await this.start();
      return null;
    }

    try {
      console.log(
        `[Worker Baileys] Solicitando Código de Pareamento sob demanda para número ${cleanPhone}...`
      );
      const pairingCode = await this.provider.requestPairingCode(cleanPhone);
      console.log(`[Worker Baileys] Código de Pareamento gerado sob demanda: ${pairingCode}`);

      await updateSessionStatus(
        this.supabase,
        this.sessionId,
        "DISCONNECTED_NEED_QR",
        null,
        "vps-worker-01",
        pairingCode,
        cleanPhone
      );

      await recordSystemLog(this.supabase, {
        tenant_id: this.tenantId,
        level: "INFO",
        event_type: "PAIRING_CODE_GENERATED",
        message: `Código de Pareamento por telefone gerado com sucesso: ${pairingCode}`,
        details: { phoneNumber: cleanPhone, pairingCode },
      });

      return pairingCode;
    } catch (pairErr: any) {
      const errMsg = pairErr?.message || String(pairErr || "");
      console.error(
        "[Worker Baileys] Erro ao solicitar Código de Pareamento sob demanda:",
        errMsg
      );

      await recordSystemLog(this.supabase, {
        tenant_id: this.tenantId,
        level: "ERROR",
        event_type: "PAIRING_CODE_ERROR",
        message: `Falha ao gerar código por telefone: ${errMsg}`,
        details: { phoneNumber: cleanPhone, error: errMsg },
      });

      return null;
    }
  }

  // ── Event Wiring ──────────────────────────────────────────────────────

  /**
   * Conecta os eventos do provider aos handlers especializados.
   */
  private setupListenersForProvider(provider: WhatsAppProvider): void {
    provider.on("qr", (qr) => this.handleQrGenerated(qr));
    provider.on("authenticated", () => this.handleAuthenticated());
    provider.on("ready", () => this.handleReady());
    provider.on("disconnected", (reason, isLoggedOut, statusCode) => this.handleDisconnected(reason, isLoggedOut, statusCode));
    provider.on("message", (msg) => this.handleIncomingMessage(msg));
  }

  // ── Lifecycle Event Handlers ──────────────────────────────────────────

  /**
   * Handler de geração de QR Code com proteção anti-spam.
   */
  private async handleQrGenerated(qrText: string): Promise<void> {
    this.lastEventAt = Date.now();
    this.qrCount++;

    if (this.qrCount > this.maxQrAttempts) {
      if (this.qrCount === this.maxQrAttempts + 1) {
        console.warn(
          `[Worker Anti-Spam] Limite de ${this.maxQrAttempts} renovações de QR Code atingido para tenant ${this.tenantId}. Encerrando socket inativo...`
        );
        await updateSessionStatus(
          this.supabase,
          this.sessionId,
          "DISCONNECTED",
          null,
          "vps-worker-01",
          null,
          null
        );
        await this.stop();
      }
      return;
    }

    console.log(
      `[Worker Baileys] Geração de autenticação #${this.qrCount}/${this.maxQrAttempts} recebida para tenant ${this.tenantId}`
    );

    try {
      const qrDataUrl = await QRCode.toDataURL(qrText);

      await updateSessionStatus(
        this.supabase,
        this.sessionId,
        "DISCONNECTED_NEED_QR",
        qrDataUrl,
        "vps-worker-01",
        null,
        null
      );

      await recordSystemLog(this.supabase, {
        tenant_id: this.tenantId,
        level: "INFO",
        event_type: "QR_GENERATED",
        message: "Novo Código de Conexão (QR Code) gerado via Baileys.",
      });
    } catch (err: any) {
      console.error("[Worker Baileys] Erro ao converter QR Code:", err.message);
    }
  }

  /**
   * Handler de autenticação em andamento.
   */
  private async handleAuthenticated(): Promise<void> {
    this.lastEventAt = Date.now();
    this.lastAuthenticatedAt = Date.now();
    console.log(
      `[Worker Baileys] ✨ Conexão autenticada/reconectando para tenant ${this.tenantId}...`
    );

    await updateSessionStatus(
      this.supabase,
      this.sessionId,
      "AUTHENTICATING",
      null,
      "vps-worker-01",
      null,
      this.phoneNumber || null
    );

    await recordSystemLog(this.supabase, {
      tenant_id: this.tenantId,
      level: "INFO",
      event_type: "SESSION_AUTHENTICATED",
      message: "Autenticação Baileys em andamento...",
    });
  }

  /**
   * Handler de sessão pronta e conectada.
   */
  private async handleReady(): Promise<void> {
    this.lastEventAt = Date.now();
    this.lastReadyAt = Date.now();
    console.log(`[Worker Baileys] Socket WhatsApp conectado para tenant ${this.tenantId}`);
    this.isConnected = true;
    this.reconnectAttempts = 0;

    if (this.authTimeoutTimer) {
      clearTimeout(this.authTimeoutTimer);
      this.authTimeoutTimer = null;
    }

    await updateSessionStatus(
      this.supabase,
      this.sessionId,
      "CONNECTED",
      null,
      "vps-worker-01"
    );

    await recordSystemLog(this.supabase, {
      tenant_id: this.tenantId,
      level: "INFO",
      event_type: "SESSION_READY",
      message: "WhatsApp Baileys conectado e pronto para automação.",
    });
  }

  /**
   * Handler de desconexão com lógica de logout vs reconexão com backoff exponencial.
   * Respeita maxReconnectAttempts para evitar loop infinito.
   */
  private async handleDisconnected(reason: string, isLoggedOut: boolean, statusCode?: number): Promise<void> {
    this.lastEventAt = Date.now();
    this.lastDisconnectedAt = Date.now();
    console.warn(
      `[Worker Baileys] WhatsApp desconectado (${reason}) para tenant ${this.tenantId} [LoggedOut: ${isLoggedOut}, statusCode: ${statusCode ?? 'undefined'}]`
    );
    this.isConnected = false;

    // ── Cenário 1: Logout explícito ou credenciais revogadas ──
    if (isLoggedOut) {
      console.warn(
        `[Worker Baileys] Logout explícito ou credenciais revogadas para tenant ${this.tenantId}. Expurgando pasta e reiniciando robô...`
      );
      this.qrCount = 0;
      this.reconnectAttempts = 0;
      await this.stop();
      await new Promise((res) => setTimeout(res, 1000));
      purgeBaileysSessionDir(this.tenantId);

      await updateSessionStatus(
        this.supabase,
        this.sessionId,
        "DISCONNECTED_NEED_QR",
        null,
        "vps-worker-01",
        null,
        null
      );

      await recordSystemLog(this.supabase, {
        tenant_id: this.tenantId,
        level: "WARN",
        event_type: "SESSION_LOGOUT",
        message: "Sessão desautorizada/desconectada pelo WhatsApp. Pasta de sessão expurgada.",
      });

      try {
        this.provider = this.createProvider();
        await this.start();
      } catch (restartErr: any) {
        console.error(
          "[Worker Baileys] Erro ao reiniciar worker após logout:",
          restartErr?.message
        );
      }
      return;
    }

    // ── Cenário 2: Restart Required (515) — reconexão imediata sem penalidade ──
    if (statusCode === 515) {
      console.log(
        `[Worker Baileys] Servidor WhatsApp solicitou restart (515) para tenant ${this.tenantId}. Reconectando imediatamente...`
      );
      // NÃO incrementar reconnectAttempts — é uma solicitação legítima do servidor
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(async () => {
        try {
          await this.provider.reconnect();
        } catch (err: any) {
          console.error(
            "[Worker Baileys Reconnect] Erro ao reconectar após restart 515:",
            err.message
          );
        }
      }, 3000);
      return;
    }

    // ── Cenário 3: Erro transitório — reconectar com backoff ──
    await updateSessionStatus(
      this.supabase,
      this.sessionId,
      "DISCONNECTED",
      null,
      "vps-worker-01"
    );

    this.reconnectAttempts++;
    this.reconnectAttemptsTotal++;
    this.lastReconnectAt = Date.now();

    // Verificar limite de reconexões
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      console.error(
        `[Worker Baileys] ⛔ Limite de reconexões atingido (${this.reconnectAttempts - 1}/${this.maxReconnectAttempts}) para tenant ${this.tenantId}. Parando tentativas automáticas.`
      );

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

    // Backoff: statusCode undefined (Stream Errored) usa backoff mais longo
    const isUndefinedStatus = statusCode === undefined;
    const baseDelay = isUndefinedStatus ? 5000 : 2000;
    const backoffDelayMs = Math.min(
      60000,
      Math.pow(2, this.reconnectAttempts) * baseDelay +
        Math.floor(Math.random() * 1000)
    );
    console.log(
      `[Worker Baileys Reconnect] Agendando reconexão automática #${this.reconnectAttempts}/${this.maxReconnectAttempts} em ${(
        backoffDelayMs / 1000
      ).toFixed(1)}s...`
    );

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(async () => {
      try {
        console.log(
          `[Worker Baileys Reconnect] Executando reconexão para tenant ${this.tenantId}...`
        );
        await this.provider.reconnect();
      } catch (err: any) {
        console.error(
          "[Worker Baileys Reconnect] Erro ao reconectar sessão salva:",
          err.message
        );
      }
    }, backoffDelayMs);
  }

  // ── Message Processing Pipeline ───────────────────────────────────────

  /**
   * Handler de mensagem recebida. Detecta convites Velox e dispara o pipeline de aceite.
   */
  private async handleIncomingMessage(msg: IncomingMessagePayload): Promise<void> {
    if (!msg || !msg.body) return;

    this.lastEventAt = Date.now();
    this.lastMessageReceivedAt = Date.now();

    const match = msg.body.match(this.inviteRegex);
    if (!match) return;

    const targetUrl = match[0];
    console.log(
      `[Worker Baileys] 🎉 Convite Velox capturado no WhatsApp! [Tenant: ${this.tenantId}] Link: ${targetUrl}`
    );

    if (!this.isActive) {
      console.log(
        `[Worker Baileys] Automação pausada pelo prestador. Ignorando convite: ${targetUrl}`
      );
      await recordSystemLog(this.supabase, {
        tenant_id: this.tenantId,
        level: "WARN",
        event_type: "AUTOMATION_PAUSED",
        message: "Convite recebido mas ignorado pois a automação está pausada pelo prestador.",
        details: { url: targetUrl },
      });
      return;
    }

    try {
      const chaveConvite = extractChaveConvite(targetUrl);
      const allocation = await this.resolveFleetAllocation(targetUrl, chaveConvite);

      // null indica que a capacidade da frota foi atingida — abortar silenciosamente
      if (!allocation) return;

      const { isDuplicate, availableVehicle } = allocation;

      setImmediate(async () => {
        await this.executeInviteAcceptance(targetUrl, isDuplicate, availableVehicle);
      });
    } catch (err: any) {
      console.error(
        "[Worker Baileys] Erro ao verificar capacidade da frota:",
        err.message
      );
    }
  }

  /**
   * Verifica deduplicação por ChaveConvite no banco e disponibilidade da frota.
   * Retorna null se a capacidade foi atingida (convite deve ser ignorado).
   */
  private async resolveFleetAllocation(
    targetUrl: string,
    chaveConvite: string | null
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
      console.warn(
        `[Worker Baileys] ⚠️ Chamado duplicado identificado (${
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
        details: { url: targetUrl, chaveConvite },
      });

      return { isDuplicate: true, availableVehicle: null };
    }

    // Não é duplicado — verificar capacidade da frota
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
      console.log(
        `[Worker Baileys] Capacidade máxima da frota atingida (${activeCalls.length}/${fleetCapacity} atendimentos ativos). Ignorando convite.`
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

  /**
   * Executa o aceite do convite via scraper e registra o resultado no banco.
   */
  private async executeInviteAcceptance(
    targetUrl: string,
    isDuplicate: boolean,
    availableVehicle: any
  ): Promise<void> {
    try {
      const result = await this.scraper.processarConvite(targetUrl);
      const previaMinutos = calcularPrevia(result.distanciaKm);

      const responsePayloadToRecord = {
        ...(result.responsePayload || {}),
        debugInfo: result.debugInfo || null,
        attemptsMade: result.attemptsMade,
        payloadSent: result.payload || null,
        isDuplicate: isDuplicate || undefined,
      };

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
        },
      });
    } catch (asyncErr: any) {
      console.error(
        `[Worker Baileys] Erro crítico no processamento assíncrono do convite para tenant ${this.tenantId}:`,
        asyncErr?.message
      );
      try {
        await recordSystemLog(this.supabase, {
          tenant_id: this.tenantId,
          level: "ERROR",
          event_type: "ASYNC_INVITE_PROCESSING_ERROR",
          message: `Exceção capturada em setImmediate: ${asyncErr?.message}`,
          details: { url: targetUrl, error: asyncErr?.stack },
        });
      } catch (_) {}
    }
  }

  // ── Lifecycle Control ─────────────────────────────────────────────────

  /**
   * Inicializa o worker do WhatsApp Baileys.
   */
  public async start(): Promise<void> {
    if (this.state === "STARTING" || this.state === "RUNNING") {
      console.log(
        `[Worker Baileys] Worker já está rodando ou em processo de inicialização para tenant ${this.tenantId}. Ignorando chamada.`
      );
      return;
    }
    this.state = "STARTING";
    this.sessionStartTimestamp = Date.now();
    this.lastMessageReceivedAt = Date.now();
    this.lastEventAt = Date.now();

    try {
      console.log(`[Worker Baileys] Inicializando socket Baileys para tenant ${this.tenantId}...`);
      await this.provider.start();
      this.state = "RUNNING";
    } catch (err: any) {
      this.state = "STOPPED";
      throw err;
    }
  }

  /**
   * Encerra o worker e libera todos os recursos.
   */
  public async stop(): Promise<void> {
    this.state = "STOPPING";
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
    this.state = "STOPPED";
  }

  // ── Observability ─────────────────────────────────────────────────────

  /**
   * Métricas de Observabilidade do Worker.
   */
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
