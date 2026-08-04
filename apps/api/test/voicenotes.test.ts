import { describe, it, expect } from 'vitest';
import { makeUser, makeCircleWith } from './setup';
import { CheckInService } from '../src/modules/checkins/checkins.service';
import { CircleNotificationService } from '../src/modules/notifications/circle-notification.service';
import { TouchpointService } from '../src/modules/touchpoints/touchpoints.service';
import { VoiceNoteService } from '../src/modules/voicenotes/voicenotes.service';

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

function noteSpy() {
  const notified: Array<{ targetUserId: string; senderName: string; checkinId: string }> = [];
  const svc = new VoiceNoteService();
  svc.setDispatcher({ async notifyVoiceNote(i) { notified.push(i); } });
  return { svc, notified };
}

describe('VoiceNoteService.send', () => {
  it('lets a responder send a voice note and notifies the author', async () => {
    const { author, r1, checkinId } = await distressCheckin();
    const { svc, notified } = noteSpy();

    const note = await svc.send({
      checkinId,
      senderId: r1.id,
      senderName: 'R1',
      audioBase64: 'ZmFrZS1hdWRpby1ieXRlcw==',
      mimeType: 'audio/m4a',
      durationMs: 12_000,
    });

    expect(note.sender_name).toBe('R1');
    expect(note.duration_ms).toBe(12_000);
    expect(notified).toEqual([{ targetUserId: author.id, senderName: 'R1', checkinId }]);
  });

  it('also logs a VoiceNoteSent touchpoint so "already reached out" stays accurate', async () => {
    const { r1, checkinId } = await distressCheckin();
    const { svc } = noteSpy();
    await svc.send({
      checkinId,
      senderId: r1.id,
      senderName: 'R1',
      audioBase64: 'ZmFrZQ==',
      mimeType: 'audio/m4a',
      durationMs: 5_000,
    });

    const tpSvc = new TouchpointService();
    tpSvc.setAckDispatcher({ async ackTarget() {} });
    const touchpoints = await tpSvc.list(checkinId, r1.id);
    expect(touchpoints.map((t) => t.type)).toEqual(['VoiceNoteSent']);
  });

  it('rejects a clip over the 30s cap', async () => {
    const { r1, checkinId } = await distressCheckin();
    const { svc } = noteSpy();
    await expect(
      svc.send({
        checkinId,
        senderId: r1.id,
        senderName: 'R1',
        audioBase64: 'ZmFrZQ==',
        mimeType: 'audio/m4a',
        durationMs: 30_001,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('rejects the author sending a voice note to their own check-in', async () => {
    const { author, checkinId } = await distressCheckin();
    const { svc } = noteSpy();
    await expect(
      svc.send({
        checkinId,
        senderId: author.id,
        senderName: 'Author',
        audioBase64: 'ZmFrZQ==',
        mimeType: 'audio/m4a',
        durationMs: 5_000,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects a non-member', async () => {
    const { checkinId } = await distressCheckin();
    const outsider = await makeUser('Outsider');
    const { svc } = noteSpy();
    await expect(
      svc.send({
        checkinId,
        senderId: outsider.id,
        senderName: 'Outsider',
        audioBase64: 'ZmFrZQ==',
        mimeType: 'audio/m4a',
        durationMs: 5_000,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects an unknown check-in', async () => {
    const { r1 } = await distressCheckin();
    const { svc } = noteSpy();
    await expect(
      svc.send({
        checkinId: '00000000-0000-0000-0000-000000000000',
        senderId: r1.id,
        senderName: 'R1',
        audioBase64: 'ZmFrZQ==',
        mimeType: 'audio/m4a',
        durationMs: 5_000,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('VoiceNoteService.list', () => {
  it('is visible only to the check-in author, not the sender or other members', async () => {
    const { author, r1, r2, checkinId } = await distressCheckin();
    const { svc } = noteSpy();
    await svc.send({
      checkinId,
      senderId: r1.id,
      senderName: 'R1',
      audioBase64: 'ZmFrZQ==',
      mimeType: 'audio/m4a',
      durationMs: 5_000,
    });

    const list = await svc.list(checkinId, author.id);
    expect(list).toHaveLength(1);
    expect(list[0]!.sender_name).toBe('R1');

    await expect(svc.list(checkinId, r1.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(svc.list(checkinId, r2.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects a non-member entirely', async () => {
    const { checkinId } = await distressCheckin();
    const outsider = await makeUser('Outsider');
    const { svc } = noteSpy();
    await expect(svc.list(checkinId, outsider.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('VoiceNoteService.markReceived', () => {
  it('removes the note from the pending list once acknowledged', async () => {
    const { author, r1, checkinId } = await distressCheckin();
    const { svc } = noteSpy();
    const note = await svc.send({
      checkinId,
      senderId: r1.id,
      senderName: 'R1',
      audioBase64: 'ZmFrZQ==',
      mimeType: 'audio/m4a',
      durationMs: 5_000,
    });

    expect(await svc.list(checkinId, author.id)).toHaveLength(1);
    await svc.markReceived(checkinId, note.id, author.id);
    expect(await svc.list(checkinId, author.id)).toHaveLength(0);
  });

  it('is idempotent — acknowledging twice does not throw', async () => {
    const { author, r1, checkinId } = await distressCheckin();
    const { svc } = noteSpy();
    const note = await svc.send({
      checkinId,
      senderId: r1.id,
      senderName: 'R1',
      audioBase64: 'ZmFrZQ==',
      mimeType: 'audio/m4a',
      durationMs: 5_000,
    });

    await svc.markReceived(checkinId, note.id, author.id);
    await svc.markReceived(checkinId, note.id, author.id);
    expect(await svc.list(checkinId, author.id)).toHaveLength(0);
  });

  it('rejects a caller who is not the check-in author', async () => {
    const { r1, checkinId } = await distressCheckin();
    const { svc } = noteSpy();
    const note = await svc.send({
      checkinId,
      senderId: r1.id,
      senderName: 'R1',
      audioBase64: 'ZmFrZQ==',
      mimeType: 'audio/m4a',
      durationMs: 5_000,
    });

    await expect(svc.markReceived(checkinId, note.id, r1.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('rejects an unknown note id', async () => {
    const { author, checkinId } = await distressCheckin();
    const { svc } = noteSpy();
    await expect(
      svc.markReceived(checkinId, '00000000-0000-0000-0000-000000000000', author.id),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
