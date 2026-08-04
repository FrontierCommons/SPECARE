import { eq } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { db, type DB } from '../config/db';
import { users } from '../db/schema';
import { deviceRepo } from '../modules/users/devices.repo';
import { pushProvider, type PushProvider } from '../delivery/push.provider';
import type { CheckInFrequency } from '@sper/shared-types';

/** Local hour (24h) at which the daily Sper prompt should fire. */
export const PROMPT_LOCAL_HOUR = 9;

/** Local hours the prompt fires at, per user-chosen frequency. */
export const FREQUENCY_HOURS: Record<CheckInFrequency, readonly number[]> = {
  once: [PROMPT_LOCAL_HOUR],
  twice: [PROMPT_LOCAL_HOUR, 18],
  thrice: [PROMPT_LOCAL_HOUR, 13, 18],
};

export interface PromptSender {
  sendPrompt(input: { userId: string }): Promise<void>;
}

/**
 * Core scheduler logic, decoupled from BullMQ. Intended to run hourly.
 * For each non-paused user whose LOCAL time matches one of the hours for
 * their chosen check-in frequency, send the Sper prompt. Timezone
 * correctness per user (NFR). Returns the number of prompts sent.
 */
export async function runPromptScheduler(
  sender: PromptSender,
  database: DB = db,
  now: Date = new Date(),
): Promise<number> {
  const all = await database
    .select({
      id: users.id,
      timezone: users.timezone,
      paused: users.notificationsPaused,
      frequency: users.checkinFrequency,
    })
    .from(users);

  let sent = 0;
  for (const u of all) {
    if (u.paused) continue; // grace: never nag paused users
    const localHour = DateTime.fromJSDate(now, { zone: u.timezone || 'UTC' }).hour;
    const hours = FREQUENCY_HOURS[u.frequency as CheckInFrequency] ?? FREQUENCY_HOURS.twice!;
    if (!hours.includes(localHour)) continue;
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
        platform: t.platform as 'ios' | 'android',
        title: 'Time for your 15-second Sper update',
        body: 'A quick check-in with your circle. Tap to begin.',
        data: { type: 'sper_prompt' },
      });
    }
  }
}

export const promptSender = new DevicePromptSender();
