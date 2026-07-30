import { eq } from 'drizzle-orm';
import { db, type DB } from '../../config/db';
import { users } from '../../db/schema';
import { CheckInRepo, checkInRepo } from './checkins.repo';
import {
  CircleNotificationService,
  circleNotificationService,
  type BroadcastResult,
} from '../notifications/circle-notification.service';
import { toCheckInDTO, toCircleNotificationDTO } from '../../shared/mappers';
import { ForbiddenError, ValidationError } from '../../shared/errors';
import {
  isDistress,
  CHECKIN_DIMENSIONS,
  type StateLevel,
  type SubmitCheckInResponse,
  type RadarEntryDTO,
  type CareCardDTO,
} from '@sper/shared-types';

export interface SubmitCheckInInput {
  userId: string;
  circleId: string;
  spiritual_state: StateLevel;
  physical_state: StateLevel;
  emotional_state: StateLevel;
  vocational_state: StateLevel;
  relational_state: StateLevel;
  optional_note?: string;
}

export class CheckInService {
  constructor(
    private readonly repo: CheckInRepo = checkInRepo,
    private readonly notifications: CircleNotificationService = circleNotificationService,
    private readonly database: DB = db,
  ) {}

  /**
   * Core loop. In ONE transaction:
   *   1. Guard membership + pact.
   *   2. Insert the check-in.
   *   3. Un-pause the submitter (GAP #5: a returning user must not stay silenced).
   *   4. If any state is Heavy/In the Pit, create the CircleNotification record.
   * After commit, physically deliver the distress alert (failure never rolls
   * back a valid check-in).
   */
  async submit(input: SubmitCheckInInput): Promise<SubmitCheckInResponse> {
    if (input.optional_note !== undefined && input.optional_note.length > 140) {
      throw new ValidationError('optional_note exceeds 140 characters');
    }

    const flagged = this.anyDistress(input);

    const { checkinRow, broadcast, notificationRow } = await this.database.transaction(
      async (tx) => {
        const isMember = await this.repo.isMember(tx, input.circleId, input.userId);
        if (!isMember) {
          throw new ForbiddenError('Not a member of this circle');
        }
        const agreed = await this.repo.hasAgreedPact(tx, input.circleId, input.userId);
        if (!agreed) {
          throw new ForbiddenError('Circle pact must be agreed before checking in');
        }

        const now = new Date();
        const checkinRow = await this.repo.insert(tx, {
          userId: input.userId,
          circleId: input.circleId,
          spiritualState: input.spiritual_state,
          physicalState: input.physical_state,
          emotionalState: input.emotional_state,
          vocationalState: input.vocational_state,
          relationalState: input.relational_state,
          ...(input.optional_note !== undefined
            ? { optionalNote: input.optional_note }
            : {}),
        });

        // GAP #5: submitting a check-in re-activates prompts + records recency.
        await tx
          .update(users)
          .set({ lastCheckinAt: now, notificationsPaused: false })
          .where(eq(users.id, input.userId));

        let broadcast: BroadcastResult | null = null;
        if (flagged) {
          broadcast = await this.notifications.createDistressNotification(tx, {
            checkinId: checkinRow.id,
            targetUserId: input.userId,
            circleId: input.circleId,
          });
        }

        return {
          checkinRow,
          broadcast,
          notificationRow: broadcast?.notification ?? null,
        };
      },
    );

    // Post-commit: physical delivery. Isolated from the tx by design.
    if (broadcast) {
      await this.notifications.deliver(broadcast);
    }

    const response: SubmitCheckInResponse = {
      checkin: toCheckInDTO(checkinRow),
    };
    if (notificationRow) {
      response.notification = toCircleNotificationDTO(notificationRow);
    }
    return response;
  }

  /** Current radar for a circle. Caller-membership enforced at the HTTP layer. */
  async radar(circleId: string, callerId: string): Promise<RadarEntryDTO[]> {
    const isMember = await this.repo.isMember(this.database, circleId, callerId);
    if (!isMember) throw new ForbiddenError('Not a member of this circle');
    return this.repo.radar(this.database, circleId);
  }

  /** Active Care Cards for the circle. Caller must be a member. */
  async careCards(circleId: string, callerId: string): Promise<CareCardDTO[]> {
    const isMember = await this.repo.isMember(this.database, circleId, callerId);
    if (!isMember) throw new ForbiddenError('Not a member of this circle');
    return this.repo.careCards(this.database, circleId, callerId);
  }

  private anyDistress(input: SubmitCheckInInput): boolean {
    const states: StateLevel[] = [
      input.spiritual_state,
      input.physical_state,
      input.emotional_state,
      input.vocational_state,
      input.relational_state,
    ];
    return states.some((s) => isDistress(s));
  }
}

export const checkInService = new CheckInService();

// Keep the dimension list referenced so any future divergence is a compile signal.
void CHECKIN_DIMENSIONS;
