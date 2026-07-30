import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { StateLevel } from '@sper/shared-types';
import { Touchable } from './Touchable';
import { color, radius, space, stateVisual, type } from '../design/tokens';

interface Props {
  state: StateLevel;
  selected?: boolean;
  onPress?: () => void;
  compact?: boolean;
}

/**
 * The core state chip. Conveys state THREE ways — color, icon, and label —
 * so it never relies on color alone (WCAG 2.1 AA, and kinder to everyone).
 */
export function StateBadge({ state, selected, onPress, compact }: Props) {
  const v = stateVisual[state];
  const body = (
    <View
      style={[
        styles.badge,
        compact && styles.compact,
        { borderColor: v.color },
        selected && { backgroundColor: v.color },
      ]}
    >
      <Text style={[styles.icon, { color: selected ? color.bg : v.color }]}>{v.icon}</Text>
      {!compact && (
        <Text style={[styles.label, { color: selected ? color.bg : color.textPrimary }]}>
          {v.label}
        </Text>
      )}
    </View>
  );

  if (!onPress) return body;
  return (
    <Touchable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={v.label}
    >
      {body}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderWidth: 1.5,
    borderRadius: radius.pill,
  },
  compact: {
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
  },
  icon: { fontSize: 16 },
  label: { ...type.label },
});

export default StateBadge;
