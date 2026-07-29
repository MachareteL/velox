-- ==============================================================================
-- CRON JOB DE FINALIZAÇÃO AUTOMÁTICA DE ATENDIMENTOS EXPIRADOS (SUPABASE / POSTGRESQL)
-- ==============================================================================
-- Este script configura um job em segundo plano diretamente no banco de dados
-- Supabase via pg_cron. Ele verifica a cada 2 minutos os chamados capturados 
-- que excederam o tempo da prévia (previa_minutos ou 50 min padrão) e preenche
-- a coluna completed_at com a data/hora atual.
-- ==============================================================================

-- 1. Habilita a extensão pg_cron no Supabase (se ainda não estiver ativa)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Cria ou atualiza a função que finaliza os atendimentos vencidos
CREATE OR REPLACE FUNCTION public.auto_complete_expired_calls()
RETURNS void AS $$
BEGIN
    UPDATE public.captured_calls
    SET completed_at = NOW()
    WHERE status = 'SUCCESS'
      AND completed_at IS NULL
      AND (created_at + (COALESCE(previa_minutos, 50) || ' minutes')::interval) <= NOW();
END;
$$ LANGUAGE plpgsql;

-- 3. Agenda o Job no pg_cron para executar a cada 5 minutos
SELECT cron.schedule(
    'auto-complete-expired-calls-job',
    '*/5 * * * *',
    $$ SELECT public.auto_complete_expired_calls(); $$
);
