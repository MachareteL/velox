import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth';
import { createAdminSupabaseClient } from '@/lib/admin/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdmin(req);
    if (!authResult.isAdmin || authResult.errorResponse) {
      return authResult.errorResponse;
    }

    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const supabase = createAdminSupabaseClient();
    let query = supabase
      .from('captured_calls')
      .select('*, tenant:tenants(id, name, email)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data: calls, error } = await query;
    if (error) {
      throw new Error(`Erro ao buscar chamados: ${error.message}`);
    }

    return NextResponse.json({ success: true, calls: calls || [] });
  } catch (err: any) {
    console.error('[API /api/admin/calls GET] Erro:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro ao carregar chamados.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authResult = await requireAdmin(req);
    if (!authResult.isAdmin || authResult.errorResponse) {
      return authResult.errorResponse;
    }

    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get('id');
    const tenantIdParam = searchParams.get('tenantId');

    let bodyIds: string[] = [];
    let bodyTenantId: string | undefined;

    try {
      const body = await req.json();
      if (body?.id) bodyIds.push(body.id);
      if (Array.isArray(body?.ids)) bodyIds.push(...body.ids);
      if (body?.tenantId) bodyTenantId = body.tenantId;
    } catch {
      // Body é opcional se os parâmetros vierem pela URL
    }

    if (idParam) bodyIds.push(idParam);
    const finalTenantId = tenantIdParam || bodyTenantId;

    const supabase = createAdminSupabaseClient();

    if (bodyIds.length > 0) {
      const { error } = await supabase
        .from('captured_calls')
        .delete()
        .in('id', bodyIds);

      if (error) throw error;

      await supabase.from('system_logs').insert({
        level: 'INFO',
        event_type: 'ADMIN_CALLS_DELETED',
        message: `${bodyIds.length} registro(s) de chamado(s) excluído(s) pelo administrador.`,
        details: { adminId: authResult.user?.id, deletedCallIds: bodyIds },
      });

      return NextResponse.json({
        success: true,
        message: `${bodyIds.length} chamado(s) excluído(s) com sucesso.`,
      });
    }

    if (finalTenantId) {
      const { error } = await supabase
        .from('captured_calls')
        .delete()
        .eq('tenant_id', finalTenantId);

      if (error) throw error;

      await supabase.from('system_logs').insert({
        tenant_id: finalTenantId,
        level: 'INFO',
        event_type: 'ADMIN_TENANT_CALLS_CLEARED',
        message: `Histórico de chamados do tenant ${finalTenantId} limpo pelo administrador.`,
        details: { adminId: authResult.user?.id, tenantId: finalTenantId },
      });

      return NextResponse.json({
        success: true,
        message: 'Histórico de chamados do prestador limpo com sucesso.',
      });
    }

    return NextResponse.json(
      { error: 'Especifique o ID do chamado ou o tenantId para exclusão.' },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('[API /api/admin/calls DELETE] Erro:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro ao excluir chamado(s).' },
      { status: 500 }
    );
  }
}
