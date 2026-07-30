import { env } from '../config/env';

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface EmailResult {
  to: string;
  ok: boolean;
  error?: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailResult>;
}

/**
 * SMTP email provider via nodemailer. Works with the SMTP interface of SES,
 * Postmark, Resend, etc. Falls back to structured logging when SMTP isn't
 * configured, so the delivery path stays exercisable in dev/test. The
 * transporter is created lazily and reused.
 */
export class DefaultEmailProvider implements EmailProvider {
  private transporter: import('nodemailer').Transporter | null = null;
  private initPromise: Promise<void> | null = null;

  private static isConfigured(): boolean {
    return Boolean(env.SMTP_HOST && env.SMTP_PORT);
  }

  private async ensureInit(): Promise<void> {
    if (this.transporter) return;
    if (!this.initPromise) {
      this.initPromise = (async () => {
        const nodemailer = (await import('nodemailer')).default;
        this.transporter = nodemailer.createTransport({
          host: env.SMTP_HOST!,
          port: env.SMTP_PORT!,
          secure: env.SMTP_SECURE,
          ...(env.SMTP_USER && env.SMTP_PASS
            ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } }
            : {}),
        });
      })();
    }
    await this.initPromise;
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    if (!DefaultEmailProvider.isConfigured()) {
      // eslint-disable-next-line no-console
      console.info(
        `[email:log-only] from=${env.EMAIL_FROM} to=${message.to} ` +
          `subject="${message.subject}"`,
      );
      return { to: message.to, ok: true };
    }

    try {
      await this.ensureInit();
      await this.transporter!.sendMail({
        from: env.EMAIL_FROM,
        to: message.to,
        subject: message.subject,
        text: message.body,
      });
      return { to: message.to, ok: true };
    } catch (err) {
      return {
        to: message.to,
        ok: false,
        error: err instanceof Error ? err.message : 'email send failed',
      };
    }
  }
}

export const emailProvider: EmailProvider = new DefaultEmailProvider();
