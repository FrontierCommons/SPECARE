import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { color, elevation, radius, space, type } from '../design/tokens';
import { strings } from '../design/strings';

/**
 * Appears when a member has gone quiet. Care flows toward them, not guilt at
 * them — the copy explicitly removes pressure.
 */
export function GraceNudgeBanner({ name }: { name: string }) {
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{strings.grace.banner(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: color.surfaceRaised,
    borderRadius: radius.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: color.sageDeep,
    ...elevation.sm,
  },
  text: { ...type.body, color: color.textSecondary, fontSize: 14, lineHeight: 20 },
});

export default GraceNudgeBanner;
