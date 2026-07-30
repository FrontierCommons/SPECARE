import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, makeUser, makeCircleWith, addMember, makeCircle } from './setup';
import { users } from '../src/db/schema';
import { runGraceLoop, type GraceDispatcher } from '../src/workers/grace-loop';
import { runPromptScheduler, type PromptSender, PROMPT_LOCAL_HOUR } from '../src/workers/prompt-scheduler';

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

  it('fires for a UTC user exactly at the target local hour', async () => {
    const u = await makeUser('UtcUser', { timezone: 'UTC' });
    const { s, fired } = sender();
    const now = new Date(Date.UTC(2026, 0, 15, PROMPT_LOCAL_HOUR, 0, 0));
    await runPromptScheduler(s, db, now);
    expect(fired).toContain(u.id);
  });

  it('does not fire when the local hour does not match', async () => {
    const u = await makeUser('UtcUser', { timezone: 'UTC' });
    const { s, fired } = sender();
    const now = new Date(Date.UTC(2026, 0, 15, (PROMPT_LOCAL_HOUR + 5) % 24, 0, 0));
    await runPromptScheduler(s, db, now);
    expect(fired).not.toContain(u.id);
  });

  it('respects timezone: fires for Manila user at their 9am, not UTC 9am', async () => {
    // Manila is UTC+8; their 09:00 is 01:00 UTC.
    const manila = await makeUser('Manila', { timezone: 'Asia/Manila' });
    const { s, fired } = sender();
    const utc0100 = new Date(Date.UTC(2026, 0, 15, 1, 0, 0));
    await runPromptScheduler(s, db, utc0100);
    expect(fired).toContain(manila.id);
  });

  it('skips paused users even at the right hour', async () => {
    const u = await makeUser('Paused', { timezone: 'UTC' });
    await db.update(users).set({ notificationsPaused: true }).where(eq(users.id, u.id));
    const { s, fired } = sender();
    const now = new Date(Date.UTC(2026, 0, 15, PROMPT_LOCAL_HOUR, 0, 0));
    await runPromptScheduler(s, db, now);
    expect(fired).not.toContain(u.id);
  });
});
