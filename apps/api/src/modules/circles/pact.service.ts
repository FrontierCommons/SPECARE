import { and, eq } from 'drizzle-orm';
import { db, type DB } from '../../config/db';
import { circleMemberships } from '../../db/schema';
import { ForbiddenError, NotFoundError } from '../../shared/errors';

type Executor = DB | Parameters<Parameters<DB['transaction']>[0]>[0];

/**
 * The Circle Pact gate. No member may read circle content or check in until
 * `covenant_agreed` is true for them. Phase 1's check-in service already
 * enforces this at submit; this service owns the agree action + a reusable
 * assertion for the HTTP layer (Phase 4) to guard reads.
 */
export class PactService {
  constructor(private readonly database: DB = db) {}

  /** Set covenant_agreed = true for the caller in this circle. */
  async agree(circleId: string, userId: string, exec: Executor = this.database): Promise<void> {
    const updated = await exec
      .update(circleMemberships)
      .set({ covenantAgreed: true })
      .where(
        and(
          eq(circleMemberships.circleId, circleId),
          eq(circleMemberships.userId, userId),
        ),
      )
      .returning({ id: circleMemberships.id });

    if (updated.length === 0) {
      throw new NotFoundError('Membership not found for this circle');
    }
  }

  async hasAgreed(circleId: string, userId: string, exec: Executor = this.database): Promise<boolean> {
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

  /** Throws unless the caller is a member AND has agreed the pact. */
  async assertAccess(circleId: string, userId: string, exec: Executor = this.database): Promise<void> {
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

    if (!row) throw new ForbiddenError('Not a member of this circle');
    if (!row.agreed) throw new ForbiddenError('Circle pact must be agreed first');
  }
}

export const pactService = new PactService();
