import { describe, it, expect } from 'vitest';
import { makeUser, makeCircleWith } from './setup';
import { CheckInService } from '../src/modules/checkins/checkins.service';
import { CircleNotificationService } from '../src/modules/notifications/circle-notification.service';
import { TouchpointService } from '../src/modules/touchpoints/touchpoints.service';
import { MessageService } from '../src/modules/messages/messages.service';

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
  return { circle, author: author!, r1: r1!, r2: r2!, checkinId: res.checkin.id };
}

function messageSpy() {
  const notified: Array<{ targetUserId: string; senderName: string; checkinId: string }> = [];
  const svc = new MessageService();
  svc.setDispatcher({ async notifyMessage(i) { notified.push(i); } });
  return { svc, notified };
}

describe('MessageService.send', () => {
  it('lets a responder send an in-app message and notifies the author', async () => {
    const { author, r1, checkinId } = await distressCheckin();
    const { svc, notified } = messageSpy();

    const message = await svc.send({ checkinId, senderId: r1.id, senderName: 'R1', body: 'Thinking of you!' });

    expect(message.sender_name).toBe('R1');
    expect(message.body).toBe('Thinking of you!');
    expect(message.received_at).toBeNull();
    expect(notified).toEqual([{ targetUserId: author.id, senderName: 'R1', checkinId }]);
  });

  it('also logs a TextSent touchpoint so "already reached out" stays accurate', async () => {
    const { r1, checkinId } = await distressCheckin();
    const { svc } = messageSpy();
    await svc.send({ checkinId, senderId: r1.id, senderName: 'R1', body: 'Hi!' });

    const tpSvc = new TouchpointService();
    tpSvc.setAckDispatcher({ async ackTarget() {} });
    const touchpoints = await tpSvc.list(checkinId, r1.id);
    expect(touchpoints.map((t) => t.type)).toEqual(['TextSent']);
  });

  it('rejects an empty message', async () => {
    const { r1, checkinId } = await distressCheckin();
    const { svc } = messageSpy();
    await expect(svc.send({ checkinId, senderId: r1.id, senderName: 'R1', body: '   ' })).rejects.toMatchObject({
      code: 'VALIDATION',
    });
  });

  it('rejects a message over the 300-char cap', async () => {
    const { r1, checkinId } = await distressCheckin();
    const { svc } = messageSpy();
    await expect(
      svc.send({ checkinId, senderId: r1.id, senderName: 'R1', body: 'x'.repeat(301) }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('rejects the author messaging their own check-in', async () => {
    const { author, checkinId } = await distressCheckin();
    const { svc } = messageSpy();
    await expect(
      svc.send({ checkinId, senderId: author.id, senderName: 'Author', body: 'Hi' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects a non-member', async () => {
    const { checkinId } = await distressCheckin();
    const outsider = await makeUser('Outsider');
    const { svc } = messageSpy();
    await expect(
      svc.send({ checkinId, senderId: outsider.id, senderName: 'Outsider', body: 'Hi' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects an unknown check-in', async () => {
    const { r1 } = await distressCheckin();
    const { svc } = messageSpy();
    await expect(
      svc.send({ checkinId: '00000000-0000-0000-0000-000000000000', senderId: r1.id, senderName: 'R1', body: 'Hi' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('MessageService.list', () => {
  it('is visible only to the check-in author, not the sender or other members', async () => {
    const { author, r1, r2, checkinId } = await distressCheckin();
    const { svc } = messageSpy();
    await svc.send({ checkinId, senderId: r1.id, senderName: 'R1', body: 'Hi' });

    const list = await svc.list(checkinId, author.id);
    expect(list).toHaveLength(1);
    expect(list[0]!.sender_name).toBe('R1');

    await expect(svc.list(checkinId, r1.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(svc.list(checkinId, r2.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects a non-member entirely', async () => {
    const { checkinId } = await distressCheckin();
    const outsider = await makeUser('Outsider');
    const { svc } = messageSpy();
    await expect(svc.list(checkinId, outsider.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('MessageService.markReceived', () => {
  it('marks the message received but keeps it visible (moved, not removed)', async () => {
    const { author, r1, checkinId } = await distressCheckin();
    const { svc } = messageSpy();
    const message = await svc.send({ checkinId, senderId: r1.id, senderName: 'R1', body: 'Hi' });

    expect((await svc.list(checkinId, author.id))[0]!.received_at).toBeNull();
    await svc.markReceived(checkinId, message.id, author.id);
    const list = await svc.list(checkinId, author.id);
    expect(list).toHaveLength(1);
    expect(list[0]!.received_at).not.toBeNull();
  });

  it('is idempotent — acknowledging twice does not throw', async () => {
    const { author, r1, checkinId } = await distressCheckin();
    const { svc } = messageSpy();
    const message = await svc.send({ checkinId, senderId: r1.id, senderName: 'R1', body: 'Hi' });

    await svc.markReceived(checkinId, message.id, author.id);
    await svc.markReceived(checkinId, message.id, author.id);
    const list = await svc.list(checkinId, author.id);
    expect(list[0]!.received_at).not.toBeNull();
  });

  it('rejects a caller who is not the check-in author', async () => {
    const { r1, checkinId } = await distressCheckin();
    const { svc } = messageSpy();
    const message = await svc.send({ checkinId, senderId: r1.id, senderName: 'R1', body: 'Hi' });

    await expect(svc.markReceived(checkinId, message.id, r1.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects an unknown message id', async () => {
    const { author, checkinId } = await distressCheckin();
    const { svc } = messageSpy();
    await expect(
      svc.markReceived(checkinId, '00000000-0000-0000-0000-000000000000', author.id),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('thanks the sender — their next care-cards fetch shows the one-time gratitude card', async () => {
    const { circle, author, r1, checkinId } = await distressCheckin();
    const { svc } = messageSpy();
    const message = await svc.send({ checkinId, senderId: r1.id, senderName: 'R1', body: 'Hi' });

    await svc.markReceived(checkinId, message.id, author.id);

    const checkins = new CheckInService();
    const [card] = await checkins.careCards(circle.id, r1.id);
    expect(card!.gratitude_shown).toBe(true);
    expect(card!.gratitude_received).toBe(true);

    // Second fetch: already seen, so it no longer flashes — but stays true.
    const [cardAgain] = await checkins.careCards(circle.id, r1.id);
    expect(cardAgain!.gratitude_shown).toBeUndefined();
    expect(cardAgain!.gratitude_received).toBe(true);
  });
});
