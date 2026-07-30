import { describe, it, expect } from 'vitest';
import { makeCircleWith, db, deviceTokens } from './setup';
import { eq } from 'drizzle-orm';
import { NotifierService } from '../src/delivery/notifier.service';
import { DeviceRepo } from '../src/modules/users/devices.repo';
import type { PushProvider, PushMessage, PushResult } from '../src/delivery/push.provider';
import type { EmailProvider, EmailMessage, EmailResult } from '../src/delivery/email.provider';
import { pickVerse } from '../src/modules/notifications/verses';
import { claimSend } from '../src/shared/idempotency';
import { CheckInService } from '../src/modules/checkins/checkins.service';
import { CircleNotificationService } from '../src/modules/notifications/circle-notification.service';

class SpyPush implements PushProvider {
  sent: PushMessage[] = [];
  dead = new Set<string>();
  async send(m: PushMessage): Promise<PushResult> {
    this.sent.push(m);
    return this.dead.has(m.token)
      ? { token: m.token, ok: false, invalidToken: true }
      : { token: m.token, ok: true };
  }
}
class SpyEmail implements EmailProvider {
  sent: EmailMessage[] = [];
  async send(m: EmailMessage): Promise<EmailResult> {
    this.sent.push(m);
    return { to: m.to, ok: true };
  }
}

async function makeCheckin(circleId: string, authorId: string) {
  const notifications = new CircleNotificationService();
  notifications.setDispatcher({ async dispatchDistress() {} });
  const checkins = new CheckInService(undefined, notifications);
  const res = await checkins.submit({
    userId: authorId,
    circleId,
    spiritual_state: 'Steady',
    physical_state: 'Steady',
    emotional_state: 'Heavy',
    vocational_state: 'Steady',
    relational_state: 'Steady',
  });
  const dto = res.notification!;
  // The notifier consumes a DB row (camelCase), not the DTO (snake_case).
  const row = {
    id: dto.id,
    checkinId: dto.checkin_id,
    targetUserId: dto.target_user_id,
    circleId: dto.circle_id,
    verse: dto.verse,
    createdAt: new Date(dto.created_at),
  };
  return { dto, row };
}

describe('NotifierService.dispatchDistress', () => {
  it('pushes to token-holders and emails those without tokens', async () => {
    const { circle, users: [author, hasToken, noToken] } = await makeCircleWith([
      'Author', 'HasToken', 'NoToken',
    ]);
    const devices = new DeviceRepo();
    await devices.register(hasToken!.id, 'tok-push', 'ios');

    const push = new SpyPush();
    const email = new SpyEmail();
    const notifier = new NotifierService(devices, push, email);
    const { row } = await makeCheckin(circle.id, author!.id);

    await notifier.dispatchDistress({
      notification: row as never,
      recipientIds: [hasToken!.id, noToken!.id],
    });

    expect(push.sent.some((m) => m.token === 'tok-push')).toBe(true);
    expect(email.sent.length).toBe(1); // only noToken falls back to email
  });

  it('carries checkin_id in the push payload for deep-linking', async () => {
    const { circle, users: [author, r] } = await makeCircleWith(['Author', 'R']);
    const devices = new DeviceRepo();
    await devices.register(r!.id, 'tok-r', 'android');
    const push = new SpyPush();
    const notifier = new NotifierService(devices, push, new SpyEmail());
    const { row } = await makeCheckin(circle.id, author!.id);

    await notifier.dispatchDistress({ notification: row as never, recipientIds: [r!.id] });
    expect(push.sent[0]!.data?.checkin_id).toBe(row.checkinId);
  });

  it('is idempotent: re-dispatching the same check-in sends nothing new', async () => {
    const { circle, users: [author, r] } = await makeCircleWith(['Author', 'R']);
    const devices = new DeviceRepo();
    await devices.register(r!.id, 'tok-idem', 'ios');
    const push = new SpyPush();
    const notifier = new NotifierService(devices, push, new SpyEmail());
    const { row } = await makeCheckin(circle.id, author!.id);

    await notifier.dispatchDistress({ notification: row as never, recipientIds: [r!.id] });
    const countAfterFirst = push.sent.length;
    await notifier.dispatchDistress({ notification: row as never, recipientIds: [r!.id] });

    expect(push.sent.length).toBe(countAfterFirst);
  });

  it('prunes a dead token and falls back to email', async () => {
    const { circle, users: [author, r] } = await makeCircleWith(['Author', 'R']);
    const devices = new DeviceRepo();
    await devices.register(r!.id, 'tok-dead', 'android');
    const push = new SpyPush();
    push.dead.add('tok-dead');
    const email = new SpyEmail();
    const notifier = new NotifierService(devices, push, email);
    const { row } = await makeCheckin(circle.id, author!.id);

    await notifier.dispatchDistress({ notification: row as never, recipientIds: [r!.id] });

    const remaining = await db.select().from(deviceTokens).where(eq(deviceTokens.token, 'tok-dead'));
    expect(remaining).toHaveLength(0);
    expect(email.sent).toHaveLength(1);
  });

  it('no-ops when there are no recipients', async () => {
    const { circle, users: [author] } = await makeCircleWith(['Author']);
    const push = new SpyPush();
    const email = new SpyEmail();
    const notifier = new NotifierService(new DeviceRepo(), push, email);
    const { row } = await makeCheckin(circle.id, author!.id);
    await notifier.dispatchDistress({ notification: row as never, recipientIds: [] });
    expect(push.sent).toHaveLength(0);
    expect(email.sent).toHaveLength(0);
  });
});

describe('verse selection', () => {
  it('is deterministic for a given seed', () => {
    expect(pickVerse('checkin-123')).toBe(pickVerse('checkin-123'));
  });
  it('always returns a non-empty verse', () => {
    expect(pickVerse('anything').length).toBeGreaterThan(0);
  });
});

describe('idempotency claimSend', () => {
  it('grants the first claim and denies the second for the same pair', async () => {
    const { circle, users: [author, r] } = await makeCircleWith(['Author', 'R']);
    const { row } = await makeCheckin(circle.id, author!.id);
    const first = await claimSend(row.checkinId, r!.id);
    const second = await claimSend(row.checkinId, r!.id);
    expect(first).toBe(true);
    expect(second).toBe(false);
  });
});
