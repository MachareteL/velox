import { Client, LocalAuth } from 'whatsapp-web.js';
import QRCode from 'qrcode';
import fs from 'fs';
import { SupabaseClient } from '@supabase/supabase-js';
import { recordCapturedCall, recordSystemLog, updateSessionStatus } from '@velox/database';
import { VeloxScraper } from './scraper';
import { calcularPrevia } from './calculator';

import path from 'path';

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

function cleanUnauthenticatedSessionDir(tenantId: string): void {
  try {
    const authDataPath = process.env.WWEBJS_AUTH_PATH || path.resolve(process.cwd(), '.wwebjs_auth');
    const sessionDir = path.join(authDataPath, `session-tenant_${tenantId}`);

    if (fs.existsSync(sessionDir)) {
      // Se não há arquivo de autenticação preservado, removemos os dados temporários de IndexedDB corrompidos
      const hasSavedAuth = fs.existsSync(path.join(sessionDir, 'session')) || fs.existsSync(path.join(sessionDir, 'Default', 'Service Worker'));
      if (!hasSavedAuth) {
        console.log(`[Worker] Limpando dados de armazenamento temporários (IndexedDB) em: ${sessionDir}`);
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
    }
  } catch (err: any) {
    console.warn(`[Worker] Aviso ao limpar pasta temporária da sessão: ${err?.message}`);
  }
}

export class WhatsAppWorker {
  private client: Client;
  private scraper: VeloxScraper;
  private inviteRegex: RegExp;
  private isActive: boolean = true;
  private running: boolean = false;

  // Controle Anti-Spam de QR Code e Recursos da VM
  private qrCount: number = 0;
  private maxQrAttempts: number = 8;

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

    // Limpa a pasta temporária de sessão caso ela contenha IndexedDB corrompido de tentativa frustrada
    cleanUnauthenticatedSessionDir(tenantId);

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
        '--disable-session-crashed-bubble',
        '--disable-infobars',
      ],
    };

    const systemChromePath = getWindowsChromePath() || process.env.PUPPETEER_EXECUTABLE_PATH;
    if (systemChromePath) {
      console.log(`[Worker] Utilizando navegador Chrome instalado em: ${systemChromePath}`);
      puppeteerConfig.executablePath = systemChromePath;
    }

    const authDataPath = process.env.WWEBJS_AUTH_PATH || path.resolve(process.cwd(), '.wwebjs_auth');

    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: `tenant_${tenantId}`,
        dataPath: authDataPath,
      }),
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

  public getPhoneNumber(): string | null | undefined {
    return this.phoneNumber;
  }

  public isRunning(): boolean {
    return this.running;
  }

  private async executePairingCodeWithRetry(phoneNumber: string): Promise<string> {
    const rawPhone = phoneNumber.replace(/\D/g, '');

    // Monta a lista de formatos (nacional sem 55 e internacional com 55)
    const formatsToTry: string[] = [];
    if (rawPhone.length === 11) {
      formatsToTry.push(rawPhone); // ex: 19983648849
      formatsToTry.push(`55${rawPhone}`); // ex: 5519983648849
    } else if (rawPhone.startsWith('55') && rawPhone.length === 13) {
      formatsToTry.push(rawPhone); // ex: 5519983648849
      formatsToTry.push(rawPhone.slice(2)); // ex: 19983648849
    } else {
      formatsToTry.push(rawPhone);
      if (!rawPhone.startsWith('55')) formatsToTry.push(`55${rawPhone}`);
    }

    // Aguarda 1.5s inicial para o WhatsApp Web estabilizar a página no Chromium
    await new Promise((resolve) => setTimeout(resolve, 1500));

    for (const phoneCandidate of formatsToTry) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`[Worker Pairing] Solicitando Código de Pareamento (formato: ${phoneCandidate}, tentativa ${attempt}/3)...`);
          const code = await (this.client as any).requestPairingCode(phoneCandidate);
          if (code && typeof code === 'string' && code.length >= 6) {
            console.log(`[Worker Pairing] ✨ Código de Pareamento gerado com sucesso (${phoneCandidate}): ${code}`);
            return code;
          }
        } catch (err: any) {
          const errMsg = err?.message || String(err || 't');
          console.warn(`[Worker Pairing] Formato ${phoneCandidate} tentativa ${attempt}/3 (${errMsg}). Aguardando 2s...`);
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    throw new Error('Não foi possível gerar o código por telefone no momento. Tente novamente em instantes.');
  }

  public async requestPairingCodeOnDemand(phoneNumber: string): Promise<string | null> {
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    this.phoneNumber = cleanPhone;
    this.qrCount = 0;

    if (!this.running) {
      console.log(`[Worker] Robô estava pausado/parado. Reiniciando cliente para tenant ${this.tenantId}...`);
      await this.start();
      return null;
    }

    try {
      console.log(`[Worker] Solicitando Código de Pareamento sob demanda para número ${cleanPhone}...`);
      const pairingCode = await this.executePairingCodeWithRetry(cleanPhone);
      console.log(`[Worker] Código de Pareamento gerado sob demanda: ${pairingCode}`);

      await updateSessionStatus(
        this.supabase,
        this.sessionId,
        'DISCONNECTED_NEED_QR',
        null,
        'vps-worker-01',
        pairingCode,
        cleanPhone
      );

      await recordSystemLog(this.supabase, {
        tenant_id: this.tenantId,
        level: 'INFO',
        event_type: 'PAIRING_CODE_GENERATED',
        message: `Código de Pareamento por telefone gerado com sucesso: ${pairingCode}`,
        details: { phoneNumber: cleanPhone, pairingCode },
      });

      return pairingCode;
    } catch (pairErr: any) {
      const errMsg = pairErr?.message || String(pairErr || 't');
      console.error('[Worker] Erro ao solicitar Código de Pareamento sob demanda:', errMsg);

      try {
        console.warn(`[Worker] Recarregando navegador do tenant ${this.tenantId} para restaurar quadro Chromium...`);
        this.qrCount = 0;
        await this.stop();
        await this.start();
      } catch (reinitErr: any) {
        console.error('[Worker] Erro ao re-inicializar cliente WhatsApp:', reinitErr.message);
      }
      return null;
    }
  }

  private setupListeners(): void {
    // Evento de geração de autenticação (QR Code ou Pairing Code)
    this.client.on('qr', async (qrText: string) => {
      this.qrCount++;
      console.log(`[Worker] Geração de autenticação #${this.qrCount}/${this.maxQrAttempts} recebida para tenant ${this.tenantId}`);

      if (this.qrCount > this.maxQrAttempts) {
        console.warn(`[Worker Anti-Spam] Limite de renovações de QR Code atingido (${this.qrCount}/${this.maxQrAttempts}) para tenant ${this.tenantId}. Encerrando robô para economizar recursos.`);
        await updateSessionStatus(
          this.supabase,
          this.sessionId,
          'DISCONNECTED',
          null,
          'vps-worker-01',
          null,
          null
        );

        await recordSystemLog(this.supabase, {
          tenant_id: this.tenantId,
          level: 'WARN',
          event_type: 'QR_TIMEOUT_PAUSE',
          message: 'Renovação de QR Code desativada por inatividade para preservar servidor. Clique em Gerar QR Code no painel.',
        });

        await this.stop();
        return;
      }

      if (this.phoneNumber) {
        try {
          console.log(`[Worker] Solicitando Código de Pareamento de 8 dígitos para o número ${this.phoneNumber}...`);
          const pairingCode = await this.executePairingCodeWithRetry(this.phoneNumber);
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
          const errMsg = pairErr?.message || String(pairErr || 't');
          console.error('[Worker] Erro ao gerar Pairing Code:', errMsg);
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

    // Evento disparado no exato instante em que o celular aprova o QR Code ou Pairing Code
    this.client.on('authenticated', async () => {
      console.log(`[Worker] ✨ Conexão aprovada pelo celular para tenant ${this.tenantId}! Inicializando automação...`);

      await updateSessionStatus(
        this.supabase,
        this.sessionId,
        'AUTHENTICATING',
        null,
        'vps-worker-01',
        null,
        this.phoneNumber || null
      );

      await recordSystemLog(this.supabase, {
        tenant_id: this.tenantId,
        level: 'INFO',
        event_type: 'SESSION_AUTHENTICATED',
        message: 'Código/QR Code lido no celular com sucesso! Inicializando a automação...',
      });
    });

    // Monitoramento do percentual de carregamento do WhatsApp Web
    this.client.on('loading_screen', async (percent: number, message: string) => {
      console.log(`[Worker] Carregando conversas do WhatsApp para tenant ${this.tenantId}: ${percent}% (${message})`);
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

      // APENAS se o usuário fez LOGOUT explícito no celular desvinculamos a sessão no Supabase
      if (reason === 'LOGOUT') {
        console.warn(`[Worker] Logout explícito no celular detectado para tenant ${this.tenantId}. Marcando como necessário novo QR code.`);
        await updateSessionStatus(
          this.supabase,
          this.sessionId,
          'DISCONNECTED_NEED_QR',
          null,
          'vps-worker-01',
          null,
          null
        );

        await recordSystemLog(this.supabase, {
          tenant_id: this.tenantId,
          level: 'WARN',
          event_type: 'SESSION_LOGOUT',
          message: 'Sessão desconectada via WhatsApp (Logout). É necessário escaneamento.',
        });
        return;
      }

      // Para quedas temporárias/restarts: mantém status DISCONNECTED sem invalidar a sessão salva no disco
      await updateSessionStatus(
        this.supabase,
        this.sessionId,
        'DISCONNECTED',
        null,
        'vps-worker-01'
      );

      this.reconnectAttempts++;
      const backoffDelayMs = Math.min(60000, Math.pow(2, this.reconnectAttempts) * 2000 + Math.floor(Math.random() * 1000));
      console.log(`[Worker Reconnect] Agendando reconexão automática #${this.reconnectAttempts} em ${(backoffDelayMs / 1000).toFixed(1)}s...`);

      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(async () => {
        try {
          await this.client.initialize();
        } catch (err: any) {
          console.error('[Worker Reconnect] Erro ao reconectar sessão salva:', err.message);
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
    this.running = true;
    await this.client.initialize();
  }

  public async stop(): Promise<void> {
    this.running = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    try {
      await this.client.destroy();
    } catch (err: any) {
      console.error('[Worker] Erro ao encerrar WhatsApp client:', err.message);
    }
  }
}
