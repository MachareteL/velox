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
    const level = searchParams.get('level');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const supabase = createAdminSupabaseClient();
    let query = supabase
      .from('system_logs')
      .select('*, tenant:tenants(id, name, email)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }
    if (level) {
      query = query.eq('level', level);
    }

    const { data: logs, error } = await query;
    if (error) {
      throw new Error(`Erro ao buscar logs: ${error.message}`);
    }

    return NextResponse.json({ success: true, logs: logs || [] });
  } catch (err: any) {
    console.error('[API /api/admin/logs GET] Erro:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro ao carregar logs.' },
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
    const allParam = searchParams.get('all') === 'true';

    let bodyIds: string[] = [];
    let bodyTenantId: string | undefined;

    try {
      const body = await req.json();
      if (body?.id) bodyIds.push(body.id);
      if (Array.isArray(body?.ids)) bodyIds.push(...body.ids);
      if (body?.tenantId) bodyTenantId = body.tenantId;
    } catch {
      // Body opcional
    }

    if (idParam) bodyIds.push(idParam);
    const finalTenantId = tenantIdParam || bodyTenantId;

    const supabase = createAdminSupabaseClient();

    if (bodyIds.length > 0) {
      const { error } = await supabase
        .from('system_logs')
        .delete()
        .in('id', bodyIds);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: `${bodyIds.length} log(s) excluído(s) com sucesso.`,
      });
    }

    if (finalTenantId) {
      const { error } = await supabase
        .from('system_logs')
        .delete()
        .eq('tenant_id', finalTenantId);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: 'Logs do prestador excluídos com sucesso.',
      });
    }

    if (allParam) {
      const { error } = await supabase
        .from('system_logs')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Deleta todos

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: 'Todos os logs do sistema foram limpos.',
      });
    }

    return NextResponse.json(
      { error: 'Especifique o ID do log, tenantId ou parâmetro all=true para exclusão.' },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('[API /api/admin/logs DELETE] Erro:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro ao excluir logs.' },
      { status: 500 }
    );
  }
}
