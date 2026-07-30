import { and, desc, eq } from 'drizzle-orm';
import { db, type DB } from '../../config/db';
import {
  circles,
  circleMemberships,
  users,
  type CircleRow,
  type CircleMembershipRow,
} from '../../db/schema';
import type { CircleMemberDTO, MyCircleDTO } from '@sper/shared-types';

type Executor = DB | Parameters<Parameters<DB['transaction']>[0]>[0];

export class CircleRepo {
  async create(exec: Executor, name: string): Promise<CircleRow> {
    const [row] = await exec.insert(circles).values({ name }).returning();
    return row!;
  }

  async findById(exec: Executor, id: string): Promise<CircleRow | null> {
    const [row] = await exec.select().from(circles).where(eq(circles.id, id)).limit(1);
    return row ?? null;
  }

  /**
   * Add a member. `covenantAgreed` defaults false — the pact must be accepted
   * separately before the member can access content. Idempotent: re-adding an
   * existing member is a no-op that returns the existing row.
   */
  async addMember(
    exec: Executor,
    circleId: string,
    userId: string,
    covenantAgreed = false,
  ): Promise<CircleMembershipRow> {
    const [row] = await exec
      .insert(circleMemberships)
      .values({ circleId, userId, covenantAgreed })
      .onConflictDoNothing({
        target: [circleMemberships.circleId, circleMemberships.userId],
      })
      .returning();

    if (row) return row;
    // Conflict path: return the existing membership.
    const [existing] = await exec
      .select()
      .from(circleMemberships)
      .where(
        and(
          eq(circleMemberships.circleId, circleId),
          eq(circleMemberships.userId, userId),
        ),
      )
      .limit(1);
    return existing!;
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

  /**
   * Every circle this user belongs to, most recently joined first — used on
   * sign-in to resume a returning member without re-running onboarding.
   */
  async myCircles(exec: Executor, userId: string): Promise<MyCircleDTO[]> {
    const rows = await exec
      .select({
        circleId: circleMemberships.circleId,
        name: circles.name,
        covenantAgreed: circleMemberships.covenantAgreed,
        joinedAt: circleMemberships.joinedAt,
      })
      .from(circleMemberships)
      .innerJoin(circles, eq(circles.id, circleMemberships.circleId))
      .where(eq(circleMemberships.userId, userId))
      .orderBy(desc(circleMemberships.joinedAt));

    return rows.map(
      (r): MyCircleDTO => ({
        circle_id: r.circleId,
        name: r.name,
        covenant_agreed: r.covenantAgreed,
        joined_at: r.joinedAt.toISOString(),
      }),
    );
  }

  /** All member user IDs for a circle. */
  async memberIds(exec: Executor, circleId: string): Promise<string[]> {
    const rows = await exec
      .select({ userId: circleMemberships.userId })
      .from(circleMemberships)
      .where(eq(circleMemberships.circleId, circleId));
    return rows.map((r) => r.userId);
  }

  /** Member list with names, timezones, and pact status (for My Circle screen). */
  async members(exec: Executor, circleId: string): Promise<CircleMemberDTO[]> {
    const rows = await exec
      .select({
        userId: circleMemberships.userId,
        name: users.name,
        timezone: users.timezone,
        avatarUrl: users.avatarUrl,
        covenantAgreed: circleMemberships.covenantAgreed,
        joinedAt: circleMemberships.joinedAt,
      })
      .from(circleMemberships)
      .innerJoin(users, eq(users.id, circleMemberships.userId))
      .where(eq(circleMemberships.circleId, circleId));

    return rows.map(
      (r): CircleMemberDTO => ({
        user_id: r.userId,
        name: r.name,
        timezone: r.timezone,
        avatar_url: r.avatarUrl ?? null,
        covenant_agreed: r.covenantAgreed,
        joined_at: r.joinedAt.toISOString(),
      }),
    );
  }

  async removeMember(exec: Executor, circleId: string, userId: string): Promise<void> {
    await exec
      .delete(circleMemberships)
      .where(
        and(
          eq(circleMemberships.circleId, circleId),
          eq(circleMemberships.userId, userId),
        ),
      );
  }
}

export const circleRepo = new CircleRepo();
