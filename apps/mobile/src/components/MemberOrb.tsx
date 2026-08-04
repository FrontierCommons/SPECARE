import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { SperEntryDTO } from '@sper/shared-types';
import { Touchable } from './Touchable';
import { Avatar } from './Avatar';
import { DIMENSIONS, dimState } from '../lib/checkinState';
import { relativeTime } from '../lib/time';
import { color, elevation, radius, space, stateVisual, type } from '../design/tokens';

const SIZE = 96; // overall ring diameter
const STROKE = 10; // bold — this is the whole point
const GAP_DEG = 8; // breathing room between arcs
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SEGMENT_DEG = 360 / DIMENSIONS.length;
const ARC_DEG = SEGMENT_DEG - GAP_DEG;
const ARC_LEN = (ARC_DEG / 360) * CIRCUMFERENCE;
const DASH = `${ARC_LEN} ${CIRCUMFERENCE - ARC_LEN}`;
const AVATAR_SIZE = SIZE - STROKE * 2 - 8;

/**
 * One person in the circle: their avatar wrapped in a bold ring split into
 * five arcs, one per check-in dimension, each colored by that dimension's
 * latest weather state. At a glance the ring reads "mostly clear" or "storm
 * on one side" without a single number ever appearing. Tap for the full
 * picture.
 */
export function MemberOrb({
  entry,
  isSelf,
  onPress,
}: {
  entry: SperEntryDTO;
  isSelf?: boolean;
  onPress: (entry: SperEntryDTO) => void;
}) {
  const displayName = isSelf ? 'You' : entry.name;
  const label = DIMENSIONS.map((d) => dimState(entry, d) ?? 'no answer').join(', ');
  return (
    <Touchable
      onPress={() => onPress(entry)}
      accessibilityRole="button"
      accessibilityLabel={`${displayName}: ${label}`}
      style={styles.wrap}
    >
      <View style={styles.box}>
        <Svg width={SIZE} height={SIZE} style={styles.ring}>
          {DIMENSIONS.map((dim, i) => {
            const st = dimState(entry, dim);
            const arcColor = st ? stateVisual[st].color : color.border;
            const rotation = -90 + i * SEGMENT_DEG + GAP_DEG / 2;
            return (
              <Circle
                key={dim}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                stroke={arcColor}
                strokeWidth={STROKE}
                strokeDasharray={DASH}
                strokeLinecap="round"
                fill="none"
                rotation={rotation}
                origin={`${SIZE / 2}, ${SIZE / 2}`}
              />
            );
          })}
        </Svg>
        <View style={styles.avatarSlot}>
          <Avatar name={entry.name} avatarUrl={entry.avatar_url} size={AVATAR_SIZE} />
        </View>
        {entry.created_at ? (
          <View style={styles.timeBadge}>
            <Text style={styles.timeBadgeText}>{relativeTime(entry.created_at)}</Text>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} style={styles.name}>
        {displayName}
      </Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, alignItems: 'center', gap: space.xs },
  box: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', left: 0, top: 0 },
  avatarSlot: {
    borderRadius: AVATAR_SIZE / 2,
  },
  timeBadge: {
    position: 'absolute',
    top: -6,
    alignSelf: 'center',
    backgroundColor: '#F5E1A0',
    borderRadius: radius.pill,
    paddingHorizontal: space.xs,
    paddingVertical: 1,
    ...elevation.sm,
  },
  timeBadgeText: { fontSize: 10, fontWeight: '700', color: '#1C2024' },
  name: { ...type.caption, color: color.textSecondary, textAlign: 'center' },
});

export default MemberOrb;
