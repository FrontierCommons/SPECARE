import type { DB } from '../../config/db';
import { CircleNotificationRepo, circleNotificationRepo } from './circle-notification.repo';
import { pickVerse } from './verses';
import type { CircleNotificationRow } from '../../db/schema';

type Executor = DB | Parameters<Parameters<DB['transaction']>[0]>[0];

/**
 * Phase 2 (delivery layer) implements this to fan out push/email.
 * Phase 1 keeps a no-op so the domain core runs standalone and testable.
 * The dispatch is intentionally fire-and-forget relative to the DB tx:
 * the notification RECORD is committed transactionally; the physical SEND
 * happens after commit (see CheckInService), so a push failure never rolls
 * back a valid check-in.
 */
export interface NotificationDispatcher {
  dispatchDistress(input: {
    notification: CircleNotificationRow;
    recipientIds: string[];
  }): Promise<void>;
}

const noopDispatcher: NotificationDispatcher = {
  async dispatchDistress() {
    /* Phase 2 wires the real APNs/FCM + email fallback here. */
  },
};

export interface BroadcastResult {
  notification: CircleNotificationRow;
  recipientIds: string[];
}

export class CircleNotificationService {
  constructor(
    private readonly repo: CircleNotificationRepo = circleNotificationRepo,
    private dispatcher: NotificationDispatcher = noopDispatcher,
  ) {}

  /** Phase 2 injects the real dispatcher at composition time. */
  setDispatcher(dispatcher: NotificationDispatcher): void {
    this.dispatcher = dispatcher;
  }

  /**
   * Persist the distress notification record INSIDE the caller's transaction.
   * Returns the record + resolved recipients; the caller triggers physical
   * delivery AFTER the transaction commits.
   */
  async createDistressNotification(
    exec: Executor,
    args: { checkinId: string; targetUserId: string; circleId: string },
  ): Promise<BroadcastResult> {
    const verse = pickVerse(args.checkinId);
    const notification = await this.repo.create(exec, {
      checkinId: args.checkinId,
      targetUserId: args.targetUserId,
      circleId: args.circleId,
      verse,
    });
    const recipientIds = await this.repo.recipientIds(
      exec,
      args.circleId,
      args.targetUserId,
    );
    return { notification, recipientIds };
  }

  /** Called post-commit to physically deliver. Safe to fail without rollback. */
  async deliver(result: BroadcastResult): Promise<void> {
    await this.dispatcher.dispatchDistress({
      notification: result.notification,
      recipientIds: result.recipientIds,
    });
  }
}

export const circleNotificationService = new CircleNotificationService();
