import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Touchable } from './Touchable';
import { color, elevation, radius, space, type } from '../design/tokens';
import { strings } from '../design/strings';

export const MESSAGE_MAX_LENGTH = 300;

interface Props {
  visible: boolean;
  onClose: () => void;
  onSend: (body: string) => Promise<void>;
}

type Phase = 'idle' | 'sending';

/**
 * The in-app replacement for the old off-app "Send a message" deep link —
 * same visible/onClose/onSend contract as VoiceRecorderSheet, just a text
 * box instead of a recording flow. Silently caps at MESSAGE_MAX_LENGTH
 * rather than showing a counter, matching the check-in explain box.
 */
export function MessageComposerSheet({ visible, onClose, onSend }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setPhase('idle');
      setBody('');
      setError(null);
    }
  }, [visible]);

  const send = async () => {
    if (!body.trim()) return;
    setPhase('sending');
    try {
      await onSend(body.trim());
      onClose();
    } catch {
      setError(strings.common.error);
      setPhase('idle');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={phase === 'idle' ? onClose : undefined} />
      <View style={styles.centerWrap} pointerEvents="box-none">
        <View style={styles.dialog}>
          <Text style={styles.title}>{strings.care.sendMessage}</Text>

          <TextInput
            style={styles.input}
            value={body}
            onChangeText={(t) => setBody(t.slice(0, MESSAGE_MAX_LENGTH))}
            placeholder={strings.care.messagePlaceholder}
            placeholderTextColor={color.textMuted}
            multiline
            numberOfLines={4}
            editable={phase !== 'sending'}
            autoFocus
          />

          {phase === 'sending' ? <Text style={styles.hint}>{strings.care.messageSending}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <Touchable
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={phase === 'sending'}
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>{strings.care.messageCancel}</Text>
            </Touchable>
            <Touchable
              style={[styles.sendBtn, (phase === 'sending' || !body.trim()) && styles.sendBtnDisabled]}
              onPress={() => void send()}
              disabled={phase === 'sending' || !body.trim()}
              accessibilityRole="button"
            >
              <Text style={styles.sendText}>{strings.care.messageSend}</Text>
            </Touchable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,12,14,0.6)' },
  centerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
  },
  dialog: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: color.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.lg,
    gap: space.md,
    ...elevation.lg,
  },
  title: { ...type.title, color: color.textPrimary },
  input: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.md,
    color: color.textPrimary,
    ...type.body,
    fontSize: 16,
    minHeight: 96,
    textAlignVertical: 'top',
  },
  hint: { ...type.body, color: color.textSecondary },
  error: { ...type.caption, color: color.destructive },
  actions: { flexDirection: 'row', gap: space.sm },
  cancelBtn: {
    flex: 1,
    paddingVertical: space.md,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
  },
  cancelText: { ...type.label, color: color.textMuted },
  sendBtn: {
    flex: 1,
    paddingVertical: space.md,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.sage,
    backgroundColor: color.sage,
  },
  sendBtnDisabled: { opacity: 0.6 },
  sendText: { ...type.label, color: color.bg, fontWeight: '600' },
});

export default MessageComposerSheet;
