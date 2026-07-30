import { Client, LocalAuth } from "whatsapp-web.js";
import QRCode from "qrcode";
import fs from "fs";
import { SupabaseClient } from "@supabase/supabase-js";
import {
  recordCapturedCall,
  recordSystemLog,
  updateSessionStatus,
} from "@velox/database";
import { VeloxScraper } from "./scraper";
import { calcularPrevia } from "./calculator";
import path from "path";

/**
 * Resolve o caminho do executável do Chromium/Chrome.
 * Precedência:
 *  1. PUPPETEER_EXECUTABLE_PATH do .env.
 *  2. Auto-detecção de binários nativos no SO (Linux ARM64 / Ubuntu / Windows).
 *  3. null — Puppeteer usará o Chromium bundled.
 */
function getSystemChromePath(): string | null {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
    console.log(`[Worker] Utilizando navegador definido em .env: ${envPath}`);
    return envPath;
  }

  if (process.platform === "win32") {
    const paths = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      (process.env.LOCALAPPDATA || "") + "\\Google\\Chrome\\Application\\chrome.exe",
    ];
    for (const p of paths) {
      if (p && fs.existsSync(p)) {
        console.log(`[Worker] Utilizando navegador Chrome instalado em: ${p}`);
        return p;
      }
    }
  } else {
    const paths = [
      "/snap/bin/chromium",
      "/usr/bin/chromium",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/google-chrome",
      "/usr/bin/chromium-browser",
    ];
    for (const p of paths) {
      if (p && fs.existsSync(p)) {
        console.log(`[Worker] Utilizando navegador Chrome instalado em: ${p}`);
        return p;
      }
    }
  }

  console.warn(
    "[Worker] Nenhum Chromium/Chrome encontrado. Puppeteer usará o Chromium embutido."
  );
  return null;
}

/**
 * Encerra com segurança o processo do navegador Puppeteer e força SIGKILL no PID caso persista.
 */
async function safelyCloseAndKillBrowser(client: Client | null): Promise<void> {
  if (!client) return;
  try {
    const pupBrowser = (client as any).pupBrowser;
    const pid = pupBrowser?.process()?.pid;

    try {
      await client.destroy();
    } catch (_) {}

    if (pid) {
      try {
        process.kill(pid, "SIGKILL");
      } catch (_) {}
    }
  } catch (err: any) {
    console.warn(`[Worker] Aviso ao encerrar processo do navegador: ${err?.message}`);
  }
}

/**
 * Expurga completamente o diretório de sessão do disco em caso de logout ou auth_failure.
 */
function purgeSessionDir(tenantId: string): void {
  try {
    const authDataPath =
      process.env.WWEBJS_AUTH_PATH || path.resolve(process.cwd(), ".wwebjs_auth");
    const sessionDir = path.join(authDataPath, `session-tenant_${tenantId}`);

    if (fs.existsSync(sessionDir)) {
      console.log(
        `[Worker] Expurgando diretório de sessão desautorizada/desconectada: ${sessionDir}`
      );
      fs.rmSync(sessionDir, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 300,
      });
    }
  } catch (err: any) {
    console.warn(`[Worker] Erro ao expurgar pasta de sessão: ${err?.message}`);
  }
}

/**
 * Remove travas de arquivos de perfil do Chrome (SingletonLock, DevToolsActivePort, etc.)
 * para evitar erros de "Browser already closed" ou travamento de inicialização.
 */
function cleanSessionLockFiles(tenantId: string): void {
  try {
    const authDataPath =
      process.env.WWEBJS_AUTH_PATH || path.resolve(process.cwd(), ".wwebjs_auth");
    const sessionDir = path.join(authDataPath, `session-tenant_${tenantId}`);

    if (!fs.existsSync(sessionDir)) return;

    const lockFiles = [
      "SingletonLock",
      "SingletonCookie",
      "SingletonSocket",
      "DevToolsActivePort",
    ];

    const dirsToCheck = [sessionDir, path.join(sessionDir, "Default")];

    for (const d of dirsToCheck) {
      if (fs.existsSync(d)) {
        for (const file of lockFiles) {
          const filePath = path.join(d, file);
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
              console.log(`[Worker] Trava de sessão de navegador removida: ${filePath}`);
            } catch (_) {}
          }
        }
      }
    }
  } catch (err: any) {
    console.warn(`[Worker] Erro ao limpar travamentos de arquivo de sessão: ${err?.message}`);
  }
}

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
  chromiumUptimeSeconds: number;
  lastMessageReceivedAt: string | null;
  lastEventAt: string | null;
  lastLoadingScreenAt: string | null;
  lastStateChangeAt: string | null;
  lastAuthenticatedAt: string | null;
  lastReadyAt: string | null;
  lastDisconnectedAt: string | null;
  lastAuthFailureAt: string | null;
  lastReconnectAt: string | null;
  lastRestartAt: string | null;
  lastPreventiveReloadAt: string | null;
  reconnectAttempts: number;
  reconnectAttemptsTotal: number;
  zombieDetectCount: number;
  autoRestartCount: number;
  preventiveReloadCount: number;
  chromiumCrashCount: number;
  memoryUsageMb: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
  };
}

export class WhatsAppWorker {
  private client!: Client;
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

  // Watchdog e Health Checks
  private watchdogInterval: NodeJS.Timeout | null = null;
  private preventiveReloadInterval: NodeJS.Timeout | null = null;
  private consecutiveHealthFailures: number = 0;

  // Instrumentação e Telemetria (Timestamps de Ciclo de Vida)
  private workerStartTimestamp: number = Date.now();
  private sessionStartTimestamp: number = 0;
  private chromiumStartTimestamp: number = 0;

  private lastMessageReceivedAt: number = 0;
  private lastEventAt: number = Date.now();
  private lastLoadingScreenAt: number = 0;
  private lastStateChangeAt: number = 0;
  private lastAuthenticatedAt: number = 0;
  private lastReadyAt: number = 0;
  private lastDisconnectedAt: number = 0;
  private lastAuthFailureAt: number = 0;
  private lastReconnectAt: number = 0;
  private lastRestartAt: number = 0;
  private lastPreventiveReloadAt: number = 0;

  // Contadores de Incidentes para Diagnóstico
  private zombieDetectCount: number = 0;
  private autoRestartCount: number = 0;
  private preventiveReloadCount: number = 0;
  private chromiumCrashCount: number = 0;

  // Deduplicação LRU com TTL para IDs de Mensagem
  private processedMsgIds = new Map<string, number>();

  // Threshold do Activity Heartbeat Probe (20 minutos de silêncio para testar socket)
  private readonly SILENCE_PROBE_THRESHOLD_MS: number = 20 * 60 * 1000;

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

    this.client = this.createClient();
  }

  /**
   * Configuração otimizada do Chromium Puppeteer para ambiente 24/7 ARM64.
   * Adiciona flags estritas para impedir vazamentos de memória Heap V8 e congelamentos de processos.
   */
  private createClient(): Client {
    const puppeteerConfig: any = {
      headless: true,
      protocolTimeout: 360000, // 6 minutos — evita estouro de timeout no CDP em instâncias ARM64 sobrecarregadas
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
        "--disable-session-crashed-bubble",
        "--disable-infobars",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        "--disable-component-update",
        "--disable-ipc-flooding-protection",
        "--no-default-browser-check",
        "--disable-hang-monitor",
        // ETAPA 4 — Otimizações estritas para estabilidade 24/7 no ARM64 (Oracle Cloud / Ubuntu)
        // Restringe o tamanho máximo da Heap V8 a 512MB para forçar o GC a purgar objetos mortos do JS
        '--js-flags="--max-old-space-size=512"',
        "--disable-site-isolation-trials",
        "--disable-breakpad",
        "--memory-pressure-off",
        "--disable-background-networking",
        "--disable-sync",
        "--mute-audio",
        "--no-pings",
        "--disable-features=TranslateUI,BlinkGenPropertyTrees,Translate",
      ],
      env: {
        ...process.env,
        SYSTEMD_IGNORE_CHROOT: "1",
        DBUS_SESSION_BUS_ADDRESS: "/dev/null",
      },
    };

    const systemChromePath = getSystemChromePath();
    if (systemChromePath) {
      console.log(`[Worker] Utilizando navegador Chrome instalado em: ${systemChromePath}`);
      puppeteerConfig.executablePath = systemChromePath;
    }

    const authDataPath =
      process.env.WWEBJS_AUTH_PATH || path.resolve(process.cwd(), ".wwebjs_auth");

    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: `tenant_${this.tenantId}`,
        dataPath: authDataPath,
      }),
      webVersionCache: {
        type: "local",
      },
      puppeteer: puppeteerConfig,
    });

    this.setupListenersForClient(client);
    return client;
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
      `[Worker] Forçando reinicialização limpa de autenticação para tenant ${this.tenantId}...`
    );
    this.phoneNumber = phoneNumber !== undefined ? phoneNumber : this.phoneNumber;
    this.qrCount = 0;
    await this.stop();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    purgeSessionDir(this.tenantId);
    this.client = this.createClient();
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

  /**
   * Solicita o código de pareamento por número de telefone.
   */
  private async executePairingCodeWithRetry(phoneNumber: string): Promise<string> {
    const digits = phoneNumber.replace(/\D/g, "");

    let fullPhoneWithDdi = digits;
    if (
      !fullPhoneWithDdi.startsWith("55") &&
      (fullPhoneWithDdi.length === 10 || fullPhoneWithDdi.length === 11)
    ) {
      fullPhoneWithDdi = `55${fullPhoneWithDdi}`;
    }

    const formatsToTry: string[] = [];
    if (fullPhoneWithDdi.startsWith("55")) {
      if (fullPhoneWithDdi.length === 13) {
        formatsToTry.push(fullPhoneWithDdi);
        const withoutNine = "55" + fullPhoneWithDdi.slice(2, 4) + fullPhoneWithDdi.slice(5);
        if (!formatsToTry.includes(withoutNine)) formatsToTry.push(withoutNine);
      } else if (fullPhoneWithDdi.length === 12) {
        formatsToTry.push(fullPhoneWithDdi);
        const withNine = "55" + fullPhoneWithDdi.slice(2, 4) + "9" + fullPhoneWithDdi.slice(4);
        if (!formatsToTry.includes(withNine)) formatsToTry.push(withNine);
      } else {
        formatsToTry.push(fullPhoneWithDdi);
      }
    } else {
      formatsToTry.push(fullPhoneWithDdi);
    }

    console.log(
      `[Worker Pairing] Formatos de telefone com DDI internacional a testar:`,
      formatsToTry
    );

    const pupPage = (this.client as any).pupPage;

    for (let index = 0; index < formatsToTry.length; index++) {
      const phoneCandidate = formatsToTry[index];

      if (index > 0 && pupPage) {
        try {
          console.log(
            `[Worker Pairing] Recarregando página Chromium para redefinir estado de pareamento...`
          );
          await pupPage.evaluate(() => location.reload());
          await new Promise((resolve) => setTimeout(resolve, 4000));
        } catch (reloadErr: any) {
          console.warn(
            `[Worker Pairing] Erro ao recarregar página: ${reloadErr?.message}`
          );
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      if (pupPage) {
        try {
          await pupPage.waitForFunction(
            () =>
              (window as any).AuthStore &&
              (window as any).AuthStore.PairingCodeLinkUtils !== undefined,
            { timeout: 8000 }
          );
        } catch (_) {
          console.warn(
            "[Worker Pairing] AuthStore.PairingCodeLinkUtils não respondeu em 8s. Tentando avançar..."
          );
        }
      }

      try {
        console.log(
          `[Worker Pairing] Solicitando Código de Pareamento (formato DDI: ${phoneCandidate})...`
        );
        const code = await (this.client as any).requestPairingCode(phoneCandidate);
        if (code && typeof code === "string" && code.length >= 6) {
          console.log(
            `[Worker Pairing] ✨ Código de Pareamento VÁLIDO gerado com sucesso (${phoneCandidate}): ${code}`
          );
          return code;
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err || "");
        console.warn(
          `[Worker Pairing] Erro com formato ${phoneCandidate}: (${errMsg})`
        );
      }
    }

    throw new Error(
      "Não foi possível gerar o código por telefone no momento. Tente novamente em instantes."
    );
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
        `[Worker] Solicitando Código de Pareamento sob demanda para número ${cleanPhone}...`
      );
      const pairingCode = await this.executePairingCodeWithRetry(cleanPhone);
      console.log(`[Worker] Código de Pareamento gerado sob demanda: ${pairingCode}`);

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
        "[Worker] Aviso ao solicitar Código de Pareamento sob demanda:",
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

  /**
   * Configuração de ouvintes de eventos da instância do WhatsApp Web JS.
   */
  private setupListenersForClient(client: Client): void {
    // Evento de geração de QR Code
    client.on("qr", async (qrText: string) => {
      this.lastEventAt = Date.now();
      if (client.info && client.info.wid) return;

      const authDataPath =
        process.env.WWEBJS_AUTH_PATH || path.resolve(process.cwd(), ".wwebjs_auth");
      const sessionDir = path.join(authDataPath, `session-tenant_${this.tenantId}`);
      const hasDiskSession = fs.existsSync(sessionDir);
      const elapsedSinceStart = Date.now() - this.sessionStartTimestamp;

      if (hasDiskSession && elapsedSinceStart < 15000 && this.qrCount === 0) {
        console.log(
          `[Worker] QR Code detectado durante restauração de sessão para tenant ${this.tenantId}. Aguardando autenticação local...`
        );
        this.qrCount++;
        return;
      }

      this.qrCount++;

      if (this.qrCount > this.maxQrAttempts) {
        if (this.qrCount === this.maxQrAttempts + 1) {
          console.warn(
            `[Worker Anti-Spam] Limite de ${this.maxQrAttempts} renovações de QR Code atingido para tenant ${this.tenantId}. Encerrando navegador inativo...`
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
        `[Worker] Geração de autenticação #${this.qrCount}/${this.maxQrAttempts} recebida para tenant ${this.tenantId}`
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
          message: "Novo Código de Conexão (QR Code) gerado.",
        });
      } catch (err: any) {
        console.error("[Worker] Erro ao converter QR Code:", err.message);
      }
    });

    // Evento disparado ao autenticar no celular
    client.on("authenticated", async () => {
      this.lastEventAt = Date.now();
      this.lastAuthenticatedAt = Date.now();
      console.log(
        `[Worker] ✨ Conexão aprovada pelo celular para tenant ${this.tenantId}! Inicializando automação...`
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
        message: "Código/QR Code lido no celular com sucesso! Inicializando a automação...",
      });

      if (this.authTimeoutTimer) clearTimeout(this.authTimeoutTimer);
      this.authTimeoutTimer = setTimeout(async () => {
        if (!this.isConnected) {
          console.warn(
            `[Worker] Timeout de 45s aguardando evento ready pós-autenticação para tenant ${this.tenantId}. Efetuando reinicialização limpa...`
          );
          await this.handleZombieReconnection("Timeout de 45s no evento ready pós-autenticação");
        }
      }, 45000);
    });

    // Evento de carregamento de conversas
    client.on("loading_screen", async (percent: number, message: string) => {
      this.lastEventAt = Date.now();
      this.lastLoadingScreenAt = Date.now();
      console.log(
        `[Worker] Carregando conversas do WhatsApp para tenant ${this.tenantId}: ${percent}% (${message})`
      );
    });

    // Evento de alteração de estado da conexão
    client.on("change_state", (state: string) => {
      this.lastEventAt = Date.now();
      this.lastStateChangeAt = Date.now();
      console.log(
        `[Worker] Estado da conexão alterado no WhatsApp Web para tenant ${this.tenantId}: ${state}`
      );
      if (
        state === "DISCONNECTED" ||
        state === "UNPAIRED" ||
        state === "TIMEOUT"
      ) {
        this.isConnected = false;
      }
    });

    // Evento de sessão pronta
    client.on("ready", async () => {
      this.lastEventAt = Date.now();
      this.lastReadyAt = Date.now();
      this.chromiumStartTimestamp = Date.now();
      console.log(`[Worker] WhatsApp Web conectado para tenant ${this.tenantId}`);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.consecutiveHealthFailures = 0;

      if (this.authTimeoutTimer) {
        clearTimeout(this.authTimeoutTimer);
        this.authTimeoutTimer = null;
      }

      // ETAPAS 6, 7 & 11 — Inicializa o Watchdog e o Agendador de Reload Preventivo
      this.startWatchdog();
      this.startPreventiveReloadSchedule();

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
        message: "WhatsApp Web conectado e pronto para automação.",
      });
    });

    // Evento de falha de autenticação
    client.on("auth_failure", async (msg: string) => {
      this.lastEventAt = Date.now();
      this.lastAuthFailureAt = Date.now();
      console.warn(
        `[Worker] Falha de autenticação (sessão revogada) para tenant ${this.tenantId}: ${msg}`
      );
      this.isConnected = false;
      this.qrCount = 0;
      await this.stop();
      await new Promise((res) => setTimeout(res, 1000));
      purgeSessionDir(this.tenantId);

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
        event_type: "AUTH_FAILURE",
        message: `Sessão revogada pelo WhatsApp: ${msg}. Pasta de sessão expurgada com sucesso.`,
      });

      try {
        this.client = this.createClient();
        await this.start();
      } catch (restartErr: any) {
        console.error(
          "[Worker] Erro ao reiniciar worker após auth_failure:",
          restartErr?.message
        );
      }
    });

    // Evento de desconexão
    client.on("disconnected", async (reason: string) => {
      this.lastEventAt = Date.now();
      this.lastDisconnectedAt = Date.now();
      console.warn(
        `[Worker] WhatsApp desconectado (${reason}) para tenant ${this.tenantId}`
      );
      this.isConnected = false;

      const now = Date.now();
      if (now - this.lastReconnectTime > this.reconnectCooldownWindowMs) {
        this.reconnectAttempts = 0;
      }
      this.lastReconnectTime = now;
      this.lastReconnectAt = now;

      if (reason === "LOGOUT") {
        console.warn(
          `[Worker] Logout explícito no celular detectado para tenant ${this.tenantId}. Expurgando pasta e reiniciando robô em estado limpo...`
        );
        this.qrCount = 0;
        await this.stop();
        await new Promise((res) => setTimeout(res, 1000));
        purgeSessionDir(this.tenantId);

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
          message: "Sessão desconectada via WhatsApp (Logout). Pasta de sessão expurgada.",
        });

        try {
          this.client = this.createClient();
          await this.start();
        } catch (restartErr: any) {
          console.error(
            "[Worker] Erro ao reiniciar worker após logout:",
            restartErr?.message
          );
        }
        return;
      }

      await updateSessionStatus(
        this.supabase,
        this.sessionId,
        "DISCONNECTED",
        null,
        "vps-worker-01"
      );

      this.reconnectAttempts++;
      this.reconnectAttemptsTotal++;
      const backoffDelayMs = Math.min(
        60000,
        Math.pow(2, this.reconnectAttempts) * 2000 +
          Math.floor(Math.random() * 1000)
      );
      console.log(
        `[Worker Reconnect] Agendando reconexão automática #${this.reconnectAttempts} em ${(
          backoffDelayMs / 1000
        ).toFixed(1)}s...`
      );

      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(async () => {
        try {
          console.log(
            `[Worker Reconnect] Reiniciando cliente limpo para reconexão do tenant ${this.tenantId}...`
          );
          await this.stop();
          await new Promise((res) => setTimeout(res, 1000));
          this.client = this.createClient();
          await this.start();
        } catch (err: any) {
          console.error(
            "[Worker Reconnect] Erro ao reconectar sessão salva:",
            err.message
          );
        }
      }, backoffDelayMs);
    });

    /**
     * ETAPA 9 — message x message_create
     * Utiliza EXCLUSIVAMENTE o evento 'message' para recepção de convites externos.
     * Motivo: 'message_create' dispara para TODAS as mensagens criadas no WhatsApp (incluindo enviadas pelo próprio usuário e mensagens de sistema),
     * gerando execuções duplicadas do mesmo handler e consumo desnecessário de CPU no Node.js.
     */
    const processIncomingMessage = async (msg: any) => {
      if (!msg || !msg.body) return;

      this.lastEventAt = Date.now();
      this.lastMessageReceivedAt = Date.now();

      const sender = msg.from || "";
      if (
        sender.endsWith("@g.us") ||
        sender.endsWith("@broadcast") ||
        sender.endsWith("@newsletter")
      ) {
        return;
      }

      // Deduplicação com janela deslizante LRU + TTL de 30 minutos
      const msgId = msg.id?._serialized || `${sender}_${msg.timestamp}`;
      const nowMs = Date.now();
      if (this.processedMsgIds.has(msgId)) return;

      this.processedMsgIds.set(msgId, nowMs);
      if (this.processedMsgIds.size > 1000) {
        // Limpeza automática de IDs antigos (TTL > 30min)
        for (const [key, time] of this.processedMsgIds.entries()) {
          if (nowMs - time > 30 * 60 * 1000) {
            this.processedMsgIds.delete(key);
          }
        }
      }

      const match = msg.body.match(this.inviteRegex);
      if (match) {
        const targetUrl = match[0];
        console.log(
          `[Worker] 🎉 Convite Velox capturado no WhatsApp! [Tenant: ${this.tenantId}] Link: ${targetUrl}`
        );

        if (!this.isActive) {
          console.log(
            `[Worker] Automação pausada pelo prestador. Ignorando convite: ${targetUrl}`
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

          let availableVehicle: any = null;

          if (isDuplicate) {
            console.warn(
              `[Worker] ⚠️ Chamado duplicado identificado (${
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
          } else {
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
                `[Worker] Capacidade máxima da frota atingida (${activeCalls.length}/${fleetCapacity} atendimentos ativos). Ignorando convite.`
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
              return;
            }

            const assignedVehicleIds = new Set(
              activeCalls.map((c) => c.vehicle_id).filter(Boolean)
            );
            availableVehicle =
              (vehicles || []).find((v) => !assignedVehicleIds.has(v.id)) || null;
          }

          /**
           * ETAPA 10 — setImmediate com Tratamento Completo de Exceções
           * Envelopa todo o bloco assíncrono em try/catch para garantir que nenhuma exceção
           * escapa silenciosamente para unhandledRejection ou derruba o Event Loop.
           */
          setImmediate(async () => {
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
                `[Worker] Erro crítico no processamento assíncrono do convite para tenant ${this.tenantId}:`,
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
          });
        } catch (err: any) {
          console.error(
            "[Worker] Erro ao verificar capacidade da frota:",
            err.message
          );
        }
      }
    };

    // Registrar o handler APENAS no evento 'message'
    client.on("message", processIncomingMessage);
  }

  /**
   * ETAPA 6 & 7 — Watchdog e Monitoramento do Browser
   * Executa a cada 60 segundos para validar Puppeteer, CDP Session, Estado Interno do WebSocket
   * e registrar relatórios de telemetria nos logs.
   */
  private startWatchdog(): void {
    this.stopWatchdog();
    this.watchdogInterval = setInterval(async () => {
      await this.runWatchdogCheck();
    }, 60000);
  }

  private stopWatchdog(): void {
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }
  }

  /**
   * ETAPA 11 — Agendador de Reload Preventivo (Soft Reload sem Perda de Sessão)
   * Executa uma recarga limpa da página do WhatsApp Web a cada 24 horas para zerar o Heap JS do Chromium.
   */
  private startPreventiveReloadSchedule(): void {
    this.stopPreventiveReloadSchedule();
    // Executa a cada 24 horas (86.400.000 ms)
    this.preventiveReloadInterval = setInterval(async () => {
      await this.performPreventiveSoftReload();
    }, 24 * 60 * 60 * 1000);
  }

  private stopPreventiveReloadSchedule(): void {
    if (this.preventiveReloadInterval) {
      clearInterval(this.preventiveReloadInterval);
      this.preventiveReloadInterval = null;
    }
  }

  /**
   * Executa um reload preventivo suave na página do WhatsApp Web.
   */
  private async performPreventiveSoftReload(): Promise<void> {
    if (this.state !== "RUNNING" || !this.isConnected || !this.client) return;

    const pupPage = (this.client as any).pupPage;
    if (!pupPage || pupPage.isClosed()) return;

    console.log(
      `[Worker PreventativeReload] 🧹 Executando recarga diária preventiva da página para tenant ${this.tenantId} (Limpeza de Heap V8 e renovação do WebSocket)...`
    );

    try {
      this.lastPreventiveReloadAt = Date.now();
      this.preventiveReloadCount++;

      await pupPage.evaluate(() => location.reload());

      await recordSystemLog(this.supabase, {
        tenant_id: this.tenantId,
        level: "INFO",
        event_type: "PREVENTIVE_RELOAD",
        message: "Recarga preventiva diária da página executada com sucesso para zerar a Heap do Chromium.",
      });
    } catch (err: any) {
      console.warn(
        `[Worker PreventativeReload] Aviso ao recarregar página para tenant ${this.tenantId}: ${err?.message}`
      );
    }
  }

  /**
   * ETAPA 2, 3 & 5 — Execução do Watchdog com Verificação Tridimensional de Saúde e Active Heartbeat Probe
   */
  private async runWatchdogCheck(): Promise<void> {
    if (this.state !== "RUNNING" || !this.isConnected || !this.client) return;

    const metrics = this.getMetrics();
    console.log(
      `[Worker Watchdog] 📊 [Tenant: ${this.tenantId}] Uptime: ${(metrics.workerUptimeSeconds / 3600).toFixed(2)}h | State: ${metrics.workerState} | WS Connected: ${metrics.isConnected} | Mem RSS: ${metrics.memoryUsageMb.rss}MB | Msg Silence: ${Math.round((Date.now() - (this.lastMessageReceivedAt || this.workerStartTimestamp)) / 60000)}m`
    );

    // 1. Verificação do Puppeteer e Navegador Chromium
    try {
      const pupBrowser = (this.client as any).pupBrowser;
      const pupPage = (this.client as any).pupPage;

      if (!pupBrowser || !pupBrowser.isConnected()) {
        this.chromiumCrashCount++;
        console.warn(
          `[Worker Watchdog] 🚨 Browser Puppeteer desconectado para tenant ${this.tenantId}! Acionando Auto-Recovery...`
        );
        await this.handleZombieReconnection("Browser Puppeteer desconectado (browser.isConnected() === false)");
        return;
      }

      if (!pupPage || pupPage.isClosed()) {
        console.warn(
          `[Worker Watchdog] 🚨 Página do WhatsApp Web fechada (page.isClosed() === true) para tenant ${this.tenantId}! Acionando Auto-Recovery...`
        );
        await this.handleZombieReconnection("Página do WhatsApp Web fechada");
        return;
      }
    } catch (pupErr: any) {
      console.warn(
        `[Worker Watchdog] Falha ao verificar objetos Puppeteer para tenant ${this.tenantId}: ${pupErr?.message}`
      );
      await this.handleZombieReconnection(`Erro de acesso ao Puppeteer: ${pupErr?.message}`);
      return;
    }

    // 2. Verificação do Estado retornado pelo WhatsApp Web (com Timeout de 8s)
    try {
      const statePromise = this.client.getState();
      const timeoutPromise = new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error("getState timeout (8s)")), 8000)
      );

      const state = await Promise.race([statePromise, timeoutPromise]);

      if (state !== "CONNECTED") {
        this.consecutiveHealthFailures++;
        console.warn(
          `[Worker Watchdog] ⚠️ Estado do WhatsApp (${state}) diferente de CONNECTED para tenant ${this.tenantId} (Falha #${this.consecutiveHealthFailures}).`
        );

        if (this.consecutiveHealthFailures >= 2) {
          await this.handleZombieReconnection(`Estado retornado pelo WhatsApp: ${state}`);
        }
        return;
      }
    } catch (stateErr: any) {
      this.consecutiveHealthFailures++;
      const errMsg = stateErr?.message || String(stateErr || "");
      console.warn(
        `[Worker Watchdog] 🛑 Falha ao obter getState() para tenant ${this.tenantId}: ${errMsg} (Falha #${this.consecutiveHealthFailures})`
      );

      if (
        this.consecutiveHealthFailures >= 2 ||
        errMsg.includes("Execution context was destroyed") ||
        errMsg.includes("Target closed") ||
        errMsg.includes("Protocol error") ||
        errMsg.includes("detached Frame")
      ) {
        await this.handleZombieReconnection(`Falha no getState(): ${errMsg}`);
        return;
      }
    }

    // 3. Verificação do WebSocket Interno do WhatsApp Web no Navegador (Internal Socket Health)
    try {
      const pupPage = (this.client as any).pupPage;
      const internalSocketStatus = await pupPage.evaluate(() => {
        try {
          const win = window as any;
          const streamMode = win.Store?.Stream?.mode || null;
          const displayState = win.Store?.Stream?.displayState || null;
          const wsReadyState = win.Store?.Conn?.socket?.ws?.readyState ?? null;
          return { streamMode, displayState, wsReadyState, ok: true };
        } catch (e: any) {
          return { ok: false, error: e?.message };
        }
      });

      if (
        internalSocketStatus.ok &&
        internalSocketStatus.wsReadyState !== null &&
        internalSocketStatus.wsReadyState !== 1 // 1 = WebSocket.OPEN
      ) {
        console.warn(
          `[Worker Watchdog] 🚨 Estado Zumbi Detectado! WebSocket interno do WhatsApp está no estado ${internalSocketStatus.wsReadyState} (Esperado 1=OPEN) para tenant ${this.tenantId}.`
        );
        this.zombieDetectCount++;
        await this.handleZombieReconnection(
          `WebSocket interno fechado (readyState=${internalSocketStatus.wsReadyState})`
        );
        return;
      }
    } catch (wsErr: any) {
      console.warn(
        `[Worker Watchdog] Aviso ao inspecionar WebSocket interno para tenant ${this.tenantId}: ${wsErr?.message}`
      );
    }

    // 4. ETAPA 3 — Active Heartbeat Probe para evitar Falsos Positivos de Silêncio
    const now = Date.now();
    const lastActivity = Math.max(this.lastMessageReceivedAt, this.lastEventAt, this.lastReadyAt);
    const silenceDuration = now - lastActivity;

    if (silenceDuration > this.SILENCE_PROBE_THRESHOLD_MS) {
      const silenceMin = Math.round(silenceDuration / 60000);
      console.log(
        `[Worker Watchdog] 🔍 Inatividade de ${silenceMin}m detectada para tenant ${this.tenantId}. Disparando sonda ativa de ping no WhatsApp Web...`
      );

      try {
        const pupPage = (this.client as any).pupPage;
        const probePromise = pupPage.evaluate(() => {
          return new Promise<boolean>((resolve) => {
            try {
              const win = window as any;
              if (win.WWebJS && typeof win.WWebJS.getState === "function") {
                const st = win.WWebJS.getState();
                resolve(st === "CONNECTED");
              } else {
                resolve(true);
              }
            } catch (_) {
              resolve(false);
            }
          });
        });

        const timeoutProbe = new Promise<boolean>((res) => setTimeout(() => res(false), 5000));
        const probeResult = await Promise.race([probePromise, timeoutProbe]);

        if (probeResult) {
          this.lastEventAt = now; // Atualiza marcação de atividade confirmada pela sonda
          console.log(
            `[Worker Watchdog] ✅ Sonda ativa respondeu com SUCESSO. Conexão está 100% VIVA para tenant ${this.tenantId} (Silêncio de mensagens é natural).`
          );
        } else {
          console.warn(
            `[Worker Watchdog] 🚨 Sonda ativa FALHOU para tenant ${this.tenantId}! WhatsApp não respondeu ao ping interno. Estado Zumbi confirmado.`
          );
          this.zombieDetectCount++;
          await this.handleZombieReconnection(
            `Sonda ativa falhou após ${silenceMin}m de silêncio`
          );
        }
      } catch (probeErr: any) {
        console.warn(
          `[Worker Watchdog] Erro ao disparar sonda ativa para tenant ${this.tenantId}: ${probeErr?.message}`
        );
        await this.handleZombieReconnection(`Erro na sonda ativa: ${probeErr?.message}`);
      }
    } else {
      this.consecutiveHealthFailures = 0;
    }
  }

  /**
   * ETAPA 12 — Auto Recovery Isolado
   * Trata travamentos e estados zumbis reiniciando o robô de forma limpa, preservando a sessão em disco.
   */
  private async handleZombieReconnection(reason: string): Promise<void> {
    if (this.state === "RECOVERING" || this.state === "STARTING") return;
    this.state = "RECOVERING";
    this.consecutiveHealthFailures = 0;
    this.autoRestartCount++;
    this.lastRestartAt = Date.now();

    console.warn(
      `[Worker AutoRecovery] 🔄 Reiniciando worker travado/zumbi para tenant ${this.tenantId} (Motivo: ${reason})...`
    );

    await recordSystemLog(this.supabase, {
      tenant_id: this.tenantId,
      level: "WARN",
      event_type: "ZOMBIE_RECONNECT",
      message: `Conexão WhatsApp inativa/zumbi detectada pelo Watchdog (${reason}). Reiniciando robô automaticamente...`,
      details: { reason, autoRestartCount: this.autoRestartCount },
    });

    try {
      await this.stop();
      await new Promise((res) => setTimeout(res, 2500));
      cleanSessionLockFiles(this.tenantId);
      this.client = this.createClient();
      await this.start();
    } catch (err: any) {
      console.error(
        `[Worker AutoRecovery] Erro ao reiniciar worker pós-zumbi para tenant ${this.tenantId}:`,
        err?.message
      );
      console.log(
        `[Worker AutoRecovery] Agendando nova tentativa de inicialização para tenant ${this.tenantId} em 20s...`
      );
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(async () => {
        try {
          cleanSessionLockFiles(this.tenantId);
          this.client = this.createClient();
          await this.start();
        } catch (retryErr: any) {
          console.error(
            `[Worker AutoRecovery] Falha na tentativa secundária para tenant ${this.tenantId}:`,
            retryErr?.message
          );
        }
      }, 20000);
    }
  }

  /**
   * Inicializa o worker do WhatsApp.
   */
  public async start(): Promise<void> {
    if (this.state === "STARTING" || this.state === "RUNNING") {
      console.log(
        `[Worker] Worker já está rodando ou em processo de inicialização para tenant ${this.tenantId}. Ignorando chamada.`
      );
      return;
    }
    this.state = "STARTING";
    this.sessionStartTimestamp = Date.now();
    this.lastMessageReceivedAt = Date.now();
    this.lastEventAt = Date.now();

    cleanSessionLockFiles(this.tenantId);

    try {
      console.log(`[Worker] Inicializando cliente WhatsApp para tenant ${this.tenantId}...`);
      await this.client.initialize();
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
    this.consecutiveHealthFailures = 0;
    this.stopWatchdog();
    this.stopPreventiveReloadSchedule();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.authTimeoutTimer) {
      clearTimeout(this.authTimeoutTimer);
      this.authTimeoutTimer = null;
    }

    if (this.client) {
      await safelyCloseAndKillBrowser(this.client);
    }
    this.state = "STOPPED";
  }

  /**
   * ETAPA 13 — Métricas de Observabilidade
   * Retorna relatórios detalhados do estado de saúde e telemetria do worker.
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
      chromiumUptimeSeconds: this.chromiumStartTimestamp
        ? Math.floor((now - this.chromiumStartTimestamp) / 1000)
        : 0,
      lastMessageReceivedAt: this.lastMessageReceivedAt
        ? new Date(this.lastMessageReceivedAt).toISOString()
        : null,
      lastEventAt: this.lastEventAt ? new Date(this.lastEventAt).toISOString() : null,
      lastLoadingScreenAt: this.lastLoadingScreenAt
        ? new Date(this.lastLoadingScreenAt).toISOString()
        : null,
      lastStateChangeAt: this.lastStateChangeAt
        ? new Date(this.lastStateChangeAt).toISOString()
        : null,
      lastAuthenticatedAt: this.lastAuthenticatedAt
        ? new Date(this.lastAuthenticatedAt).toISOString()
        : null,
      lastReadyAt: this.lastReadyAt ? new Date(this.lastReadyAt).toISOString() : null,
      lastDisconnectedAt: this.lastDisconnectedAt
        ? new Date(this.lastDisconnectedAt).toISOString()
        : null,
      lastAuthFailureAt: this.lastAuthFailureAt
        ? new Date(this.lastAuthFailureAt).toISOString()
        : null,
      lastReconnectAt: this.lastReconnectAt
        ? new Date(this.lastReconnectAt).toISOString()
        : null,
      lastRestartAt: this.lastRestartAt
        ? new Date(this.lastRestartAt).toISOString()
        : null,
      lastPreventiveReloadAt: this.lastPreventiveReloadAt
        ? new Date(this.lastPreventiveReloadAt).toISOString()
        : null,
      reconnectAttempts: this.reconnectAttempts,
      reconnectAttemptsTotal: this.reconnectAttemptsTotal,
      zombieDetectCount: this.zombieDetectCount,
      autoRestartCount: this.autoRestartCount,
      preventiveReloadCount: this.preventiveReloadCount,
      chromiumCrashCount: this.chromiumCrashCount,
      memoryUsageMb: {
        rss: Math.round(mem.rss / (1024 * 1024)),
        heapTotal: Math.round(mem.heapTotal / (1024 * 1024)),
        heapUsed: Math.round(mem.heapUsed / (1024 * 1024)),
      },
    };
  }
}
