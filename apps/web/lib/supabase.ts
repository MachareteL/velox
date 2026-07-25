import { createSupabaseClient } from '@velox/database';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[Supabase] ATENÇÃO: As variáveis NEXT_PUBLIC_SUPABASE_URL e/ou NEXT_PUBLIC_SUPABASE_ANON_KEY não estão definidas!');
}

export const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
export const DEFAULT_SESSION_ID = '00000000-0000-0000-0000-000000000001';
