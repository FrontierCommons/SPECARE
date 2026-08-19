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
 * A "something good to notice" moment — either an all-positive check-in, or
 * the leftover non-distress notes on one the viewer already cared for.
 * Nothing to act on, just something to like.
 */
export function ShareCard({ card, isSelf, entry, onToggleLike, likePending }: Props) {
  // Collapsed by default — who-and-when can read as pressure/comparison
  // elsewhere; here it's just a "you weren't the only one" detail worth a tap.
  const [showReachedDetail, setShowReachedDetail] = useState(false);

  // Only Thriving/Steady per-dimension notes show here — never the flagged
  // dimension's note, and never the untagged free-text note (it could be
  // about the distressed part).
  const { perDimension } = parseCheckInNote(card.optional_note);
  const flaggedSet = new Set(card.flagged_dimensions);
  const notedDimensions = DIMENSIONS.filter((dim) => perDimension[dim] && !flaggedSet.has(dim));

  // A promoted Care Card (viewer already acted on the flagged part) shows
  // up with no positive notes at all — the action confirmation is the whole
  // point. A pure share, by contrast, needs at least one noted dimension.
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
        // Colored by the actual answer (same treatment as CareCard's
        // flagged-dimension pills), not a fixed color regardless of state.
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
