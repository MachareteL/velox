import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { requireAdmin } from '@/lib/admin/auth';
import { createAdminSupabaseClient } from '@/lib/admin/supabase';

export const dynamic = 'force-dynamic';

const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  process.env.VAPID_PUBLIC_KEY ||
  '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || 'mailto:suporte@veloxcontactcenter.com.br';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch (err) {
    console.error('[Admin WebPush Init] Erro ao configurar VAPID details:', err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdmin(req);
    if (!authResult.isAdmin || authResult.errorResponse) {
      return authResult.errorResponse;
    }

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return NextResponse.json(
        { error: 'Chaves VAPID não configuradas no servidor.' },
        { status: 500 }
      );
    }

    const payload = await req.json();
    const { targetTenantId, title, body: msgBody } = payload;

    if (!targetTenantId) {
      return NextResponse.json(
        { error: 'O parâmetro targetTenantId é obrigatório.' },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();

    // Busca as inscrições Push do tenant especificado
    const { data: subscriptions, error: subErr } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('tenant_id', targetTenantId);

    if (subErr) {
      throw new Error(`Erro ao consultar subscriptions: ${subErr.message}`);
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Nenhum dispositivo com Push Notification cadastrado para este usuário.',
        sentCount: 0,
        failedCount: 0,
        removedCount: 0,
        totalSubscriptions: 0,
      });
    }

    const notificationPayload = JSON.stringify({
      title: title || '🔔 Teste VeloXON',
      body: msgBody || 'Esta é uma notificação de teste enviada pelo administrador.',
      url: '/',
      timestamp: Date.now(),
    });

    let sentCount = 0;
    let failedCount = 0;
    let removedCount = 0;

    const pushPromises = subscriptions.map(async (sub: any) => {
      const pushSub = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushSub, notificationPayload);
        sentCount++;
      } catch (pushErr: any) {
        failedCount++;
        const statusCode = pushErr?.statusCode;
        console.error(
          `[Admin Push Test] Falha ao enviar para endpoint ${sub.endpoint} (Status: ${statusCode}):`,
          pushErr?.message || pushErr
        );

        if (statusCode === 410 || statusCode === 404) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint);
          removedCount++;
        }
      }
    });

    await Promise.all(pushPromises);

    // Registra log administrativo de auditoria
    await supabase.from('system_logs').insert([
      {
        tenant_id: targetTenantId,
        level: 'INFO',
        event_type: 'ADMIN_TEST_PUSH',
        message: `Admin (${authResult.user?.email}) enviou notificação Web Push de teste. Enviados: ${sentCount}, Falhas: ${failedCount}`,
        details: {
          adminUserId: authResult.user?.id,
          sentCount,
          failedCount,
          removedCount,
          totalSubscriptions: subscriptions.length,
        },
      },
    ]);

    return NextResponse.json({
      success: true,
      sentCount,
      failedCount,
      removedCount,
      totalSubscriptions: subscriptions.length,
      message: `Push enviado com sucesso para ${sentCount} dispositivo(s).`,
    });
  } catch (err: any) {
    console.error('[API /api/admin/notifications/test POST] Erro:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao processar teste de Web Push.' },
      { status: 500 }
    );
  }
}
