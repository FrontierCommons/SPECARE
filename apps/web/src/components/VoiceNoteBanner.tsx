'use client';

import { useEffect, useRef, useState } from 'react';
import type { VoiceNoteDTO } from '@sper/shared-types';
import { color, type } from '../design/tokens';
import { strings } from '../design/strings';
import { PRESSABLE } from '../design/interaction';

interface Props {
  note: VoiceNoteDTO;
  onReceived: (noteId: string) => void;
  receiving?: boolean;
}

const titleStyle = { ...type.title, fontSize: type.title.fontSize - 3, color: color.sageText };
const thankYouTextStyle = { ...type.label, fontWeight: 600 as const, color: color.bloomText };

/**
 * Web port of apps/mobile/src/components/VoiceNoteBanner.tsx. The audio
 * arrives inline as base64 (see VoiceNoteDTO) — a data: URL is enough for
 * playback here, no cache-file dance like the native side needs. Same card
 * shell as ShareCard ("the post") and the same thank-you pill button as
 * MessageBanner, so both "something arrived for you" cases look like one
 * family.
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
      style={{ backgroundColor: color.bg, borderColor: color.sage }}
    >
      <audio
        ref={audioRef}
        src={`data:${note.mime_type};base64,${note.audio_base64}`}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        className="hidden"
      />
      <p style={titleStyle}>{strings.care.voiceNoteFrom(note.sender_name)}</p>
      <div className="flex items-center gap-md">
        <button
          onClick={toggle}
          aria-label={playing ? strings.care.voiceNotePause : strings.care.voiceNotePlay}
          className={`flex h-12 w-12 items-center justify-center rounded-full ${PRESSABLE}`}
          style={{ backgroundColor: color.sage }}
        >
          <span style={{ color: color.ink, fontWeight: 700 }}>{playing ? '❙❙' : '▶'}</span>
        </button>
        <button
          onClick={() => onReceived(note.id)}
          disabled={receiving}
          aria-label={strings.care.thankYou}
          className={`flex w-fit items-center gap-xs rounded-pill border px-md py-xs disabled:opacity-60 ${PRESSABLE}`}
          style={{ borderColor: color.bloom, backgroundColor: color.bloomSoft }}
        >
          <span style={{ fontSize: 16 }}></span>
          <span style={thankYouTextStyle}>{strings.care.thankYou}</span>
        </button>
      </div>
    </div>
  );
}

export default VoiceNoteBanner;
