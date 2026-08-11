import { db, type DB } from '../config/db';
import { users } from '../db/schema';
import { deviceRepo } from '../modules/users/devices.repo';
import { pushProvider, type PushProvider } from '../delivery/push.provider';
import type { CheckInFrequency, DevicePlatform } from '@sper/shared-types';

/** Hours between prompts per cadence — mirrors the web client's own
 * countdown (apps/web/src/lib/time.ts CHECKIN_INTERVAL_HOURS) so the push
 * and the on-screen "next check-in in..." timer agree on when "due" means,
 * instead of two independent clocks drifting apart. */
export const FREQUENCY_INTERVAL_HOURS: Record<CheckInFrequency, number> = {
  once: 24,
  twice: 12,
  thrice: 8,
};

const HOUR_MS = 3_600_000;

/**
 * True for exactly the one hourly tick during which `anchor + n*intervalHours`
 * falls, for whichever n >= 1 makes that timestamp <= now. An hourly poll
 * can therefore fire the prompt once per due window instead of every
 * subsequent hour once someone goes overdue (which the naive `now >= dueAt`
 * check would do forever, spamming them until they check in) — and n starts
 * at 1, not 0, so the moment of a fresh check-in itself never counts as due.
 */
function isDueThisHour(anchor: Date, intervalHours: number, now: Date): boolean {
  const intervalMs = intervalHours * HOUR_MS;
  const elapsed = now.getTime() - anchor.getTime();
  if (elapsed < intervalMs) return false; // hasn't been a full interval yet
  return elapsed % intervalMs < HOUR_MS;
}

export interface PromptSender {
  sendPrompt(input: { userId: string }): Promise<void>;
}

/**
 * Core scheduler logic, decoupled from BullMQ. Intended to run hourly.
 * Fires per user off their OWN last check-in (or, before their first one,
 * account creation) plus their chosen cadence — not a shared clock-hour
 * schedule, so it's timezone-agnostic by construction (an elapsed duration
 * doesn't care what timezone either end happened in) and it can't drift
 * from the "next check-in in..." countdown the app shows, since both derive
 * from the same anchor + interval. Returns the number of prompts sent.
 */
export async function runPromptScheduler(
  sender: PromptSender,
  database: DB = db,
  now: Date = new Date(),
): Promise<number> {
  const all = await database
    .select({
      id: users.id,
      paused: users.notificationsPaused,
      frequency: users.checkinFrequency,
      lastCheckinAt: users.lastCheckinAt,
      createdAt: users.createdAt,
    })
    .from(users);

  let sent = 0;
  for (const u of all) {
    if (u.paused) continue; // grace: never nag paused users
    const intervalHours =
      FREQUENCY_INTERVAL_HOURS[u.frequency as CheckInFrequency] ?? FREQUENCY_INTERVAL_HOURS.twice;
    const anchor = u.lastCheckinAt ?? u.createdAt;
    if (!isDueThisHour(anchor, intervalHours, now)) continue;
    await sender.sendPrompt({ userId: u.id });
    sent++;
  }
  return sent;
}

/** Default sender: push the prompt to a user's devices. */
export class DevicePromptSender implements PromptSender {
  constructor(private readonly push: PushProvider = pushProvider) {}

  async sendPrompt(input: { userId: string }): Promise<void> {
    const tokens = await deviceRepo.listForUser(input.userId);
    for (const t of tokens) {
      await this.push.send({
        token: t.token,
        platform: t.platform as DevicePlatform,
        title: 'Time for your 15-second Sper update',
        body: 'A quick check-in with your circle. Tap to begin.',
        data: { type: 'sper_prompt' },
      });
    }
  }
}

export const promptSender = new DevicePromptSender();
