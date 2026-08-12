import type { CareCardDTO, ShareCardDTO, TouchpointType } from '@sper/shared-types';
import { parseCheckInNote } from './checkinNote';
import { DIMENSIONS } from './checkinState';

/**
 * Common shape ShareCard renders, regardless of where the data came from:
 * a genuinely all-positive check-in (ShareCardDTO, flagged_dimensions always
 * empty) or the leftover non-distress notes on a check-in someone has
 * already cared for (CareCardDTO, once promoted out of the Care Card list).
 * `flagged_dimensions` rides along so ShareCard can filter those dimensions
 * out of the note even when the source was a Care Card.
 */
export interface ShareableNote {
  checkin_id: string;
  target_user_id: string;
  target_name: string;
  optional_note: string | null;
  flagged_dimensions: string[];
  like_count: number;
  liked_by_me: boolean;
  /** Present only when this is a promoted Care Card — the viewer's own
   * touchpoint type(s) for this check-in. Drives the "You [action] X!"
   * title instead of the generic "wants to share" one, and means the card
   * should render even when there's nothing positive left to show. */
  actionTypes?: TouchpointType[];
  /** When the viewer's most recent action (of actionTypes) was logged —
   * shown as a small "X ago" under the promoted title. */
  actionAt?: string;
}

export function fromShareCard(card: ShareCardDTO): ShareableNote {
  return {
    checkin_id: card.checkin_id,
    target_user_id: card.target_user_id,
    target_name: card.target_name,
    optional_note: card.optional_note,
    flagged_dimensions: [],
    like_count: card.like_count,
    liked_by_me: card.liked_by_me,
  };
}

export function fromCareCard(card: CareCardDTO, actionTypes?: TouchpointType[], actionAt?: string | null): ShareableNote {
  return {
    checkin_id: card.checkin_id,
    target_user_id: card.target_user_id,
    target_name: card.target_name,
    optional_note: card.optional_note,
    flagged_dimensions: card.flagged_dimensions,
    like_count: card.like_count,
    liked_by_me: card.liked_by_me,
    ...(actionTypes && actionTypes.length > 0 ? { actionTypes } : {}),
    ...(actionAt ? { actionAt } : {}),
  };
}

/** True if there's at least one Thriving/Steady per-dimension note to show
 * — the same check ShareCard uses to decide whether to render at all, hoisted
 * up so callers can bucket/section a list before ever mounting the card. */
export function hasShareableContent(card: ShareableNote): boolean {
  const { perDimension } = parseCheckInNote(card.optional_note);
  const flaggedSet = new Set(card.flagged_dimensions);
  return DIMENSIONS.some((dim) => perDimension[dim] && !flaggedSet.has(dim));
}
