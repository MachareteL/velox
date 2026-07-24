import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  CapturedCall,
  SystemLog,
  SystemLogLevel,
  WhatsAppSession,
  WhatsAppSessionStatus,
} from '@velox/types';

export function createSupabaseClient(
  supabaseUrl?: string,
  supabaseKey?: string
): SupabaseClient {
  const url = supabaseUrl || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = supabaseKey || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'Configuração do Supabase ausente. Defina SUPABASE_URL e SUPABASE_ANON_KEY.'
    );
  }

  return createClient(url, key);
}

export async function updateSessionStatus(
  supabase: SupabaseClient,
  sessionIdOrTenantId: string,
  status: WhatsAppSessionStatus,
  qrCode?: string | null,
  workerId?: string | null
): Promise<WhatsAppSession | null> {
  const updateData: Partial<WhatsAppSession> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (qrCode !== undefined) {
    updateData.qr_code = qrCode;
  }
  if (workerId !== undefined) {
    updateData.worker_id = workerId;
  }

  const { data, error } = await supabase
    .from('whatsapp_sessions')
    .update(updateData)
    .or(`id.eq.${sessionIdOrTenantId},tenant_id.eq.${sessionIdOrTenantId}`)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('Erro ao atualizar whatsapp_session:', error.message);
    return null;
  }

  return data as WhatsAppSession;
}

export async function toggleAutomationState(
  supabase: SupabaseClient,
  tenantId: string,
  isActive: boolean
): Promise<WhatsAppSession | null> {
  const { data, error } = await supabase
    .from('whatsapp_sessions')
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('Erro ao alterar estado da automação:', error.message);
    return null;
  }

  return data as WhatsAppSession;
}

export async function recordCapturedCall(
  supabase: SupabaseClient,
  callData: Omit<CapturedCall, 'id' | 'created_at'>
): Promise<CapturedCall | null> {
  const { data, error } = await supabase
    .from('captured_calls')
    .insert([callData])
    .select('*')
    .single();

  if (error) {
    console.error('Erro ao registrar captured_call:', error.message);
    return null;
  }

  return data as CapturedCall;
}

export async function recordSystemLog(
  supabase: SupabaseClient,
  logData: {
    tenant_id?: string | null;
    level: SystemLogLevel;
    event_type: string;
    message: string;
    details?: Record<string, unknown> | null;
  }
): Promise<SystemLog | null> {
  const { data, error } = await supabase
    .from('system_logs')
    .insert([logData])
    .select('*')
    .single();

  if (error) {
    console.error('Erro ao registrar system_log:', error.message);
    return null;
  }

  return data as SystemLog;
}
