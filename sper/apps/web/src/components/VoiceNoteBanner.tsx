'use client';

import { useEffect, useRef, useState } from 'react';
import type { VoiceNoteDTO } from '@sper/shared-types';
import { color, type } from '../design/tokens';
import { strings } from '../design/strings';

interface Props {
  note: VoiceNoteDTO;
  onReceived: (noteId: string) => void;
  receiving?: boolean;
}

const titleStyle = { ...type.body, color: color.textPrimary, fontWeight: 600 as const };
const receivedTextStyle = { ...type.label, color: color.textPrimary };

/**
 * Web port of apps/mobile/src/components/VoiceNoteBanner.tsx. The audio
 * arrives inline as base64 (see VoiceNoteDTO) — a data: URL is enough for
 * playback here, no cache-file dance like the native side needs.
 */
export function VoiceNoteBanner({ note, onReceived, receiving }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setPlaying(false);
  }, [note.id]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      return;
    }
    // A finished element is parked at the end — play() from there is a
    // no-op "replay" that never actually replays. Rewind first.
    if (audio.ended || (audio.duration > 0 && audio.currentTime >= audio.duration - 0.05)) {
      audio.currentTime = 0;
    }
    audio.play().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[VoiceNoteBanner] failed to toggle playback', err);
    });
  };

  return (
    <div
      className="flex flex-col gap-md rounded-lg border p-lg shadow-sm"
      style={{ backgroundColor: color.bloomSoft, borderColor: color.bloom }}
    >
      <audio
        ref={audioRef}
        src={`data:${note.mime_type};base64,${note.audio_base64}`}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        className="hidden"
      />
      <p style={titleStyle} className="text-center">
        {strings.care.voiceNoteFrom(note.sender_name)}
      </p>
      <div className="flex justify-center gap-md">
        <button
          onClick={toggle}
          aria-label={playing ? strings.care.voiceNotePause : strings.care.voiceNotePlay}
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: color.sage }}
        >
          <span style={{ color: color.bg, fontWeight: 700 }}>{playing ? '❙❙' : '▶'}</span>
        </button>
        <button
          onClick={() => onReceived(note.id)}
          disabled={receiving}
          aria-label={strings.care.voiceNoteReceived}
          className="flex items-center rounded-md border border-border px-lg"
        >
          <span style={receivedTextStyle}>{strings.care.voiceNoteReceived}</span>
        </button>
      </div>
    </div>
  );
}

export default VoiceNoteBanner;
