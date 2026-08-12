import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@velox/database';
import { User } from '@supabase/supabase-js';

export interface AdminAuthResult {
  user: User | null;
  isAdmin: boolean;
  errorResponse?: NextResponse;
}

/**
 * Valida se a requisição provém de um usuário autenticado e cujo ID é idêntico ao ADMIN_USER_ID.
 * 
 * @param req Objeto NextRequest recebido no Route Handler
 * @returns AdminAuthResult contendo o usuário e flag de permissão
 */
export async function requireAdmin(req: NextRequest): Promise<AdminAuthResult> {
  const adminUserId = process.env.ADMIN_USER_ID || '';

  // Tenta extrair o token do Header Authorization: Bearer <token>
  const authHeader = req.headers.get('Authorization') || '';
  let token = authHeader.replace(/^Bearer\s+/i, '').trim();

  // Se não estiver no header, tenta extrair dos cookies do Supabase
  if (!token) {
    const authCookie =
      req.cookies.get('sb-access-token')?.value ||
      req.cookies.get('supabase-auth-token')?.value;

    if (authCookie) {
      try {
        const parsed = JSON.parse(authCookie);
        token = parsed?.[0] || parsed?.access_token || authCookie;
      } catch {
        token = authCookie;
      }
    }
  }

  // Se mesmo assim não houver token, tenta buscar token de outros nomes de cookies comuns do Supabase
  if (!token) {
    for (const cookie of req.cookies.getAll()) {
      if (cookie.name.includes('auth-token') || cookie.name.includes('access-token')) {
        try {
          const parsed = JSON.parse(cookie.value);
          token = parsed?.[0] || parsed?.access_token || cookie.value;
          if (token) break;
        } catch {
          token = cookie.value;
          break;
        }
      }
    }
  }

  if (!token) {
    return {
      user: null,
      isAdmin: false,
      errorResponse: NextResponse.json(
        { error: 'Não autorizado.' },
        { status: 401 }
      ),
    };
  }

  const supabase = createSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return {
      user: null,
      isAdmin: false,
      errorResponse: NextResponse.json(
        { error: 'Sessão inválida ou expirada.' },
        { status: 401 }
      ),
    };
  }

  if (!adminUserId) {
    console.warn(
      '[requireAdmin] ATENÇÃO: ADMIN_USER_ID não está configurada no arquivo de ambiente (.env)! Acesso administrativo negado por padrão.'
    );
    return {
      user,
      isAdmin: false,
      errorResponse: NextResponse.json(
        { error: 'Acesso negado.' },
        { status: 403 }
      ),
    };
  }

  if (user.id !== adminUserId) {
    return {
      user,
      isAdmin: false,
      errorResponse: NextResponse.json(
        { error: 'Acesso negado.' },
        { status: 403 }
      ),
    };
  }

  return {
    user,
    isAdmin: true,
  };
}
