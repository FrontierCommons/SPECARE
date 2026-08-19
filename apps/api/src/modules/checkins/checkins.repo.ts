import { and, desc, eq, gt, inArray } from 'drizzle-orm';
import type { DB } from '../../config/db';
import {
  checkins,
  circleMemberships,
  circleNotifications,
  careGratitudes,
  checkinLikes,
  users,
  type CheckInRow,
  type NewCheckInRow,
} from '../../db/schema';
import {
  isDistress,
  type CareCardDTO,
  type ShareCardDTO,
  type SperEntryDTO,
  type StateLevel,
} from '@sper/shared-types';

type Executor = DB | Parameters<Parameters<DB['transaction']>[0]>[0];

export class CheckInRepo {
  async insert(exec: Executor, values: NewCheckInRow): Promise<CheckInRow> {
    const [row] = await exec.insert(checkins).values(values).returning();
    return row!;
  }

  async findById(exec: Executor, id: string): Promise<CheckInRow | null> {
    const [row] = await exec.select().from(checkins).where(eq(checkins.id, id)).limit(1);
    return row ?? null;
  }

  /** True if the user is a member of the circle. */
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

  /** True if the caller has agreed to the pact for this circle. */
  async hasAgreedPact(exec: Executor, circleId: string, userId: string): Promise<boolean> {
    const [row] = await exec
      .select({ agreed: circleMemberships.covenantAgreed })
      .from(circleMemberships)
      .where(
        and(
          eq(circleMemberships.circleId, circleId),
          eq(circleMemberships.userId, userId),
        ),
      )
      .limit(1);
    return row?.agreed === true;
  }

  /**
   * Sper: for each member, their most recent NON-EXPIRED check-in.
   * Members with no active check-in appear with null states.
   */
  async sper(exec: Executor, circleId: string): Promise<SperEntryDTO[]> {
    const members = await exec
      .select({ userId: circleMemberships.userId, name: users.name, avatarUrl: users.avatarUrl })
      .from(circleMemberships)
      .innerJoin(users, eq(users.id, circleMemberships.userId))
      .where(eq(circleMemberships.circleId, circleId));

    if (members.length === 0) return [];

    const memberIds = members.map((m) => m.userId);

    // All active check-ins for these members, newest first.
    const active = await exec
      .select()
      .from(checkins)
      .where(
        and(
          eq(checkins.circleId, circleId),
          inArray(checkins.userId, memberIds),
          gt(checkins.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(checkins.createdAt));

    // Keep only the latest per user.
    const latest = new Map<string, CheckInRow>();
    for (const c of active) {
      if (!latest.has(c.userId)) latest.set(c.userId, c);
    }

    return members.map(({ userId, name, avatarUrl }): SperEntryDTO => {
      const c = latest.get(userId);
      if (!c) {
        return {
          user_id: userId,
          name,
          avatar_url: avatarUrl ?? null,
          checkin_id: null,
          spiritual_state: null,
          physical_state: null,
          emotional_state: null,
          vocational_state: null,
          relational_state: null,
          created_at: null,
        };
      }
      return {
        user_id: userId,
        name,
        avatar_url: avatarUrl ?? null,
        checkin_id: c.id,
        spiritual_state: c.spiritualState as StateLevel,
        physical_state: c.physicalState as StateLevel,
        emotional_state: c.emotionalState as StateLevel,
        vocational_state: c.vocationalState as StateLevel,
        relational_state: c.relationalState as StateLevel,
        created_at: c.createdAt.toISOString(),
      };
    });
  }

  /**
   * Active Care Cards: members currently flagged Heavy/In the Pit, with their
   * flagged dimensions, note, and distress verse. Visible to any circle member.
   *
   * `gratitude_shown` fires once per thank-you (marked seen right here) so the
   * dashboard can drop the card, while `gratitude_received` stays true for the
   * detail view as long as the card exists.
   */
  async careCards(exec: Executor, circleId: string, callerId: string): Promise<CareCardDTO[]> {
    const active = await exec
      .select()
      .from(checkins)
      .where(and(eq(checkins.circleId, circleId), gt(checkins.expiresAt, new Date())))
      .orderBy(desc(checkins.createdAt));

    // Latest active check-in per user.
    const latest = new Map<string, CheckInRow>();
    for (const c of active) {
      if (!latest.has(c.userId)) latest.set(c.userId, c);
    }

    const cards: CareCardDTO[] = [];
    for (const c of latest.values()) {
      const dims: Array<[string, StateLevel]> = [
        ['spiritual', c.spiritualState as StateLevel],
        ['physical', c.physicalState as StateLevel],
        ['emotional', c.emotionalState as StateLevel],
        ['vocational', c.vocationalState as StateLevel],
        ['relational', c.relationalState as StateLevel],
      ];
      const flagged = dims.filter(([, s]) => isDistress(s)).map(([d]) => d);
      if (flagged.length === 0) continue;

      const [author] = await exec
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, c.userId))
        .limit(1);

      const [notif] = await exec
        .select({ verse: circleNotifications.verse })
        .from(circleNotifications)
        .where(eq(circleNotifications.checkinId, c.id))
        .limit(1);

      let gratitudeShown: boolean | undefined;
      let gratitudeReceived: boolean | undefined;
      if (callerId !== c.userId) {
        const [grat] = await exec
          .select()
          .from(careGratitudes)
          .where(and(eq(careGratitudes.checkinId, c.id), eq(careGratitudes.responderId, callerId)))
          .limit(1);
        if (grat) {
          gratitudeReceived = true;
          if (!grat.seenAt) {
            gratitudeShown = true;
            await exec
              .update(careGratitudes)
              .set({ seenAt: new Date() })
              .where(eq(careGratitudes.id, grat.id));
          }
        }
      }

      const likes = await this.likeStats(exec, c.id, callerId);

      cards.push({
        checkin_id: c.id,
        target_user_id: c.userId,
        target_name: author?.name ?? 'A friend',
        flagged_dimensions: flagged,
        optional_note: c.optionalNote ?? null,
        verse: notif?.verse ?? null,
        created_at: c.createdAt.toISOString(),
        ...(gratitudeShown !== undefined ? { gratitude_shown: gratitudeShown } : {}),
        ...(gratitudeReceived !== undefined ? { gratitude_received: gratitudeReceived } : {}),
        like_count: likes.count,
        liked_by_me: likes.likedByMe,
      });
    }
    return cards;
  }

  /**
   * Active Share Cards: a member's latest check-in when it has no distress
   * flags but still has a note worth surfacing. Visible to any circle member;
   * disappears once a newer check-in supersedes it.
   */
  async shareCards(exec: Executor, circleId: string, callerId: string): Promise<ShareCardDTO[]> {
    const active = await exec
      .select()
      .from(checkins)
      .where(and(eq(checkins.circleId, circleId), gt(checkins.expiresAt, new Date())))
      .orderBy(desc(checkins.createdAt));

    const latest = new Map<string, CheckInRow>();
    for (const c of active) {
      if (!latest.has(c.userId)) latest.set(c.userId, c);
    }

    const cards: ShareCardDTO[] = [];
    for (const c of latest.values()) {
      const states: StateLevel[] = [
        c.spiritualState as StateLevel,
        c.physicalState as StateLevel,
        c.emotionalState as StateLevel,
        c.vocationalState as StateLevel,
        c.relationalState as StateLevel,
      ];
      if (states.some((s) => isDistress(s))) continue; // that's a Care Card's job
      if (!c.optionalNote) continue; // nothing to share

      const [author] = await exec
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, c.userId))
        .limit(1);

      const likes = await this.likeStats(exec, c.id, callerId);

      cards.push({
        checkin_id: c.id,
        target_user_id: c.userId,
        target_name: author?.name ?? 'A friend',
        optional_note: c.optionalNote,
        created_at: c.createdAt.toISOString(),
        like_count: likes.count,
        liked_by_me: likes.likedByMe,
      });
    }
    return cards;
  }

  private async likeStats(
    exec: Executor,
    checkinId: string,
    callerId: string,
  ): Promise<{ count: number; likedByMe: boolean }> {
    const rows = await exec
      .select({ likerId: checkinLikes.likerId })
      .from(checkinLikes)
      .where(eq(checkinLikes.checkinId, checkinId));
    return { count: rows.length, likedByMe: rows.some((r) => r.likerId === callerId) };
  }

  /** Toggle the caller's like on a check-in — like if not already liked,
   * unlike if it already was. Idempotent per the unique (checkin, liker)
   * index, so a double-submit race just lands on the same end state. */
  async toggleLike(
    exec: Executor,
    checkinId: string,
    likerId: string,
  ): Promise<{ liked: boolean; likeCount: number }> {
    const [existing] = await exec
      .select({ id: checkinLikes.id })
      .from(checkinLikes)
      .where(and(eq(checkinLikes.checkinId, checkinId), eq(checkinLikes.likerId, likerId)))
      .limit(1);

    if (existing) {
      await exec.delete(checkinLikes).where(eq(checkinLikes.id, existing.id));
    } else {
      await exec.insert(checkinLikes).values({ checkinId, likerId });
    }

    const rows = await exec
      .select({ id: checkinLikes.id })
      .from(checkinLikes)
      .where(eq(checkinLikes.checkinId, checkinId));
    return { liked: !existing, likeCount: rows.length };
  }
}

export const checkInRepo = new CheckInRepo();
