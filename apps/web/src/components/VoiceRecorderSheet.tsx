'use client';

import { useEffect, useRef, useState } from 'react';
import { color, type } from '../design/tokens';
import { strings } from '../design/strings';
import { PRESSABLE } from '../design/interaction';

export const VOICE_NOTE_MAX_DURATION_MS = 30_000;

interface Props {
  visible: boolean;
  onClose: () => void;
  onSend: (input: { audioBase64: string; mimeType: string; durationMs: number }) => Promise<void>;
}

type Phase = 'idle' | 'recording' | 'review' | 'sending';

const titleStyle = { ...type.title, color: color.textPrimary };
const hintStyle = { ...type.body, color: color.textSecondary };
const timerStyle = { ...type.heading, color: color.textPrimary };
const actionTextStyle = { ...type.label, color: color.textPrimary };
const actionTextPrimaryStyle = { ...type.label, color: color.ink, fontWeight: 600 as const };
const errorStyle = { ...type.caption, color: color.statePit };
const cancelStyle = { ...type.label, color: color.textMuted };

/** First MediaRecorder mime type the browser actually supports, so the real
 * recorded format is always what gets sent — never a hardcoded guess. */
function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  return candidates.find((c) => MediaRecorder.isTypeSupported(c)) ?? '';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Web port of apps/mobile/src/components/VoiceRecorderSheet.tsx. Same 30s-cap
 * record/preview/send flow, but via the browser's MediaRecorder instead of
 * expo-audio — a genuinely different API, not a literal port. Sends whatever
 * codec the browser actually picked (webm/opus on Chrome & Firefox, mp4/aac
 * on Safari) rather than a hardcoded guess, since native apps' decoders may
 * not support webm/opus — same class of format risk the mobile fix addressed
 * for Android vs iOS. A small centered dialog (matching
 * ConfirmModal/MessageComposerSheet), not a full-width bottom sheet.
 */
export function VoiceRecorderSheet({ visible, onClose, onSend }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const cleanupStream = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  // Swaps in a new preview URL (or clears it), always revoking whatever
  // object URL it's replacing — the recorded blob never leaves this
  // component, so this is the only thing that needs cleanup.
  const setPreview = (url: string | null) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setPlaying(false);
  };

  useEffect(() => {
    if (!visible) {
      setPhase('idle');
      setError(null);
      setElapsedMs(0);
      setRecordedBlob(null);
      setPreview(null);
      cleanupStream();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(
    () => () => {
      cleanupStream();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  const togglePreview = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      return;
    }
    if (audio.ended || (audio.duration > 0 && audio.currentTime >= audio.duration - 0.05)) {
      audio.currentTime = 0;
    }
    audio.play().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[VoiceRecorderSheet] failed to play preview', err);
    });
  };

  const stop = () => {
    recorderRef.current?.stop();
  };

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || recorder.mimeType || 'audio/webm' });
        setRecordedBlob(blob);
        setPreview(URL.createObjectURL(blob));
        setPhase('review');
        cleanupStream();
      };

      recorder.start();
      startedAtRef.current = Date.now();
      setPhase('recording');
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startedAtRef.current;
        setElapsedMs(elapsed);
        if (elapsed >= VOICE_NOTE_MAX_DURATION_MS) stop();
      }, 100);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[VoiceRecorderSheet] failed to start recording', err);
      setError(strings.care.recordMicDenied);
      cleanupStream();
    }
  };

  const discard = () => {
    setRecordedBlob(null);
    setPreview(null);
    setElapsedMs(0);
    setPhase('idle');
  };

  const send = async () => {
    if (!recordedBlob) return;
    setPhase('sending');
    try {
      const audioBase64 = await blobToBase64(recordedBlob);
      await onSend({
        audioBase64,
        mimeType: recordedBlob.type || 'audio/webm',
        durationMs: Math.min(elapsedMs, VOICE_NOTE_MAX_DURATION_MS) || 1,
      });
      onClose();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[VoiceRecorderSheet] failed to send', err);
      setError(strings.common.error);
      setPhase('review');
    }
  };

  if (!visible) return null;

  const seconds = Math.min(Math.floor(elapsedMs / 1000), VOICE_NOTE_MAX_DURATION_MS / 1000);
  const timeLabel = `0:${String(seconds).padStart(2, '0')} / 0:${VOICE_NOTE_MAX_DURATION_MS / 1000}`;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-lg">
      <button
        aria-label={strings.care.recordCancel}
        onClick={phase === 'idle' ? onClose : undefined}
        className="absolute inset-0 bg-[rgba(10,12,14,0.6)]"
      />
      <div className="relative flex w-full max-w-sm flex-col items-center gap-md rounded-lg border border-border bg-bg p-lg shadow-lg">
        <p style={titleStyle}>{strings.care.sendVoiceNote}</p>

        {phase === 'idle' ? (
          <button
            onClick={start}
            aria-label={strings.care.recordTapToStart}
            className={`flex flex-col items-center gap-sm ${PRESSABLE}`}
          >
            <span
              className="flex items-center justify-center rounded-full"
              style={{ width: 72, height: 72, backgroundColor: color.statePit }}
            >
              <span className="block rounded-full" style={{ width: 24, height: 24, backgroundColor: color.ink }} />
            </span>
            <span style={hintStyle}>{strings.care.recordTapToStart}</span>
          </button>
        ) : null}

        {phase === 'recording' ? (
          <>
            <p style={timerStyle}>{timeLabel}</p>
            <button
              onClick={stop}
              aria-label={strings.care.recordStop}
              className={`flex items-center justify-center rounded-full ${PRESSABLE}`}
              style={{ width: 72, height: 72, backgroundColor: color.stateHeavy }}
            >
              <span className="block rounded" style={{ width: 22, height: 22, backgroundColor: color.ink }} />
            </button>
            <p style={hintStyle}>{strings.care.recording}</p>
          </>
        ) : null}

        {phase === 'review' ? (
          <>
            {previewUrl ? (
              <audio
                ref={audioRef}
                src={previewUrl}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
                className="hidden"
              />
            ) : null}
            <p style={timerStyle}>{timeLabel}</p>
            <button
              onClick={togglePreview}
              aria-label={playing ? strings.care.voiceNotePause : strings.care.voiceNotePlay}
              className={`flex h-14 w-14 items-center justify-center rounded-full ${PRESSABLE}`}
              style={{ backgroundColor: color.sage }}
            >
              <span style={{ color: color.ink, fontWeight: 700, fontSize: 18 }}>{playing ? '❙❙' : '▶'}</span>
            </button>
            <p style={hintStyle}>{strings.care.recordPreviewHint}</p>
            <div className="flex gap-md">
              <button
                onClick={discard}
                aria-label={strings.care.recordRerecord}
                className={`rounded-md border border-border px-lg py-md ${PRESSABLE}`}
              >
                <span style={actionTextStyle}>{strings.care.recordRerecord}</span>
              </button>
              <button
                onClick={send}
                aria-label={strings.care.recordSend}
                className={`rounded-md border border-sage bg-sage px-lg py-md ${PRESSABLE}`}
              >
                <span style={actionTextPrimaryStyle}>{strings.care.recordSend}</span>
              </button>
            </div>
          </>
        ) : null}

        {phase === 'sending' ? <p style={hintStyle}>{strings.care.recordSending}</p> : null}

        {error ? <p style={errorStyle}>{error}</p> : null}

        <button onClick={onClose} className={`mt-xs ${PRESSABLE}`}>
          <span style={cancelStyle}>{strings.care.recordCancel}</span>
        </button>
      </div>
    </div>
  );
}

export default VoiceRecorderSheet;
