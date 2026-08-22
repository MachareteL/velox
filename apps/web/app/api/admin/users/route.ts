import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth';
import { createAdminSupabaseClient } from '@/lib/admin/supabase';
import { AdminUserListItem } from '@/lib/admin/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdmin(req);
    if (!authResult.isAdmin || authResult.errorResponse) {
      return authResult.errorResponse;
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q')?.trim().toLowerCase() || '';
    const statusFilter = searchParams.get('status')?.trim() || '';

    const supabase = createAdminSupabaseClient();

    // 1. Busca todos os tenants
    let tenantsQuery = supabase.from('tenants').select('*').order('created_at', { ascending: false });

    if (query) {
      tenantsQuery = tenantsQuery.or(`name.ilike.%${query}%,email.ilike.%${query}%`);
    }

    const { data: tenants, error: tenantsErr } = await tenantsQuery;

    if (tenantsErr) {
      throw new Error(`Erro ao buscar tenants: ${tenantsErr.message}`);
    }

    if (!tenants || tenants.length === 0) {
      return NextResponse.json({ success: true, users: [] });
    }

    const tenantIds = tenants.map((t: any) => t.id);

    // 2. Busca sessões do WhatsApp para estes tenants
    const { data: sessions } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .in('tenant_id', tenantIds);

    const sessionsMap = new Map((sessions || []).map((s: any) => [s.tenant_id, s]));

    // 3. Busca contagem de chamadas por tenant
    const { data: calls } = await supabase
      .from('captured_calls')
      .select('tenant_id, status')
      .in('tenant_id', tenantIds);

    const callCountsMap = new Map<string, { total: number; success: number }>();
    if (calls) {
      for (const call of calls) {
        const current = callCountsMap.get(call.tenant_id) || { total: 0, success: 0 };
        current.total += 1;
        if (call.status === 'SUCCESS') current.success += 1;
        callCountsMap.set(call.tenant_id, current);
      }
    }

    // 4. Busca contagem de push_subscriptions por tenant
    const { data: pushSubs } = await supabase
      .from('push_subscriptions')
      .select('tenant_id')
      .in('tenant_id', tenantIds);

    const pushCountsMap = new Map<string, number>();
    if (pushSubs) {
      for (const sub of pushSubs) {
        pushCountsMap.set(sub.tenant_id, (pushCountsMap.get(sub.tenant_id) || 0) + 1);
      }
    }

    // 5. Busca último log por tenant
    const { data: logs } = await supabase
      .from('system_logs')
      .select('tenant_id, created_at')
      .in('tenant_id', tenantIds)
      .order('created_at', { ascending: false });

    const lastLogMap = new Map<string, string>();
    if (logs) {
      for (const log of logs) {
        if (log.tenant_id && !lastLogMap.has(log.tenant_id)) {
          lastLogMap.set(log.tenant_id, log.created_at);
        }
      }
    }

    // Consolidação da resposta
    const users: AdminUserListItem[] = tenants
      .map((tenant: any) => {
        const session: any = sessionsMap.get(tenant.id);
        const callStats = callCountsMap.get(tenant.id) || { total: 0, success: 0 };
        const pushCount = pushCountsMap.get(tenant.id) || 0;
        const lastLogAt = lastLogMap.get(tenant.id) || null;

        return {
          id: tenant.id,
          name: tenant.name || 'Sem nome',
          email: tenant.email,
          created_at: tenant.created_at,

          sessionStatus: session?.status || 'DISCONNECTED',
          isActiveAutomation: session?.is_active !== false,
          phoneNumber: session?.phone_number || null,
          workerId: session?.worker_id || null,
          updatedAtSession: session?.updated_at || null,

          totalCalls: callStats.total,
          successfulCalls: callStats.success,

          pushSubscriptionsCount: pushCount,
          lastLogAt,
        };
      })
      .filter((u: AdminUserListItem) => {
        if (!statusFilter) return true;
        return u.sessionStatus === statusFilter;
      });

    return NextResponse.json({ success: true, users });
  } catch (err: any) {
    console.error('[API /api/admin/users GET] Erro:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro ao listar usuários.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdmin(req);
    if (!authResult.isAdmin || authResult.errorResponse) {
      return authResult.errorResponse;
    }

    const body = await req.json();
    const { name, email, password, phoneNumber } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Nome do prestador/empresa é obrigatório.' },
        { status: 400 }
      );
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'E-mail corporativo válido é obrigatório.' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { error: 'A senha de acesso deve ter no mínimo 6 caracteres.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanPhone = phoneNumber ? phoneNumber.replace(/\D/g, '') : null;

    const supabase = createAdminSupabaseClient();

    // 1. Cria usuário no Supabase Auth com email confirmado imediatamente
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        name: cleanName,
      },
    });

    if (authErr || !authData?.user) {
      console.error('[API /api/admin/users POST] Erro ao criar usuário no Supabase Auth:', authErr);
      return NextResponse.json(
        { error: authErr?.message || 'Falha ao criar usuário no provedor de autenticação.' },
        { status: 400 }
      );
    }

    const createdUser = authData.user;

    // 2. Garante persistência na tabela tenants
    const { data: tenantData, error: tenantErr } = await supabase
      .from('tenants')
      .upsert(
        {
          id: createdUser.id,
          name: cleanName,
          email: cleanEmail,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      .select('*')
      .single();

    if (tenantErr) {
      console.error('[API /api/admin/users POST] Erro ao inserir na tabela tenants:', tenantErr);
    }

    // 3. Garante inicialização da sessão de WhatsApp
    const { error: sessionErr } = await supabase
      .from('whatsapp_sessions')
      .upsert(
        {
          tenant_id: createdUser.id,
          status: 'DISCONNECTED',
          is_active: true,
          phone_number: cleanPhone,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id' }
      );

    if (sessionErr) {
      console.error('[API /api/admin/users POST] Erro ao inicializar sessão WhatsApp:', sessionErr);
    }

    // 4. Registra log de auditoria
    await supabase.from('system_logs').insert({
      tenant_id: createdUser.id,
      level: 'INFO',
      event_type: 'ADMIN_USER_CREATED',
      message: `Novo prestador cadastrado manualmente pelo administrador: ${cleanName} (${cleanEmail})`,
      details: {
        adminId: authResult.user?.id,
        createdTenantId: createdUser.id,
        email: cleanEmail,
        phoneNumber: cleanPhone,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: createdUser.id,
        name: cleanName,
        email: cleanEmail,
        created_at: tenantData?.created_at || createdUser.created_at,
      },
    });
  } catch (err: any) {
    console.error('[API /api/admin/users POST] Erro crítico:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao cadastrar novo usuário.' },
      { status: 500 }
    );
  }
}
