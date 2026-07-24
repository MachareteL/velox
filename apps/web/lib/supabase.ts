import { createSupabaseClient } from '@velox/database';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mirwwmcykalshpfangbd.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pcnd3bWN5a2Fsc2hwZmFuZ2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4NDk2NjIsImV4cCI6MjEwMDQyNTY2Mn0.M5HpVaG8EvXNK0YY-kHJuZEm3Hr0V95HPNE3CMy5ezI';

export const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
export const DEFAULT_SESSION_ID = '00000000-0000-0000-0000-000000000001';
