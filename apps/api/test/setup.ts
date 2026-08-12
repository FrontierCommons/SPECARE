import { beforeAll, beforeEach, afterAll } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { env } from '../src/config/env';
import { db, pool } from '../src/config/db';
import {
  users,
  circles,
  circleMemberships,
  invites,
  deviceTokens,
  checkins,
  touchpointLogs,
} from '../src/db/schema';

/**
 * Shared harness for DB-backed tests. Applies the migration once, then wipes
 * all rows before every test so each case starts from a clean slate.
 * Requires DATABASE_URL to point at a disposable test database.
 */

// This suite truncates the whole schema on every test. Refuse to run against
// anything that isn't obviously a throwaway test database — a misconfigured
// DATABASE_URL here wipes real data (see .env.test).
const dbName = new URL(env.DATABASE_URL).pathname.slice(1);
if (!/test/i.test(dbName)) {
  throw new Error(
    `Refusing to run tests against database "${dbName}" — it doesn't look ` +
      `like a test database. Point DATABASE_URL (via .env.test) at a ` +
      `disposable database with "test" in its name.`,
  );
}

const MIGRATIONS_DIR = fileURLToPath(
  new URL('../src/db/migrations', import.meta.url),
);

beforeAll(async () => {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const ddl = readFileSync(`${MIGRATIONS_DIR}/${file}`, 'utf8');
    // Split on drizzle's statement breakpoints; ignore "already exists" (a
    // CREATE/ADD replaying against an already-migrated DB) and "does not
    // exist" (a DROP replaying after a later migration already removed the
    // same thing) so the suite is idempotent across runs against a
    // persistent test DB regardless of which direction a given migration's
    // statements go.
    const statements = ddl.split('--> statement-breakpoint');
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (!trimmed) continue;
      try {
        await db.execute(sql.raw(trimmed));
      } catch (e) {
        const msg = (e as Error).message;
        if (!/already exists|does not exist/i.test(msg)) throw e;
      }
    }
  }
});

beforeEach(async () => {
  // Truncate in FK-safe order (CASCADE handles the rest).
  await db.execute(
    sql`TRUNCATE TABLE
      voice_notes, care_gap_alerts, care_gratitudes, touchpoint_logs, circle_notifications, idempotency_keys, checkins,
      invites, circle_memberships, device_tokens, circles, users
      RESTART IDENTITY CASCADE`,
  );
});

afterAll(async () => {
  await pool.end();
});

/* ------------------------------- helpers ------------------------------- */

let seq = 0;
export function uniqueEmail(prefix = 'user'): string {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}@test.co`;
}

export async function makeUser(
  name: string,
  opts: { timezone?: string; email?: string } = {},
) {
  const [row] = await db
    .insert(users)
    .values({
      name,
      email: opts.email ?? uniqueEmail(name.toLowerCase()),
      timezone: opts.timezone ?? 'UTC',
    })
    .returning();
  return row!;
}

export async function makeCircle(name = 'Test Circle') {
  const [row] = await db.insert(circles).values({ name }).returning();
  return row!;
}

export async function addMember(
  circleId: string,
  userId: string,
  covenantAgreed = true,
) {
  const [row] = await db
    .insert(circleMemberships)
    .values({ circleId, userId, covenantAgreed })
    .returning();
  return row!;
}

/** A circle with N pact-agreed members. Returns { circle, users }. */
export async function makeCircleWith(names: string[]) {
  const circle = await makeCircle();
  const members = [];
  for (const n of names) {
    const u = await makeUser(n);
    await addMember(circle.id, u.id, true);
    members.push(u);
  }
  return { circle, users: members };
}

/** A checkin row with a controllable createdAt, for testing time-windowed workers. */
export async function makeCheckin(
  circleId: string,
  userId: string,
  opts: {
    createdAt?: Date;
    expiresAt?: Date;
    spiritualState?: 'Thriving' | 'Steady' | 'Heavy' | 'In the Pit';
    physicalState?: 'Thriving' | 'Steady' | 'Heavy' | 'In the Pit';
    emotionalState?: 'Thriving' | 'Steady' | 'Heavy' | 'In the Pit';
    vocationalState?: 'Thriving' | 'Steady' | 'Heavy' | 'In the Pit';
    relationalState?: 'Thriving' | 'Steady' | 'Heavy' | 'In the Pit';
  } = {},
) {
  const [row] = await db
    .insert(checkins)
    .values({
      circleId,
      userId,
      spiritualState: opts.spiritualState ?? 'Steady',
      physicalState: opts.physicalState ?? 'Steady',
      emotionalState: opts.emotionalState ?? 'Steady',
      vocationalState: opts.vocationalState ?? 'Steady',
      relationalState: opts.relationalState ?? 'Steady',
      createdAt: opts.createdAt,
      expiresAt: opts.expiresAt,
    })
    .returning();
  return row!;
}

export { db, invites, deviceTokens, checkins, touchpointLogs };
