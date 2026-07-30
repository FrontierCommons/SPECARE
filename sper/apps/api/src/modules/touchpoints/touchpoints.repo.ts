import { and, asc, eq } from 'drizzle-orm';
import type { DB } from '../../config/db';
import {
  touchpointLogs,
  checkins,
  circleMemberships,
  users,
  type TouchpointLogRow,
} from '../../db/schema';
import type { TouchpointType } from '@sper/shared-types';

type Executor = DB | Parameters<Parameters<DB['transaction']>[0]>[0];

export interface TouchpointWithResponder extends TouchpointLogRow {
  responderName: string;
}

export class TouchpointRepo {
  async insert(
    exec: Executor,
    values: { checkinId: string; responderId: string; type: TouchpointType },
  ): Promise<TouchpointLogRow> {
    const [row] = await exec.insert(touchpointLogs).values(values).returning();
    return row!;
  }

  /** Resolve the circle + target (author) of a check-in. */
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

  async isMember(exec: Executor, circleId: string, userId: string): Promise<boolean> {
    const [row] = await exec
      .select({ id: circleMemberships.id })
      .from(circleMemberships)
      .where(
        and(
          eq(circleMemberships.circleId, circleId),
          eq(circleMemberships.userId, userId),
        ),
      )
      .limit(1);
    return !!row;
  }

  /** All outreach logged for a check-in, oldest first, with responder names. */
  async listByCheckin(
    exec: Executor,
    checkinId: string,
  ): Promise<TouchpointWithResponder[]> {
    const rows = await exec
      .select({
        id: touchpointLogs.id,
        checkinId: touchpointLogs.checkinId,
        responderId: touchpointLogs.responderId,
        type: touchpointLogs.type,
        createdAt: touchpointLogs.createdAt,
        responderName: users.name,
      })
      .from(touchpointLogs)
      .innerJoin(users, eq(users.id, touchpointLogs.responderId))
      .where(eq(touchpointLogs.checkinId, checkinId))
      .orderBy(asc(touchpointLogs.createdAt));
    return rows as TouchpointWithResponder[];
  }
}

export const touchpointRepo = new TouchpointRepo();
