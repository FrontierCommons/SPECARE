import type {
  CheckInDTO,
  CircleNotificationDTO,
  TouchpointDTO,
  StateLevel,
  TouchpointType,
} from '@sper/shared-types';
import type {
  CheckInRow,
  CircleNotificationRow,
  TouchpointLogRow,
} from '../db/schema';

/**
 * Central serialization layer. All Date -> ISO (UTC) conversion happens
 * here so no controller hand-rolls it and no internal column leaks.
 */

const iso = (d: Date): string => d.toISOString();
const isoOrNull = (d: Date | null): string | null => (d ? d.toISOString() : null);

export function toCheckInDTO(row: CheckInRow): CheckInDTO {
  return {
    id: row.id,
    user_id: row.userId,
    circle_id: row.circleId,
    spiritual_state: row.spiritualState as StateLevel,
    physical_state: row.physicalState as StateLevel,
    emotional_state: row.emotionalState as StateLevel,
    vocational_state: row.vocationalState as StateLevel,
    relational_state: row.relationalState as StateLevel,
    optional_note: row.optionalNote ?? null,
    created_at: iso(row.createdAt),
    expires_at: iso(row.expiresAt),
  };
}

export function toCircleNotificationDTO(row: CircleNotificationRow): CircleNotificationDTO {
  return {
    id: row.id,
    checkin_id: row.checkinId,
    target_user_id: row.targetUserId,
    circle_id: row.circleId,
    verse: row.verse ?? null,
    created_at: iso(row.createdAt),
  };
}

export function toTouchpointDTO(
  row: TouchpointLogRow,
  responderName: string,
): TouchpointDTO {
  return {
    id: row.id,
    checkin_id: row.checkinId,
    responder_id: row.responderId,
    responder_name: responderName,
    type: row.type as TouchpointType,
    created_at: iso(row.createdAt),
  };
}

export { iso, isoOrNull };
