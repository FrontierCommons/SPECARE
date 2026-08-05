import type { CheckInFrequency } from '@sper/shared-types';

/** Coarse, human relative time — "just now", "12m ago", "3h ago", "2d ago". */
export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

/** Hours between prompts for each check-in cadence (settings screen's frequency picker). */
const CHECKIN_INTERVAL_HOURS: Record<CheckInFrequency, number> = {
  once: 24,
  twice: 12,
  thrice: 8,
};

/**
 * Countdown text to the next scheduled check-in, e.g. "3h 42m" or "any time
 * now" once the interval has already elapsed. Derived from the last check-in
 * timestamp and the member's chosen cadence — there's no server-side "next
 * prompt" field to read. Ported from apps/mobile/src/lib/time.ts.
 */
export function nextCheckInCountdown(lastCheckInIso: string, frequency: CheckInFrequency): string {
  const intervalMs = CHECKIN_INTERVAL_HOURS[frequency] * 60 * 60 * 1000;
  const diffMs = new Date(lastCheckInIso).getTime() + intervalMs - Date.now();
  if (diffMs <= 0) return 'any time now';
  const totalMin = Math.ceil(diffMs / 60_000);
  const hr = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (hr < 1) return `${min}m`;
  return `${hr}h ${min}m`;
}
