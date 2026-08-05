import React, { useEffect, useState } from 'react';
import { Image, Modal, Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import { Touchable } from './Touchable';
import { color, elevation, radius, space, type } from '../design/tokens';
import { strings } from '../design/strings';

interface Props {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Styles the confirm button with the destructive red instead of sage. */
  danger?: boolean;
  /** If set, the confirm button stays disabled until the user types this exact phrase. */
  confirmPhrase?: string;
  /** Data URI shown as a preview above the body — e.g. a picked photo, before it's applied. */
  previewImage?: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A small centered dialog for actions that shouldn't happen on a single
 * tap — a plain yes/no (frequency change) or, with `confirmPhrase` set, a
 * type-to-confirm gate (account deletion) that keeps Confirm disabled until
 * the typed text matches exactly. Mirrors apps/web/src/components/ConfirmModal.tsx.
 */
export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  danger,
  confirmPhrase,
  previewImage,
  pending,
  onConfirm,
  onCancel,
}: Props) {
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  const locked = !!confirmPhrase && typed !== confirmPhrase;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        style={styles.backdrop}
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel={cancelLabel ?? strings.common.cancel}
      />
      <View style={styles.centerWrap} pointerEvents="box-none">
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>

          {previewImage ? <Image source={{ uri: previewImage }} style={styles.preview} /> : null}

          <Text style={styles.body}>{body}</Text>

          {confirmPhrase ? (
            <TextInput
              value={typed}
              onChangeText={setTyped}
              placeholder={confirmPhrase}
              placeholderTextColor={color.textMuted}
              autoFocus
              autoCapitalize="characters"
              style={styles.input}
            />
          ) : null}

          <View style={styles.row}>
            <Touchable style={styles.cancelBtn} onPress={onCancel} accessibilityRole="button">
              <Text style={styles.cancelText}>{cancelLabel ?? strings.common.cancel}</Text>
            </Touchable>
            <Touchable
              style={[styles.confirmBtn, { backgroundColor: danger ? color.destructive : color.sage }, (locked || pending) && styles.disabled]}
              onPress={onConfirm}
              disabled={locked || pending}
              accessibilityRole="button"
              accessibilityState={{ disabled: locked || pending }}
            >
              <Text style={styles.confirmText}>{confirmLabel}</Text>
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
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: color.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.lg,
    gap: space.md,
    ...elevation.lg,
  },
  title: { ...type.heading, color: color.textPrimary },
  preview: { width: 112, height: 112, borderRadius: 56, alignSelf: 'center' },
  body: { ...type.body, color: color.textSecondary },
  input: {
    ...type.body,
    color: color.textPrimary,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  row: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  cancelBtn: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    paddingVertical: space.sm,
    alignItems: 'center',
  },
  cancelText: { ...type.label, color: color.textSecondary },
  confirmBtn: { flex: 1, borderRadius: radius.md, paddingVertical: space.sm, alignItems: 'center' },
  confirmText: { ...type.label, color: color.bg, fontWeight: '600' },
  disabled: { opacity: 0.4 },
});

export default ConfirmModal;
