import { and, eq, gt, lt } from 'drizzle-orm';
import { isDistress, type StateLevel } from '@sper/shared-types';
import { db, type DB } from '../config/db';
import { checkins, circleMemberships, touchpointLogs, careGapAlerts, users } from '../db/schema';
import { notifierService } from '../delivery/notifier.service';

const CARE_GAP_WINDOW_MS = 12 * 3600 * 1000;

export interface CareGapDispatcher {
  careGapNudge(input: {
    checkinId: string;
    circleId: string;
    targetName: string;
    recipientIds: string[];
  }): Promise<void>;
}

function anyDistress(row: {
  spiritualState: string;
  physicalState: string;
  emotionalState: string;
  vocationalState: string;
  relationalState: string;
}): boolean {
  return (
    isDistress(row.spiritualState as StateLevel) ||
    isDistress(row.physicalState as StateLevel) ||
    isDistress(row.emotionalState as StateLevel) ||
    isDistress(row.vocationalState as StateLevel) ||
    isDistress(row.relationalState as StateLevel)
  );
}

/**
 * Core care-gap logic, decoupled from BullMQ for testability.
 * Finds still-active distress checkins older than CARE_GAP_WINDOW_MS with no
 * logged touchpoint, and nudges the rest of the circle toward them — once per
 * checkin, enforced by the uniq_care_gap_alert_checkin index rather than an
 * in-memory guard, so concurrent worker ticks can't double-send.
 * Returns the count of checkins nudged.
 */
export async function runCareGapLoop(
  dispatcher: CareGapDispatcher,
  database: DB = db,
  now: Date = new Date(),
): Promise<number> {
  const cutoff = new Date(now.getTime() - CARE_GAP_WINDOW_MS);

  const candidates = await database
    .select()
    .from(checkins)
    .where(and(lt(checkins.createdAt, cutoff), gt(checkins.expiresAt, now)));

  let nudged = 0;
  for (const c of candidates) {
    if (!anyDistress(c)) continue;

    const [touchpoint] = await database
      .select({ id: touchpointLogs.id })
      .from(touchpointLogs)
      .where(eq(touchpointLogs.checkinId, c.id))
      .limit(1);
    if (touchpoint) continue;

    const members = await database
      .select({ userId: circleMemberships.userId })
      .from(circleMemberships)
      .where(eq(circleMemberships.circleId, c.circleId));
    const recipientIds = members.map((m) => m.userId).filter((id) => id !== c.userId);
    if (recipientIds.length === 0) continue;

    const claimed = await database
      .insert(careGapAlerts)
      .values({ checkinId: c.id })
      .onConflictDoNothing({ target: [careGapAlerts.checkinId] })
      .returning({ id: careGapAlerts.id });
    if (claimed.length === 0) continue; // another tick already alerted this checkin

    const [target] = await database
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, c.userId))
      .limit(1);

    await dispatcher.careGapNudge({
      checkinId: c.id,
      circleId: c.circleId,
      targetName: target?.name ?? 'A friend',
      recipientIds,
    });
    nudged++;
  }

  return nudged;
}

/** Default dispatcher backed by the notifier. */
export const careGapDispatcher: CareGapDispatcher = {
  async careGapNudge(input) {
    await notifierService.careGapNudge(input);
  },
};
