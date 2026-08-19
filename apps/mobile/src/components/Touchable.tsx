import React, { useRef } from 'react';
import { Animated, Pressable, type PressableProps } from 'react-native';
import { motion } from '../design/tokens';

interface Props extends PressableProps {
  /** How far the element shrinks on press — smaller feels "clickier". */
  scaleTo?: number;
}

/**
 * Drop-in Pressable replacement that scales down on touch and springs back
 * on release, so every tap in the app gets the same tactile feedback.
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
