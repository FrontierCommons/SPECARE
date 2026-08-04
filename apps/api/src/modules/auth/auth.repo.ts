import { eq } from 'drizzle-orm';
import { db, type DB } from '../../config/db';
import { users, type UserRow } from '../../db/schema';
import type { CheckInFrequency } from '@sper/shared-types';

type Executor = DB | Parameters<Parameters<DB['transaction']>[0]>[0];

export class AuthRepo {
  async createUser(
    exec: Executor,
    values: { name: string; email: string; passwordHash?: string; timezone: string },
  ): Promise<UserRow> {
    const [row] = await exec
      .insert(users)
      .values({
        name: values.name,
        email: values.email.toLowerCase(),
        timezone: values.timezone,
        ...(values.passwordHash !== undefined ? { passwordHash: values.passwordHash } : {}),
      })
      .returning();
    return row!;
  }

  async findByEmail(exec: Executor, email: string): Promise<UserRow | null> {
    const [row] = await exec
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    return row ?? null;
  }

  async findById(exec: Executor, id: string): Promise<UserRow | null> {
    const [row] = await exec.select().from(users).where(eq(users.id, id)).limit(1);
    return row ?? null;
  }

  async updateProfile(
    exec: Executor,
    id: string,
    patch: { notificationsPaused?: boolean; timezone?: string; checkinFrequency?: CheckInFrequency },
  ): Promise<UserRow> {
    const [row] = await exec.update(users).set(patch).where(eq(users.id, id)).returning();
    return row!;
  }

  async updatePasswordHash(exec: Executor, id: string, passwordHash: string): Promise<UserRow> {
    const [row] = await exec.update(users).set({ passwordHash }).where(eq(users.id, id)).returning();
    return row!;
  }
}

export const authRepo = new AuthRepo();
