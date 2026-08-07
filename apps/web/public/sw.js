/**
 * Push service worker. Deliberately minimal — its only job is turning a
 * server-sent push payload into an OS notification, and turning a tap on
 * that notification into a focused (or newly opened) app tab. No caching,
 * no offline strategy; this repo isn't trying to be a full PWA.
 */

self.addEventListener('push', (event) => {
  let payload = { title: 'SPECARE', body: 'You have a new update.' };
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { title: 'SPECARE', body: event.data.text() };
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      data: payload.data ?? {},
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = '/today';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    }),
  );
});
