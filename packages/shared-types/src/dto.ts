import type { StateLevel, TouchpointType, DevicePlatform, CheckInFrequency } from './states';

/**
 * Data Transfer Objects shared between API and mobile client.
 * Wire-format contracts only — no DB internals, no password hashes.
 */

/* ----------------------------- Primitives ----------------------------- */

export type UUID = string;
export type ISODateTime = string; // UTC, ISO-8601

/* ------------------------------- Auth --------------------------------- */

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  /** Access-token lifetime in seconds. */
  expires_in: number;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  timezone: string; // IANA, e.g. "America/New_York"
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface MagicLinkRequest {
  email: string;
}

export interface MagicLinkVerifyRequest {
  token: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface RequestPasswordResetRequest {
  email: string;
}

export interface ConfirmPasswordResetRequest {
  token: string;
  password: string;
}

export interface AuthResponse {
  user: UserDTO;
  tokens: AuthTokens;
}

/* ------------------------------- Users -------------------------------- */

export interface UserDTO {
  id: UUID;
  name: string;
  email: string;
  timezone: string;
  avatar_url: string | null;
  notifications_paused: boolean;
  checkin_frequency: CheckInFrequency;
  last_checkin_at: ISODateTime | null;
  created_at: ISODateTime;
}

export interface RegisterDeviceRequest {
  token: string; // APNs/FCM device token
  platform: DevicePlatform;
}

export interface UnregisterDeviceRequest {
  token: string;
}

export interface UpdateProfileRequest {
  notifications_paused?: boolean;
  timezone?: string;
  checkin_frequency?: CheckInFrequency;
  /** Data URI of a resized (~256px) JPEG, or null to remove the photo. */
  avatar_url?: string | null;
}

/* ------------------------------ Circles ------------------------------- */

export interface CreateCircleRequest {
  name: string;
}

export interface JoinCircleRequest {
  code?: string; // 6-char invite code
  invite_token?: string; // magic invite link token
}

export interface CreateInviteRequest {
  email?: string;
}

export interface InviteResponse {
  code: string;
  invite_link: string;
  expires_at: ISODateTime;
}

export interface CircleDTO {
  id: UUID;
  name: string;
  created_at: ISODateTime;
}

/** One row per circle the caller belongs to — used to resume a returning
 * member straight into their circle (or the pact, if unfinished) instead of
 * re-running onboarding. */
export interface MyCircleDTO {
  circle_id: UUID;
  name: string;
  covenant_agreed: boolean;
  joined_at: ISODateTime;
}

export interface CircleMemberDTO {
  user_id: UUID;
  name: string;
  timezone: string;
  avatar_url: string | null;
  covenant_agreed: boolean;
  joined_at: ISODateTime;
}

/* ------------------------------ Check-ins ----------------------------- */

export interface SubmitCheckInRequest {
  circle_id: UUID;
  spiritual_state: StateLevel;
  physical_state: StateLevel;
  emotional_state: StateLevel;
  vocational_state: StateLevel;
  relational_state: StateLevel;
  optional_note?: string; // <= 140 chars
}

export interface CheckInDTO {
  id: UUID;
  user_id: UUID;
  circle_id: UUID;
  spiritual_state: StateLevel;
  physical_state: StateLevel;
  emotional_state: StateLevel;
  vocational_state: StateLevel;
  relational_state: StateLevel;
  optional_note: string | null;
  created_at: ISODateTime;
  expires_at: ISODateTime;
}

export interface SubmitCheckInResponse {
  checkin: CheckInDTO;
  /** Present only when the check-in flagged Heavy / In the Pit. */
  notification?: CircleNotificationDTO;
}

/** One sper entry per member: their latest non-expired state. */
export interface SperEntryDTO {
  user_id: UUID;
  name: string;
  avatar_url: string | null;
  checkin_id: UUID | null;
  spiritual_state: StateLevel | null;
  physical_state: StateLevel | null;
  emotional_state: StateLevel | null;
  vocational_state: StateLevel | null;
  relational_state: StateLevel | null;
  created_at: ISODateTime | null;
}

/* --------------------------- Notifications ---------------------------- */

export interface CircleNotificationDTO {
  id: UUID;
  checkin_id: UUID;
  target_user_id: UUID;
  circle_id: UUID;
  verse: string | null;
  created_at: ISODateTime;
}

/** Care Card shown to responders. No assignment — visible to all members. */
export interface CareCardDTO {
  checkin_id: UUID;
  target_user_id: UUID;
  target_name: string;
  flagged_dimensions: string[]; // e.g. ["emotional", "spiritual"]
  optional_note: string | null;
  verse: string | null;
  created_at: ISODateTime;
  /** True exactly once: this is the caller's first fetch since being thanked. */
  gratitude_shown?: boolean;
  /** For the rest of this check-in's life once the caller has ever been thanked. */
  gratitude_received?: boolean;
  /** How many circle members have liked this check-in's notes. */
  like_count: number;
  /** True if the caller themself has liked it. */
  liked_by_me: boolean;
}

/** Shown when a check-in has no distress but includes a note worth surfacing.
 * Visible to all members; disappears once the author submits a newer
 * check-in — same "only the latest counts" rule as everything else Sper shows. */
export interface ShareCardDTO {
  checkin_id: UUID;
  target_user_id: UUID;
  target_name: string;
  optional_note: string; // never empty — that's the gate for existing at all
  created_at: ISODateTime;
  like_count: number;
  liked_by_me: boolean;
}

export interface ToggleLikeResponse {
  liked: boolean;
  like_count: number;
}

/* ---------------------------- Touchpoints ----------------------------- */

export interface LogTouchpointRequest {
  type: TouchpointType;
}

export interface TouchpointDTO {
  id: UUID;
  checkin_id: UUID;
  responder_id: UUID;
  responder_name: string;
  type: TouchpointType;
  created_at: ISODateTime;
}

/* ---------------------------- Voice notes ------------------------------ */

export interface SendVoiceNoteRequest {
  audio_base64: string;
  mime_type: string;
  duration_ms: number; // <= 30_000
}

/** Only ever returned to the check-in's own author, which is why the audio
 * payload is inlined instead of a separate fetch-by-id step. Includes both
 * pending and already-thanked notes; the client buckets by `received_at`
 * (same "New" vs "Already responded" split as Care/Share Cards). */
export interface VoiceNoteDTO {
  id: UUID;
  checkin_id: UUID;
  sender_id: UUID;
  sender_name: string;
  audio_base64: string;
  mime_type: string;
  duration_ms: number;
  created_at: ISODateTime;
  /** Null while pending; set once the author has said "Thank you." */
  received_at: ISODateTime | null;
}

/* --------------------------- In-app messages ---------------------------- */
// Replaces the old off-app "Send a message" deep link. Structurally a
// sibling of voice notes: same lifecycle, same touchpoint (TextSent) logged
// atomically with the send.

export interface SendMessageRequest {
  body: string; // <= 300 chars
}

/** Only ever returned to the check-in's own author. Includes both pending
 * and already-thanked messages — the client buckets by `received_at`. */
export interface InAppMessageDTO {
  id: UUID;
  checkin_id: UUID;
  sender_id: UUID;
  sender_name: string;
  body: string;
  created_at: ISODateTime;
  received_at: ISODateTime | null;
}

/* ------------------------------ Errors -------------------------------- */

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}
