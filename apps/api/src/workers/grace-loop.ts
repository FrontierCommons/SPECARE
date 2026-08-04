import { and, eq, lt, or, isNull } from 'drizzle-orm';
import { db, type DB } from '../config/db';
import { users, circleMemberships } from '../db/schema';
import { notifierService } from '../delivery/notifier.service';

const FOURTEEN_DAYS_MS = 14 * 24 * 3600 * 1000;

export interface GraceDispatcher {
  graceNudge(input: {
    circleId: string;
    quietMemberName: string;
    recipientIds: string[];
  }): Promise<void>;
}

/**
 * Core grace logic, decoupled from BullMQ for testability.
 * Finds users idle > 14 days (and not already paused), pauses their prompts,
 * and nudges each of their circles toward them (care flows TO them, not guilt).
 * Returns the count of users processed.
 */
export async function runGraceLoop(
  dispatcher: GraceDispatcher,
  database: DB = db,
  now: Date = new Date(),
): Promise<number> {
  const cutoff = new Date(now.getTime() - FOURTEEN_DAYS_MS);

  const stale = await database
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(
      and(
        eq(users.notificationsPaused, false),
        or(lt(users.lastCheckinAt, cutoff), isNull(users.lastCheckinAt)),
      ),
    );

  let processed = 0;
  for (const u of stale) {
    // Never nudge for a user who has never checked in AND just registered:
    // require a real gap. isNull(lastCheckinAt) users who registered < 14d ago
    // are excluded by created_at guard.
    const [full] = await database.select().from(users).where(eq(users.id, u.id)).limit(1);
    if (!full) continue;
    const reference = full.lastCheckinAt ?? full.createdAt;
    if (reference.getTime() > cutoff.getTime()) continue;

    await database.update(users).set({ notificationsPaused: true }).where(eq(users.id, u.id));

    // Nudge each circle the quiet user belongs to.
    const memberships = await database
      .select({ circleId: circleMemberships.circleId })
      .from(circleMemberships)
      .where(eq(circleMemberships.userId, u.id));

    for (const m of memberships) {
      const others = await database
        .select({ userId: circleMemberships.userId })
        .from(circleMemberships)
        .where(eq(circleMemberships.circleId, m.circleId));
      const recipientIds = others.map((o) => o.userId).filter((id) => id !== u.id);
      if (recipientIds.length === 0) continue;

      await dispatcher.graceNudge({
        circleId: m.circleId,
        quietMemberName: u.name,
        recipientIds,
      });
    }
    processed++;
  }

  return processed;
}

/** Default dispatcher backed by the notifier. */
export const graceDispatcher: GraceDispatcher = {
  async graceNudge(input) {
    await notifierService.graceNudge(input);
  },
};
