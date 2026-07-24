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

    // Evento de desconexão
    this.client.on('disconnected', async (reason: string) => {
      console.warn(`[Worker] WhatsApp desconectado (${reason}) para tenant ${this.tenantId}`);

      await updateSessionStatus(
        this.supabase,
        this.sessionId,
        'DISCONNECTED',
        null,
        'vps-worker-01'
      );

      await recordSystemLog(this.supabase, {
        tenant_id: this.tenantId,
        level: 'WARN',
        event_type: 'RECONNECT',
        message: `Conexão encerrada (${reason}). Tentando reconectar...`,
      });
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

        // Dispara o processamento imediato em background se LIGADO
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
              ? `Convite aceito com sucesso em ${result.durationMs}ms.`
              : `Tentativa de aceite: ${result.errorMessage}`,
            details: { url: targetUrl, durationMs: result.durationMs },
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
    try {
      await this.client.destroy();
    } catch (err: any) {
      console.error('[Worker] Erro ao encerrar WhatsApp client:', err.message);
    }
  }
}
