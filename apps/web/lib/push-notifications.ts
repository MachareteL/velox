import { supabase } from './supabase';

const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isIOSDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.warn('[PushNotifications] Service Worker não é suportado neste navegador.');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    return registration;
  } catch (err) {
    console.error('[PushNotifications] Falha ao registrar Service Worker:', err);
    return null;
  }
}

export async function getPushSubscriptionStatus() {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return {
      supported: false,
      permission: 'denied' as NotificationPermission,
      isSubscribed: false,
      subscription: null,
      isIOS: isIOSDevice(),
      isPWAInstalled: isStandalonePWA(),
    };
  }

  const permission = Notification.permission;
  const registration = await registerServiceWorker();
  const subscription = registration ? await registration.pushManager.getSubscription() : null;

  return {
    supported: true,
    permission,
    isSubscribed: !!subscription,
    subscription,
    isIOS: isIOSDevice(),
    isPWAInstalled: isStandalonePWA(),
  };
}

export async function subscribeUserToPush(tenantId: string) {
  if (!VAPID_PUBLIC_KEY) {
    throw new Error(
      'Chave pública VAPID (NEXT_PUBLIC_VAPID_PUBLIC_KEY) não está configurada no .env!'
    );
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
    throw new Error('Notificações não são suportadas neste navegador.');
  }

  // 1. Solicita permissão se ainda não foi dada
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permissão de notificação negada pelo usuário.');
  }

  // 2. Garante registro do Service Worker
  const registration = await registerServiceWorker();
  if (!registration) {
    throw new Error('Falha ao obter registro do Service Worker.');
  }

  // 3. Subscreve via PushManager
  const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });


  const subJson = subscription.toJSON();
  const endpoint = subJson.endpoint;
  const p256dh = subJson.keys?.p256dh;
  const auth = subJson.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    throw new Error('Chaves de subscrição inválidas geradas pelo navegador.');
  }

  // 4. Obtém o token JWT da sessão atual do Supabase
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  // 5. Salva a subscription no backend via Rota de API Next.js
  const res = await fetch('/api/push/subscription', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      tenantId,
      endpoint,
      keys: { p256dh, auth },
      userAgent: navigator.userAgent,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Falha ao registrar subscrição no backend.');
  }

  return { success: true, subscription };
}

export async function unsubscribeUserFromPush() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    const endpoint = subscription.endpoint;

    // Cancela a subscrição no navegador
    await subscription.unsubscribe();

    // Remove do backend
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    await fetch('/api/push/subscription', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ endpoint }),
    });
  }

  return { success: true };
}
