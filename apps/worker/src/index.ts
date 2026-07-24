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

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_SESSION_ID = '00000000-0000-0000-0000-000000000001';

async function main() {
  console.log('--- VELOX WHATSAPP AUTOMATION WORKER INICIADO ---');

  const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  let activeWorker: WhatsAppWorker | null = null;

  const startWorker = async () => {
    if (activeWorker) return;
    console.log('[Main] Iniciando novo robô de automação WhatsApp...');
    activeWorker = new WhatsAppWorker(DEFAULT_TENANT_ID, DEFAULT_SESSION_ID, supabase);
    await activeWorker.start();
  };

  // Escuta requisições de QR code ou reconexão vindas do Dashboard Web via Supabase Realtime
  supabase
    .channel('worker-session-listener')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'whatsapp_sessions',
        filter: `id=eq.${DEFAULT_SESSION_ID}`,
      },
      async (payload: any) => {
        const newStatus = payload.new?.status;
        console.log(`[Main] Status da sessão atualizado via Dashboard: ${newStatus}`);

        if (newStatus === 'DISCONNECTED_NEED_QR' && !activeWorker) {
          await startWorker();
        }
      }
    )
    .subscribe();

  // Verifica estado inicial no banco de dados
  const { data: session } = await supabase
    .from('whatsapp_sessions')
    .select('status')
    .eq('id', DEFAULT_SESSION_ID)
    .single();

  if (session?.status === 'DISCONNECTED_NEED_QR' || session?.status === 'CONNECTED') {
    await startWorker();
  } else {
    console.log('[Main] Worker aguardando solicitação de conexão via Web App Dashboard...');
  }

  process.on('uncaughtException', (err) => {
    console.error('[Main] Exceção não tratada:', err.message);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[Main] Rejeição não tratada:', reason);
  });
}

main().catch((err) => {
  console.error('[Main] Erro fatal no worker:', err);
});
