import { describe, it, expect } from 'vitest';
import { makeCircleWith, makeUser, addMember } from './setup';
import { CheckInService } from '../src/modules/checkins/checkins.service';
import { CircleNotificationService } from '../src/modules/notifications/circle-notification.service';

function checkins() {
  const notifications = new CircleNotificationService();
  notifications.setDispatcher({ async dispatchDistress() {} });
  return new CheckInService(undefined, notifications);
}

async function positiveCheckinWithNote() {
  const { circle, users: [author, other] } = await makeCircleWith(['Author', 'Other']);
  const svc = checkins();
  const res = await svc.submit({
    userId: author!.id,
    circleId: circle.id,
    spiritual_state: 'Thriving',
    physical_state: 'Steady',
    emotional_state: 'Thriving',
    vocational_state: 'Steady',
    relational_state: 'Thriving',
    optional_note: 'Spiritual: Close and present',
  });
  return { circle, author: author!, other: other!, checkinId: res.checkin.id, svc };
}

async function positiveCheckinWithoutNote() {
  const { circle, users: [author, other] } = await makeCircleWith(['Author', 'Other']);
  const svc = checkins();
  const res = await svc.submit({
    userId: author!.id,
    circleId: circle.id,
    spiritual_state: 'Thriving',
    physical_state: 'Steady',
    emotional_state: 'Thriving',
    vocational_state: 'Steady',
    relational_state: 'Thriving',
  });
  return { circle, author: author!, other: other!, checkinId: res.checkin.id, svc };
}

async function distressCheckinWithNote() {
  const { circle, users: [author, other] } = await makeCircleWith(['Author', 'Other']);
  const svc = checkins();
  const res = await svc.submit({
    userId: author!.id,
    circleId: circle.id,
    spiritual_state: 'Steady',
    physical_state: 'Steady',
    emotional_state: 'Heavy',
    vocational_state: 'Steady',
    relational_state: 'Steady',
    optional_note: 'Vocational: Making slow progress',
  });
  return { circle, author: author!, other: other!, checkinId: res.checkin.id, svc };
}

describe('CheckInService.shareCards', () => {
  it('surfaces an all-positive check-in that has a note', async () => {
    const { circle, author, checkinId, other, svc } = await positiveCheckinWithNote();
    const cards = await svc.shareCards(circle.id, other.id);
    const card = cards.find((c) => c.checkin_id === checkinId);
    expect(card).toBeDefined();
    expect(card!.target_user_id).toBe(author.id);
    expect(card!.optional_note).toContain('Close and present');
    expect(card!.like_count).toBe(0);
    expect(card!.liked_by_me).toBe(false);
  });

  it('does not surface an all-positive check-in with no note', async () => {
    const { circle, checkinId, other, svc } = await positiveCheckinWithoutNote();
    const cards = await svc.shareCards(circle.id, other.id);
    expect(cards.find((c) => c.checkin_id === checkinId)).toBeUndefined();
  });

  it('does not surface a distressed check-in, even with a note — that is a Care Card', async () => {
    const { circle, checkinId, other, svc } = await distressCheckinWithNote();
    const shareCards = await svc.shareCards(circle.id, other.id);
    expect(shareCards.find((c) => c.checkin_id === checkinId)).toBeUndefined();

    const careCards = await svc.careCards(circle.id, other.id);
    expect(careCards.find((c) => c.checkin_id === checkinId)).toBeDefined();
  });

  it('rejects a non-member', async () => {
    const { circle, svc } = await positiveCheckinWithNote();
    const { users: [stranger] } = await makeCircleWith(['Stranger']);
    await expect(svc.shareCards(circle.id, stranger!.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('CheckInService.toggleLike', () => {
  it('likes on first call, unlikes on the second', async () => {
    const { checkinId, other, svc } = await positiveCheckinWithNote();

    const liked = await svc.toggleLike(checkinId, other.id);
    expect(liked).toEqual({ liked: true, like_count: 1 });

    const unliked = await svc.toggleLike(checkinId, other.id);
    expect(unliked).toEqual({ liked: false, like_count: 0 });
  });

  it('counts likes from multiple circle members independently', async () => {
    const { circle, author, other, checkinId, svc } = await positiveCheckinWithNote();
    const third = await makeUser('Third');
    await addMember(circle.id, third.id, true);

    await svc.toggleLike(checkinId, other.id);
    const afterOne = await svc.toggleLike(checkinId, third.id);
    expect(afterOne).toEqual({ liked: true, like_count: 2 });

    const cards = await svc.shareCards(circle.id, author.id);
    expect(cards.find((c) => c.checkin_id === checkinId)?.like_count).toBe(2);
  });

  it('reflects liked_by_me per-viewer, not globally', async () => {
    const { circle, author, other, checkinId, svc } = await positiveCheckinWithNote();
    await svc.toggleLike(checkinId, other.id);

    const asLiker = await svc.shareCards(circle.id, other.id);
    expect(asLiker.find((c) => c.checkin_id === checkinId)?.liked_by_me).toBe(true);

    const asAuthor = await svc.shareCards(circle.id, author.id);
    expect(asAuthor.find((c) => c.checkin_id === checkinId)?.liked_by_me).toBe(false);
  });

  it('also raises like_count on the equivalent Care Card', async () => {
    const { circle, other, checkinId, svc } = await distressCheckinWithNote();
    await svc.toggleLike(checkinId, other.id);
    const cards = await svc.careCards(circle.id, other.id);
    expect(cards.find((c) => c.checkin_id === checkinId)?.like_count).toBe(1);
    expect(cards.find((c) => c.checkin_id === checkinId)?.liked_by_me).toBe(true);
  });

  it('rejects a non-member', async () => {
    const { checkinId, svc } = await positiveCheckinWithNote();
    const { users: [stranger] } = await makeCircleWith(['Stranger']);
    await expect(svc.toggleLike(checkinId, stranger!.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects an unknown check-in', async () => {
    const { other, svc } = await positiveCheckinWithNote();
    await expect(
      svc.toggleLike('00000000-0000-0000-0000-000000000000', other.id),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
