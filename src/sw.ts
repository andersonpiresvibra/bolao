/// <reference lib="webworker" />

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<string | { url: string; revision: string | null }>;
};

self.skipWaiting();
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);

// Cache Google Fonts stylesheets & font files
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts-stylesheets',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  })
);

registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  })
);

// Cache Caixa lottery stats for offline availability (never cache auth/payments/state)
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' && url.pathname.startsWith('/api/lottery-stats/'),
  new StaleWhileRevalidate({
    cacheName: 'lottery-stats-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 }),
    ],
  })
);

// Handle incoming Web Push messages even when app is closed or in background
self.addEventListener('push', (event: PushEvent) => {
  let payload: {
    title?: string;
    body?: string;
    url?: string;
    tag?: string;
  } = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }

  const title = payload.title || 'Bolão & Loterias';
  const body =
    payload.body || 'Há uma nova atualização no seu bolão.';
  const targetUrl =
    typeof payload.url === 'string' && payload.url.startsWith('/')
      ? payload.url
      : '/';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: payload.tag || 'bolao-notification',
      data: { url: targetUrl },
    })
  );
});

// Focus or open app when user taps a push notification
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const rawUrl = event.notification.data?.url;
  const safePath =
    typeof rawUrl === 'string' && rawUrl.startsWith('/') ? rawUrl : '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow(safePath);
      })
  );
});

async function refreshLotteryResultsInBackground(): Promise<void> {
  const endpoints = ['/api/lottery-stats/MEGA_SENA', '/api/lottery-stats/LOTOFACIL'];
  const cache = await caches.open('lottery-stats-cache');
  await Promise.all(
    endpoints.map(async (ep) => {
      try {
        const resp = await fetch(ep, { cache: 'no-store' });
        if (resp.ok) {
          await cache.put(ep, resp.clone());
        }
      } catch {
        // Offline or unreachable — keep existing cached stats
      }
    })
  );

  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const win of windows) {
    win.postMessage({ type: 'LOTTERY_SYNC_DONE', timestamp: Date.now() });
  }
}

// One-off Background Sync (when connectivity returns)
self.addEventListener('sync', (event: any) => {
  if (event.tag === 'sync-lottery-results') {
    event.waitUntil(refreshLotteryResultsInBackground());
  }
});

// Periodic Background Sync (supported Chromium PWAs)
self.addEventListener('periodicsync', (event: any) => {
  if (event.tag === 'periodic-lottery-sync') {
    event.waitUntil(refreshLotteryResultsInBackground());
  }
});
