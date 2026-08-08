-- ==============================================================================
-- SCHEMA COMPLETO E DEFINIÇÃO DE SEGURANÇA RLS (SUPABASE / POSTGRESQL)
-- Projeto: Velox Automator
-- ==============================================================================

-- 1. TABELAS DO SISTEMA
-- ------------------------------------------------------------------------------

-- Tabela de Tenants (Prestadores Autônomos / Empresas)
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de Sessões do WhatsApp por Prestador
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
    status TEXT NOT NULL DEFAULT 'DISCONNECTED', -- 'DISCONNECTED', 'DISCONNECTED_NEED_QR', 'CONNECTED', 'FAILED'
    is_active BOOLEAN NOT NULL DEFAULT true, -- TRUE = Aceite Automático LIGADO | FALSE = PAUSADO
    qr_code TEXT,
    worker_id TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de Chamados Velox Capturados
CREATE TABLE IF NOT EXISTS public.captured_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    distancia_km NUMERIC,
    previa_valor NUMERIC,
    duration_ms INTEGER NOT NULL,
    status TEXT NOT NULL, -- 'SUCCESS', 'FAILED'
    response_payload JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de Logs do Sistema
CREATE TABLE IF NOT EXISTS public.system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    level TEXT NOT NULL, -- 'INFO', 'WARN', 'ERROR'
    event_type TEXT NOT NULL,
    message TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. HABILITAÇÃO DO SUPABASE REALTIME
-- ------------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_sessions, captured_calls, system_logs;

-- 3. TRIGGER AUTOMÁTICO DE CRIAÇÃO DE TENANT AO REGISTRAR USUÁRIO NO SUPABASE AUTH
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.tenants (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  INSERT INTO public.whatsapp_sessions (id, tenant_id, status, is_active)
  VALUES (NEW.id, NEW.id, 'DISCONNECTED', true)
  ON CONFLICT (tenant_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. HABILITAR ROW LEVEL SECURITY (RLS) EM TODAS AS TABELAS
-- ------------------------------------------------------------------------------
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captured_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- 5. POLÍTICAS DE RLS PARA `tenants`
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Tenants - Leitura individual" ON public.tenants;
CREATE POLICY "Tenants - Leitura individual" ON public.tenants
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Tenants - Leitura para Worker" ON public.tenants;
CREATE POLICY "Tenants - Leitura para Worker" ON public.tenants
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Tenants - Atualizacao individual" ON public.tenants;
CREATE POLICY "Tenants - Atualizacao individual" ON public.tenants
  FOR UPDATE USING (auth.uid() = id);

-- 6. POLÍTICAS DE RLS PARA `whatsapp_sessions`
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Sessions - Leitura individual" ON public.whatsapp_sessions;
CREATE POLICY "Sessions - Leitura individual" ON public.whatsapp_sessions
  FOR SELECT USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Sessions - Leitura para Worker" ON public.whatsapp_sessions;
CREATE POLICY "Sessions - Leitura para Worker" ON public.whatsapp_sessions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Sessions - Atualizacao individual" ON public.whatsapp_sessions;
CREATE POLICY "Sessions - Atualizacao individual" ON public.whatsapp_sessions
  FOR UPDATE USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Sessions - Atualizacao Worker" ON public.whatsapp_sessions;
CREATE POLICY "Sessions - Atualizacao Worker" ON public.whatsapp_sessions
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Sessions - Insercao individual" ON public.whatsapp_sessions;
CREATE POLICY "Sessions - Insercao individual" ON public.whatsapp_sessions
  FOR INSERT WITH CHECK (true);

-- 7. POLÍTICAS DE RLS PARA `captured_calls`
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Calls - Leitura individual" ON public.captured_calls;
CREATE POLICY "Calls - Leitura individual" ON public.captured_calls
  FOR SELECT USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Calls - Leitura para Worker" ON public.captured_calls;
CREATE POLICY "Calls - Leitura para Worker" ON public.captured_calls
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Calls - Permissao de Insercao" ON public.captured_calls;
CREATE POLICY "Calls - Permissao de Insercao" ON public.captured_calls
  FOR INSERT WITH CHECK (true);

-- 8. POLÍTICAS DE RLS PARA `system_logs`
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Logs - Leitura individual" ON public.system_logs;
CREATE POLICY "Logs - Leitura individual" ON public.system_logs
  FOR SELECT USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Logs - Leitura para Worker" ON public.system_logs;
CREATE POLICY "Logs - Leitura para Worker" ON public.system_logs
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Logs - Permissao de Insercao" ON public.system_logs;
CREATE POLICY "Logs - Permissao de Insercao" ON public.system_logs
  FOR INSERT WITH CHECK (true);

-- 9. TABELA E POLÍTICAS DE RLS PARA `push_subscriptions` (WEB PUSH)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Push - Leitura individual" ON public.push_subscriptions;
CREATE POLICY "Push - Leitura individual" ON public.push_subscriptions
  FOR SELECT USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Push - Insercao individual" ON public.push_subscriptions;
CREATE POLICY "Push - Insercao individual" ON public.push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Push - Delecao individual" ON public.push_subscriptions;
CREATE POLICY "Push - Delecao individual" ON public.push_subscriptions
  FOR DELETE USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Push - Permissao backend" ON public.push_subscriptions;
CREATE POLICY "Push - Permissao backend" ON public.push_subscriptions
  FOR ALL USING (true);

