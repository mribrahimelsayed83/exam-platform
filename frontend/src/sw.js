import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.skipWaiting();
self.addEventListener('activate', () => self.clients.claim());

// ── Web Push — shows an OS notification even if the app/tab isn't open ─────
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() || '' }; }

  const title = data.title || 'منصة إبراهيم فاروق';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      dir: 'rtl',
      lang: 'ar',
      data: { url: data.url || '/' },
    }).then(() => {
      // Best-effort app-icon badge bump while the app itself isn't open to
      // do the precise server-synced count (see AppBadgeSync.jsx) — approximate
      // via how many OS notifications are currently showing. Feature-detected;
      // a no-op wherever the Badging API isn't available in the SW context.
      if ('setAppBadge' in self.navigator) {
        self.registration.getNotifications().then((notifs) => {
          self.navigator.setAppBadge(notifs.length).catch(() => {});
        }).catch(() => {});
      }
    })
  );
});

// ── Clicking the notification focuses an open tab, or opens a new one ──────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => c.url.startsWith(self.location.origin));
      if (existing) {
        existing.focus();
        if ('navigate' in existing) existing.navigate(targetUrl);
        return;
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
