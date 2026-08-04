import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  WASocket,
} from "@whiskeysockets/baileys";
import pino from "pino";
import EventEmitter from "events";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  WhatsAppProvider,
  WhatsAppProviderEvents,
  IncomingMessagePayload,
} from "./whatsapp-provider";
import { WorkerLogger, LoggerFactory } from "./logger";

export function getBaileysAuthDataPath(): string {
  return (
    process.env.BAILEYS_AUTH_PATH ||
    process.env.WWEBJS_AUTH_PATH ||
    path.resolve(process.cwd(), ".baileys_auth")
  );
}

export function purgeBaileysSessionDir(tenantId: string, logger?: WorkerLogger): void {
  try {
    const authDataPath = getBaileysAuthDataPath();
    const sessionDir = path.join(authDataPath, `session-tenant_${tenantId}`);

    if (fs.existsSync(sessionDir)) {
      if (logger) {
        logger.warn(`[BaileysProvider] Expurgando diretório de sessão desautorizada (loggedOut): ${sessionDir}`);
      }
      fs.rmSync(sessionDir, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 300,
      });
    }
  } catch (err: any) {
    if (logger) {
      logger.error(`[BaileysProvider] Erro ao expurgar pasta de sessão do tenant ${tenantId}:`, err);
    }
  }
}

function createInMemoryCacheStore(maxSize: number = 1000) {
  const store = new Map<string, any>();
  return {
    get: <T>(key: string): T | undefined => store.get(key),
    set: <T>(key: string, value: T): void => {
      if (store.size >= maxSize && !store.has(key)) {
        store.clear();
      }
      store.set(key, value);
    },
    del: (key: string): void => {
      store.delete(key);
    },
    flushAll: (): void => store.clear(),
  };
}

export class BaileysProvider implements WhatsAppProvider {
  private socket: WASocket | null = null;
  private emitter = new EventEmitter();
  private connectionState: "STOPPED" | "CONNECTING" | "CONNECTED" | "DISCONNECTED" = "STOPPED";
  private isExplicitStop = false;
  private sessionDir: string;
  private msgRetryCounterCache = createInMemoryCacheStore();

  private messageStore = createInMemoryCacheStore(5000);

  private socketId: string | null = null;
  private logger: WorkerLogger;

  constructor(private tenantId: string, logger?: WorkerLogger) {
    const authDataPath = getBaileysAuthDataPath();
    this.sessionDir = path.join(authDataPath, `session-tenant_${tenantId}`);
    this.logger = logger || LoggerFactory.forTenant(tenantId);
  }

  public setLogger(logger: WorkerLogger): void {
    this.logger = logger;
  }

  public getSocketId(): string | null {
    return this.socketId;
  }

  private disconnectSocket(): void {
    if (this.socket) {
      const sockToClose = this.socket;
      this.socket = null;
      try {
        sockToClose.ev.removeAllListeners("creds.update");
        sockToClose.ev.removeAllListeners("connection.update");
        sockToClose.ev.removeAllListeners("messages.upsert");
        sockToClose.end(undefined);

        // Força encerramento imediato do WebSocket para evitar acúmulo/conflito de sockets ativos
        const ws = (sockToClose as any).ws;
        if (ws) {
          try {
            if (typeof ws.terminate === "function") {
              ws.terminate();
            } else if (typeof ws.close === "function") {
              ws.close();
            }
          } catch (_) {}
        }
      } catch (_) {}
    }
  }

  public async sendPing(): Promise<boolean> {
    if (!this.socket || this.connectionState !== "CONNECTED") return false;
    try {
      await this.socket.sendPresenceUpdate("available");
      return true;
    } catch (_) {
      return false;
    }
  }

  public async start(operationId?: string): Promise<void> {
    if (this.connectionState === "CONNECTING" || this.connectionState === "CONNECTED" || this.socket !== null) {
      this.logger.socket(
        "CONCURRENT_SOCKET_DETECTED",
        `Detecção de socket existente em estado ${this.connectionState} ao iniciar. Destruindo socket antigo...`,
        { existingSocketId: this.socketId, operationId }
      );
      this.disconnectSocket();
    }

    this.isExplicitStop = false;
    this.connectionState = "CONNECTING";
    this.socketId = crypto.randomUUID();
    this.logger = this.logger.child({ socketId: this.socketId, operationId });

    this.logger.socket("SOCKET_CREATED", `Novo socket Baileys instanciado para tenant ${this.tenantId}`);

    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
    }

    const tLoadStart = Date.now();
    let state: any;
    let saveCreds: any;

    try {
      const authResult = await useMultiFileAuthState(this.sessionDir);
      state = authResult.state;
      saveCreds = authResult.saveCreds;
      this.logger.auth("AUTH_LOAD", Date.now() - tLoadStart, true);
    } catch (authErr: any) {
      this.logger.auth("AUTH_LOAD", Date.now() - tLoadStart, false, { error: authErr.message });
      throw authErr;
    }

    const baileysInternalLogger = pino({ level: "silent" });

    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, baileysInternalLogger as any),
      },
      logger: baileysInternalLogger as any,
      printQRInTerminal: false,
      browser: ["Velox SaaS Worker", "Chrome", "120.0.0.0"],
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
      shouldSyncHistoryMessage: () => true, // Permite ler mensagens recentes enviadas durante breves desconexões
      markOnlineOnConnect: true,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      retryRequestDelayMs: 500,
      msgRetryCounterCache: this.msgRetryCounterCache as any,
      getMessage: async (key) => {
        if (!key.id) return undefined;
        const storeKey = `${key.remoteJid || ""}:${key.id}`;
        const stored = this.messageStore.get<any>(storeKey);
        return stored ? stored.message : undefined;
      },
    });

    this.socket = sock;

    // Wrappers de log para salvamento de credenciais
    sock.ev.on("creds.update", async () => {
      const tSaveStart = Date.now();
      try {
        await saveCreds();
        this.logger.auth("AUTH_SAVE", Date.now() - tSaveStart, true);
        this.logger.auth("CREDS_UPDATED", undefined, true);
      } catch (saveErr: any) {
        this.logger.auth("AUTH_SAVE", Date.now() - tSaveStart, false, { error: saveErr.message });
      }
    });

    // Eventos do ciclo de vida da conexão
    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.emitter.emit("qr", qr);
      }

      if (connection === "connecting") {
        this.connectionState = "CONNECTING";
      } else if (connection === "open") {
        this.connectionState = "CONNECTED";
        this.logger.socket("SOCKET_CONNECTED", `Socket Baileys CONECTADO com sucesso para tenant ${this.tenantId}`);
        this.emitter.emit("ready");
      } else if (connection === "close") {
        this.connectionState = "DISCONNECTED";
        const boomError = lastDisconnect?.error as any;
        const statusCode: number | undefined =
          boomError?.output?.statusCode ?? boomError?.statusCode ?? undefined;
        const reason = lastDisconnect?.error?.message || `Disconnect statusCode: ${statusCode}`;

        // Confirmação estrita de logout (somente loggedOut/401/multideviceMismatch)
        // badSession (500) NÃO é tratado como logout imediato para permitir tentativa de recuperação
        const isLoggedOut =
          statusCode === DisconnectReason.loggedOut ||
          statusCode === 401 ||
          statusCode === DisconnectReason.multideviceMismatch;

        const disconnectReasonMap: Record<number, string> = {
          [DisconnectReason.loggedOut]: "loggedOut",
          [DisconnectReason.timedOut]: "timedOut",
          [DisconnectReason.multideviceMismatch]: "multideviceMismatch",
          [DisconnectReason.connectionClosed]: "connectionClosed",
          [DisconnectReason.connectionReplaced]: "connectionReplaced",
          [DisconnectReason.badSession]: "badSession",
          [DisconnectReason.restartRequired]: "restartRequired",
          403: "forbidden",
        };
        const reasonLabel = statusCode ? disconnectReasonMap[statusCode] || "unknown" : "undefined";

        this.logger.socket("SOCKET_DISCONNECTED", `Socket fechado para tenant ${this.tenantId}`, {
          statusCode,
          reasonLabel,
          isLoggedOut,
          reason,
        });

        this.emitter.emit("disconnected", reason, isLoggedOut, statusCode);
      }
    });

    // Escuta de mensagens em tempo real
    sock.ev.on("messages.upsert", async (upsert) => {
      if (upsert.type !== "notify" && upsert.type !== "append") return;

      for (const msg of upsert.messages) {
        if (!msg.message) continue;

        const sender = msg.key.remoteJid || "";

        if (
          sender.endsWith("@g.us") ||
          sender.endsWith("@broadcast") ||
          sender.endsWith("@newsletter")
        ) {
          continue;
        }

        // Armazena a mensagem na store para permitir retentativas de descriptografia (getMessage)
        if (msg.key.id) {
          const storeKey = `${sender}:${msg.key.id}`;
          this.messageStore.set(storeKey, { key: msg.key, message: msg.message });
        }

        // Ignorar mensagens enviadas pelo próprio bot no que tange a escuta de convites
        if (msg.key.fromMe) continue;

        // Envia imediatamente a confirmação de leitura (Read Receipt) para o WhatsApp
        if (msg.key.id) {
          sock.readMessages([msg.key]).catch(() => {});
        }

        let innerMessage = msg.message;
        if (innerMessage.ephemeralMessage) {
          innerMessage = innerMessage.ephemeralMessage.message!;
        } else if (innerMessage.viewOnceMessage) {
          innerMessage = innerMessage.viewOnceMessage.message!;
        } else if (innerMessage.viewOnceMessageV2) {
          innerMessage = innerMessage.viewOnceMessageV2.message!;
        } else if (innerMessage.documentWithCaptionMessage) {
          innerMessage = innerMessage.documentWithCaptionMessage.message!;
        } else if (innerMessage.protocolMessage?.editedMessage) {
          innerMessage = innerMessage.protocolMessage.editedMessage;
        }

        const body =
          innerMessage.conversation ||
          innerMessage.extendedTextMessage?.text ||
          innerMessage.imageMessage?.caption ||
          innerMessage.videoMessage?.caption ||
          innerMessage.buttonsResponseMessage?.selectedButtonId ||
          innerMessage.listResponseMessage?.singleSelectReply?.selectedRowId ||
          innerMessage.templateButtonReplyMessage?.selectedId ||
          "";

        if (!body) continue;

        const msgId = msg.key.id || `${sender}_${msg.messageTimestamp}`;
        const timestamp =
          typeof msg.messageTimestamp === "number"
            ? msg.messageTimestamp * 1000
            : Number(msg.messageTimestamp || Date.now());

        const payload: IncomingMessagePayload = {
          id: msgId,
          from: sender,
          body,
          timestamp,
        };

        this.emitter.emit("message", payload);
      }
    });
  }

  public async stop(): Promise<void> {
    this.isExplicitStop = true;
    this.connectionState = "STOPPED";
    this.disconnectSocket();
  }

  public async reconnect(operationId?: string): Promise<void> {
    this.disconnectSocket();
    this.isExplicitStop = false;
    this.connectionState = "DISCONNECTED";
    // Aguarda encerramento completo do socket antigo no nível do SO/TCP
    await new Promise((res) => setTimeout(res, 3500));
    await this.start(operationId);
  }

  public isConnected(): boolean {
    return this.connectionState === "CONNECTED" && this.socket !== null;
  }

  public getConnectionState(): string {
    return this.connectionState;
  }

  public isSocketOpen(): boolean {
    if (!this.socket) return false;
    const ws = (this.socket as any).ws;
    return ws && ws.isOpen === true;
  }

  public async requestPairingCode(phoneNumber: string): Promise<string> {
    if (!this.socket) {
      throw new Error("Socket Baileys não está inicializado para gerar o Código de Pareamento.");
    }
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    this.logger.info(`Solicitando Pairing Code Baileys para número ${cleanPhone}...`);
    const code = await this.socket.requestPairingCode(cleanPhone);
    this.logger.info(`Pairing Code obtido: ${code}`);
    return code;
  }

  public on<K extends keyof WhatsAppProviderEvents>(
    event: K,
    listener: WhatsAppProviderEvents[K]
  ): void {
    this.emitter.on(event, listener as any);
  }

  public off<K extends keyof WhatsAppProviderEvents>(
    event: K,
    listener: WhatsAppProviderEvents[K]
  ): void {
    this.emitter.off(event, listener as any);
  }
}
