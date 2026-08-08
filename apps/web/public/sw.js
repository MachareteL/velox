/* eslint-disable no-restricted-globals */

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Instalado com sucesso.');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Ativado e pronto.');
  event.waitUntil(self.clients.claim());
});

// Escuta o evento 'push' enviado pelos servidores VAPID
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Evento de Push recebido!');

  if (!event.data) {
    console.warn('[Service Worker] Push recebido sem payload.');
    return;
  }

  try {
    const data = event.data.json();
    const title = data.title || '🔔 Velox - Atendimento Aceito!';
    const options = {
      body: data.body || 'O robô aceitou automaticamente um novo chamado para você.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [300, 100, 300, 100, 300],
      tag: data.callId || 'velox-call-notification',
      renotify: true,
      requireInteraction: true,
      data: {
        url: data.url || '/',
        callId: data.callId,
        timestamp: data.timestamp || Date.now(),
      },
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('[Service Worker] Erro ao parsear payload do Push:', err);
  }
});

// Trata o clique do usuário na notificação nativa do SO
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
