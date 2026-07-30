import { db, pool } from '../src/config/db';
import { users, circles, circleMemberships } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { CheckInService } from '../src/modules/checkins/checkins.service';
import { CircleNotificationService } from '../src/modules/notifications/circle-notification.service';
import { TouchpointService } from '../src/modules/touchpoints/touchpoints.service';
import type { BroadcastResult } from '../src/modules/notifications/circle-notification.service';

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

async function seed() {
  const [maya] = await db
    .insert(users)
    .values({ name: 'Maya', email: `maya-${Date.now()}@t.co`, timezone: 'Asia/Manila' })
    .returning();
  const [marcus] = await db
    .insert(users)
    .values({ name: 'Marcus', email: `marcus-${Date.now()}@t.co`, timezone: 'UTC' })
    .returning();
  const [grace] = await db
    .insert(users)
    .values({ name: 'Grace', email: `grace-${Date.now()}@t.co`, timezone: 'UTC' })
    .returning();
  const [circle] = await db.insert(circles).values({ name: 'Test Circle' }).returning();
  for (const u of [maya!, marcus!, grace!]) {
    await db
      .insert(circleMemberships)
      .values({ circleId: circle!.id, userId: u.id, covenantAgreed: true });
  }
  return { maya: maya!, marcus: marcus!, grace: grace!, circle: circle! };
}

async function main() {
  const { maya, marcus, grace, circle } = await seed();

  // Capture what the (Phase 2) dispatcher would receive.
  let dispatched: BroadcastResult | null = null;
  const notifications = new CircleNotificationService();
  notifications.setDispatcher({
    async dispatchDistress(input) {
      dispatched = input as unknown as BroadcastResult;
    },
  });
  const checkins = new CheckInService(undefined, notifications);

  console.log('\n[1] Non-distress check-in: no notification');
  const calm = await checkins.submit({
    userId: maya.id,
    circleId: circle.id,
    spiritual_state: 'Steady',
    physical_state: 'Thriving',
    emotional_state: 'Steady',
    vocational_state: 'Steady',
    relational_state: 'Thriving',
  });
  assert(calm.notification === undefined, 'no notification when all states calm');
  assert(dispatched === null, 'dispatcher not called for calm check-in');

  console.log('\n[2] Distress check-in: notification + broadcast to others only');
  const heavy = await checkins.submit({
    userId: maya.id,
    circleId: circle.id,
    spiritual_state: 'Steady',
    physical_state: 'Steady',
    emotional_state: 'Heavy',
    vocational_state: 'Steady',
    relational_state: 'Steady',
    optional_note: 'Rough day back home.',
  });
  assert(!!heavy.notification, 'notification returned on Heavy');
  assert(!!heavy.notification?.verse, 'notification carries a verse');
  assert(dispatched !== null, 'dispatcher fired post-commit');
  const recips = (dispatched as unknown as BroadcastResult).recipientIds;
  assert(!recips.includes(maya.id), 'submitter excluded from recipients');
  assert(
    recips.includes(marcus.id) && recips.includes(grace.id),
    'all other members are recipients',
  );

  console.log('\n[3] Un-pause on submit (GAP #5)');
  await db.update(users).set({ notificationsPaused: true }).where(eq(users.id, grace.id));
  await checkins.submit({
    userId: grace.id,
    circleId: circle.id,
    spiritual_state: 'Steady',
    physical_state: 'Steady',
    emotional_state: 'Steady',
    vocational_state: 'Steady',
    relational_state: 'Steady',
  });
  const [graceAfter] = await db.select().from(users).where(eq(users.id, grace.id));
  assert(graceAfter!.notificationsPaused === false, 'submitting un-pauses the user');
  assert(graceAfter!.lastCheckinAt !== null, 'last_checkin_at set on submit');

  console.log('\n[4] Pact gate');
  const [outsider] = await db
    .insert(users)
    .values({ name: 'Outsider', email: `out-${Date.now()}@t.co`, timezone: 'UTC' })
    .returning();
  await db
    .insert(circleMemberships)
    .values({ circleId: circle.id, userId: outsider!.id, covenantAgreed: false });
  let blocked = false;
  try {
    await checkins.submit({
      userId: outsider!.id,
      circleId: circle.id,
      spiritual_state: 'Steady',
      physical_state: 'Steady',
      emotional_state: 'Steady',
      vocational_state: 'Steady',
      relational_state: 'Steady',
    });
  } catch {
    blocked = true;
  }
  assert(blocked, 'check-in blocked before pact agreed');

  console.log('\n[5] Sper: latest non-expired per member');
  const sper = await checkins.sper(circle.id, maya.id);
  const mayaEntry = sper.find((r) => r.user_id === maya.id);
  assert(mayaEntry?.emotional_state === 'Heavy', 'sper shows Maya latest = Heavy');
  assert(sper.length === 4, 'sper has one entry per member (4)');

  console.log('\n[6] Multi-responder touchpoints + quiet ack');
  const acks: string[] = [];
  const touchpoints = new TouchpointService();
  touchpoints.setAckDispatcher({
    async ackTarget(i) {
      acks.push(`${i.responderName}->${i.targetUserId}`);
    },
  });
  const checkinId = heavy.checkin.id;
  await touchpoints.log({
    checkinId,
    responderId: marcus.id,
    responderName: 'Marcus',
    type: 'VoiceNoteSent',
  });
  await touchpoints.log({
    checkinId,
    responderId: grace.id,
    responderName: 'Grace',
    type: 'PrayedFor',
  });
  const list = await touchpoints.list(checkinId, marcus.id);
  assert(list.length === 2, 'multiple members can respond to same check-in');
  assert(acks.length === 2, 'target quietly acked once per responder');
  assert(
    acks.every((a) => a.endsWith(maya.id)),
    'acks routed to the check-in author (Maya)',
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
