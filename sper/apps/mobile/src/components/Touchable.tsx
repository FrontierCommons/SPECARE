import React, { useRef } from 'react';
import { Animated, Pressable, type PressableProps } from 'react-native';
import { motion } from '../design/tokens';

interface Props extends PressableProps {
  /** How far the element shrinks on press — smaller feels "clickier". */
  scaleTo?: number;
}

/**
 * Drop-in replacement for Pressable that actually feels pressed: a quick
 * scale-down "bubble" on touch down, springing back on release. Used
 * throughout the app so every tap gives the same tactile response instead of
 * a flat, unacknowledged press.
 */
export function Touchable({ scaleTo = 0.95, onPressIn, onPressOut, children, ...props }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      ...motion.spring.snappy,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      {...props}
      onPressIn={(e) => {
        animateTo(scaleTo);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animateTo(1);
        onPressOut?.(e);
      }}
    >
      {(state) => (
        <Animated.View style={{ transform: [{ scale }] }}>
          {typeof children === 'function' ? children(state) : children}
        </Animated.View>
      )}
    </Pressable>
  );
}

export default Touchable;
