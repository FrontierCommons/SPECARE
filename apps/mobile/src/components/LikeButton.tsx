import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Touchable } from './Touchable';
import { color, radius, space, type } from '../design/tokens';
import { strings } from '../design/strings';

/**
 * A quiet, count-only reaction — no list of who liked it, just a warm nudge
 * that someone noticed. Shared between the pure "share something special"
 * card and a Care Card's post-action notes, which use the same treatment.
 */
export function LikeButton({
  liked,
  count,
  onToggle,
  pending,
}: {
  liked: boolean;
  count: number;
  onToggle: () => void;
  pending?: boolean;
}) {
  return (
    <Touchable
      onPress={onToggle}
      disabled={pending}
      accessibilityRole="button"
      accessibilityState={{ selected: liked }}
      accessibilityLabel={liked ? strings.care.liked : strings.care.like}
      style={[styles.button, { borderColor: liked ? color.bloom : color.border, backgroundColor: liked ? color.surfaceRaised : 'transparent' }]}
    >
      <Text style={styles.emoji}>{liked ? '❤️' : '🤍'}</Text>
      <Text style={[styles.count, { color: liked ? color.bloom : color.textSecondary }]}>
        {strings.care.likeCount(count)}
      </Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  emoji: { fontSize: 16 },
  count: { ...type.label, fontWeight: '600' },
});

export default LikeButton;
