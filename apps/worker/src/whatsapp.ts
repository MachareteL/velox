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

function isUbuntuSnapStub(filePath: string): boolean {
  try {
    const realPath = fs.realpathSync(filePath);
    if (realPath.includes("/snap/")) return true;

    const stat = fs.statSync(filePath);
    if (stat.isFile() && stat.size < 4096) {
      const content = fs.readFileSync(filePath, "utf8");
      if (content.includes("snap install") || content.includes("chromium snap")) {
        return true;
      }
    }
  } catch {}
  return false;
}

function getSystemChromePath(): string | null {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
    if (fs.existsSync(envPath) && !isUbuntuSnapStub(envPath)) {
      return envPath;
    } else {
      console.warn(
        `[Worker] PUPPETEER_EXECUTABLE_PATH em .env ("${envPath}") não existe ou é um atalho do Snap. Buscando navegador nativo...`,
      );
    }
  }

  if (process.platform === "win32") {
    const paths = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      (process.env.LOCALAPPDATA || "") +
        "\\Google\\Chrome\\Application\\chrome.exe",
    ];
    for (const p of paths) {
      if (p && fs.existsSync(p)) return p;
    }
  } else {
    const paths = [
      "/usr/bin/chromium",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/google-chrome",
      "/usr/bin/chromium-browser",
    ];
    for (const p of paths) {
      if (p && fs.existsSync(p)) {
        if (!isUbuntuSnapStub(p)) {
          return p;
        } else {
          console.warn(
            `[Worker] Ignorando executável em "${p}" pois aponta para o gerador de atalhos do Snap. O Snap é bloqueado pelo PM2 systemd service.`,
          );
        }
      }
    }
  }
  return null;
}

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
    console.warn(
      `[Worker] Aviso ao encerrar processo do navegador: ${err?.message}`,
    );
  }
}

function purgeSessionDir(tenantId: string): void {
  try {
    const authDataPath =
      process.env.WWEBJS_AUTH_PATH ||
      path.resolve(process.cwd(), ".wwebjs_auth");
    const sessionDir = path.join(authDataPath, `session-tenant_${tenantId}`);

    if (fs.existsSync(sessionDir)) {
      console.log(
        `[Worker] Expurgando diretório de sessão desautorizada/desconectada: ${sessionDir}`,
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

function cleanSessionLockFiles(tenantId: string): void {
  try {
    const authDataPath =
      process.env.WWEBJS_AUTH_PATH ||
      path.resolve(process.cwd(), ".wwebjs_auth");
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
    console.warn(
      `[Worker] Erro ao limpar travamentos de arquivo de sessão: ${err?.message}`,
    );
  }
}

function extractChaveConvite(urlStr: string): string | null {
  try {
    const urlObj = new URL(urlStr);
    return urlObj.searchParams.get("ChaveConvite");
  } catch {
    const match = urlStr.match(/ChaveConvite=([a-f0-9\-]+)/i);
    return match ? match[1] : null;
  }
}

export class WhatsAppWorker {
  private client!: Client;
  private scraper: VeloxScraper;
  private inviteRegex: RegExp;
  private isActive: boolean = true;
  private running: boolean = false;
  private starting: boolean = false;
  private isConnected: boolean = false;

  // Controle Anti-Spam de QR Code e Recursos da VM
  private qrCount: number = 0;
  private maxQrAttempts: number = 8;
  private sessionStartTimestamp: number = 0;

  // Controle Anti-Ban / Anti-Spam de Reconexão
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectCooldownWindowMs: number = 10 * 60 * 1000;
  private lastReconnectTime: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private authTimeoutTimer: NodeJS.Timeout | null = null;

  // Heartbeat / Health Check anti-travamento (Zombie state)
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private consecutiveHealthFailures: number = 0;

  // Activity Heartbeat: detecta quando o WhatsApp para de receber mensagens (snooze/morte silenciosa do WebSocket)
  private lastMessageReceivedAt: number = 0;
  private readonly MAX_SILENCE_MS: number = 30 * 60 * 1000; // 30 minutos sem nenhuma mensagem = provável snooze

  constructor(
    private tenantId: string,
    private sessionId: string,
    private supabase: SupabaseClient,
    targetRegexPattern?: string,
    private phoneNumber?: string | null,
  ) {
    const defaultPattern =
      "https:\\/\\/prestador\\.veloxcontactcenter\\.com\\.br\\/prestador\\/ConvitePrestador\\/VisualizarConvite\\?ChaveConvite=[a-f0-9\\-]+";
    this.inviteRegex = new RegExp(
      targetRegexPattern || process.env.TARGET_REGEX || defaultPattern,
      "i",
    );
    this.scraper = new VeloxScraper(
      parseInt(process.env.HTTP_TIMEOUT || "5000", 10),
    );

    this.client = this.createClient();
  }

  private createClient(): Client {
    const puppeteerConfig: any = {
      headless: true,
      protocolTimeout: 360000, // 6 minutos — margem de segurança para ARM64 com 3+ tenants carregando conversas simultaneamente
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
        "--disable-features=TranslateUI,BlinkGenPropertyTrees",
      ],
      env: {
        ...process.env,
        SYSTEMD_IGNORE_CHROOT: "1",
        DBUS_SESSION_BUS_ADDRESS: "/dev/null",
      },
    };

    const systemChromePath = getSystemChromePath();
    if (systemChromePath) {
      console.log(
        `[Worker] Utilizando navegador Chrome instalado em: ${systemChromePath}`,
      );
      puppeteerConfig.executablePath = systemChromePath;
    }

    const authDataPath =
      process.env.WWEBJS_AUTH_PATH ||
      path.resolve(process.cwd(), ".wwebjs_auth");

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
        `[Worker] Estado da automação alterado para tenant ${this.tenantId}: ${active ? "LIGADO" : "PAUSADO"}`,
      );
    }
  }

  public async restartForFreshAuth(phoneNumber?: string | null): Promise<void> {
    console.log(
      `[Worker] Forçando reinicialização limpa de autenticação para tenant ${this.tenantId}...`,
    );
    this.phoneNumber =
      phoneNumber !== undefined ? phoneNumber : this.phoneNumber;
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
    return this.running;
  }

  private async executePairingCodeWithRetry(
    phoneNumber: string,
  ): Promise<string> {
    const digits = phoneNumber.replace(/\D/g, "");

    // Garante que números do Brasil sempre comecem com DDI 55
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
        const withoutNine =
          "55" + fullPhoneWithDdi.slice(2, 4) + fullPhoneWithDdi.slice(5);
        if (!formatsToTry.includes(withoutNine)) formatsToTry.push(withoutNine);
      } else if (fullPhoneWithDdi.length === 12) {
        formatsToTry.push(fullPhoneWithDdi);
        const withNine =
          "55" + fullPhoneWithDdi.slice(2, 4) + "9" + fullPhoneWithDdi.slice(4);
        if (!formatsToTry.includes(withNine)) formatsToTry.push(withNine);
      } else {
        formatsToTry.push(fullPhoneWithDdi);
      }
    } else {
      formatsToTry.push(fullPhoneWithDdi);
    }

    console.log(
      `[Worker Pairing] Formatos de telefone com DDI internacional a testar:`,
      formatsToTry,
    );

    const pupPage = (this.client as any).pupPage;

    for (let index = 0; index < formatsToTry.length; index++) {
      const phoneCandidate = formatsToTry[index];

      if (index > 0 && pupPage) {
        try {
          console.log(
            `[Worker Pairing] Recarregando página Chromium para redefinir estado de pareamento...`,
          );
          await pupPage.evaluate(() => location.reload());
          await new Promise((resolve) => setTimeout(resolve, 4000));
        } catch (reloadErr: any) {
          console.warn(
            `[Worker Pairing] Erro ao recarregar página: ${reloadErr?.message}`,
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
            { timeout: 8000 },
          );
        } catch (_) {
          console.warn(
            "[Worker Pairing] AuthStore.PairingCodeLinkUtils não respondeu em 8s. Tentando avançar...",
          );
        }
      }

      try {
        console.log(
          `[Worker Pairing] Solicitando Código de Pareamento (formato DDI: ${phoneCandidate})...`,
        );
        const code = await (this.client as any).requestPairingCode(
          phoneCandidate,
        );
        if (code && typeof code === "string" && code.length >= 6) {
          console.log(
            `[Worker Pairing] ✨ Código de Pareamento VÁLIDO gerado com sucesso (${phoneCandidate}): ${code}`,
          );
          return code;
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err || "t");
        console.warn(
          `[Worker Pairing] Erro com formato ${phoneCandidate}: (${errMsg})`,
        );
      }
    }

    throw new Error(
      "Não foi possível gerar o código por telefone no momento. Tente novamente em instantes.",
    );
  }

  public async requestPairingCodeOnDemand(
    phoneNumber: string,
  ): Promise<string | null> {
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    this.phoneNumber = cleanPhone;
    this.qrCount = 0;

    if (!this.running) {
      console.log(
        `[Worker] Robô estava pausado/parado. Reiniciando cliente para tenant ${this.tenantId}...`,
      );
      await this.start();
      return null;
    }

    try {
      console.log(
        `[Worker] Solicitando Código de Pareamento sob demanda para número ${cleanPhone}...`,
      );
      const pairingCode = await this.executePairingCodeWithRetry(cleanPhone);
      console.log(
        `[Worker] Código de Pareamento gerado sob demanda: ${pairingCode}`,
      );

      await updateSessionStatus(
        this.supabase,
        this.sessionId,
        "DISCONNECTED_NEED_QR",
        null,
        "vps-worker-01",
        pairingCode,
        cleanPhone,
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
      const errMsg = pairErr?.message || String(pairErr || "t");
      console.error(
        "[Worker] Aviso ao solicitar Código de Pareamento sob demanda:",
        errMsg,
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

  private setupListenersForClient(client: Client): void {
    // Evento de geração de autenticação (QR Code ou Pairing Code)
    client.on("qr", async (qrText: string) => {
      // Se a sessão já está autenticada, ignora qualquer evento residual de QR code
      if (client.info && client.info.wid) return;

      // Proteção contra falsos disparos de QR durante restauração de sessão em disco:
      const authDataPath =
        process.env.WWEBJS_AUTH_PATH ||
        path.resolve(process.cwd(), ".wwebjs_auth");
      const sessionDir = path.join(
        authDataPath,
        `session-tenant_${this.tenantId}`,
      );
      const hasDiskSession = fs.existsSync(sessionDir);
      const elapsedSinceStart = Date.now() - this.sessionStartTimestamp;

      if (hasDiskSession && elapsedSinceStart < 15000 && this.qrCount === 0) {
        console.log(
          `[Worker] QR Code detectado durante restauração de sessão para tenant ${this.tenantId}. Aguardando autenticação local...`,
        );
        this.qrCount++;
        return;
      }

      this.qrCount++;

      if (this.qrCount > this.maxQrAttempts) {
        if (this.qrCount === this.maxQrAttempts + 1) {
          console.warn(
            `[Worker Anti-Spam] Limite de ${this.maxQrAttempts} renovações de QR Code atingido para tenant ${this.tenantId}. Encerrando navegador inativo...`,
          );
          await updateSessionStatus(
            this.supabase,
            this.sessionId,
            "DISCONNECTED",
            null,
            "vps-worker-01",
            null,
            null,
          );
          await this.stop();
        }
        return;
      }

      console.log(
        `[Worker] Geração de autenticação #${this.qrCount}/${this.maxQrAttempts} recebida para tenant ${this.tenantId}`,
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
          null,
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

    // Evento disparado no exato instante em que o celular aprova o QR Code ou Pairing Code
    client.on("authenticated", async () => {
      console.log(
        `[Worker] ✨ Conexão aprovada pelo celular para tenant ${this.tenantId}! Inicializando automação...`,
      );

      await updateSessionStatus(
        this.supabase,
        this.sessionId,
        "AUTHENTICATING",
        null,
        "vps-worker-01",
        null,
        this.phoneNumber || null,
      );

      await recordSystemLog(this.supabase, {
        tenant_id: this.tenantId,
        level: "INFO",
        event_type: "SESSION_AUTHENTICATED",
        message:
          "Código/QR Code lido no celular com sucesso! Inicializando a automação...",
      });

      // Timer de segurança: Se 'ready' não disparar em 45 segundos após 'authenticated', reinicia o worker
      if (this.authTimeoutTimer) clearTimeout(this.authTimeoutTimer);
      this.authTimeoutTimer = setTimeout(async () => {
        if (!this.isConnected) {
          console.warn(
            `[Worker] Timeout de 45s aguardando evento ready pós-autenticação para tenant ${this.tenantId}. Efetuando reinicialização limpa...`,
          );
          await this.stop();
          await new Promise((res) => setTimeout(res, 1000));
          this.client = this.createClient();
          try {
            await this.start();
          } catch (err: any) {
            console.error(
              "[Worker] Erro ao reiniciar worker pós timeout de autenticação:",
              err?.message,
            );
          }
        }
      }, 45000);
    });

    // Monitoramento do percentual de carregamento do WhatsApp Web
    client.on("loading_screen", async (percent: number, message: string) => {
      console.log(
        `[Worker] Carregando conversas do WhatsApp para tenant ${this.tenantId}: ${percent}% (${message})`,
      );
    });

    // Evento de alteração de estado da conexão
    client.on("change_state", (state: string) => {
      console.log(
        `[Worker] Estado da conexão alterado no WhatsApp Web para tenant ${this.tenantId}: ${state}`,
      );
      if (
        state === "DISCONNECTED" ||
        state === "UNPAIRED" ||
        state === "TIMEOUT"
      ) {
        this.isConnected = false;
      }
    });

    // Evento de conexão pronta
    client.on("ready", async () => {
      console.log(
        `[Worker] WhatsApp Web conectado para tenant ${this.tenantId}`,
      );
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.consecutiveHealthFailures = 0;

      if (this.authTimeoutTimer) {
        clearTimeout(this.authTimeoutTimer);
        this.authTimeoutTimer = null;
      }

      this.startHealthCheck();

      await updateSessionStatus(
        this.supabase,
        this.sessionId,
        "CONNECTED",
        null,
        "vps-worker-01",
      );

      await recordSystemLog(this.supabase, {
        tenant_id: this.tenantId,
        level: "INFO",
        event_type: "SESSION_READY",
        message: "WhatsApp Web conectado e pronto para automação.",
      });
    });

    // Evento de falha de autenticação (credenciais revogadas pelo WhatsApp)
    client.on("auth_failure", async (msg: string) => {
      console.warn(
        `[Worker] Falha de autenticação (sessão revogada) para tenant ${this.tenantId}: ${msg}`,
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
        null,
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
          restartErr?.message,
        );
      }
    });

    // Evento de desconexão
    client.on("disconnected", async (reason: string) => {
      console.warn(
        `[Worker] WhatsApp desconectado (${reason}) para tenant ${this.tenantId}`,
      );
      this.isConnected = false;

      const now = Date.now();
      if (now - this.lastReconnectTime > this.reconnectCooldownWindowMs) {
        this.reconnectAttempts = 0;
      }
      this.lastReconnectTime = now;

      // Se ocorreu logout explícito no celular
      if (reason === "LOGOUT") {
        console.warn(
          `[Worker] Logout explícito no celular detectado para tenant ${this.tenantId}. Expurgando pasta corrompida e reiniciando robô em estado limpo...`,
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
          null,
        );

        await recordSystemLog(this.supabase, {
          tenant_id: this.tenantId,
          level: "WARN",
          event_type: "SESSION_LOGOUT",
          message:
            "Sessão desconectada via WhatsApp (Logout). Pasta de sessão expurgada com sucesso.",
        });

        try {
          this.client = this.createClient();
          await this.start();
        } catch (restartErr: any) {
          console.error(
            "[Worker] Erro ao reiniciar worker após logout:",
            restartErr?.message,
          );
        }
        return;
      }

      // Para quedas temporárias/restarts: mantém status DISCONNECTED sem invalidar a sessão salva no disco
      await updateSessionStatus(
        this.supabase,
        this.sessionId,
        "DISCONNECTED",
        null,
        "vps-worker-01",
      );

      this.reconnectAttempts++;
      const backoffDelayMs = Math.min(
        60000,
        Math.pow(2, this.reconnectAttempts) * 2000 +
          Math.floor(Math.random() * 1000),
      );
      console.log(
        `[Worker Reconnect] Agendando reconexão automática #${this.reconnectAttempts} em ${(backoffDelayMs / 1000).toFixed(1)}s...`,
      );

      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(async () => {
        try {
          console.log(
            `[Worker Reconnect] Reiniciando cliente limpo para reconexão do tenant ${this.tenantId}...`,
          );
          await this.stop();
          await new Promise((res) => setTimeout(res, 1000));
          this.client = this.createClient();
          await this.start();
        } catch (err: any) {
          console.error(
            "[Worker Reconnect] Erro ao reconectar sessão salva:",
            err.message,
          );
        }
      }, backoffDelayMs);
    });

    // Escuta de mensagens em tempo real com deduplicação e filtro silencioso de convites
    const processedMsgIds = new Set<string>();

    const processIncomingMessage = async (msg: any) => {
      if (!msg || !msg.body) return;

      // Atualiza timestamp de atividade para TODA mensagem (incluindo grupos, broadcasts, etc)
      // antes de qualquer filtro — isso alimenta o Activity Heartbeat anti-snooze
      this.lastMessageReceivedAt = Date.now();

      const sender = msg.from || "";
      if (
        sender.endsWith("@g.us") ||
        sender.endsWith("@broadcast") ||
        sender.endsWith("@newsletter")
      ) {
        return;
      }

      const msgId = msg.id?._serialized || `${sender}_${msg.timestamp}`;
      if (processedMsgIds.has(msgId)) return;
      processedMsgIds.add(msgId);

      if (processedMsgIds.size > 500) {
        const firstKey = Array.from(processedMsgIds)[0];
        processedMsgIds.delete(firstKey);
      }

      const match = msg.body.match(this.inviteRegex);
      if (match) {
        const targetUrl = match[0];
        console.log(
          `[Worker] 🎉 Convite Velox capturado no WhatsApp! [Tenant: ${this.tenantId}] Link: ${targetUrl}`,
        );

        if (!this.isActive) {
          console.log(
            `[Worker] Automação pausada pelo prestador. Ignorando convite: ${targetUrl}`,
          );
          await recordSystemLog(this.supabase, {
            tenant_id: this.tenantId,
            level: "WARN",
            event_type: "AUTOMATION_PAUSED",
            message:
              "Convite recebido mas ignorado pois a automação está pausada pelo prestador.",
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
              `[Worker] ⚠️ Chamado duplicado identificado (${chaveConvite ? `ChaveConvite: ${chaveConvite}` : targetUrl}). Nenhum veículo adicional será alocado, procedendo com a requisição de aceite.`,
            );

            await recordSystemLog(this.supabase, {
              tenant_id: this.tenantId,
              level: "WARN",
              event_type: "DUPLICATE_CALL_DETECTED",
              message: `Chamado duplicado identificado (${chaveConvite ? `ChaveConvite: ${chaveConvite}` : targetUrl}). Nenhum veículo adicional alocado.`,
              details: { url: targetUrl, chaveConvite },
            });
          } else {
            const { data: vehicles } = await this.supabase
              .from("vehicles")
              .select("*")
              .eq("tenant_id", this.tenantId)
              .eq("is_active", true);

            const fleetCapacity =
              vehicles && vehicles.length > 0 ? vehicles.length : 1;

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
                `[Worker] Capacidade máxima da frota atingida (${activeCalls.length}/${fleetCapacity} atendimentos ativos). Ignorando convite.`,
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
              activeCalls.map((c) => c.vehicle_id).filter(Boolean),
            );
            availableVehicle =
              (vehicles || []).find((v) => !assignedVehicleIds.has(v.id)) || null;
          }

          setImmediate(async () => {
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
              event_type: result.success
                ? "HTTP_POST_SUCCESS"
                : "HTTP_POST_ERROR",
              message: result.success
                ? `Convite aceito com sucesso em ${result.durationMs}ms${availableVehicle ? ` | Veículo: ${availableVehicle.title}` : isDuplicate ? " | Duplicado (sem novo veículo)" : ""}.`
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
          });
        } catch (err: any) {
          console.error(
            "[Worker] Erro ao verificar capacidade da frota:",
            err.message,
          );
        }
      }
    };

    client.on("message", processIncomingMessage);
    client.on("message_create", processIncomingMessage);
  }

  private startHealthCheck(): void {
    this.stopHealthCheck();
    // Executa a cada 90 segundos para detectar travamentos zumbis no Chromium
    this.healthCheckInterval = setInterval(async () => {
      await this.runHealthCheck();
    }, 90000);
  }

  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private async runHealthCheck(): Promise<void> {
    if (!this.running || !this.isConnected || !this.client) return;

    try {
      const statePromise = this.client.getState();
      const timeoutPromise = new Promise<string>((_, reject) =>
        setTimeout(
          () => reject(new Error("Health check timeout (15s)")),
          15000,
        ),
      );

      const state = await Promise.race([statePromise, timeoutPromise]);

      if (state === "CONNECTED") {
        this.consecutiveHealthFailures = 0;

        // ── Activity Heartbeat: detecta snooze silencioso do WebSocket ──
        // Se estamos "CONNECTED" mas nenhuma mensagem chegou nos últimos MAX_SILENCE_MS,
        // o WebSocket interno do WhatsApp Web provavelmente morreu silenciosamente.
        if (
          this.lastMessageReceivedAt > 0 &&
          Date.now() - this.lastMessageReceivedAt > this.MAX_SILENCE_MS
        ) {
          const silenceMin = Math.round(
            (Date.now() - this.lastMessageReceivedAt) / 60000,
          );
          console.warn(
            `[Worker HealthCheck] 😴 SNOOZE DETECTADO para tenant ${this.tenantId}: nenhuma mensagem recebida há ${silenceMin} minutos. Reiniciando proativamente...`,
          );
          await this.handleZombieReconnection(
            `Silêncio de ${silenceMin} min detectado pelo Activity Heartbeat`,
          );
        }
        return;
      }

      this.consecutiveHealthFailures++;
      console.warn(
        `[Worker HealthCheck] ⚠️ Estado do WhatsApp (${state}) diferente de CONNECTED para tenant ${this.tenantId} (Falha #${this.consecutiveHealthFailures}).`,
      );

      if (this.consecutiveHealthFailures >= 2) {
        await this.handleZombieReconnection(
          `Estado incorreto retornado: ${state}`,
        );
      }
    } catch (err: any) {
      this.consecutiveHealthFailures++;
      const errMsg = err?.message || String(err || "");
      console.warn(
        `[Worker HealthCheck] 🛑 Falha no Health Check do WhatsApp para tenant ${this.tenantId}: ${errMsg} (Falha #${this.consecutiveHealthFailures})`,
      );

      if (
        this.consecutiveHealthFailures >= 2 ||
        errMsg.includes("Execution context was destroyed") ||
        errMsg.includes("Target closed") ||
        errMsg.includes("Protocol error") ||
        errMsg.includes("detached Frame")
      ) {
        await this.handleZombieReconnection(`Health Check falhou: ${errMsg}`);
      }
    }
  }

  private async handleZombieReconnection(reason: string): Promise<void> {
    if (this.starting) return;
    this.consecutiveHealthFailures = 0;
    console.warn(
      `[Worker] 🔄 Reiniciando worker travado/zumbi para tenant ${this.tenantId} (Motivo: ${reason})...`,
    );

    await recordSystemLog(this.supabase, {
      tenant_id: this.tenantId,
      level: "WARN",
      event_type: "ZOMBIE_RECONNECT",
      message: `Conexão WhatsApp inativa/zumbi detectada pelo Health Check (${reason}). Reiniciando robô automaticamente...`,
      details: { reason },
    });

    try {
      await this.stop();
      await new Promise((res) => setTimeout(res, 2500));
      cleanSessionLockFiles(this.tenantId);
      this.client = this.createClient();
      await this.start();
    } catch (err: any) {
      console.error(
        `[Worker] Erro ao reiniciar worker pós-zumbi para tenant ${this.tenantId}:`,
        err?.message,
      );
      console.log(
        `[Worker] Agendando nova tentativa de inicialização para tenant ${this.tenantId} em 20s...`,
      );
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(async () => {
        try {
          cleanSessionLockFiles(this.tenantId);
          this.client = this.createClient();
          await this.start();
        } catch (retryErr: any) {
          console.error(
            `[Worker] Falha na tentativa secundária de inicialização para tenant ${this.tenantId}:`,
            retryErr?.message,
          );
        }
      }, 20000);
    }
  }

  public async start(): Promise<void> {
    if (this.starting || this.running) {
      console.log(
        `[Worker] Worker já está rodando ou em processo de inicialização para tenant ${this.tenantId}. Ignorando nova chamada.`,
      );
      return;
    }
    this.starting = true;
    this.sessionStartTimestamp = Date.now();
    this.lastMessageReceivedAt = Date.now(); // Inicializa para evitar falso-positivo de snooze no boot

    // Limpar arquivos de trava antes de inicializar para evitar falhas de abertura do Chromium
    cleanSessionLockFiles(this.tenantId);

    try {
      console.log(
        `[Worker] Inicializando cliente WhatsApp para tenant ${this.tenantId}...`,
      );
      this.running = true;
      await this.client.initialize();
    } catch (err: any) {
      this.running = false;
      throw err;
    } finally {
      this.starting = false;
    }
  }

  public async stop(): Promise<void> {
    this.running = false;
    this.starting = false;
    this.isConnected = false;
    this.consecutiveHealthFailures = 0;
    this.stopHealthCheck();

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
  }
}
