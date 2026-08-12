import { and, eq, isNull } from 'drizzle-orm';
import type { DB } from '../../config/db';
import { careGratitudes, checkins, touchpointLogs } from '../../db/schema';

type Executor = DB | Parameters<Parameters<DB['transaction']>[0]>[0];

export class GratitudeRepo {
  /** Resolve the circle + author of a check-in (who's allowed to say thanks). */
  async checkinContext(
    exec: Executor,
    checkinId: string,
  ): Promise<{ circleId: string; targetUserId: string } | null> {
    const [row] = await exec
      .select({ circleId: checkins.circleId, targetUserId: checkins.userId })
      .from(checkins)
      .where(eq(checkins.id, checkinId))
      .limit(1);
    return row ?? null;
  }

  /** Distinct responders on this check-in who haven't been thanked yet. */
  async unthankedResponderIds(exec: Executor, checkinId: string): Promise<string[]> {
    const rows = await exec
      .selectDistinct({ responderId: touchpointLogs.responderId })
      .from(touchpointLogs)
      .leftJoin(
        careGratitudes,
        and(
          eq(careGratitudes.checkinId, touchpointLogs.checkinId),
          eq(careGratitudes.responderId, touchpointLogs.responderId),
        ),
      )
      .where(and(eq(touchpointLogs.checkinId, checkinId), isNull(careGratitudes.id)));
    return rows.map((r) => r.responderId);
  }

  /** Idempotent per (checkin, responder) — a repeat thanks for someone
   * already thanked (via the bulk "Thank you!" or a per-message/voice-note
   * one) is a silent no-op rather than a unique-constraint error. */
  async insertMany(exec: Executor, checkinId: string, responderIds: string[]): Promise<void> {
    if (responderIds.length === 0) return;
    await exec
      .insert(careGratitudes)
      .values(responderIds.map((responderId) => ({ checkinId, responderId })))
      .onConflictDoNothing();
  }
}

export const gratitudeRepo = new GratitudeRepo();
