/**
 * Canonical enums shared across API and mobile.
 * These MUST match the Postgres enum types (state_level, touchpoint_type)
 * and the Drizzle pgEnum definitions in apps/api/src/db/schema.ts.
 * Changing a value here is a breaking change across the whole system.
 */

/** The four qualitative check-in levels. No numeric scores, ever. */
export const STATE_LEVELS = ['Thriving', 'Steady', 'Heavy', 'In the Pit'] as const;
export type StateLevel = (typeof STATE_LEVELS)[number];

/** Levels that trigger a circle-wide distress notification. */
export const DISTRESS_LEVELS = ['Heavy', 'In the Pit'] as const;
export type DistressLevel = (typeof DISTRESS_LEVELS)[number];

/** The five dimensions rated in every check-in. Order is UI-significant. */
export const CHECKIN_DIMENSIONS = [
  'spiritual',
  'physical',
  'emotional',
  'vocational',
  'relational',
] as const;
export type CheckInDimension = (typeof CHECKIN_DIMENSIONS)[number];

/** Kinds of off-app outreach a responder can log. */
export const TOUCHPOINT_TYPES = ['VoiceNoteSent', 'TextSent', 'CallMade', 'PrayedFor'] as const;
export type TouchpointType = (typeof TOUCHPOINT_TYPES)[number];

/** Device platforms for push token routing (APNs vs FCM vs Web Push). */
export const DEVICE_PLATFORMS = ['ios', 'android', 'web'] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

/** How often a user wants the daily check-in prompt. Default is 'twice'. */
export const CHECKIN_FREQUENCIES = ['once', 'twice', 'thrice'] as const;
export type CheckInFrequency = (typeof CHECKIN_FREQUENCIES)[number];

/** Type guards + helpers. */
export function isStateLevel(v: unknown): v is StateLevel {
  return typeof v === 'string' && (STATE_LEVELS as readonly string[]).includes(v);
}

export function isDistress(level: StateLevel): level is DistressLevel {
  return level === 'Heavy' || level === 'In the Pit';
}

export function isTouchpointType(v: unknown): v is TouchpointType {
  return typeof v === 'string' && (TOUCHPOINT_TYPES as readonly string[]).includes(v);
}

export function isCheckInFrequency(v: unknown): v is CheckInFrequency {
  return typeof v === 'string' && (CHECKIN_FREQUENCIES as readonly string[]).includes(v);
}
