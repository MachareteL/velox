import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  CapturedCall,
  SystemLog,
  SystemLogLevel,
  Vehicle,
  WhatsAppSession,
  WhatsAppSessionStatus,
} from '@velox/types';

export function createSupabaseClient(
  supabaseUrl?: string,
  supabaseKey?: string
): SupabaseClient {
  const url = supabaseUrl || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const key = supabaseKey || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

  return createClient(url, key);
}

export async function updateSessionStatus(
  supabase: SupabaseClient,
  sessionIdOrTenantId: string,
  status: WhatsAppSessionStatus,
  qrCode?: string | null,
  workerId?: string | null,
  pairingCode?: string | null,
  phoneNumber?: string | null
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
  if (pairingCode !== undefined) {
    updateData.pairing_code = pairingCode;
  }
  if (phoneNumber !== undefined) {
    updateData.phone_number = phoneNumber;
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

export async function requestPhonePairingCode(
  supabase: SupabaseClient,
  tenantId: string,
  phoneNumber: string
): Promise<WhatsAppSession | null> {
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  const { data, error } = await supabase
    .from('whatsapp_sessions')
    .update({
      phone_number: cleanPhone,
      pairing_code: null,
      qr_code: null,
      status: 'DISCONNECTED_NEED_QR',
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('Erro ao solicitar pairing_code:', error.message);
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

export async function completeCapturedCall(
  supabase: SupabaseClient,
  callId: string
): Promise<CapturedCall | null> {
  const { data, error } = await supabase
    .from('captured_calls')
    .update({
      completed_at: new Date().toISOString(),
    })
    .eq('id', callId)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('Erro ao finalizar chamado:', error.message);
    return null;
  }

  return data as CapturedCall;
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
