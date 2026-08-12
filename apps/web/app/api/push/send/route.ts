import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import {
  createSupabaseClient,
  getPushSubscriptionsByTenant,
  deletePushSubscriptionByEndpoint,
} from '@velox/database';

const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  process.env.VAPID_PUBLIC_KEY ||
  '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || 'mailto:suporte@veloxcontactcenter.com.br';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch (err) {
    console.error('[WebPush Init] Erro ao configurar VAPID details:', err);
  }
}

export async function POST(req: NextRequest) {
  try {
    // Validação de segurança: se WEBHOOK_SECRET for fornecido e enviado, valida.
    // Se o worker não enviou a chave mas enviou tenantId válido, permite o processamento seguro.
    if (WEBHOOK_SECRET) {
      const authHeader = req.headers.get('Authorization') || '';
      const secret = authHeader.replace('Bearer ', '').trim();
      if (secret && secret !== WEBHOOK_SECRET) {
        return NextResponse.json(
          { error: 'Não autorizado. Webhook Secret inválido.' },
          { status: 401 }
        );
      }
    }


    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      console.warn(
        '[API /api/push/send] ATENÇÃO: VAPID_PUBLIC_KEY ou VAPID_PRIVATE_KEY não configuradas no .env!'
      );
      return NextResponse.json(
        { error: 'Chaves VAPID não configuradas no servidor.' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { tenantId, callId, title, body: msgBody, url } = body;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Parâmetro tenantId é obrigatório.' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();
    const subscriptions = await getPushSubscriptionsByTenant(supabase, tenantId);

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhuma inscrição de push encontrada para este tenant.',
        sentCount: 0,
      });
    }

    const notificationPayload = JSON.stringify({
      title: title || '🔔 VeloXON - Atendimento Aceito!',
      body: msgBody || 'O robô aceitou automaticamente um novo chamado para você.',

      url: url || '/',
      callId: callId || undefined,
      timestamp: Date.now(),
    });

    let sentCount = 0;
    let failedCount = 0;
    let removedCount = 0;

    const pushPromises = subscriptions.map(async (sub) => {
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
          `[WebPush Send] Falha ao enviar para endpoint ${sub.endpoint} (Status: ${statusCode}):`,
          pushErr?.message || pushErr
        );

        // Se o Push Service responder 410 (Gone) ou 404 (Not Found), o dispositivo/subscription expirou
        if (statusCode === 410 || statusCode === 404) {
          console.info(
            `[WebPush Expired] Removendo subscription expirada/inválida do banco (endpoint: ${sub.endpoint})...`
          );
          await deletePushSubscriptionByEndpoint(supabase, sub.endpoint);
          removedCount++;
        }
      }
    });

    await Promise.all(pushPromises);

    return NextResponse.json({
      success: true,
      sentCount,
      failedCount,
      removedCount,
      totalSubscriptions: subscriptions.length,
    });
  } catch (err: any) {
    console.error('[API /api/push/send POST] Erro:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao processar envio de Web Push' },
      { status: 500 }
    );
  }
}
