import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import { color, motion, radius, space, type } from '../design/tokens';

/**
 * One message in the check-in "conversation" — bot on the left, member's
 * answers on the right, so the five questions feel like a chat, not a form.
 * Each bubble is a fresh component instance per message, so a mount-time
 * animation alone is enough to animate every arrival.
 */
export function ChatBubble({
  from,
  text,
  bubbleColor,
}: {
  from: 'bot' | 'user';
  text: string;
  /** Overrides the default bubble background — used to echo the state color of a user's answer. */
  bubbleColor?: string;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: motion.duration.base,
      easing: motion.easing.decelerate,
      useNativeDriver: true,
    }).start();
    Animated.timing(translateY, {
      toValue: 0,
      duration: motion.duration.base,
      easing: motion.easing.decelerate,
      useNativeDriver: true,
    }).start();
  }, [opacity, translateY]);

  return (
    <Animated.View
      style={[styles.row, from === 'user' && styles.rowUser, { opacity, transform: [{ translateY }] }]}
    >
      <View
        style={[
          styles.bubble,
          from === 'bot' ? styles.bot : styles.user,
          from === 'user' && bubbleColor ? { backgroundColor: bubbleColor } : null,
        ]}
      >
        <Text style={[styles.text, from === 'user' && styles.userText]}>{text}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  rowUser: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '82%',
    borderRadius: radius.lg,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  bot: {
    backgroundColor: color.surface,
    borderBottomLeftRadius: radius.sm,
  },
  user: {
    backgroundColor: color.sage,
    borderBottomRightRadius: radius.sm,
  },
  text: { ...type.body, fontSize: 15, color: color.textPrimary },
  userText: { color: color.bg, fontWeight: '500' },
});

export default ChatBubble;
