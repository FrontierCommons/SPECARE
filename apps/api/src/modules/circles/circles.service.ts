import { db, type DB } from '../../config/db';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { CircleRepo, circleRepo } from './circles.repo';
import { InviteService, inviteService } from './invites.service';
import { PactService, pactService } from './pact.service';
import {
  type CircleEventDispatcher,
  noopCircleEventDispatcher,
} from './circle-events';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors';
import type {
  CircleDTO,
  CircleMemberDTO,
  InviteResponse,
  MyCircleDTO,
} from '@sper/shared-types';

export interface JoinResult {
  circle: CircleDTO;
}

export class CircleService {
  constructor(
    private readonly repo: CircleRepo = circleRepo,
    private readonly invites: InviteService = inviteService,
    private readonly pact: PactService = pactService,
    private events: CircleEventDispatcher = noopCircleEventDispatcher,
    private readonly database: DB = db,
  ) {}

  /** Phase 2 delivery injects the real dispatcher at composition time. */
  setEventDispatcher(dispatcher: CircleEventDispatcher): void {
    this.events = dispatcher;
  }

  /**
   * Create a circle and auto-add the creator as its first member.
   * The creator still must agree the pact before accessing content.
   */
  async create(name: string, creatorId: string): Promise<CircleDTO> {
    const trimmed = name.trim();
    if (!trimmed) throw new ValidationError('Circle name is required');

    const row = await this.database.transaction(async (tx) => {
      const circle = await this.repo.create(tx, trimmed);
      await this.repo.addMember(tx, circle.id, creatorId, false);
      return circle;
    });

    return { id: row.id, name: row.name, created_at: row.createdAt.toISOString() };
  }

  /** Create an invite (code + deep link). Caller must be a member. */
  async createInvite(
    circleId: string,
    callerId: string,
    email?: string,
  ): Promise<InviteResponse> {
    const isMember = await this.repo.isMember(this.database, circleId, callerId);
    if (!isMember) throw new NotFoundError('Circle not found');
    return this.invites.create(circleId, email);
  }

  /**
   * Join via code or invite-link token. Not single-use — the same code works
   * for anyone until env.INVITE_CODE_TTL_HOURS expires, so a whole group can
   * join off one shared invite. Notifies existing members post-commit (FR #3);
   * new members join with the pact un-agreed.
   */
  async join(
    args: { code?: string; inviteToken?: string },
    userId: string,
  ): Promise<JoinResult> {
    if (!args.code && !args.inviteToken) {
      throw new ValidationError('An invite code or link is required');
    }

    const { circleRow, existingMemberIds } = await this.database.transaction(async (tx) => {
      const invite = await this.invites.resolveRedeemable(args, tx);

      const alreadyMember = await this.repo.isMember(tx, invite.circleId, userId);
      if (alreadyMember) {
        throw new ConflictError('You are already a member of this circle');
      }

      // Snapshot existing members BEFORE adding, so they're the notify targets.
      const existingMemberIds = await this.repo.memberIds(tx, invite.circleId);

      await this.repo.addMember(tx, invite.circleId, userId, false);

      const circleRow = await this.repo.findById(tx, invite.circleId);
      if (!circleRow) throw new NotFoundError('Circle not found');

      return { circleRow, existingMemberIds };
    });

    // Post-commit: FR #3 member-added notification to prior members.
    if (existingMemberIds.length > 0) {
      const joiner = await this.userName(userId);
      await this.events.memberAdded({
        circleId: circleRow.id,
        newMemberName: joiner,
        recipientIds: existingMemberIds,
      });
    }

    return {
      circle: {
        id: circleRow.id,
        name: circleRow.name,
        created_at: circleRow.createdAt.toISOString(),
      },
    };
  }

  /** Circles this user already belongs to, so sign-in can resume them. */
  async mine(userId: string): Promise<MyCircleDTO[]> {
    return this.repo.myCircles(this.database, userId);
  }

  /** Accept the Circle Pact (gate for all circle access). */
  async agreePact(circleId: string, userId: string): Promise<void> {
    await this.pact.agree(circleId, userId);
  }

  /** Member list for the My Circle screen. Caller must have pact access. */
  async members(circleId: string, callerId: string): Promise<CircleMemberDTO[]> {
    await this.pact.assertAccess(circleId, callerId);
    return this.repo.members(this.database, circleId);
  }

  async leave(circleId: string, userId: string): Promise<void> {
    const isMember = await this.repo.isMember(this.database, circleId, userId);
    if (!isMember) throw new NotFoundError('Not a member of this circle');
    await this.repo.removeMember(this.database, circleId, userId);
  }

  private async userName(userId: string): Promise<string> {
    const [row] = await this.database
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row?.name ?? 'A friend';
  }
}

export const circleService = new CircleService();
