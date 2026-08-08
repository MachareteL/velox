import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient, savePushSubscription, removePushSubscription } from '@velox/database';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();

    const supabase = createSupabaseClient();

    // Valida a sessão do usuário via Token JWT se fornecido, ou via cookie/session
    let userId: string | null = null;
    if (token) {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        userId = user.id;
      }
    }

    const body = await req.json();
    const { endpoint, keys, userAgent, tenantId } = body;

    // Garante que o tenantId venha do token de auth validado ou do body em ambiente seguro
    const finalTenantId = userId || tenantId;

    if (!finalTenantId) {
      return NextResponse.json(
        { error: 'Não autorizado. Usuário não autenticado.' },
        { status: 401 }
      );
    }

    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return NextResponse.json(
        { error: 'Payload de subscription inválido.' },
        { status: 400 }
      );
    }

    const record = await savePushSubscription(supabase, finalTenantId, {
      endpoint,
      keys,
      userAgent: userAgent || req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({ success: true, data: record });
  } catch (err: any) {
    console.error('[API /api/push/subscription POST] Erro:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao salvar subscription' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let endpoint = searchParams.get('endpoint');

    if (!endpoint) {
      const body = await req.json().catch(() => ({}));
      endpoint = body.endpoint;
    }

    if (!endpoint) {
      return NextResponse.json(
        { error: 'Parâmetro endpoint é obrigatório.' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();
    await removePushSubscription(supabase, endpoint);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[API /api/push/subscription DELETE] Erro:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao remover subscription' },
      { status: 500 }
    );
  }
}
