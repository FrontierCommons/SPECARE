import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, makeUser, makeCircle, addMember, makeCircleWith } from './setup';
import { users } from '../src/db/schema';
import { CheckInService } from '../src/modules/checkins/checkins.service';
import {
  CircleNotificationService,
  type BroadcastResult,
} from '../src/modules/notifications/circle-notification.service';

function serviceWithSpy() {
  const dispatched: BroadcastResult[] = [];
  const notifications = new CircleNotificationService();
  notifications.setDispatcher({
    async dispatchDistress(input) {
      dispatched.push(input as unknown as BroadcastResult);
    },
  });
  return { service: new CheckInService(undefined, notifications), dispatched };
}

const calm = {
  spiritual_state: 'Steady',
  physical_state: 'Thriving',
  emotional_state: 'Steady',
  vocational_state: 'Steady',
  relational_state: 'Thriving',
} as const;

describe('CheckInService.submit — core', () => {
  it('accepts a calm check-in and sends no notification', async () => {
    const { circle, users: [maya] } = await makeCircleWith(['Maya']);
    const { service, dispatched } = serviceWithSpy();

    const res = await service.submit({ userId: maya!.id, circleId: circle.id, ...calm });

    expect(res.checkin.id).toBeTruthy();
    expect(res.notification).toBeUndefined();
    expect(dispatched).toHaveLength(0);
  });

  it('flags Heavy and notifies all other members (submitter excluded)', async () => {
    const { circle, users: [maya, marcus, grace] } = await makeCircleWith([
      'Maya', 'Marcus', 'Grace',
    ]);
    const { service, dispatched } = serviceWithSpy();

    const res = await service.submit({
      userId: maya!.id,
      circleId: circle.id,
      ...calm,
      emotional_state: 'Heavy',
    });

    expect(res.notification).toBeDefined();
    expect(res.notification?.verse).toBeTruthy();
    expect(dispatched).toHaveLength(1);
    const recips = dispatched[0]!.recipientIds;
    expect(recips).toContain(marcus!.id);
    expect(recips).toContain(grace!.id);
    expect(recips).not.toContain(maya!.id);
  });

  it('flags "In the Pit" identically to Heavy', async () => {
    const { circle, users: [a, b] } = await makeCircleWith(['A', 'B']);
    const { service, dispatched } = serviceWithSpy();
    await service.submit({ userId: a!.id, circleId: circle.id, ...calm, spiritual_state: 'In the Pit' });
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.recipientIds).toEqual([b!.id]);
  });

  it('fires only one notification even when multiple dimensions are distressed', async () => {
    const { circle, users: [a] } = await makeCircleWith(['A', 'B']);
    const { service, dispatched } = serviceWithSpy();
    await service.submit({
      userId: a!.id,
      circleId: circle.id,
      spiritual_state: 'Heavy',
      physical_state: 'In the Pit',
      emotional_state: 'Heavy',
      vocational_state: 'Steady',
      relational_state: 'In the Pit',
    });
    expect(dispatched).toHaveLength(1);
  });
});

describe('CheckInService.submit — grace un-pause (GAP #5)', () => {
  it('un-pauses the submitter and records last_checkin_at', async () => {
    const { circle, users: [u] } = await makeCircleWith(['U']);
    await db.update(users).set({ notificationsPaused: true }).where(eq(users.id, u!.id));
    const { service } = serviceWithSpy();

    await service.submit({ userId: u!.id, circleId: circle.id, ...calm });

    const [after] = await db.select().from(users).where(eq(users.id, u!.id));
    expect(after!.notificationsPaused).toBe(false);
    expect(after!.lastCheckinAt).not.toBeNull();
  });
});

describe('CheckInService.submit — guards & edge cases', () => {
  it('rejects a non-member', async () => {
    const circle = await makeCircle();
    const outsider = await makeUser('Outsider');
    const { service } = serviceWithSpy();
    await expect(
      service.submit({ userId: outsider.id, circleId: circle.id, ...calm }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects a member who has not agreed the pact', async () => {
    const circle = await makeCircle();
    const u = await makeUser('Pending');
    await addMember(circle.id, u.id, false); // pact not agreed
    const { service } = serviceWithSpy();
    await expect(
      service.submit({ userId: u.id, circleId: circle.id, ...calm }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects a note longer than 140 characters', async () => {
    const { circle, users: [u] } = await makeCircleWith(['U']);
    const { service } = serviceWithSpy();
    await expect(
      service.submit({
        userId: u!.id,
        circleId: circle.id,
        ...calm,
        optional_note: 'x'.repeat(141),
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('accepts a note of exactly 140 characters (boundary)', async () => {
    const { circle, users: [u] } = await makeCircleWith(['U']);
    const { service } = serviceWithSpy();
    const res = await service.submit({
      userId: u!.id,
      circleId: circle.id,
      ...calm,
      optional_note: 'x'.repeat(140),
    });
    expect(res.checkin.optional_note).toHaveLength(140);
  });

  it('does not persist a check-in when the pact guard rejects (atomicity)', async () => {
    const circle = await makeCircle();
    const u = await makeUser('Pending');
    await addMember(circle.id, u.id, false);
    const { service } = serviceWithSpy();
    await service
      .submit({ userId: u.id, circleId: circle.id, ...calm })
      .catch(() => undefined);
    const sper = await service.sper(circle.id, u.id).catch(() => []);
    expect(sper.every((r) => r.checkin_id === null)).toBe(true);
  });

  it('lone-member circle: distress produces a record but zero recipients', async () => {
    const { circle, users: [solo] } = await makeCircleWith(['Solo']);
    const { service, dispatched } = serviceWithSpy();
    const res = await service.submit({
      userId: solo!.id,
      circleId: circle.id,
      ...calm,
      emotional_state: 'Heavy',
    });
    expect(res.notification).toBeDefined();
    expect(dispatched[0]!.recipientIds).toHaveLength(0);
  });
});

describe('CheckInService.sper', () => {
  it('shows one entry per member, latest non-expired state', async () => {
    const { circle, users: [a, b] } = await makeCircleWith(['A', 'B']);
    const { service } = serviceWithSpy();
    await service.submit({ userId: a!.id, circleId: circle.id, ...calm, emotional_state: 'Heavy' });

    const sper = await service.sper(circle.id, b!.id);
    expect(sper).toHaveLength(2);
    const aEntry = sper.find((r) => r.user_id === a!.id);
    expect(aEntry?.emotional_state).toBe('Heavy');
    const bEntry = sper.find((r) => r.user_id === b!.id);
    expect(bEntry?.checkin_id).toBeNull(); // B never checked in
  });

  it('rejects sper access for a non-member', async () => {
    const { circle } = await makeCircleWith(['A']);
    const outsider = await makeUser('Outsider');
    const { service } = serviceWithSpy();
    await expect(service.sper(circle.id, outsider.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('CheckInService.careCards', () => {
  it('returns a card only for currently-flagged members with flagged dims + verse', async () => {
    const { circle, users: [a, b] } = await makeCircleWith(['A', 'B']);
    const { service } = serviceWithSpy();
    await service.submit({ userId: a!.id, circleId: circle.id, ...calm }); // calm -> no card
    await service.submit({
      userId: b!.id,
      circleId: circle.id,
      ...calm,
      spiritual_state: 'In the Pit',
      emotional_state: 'Heavy',
    });

    const cards = await service.careCards(circle.id, a!.id);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.target_user_id).toBe(b!.id);
    expect(cards[0]!.flagged_dimensions.sort()).toEqual(['emotional', 'spiritual']);
    expect(cards[0]!.verse).toBeTruthy();
  });

  it('is empty when nobody is flagged', async () => {
    const { circle, users: [a] } = await makeCircleWith(['A']);
    const { service } = serviceWithSpy();
    await service.submit({ userId: a!.id, circleId: circle.id, ...calm });
    expect(await service.careCards(circle.id, a!.id)).toHaveLength(0);
  });
});
