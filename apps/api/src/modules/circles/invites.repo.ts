import { and, eq, gt, isNull } from 'drizzle-orm';
import { db, type DB } from '../../config/db';
import { invites, type InviteRow } from '../../db/schema';

type Executor = DB | Parameters<Parameters<DB['transaction']>[0]>[0];

export class InviteRepo {
  async create(
    exec: Executor,
    values: { circleId: string; code: string; email?: string; expiresAt: Date },
  ): Promise<InviteRow> {
    const [row] = await exec
      .insert(invites)
      .values({
        circleId: values.circleId,
        code: values.code,
        expiresAt: values.expiresAt,
        ...(values.email !== undefined ? { email: values.email } : {}),
      })
      .returning();
    return row!;
  }

  /** A valid invite by 6-char code: exists, unexpired, unredeemed. */
  async findRedeemableByCode(exec: Executor, code: string): Promise<InviteRow | null> {
    const [row] = await exec
      .select()
      .from(invites)
      .where(
        and(
          eq(invites.code, code),
          gt(invites.expiresAt, new Date()),
          isNull(invites.redeemedBy),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /** A valid invite by id (used for magic invite links carrying the invite id). */
  async findRedeemableById(exec: Executor, id: string): Promise<InviteRow | null> {
    const [row] = await exec
      .select()
      .from(invites)
      .where(
        and(
          eq(invites.id, id),
          gt(invites.expiresAt, new Date()),
          isNull(invites.redeemedBy),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async markRedeemed(exec: Executor, id: string, userId: string): Promise<void> {
    await exec.update(invites).set({ redeemedBy: userId }).where(eq(invites.id, id));
  }

  async codeExists(exec: Executor, code: string): Promise<boolean> {
    const [row] = await exec
      .select({ id: invites.id })
      .from(invites)
      .where(eq(invites.code, code))
      .limit(1);
    return !!row;
  }
}

export const inviteRepo = new InviteRepo();
