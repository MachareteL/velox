import { Client, LocalAuth } from 'whatsapp-web.js';
import QRCode from 'qrcode';
import fs from 'fs';
import { SupabaseClient } from '@supabase/supabase-js';
import { recordCapturedCall, recordSystemLog, updateSessionStatus } from '@velox/database';
import { VeloxScraper } from './scraper';
import { calcularPrevia } from './calculator';

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
  private reconnectCooldownWindowMs: number = 10 * 60 * 1000;
  private lastReconnectTime: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(
    private tenantId: string,
    private sessionId: string,
    private supabase: SupabaseClient,
    targetRegexPattern?: string,
    private phoneNumber?: string | null
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

    const systemChromePath = getWindowsChromePath() || process.env.PUPPETEER_EXECUTABLE_PATH;
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
    // Evento de geração de autenticação (QR Code ou Pairing Code)
    this.client.on('qr', async (qrText: string) => {
      console.log(`[Worker] Solicitação de autenticação recebida para tenant ${this.tenantId}`);

      if (this.phoneNumber) {
        try {
          console.log(`[Worker] Solicitando Código de Pareamento de 8 dígitos para o número ${this.phoneNumber}...`);
          const pairingCode = await (this.client as any).requestPairingCode(this.phoneNumber);
          console.log(`[Worker] Código de Pareamento gerado com sucesso: ${pairingCode}`);

          await updateSessionStatus(
            this.supabase,
            this.sessionId,
            'DISCONNECTED_NEED_QR',
            null,
            'vps-worker-01',
            pairingCode,
            this.phoneNumber
          );

          await recordSystemLog(this.supabase, {
            tenant_id: this.tenantId,
            level: 'INFO',
            event_type: 'PAIRING_CODE_GENERATED',
            message: `Código de Pareamento por telefone gerado com sucesso: ${pairingCode}`,
            details: { phoneNumber: this.phoneNumber, pairingCode },
          });
          return;
        } catch (pairErr: any) {
          console.error('[Worker] Erro ao gerar Pairing Code:', pairErr.message);
        }
      }

      try {
        const qrDataUrl = await QRCode.toDataURL(qrText);

        await updateSessionStatus(
          this.supabase,
          this.sessionId,
          'DISCONNECTED_NEED_QR',
          qrDataUrl,
          'vps-worker-01',
          null,
          null
        );

        await recordSystemLog(this.supabase, {
          tenant_id: this.tenantId,
          level: 'INFO',
          event_type: 'QR_GENERATED',
          message: 'Novo Código de Conexão (QR Code) gerado.',
        });
      } catch (err: any) {
        console.error('[Worker] Erro ao converter QR Code:', err.message);
      }
    });

    // Evento de conexão pronta
    this.client.on('ready', async () => {
      console.log(`[Worker] WhatsApp Web conectado para tenant ${this.tenantId}`);
      this.reconnectAttempts = 0;

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

      const now = Date.now();
      if (now - this.lastReconnectTime > this.reconnectCooldownWindowMs) {
        this.reconnectAttempts = 0;
      }
      this.lastReconnectTime = now;

      await updateSessionStatus(
        this.supabase,
        this.sessionId,
        'DISCONNECTED',
        null,
        'vps-worker-01'
      );

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
          message: 'Reconexão temporariamente suspensa por segurança para prevenir bloqueios do WhatsApp.',
        });
        return;
      }

      this.reconnectAttempts++;
      const backoffDelayMs = Math.min(60000, Math.pow(3, this.reconnectAttempts) * 3000 + Math.floor(Math.random() * 2000));
      console.log(`[Worker Anti-Ban] Agendando reconexão segura #${this.reconnectAttempts} em ${(backoffDelayMs / 1000).toFixed(1)}s...`);

      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(async () => {
        try {
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

        // 1. Verificação do botão LIGADO / PAUSADO
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

        // 2. Verificação de Capacidade de Atendimentos Simultâneos da Frota
        try {
          const { data: vehicles } = await this.supabase
            .from('vehicles')
            .select('*')
            .eq('tenant_id', this.tenantId)
            .eq('is_active', true);

          const fleetCapacity = vehicles && vehicles.length > 0 ? vehicles.length : 1;

          // Busca chamados em andamento do tenant
          const { data: calls } = await this.supabase
            .from('captured_calls')
            .select('*')
            .eq('tenant_id', this.tenantId)
            .eq('status', 'SUCCESS')
            .is('completed_at', null);

          const now = Date.now();
          const activeCalls = (calls || []).filter((call) => {
            const createdAtMs = new Date(call.created_at).getTime();
            const durationMin = call.previa_minutos || 50;
            const expiresAtMs = createdAtMs + durationMin * 60 * 1000;
            return now < expiresAtMs;
          });

          if (activeCalls.length >= fleetCapacity) {
            console.log(`[Worker] Capacidade máxima da frota atingida (${activeCalls.length}/${fleetCapacity} atendimentos ativos). Ignorando convite.`);

            await recordSystemLog(this.supabase, {
              tenant_id: this.tenantId,
              level: 'WARN',
              event_type: 'FLEET_CAPACITY_REACHED',
              message: `Capacidade da frota atingida (${activeCalls.length}/${fleetCapacity} veículos em atendimento). Convite não aceito automaticamente.`,
              details: { url: targetUrl, activeCallsCount: activeCalls.length, fleetCapacity },
            });
            return;
          }

          // Vincula o primeiro veículo disponível da frota ativa ao chamado
          const assignedVehicleIds = new Set(activeCalls.map((c) => c.vehicle_id).filter(Boolean));
          const availableVehicle = (vehicles || []).find((v) => !assignedVehicleIds.has(v.id)) || null;

          // 3. Processa o convite com Retry Inteligente
          setImmediate(async () => {
            const result = await this.scraper.processarConvite(targetUrl);
            const previaMinutos = calcularPrevia(result.distanciaKm);

            const responsePayloadToRecord = {
              ...(result.responsePayload || {}),
              debugInfo: result.debugInfo || null,
              attemptsMade: result.attemptsMade,
              payloadSent: result.payload || null,
            };

            await recordCapturedCall(this.supabase, {
              tenant_id: this.tenantId,
              url: result.url,
              distancia_km: result.distanciaKm,
              previa_valor: result.previaValor,
              previa_minutos: previaMinutos,
              vehicle_id: availableVehicle?.id || null,
              duration_ms: result.durationMs,
              status: result.success ? 'SUCCESS' : 'FAILED',
              response_payload: responsePayloadToRecord,
              error_message: result.errorMessage || null,
            });

            await recordSystemLog(this.supabase, {
              tenant_id: this.tenantId,
              level: result.success ? 'INFO' : 'ERROR',
              event_type: result.success ? 'HTTP_POST_SUCCESS' : 'HTTP_POST_ERROR',
              message: result.success
                ? `Convite aceito com sucesso em ${result.durationMs}ms${availableVehicle ? ` | Veículo: ${availableVehicle.title}` : ''}.`
                : `Falha no aceite do convite: ${result.errorMessage}`,
              details: {
                url: targetUrl,
                durationMs: result.durationMs,
                vehicleId: availableVehicle?.id,
                statusCode: result.statusCode,
                debugInfo: result.debugInfo,
              },
            });
          });
        } catch (err: any) {
          console.error('[Worker] Erro ao verificar capacidade da frota:', err.message);
        }
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
