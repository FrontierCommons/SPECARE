import { and, eq } from 'drizzle-orm';
import { db, type DB } from '../config/db';
import { idempotencyKeys } from '../db/schema';

type Executor = DB | Parameters<Parameters<DB['transaction']>[0]>[0];

/**
 * Exactly-once send guard. The unique index uniq_idempotency_send on
 * (checkin_id, recipient_id) is the real enforcer; this helper turns a
 * duplicate insert into a boolean instead of an exception.
 *
 * Returns true if THIS caller won the claim (should send), false if a claim
 * already existed (skip — someone already sent, or is sending).
 */
export async function claimSend(
  checkinId: string,
  recipientId: string,
  exec: Executor = db,
): Promise<boolean> {
  const inserted = await exec
    .insert(idempotencyKeys)
    .values({ checkinId, recipientId })
    .onConflictDoNothing({
      target: [idempotencyKeys.checkinId, idempotencyKeys.recipientId],
    })
    .returning({ id: idempotencyKeys.id });
  return inserted.length > 0;
}

/** Whether a send has already been claimed for this pair. */
export async function isClaimed(
  checkinId: string,
  recipientId: string,
  exec: Executor = db,
): Promise<boolean> {
  const [row] = await exec
    .select({ id: idempotencyKeys.id })
    .from(idempotencyKeys)
    .where(
      and(
        eq(idempotencyKeys.checkinId, checkinId),
        eq(idempotencyKeys.recipientId, recipientId),
      ),
    )
    .limit(1);
  return !!row;
}
