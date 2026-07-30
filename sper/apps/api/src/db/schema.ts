import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  char,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { STATE_LEVELS, TOUCHPOINT_TYPES, DEVICE_PLATFORMS, CHECKIN_FREQUENCIES } from '@sper/shared-types';

/* ------------------------------- Enums -------------------------------- */
// Cast to the tuple shape drizzle's pgEnum expects, sourced from shared-types
// so DB enums can never drift from the app-level enums.

export const stateLevel = pgEnum('state_level', STATE_LEVELS as unknown as [string, ...string[]]);
export const touchpointType = pgEnum(
  'touchpoint_type',
  TOUCHPOINT_TYPES as unknown as [string, ...string[]],
);
export const devicePlatform = pgEnum(
  'device_platform',
  DEVICE_PLATFORMS as unknown as [string, ...string[]],
);
export const checkinFrequency = pgEnum(
  'checkin_frequency',
  CHECKIN_FREQUENCIES as unknown as [string, ...string[]],
);

/* ------------------------------- Users -------------------------------- */

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'), // nullable: magic-link-only accounts
  timezone: text('timezone').notNull().default('UTC'),
  avatarUrl: text('avatar_url'),
  notificationsPaused: boolean('notifications_paused').notNull().default(false),
  checkinFrequency: checkinFrequency('checkin_frequency').notNull().default('twice'),
  lastCheckinAt: timestamp('last_checkin_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/* --------------------------- Device tokens ---------------------------- */
// GAP #1: push (APNs/FCM) needs persisted per-user device tokens.

export const deviceTokens = pgTable(
  'device_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    platform: devicePlatform('platform').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqToken: uniqueIndex('uniq_device_token').on(t.token),
    byUser: index('idx_device_tokens_user').on(t.userId),
  }),
);

/* ------------------------------ Circles ------------------------------- */

export const circles = pgTable('circles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const circleMemberships = pgTable(
  'circle_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    circleId: uuid('circle_id')
      .notNull()
      .references(() => circles.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    covenantAgreed: boolean('covenant_agreed').notNull().default(false),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqMember: uniqueIndex('uniq_circle_member').on(t.circleId, t.userId),
    byUser: index('idx_memberships_user').on(t.userId),
  }),
);

/* ------------------------------ Invites ------------------------------- */

export const invites = pgTable('invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  circleId: uuid('circle_id')
    .notNull()
    .references(() => circles.id, { onDelete: 'cascade' }),
  code: char('code', { length: 6 }).unique(),
  email: text('email'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  redeemedBy: uuid('redeemed_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------ Check-ins ----------------------------- */

export const checkins = pgTable(
  'checkins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    circleId: uuid('circle_id')
      .notNull()
      .references(() => circles.id, { onDelete: 'cascade' }),
    spiritualState: stateLevel('spiritual_state').notNull(),
    physicalState: stateLevel('physical_state').notNull(),
    emotionalState: stateLevel('emotional_state').notNull(),
    vocationalState: stateLevel('vocational_state').notNull(),
    relationalState: stateLevel('relational_state').notNull(),
    optionalNote: varchar('optional_note', { length: 140 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true })
      .notNull()
      .default(sql`now() + interval '14 days'`),
  },
  (t) => ({
    byCircle: index('idx_checkins_circle').on(t.circleId, t.createdAt),
  }),
);

/* --------------------------- Notifications ---------------------------- */

export const circleNotifications = pgTable(
  'circle_notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    checkinId: uuid('checkin_id')
      .notNull()
      .references(() => checkins.id, { onDelete: 'cascade' }),
    targetUserId: uuid('target_user_id')
      .notNull()
      .references(() => users.id),
    circleId: uuid('circle_id')
      .notNull()
      .references(() => circles.id, { onDelete: 'cascade' }),
    verse: text('verse'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byCircle: index('idx_notifications_circle').on(t.circleId, t.createdAt),
  }),
);

/* ---------------------------- Touchpoints ----------------------------- */

export const touchpointLogs = pgTable(
  'touchpoint_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    checkinId: uuid('checkin_id')
      .notNull()
      .references(() => checkins.id, { onDelete: 'cascade' }),
    responderId: uuid('responder_id')
      .notNull()
      .references(() => users.id),
    type: touchpointType('type').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byCheckin: index('idx_touchpoints_checkin').on(t.checkinId),
  }),
);

/* --------------------------- Care gratitude ---------------------------- */
// A target thanking their responders. One row per (checkin, responder) —
// thanking is idempotent per responder so a repeat "Thank you!" only reaches
// people who weren't covered by an earlier one. `seenAt` is set the first
// time the responder's care-cards fetch surfaces it, which is also the
// signal to stop showing it on their main dashboard afterward.

export const careGratitudes = pgTable(
  'care_gratitudes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    checkinId: uuid('checkin_id')
      .notNull()
      .references(() => checkins.id, { onDelete: 'cascade' }),
    responderId: uuid('responder_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
    seenAt: timestamp('seen_at', { withTimezone: true }),
  },
  (t) => ({
    uniqPerResponder: uniqueIndex('uniq_gratitude_responder').on(t.checkinId, t.responderId),
    byCheckin: index('idx_gratitudes_checkin').on(t.checkinId),
  }),
);

/* -------------------------- Idempotency keys -------------------------- */
// GAP #2: distress alerts must reach each member exactly once.
// Keyed by (checkin_id, recipient_id); a unique index enforces once-only send.

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    checkinId: uuid('checkin_id')
      .notNull()
      .references(() => checkins.id, { onDelete: 'cascade' }),
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqSend: uniqueIndex('uniq_idempotency_send').on(t.checkinId, t.recipientId),
  }),
);

/* ---------------------------- Inferred types -------------------------- */

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type CircleRow = typeof circles.$inferSelect;
export type CircleMembershipRow = typeof circleMemberships.$inferSelect;
export type InviteRow = typeof invites.$inferSelect;
export type CheckInRow = typeof checkins.$inferSelect;
export type NewCheckInRow = typeof checkins.$inferInsert;
export type CircleNotificationRow = typeof circleNotifications.$inferSelect;
export type TouchpointLogRow = typeof touchpointLogs.$inferSelect;
export type CareGratitudeRow = typeof careGratitudes.$inferSelect;
export type DeviceTokenRow = typeof deviceTokens.$inferSelect;
