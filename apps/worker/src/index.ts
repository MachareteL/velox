import dotenv from 'dotenv';
import path from 'path';
import { createSupabaseClient } from '@velox/database';
import { WhatsAppWorker } from './whatsapp';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mirwwmcykalshpfangbd.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pcnd3bWN5a2Fsc2hwZmFuZ2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4NDk2NjIsImV4cCI6MjEwMDQyNTY2Mn0.M5HpVaG8EvXNK0YY-kHJuZEm3Hr0V95HPNE3CMy5ezI';

async function main() {
  console.log('=== VELOX MULTI-TENANT WORKER ORCHESTRATOR INICIADO ===');

  const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const activeWorkers = new Map<string, WhatsAppWorker>();

  const startWorkerForTenant = async (tenantId: string, sessionId: string) => {
    if (activeWorkers.has(tenantId)) {
      console.log(`[Orchestrator] Worker já ativo para tenant ${tenantId}`);
      return;
    }

    console.log(`[Orchestrator] Iniciando worker isolado para tenant ${tenantId}...`);
    const worker = new WhatsAppWorker(tenantId, sessionId, supabase);
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
      await startWorkerForTenant(session.tenant_id, session.id);
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
        const session = payload.new;
        if (!session) return;

        console.log(`[Orchestrator] Evento de sessão [tenant: ${session.tenant_id}]: status = ${session.status}`);

        if (session.status === 'DISCONNECTED_NEED_QR' || session.status === 'CONNECTED') {
          await startWorkerForTenant(session.tenant_id, session.id);
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
