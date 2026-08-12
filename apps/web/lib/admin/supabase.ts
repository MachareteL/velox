import 'server-only';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedAdminClient: SupabaseClient | null = null;

/**
 * Cria e retorna um client Supabase privilegiado com a Service Role Key / Secret Key.
 * Este client ignora as políticas de RLS e NUNCA deve ser exportado ou acessado no client-side.
 */
export function createAdminSupabaseClient(): SupabaseClient {
  if (cachedAdminClient) {
    return cachedAdminClient;
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    '';

  const secretKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    '';

  if (!supabaseUrl) {
    throw new Error('[Admin Supabase] SUPABASE_URL não está configurada.');
  }

  if (!secretKey) {
    console.warn(
      '[Admin Supabase] ATENÇÃO: SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY não foi encontrada nas variáveis de ambiente. Consultas administrativas globais podem ser bloqueadas pelo RLS.'
    );
  }

  // Se secretKey estiver vazia em dev sem env configurada, usa a anon key fallback apenas para não crashar, mas avisa
  const keyToUse =
    secretKey ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    '';

  cachedAdminClient = createClient(supabaseUrl, keyToUse, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedAdminClient;
}
