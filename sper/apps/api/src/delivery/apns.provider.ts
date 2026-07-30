import { env } from '../config/env';
import type { PushMessage, PushProvider, PushResult } from './push.provider';

/**
 * APNs (iOS) provider via @parse/node-apn using token-based (.p8) auth.
 * Lazily constructs the provider. Translates APNs 410 / BadDeviceToken /
 * Unregistered responses into invalidToken so the notifier prunes the token.
 */
export class ApnsPushProvider implements PushProvider {
  private provider: import('@parse/node-apn').Provider | null = null;
  private initPromise: Promise<void> | null = null;

  static isConfigured(): boolean {
    return Boolean(
      env.APNS_KEY_ID && env.APNS_TEAM_ID && env.APNS_BUNDLE_ID && env.APNS_PRIVATE_KEY,
    );
  }

  private async ensureInit(): Promise<void> {
    if (this.provider) return;
    if (!this.initPromise) {
      this.initPromise = (async () => {
        const apnModule = await import('@parse/node-apn');
        const apn = apnModule.default ?? apnModule;
        this.provider = new apn.Provider({
          token: {
            key: Buffer.from(env.APNS_PRIVATE_KEY!.replace(/\\n/g, '\n')),
            keyId: env.APNS_KEY_ID!,
            teamId: env.APNS_TEAM_ID!,
          },
          production: env.APNS_PRODUCTION,
        });
      })();
    }
    await this.initPromise;
  }

  async send(message: PushMessage): Promise<PushResult> {
    try {
      await this.ensureInit();
      const apnModule = await import('@parse/node-apn');
      const apn = apnModule.default ?? apnModule;

      const note = new apn.Notification();
      note.topic = env.APNS_BUNDLE_ID!;
      note.alert = { title: message.title, body: message.body };
      note.sound = 'default';
      note.payload = message.data ?? {};

      const result = await this.provider!.send(note, message.token);

      if (result.sent.length > 0) {
        return { token: message.token, ok: true };
      }

      const failure = result.failed[0];
      const status = failure?.status;
      const reason = failure?.response?.reason ?? '';
      const invalidToken =
        status === 410 ||
        String(status) === '410' ||
        reason === 'BadDeviceToken' ||
        reason === 'Unregistered' ||
        reason === 'DeviceTokenNotForTopic';

      return {
        token: message.token,
        ok: false,
        ...(invalidToken ? { invalidToken: true } : {}),
        error: reason || `apns failed (status ${status ?? 'unknown'})`,
      };
    } catch (err) {
      return {
        token: message.token,
        ok: false,
        error: err instanceof Error ? err.message : 'apns send failed',
      };
    }
  }
}
