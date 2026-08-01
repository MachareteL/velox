export interface IncomingMessagePayload {
  id: string;
  from: string;
  body: string;
  timestamp: number;
}

export interface WhatsAppProviderEvents {
  qr: (qrCode: string) => void;
  pairingCode: (code: string) => void;
  authenticated: () => void;
  ready: () => void;
  disconnected: (reason: string, isLoggedOut: boolean, statusCode?: number) => void;
  message: (msg: IncomingMessagePayload) => void;
}

export interface WhatsAppProvider {
  start(): Promise<void>;
  stop(): Promise<void>;
  reconnect(): Promise<void>;
  isConnected(): boolean;
  requestPairingCode(phoneNumber: string): Promise<string>;
  getConnectionState(): string;
  isSocketOpen(): boolean;
  on<K extends keyof WhatsAppProviderEvents>(
    event: K,
    listener: WhatsAppProviderEvents[K]
  ): void;
  off<K extends keyof WhatsAppProviderEvents>(
    event: K,
    listener: WhatsAppProviderEvents[K]
  ): void;
}
