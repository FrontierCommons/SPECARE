import { and, eq, ne } from 'drizzle-orm';
import type { DB } from '../../config/db';
import {
  circleNotifications,
  circleMemberships,
  type CircleNotificationRow,
} from '../../db/schema';

/**
 * Accepts either the base `db` or a transaction handle so this repo can run
 * inside the check-in transaction (atomic checkin + notification).
 */
type Executor = DB | Parameters<Parameters<DB['transaction']>[0]>[0];

export interface CreateCircleNotificationInput {
  checkinId: string;
  targetUserId: string;
  circleId: string;
  verse: string;
}

export class CircleNotificationRepo {
  async create(
    exec: Executor,
    input: CreateCircleNotificationInput,
  ): Promise<CircleNotificationRow> {
    const [row] = await exec
      .insert(circleNotifications)
      .values({
        checkinId: input.checkinId,
        targetUserId: input.targetUserId,
        circleId: input.circleId,
        verse: input.verse,
      })
      .returning();
    return row!;
  }

  /**
   * Every *other* member of the circle — the recipients of a distress alert.
   * No assignment; the whole circle is notified.
   */
  async recipientIds(
    exec: Executor,
    circleId: string,
    excludeUserId: string,
  ): Promise<string[]> {
    const rows = await exec
      .select({ userId: circleMemberships.userId })
      .from(circleMemberships)
      .where(
        and(
          eq(circleMemberships.circleId, circleId),
          ne(circleMemberships.userId, excludeUserId),
        ),
      );
    return rows.map((r) => r.userId);
  }

  async findById(exec: Executor, id: string): Promise<CircleNotificationRow | null> {
    const [row] = await exec
      .select()
      .from(circleNotifications)
      .where(eq(circleNotifications.id, id))
      .limit(1);
    return row ?? null;
  }
}

export const circleNotificationRepo = new CircleNotificationRepo();
