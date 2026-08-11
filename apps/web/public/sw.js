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

/** Where a tap should land, by notification type — the daily check-in
 * reminder goes straight to the form; every other kind (a friend stepping
 * up, a voice note, a distress alert) lands on Today, where those surface. */
function targetUrlFor(data) {
  return data && data.type === 'sper_prompt' ? '/checkin' : '/today';
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = targetUrlFor(event.notification.data);
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = clientsList[0];
      if (existing) {
        if ('navigate' in existing) {
          try {
            await existing.navigate(targetUrl);
          } catch {
            // Some browsers restrict navigating an existing client — it'll
            // just stay on whatever page it already had, still focused.
          }
        }
        return existing.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })(),
  );
});
