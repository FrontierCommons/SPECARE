import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { color, colorForName } from '../design/tokens';

interface Props {
  name: string;
  avatarUrl?: string | null;
  size?: number;
}

/**
 * A person, everywhere in the app: their photo if they've set one, otherwise
 * their first initial on a color deterministically drawn from their name —
 * so the same person always reads the same color without us storing one.
 */
export function Avatar({ name, avatarUrl, size = 44 }: Props) {
  const dimensionStyle = { width: size, height: size, borderRadius: size / 2 };

  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={[styles.image, dimensionStyle]} />;
  }

  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <View style={[styles.fallback, dimensionStyle, { backgroundColor: colorForName(name) }]}>
      <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: color.surfaceRaised },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initial: { color: color.bg, fontWeight: '700' },
});

export default Avatar;
