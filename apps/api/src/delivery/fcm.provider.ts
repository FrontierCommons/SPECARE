import { env } from '../config/env';
import type { PushMessage, PushProvider, PushResult } from './push.provider';

/**
 * FCM (Android) provider via firebase-admin. Lazily initializes the SDK so the
 * import cost is only paid when FCM is actually configured. Translates FCM's
 * "unregistered"/"invalid-argument" errors into invalidToken so the notifier
 * prunes the dead token.
 */
export class FcmPushProvider implements PushProvider {
  private messaging: import('firebase-admin/messaging').Messaging | null = null;
  private initPromise: Promise<void> | null = null;

  static isConfigured(): boolean {
    return Boolean(env.FCM_PROJECT_ID && env.FCM_CLIENT_EMAIL && env.FCM_PRIVATE_KEY);
  }

  private async ensureInit(): Promise<void> {
    if (this.messaging) return;
    if (!this.initPromise) {
      this.initPromise = (async () => {
        const { initializeApp, getApps, cert } = await import('firebase-admin/app');
        const { getMessaging } = await import('firebase-admin/messaging');
        const app =
          getApps().find((a) => a.name === 'sper-fcm') ??
          initializeApp(
            {
              credential: cert({
                projectId: env.FCM_PROJECT_ID!,
                clientEmail: env.FCM_CLIENT_EMAIL!,
                // Support "\n"-escaped keys from env files.
                privateKey: env.FCM_PRIVATE_KEY!.replace(/\\n/g, '\n'),
              }),
            },
            'sper-fcm',
          );
        this.messaging = getMessaging(app);
      })();
    }
    await this.initPromise;
  }

  async send(message: PushMessage): Promise<PushResult> {
    try {
      await this.ensureInit();
      await this.messaging!.send({
        token: message.token,
        notification: { title: message.title, body: message.body },
        data: message.data ?? {},
        android: { priority: 'high' },
      });
      return { token: message.token, ok: true };
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      const invalidToken =
        code.includes('registration-token-not-registered') ||
        code.includes('invalid-argument') ||
        code.includes('invalid-registration-token');
      return {
        token: message.token,
        ok: false,
        ...(invalidToken ? { invalidToken: true } : {}),
        error: err instanceof Error ? err.message : 'fcm send failed',
      };
    }
  }
}
