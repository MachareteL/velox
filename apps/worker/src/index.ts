import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { createSupabaseClient } from '@velox/database';
import { WhatsAppWorker } from './whatsapp';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[Worker] ERRO FATAL: SUPABASE_URL e SUPABASE_ANON_KEY são obrigatórias no .env!');
  process.exit(1);
}

async function main() {
  console.log('=== VELOX MULTI-TENANT WORKER ORCHESTRATOR INICIADO ===');

  const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const activeWorkers = new Map<string, WhatsAppWorker>();
  const tenantLocks = new Map<string, boolean>();

  const startWorkerForTenant = async (
    tenantId: string,
    sessionId: string,
    isActive: boolean,
    phoneNumber?: string | null
  ) => {
    if (tenantLocks.get(tenantId)) {
      console.log(`[Orchestrator] Operação em andamento para tenant ${tenantId}. Ignorando chamada concorrente.`);
      return;
    }
    tenantLocks.set(tenantId, true);

    let worker: WhatsAppWorker | undefined = activeWorkers.get(tenantId);

    try {
      if (worker && worker.isRunning()) {
        worker.setIsActive(isActive);
        if (phoneNumber && phoneNumber !== worker.getPhoneNumber()) {
          await worker.requestPairingCodeOnDemand(phoneNumber);
        }
        return;
      }

      if (worker && !worker.isRunning()) {
        console.log(`[Orchestrator] Removendo e encerrando instância inativa anterior do tenant ${tenantId}...`);
        await worker.stop();
        activeWorkers.delete(tenantId);
      }

      console.log(
        `[Orchestrator] Iniciando worker isolado para tenant ${tenantId} [Automação: ${
          isActive ? 'LIGADA' : 'PAUSADA'
        }]${phoneNumber ? ` [Telefone: ${phoneNumber}]` : ''}...`
      );
      worker = new WhatsAppWorker(tenantId, sessionId, supabase, undefined, phoneNumber);
      worker.setIsActive(isActive);
      activeWorkers.set(tenantId, worker);
      await worker.start();
    } catch (err: any) {
      console.error(`[Orchestrator] Erro ao iniciar worker para tenant ${tenantId}:`, err?.message);
      if (worker) {
        try {
          await worker.stop();
        } catch (_) {}
        activeWorkers.delete(tenantId);
      }
      if (isActive) {
        console.log(`[Orchestrator] Agendando tentativa de recuperação para tenant ${tenantId} em 30s...`);
        setTimeout(() => {
          startWorkerForTenant(tenantId, sessionId, isActive, phoneNumber);
        }, 30000);
      }
    } finally {
      tenantLocks.set(tenantId, false);
    }
  };

  const stopWorkerForTenant = async (tenantId: string) => {
    if (tenantLocks.get(tenantId)) return;
    tenantLocks.set(tenantId, true);

    try {
      const worker = activeWorkers.get(tenantId);
      if (worker) {
        console.log(`[Orchestrator] Encerrando worker do tenant ${tenantId}...`);
        await worker.stop();
        activeWorkers.delete(tenantId);
      }
    } catch (err: any) {
      console.error(`[Orchestrator] Erro ao encerrar worker para tenant ${tenantId}:`, err?.message);
    } finally {
      tenantLocks.set(tenantId, false);
    }
  };

  // 1. Carrega todas as sessões com is_active = true no boot
  const { data: activeSessions, error: bootErr } = await supabase
    .from('whatsapp_sessions')
    .select('*')
    .eq('is_active', true);

  if (bootErr) {
    console.error('[Orchestrator] Erro ao carregar sessões no boot:', bootErr);
  }

  if (activeSessions && activeSessions.length > 0) {
    console.log(`[Orchestrator] 🚀 Verificando ${activeSessions.length} sessões ativas no boot...`);
    const authDataPath = process.env.WWEBJS_AUTH_PATH || path.resolve(process.cwd(), '.wwebjs_auth');

    for (const session of activeSessions) {
      const sessionDir = path.join(authDataPath, `session-tenant_${session.tenant_id}`);
      const hasSessionDir = fs.existsSync(sessionDir);

      if (session.status === 'CONNECTED' || hasSessionDir) {
        console.log(
          `[Orchestrator] Inicializando robô para tenant ${session.tenant_id} (Status DB: ${session.status}, Pasta em Disco: ${hasSessionDir})...`
        );
        await startWorkerForTenant(session.tenant_id, session.id, session.is_active !== false, session.phone_number);
        // Stagger de 800ms para suavizar a carga de CPU da VM durante o restart
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }
  } else {
    console.log('[Orchestrator] Nenhum WhatsApp ativo previamente. Aguardando solicitações no banco...');
  }

  // 2. Escuta global de alterações na tabela whatsapp_sessions para todos os tenants
  supabase
    .channel('multi-tenant-sessions-listener')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'whatsapp_sessions',
      },
      async (payload: any) => {
        if (payload.eventType === 'DELETE') {
          const oldSession = payload.old;
          if (oldSession && oldSession.tenant_id) {
            console.log(`[Orchestrator] Sessão deletada do banco [tenant: ${oldSession.tenant_id}]. Encerrando worker...`);
            await stopWorkerForTenant(oldSession.tenant_id);
          }
          return;
        }

        const session = payload.new;
        if (!session) return;

        console.log(
          `[Orchestrator] Evento de sessão [tenant: ${session.tenant_id}]: status = ${session.status}, is_active = ${session.is_active}`
        );

        if (session.is_active === false) {
          console.log(`[Orchestrator] Automação desativada pelo prestador [tenant: ${session.tenant_id}]. Pausando escuta...`);
          const worker = activeWorkers.get(session.tenant_id);
          if (worker) {
            worker.setIsActive(false);
          }
          return;
        }

        if (
          session.status === 'DISCONNECTED_NEED_QR' ||
          session.status === 'CONNECTED' ||
          session.status === 'AUTHENTICATING'
        ) {
          const isFreshResetRequested =
            session.status === 'DISCONNECTED_NEED_QR' &&
            session.qr_code === null &&
            session.pairing_code === null &&
            !session.phone_number;

          if (isFreshResetRequested) {
            console.log(
              `[Orchestrator] Redefinição de sessão solicitada para tenant ${session.tenant_id}. Reiniciando worker do zero...`
            );
            const existingWorker = activeWorkers.get(session.tenant_id);
            if (existingWorker) {
              await existingWorker.restartForFreshAuth(session.phone_number);
              return;
            } else {
              const authDataPath = process.env.WWEBJS_AUTH_PATH || path.resolve(process.cwd(), '.wwebjs_auth');
              const sessionDir = path.join(authDataPath, `session-tenant_${session.tenant_id}`);
              if (fs.existsSync(sessionDir)) {
                fs.rmSync(sessionDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
              }
            }
          }

          await startWorkerForTenant(session.tenant_id, session.id, true, session.phone_number);
        } else if (session.status === 'DISCONNECTED') {
          // NUNCA encerrar o worker de um tenant ativo se ele possui sessão salva em disco
          const authDataPath = process.env.WWEBJS_AUTH_PATH || path.resolve(process.cwd(), '.wwebjs_auth');
          const sessionDir = path.join(authDataPath, `session-tenant_${session.tenant_id}`);
          const hasSessionDir = fs.existsSync(sessionDir);

          if (!hasSessionDir) {
            console.log(
              `[Orchestrator] Sessão desconectada e sem pasta em disco para tenant ${session.tenant_id}. Encerrando worker...`
            );
            await stopWorkerForTenant(session.tenant_id);
          } else {
            console.log(
              `[Orchestrator] Status DISCONNECTED recebido para tenant ${session.tenant_id}, mas mantendo worker rodando em segundo plano por possuir pasta em disco.`
            );
          }
        }
      }
    )
    .subscribe((status: string) => {
      console.log(`[Orchestrator] Status do Canal Realtime Supabase: ${status}`);
    });

  process.on('uncaughtException', (err) => {
    console.error('[Orchestrator] Exceção não tratada:', err.message);
  });

  process.on('unhandledRejection', (reason: any) => {
    const msg = reason?.message || String(reason || '');
    if (
      msg.includes('Execution context was destroyed') ||
      msg.includes('Target closed') ||
      msg.includes('Protocol error') ||
      msg.includes('detached Frame')
    ) {
      console.warn(`[Orchestrator] Reinicialização de página Chromium detectada (${msg.split('\n')[0]}).`);
      return;
    }
    console.error('[Orchestrator] Rejeição não tratada:', reason);
  });
}

main().catch((err) => {
  console.error('[Orchestrator] Erro fatal no orquestrador:', err);
});
