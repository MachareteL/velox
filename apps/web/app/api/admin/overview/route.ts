import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth';
import { createAdminSupabaseClient } from '@/lib/admin/supabase';
import { AdminOverviewMetrics } from '@/lib/admin/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdmin(req);
    if (!authResult.isAdmin || authResult.errorResponse) {
      return authResult.errorResponse;
    }

    const supabase = createAdminSupabaseClient();
    const now = new Date();
    const date7DaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const date30DaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Métricas de Tenants / Usuários
    const { count: totalUsers } = await supabase
      .from('tenants')
      .select('*', { count: 'exact', head: true });

    const { count: newUsersLast7Days } = await supabase
      .from('tenants')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', date7DaysAgo);

    const { count: newUsersLast30Days } = await supabase
      .from('tenants')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', date30DaysAgo);

    // 2. Métricas de Sessões WhatsApp
    const { count: connectedSessions } = await supabase
      .from('whatsapp_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'CONNECTED');

    const { count: disconnectedSessions } = await supabase
      .from('whatsapp_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'DISCONNECTED');

    const { count: needQrSessions } = await supabase
      .from('whatsapp_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'DISCONNECTED_NEED_QR');

    const { count: activeAutomations } = await supabase
      .from('whatsapp_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // 3. Métricas de Chamados / Capturas
    const { count: totalCalls } = await supabase
      .from('captured_calls')
      .select('*', { count: 'exact', head: true });

    const { count: successfulCalls } = await supabase
      .from('captured_calls')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'SUCCESS');

    const { count: failedCalls } = await supabase
      .from('captured_calls')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'FAILED');

    // Cálculos de agregados financeiros e tempos das chamadas
    const { data: callStatsData } = await supabase
      .from('captured_calls')
      .select('duration_ms, previa_valor');

    let totalDurationMs = 0;
    let totalValueEstimate = 0;
    const callCount = callStatsData?.length || 0;

    if (callStatsData) {
      for (const call of callStatsData) {
        if (call.duration_ms) totalDurationMs += Number(call.duration_ms);
        if (call.previa_valor) totalValueEstimate += Number(call.previa_valor);
      }
    }

    const avgDurationMs = callCount > 0 ? Math.round(totalDurationMs / callCount) : 0;
    const totCalls = totalCalls || 0;
    const succCalls = successfulCalls || 0;
    const successRatePercentage = totCalls > 0 ? Math.round((succCalls / totCalls) * 10000) / 100 : 0;

    // 4. Métricas de Web Push
    const { count: totalPushSubscriptions } = await supabase
      .from('push_subscriptions')
      .select('*', { count: 'exact', head: true });

    const { data: uniquePushTenants } = await supabase
      .from('push_subscriptions')
      .select('tenant_id');

    const uniqueTenantsSet = new Set((uniquePushTenants || []).map((p: any) => p.tenant_id));

    // 5. Logs de Erro Recentes
    const { count: recentErrorLogsCount } = await supabase
      .from('system_logs')
      .select('*', { count: 'exact', head: true })
      .eq('level', 'ERROR')
      .gte('created_at', date7DaysAgo);

    const metrics: AdminOverviewMetrics = {
      totalUsers: totalUsers || 0,
      newUsersLast7Days: newUsersLast7Days || 0,
      newUsersLast30Days: newUsersLast30Days || 0,

      connectedSessions: connectedSessions || 0,
      disconnectedSessions: disconnectedSessions || 0,
      needQrSessions: needQrSessions || 0,
      activeAutomations: activeAutomations || 0,

      totalCalls: totCalls,
      successfulCalls: succCalls,
      failedCalls: failedCalls || 0,
      successRatePercentage,
      avgDurationMs,
      totalValueEstimate,

      totalPushSubscriptions: totalPushSubscriptions || 0,
      usersWithPushCount: uniqueTenantsSet.size,

      recentErrorLogsCount: recentErrorLogsCount || 0,
    };

    return NextResponse.json({ success: true, metrics });
  } catch (err: any) {
    console.error('[API /api/admin/overview GET] Erro:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro ao carregar visão geral do admin.' },
      { status: 500 }
    );
  }
}
