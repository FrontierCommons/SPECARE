import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  AudioModule,
  setAudioModeAsync,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { Touchable } from './Touchable';
import { color, elevation, radius, space, type } from '../design/tokens';
import { strings } from '../design/strings';

export const VOICE_NOTE_MAX_DURATION_MS = 30_000;

interface Props {
  visible: boolean;
  onClose: () => void;
  onSend: (input: { audioBase64: string; mimeType: string; durationMs: number }) => Promise<void>;
}

type Phase = 'idle' | 'recording' | 'review' | 'sending';

/**
 * Records up to 30s in-app and hands the result to `onSend` as base64 — no
 * external app, no deep link. Deliberately skips a playback preview before
 * sending (fewer moving parts); a bad take is a re-record, not a listen-back.
 */
export function VoiceRecorderSheet({ visible, onClose, onSend }: Props) {
  // HIGH_QUALITY, not LOW_QUALITY: LOW_QUALITY records AMR-NB in a .3gp
  // container on Android but AAC on iOS — two different, cross-incompatible
  // formats both shipped to the receiver labeled "audio/m4a". HIGH_QUALITY
  // is AAC/.m4a on both platforms, which is what that mime type actually
  // requires to be playable on the other platform.
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 100);
  const [phase, setPhase] = useState<Phase>('idle');
  const [finalDurationMs, setFinalDurationMs] = useState(0);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setPhase('idle');
      setRecordedUri(null);
      setFinalDurationMs(0);
      setError(null);
    }
  }, [visible]);

  const stop = async () => {
    try {
      await recorder.stop();
      setFinalDurationMs(recorderState.durationMillis);
      setRecordedUri(recorder.uri ?? null);
      setPhase('review');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[VoiceRecorderSheet] failed to stop recording', err);
      setError(strings.common.error);
      setPhase('idle');
    }
  };

  // Auto-stop at the 30s cap rather than trusting the responder to notice.
  useEffect(() => {
    if (phase === 'recording' && recorderState.durationMillis >= VOICE_NOTE_MAX_DURATION_MS) {
      void stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, recorderState.durationMillis]);

  const start = async () => {
    setError(null);
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError(strings.care.recordMicDenied);
        return;
      }
      // Required on iOS — the audio session defaults to playback-only, so
      // recording throws until this is set. playsInSilentMode must come
      // along with it: recording categories on iOS ignore the silent
      // switch, so the two can't be set independently.
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase('recording');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[VoiceRecorderSheet] failed to start recording', err);
      setError(strings.common.error);
    }
  };

  const discard = () => {
    setRecordedUri(null);
    setFinalDurationMs(0);
    setPhase('idle');
  };

  const send = async () => {
    if (!recordedUri) return;
    setPhase('sending');
    try {
      const audioBase64 = await FileSystem.readAsStringAsync(recordedUri, { encoding: 'base64' });
      await onSend({
        audioBase64,
        mimeType: 'audio/m4a',
        durationMs: Math.min(finalDurationMs, VOICE_NOTE_MAX_DURATION_MS) || 1,
      });
      onClose();
    } catch {
      setError(strings.common.error);
      setPhase('review');
    }
  };

  const seconds = Math.floor((phase === 'recording' ? recorderState.durationMillis : finalDurationMs) / 1000);
  const timeLabel = `0:${String(seconds).padStart(2, '0')} / 0:${VOICE_NOTE_MAX_DURATION_MS / 1000}`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={phase === 'idle' ? onClose : undefined} />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <Text style={styles.title}>{strings.care.sendVoiceNote}</Text>

        {phase === 'idle' ? (
          <Touchable onPress={start} accessibilityRole="button" accessibilityLabel={strings.care.recordTapToStart}>
            <View style={styles.recordButton}>
              <View style={styles.recordDot} />
            </View>
            <Text style={styles.hint}>{strings.care.recordTapToStart}</Text>
          </Touchable>
        ) : null}

        {phase === 'recording' ? (
          <>
            <Text style={styles.timer}>{timeLabel}</Text>
            <Touchable onPress={stop} accessibilityRole="button" accessibilityLabel={strings.care.recordStop}>
              <View style={[styles.recordButton, styles.recordButtonActive]}>
                <View style={styles.stopSquare} />
              </View>
            </Touchable>
            <Text style={styles.hint}>{strings.care.recording}</Text>
          </>
        ) : null}

        {phase === 'review' ? (
          <>
            <Text style={styles.timer}>{timeLabel}</Text>
            <View style={styles.reviewActions}>
              <Action label={strings.care.recordRerecord} onPress={discard} />
              <Action label={strings.care.recordSend} onPress={send} primary />
            </View>
          </>
        ) : null}

        {phase === 'sending' ? (
          <View style={styles.sendingRow}>
            <ActivityIndicator color={color.sage} />
            <Text style={styles.hint}>{strings.care.recordSending}</Text>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Touchable onPress={onClose} accessibilityRole="button" accessibilityLabel={strings.care.recordCancel}>
          <Text style={styles.cancel}>{strings.care.recordCancel}</Text>
        </Touchable>
      </View>
    </Modal>
  );
}

function Action({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Touchable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.actionBtn, primary && styles.actionBtnPrimary]}
    >
      <Text style={[styles.actionText, primary && styles.actionTextPrimary]}>{label}</Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,12,14,0.6)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: color.border,
    ...elevation.lg,
  },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: color.border },
  title: { ...type.title, color: color.textPrimary },
  hint: { ...type.body, color: color.textSecondary },
  timer: { ...type.heading, color: color.textPrimary },
  recordButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: color.statePit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonActive: { backgroundColor: color.stateHeavy },
  recordDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: color.bg },
  stopSquare: { width: 22, height: 22, borderRadius: 4, backgroundColor: color.bg },
  reviewActions: { flexDirection: 'row', gap: space.md },
  actionBtn: {
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderWidth: 1,
    borderColor: color.border,
  },
  actionBtnPrimary: { backgroundColor: color.sage, borderColor: color.sage },
  actionText: { ...type.label, color: color.textPrimary },
  actionTextPrimary: { color: color.bg, fontWeight: '600' },
  sendingRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  error: { ...type.caption, color: color.statePit, textAlign: 'center' },
  cancel: { ...type.label, color: color.textMuted, marginTop: space.xs },
});

export default VoiceRecorderSheet;
