import { and, asc, eq, isNull } from 'drizzle-orm';
import type { DB } from '../../config/db';
import { checkinMessages, checkins, circleMemberships, users, type CheckinMessageRow } from '../../db/schema';

type Executor = DB | Parameters<Parameters<DB['transaction']>[0]>[0];

export interface CheckinMessageWithSender extends CheckinMessageRow {
  senderName: string;
}

export class MessageRepo {
  async insert(
    exec: Executor,
    values: { checkinId: string; senderId: string; body: string },
  ): Promise<CheckinMessageRow> {
    const [row] = await exec.insert(checkinMessages).values(values).returning();
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
      .where(and(eq(circleMemberships.circleId, circleId), eq(circleMemberships.userId, userId)))
      .limit(1);
    return !!row;
  }

  /** Every message for a check-in, pending and already-thanked alike,
   * oldest first — the caller buckets by `receivedAt` (New vs Already
   * responded), same convention as Care/Share Cards. */
  async listAll(exec: Executor, checkinId: string): Promise<CheckinMessageWithSender[]> {
    const rows = await exec
      .select({
        id: checkinMessages.id,
        checkinId: checkinMessages.checkinId,
        senderId: checkinMessages.senderId,
        body: checkinMessages.body,
        createdAt: checkinMessages.createdAt,
        receivedAt: checkinMessages.receivedAt,
        senderName: users.name,
      })
      .from(checkinMessages)
      .innerJoin(users, eq(users.id, checkinMessages.senderId))
      .where(eq(checkinMessages.checkinId, checkinId))
      .orderBy(asc(checkinMessages.createdAt));
    return rows as CheckinMessageWithSender[];
  }

  async findById(exec: Executor, id: string): Promise<CheckinMessageRow | null> {
    const [row] = await exec.select().from(checkinMessages).where(eq(checkinMessages.id, id)).limit(1);
    return row ?? null;
  }

  /** Idempotent: marking an already-received message again is a no-op. */
  async markReceived(exec: Executor, id: string): Promise<void> {
    await exec
      .update(checkinMessages)
      .set({ receivedAt: new Date() })
      .where(and(eq(checkinMessages.id, id), isNull(checkinMessages.receivedAt)));
  }
}

export const messageRepo = new MessageRepo();
