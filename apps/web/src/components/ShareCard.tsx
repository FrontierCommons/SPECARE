'use client';

import type { CheckInDimension } from '@sper/shared-types';
import { color, type } from '../design/tokens';
import { strings } from '../design/strings';
import { parseCheckInNote } from '../lib/checkinNote';
import { DIMENSIONS } from '../lib/checkinState';
import type { ShareableNote } from '../lib/shareable';
import { LikeButton } from './LikeButton';

const titleStyle = { ...type.title, fontSize: type.title.fontSize - 3, color: color.sage  };
const noteStyle = { ...type.label, fontSize: type.label.fontSize + 1, fontWeight: 400 as const, color: color.textOption };
const likeCountStyle = { ...type.label, fontWeight: 600 as const, color: color.textPrimary };

interface Props {
  card: ShareableNote;
  /** The viewer is the one who shared this — no liking your own post, just
   * the count so they can see how it landed. */
  isSelf: boolean;
  onToggleLike?: () => void;
  likePending?: boolean;
}

/**
 * The circle's "someone wants to share something special" moment — either a
 * genuinely all-positive check-in, or the leftover non-distress notes on one
 * a viewer has already cared for. Nothing to act on here, just something to
 * notice and like.
 */
export function ShareCard({ card, isSelf, onToggleLike, likePending }: Props) {
  // Only the Thriving/Steady per-dimension answers ever show here — never
  // the flagged (Heavy/In the Pit) dimension's own note, and never the
  // untagged general note either, since that's free text that could be
  // about anything, including the distressed part.
  const { perDimension } = parseCheckInNote(card.optional_note);
  const flaggedSet = new Set(card.flagged_dimensions);
  const notedDimensions = DIMENSIONS.filter((dim) => perDimension[dim] && !flaggedSet.has(dim));

  if (notedDimensions.length === 0) return null;

  return (
    <div
      className="flex flex-col gap-md rounded-lg border p-lg shadow-sm"
      style={{ backgroundColor: color.bg, borderColor: color.sage }}
    >
      <p style={titleStyle}>{isSelf ? strings.care.youShared : strings.care.wantsToShare(card.target_name)}</p>

      {notedDimensions.map((dim) => (
        <p key={dim} style={noteStyle}>
          {strings.checkIn.dimensions[dim as CheckInDimension]}: {perDimension[dim]}
        </p>
      ))}

      {isSelf ? (
        <span className="flex w-fit items-center gap-xs">
          <span style={{ fontSize: 16, cursor: 'default' }} title={strings.care.reactedTooltip(card.like_count)}>
            ❤️
          </span>
          <span style={likeCountStyle}>{card.like_count}</span>
        </span>
      ) : (
        <LikeButton
          liked={card.liked_by_me}
          count={card.like_count}
          onToggle={onToggleLike ?? (() => {})}
          pending={likePending}
        />
      )}
    </div>
  );
}

export default ShareCard;
