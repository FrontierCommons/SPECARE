import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import { color, motion, radius, space, type } from '../design/tokens';

/**
 * One message in the check-in "conversation" — bot on the left, the
 * member's own answers on the right. Keeps the five-question check-in
 * feeling like a quick chat rather than a form. Each bubble is a fresh
 * component instance when it's added to the transcript, so a mount-time
 * entrance is enough to animate every new message as it arrives.
 */
export function ChatBubble({ from, text }: { from: 'bot' | 'user'; text: string }) {
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
      <View style={[styles.bubble, from === 'bot' ? styles.bot : styles.user]}>
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
