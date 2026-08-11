import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, makeUser, makeCircleWith, addMember, makeCircle } from './setup';
import { users } from '../src/db/schema';
import { runGraceLoop, type GraceDispatcher } from '../src/workers/grace-loop';
import { runPromptScheduler, type PromptSender, FREQUENCY_INTERVAL_HOURS } from '../src/workers/prompt-scheduler';

const DAY = 24 * 3600 * 1000;

function graceSpy() {
  const nudges: Array<{ circleId: string; quietMemberName: string; recipientIds: string[] }> = [];
  const dispatcher: GraceDispatcher = { async graceNudge(i) { nudges.push(i); } };
  return { dispatcher, nudges };
}

describe('runGraceLoop', () => {
  it('pauses a user idle >14 days and nudges their circle toward them', async () => {
    const { circle, users: [quiet, active] } = await makeCircleWith(['Quiet', 'Active']);
    await db
      .update(users)
      .set({ lastCheckinAt: new Date(Date.now() - 20 * DAY), notificationsPaused: false })
      .where(eq(users.id, quiet!.id));
    await db.update(users).set({ lastCheckinAt: new Date() }).where(eq(users.id, active!.id));

    const { dispatcher, nudges } = graceSpy();
    const processed = await runGraceLoop(dispatcher);

    const [q] = await db.select().from(users).where(eq(users.id, quiet!.id));
    expect(processed).toBeGreaterThanOrEqual(1);
    expect(q!.notificationsPaused).toBe(true);
    expect(nudges.some((n) => n.recipientIds.includes(active!.id) && !n.recipientIds.includes(quiet!.id))).toBe(true);
  });

  it('does not touch a user who checked in recently', async () => {
    const { users: [u] } = await makeCircleWith(['Fresh']);
    await db.update(users).set({ lastCheckinAt: new Date() }).where(eq(users.id, u!.id));
    const { dispatcher, nudges } = graceSpy();
    await runGraceLoop(dispatcher);
    const [after] = await db.select().from(users).where(eq(users.id, u!.id));
    expect(after!.notificationsPaused).toBe(false);
    expect(nudges).toHaveLength(0);
  });

  it('skips a user already paused', async () => {
    const { users: [u] } = await makeCircleWith(['AlreadyPaused']);
    await db
      .update(users)
      .set({ lastCheckinAt: new Date(Date.now() - 30 * DAY), notificationsPaused: true })
      .where(eq(users.id, u!.id));
    const { dispatcher, nudges } = graceSpy();
    await runGraceLoop(dispatcher);
    expect(nudges).toHaveLength(0); // already paused -> not re-processed
  });

  it('does not nudge a freshly-registered user who never checked in (created_at guard)', async () => {
    const circle = await makeCircle();
    const fresh = await makeUser('BrandNew'); // created_at = now, lastCheckinAt null
    await addMember(circle.id, fresh.id, true);
    const { dispatcher, nudges } = graceSpy();
    await runGraceLoop(dispatcher);
    expect(nudges).toHaveLength(0);
  });

  it('does not nudge an empty circle (quiet user is the only member)', async () => {
    const circle = await makeCircle();
    const solo = await makeUser('Solo');
    await addMember(circle.id, solo.id, true);
    await db
      .update(users)
      .set({ lastCheckinAt: new Date(Date.now() - 30 * DAY) })
      .where(eq(users.id, solo.id));
    const { dispatcher, nudges } = graceSpy();
    const processed = await runGraceLoop(dispatcher);
    expect(processed).toBe(1); // still paused
    expect(nudges).toHaveLength(0); // nobody to nudge
  });
});

describe('runPromptScheduler', () => {
  function sender() {
    const fired: string[] = [];
    const s: PromptSender = { async sendPrompt(i) { fired.push(i.userId); } };
    return { s, fired };
  }

  it('fires once a check-in-plus-interval falls due, off the user\'s own last check-in', async () => {
    const u = await makeUser('DueUser');
    const intervalHours = FREQUENCY_INTERVAL_HOURS.twice; // default frequency
    await db
      .update(users)
      .set({ lastCheckinAt: new Date(Date.now() - intervalHours * 3600_000) })
      .where(eq(users.id, u.id));
    const { s, fired } = sender();
    await runPromptScheduler(s, db, new Date());
    expect(fired).toContain(u.id);
  });

  it('does not fire well before the interval is up', async () => {
    const u = await makeUser('NotYetDue');
    await db.update(users).set({ lastCheckinAt: new Date() }).where(eq(users.id, u.id));
    const { s, fired } = sender();
    await runPromptScheduler(s, db, new Date());
    expect(fired).not.toContain(u.id);
  });

  it('is due only once per interval, not every hour once overdue', async () => {
    const u = await makeUser('LongOverdue');
    const intervalHours = FREQUENCY_INTERVAL_HOURS.twice;
    // Three full interval cycles + a few hours overdue — well past due, but
    // outside the one-hour window right at n*interval.
    await db
      .update(users)
      .set({ lastCheckinAt: new Date(Date.now() - (3 * intervalHours + 3) * 3600_000) })
      .where(eq(users.id, u.id));
    const { s, fired } = sender();
    await runPromptScheduler(s, db, new Date());
    expect(fired).not.toContain(u.id);
  });

  it('falls back to account creation time for a user who has never checked in', async () => {
    const circle = await makeCircle();
    const fresh = await makeUser('NeverCheckedIn');
    await addMember(circle.id, fresh.id, true);
    const intervalHours = FREQUENCY_INTERVAL_HOURS.twice; // default frequency, lastCheckinAt still null
    await db
      .update(users)
      .set({ createdAt: new Date(Date.now() - intervalHours * 3600_000) })
      .where(eq(users.id, fresh.id));
    const { s, fired } = sender();
    await runPromptScheduler(s, db, new Date());
    expect(fired).toContain(fresh.id);
  });

  it('is timezone-agnostic: two users due at the same elapsed time both fire regardless of timezone', async () => {
    const intervalHours = FREQUENCY_INTERVAL_HOURS.twice;
    const dueAt = new Date(Date.now() - intervalHours * 3600_000);
    const utcUser = await makeUser('StillUtc', { timezone: 'UTC' });
    const manilaUser = await makeUser('StillManila', { timezone: 'Asia/Manila' });
    await db.update(users).set({ lastCheckinAt: dueAt }).where(eq(users.id, utcUser.id));
    await db.update(users).set({ lastCheckinAt: dueAt }).where(eq(users.id, manilaUser.id));
    const { s, fired } = sender();
    await runPromptScheduler(s, db, new Date());
    expect(fired).toContain(utcUser.id);
    expect(fired).toContain(manilaUser.id);
  });

  it('skips paused users even when due', async () => {
    const u = await makeUser('Paused');
    const intervalHours = FREQUENCY_INTERVAL_HOURS.twice;
    await db
      .update(users)
      .set({ lastCheckinAt: new Date(Date.now() - intervalHours * 3600_000), notificationsPaused: true })
      .where(eq(users.id, u.id));
    const { s, fired } = sender();
    await runPromptScheduler(s, db, new Date());
    expect(fired).not.toContain(u.id);
  });
});
