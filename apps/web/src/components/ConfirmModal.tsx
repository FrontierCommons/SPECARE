'use client';

import { useEffect, useState } from 'react';
import { color, type } from '../design/tokens';
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

const titleStyle = { ...type.heading, color: color.textPrimary };
const bodyStyle = { ...type.body, color: color.textSecondary };
const cancelTextStyle = { ...type.label, color: color.textSecondary };
const confirmTextStyle = { ...type.label, color: color.bg, fontWeight: 600 as const };
const inputStyle = { ...type.body, color: color.textPrimary };

/**
 * A small centered dialog for actions that shouldn't happen on a single
 * tap — a plain yes/no (frequency change) or, with `confirmPhrase` set, a
 * type-to-confirm gate (account deletion) that keeps Confirm disabled until
 * the typed text matches exactly.
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

  if (!open) return null;

  const locked = !!confirmPhrase && typed !== confirmPhrase;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-lg">
      <button
        aria-label={cancelLabel ?? strings.common.cancel}
        onClick={onCancel}
        className="absolute inset-0 bg-[rgba(10,12,14,0.6)]"
      />
      <div className="relative flex w-full max-w-sm flex-col gap-md rounded-lg border border-border bg-bg p-lg shadow-lg">
        <h2 style={titleStyle}>{title}</h2>

        {previewImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local data URI, not a Next/Image-known domain
          <img src={previewImage} alt="" className="mx-auto h-28 w-28 rounded-full object-cover" />
        ) : null}

        <p style={bodyStyle}>{body}</p>

        {confirmPhrase ? (
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={confirmPhrase}
            autoFocus
            style={inputStyle}
            className="rounded-md border border-border bg-surface px-md py-sm placeholder:text-textMuted"
          />
        ) : null}

        <div className="mt-sm flex gap-sm">
          <button onClick={onCancel} className="flex-1 rounded-md border border-border py-sm text-center">
            <span style={cancelTextStyle}>{cancelLabel ?? strings.common.cancel}</span>
          </button>
          <button
            onClick={onConfirm}
            disabled={locked || pending}
            className="flex-1 rounded-md py-sm text-center disabled:opacity-40"
            style={{ backgroundColor: danger ? color.destructive : color.sage }}
          >
            <span style={confirmTextStyle}>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
