import { db, type DB } from '../../config/db';
import { TouchpointRepo, touchpointRepo } from './touchpoints.repo';
import { toTouchpointDTO } from '../../shared/mappers';
import { ForbiddenError, NotFoundError } from '../../shared/errors';
import { isTouchpointType, type TouchpointDTO, type TouchpointType } from '@sper/shared-types';

/**
 * Phase 2 delivery implements this to quietly notify the target
 * ("Marcus stepped up to hold space for you today.").
 * Phase 1 default is a no-op so the domain runs standalone.
 */
export interface TouchpointAckDispatcher {
  ackTarget(input: {
    targetUserId: string;
    responderName: string;
    checkinId: string;
  }): Promise<void>;
}

const noopAck: TouchpointAckDispatcher = {
  async ackTarget() {
    /* Phase 2 wires the quiet acknowledgment push here. */
  },
};

export interface LogTouchpointInput {
  checkinId: string;
  responderId: string;
  responderName: string;
  type: TouchpointType;
}

export class TouchpointService {
  constructor(
    private readonly repo: TouchpointRepo = touchpointRepo,
    private ack: TouchpointAckDispatcher = noopAck,
    private readonly database: DB = db,
  ) {}

  setAckDispatcher(dispatcher: TouchpointAckDispatcher): void {
    this.ack = dispatcher;
  }

  /**
   * Any circle member may log outreach; multiple members may respond to the
   * same check-in (no assignment, no dedupe). Writes a TouchpointLog and
   * quietly acknowledges the target post-commit.
   */
  async log(input: LogTouchpointInput): Promise<TouchpointDTO> {
    if (!isTouchpointType(input.type)) {
      throw new NotFoundError('Unknown touchpoint type');
    }

    const row = await this.database.transaction(async (tx) => {
      const ctx = await this.repo.checkinContext(tx, input.checkinId);
      if (!ctx) throw new NotFoundError('Check-in not found');

      const isMember = await this.repo.isMember(tx, ctx.circleId, input.responderId);
      if (!isMember) throw new ForbiddenError('Not a member of this circle');

      const inserted = await this.repo.insert(tx, {
        checkinId: input.checkinId,
        responderId: input.responderId,
        type: input.type,
      });

      return { inserted, targetUserId: ctx.targetUserId };
    });

    // Post-commit quiet ack; don't ack the target if they responded to themselves.
    if (row.targetUserId !== input.responderId) {
      await this.ack.ackTarget({
        targetUserId: row.targetUserId,
        responderName: input.responderName,
        checkinId: input.checkinId,
      });
    }

    return toTouchpointDTO(row.inserted, input.responderName);
  }

  /** Who has already reached out for this check-in (visible to members). */
  async list(checkinId: string, callerId: string): Promise<TouchpointDTO[]> {
    const ctx = await this.repo.checkinContext(this.database, checkinId);
    if (!ctx) throw new NotFoundError('Check-in not found');
    const isMember = await this.repo.isMember(this.database, ctx.circleId, callerId);
    if (!isMember) throw new ForbiddenError('Not a member of this circle');

    const rows = await this.repo.listByCheckin(this.database, checkinId);
    return rows.map((r) => toTouchpointDTO(r, r.responderName));
  }
}

export const touchpointService = new TouchpointService();
