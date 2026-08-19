import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { VoiceNoteDTO } from '@sper/shared-types';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { Touchable } from './Touchable';
import { color, elevation, radius, space, type } from '../design/tokens';
import { strings } from '../design/strings';

interface Props {
  note: VoiceNoteDTO;
  onReceived: (noteId: string) => void;
  receiving?: boolean;
}

/**
 * A pending voice note. Audio arrives as base64 (VoiceNoteDTO) — this writes
 * it to a cache file so expo-audio has a real file:// uri, and deletes that
 * file on unmount/acknowledgment.
 */
export function VoiceNoteBanner({ note, onReceived, receiving }: Props) {
  const [localUri, setLocalUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const path = `${FileSystem.cacheDirectory}voice-note-${note.id}.m4a`;
    // playsInSilentMode is required on iOS or playback is inaudible whenever
    // the mute switch is on / the session was never otherwise configured.
    Promise.all([
      setAudioModeAsync({ playsInSilentMode: true }),
      FileSystem.writeAsStringAsync(path, note.audio_base64, { encoding: 'base64' }),
    ])
      .then(() => {
        if (!cancelled) setLocalUri(path);
      })
      .catch(() => {
        /* playback simply won't be available; Received still works */
      });
    return () => {
      cancelled = true;
      void FileSystem.deleteAsync(path, { idempotent: true });
    };
  }, [note.id, note.audio_base64]);

  const player = useAudioPlayer(localUri);
  const status = useAudioPlayerStatus(player);

  const toggle = async () => {
    if (!localUri) return;
    try {
      if (status.playing) {
        player.pause();
        return;
      }
      // A finished player is parked at the end of the track — play() from
      // there is a no-op (silent "replay" that never actually replays).
      // Rewind first whenever playback isn't part-way through.
      const atEnd = status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration - 0.05);
      if (atEnd) await player.seekTo(0);
      player.play();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[VoiceNoteBanner] failed to toggle playback', err);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{strings.care.voiceNoteFrom(note.sender_name)}</Text>
      <View style={styles.row}>
        <Touchable
          onPress={toggle}
          disabled={!localUri}
          accessibilityRole="button"
          accessibilityLabel={status.playing ? strings.care.voiceNotePause : strings.care.voiceNotePlay}
          style={styles.playButton}
        >
          <Text style={styles.playGlyph}>{status.playing ? '❙❙' : '▶'}</Text>
        </Touchable>
        <Touchable
          onPress={() => onReceived(note.id)}
          disabled={receiving}
          accessibilityRole="button"
          accessibilityLabel={strings.care.voiceNoteReceived}
          style={styles.receivedButton}
        >
          <Text style={styles.receivedText}>{strings.care.voiceNoteReceived}</Text>
        </Touchable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.bloomSoft,
    borderColor: color.bloom,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
    ...elevation.sm,
  },
  title: { ...type.body, color: color.textPrimary, fontWeight: '600', textAlign: 'center' },
  row: { flexDirection: 'row', gap: space.md, justifyContent: 'center' },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: color.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyph: { color: color.bg, fontSize: 16, fontWeight: '700' },
  receivedButton: {
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: color.border,
  },
  receivedText: { ...type.label, color: color.textPrimary },
});

export default VoiceNoteBanner;
