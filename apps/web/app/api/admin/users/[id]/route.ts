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
    let totalPreviaMinutes = 0;
    let previaCount = 0;
    let totalDistanceKm = 0;
    let distanceCount = 0;

    for (const call of calls) {
      if (call.status === 'SUCCESS') successfulCalls++;
      if (call.status === 'FAILED') failedCalls++;

      const previa = call.previa_minutos !== null && call.previa_minutos !== undefined
        ? Number(call.previa_minutos)
        : call.previa_valor !== null && call.previa_valor !== undefined
        ? Number(call.previa_valor)
        : null;

      if (previa !== null && !isNaN(previa) && previa > 0) {
        totalPreviaMinutes += previa;
        previaCount++;
      }

      if (call.distancia_km !== null && call.distancia_km !== undefined) {
        const dist = Number(call.distancia_km);
        if (!isNaN(dist) && dist > 0) {
          totalDistanceKm += dist;
          distanceCount++;
        }
      }
    }

    const avgPreviaMinutes = previaCount > 0 ? Math.round(totalPreviaMinutes / previaCount) : 0;
    const avgDistanceKm = distanceCount > 0 ? Math.round((totalDistanceKm / distanceCount) * 10) / 10 : 0;

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
        avgPreviaMinutes,
        avgDistanceKm,
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

export async function DELETE(
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

    const currentAdminId = authResult.user?.id;
    const adminConfigId = process.env.ADMIN_USER_ID;

    // Proteção contra auto-exclusão do administrador
    if (tenantId === currentAdminId || tenantId === adminConfigId) {
      return NextResponse.json(
        { error: 'Não é permitido excluir a própria conta de administrador.' },
        { status: 403 }
      );
    }

    const supabase = createAdminSupabaseClient();

    // 1. Busca dados do tenant antes de excluir para auditoria
    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('id, name, email')
      .eq('id', tenantId)
      .maybeSingle();

    // 2. Exclusão em cascata explícita de todas as tabelas relacionadas
    await supabase.from('captured_calls').delete().eq('tenant_id', tenantId);
    await supabase.from('system_logs').delete().eq('tenant_id', tenantId);
    await supabase.from('push_subscriptions').delete().eq('tenant_id', tenantId);
    await supabase.from('vehicles').delete().eq('tenant_id', tenantId);
    await supabase.from('whatsapp_sessions').delete().eq('tenant_id', tenantId);
    await supabase.from('tenants').delete().eq('id', tenantId);

    // 3. Exclui a conta do usuário no Supabase Auth
    const { error: authDeleteErr } = await supabase.auth.admin.deleteUser(tenantId);
    if (authDeleteErr) {
      console.warn(
        `[API /api/admin/users/${tenantId} DELETE] Aviso ao excluir do Supabase Auth:`,
        authDeleteErr.message
      );
    }

    // 4. Registra log global de auditoria da exclusão
    await supabase.from('system_logs').insert({
      level: 'WARN',
      event_type: 'ADMIN_USER_DELETED',
      message: `Usuário/tenant excluído permanentemente pelo administrador: ${existingTenant?.name || tenantId} (${existingTenant?.email || 'N/A'})`,
      details: {
        adminId: currentAdminId,
        deletedTenantId: tenantId,
        deletedName: existingTenant?.name,
        deletedEmail: existingTenant?.email,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Usuário e todos os registros associados foram excluídos com sucesso.',
    });
  } catch (err: any) {
    console.error(`[API /api/admin/users/${params.id} DELETE] Erro:`, err);
    return NextResponse.json(
      { error: err?.message || 'Erro ao excluir usuário.' },
      { status: 500 }
    );
  }
}
