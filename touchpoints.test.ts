import { describe, it, expect } from 'vitest';
import { makeUser, makeCircleWith } from './setup';
import { CheckInService } from '../src/modules/checkins/checkins.service';
import { CircleNotificationService } from '../src/modules/notifications/circle-notification.service';
import { TouchpointService } from '../src/modules/touchpoints/touchpoints.service';

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

describe('TouchpointService.log', () => {
  it('lets any member log outreach and acks the author', async () => {
    const { author, r1, checkinId } = await distressCheckin();
    const acks: string[] = [];
    const svc = new TouchpointService();
    svc.setAckDispatcher({
      async ackTarget(i) { acks.push(`${i.responderName}->${i.targetUserId}`); },
    });

    const tp = await svc.log({
      checkinId,
      responderId: r1.id,
      responderName: 'R1',
      type: 'VoiceNoteSent',
    });

    expect(tp.type).toBe('VoiceNoteSent');
    expect(acks).toEqual([`R1->${author.id}`]);
  });

  it('supports multiple responders on the same check-in (no dedupe)', async () => {
    const { r1, r2, checkinId } = await distressCheckin();
    const svc = new TouchpointService();
    svc.setAckDispatcher({ async ackTarget() {} });

    await svc.log({ checkinId, responderId: r1.id, responderName: 'R1', type: 'CallMade' });
    await svc.log({ checkinId, responderId: r2.id, responderName: 'R2', type: 'PrayedFor' });

    const list = await svc.list(checkinId, r1.id);
    expect(list).toHaveLength(2);
    expect(list.map((t) => t.type).sort()).toEqual(['CallMade', 'PrayedFor']);
  });

  it('does not ack when the author responds to their own check-in', async () => {
    const { author, checkinId } = await distressCheckin();
    const acks: string[] = [];
    const svc = new TouchpointService();
    svc.setAckDispatcher({ async ackTarget(i) { acks.push(i.targetUserId); } });

    await svc.log({ checkinId, responderId: author.id, responderName: 'Author', type: 'PrayedFor' });
    expect(acks).toHaveLength(0);
  });

  it('rejects outreach from a non-member', async () => {
    const { checkinId } = await distressCheckin();
    const outsider = await makeUser('Outsider');
    const svc = new TouchpointService();
    svc.setAckDispatcher({ async ackTarget() {} });
    await expect(
      svc.log({ checkinId, responderId: outsider.id, responderName: 'X', type: 'TextSent' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects a touchpoint on an unknown check-in', async () => {
    const { r1 } = await distressCheckin();
    const svc = new TouchpointService();
    svc.setAckDispatcher({ async ackTarget() {} });
    await expect(
      svc.log({
        checkinId: '00000000-0000-0000-0000-000000000000',
        responderId: r1.id,
        responderName: 'R1',
        type: 'TextSent',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('TouchpointService.list', () => {
  it('rejects listing for a non-member', async () => {
    const { checkinId } = await distressCheckin();
    const outsider = await makeUser('Outsider');
    const svc = new TouchpointService();
    await expect(svc.list(checkinId, outsider.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('returns entries oldest-first with responder names', async () => {
    const { r1, r2, checkinId } = await distressCheckin();
    const svc = new TouchpointService();
    svc.setAckDispatcher({ async ackTarget() {} });
    await svc.log({ checkinId, responderId: r1.id, responderName: 'R1', type: 'CallMade' });
    await svc.log({ checkinId, responderId: r2.id, responderName: 'R2', type: 'TextSent' });
    const list = await svc.list(checkinId, r1.id);
    expect(list[0]!.responder_name).toBe('R1');
    expect(list[1]!.responder_name).toBe('R2');
  });
});
