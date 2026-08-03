import { describe, it, expect } from 'vitest';
import { db, makeCircleWith, makeCheckin, touchpointLogs } from './setup';
import { runCareGapLoop, type CareGapDispatcher } from '../src/workers/care-gap-loop';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

function careGapSpy() {
  const nudges: Array<{ checkinId: string; circleId: string; targetName: string; recipientIds: string[] }> = [];
  const dispatcher: CareGapDispatcher = { async careGapNudge(i) { nudges.push(i); } };
  return { dispatcher, nudges };
}

describe('runCareGapLoop', () => {
  it('nudges the circle when a distress checkin has no touchpoint after the window', async () => {
    const { circle, users: [maya, marcus] } = await makeCircleWith(['Maya', 'Marcus']);
    await makeCheckin(circle.id, maya!.id, {
      emotionalState: 'Heavy',
      createdAt: new Date(Date.now() - 2 * DAY),
    });

    const { dispatcher, nudges } = careGapSpy();
    const nudged = await runCareGapLoop(dispatcher);

    expect(nudged).toBe(1);
    expect(nudges).toHaveLength(1);
    expect(nudges[0]!.targetName).toBe('Maya');
    expect(nudges[0]!.recipientIds).toEqual([marcus!.id]);
  });

  it('does not nudge before the window has elapsed', async () => {
    const { circle, users: [maya] } = await makeCircleWith(['Maya', 'Marcus']);
    await makeCheckin(circle.id, maya!.id, {
      emotionalState: 'Heavy',
      createdAt: new Date(Date.now() - HOUR),
    });

    const { dispatcher, nudges } = careGapSpy();
    await runCareGapLoop(dispatcher);
    expect(nudges).toHaveLength(0);
  });

  it('does not nudge a calm checkin', async () => {
    const { circle, users: [maya] } = await makeCircleWith(['Maya', 'Marcus']);
    await makeCheckin(circle.id, maya!.id, { createdAt: new Date(Date.now() - 2 * DAY) });

    const { dispatcher, nudges } = careGapSpy();
    await runCareGapLoop(dispatcher);
    expect(nudges).toHaveLength(0);
  });

  it('does not nudge once a touchpoint has been logged', async () => {
    const { circle, users: [maya, marcus] } = await makeCircleWith(['Maya', 'Marcus']);
    const checkin = await makeCheckin(circle.id, maya!.id, {
      emotionalState: 'Heavy',
      createdAt: new Date(Date.now() - 2 * DAY),
    });
    await db.insert(touchpointLogs).values({
      checkinId: checkin.id,
      responderId: marcus!.id,
      type: 'PrayedFor',
    });

    const { dispatcher, nudges } = careGapSpy();
    await runCareGapLoop(dispatcher);
    expect(nudges).toHaveLength(0);
  });

  it('does not nudge an expired checkin', async () => {
    const { circle, users: [maya] } = await makeCircleWith(['Maya', 'Marcus']);
    await makeCheckin(circle.id, maya!.id, {
      emotionalState: 'Heavy',
      createdAt: new Date(Date.now() - 20 * DAY),
      expiresAt: new Date(Date.now() - 6 * DAY),
    });

    const { dispatcher, nudges } = careGapSpy();
    await runCareGapLoop(dispatcher);
    expect(nudges).toHaveLength(0);
  });

  it('only nudges once across repeated loop ticks (idempotent)', async () => {
    const { circle, users: [maya] } = await makeCircleWith(['Maya', 'Marcus']);
    await makeCheckin(circle.id, maya!.id, {
      emotionalState: 'Heavy',
      createdAt: new Date(Date.now() - 2 * DAY),
    });

    const { dispatcher, nudges } = careGapSpy();
    await runCareGapLoop(dispatcher);
    await runCareGapLoop(dispatcher);
    expect(nudges).toHaveLength(1);
  });

  it('does not nudge a lone-member circle (no one to reach)', async () => {
    const { circle, users: [solo] } = await makeCircleWith(['Solo']);
    await makeCheckin(circle.id, solo!.id, {
      emotionalState: 'Heavy',
      createdAt: new Date(Date.now() - 2 * DAY),
    });

    const { dispatcher, nudges } = careGapSpy();
    await runCareGapLoop(dispatcher);
    expect(nudges).toHaveLength(0);
  });
});
