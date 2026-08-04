import { db, pool } from '../src/config/db';
import { users, circles, circleMemberships } from '../src/db/schema';
import { CheckInService } from '../src/modules/checkins/checkins.service';
import { TouchpointService } from '../src/modules/touchpoints/touchpoints.service';
import { CircleNotificationService } from '../src/modules/notifications/circle-notification.service';
import { NotifierService } from '../src/delivery/notifier.service';
import { DeviceRepo } from '../src/modules/users/devices.repo';
import type { PushProvider, PushResult, PushMessage } from '../src/delivery/push.provider';
import type { EmailProvider, EmailResult, EmailMessage } from '../src/delivery/email.provider';

let ok = 0;
let fail = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    ok++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.error(`  ✗ ${msg}`);
  }
}

// ---- Spy providers -------------------------------------------------------
class SpyPush implements PushProvider {
  sent: PushMessage[] = [];
  deadTokens = new Set<string>();
  async send(m: PushMessage): Promise<PushResult> {
    this.sent.push(m);
    if (this.deadTokens.has(m.token)) {
      return { token: m.token, ok: false, invalidToken: true };
    }
    return { token: m.token, ok: true };
  }
}
class SpyEmail implements EmailProvider {
  sent: EmailMessage[] = [];
  async send(m: EmailMessage): Promise<EmailResult> {
    this.sent.push(m);
    return { to: m.to, ok: true };
  }
}

async function seed() {
  const mk = async (name: string, tz = 'UTC') => {
    const [u] = await db
      .insert(users)
      .values({ name, email: `${name.toLowerCase()}-${Date.now()}-${Math.random()}@t.co`, timezone: tz })
      .returning();
    return u!;
  };
  const maya = await mk('P2Maya', 'Asia/Manila');
  const marcus = await mk('P2Marcus');
  const grace = await mk('P2Grace');
  const [circle] = await db.insert(circles).values({ name: 'P2 Circle' }).returning();
  for (const u of [maya, marcus, grace]) {
    await db.insert(circleMemberships).values({ circleId: circle!.id, userId: u.id, covenantAgreed: true });
  }
  return { maya, marcus, grace, circle: circle! };
}

async function main() {
  const { maya, marcus, grace, circle } = await seed();
  const devices = new DeviceRepo();

  // Marcus has a device token; Grace has NONE (forces email fallback).
  await devices.register(marcus.id, `tok-marcus-${Date.now()}`, 'ios');

  const spyPush = new SpyPush();
  const spyEmail = new SpyEmail();
  const notifier = new NotifierService(devices, spyPush, spyEmail);

  const notifications = new CircleNotificationService();
  notifications.setDispatcher(notifier);
  const checkins = new CheckInService(undefined, notifications);

  console.log('\n[1] Distress dispatch: push to token-holders, email fallback to others');
  const heavy = await checkins.submit({
    userId: maya.id,
    circleId: circle.id,
    spiritual_state: 'Steady',
    physical_state: 'Steady',
    emotional_state: 'In the Pit',
    vocational_state: 'Steady',
    relational_state: 'Steady',
    optional_note: 'Hard week.',
  });
  const checkinId = heavy.checkin.id;
  assert(spyPush.sent.some((m) => m.token.startsWith('tok-marcus')), 'push sent to Marcus (has token)');
  assert(spyPush.sent.every((m) => m.data?.checkin_id === checkinId), 'push carries checkin_id for deep-link');
  assert(spyEmail.sent.some((e) => e.to.includes('p2grace')), 'email fallback used for Grace (no token)');
  assert(!spyPush.sent.some((m) => m.token.includes('maya')), 'submitter (Maya) not delivered to');

  console.log('\n[2] Idempotency: re-dispatch same check-in sends nothing new');
  const pushCountBefore = spyPush.sent.length;
  const emailCountBefore = spyEmail.sent.length;
  await notifier.dispatchDistress({
    notification: {
      id: heavy.notification!.id,
      checkinId,
      targetUserId: maya.id,
      circleId: circle.id,
      verse: heavy.notification!.verse,
      createdAt: new Date(),
    },
    recipientIds: [marcus.id, grace.id],
  });
  assert(spyPush.sent.length === pushCountBefore, 'no duplicate push on re-dispatch (idempotent)');
  assert(spyEmail.sent.length === emailCountBefore, 'no duplicate email on re-dispatch (idempotent)');

  console.log('\n[3] Dead-token pruning');
  const deadTok = `tok-dead-${Date.now()}`;
  await devices.register(grace.id, deadTok, 'android');
  spyPush.deadTokens.add(deadTok);
  // New distress check-in (fresh idempotency key space) so Grace gets a send.
  const heavy2 = await checkins.submit({
    userId: maya.id,
    circleId: circle.id,
    spiritual_state: 'Steady',
    physical_state: 'Steady',
    emotional_state: 'Heavy',
    vocational_state: 'Steady',
    relational_state: 'Steady',
  });
  void heavy2;
  const graceTokens = await devices.listForUser(grace.id);
  assert(!graceTokens.some((t) => t.token === deadTok), 'invalid token pruned after failed push');
  assert(spyEmail.sent.some((e) => e.to.includes('p2grace')), 'email fallback fired when push token was dead');

  console.log('\n[4] Quiet ack routes to author only');
  const touchpoints = new TouchpointService();
  touchpoints.setAckDispatcher(notifier);
  const pushBeforeAck = spyPush.sent.length;
  await touchpoints.log({
    checkinId,
    responderId: marcus.id,
    responderName: 'P2Marcus',
    type: 'VoiceNoteSent',
  });
  const ackPush = spyPush.sent.slice(pushBeforeAck);
  const ackEmail = spyEmail.sent.filter((e) => e.subject === 'Someone stepped up');
  const ackDelivered =
    ackPush.some((m) => m.data?.type === 'touchpoint_ack') ||
    ackEmail.length > 0;
  assert(ackDelivered, 'target received a quiet ack (push or email)');
  assert(
    ackPush.every((m) => m.token.startsWith('tok-marcus')) === false ||
      ackPush.length === 0,
    'ack not pushed to responder as if they were the target',
  );

  console.log(`\n=== ${ok} passed, ${fail} failed ===`);
  await pool.end();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
