import type { DevicePlatform } from '@sper/shared-types';

/**
 * A single push message targeted at one device token.
 */
export interface PushMessage {
  token: string;
  platform: DevicePlatform;
  title: string;
  body: string;
  /** Arbitrary data payload for deep-linking (e.g. { checkin_id }). */
  data?: Record<string, string>;
}

export interface PushResult {
  token: string;
  ok: boolean;
  /** True when the provider says the token is dead and should be pruned. */
  invalidToken?: boolean;
  error?: string;
}

export interface PushProvider {
  send(message: PushMessage): Promise<PushResult>;
}

/**
 * Composite provider. Routes iOS -> APNs and Android -> FCM when those are
 * configured, and falls back to structured logging per-platform when the
 * relevant credentials are absent. Real providers are lazily imported so the
 * SDK cost is only paid when configured.
 */
export class DefaultPushProvider implements PushProvider {
  private apns: PushProvider | null = null;
  private fcm: PushProvider | null = null;
  private webPush: PushProvider | null = null;
  private apnsReady = false;
  private fcmReady = false;
  private webPushReady = false;

  private async iosProvider(): Promise<PushProvider | null> {
    if (this.apnsReady) return this.apns;
    this.apnsReady = true;
    const { ApnsPushProvider } = await import('./apns.provider');
    if (ApnsPushProvider.isConfigured()) this.apns = new ApnsPushProvider();
    return this.apns;
  }

  private async androidProvider(): Promise<PushProvider | null> {
    if (this.fcmReady) return this.fcm;
    this.fcmReady = true;
    const { FcmPushProvider } = await import('./fcm.provider');
    if (FcmPushProvider.isConfigured()) this.fcm = new FcmPushProvider();
    return this.fcm;
  }

  private async webProvider(): Promise<PushProvider | null> {
    if (this.webPushReady) return this.webPush;
    this.webPushReady = true;
    const { WebPushProvider } = await import('./webpush.provider');
    if (WebPushProvider.isConfigured()) this.webPush = new WebPushProvider();
    return this.webPush;
  }

  async send(message: PushMessage): Promise<PushResult> {
    const real =
      message.platform === 'ios'
        ? await this.iosProvider()
        : message.platform === 'android'
          ? await this.androidProvider()
          : await this.webProvider();

    if (real) return real.send(message);

    // No credentials for this platform: log-only so the path stays exercisable.
    // eslint-disable-next-line no-console
    console.info(
      `[push:log-only] -> ${message.platform}:${message.token.slice(0, 8)}… ` +
        `"${message.title}" / "${message.body}"`,
    );
    return { token: message.token, ok: true };
  }
}

export const pushProvider: PushProvider = new DefaultPushProvider();
