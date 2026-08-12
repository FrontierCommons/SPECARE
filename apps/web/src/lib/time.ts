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
 * When the next scheduled prompt will actually fire — mirrors the API
 * scheduler's own anchor + interval math exactly (apps/api's
 * prompt-scheduler.ts FREQUENCY_INTERVAL_HOURS / isDueThisHour) so Settings
 * never promises a time the push job doesn't agree with. There's no stored
 * "9am" anywhere; the real schedule is relative to the member's last
 * check-in (or account creation, before their first one).
 */
export function nextPromptAt(anchorIso: string, frequency: CheckInFrequency, now: Date = new Date()): Date {
  const intervalMs = CHECKIN_INTERVAL_HOURS[frequency] * 60 * 60 * 1000;
  const anchor = new Date(anchorIso).getTime();
  const elapsed = now.getTime() - anchor;
  const n = Math.max(1, Math.floor(elapsed / intervalMs) + 1);
  return new Date(anchor + n * intervalMs);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** "2:15 PM today" / "2:15 PM tomorrow" / "2:15 PM Thu" — clock time first
 * since that's what members were promised at onboarding, with just enough
 * day context to disambiguate once-a-day cadences that land tomorrow. */
export function formatPromptTime(d: Date, now: Date = new Date()): string {
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const dayDiff = Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / 86_400_000);
  if (dayDiff === 0) return `${time} today`;
  if (dayDiff === 1) return `${time} tomorrow`;
  return `${time} ${d.toLocaleDateString(undefined, { weekday: 'short' })}`;
}

/**
 * Real-time countdown text to the next scheduled check-in, ticking down to
 * the second — e.g. "3h 42m 17s", "42m 17s", "17s", or "any time now" once
 * the interval has already elapsed. Derived from the last check-in timestamp
 * and the member's chosen cadence — there's no server-side "next prompt"
 * field to read.
 */
export function nextCheckInCountdown(lastCheckInIso: string, frequency: CheckInFrequency): string {
  const intervalMs = CHECKIN_INTERVAL_HOURS[frequency] * 60 * 60 * 1000;
  const diffMs = new Date(lastCheckInIso).getTime() + intervalMs - Date.now();
  if (diffMs <= 0) return 'any time now';
  const totalSec = Math.floor(diffMs / 1000);
  const hr = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hr > 0) return `${hr}h ${pad(min)}m ${pad(sec)}s`;
  if (min > 0) return `${min}m ${pad(sec)}s`;
  return `${sec}s`;
}
