/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

// Precache manifest injection point for vite-plugin-pwa (injectManifest)
precacheAndRoute(self.__WB_MANIFEST);

/**
 * Push notification payload structure
 */
interface PushPayload {
  type: 'invite' | 'chat' | 'join';
  title: string;
  body: string;
  roomId: string;
  tag?: string;
}

/**
 * push イベント: プッシュ通知の受信と表示
 * Requirements: 2.4
 */
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;

  const data: PushPayload = event.data.json();

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/web_rtc/icons/icon-192x192.png',
      tag: data.tag || data.roomId,
      data: { roomId: data.roomId, type: data.type },
    })
  );
});

/**
 * notificationclick イベント: 通知タップ時のナビゲーション
 * Requirements: 2.5
 */
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const { roomId } = event.notification.data as { roomId: string };
  const url = `/web_rtc/room/${roomId}`;

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((windowClients) => {
      // 既に開いているタブがあればフォーカス
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      // なければ新しいタブで開く
      return self.clients.openWindow(url);
    })
  );
});
