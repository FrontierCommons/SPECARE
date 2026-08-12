import { and, eq } from 'drizzle-orm';
import { db, type DB } from '../../config/db';
import { deviceTokens, type DeviceTokenRow } from '../../db/schema';
import type { DevicePlatform } from '@sper/shared-types';

type Executor = DB | Parameters<Parameters<DB['transaction']>[0]>[0];

export class DeviceRepo {
  /**
   * Register (or re-point) a device token. Tokens are globally unique; if the
   * same token re-registers we update its owner/platform rather than duplicate.
   */
  async register(
    userId: string,
    token: string,
    platform: DevicePlatform,
    exec: Executor = db,
  ): Promise<DeviceTokenRow> {
    const [row] = await exec
      .insert(deviceTokens)
      .values({ userId, token, platform })
      .onConflictDoUpdate({
        target: deviceTokens.token,
        set: { userId, platform },
      })
      .returning();
    return row!;
  }

  async listForUser(userId: string, exec: Executor = db): Promise<DeviceTokenRow[]> {
    return exec.select().from(deviceTokens).where(eq(deviceTokens.userId, userId));
  }

  async listForUsers(userIds: string[], exec: Executor = db): Promise<DeviceTokenRow[]> {
    if (userIds.length === 0) return [];
    const rows = await exec.select().from(deviceTokens);
    const set = new Set(userIds);
    return rows.filter((r) => set.has(r.userId));
  }

  /** Remove a token the provider reported as unregistered/invalid. */
  async remove(token: string, exec: Executor = db): Promise<void> {
    await exec.delete(deviceTokens).where(eq(deviceTokens.token, token));
  }

  /** The user's own explicit "turn off notifications" — scoped to their own
   * token so one member can never unregister another's device. */
  async removeForUser(userId: string, token: string, exec: Executor = db): Promise<void> {
    await exec.delete(deviceTokens).where(and(eq(deviceTokens.userId, userId), eq(deviceTokens.token, token)));
  }
}

export const deviceRepo = new DeviceRepo();
