import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { InAppMessageDTO } from '@sper/shared-types';
import { Touchable } from './Touchable';
import { color, elevation, radius, space, type } from '../design/tokens';
import { strings } from '../design/strings';

interface Props {
  message: InAppMessageDTO;
  onReceived: (messageId: string) => void;
  receiving?: boolean;
}

/**
 * The in-app replacement for the old off-app "Send a message" deep link —
 * the recipient reads the message right here and says "Thank you" before it
 * moves out of their New tab. Mirrors VoiceNoteBanner's receiving-side shape.
 */
export function MessageBanner({ message, onReceived, receiving }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{strings.care.messageFrom(message.sender_name)}</Text>
      <Text style={styles.body}>&ldquo;{message.body}&rdquo;</Text>
      <Touchable
        onPress={() => onReceived(message.id)}
        disabled={receiving}
        accessibilityRole="button"
        accessibilityLabel={strings.care.thankYou}
        style={styles.thankYouButton}
      >
        <Text style={styles.thankYouEmoji}>💌</Text>
        <Text style={styles.thankYouText}>{strings.care.thankYou}</Text>
      </Touchable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.bg,
    borderColor: color.sage,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
    ...elevation.sm,
  },
  title: { ...type.title, fontSize: type.title.fontSize - 3, color: color.sage },
  body: { ...type.label, fontSize: type.label.fontSize + 1, color: color.textPrimary },
  thankYouButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.bloom,
    backgroundColor: color.bloomSoft,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  thankYouEmoji: { fontSize: 16 },
  thankYouText: { ...type.label, fontWeight: '600', color: color.bloom },
});

export default MessageBanner;
