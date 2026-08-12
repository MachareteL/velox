import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth';
import { createAdminSupabaseClient } from '@/lib/admin/supabase';
import { AdminUserDetail } from '@/lib/admin/types';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAdmin(req);
    if (!authResult.isAdmin || authResult.errorResponse) {
      return authResult.errorResponse;
    }

    const tenantId = params.id;
    if (!tenantId) {
      return NextResponse.json(
        { error: 'ID de usuário/tenant é obrigatório.' },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();

    // 1. Busca Tenant
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (tenantErr || !tenant) {
      return NextResponse.json(
        { error: 'Usuário/tenant não encontrado.' },
        { status: 404 }
      );
    }

    // 2. Busca Sessão WhatsApp
    const { data: session } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    // 3. Busca Dispositivos Push
    const { data: pushSubscriptions } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    // 4. Busca Chamadas Capturadas (últimas 50)
    const { data: recentCalls } = await supabase
      .from('captured_calls')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(50);

    // 5. Busca Logs do Sistema (últimos 50)
    const { data: recentLogs } = await supabase
      .from('system_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(50);

    // 6. Calcula estatísticas desse tenant específico
    const calls = recentCalls || [];
    const totalCalls = calls.length;
    let successfulCalls = 0;
    let failedCalls = 0;
    let totalValueEstimate = 0;

    for (const call of calls) {
      if (call.status === 'SUCCESS') successfulCalls++;
      if (call.status === 'FAILED') failedCalls++;
      if (call.previa_valor) totalValueEstimate += Number(call.previa_valor);
    }

    const successRatePercentage =
      totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 10000) / 100 : 0;

    const userDetail: AdminUserDetail = {
      id: tenant.id,
      name: tenant.name || 'Sem nome',
      email: tenant.email,
      created_at: tenant.created_at,

      session: session
        ? {
            status: session.status,
            is_active: session.is_active !== false,
            qr_code: session.qr_code,
            phone_number: session.phone_number,
            pairing_code: session.pairing_code,
            worker_id: session.worker_id,
            updated_at: session.updated_at,
            created_at: session.created_at,
          }
        : null,

      pushSubscriptions: pushSubscriptions || [],
      recentCalls: calls,
      recentLogs: recentLogs || [],
      metrics: {
        totalCalls,
        successfulCalls,
        failedCalls,
        successRatePercentage,
        totalValueEstimate,
      },
    };

    return NextResponse.json({ success: true, user: userDetail });
  } catch (err: any) {
    console.error(`[API /api/admin/users/${params.id} GET] Erro:`, err);
    return NextResponse.json(
      { error: err?.message || 'Erro ao carregar detalhes do usuário.' },
      { status: 500 }
    );
  }
}
