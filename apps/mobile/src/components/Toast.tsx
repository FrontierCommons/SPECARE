import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { color, elevation, motion, radius, space, type } from '../design/tokens';

/**
 * A brief in-app slide-down notification for events that happen while
 * you're already in the app (e.g. a circle member praying for you) — push
 * notifications cover the same events when you're not.
 */
export function Toast({ message, visible }: { message: string; visible: boolean }) {
  const translateY = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : -100,
      useNativeDriver: true,
      ...motion.spring.gentle,
    }).start();
  }, [visible, translateY]);

  return (
    <Animated.View
      style={[styles.toast, { transform: [{ translateY }] }]}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: space.sm,
    left: space.lg,
    right: space.lg,
    zIndex: 20,
    backgroundColor: color.bloom,
    borderRadius: radius.pill,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    alignItems: 'center',
    ...elevation.floating,
  },
  text: { ...type.label, color: color.bg, fontWeight: '700' },
});

export default Toast;
