import { Client, LocalAuth } from 'whatsapp-web.js';
import QRCode from 'qrcode';
import fs from 'fs';
import { SupabaseClient } from '@supabase/supabase-js';
import { recordCapturedCall, recordSystemLog, updateSessionStatus } from '@velox/database';
import { VeloxScraper } from './scraper';

function getWindowsChromePath(): string | null {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    (process.env.LOCALAPPDATA || '') + '\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const p of paths) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

export class WhatsAppWorker {
  private client: Client;
  private scraper: VeloxScraper;
  private inviteRegex: RegExp;
  private isActive: boolean = true;

  // Controle Anti-Ban / Anti-Spam de Reconexão
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  private reconnectCooldownWindowMs: number = 10 * 60 * 1000; // 10 minutos
  private lastReconnectTime: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(
    private tenantId: string,
    private sessionId: string,
    private supabase: SupabaseClient,
    targetRegexPattern?: string
  ) {
    const defaultPattern =
      'https:\\/\\/prestador\\.veloxcontactcenter\\.com\\.br\\/prestador\\/ConvitePrestador\\/VisualizarConvite\\?ChaveConvite=[a-f0-9\\-]+';
    this.inviteRegex = new RegExp(targetRegexPattern || process.env.TARGET_REGEX || defaultPattern, 'i');
    this.scraper = new VeloxScraper(parseInt(process.env.HTTP_TIMEOUT || '5000', 10));

    const puppeteerConfig: any = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    };

    const systemChromePath = getWindowsChromePath();
    if (systemChromePath) {
      console.log(`[Worker] Utilizando navegador Chrome instalado em: ${systemChromePath}`);
      puppeteerConfig.executablePath = systemChromePath;
    }

    this.client = new Client({
      authStrategy: new LocalAuth({ clientId: `tenant_${tenantId}` }),
      puppeteer: puppeteerConfig,
    });

    this.setupListeners();
  }

  public setIsActive(active: boolean): void {
    const previous = this.isActive;
    this.isActive = active;
    if (previous !== active) {
      console.log(`[Worker] Estado da automação alterado para tenant ${this.tenantId}: ${active ? 'LIGADO' : 'PAUSADO'}`);
    }
  }

  private setupListeners(): void {
    // Evento de geração do QR Code
    this.client.on('qr', async (qrText: string) => {
      console.log(`[Worker] Novo QR Code gerado para tenant ${this.tenantId}`);

      try {
        const qrDataUrl = await QRCode.toDataURL(qrText);

        await updateSessionStatus(
          this.supabase,
          this.sessionId,
          'DISCONNECTED_NEED_QR',
          qrDataUrl,
          'vps-worker-01'
        );

        await recordSystemLog(this.supabase, {
          tenant_id: this.tenantId,
          level: 'INFO',
          event_type: 'QR_GENERATED',
          message: 'Novo Código de Conexão gerado.',
        });
      } catch (err: any) {
        console.error('[Worker] Erro ao converter QR Code:', err.message);
      }
    });

    // Evento de conexão pronta
    this.client.on('ready', async () => {
      console.log(`[Worker] WhatsApp Web conectado para tenant ${this.tenantId}`);
      this.reconnectAttempts = 0; // Reseta tentativas de reconexão ao conectar com sucesso

      await updateSessionStatus(
        this.supabase,
        this.sessionId,
        'CONNECTED',
        null,
        'vps-worker-01'
      );

      await recordSystemLog(this.supabase, {
        tenant_id: this.tenantId,
        level: 'INFO',
        event_type: 'SESSION_READY',
        message: 'WhatsApp Web conectado e pronto para automação.',
      });
    });

    // Evento de desconexão (Com Proteção Anti-Spam e Exponential Backoff)
    this.client.on('disconnected', async (reason: string) => {
      console.warn(`[Worker] WhatsApp desconectado (${reason}) para tenant ${this.tenantId}`);

      const now = Date.now();
      if (now - this.lastReconnectTime > this.reconnectCooldownWindowMs) {
        this.reconnectAttempts = 0; // Reseta contador se passou a janela de 10 min
      }
      this.lastReconnectTime = now;

      await updateSessionStatus(
        this.supabase,
        this.sessionId,
        'DISCONNECTED',
        null,
        'vps-worker-01'
      );

      // Se foi LOGOUT explícito do celular ou excedeu o limite seguro de tentativas de reconexão
      if (reason === 'LOGOUT' || this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.warn(`[Worker Anti-Ban] Limite seguro de reconexões atingido (${this.reconnectAttempts}/${this.maxReconnectAttempts}) para tenant ${this.tenantId}. Interrompendo para evitar bloqueios.`);

        await updateSessionStatus(
          this.supabase,
          this.sessionId,
          'DISCONNECTED_NEED_QR',
          null,
          'vps-worker-01'
        );

        await recordSystemLog(this.supabase, {
          tenant_id: this.tenantId,
          level: 'WARN',
          event_type: 'RECONNECT_COOLDOWN',
          message: 'Reconexão temporariamente suspensa por segurança para prevenir bloqueios do WhatsApp. Gere um novo QR Code quando desejado.',
        });
        return;
      }

      // Cálculo de Exponential Backoff: 1ª tent: 5s, 2ª tent: 15s, 3ª tent: 45s + Jitter aleatório
      this.reconnectAttempts++;
      const backoffDelayMs = Math.min(60000, Math.pow(3, this.reconnectAttempts) * 3000 + Math.floor(Math.random() * 2000));
      console.log(`[Worker Anti-Ban] Agendando reconexão segura #${this.reconnectAttempts} em ${(backoffDelayMs / 1000).toFixed(1)}s...`);

      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(async () => {
        try {
          console.log(`[Worker Anti-Ban] Executando tentativa segura de reconexão para tenant ${this.tenantId}...`);
          await this.client.initialize();
        } catch (err: any) {
          console.error('[Worker Anti-Ban] Erro ao tentar reconectar:', err.message);
        }
      }, backoffDelayMs);
    });

    // Escuta de mensagens em tempo real
    this.client.on('message', async (msg) => {
      if (!msg.body) return;

      const match = msg.body.match(this.inviteRegex);
      if (match) {
        const targetUrl = match[0];
        console.log(`[Worker] Convite capturado no WhatsApp: ${targetUrl}`);

        // Verificação da chave LIGADO / DESLIGADO (ON / OFF)
        if (!this.isActive) {
          console.log(`[Worker] Automação pausada pelo prestador. Ignorando convite: ${targetUrl}`);
          await recordSystemLog(this.supabase, {
            tenant_id: this.tenantId,
            level: 'WARN',
            event_type: 'AUTOMATION_PAUSED',
            message: 'Convite recebido mas ignorado pois a automação está pausada pelo prestador.',
            details: { url: targetUrl },
          });
          return;
        }

        // Dispara o processamento com Retry Inteligente
        setImmediate(async () => {
          const result = await this.scraper.processarConvite(targetUrl);

          await recordCapturedCall(this.supabase, {
            tenant_id: this.tenantId,
            url: result.url,
            distancia_km: result.distanciaKm,
            previa_valor: result.previaValor,
            duration_ms: result.durationMs,
            status: result.success ? 'SUCCESS' : 'FAILED',
            response_payload: result.responsePayload || null,
            error_message: result.errorMessage || null,
          });

          await recordSystemLog(this.supabase, {
            tenant_id: this.tenantId,
            level: result.success ? 'INFO' : 'ERROR',
            event_type: result.success ? 'HTTP_POST_SUCCESS' : 'HTTP_POST_ERROR',
            message: result.success
              ? `Convite aceito com sucesso em ${result.durationMs}ms (Tentativas: ${result.attemptsMade}).`
              : `Tentativa de aceite: ${result.errorMessage}`,
            details: { url: targetUrl, durationMs: result.durationMs, attemptsMade: result.attemptsMade },
          });
        });
      }
    });
  }

  public async start(): Promise<void> {
    console.log(`[Worker] Inicializando cliente WhatsApp para tenant ${this.tenantId}...`);
    await this.client.initialize();
  }

  public async stop(): Promise<void> {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    try {
      await this.client.destroy();
    } catch (err: any) {
      console.error('[Worker] Erro ao encerrar WhatsApp client:', err.message);
    }
  }
}
