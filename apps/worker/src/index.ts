import dotenv from 'dotenv';
import path from 'path';
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

  const startWorkerForTenant = async (tenantId: string, sessionId: string, isActive: boolean, phoneNumber?: string | null) => {
    let worker = activeWorkers.get(tenantId);
    if (worker) {
      worker.setIsActive(isActive);
      if (phoneNumber && phoneNumber !== worker.getPhoneNumber()) {
        await worker.requestPairingCodeOnDemand(phoneNumber);
      }
      return;
    }

    console.log(`[Orchestrator] Iniciando worker isolado para tenant ${tenantId} [Automação: ${isActive ? 'LIGADA' : 'PAUSADA'}]${phoneNumber ? ` [Telefone: ${phoneNumber}]` : ''}...`);
    worker = new WhatsAppWorker(tenantId, sessionId, supabase, undefined, phoneNumber);
    worker.setIsActive(isActive);
    activeWorkers.set(tenantId, worker);
    await worker.start();
  };

  const stopWorkerForTenant = async (tenantId: string) => {
    const worker = activeWorkers.get(tenantId);
    if (worker) {
      console.log(`[Orchestrator] Encerrando worker do tenant ${tenantId}...`);
      await worker.stop();
      activeWorkers.delete(tenantId);
    }
  };

  // 1. Carrega sessões existentes no boot
  const { data: activeSessions, error: bootErr } = await supabase
    .from('whatsapp_sessions')
    .select('*')
    .in('status', ['DISCONNECTED_NEED_QR', 'CONNECTED']);

  if (bootErr) {
    console.error('[Orchestrator] Erro ao carregar sessões no boot:', bootErr);
  }

  if (activeSessions && activeSessions.length > 0) {
    console.log(`[Orchestrator] Encontradas ${activeSessions.length} sessões ativas no boot.`);
    for (const session of activeSessions) {
      await startWorkerForTenant(session.tenant_id, session.id, session.is_active !== false, session.phone_number);
    }
  } else {
    console.log('[Orchestrator] Aguardando novas solicitações de QR Code no banco de dados...');
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

        console.log(`[Orchestrator] Evento de sessão [tenant: ${session.tenant_id}]: status = ${session.status}, is_active = ${session.is_active}`);

        if (session.status === 'DISCONNECTED_NEED_QR' || session.status === 'CONNECTED') {
          await startWorkerForTenant(session.tenant_id, session.id, session.is_active !== false, session.phone_number);
        } else if (session.status === 'DISCONNECTED') {
          await stopWorkerForTenant(session.tenant_id);
        }
      }
    )
    .subscribe((status: string) => {
      console.log(`[Orchestrator] Status do Canal Realtime Supabase: ${status}`);
    });

  process.on('uncaughtException', (err) => {
    console.error('[Orchestrator] Exceção não tratada:', err.message);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[Orchestrator] Rejeição não tratada:', reason);
  });
}

main().catch((err) => {
  console.error('[Orchestrator] Erro fatal no orquestrador:', err);
});
