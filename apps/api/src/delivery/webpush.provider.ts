import { env } from '../config/env';
import type { PushMessage, PushProvider, PushResult } from './push.provider';

/**
 * Web Push (browser) provider via the `web-push` library and VAPID auth.
 * Unlike APNs/FCM, there's no separate "device token" string — the browser
 * hands the client a whole PushSubscription (endpoint + encryption keys), so
 * `message.token` here is that subscription JSON-stringified by the web app
 * before it's registered. A 404/410 response means the subscription has
 * expired or been revoked, same invalidToken contract as the other providers.
 */
export class WebPushProvider implements PushProvider {
  private lib: typeof import('web-push') | null = null;
  private initPromise: Promise<void> | null = null;

  static isConfigured(): boolean {
    return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
  }

  private async ensureInit(): Promise<void> {
    if (this.lib) return;
    if (!this.initPromise) {
      this.initPromise = (async () => {
        const webpushModule = await import('web-push');
        const webpush = webpushModule.default ?? webpushModule;
        webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
        this.lib = webpush;
      })();
    }
    await this.initPromise;
  }

  async send(message: PushMessage): Promise<PushResult> {
    try {
      const subscription = JSON.parse(message.token) as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      await this.ensureInit();
      await this.lib!.sendNotification(
        subscription,
        JSON.stringify({ title: message.title, body: message.body, data: message.data ?? {} }),
      );
      return { token: message.token, ok: true };
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      const invalidToken = statusCode === 404 || statusCode === 410;
      return {
        token: message.token,
        ok: false,
        ...(invalidToken ? { invalidToken: true } : {}),
        error: err instanceof Error ? err.message : 'web push send failed',
      };
    }
  }
}
