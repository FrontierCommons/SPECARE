import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { CheckInDimension, SperEntryDTO } from '@sper/shared-types';
import { color, elevation, radius, space, stateVisual, type } from '../design/tokens';
import { strings } from '../design/strings';
import { parseCheckInNote } from '../lib/checkinNote';
import { DIMENSIONS, dimState } from '../lib/checkinState';
import { relativeTime } from '../lib/time';
import type { ShareableNote } from '../lib/shareable';
import { LikeButton } from './LikeButton';
import { Touchable } from './Touchable';

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
  // "you weren't the only one" detail worth an explicit tap to see.
  const [showReachedDetail, setShowReachedDetail] = useState(false);

  // Only the Thriving/Steady per-dimension answers ever show here — never
  // the flagged (Heavy/In the Pit) dimension's own note, and never the
  // untagged general note either, since that's free text that could be
  // about anything, including the distressed part.
  const { perDimension } = parseCheckInNote(card.optional_note);
  const flaggedSet = new Set(card.flagged_dimensions);
  const notedDimensions = DIMENSIONS.filter((dim) => perDimension[dim] && !flaggedSet.has(dim));

  // A promoted Care Card (the viewer already acted on the flagged part)
  // shows up here even with nothing positive to share — the confirmation
  // itself ("You prayed for X!") is the content, and the ONLY content: no
  // notes, no like button, just the caption. A pure share needs at least
  // one Thriving/Steady note to be worth showing at all.
  const actionTypes = card.actionTypes ?? [];
  const isPromotedAction = actionTypes.length > 0;
  if (notedDimensions.length === 0 && !isPromotedAction) return null;

  if (isPromotedAction) {
    const title = strings.care.youActionedFor(
      [...new Set(actionTypes.map((t) => strings.care.actionVerb[t]))],
      card.target_name,
    );
    const reachedNames = card.reachedNames ?? [];
    return (
      <View style={styles.promotedCard}>
        <Text style={styles.promotedTitle}>{title}</Text>
        {card.actionAt ? <Text style={styles.actionTime}>{relativeTime(card.actionAt)}</Text> : null}
        {reachedNames.length > 0 ? (
          <View style={styles.reachedWrap}>
            <Touchable onPress={() => setShowReachedDetail((v) => !v)} accessibilityRole="button">
              <Text style={styles.reachedCount}>{strings.care.reachedCount(reachedNames.length)}</Text>
            </Touchable>
            {showReachedDetail ? (
              <Text style={styles.actionTime}>{strings.care.alreadyReached(reachedNames.join(', '))}</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  }

  const title = isSelf ? strings.care.youShared : strings.care.wantsToShare(card.target_name);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>

      {notedDimensions.map((dim) => {
        // Filled with the state's own color, same treatment as CareCard's
        // flagged-dimension pills — the pill should read as what was
        // actually answered, not a fixed color regardless of the answer.
        const level = entry ? dimState(entry, dim) : null;
        const stateColor = level ? stateVisual[level].color : null;
        return (
          <View
            key={dim}
            style={[
              styles.dimChip,
              { backgroundColor: stateColor ?? color.surfaceRaised, borderColor: stateColor ?? color.amber },
            ]}
          >
            <Text style={[styles.dimText, { color: stateColor ? color.textPrimary : color.amber }]}>
              {strings.checkIn.dimensions[dim as CheckInDimension]}: {perDimension[dim]}
            </Text>
          </View>
        );
      })}

      {isSelf ? (
        <View style={styles.selfLikeRow}>
          <Text style={styles.selfLikeEmoji}>❤️</Text>
          <Text style={styles.selfLikeCount}>{card.like_count}</Text>
        </View>
      ) : (
        <LikeButton
          liked={card.liked_by_me}
          count={card.like_count}
          onToggle={onToggleLike ?? (() => {})}
          pending={likePending}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
    borderWidth: 1,
    borderColor: color.border,
    ...elevation.sm,
  },
  title: { ...type.title, fontSize: type.title.fontSize - 3, color: color.textPrimary },
  dimChip: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderWidth: 1,
  },
  dimText: { ...type.caption, fontWeight: '600' },
  selfLikeRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start' },
  selfLikeEmoji: { fontSize: 16 },
  selfLikeCount: { ...type.label, fontWeight: '600', color: color.textPrimary },
  promotedCard: {
    backgroundColor: color.bg,
    borderColor: color.sage,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.xs,
    ...elevation.sm,
  },
  promotedTitle: { ...type.title, fontSize: type.title.fontSize - 3, color: color.textPrimary },
  actionTime: { ...type.caption, fontSize: 12, color: color.textMuted },
  reachedWrap: { marginTop: space.xs, alignItems: 'flex-start', gap: space.xs },
  reachedCount: { ...type.caption, fontSize: 12, color: color.sage, textDecorationLine: 'underline' },
});

export default ShareCard;
