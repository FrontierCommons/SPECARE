'use client';

import { useEffect, useState } from 'react';
import { color, type } from '../design/tokens';
import { strings } from '../design/strings';
import { PRESSABLE } from '../design/interaction';

export const MESSAGE_MAX_LENGTH = 300;

interface Props {
  visible: boolean;
  onClose: () => void;
  onSend: (body: string) => Promise<void>;
}

type Phase = 'idle' | 'sending';

const titleStyle = { ...type.title, color: color.textPrimary };
const inputTextStyle = { ...type.body, fontSize: 17, color: color.textPrimary };
const hintStyle = { ...type.body, color: color.textSecondary };
const actionTextPrimaryStyle = { ...type.label, color: color.ink, fontWeight: 600 as const };
const errorStyle = { ...type.caption, color: color.destructive };
const cancelStyle = { ...type.label, color: color.textMuted };

/**
 * The in-app replacement for the old off-app "Send a message" deep link —
 * same visible/onClose/onSend contract as VoiceRecorderSheet, just a text
 * box instead of a recording flow. A small centered dialog (matching
 * ConfirmModal), not a full-width bottom sheet — nothing here needs the
 * extra room. Silently caps at MESSAGE_MAX_LENGTH rather than showing a
 * counter, matching the check-in explain box's convention.
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

  if (!visible) return null;

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
    <div className="fixed inset-0 z-40 flex items-center justify-center p-lg">
      <button
        aria-label={strings.care.messageCancel}
        onClick={phase === 'idle' ? onClose : undefined}
        className="absolute inset-0 bg-[rgba(10,12,14,0.6)]"
      />
      <div className="relative flex w-full max-w-sm flex-col gap-md rounded-lg border border-border bg-bg p-lg shadow-lg">
        <p style={titleStyle}>{strings.care.sendMessage}</p>

        <textarea
          autoFocus
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, MESSAGE_MAX_LENGTH))}
          placeholder={strings.care.messagePlaceholder}
          rows={4}
          disabled={phase === 'sending'}
          style={inputTextStyle}
          className="resize-none rounded-md border border-border bg-surface p-md placeholder:text-textMuted disabled:opacity-60"
        />

        {phase === 'sending' ? <p style={hintStyle}>{strings.care.messageSending}</p> : null}
        {error ? <p style={errorStyle}>{error}</p> : null}

        <div className="flex gap-sm">
          <button
            onClick={onClose}
            disabled={phase === 'sending'}
            className={`flex-1 rounded-md border border-border py-md text-center disabled:opacity-60 ${PRESSABLE}`}
          >
            <span style={cancelStyle}>{strings.care.messageCancel}</span>
          </button>
          <button
            onClick={() => void send()}
            disabled={phase === 'sending' || !body.trim()}
            className={`flex-1 rounded-md border border-sage bg-sage py-md text-center disabled:opacity-60 ${PRESSABLE}`}
          >
            <span style={actionTextPrimaryStyle}>{strings.care.messageSend}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default MessageComposerSheet;
