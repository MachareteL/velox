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
import {
  WhatsAppProvider,
  WhatsAppProviderEvents,
  IncomingMessagePayload,
} from "./whatsapp-provider";

export function getBaileysAuthDataPath(): string {
  return (
    process.env.BAILEYS_AUTH_PATH ||
    process.env.WWEBJS_AUTH_PATH ||
    path.resolve(process.cwd(), ".baileys_auth")
  );
}

export function purgeBaileysSessionDir(tenantId: string): void {
  try {
    const authDataPath = getBaileysAuthDataPath();
    const sessionDir = path.join(authDataPath, `session-tenant_${tenantId}`);

    if (fs.existsSync(sessionDir)) {
      console.log(
        `[BaileysProvider] Expurgando diretório de sessão desautorizada/desconectada: ${sessionDir}`
      );
      fs.rmSync(sessionDir, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 300,
      });
    }
  } catch (err: any) {
    console.warn(
      `[BaileysProvider] Erro ao expurgar pasta de sessão do tenant ${tenantId}: ${err?.message}`
    );
  }
}

function createInMemoryCacheStore() {
  const store = new Map<string, any>();
  return {
    get: <T>(key: string): T | undefined => store.get(key),
    set: <T>(key: string, value: T): void => {
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

  private disconnectSocket(): void {
    if (this.socket) {
      try {
        this.socket.ev.removeAllListeners('creds.update');
        this.socket.ev.removeAllListeners('connection.update');
        this.socket.ev.removeAllListeners('messages.upsert');
        this.socket.end(undefined);
      } catch (_) {}
      this.socket = null;
    }
  }

  constructor(private tenantId: string) {
    const authDataPath = getBaileysAuthDataPath();
    this.sessionDir = path.join(authDataPath, `session-tenant_${tenantId}`);
  }

  public async start(): Promise<void> {
    if (this.connectionState === "CONNECTING" || this.connectionState === "CONNECTED") {
      console.log(
        `[BaileysProvider] Conexão já em andamento ou conectada para tenant ${this.tenantId}`
      );
      return;
    }

    this.disconnectSocket();
    this.isExplicitStop = false;
    this.connectionState = "CONNECTING";

    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
    }

    const logger = pino({ level: "silent" });
    const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);

    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger as any),
      },
      logger: logger as any,
      printQRInTerminal: false,
      browser: ["Velox SaaS Worker", "Chrome", "120.0.0.0"],
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
      shouldSyncHistoryMessage: () => false,
      markOnlineOnConnect: true,
      retryRequestDelayMs: 500,
      msgRetryCounterCache: this.msgRetryCounterCache as any,
      getMessage: async () => {
        return undefined;
      },
    });

    this.socket = sock;

    // Persistência de credenciais
    sock.ev.on("creds.update", saveCreds);

    // Eventos do ciclo de vida da conexão
    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log(`[BaileysProvider] Novo QR Code gerado para tenant ${this.tenantId}`);
        this.emitter.emit("qr", qr);
      }

      if (connection === "connecting") {
        this.connectionState = "CONNECTING";
      } else if (connection === "open") {
        console.log(
          `[BaileysProvider] Socket Baileys CONECTADO com sucesso para tenant ${this.tenantId}`
        );
        this.connectionState = "CONNECTED";
        this.emitter.emit("authenticated");
        this.emitter.emit("ready");
      } else if (connection === "close") {
        this.connectionState = "DISCONNECTED";
        const boomError = lastDisconnect?.error as any;
        const statusCode: number | undefined =
          boomError?.output?.statusCode ??
          boomError?.statusCode ??
          undefined;
        const reason = lastDisconnect?.error?.message || `Disconnect statusCode: ${statusCode}`;
        const isLoggedOut =
          statusCode === DisconnectReason.loggedOut ||
          statusCode === 401;

        // Log estruturado com statusCode numérico para facilitar debug
        const disconnectReasonMap: Record<number, string> = {
          401: 'loggedOut',
          408: 'timedOut',
          411: 'multideviceMismatch',
          428: 'connectionClosed',
          440: 'connectionReplaced',
          500: 'badSession',
          501: 'connectionLost',
          515: 'restartRequired',
        };
        const reasonLabel = statusCode ? (disconnectReasonMap[statusCode] || 'unknown') : 'undefined';

        console.warn(
          `[BaileysProvider] Conexão fechada para tenant ${this.tenantId} (statusCode: ${statusCode ?? 'undefined'} [${reasonLabel}], LoggedOut: ${isLoggedOut})`
        );

        this.emitter.emit("disconnected", reason, isLoggedOut, statusCode);
      }
    });

    // Escuta de mensagens em tempo real
    sock.ev.on("messages.upsert", (upsert) => {
      if (upsert.type !== "notify" && upsert.type !== "append") return;

      for (const msg of upsert.messages) {
        if (!msg.message || msg.key.fromMe) continue;

        const sender = msg.key.remoteJid || "";

        // Ignorar grupos, broadcasts e newsletters
        if (
          sender.endsWith("@g.us") ||
          sender.endsWith("@broadcast") ||
          sender.endsWith("@newsletter")
        ) {
          continue;
        }

        // Extração de corpo de texto da mensagem Baileys
        const body =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption ||
          msg.message.videoMessage?.caption ||
          msg.message.buttonsResponseMessage?.selectedButtonId ||
          msg.message.listResponseMessage?.singleSelectReply?.selectedRowId ||
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

  public async reconnect(): Promise<void> {
    this.disconnectSocket();
    this.isExplicitStop = false;
    this.connectionState = "DISCONNECTED";
    await new Promise((res) => setTimeout(res, 2000));
    await this.start();
  }

  public isConnected(): boolean {
    return this.connectionState === "CONNECTED" && this.socket !== null;
  }

  public getConnectionState(): string {
    return this.connectionState;
  }

  public async requestPairingCode(phoneNumber: string): Promise<string> {
    if (!this.socket) {
      throw new Error("Socket Baileys não está inicializado para gerar o Código de Pareamento.");
    }
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    console.log(
      `[BaileysProvider] Solicitando Pairing Code Baileys para número ${cleanPhone} [Tenant: ${this.tenantId}]...`
    );
    const code = await this.socket.requestPairingCode(cleanPhone);
    console.log(`[BaileysProvider] Pairing Code obtido: ${code}`);
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
