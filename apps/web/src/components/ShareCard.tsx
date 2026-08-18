'use client';

import { useState } from 'react';
import type { CheckInDimension, SperEntryDTO } from '@sper/shared-types';
import { color, stateVisual, type } from '../design/tokens';
import { strings } from '../design/strings';
import { parseCheckInNote } from '../lib/checkinNote';
import { DIMENSIONS, dimState } from '../lib/checkinState';
import { relativeTime } from '../lib/time';
import type { ShareableNote } from '../lib/shareable';
import { LikeButton } from './LikeButton';
import { PRESSABLE } from '../design/interaction';

const titleStyle = { ...type.title, fontSize: type.title.fontSize - 3, color: color.textPrimary};
const dimTextStyle = { ...type.caption, fontWeight: 600 as const, color: color.textPrimary };
const generalNoteStyle = { ...type.body, fontSize: 16, color: color.textPrimary };
const actionTimeStyle = { ...type.caption, fontSize: 12, color: color.textMuted };
const reachedCountStyle = { ...type.caption, fontSize: 12, color: color.sageText };
const likeCountStyle = { ...type.label, fontWeight: 600 as const, color: color.textPrimary };

interface Props {
  card: ShareableNote;
  /** The viewer is the one who shared this — no liking your own post, just
   * the count so they can see how it landed. */
  isSelf: boolean;
  /** The shared member's own check-in entry — lets each noted dimension's
   * pill be colored by what they actually answered, same as CareCard's
   * flagged-dimension pills. */
  entry?: SperEntryDTO | null;
  onToggleLike?: () => void;
  likePending?: boolean;
}

/**
 * The circle's "someone wants to share something special" moment — either a
 * genuinely all-positive check-in, or the leftover non-distress notes on one
 * a viewer has already cared for. Nothing to act on here, just something to
 * notice and like.
 */
export function ShareCard({ card, isSelf, entry, onToggleLike, likePending }: Props) {
  // Collapsed by default — who-and-exactly-when reads as pressure/comparison
  // to whoever hasn't acted yet; here (already-responded) it's just a nice
  // "you weren't the only one" detail worth an explicit hover/tap to see.
  const [showReachedDetail, setShowReachedDetail] = useState(false);

  // Only the Thriving/Steady per-dimension answers ever show here — never
  // the flagged (Heavy/In the Pit) dimension's own note. The untagged
  // general note is different: it's free text that could be about anything,
  // including a distressed dimension the member didn't tag, so it only
  // shows here when flagged_dimensions is empty — nothing on this check-in
  // was flagged at all, so there's nothing it could be quietly hiding.
  const { perDimension, general } = parseCheckInNote(card.optional_note);
  const flaggedSet = new Set(card.flagged_dimensions);
  const notedDimensions = DIMENSIONS.filter((dim) => perDimension[dim] && !flaggedSet.has(dim));
  const showGeneral = flaggedSet.size === 0 && !!general;

  // A promoted Care Card (the viewer already acted on the flagged part)
  // shows up here even with nothing positive to share — the confirmation
  // itself ("You prayed for X!") is the content, and the ONLY content: no
  // notes, no like button, just the caption. A pure share needs at least
  // one Thriving/Steady note or a general note to be worth showing at all.
  const actionTypes = card.actionTypes ?? [];
  const isPromotedAction = actionTypes.length > 0;
  if (notedDimensions.length === 0 && !showGeneral && !isPromotedAction) return null;

  if (isPromotedAction) {
    const title = strings.care.youActionedFor(
      [...new Set(actionTypes.map((t) => strings.care.actionVerb[t]))],
      card.target_name,
    );
    const reachedNames = card.reachedNames ?? [];
    return (
      <div
        className="flex flex-col gap-xs rounded-lg border p-lg shadow-md"
        style={{ backgroundColor: color.bg, borderColor: color.sage }}
      >
        <p style={titleStyle}>{title}</p>
        {card.actionAt ? <p style={actionTimeStyle}>{relativeTime(card.actionAt)}</p> : null}
        {reachedNames.length > 0 ? (
          <div className="mt-xs flex flex-col items-start gap-xs">
            <button
              type="button"
              onMouseEnter={() => setShowReachedDetail(true)}
              onMouseLeave={() => setShowReachedDetail(false)}
              onClick={() => setShowReachedDetail((v) => !v)}
              className={`underline-offset-2 hover:underline ${PRESSABLE}`}
            >
              <span style={reachedCountStyle}>{strings.care.reachedCount(reachedNames.length)}</span>
            </button>
            {showReachedDetail ? (
              <p style={actionTimeStyle}>{strings.care.alreadyReached(reachedNames.join(', '))}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  const title = isSelf ? strings.care.youShared : strings.care.wantsToShare(card.target_name);

  return (
    <div className="flex flex-col gap-md rounded-lg border border-border bg-surface p-lg shadow-md">
      <p style={titleStyle}>{title}</p>

      {notedDimensions.map((dim) => {
        // Filled with the state's own color, same treatment as CareCard's
        // flagged-dimension pills — the pill should read as what was
        // actually answered, not a fixed color regardless of the answer.
        const level = entry ? dimState(entry, dim) : null;
        const stateColor = level ? stateVisual[level].color : null;
        return (
          <span
            key={dim}
            className="w-fit self-start rounded-pill border px-md py-xs"
            style={{ backgroundColor: stateColor ?? color.surfaceRaised, borderColor: stateColor ?? color.amber }}
          >
            <span style={{ ...dimTextStyle, color: stateColor ? color.textPrimary : color.amber }}>
              {strings.checkIn.dimensions[dim as CheckInDimension]}: {perDimension[dim]}
            </span>
          </span>
        );
      })}

      {showGeneral ? <p style={generalNoteStyle}>{general}</p> : null}

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
