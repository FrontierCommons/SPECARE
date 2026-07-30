import { describe, it, expect } from 'vitest';
import { makeCircleWith } from './setup';
import { CheckInService } from '../src/modules/checkins/checkins.service';
import { CircleNotificationService } from '../src/modules/notifications/circle-notification.service';
import { TouchpointService } from '../src/modules/touchpoints/touchpoints.service';
import { GratitudeService } from '../src/modules/gratitude/gratitude.service';

async function distressCheckin() {
  const { circle, users: [author, r1, r2] } = await makeCircleWith(['Author', 'R1', 'R2']);
  const notifications = new CircleNotificationService();
  notifications.setDispatcher({ async dispatchDistress() {} });
  const checkins = new CheckInService(undefined, notifications);
  const res = await checkins.submit({
    userId: author!.id,
    circleId: circle.id,
    spiritual_state: 'Steady',
    physical_state: 'Steady',
    emotional_state: 'Heavy',
    vocational_state: 'Steady',
    relational_state: 'Steady',
  });
  return { circle, author: author!, r1: r1!, r2: r2!, checkinId: res.checkin.id, checkins };
}

async function logTouchpoint(checkinId: string, responderId: string, responderName: string) {
  const svc = new TouchpointService();
  svc.setAckDispatcher({ async ackTarget() {} });
  await svc.log({ checkinId, responderId, responderName, type: 'PrayedFor' });
}

describe('GratitudeService.send', () => {
  it('rejects anyone but the check-in author', async () => {
    const { r1, checkinId } = await distressCheckin();
    const svc = new GratitudeService();
    await expect(svc.send(checkinId, r1.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects an unknown check-in', async () => {
    const { author } = await distressCheckin();
    const svc = new GratitudeService();
    await expect(
      svc.send('00000000-0000-0000-0000-000000000000', author.id),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('thanks every responder on first send, no one on an empty repeat', async () => {
    const { author, r1, r2, checkinId } = await distressCheckin();
    await logTouchpoint(checkinId, r1.id, 'R1');
    await logTouchpoint(checkinId, r2.id, 'R2');

    const svc = new GratitudeService();
    const first = await svc.send(checkinId, author.id);
    expect(first.thanked).toBe(2);

    const second = await svc.send(checkinId, author.id);
    expect(second.thanked).toBe(0);
  });

  it('only thanks new responders on a repeat send', async () => {
    const { author, r1, r2, checkinId } = await distressCheckin();
    await logTouchpoint(checkinId, r1.id, 'R1');

    const svc = new GratitudeService();
    expect((await svc.send(checkinId, author.id)).thanked).toBe(1);

    await logTouchpoint(checkinId, r2.id, 'R2');
    const second = await svc.send(checkinId, author.id);
    expect(second.thanked).toBe(1);
  });
});

describe('CheckInService.careCards gratitude state', () => {
  it('shows gratitude once for the responder, then hides it on later fetches', async () => {
    const { circle, author, r1, checkinId, checkins } = await distressCheckin();
    await logTouchpoint(checkinId, r1.id, 'R1');
    await new GratitudeService().send(checkinId, author.id);

    const first = await checkins.careCards(circle.id, r1.id);
    const firstCard = first.find((c) => c.checkin_id === checkinId)!;
    expect(firstCard.gratitude_shown).toBe(true);
    expect(firstCard.gratitude_received).toBe(true);

    const second = await checkins.careCards(circle.id, r1.id);
    const secondCard = second.find((c) => c.checkin_id === checkinId)!;
    expect(secondCard.gratitude_shown).toBeFalsy();
    expect(secondCard.gratitude_received).toBe(true);
  });

  it('leaves gratitude unset for a member who never responded', async () => {
    const { circle, author, r1, r2, checkinId } = await distressCheckin();
    await logTouchpoint(checkinId, r1.id, 'R1');
    await new GratitudeService().send(checkinId, author.id);

    const checkins = new CheckInService();
    const cards = await checkins.careCards(circle.id, r2.id);
    const card = cards.find((c) => c.checkin_id === checkinId)!;
    expect(card.gratitude_shown).toBeFalsy();
    expect(card.gratitude_received).toBeFalsy();
  });

  it('leaves gratitude unset for the author viewing their own card', async () => {
    const { circle, author, r1, checkinId } = await distressCheckin();
    await logTouchpoint(checkinId, r1.id, 'R1');
    await new GratitudeService().send(checkinId, author.id);

    const checkins = new CheckInService();
    const cards = await checkins.careCards(circle.id, author.id);
    const card = cards.find((c) => c.checkin_id === checkinId)!;
    expect(card.gratitude_shown).toBeFalsy();
    expect(card.gratitude_received).toBeFalsy();
  });
});
