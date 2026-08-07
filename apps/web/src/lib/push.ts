import { api } from '../api/client';

/** Whether this browser can even do push notifications. Older Safari and any
 * non-secure (non-HTTPS, non-localhost) origin fail this. */
export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** VAPID public keys are base64url; the Push API wants a raw byte array. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  return (await navigator.serviceWorker.getRegistration()) ?? navigator.serviceWorker.register('/sw.js');
}

export type PushStatus = 'unsupported' | 'default' | 'denied' | 'subscribed';

/** Current state of browser push for the Settings screen — never prompts. */
export async function getPushStatus(): Promise<PushStatus> {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'default';
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  return subscription ? 'subscribed' : 'default';
}

/**
 * Registers the current push subscription (if this browser already has one)
 * against the signed-in account. Never prompts for permission — this is the
 * quiet "keep the server's record pointed at whoever's logged in right now"
 * path, called on every login so a shared browser re-points an existing
 * subscription instead of silently pushing to the wrong account.
 */
export async function resyncPushSubscription(): Promise<void> {
  if (!pushSupported()) return;
  if (Notification.permission !== 'granted') return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    await api.registerDevice({ token: JSON.stringify(subscription.toJSON()), platform: 'web' });
  } catch {
    // Best-effort — a failed resync just means the next explicit enable retries it.
  }
}

/**
 * The explicit, user-initiated opt-in: registers the service worker, asks
 * for permission, subscribes to push, and hands the subscription to the API.
 * Must be called from inside a click handler — Safari in particular refuses
 * `Notification.requestPermission()` calls with no user gesture on the stack.
 */
export async function enablePushNotifications(): Promise<void> {
  if (!pushSupported()) {
    throw new Error('This browser doesn’t support notifications.');
  }
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    throw new Error('Push notifications aren’t configured yet.');
  }

  const registration = await getRegistration();
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }));

  await api.registerDevice({ token: JSON.stringify(subscription.toJSON()), platform: 'web' });
}
