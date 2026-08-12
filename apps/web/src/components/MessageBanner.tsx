'use client';

import type { InAppMessageDTO } from '@sper/shared-types';
import { color, type } from '../design/tokens';
import { strings } from '../design/strings';
import { PRESSABLE } from '../design/interaction';

interface Props {
  message: InAppMessageDTO;
  onReceived: (messageId: string) => void;
  receiving?: boolean;
}

const titleStyle = { ...type.title, fontSize: type.title.fontSize - 3, color: color.sage };
const bodyStyle = { ...type.label, fontSize: type.label.fontSize + 1, fontWeight: 400 as const, color: color.textOption };
const thankYouTextStyle = { ...type.label, fontWeight: 600 as const, color: color.bloom };

/**
 * The in-app replacement for the old off-app "Send a message" deep link —
 * the recipient reads the message right here and says "Thank you" before it
 * moves out of their New tab. Same card shell as ShareCard ("the post") so a
 * message reads as part of the same family of things to notice, with the
 * thank-you action styled like a little note being handed back — the same
 * pill shape as LikeButton's reaction, just for a one-time "thanks" instead
 * of a toggleable like.
 */
export function MessageBanner({ message, onReceived, receiving }: Props) {
  return (
    <div
      className="flex flex-col gap-md rounded-lg border p-lg shadow-sm"
      style={{ backgroundColor: color.bg, borderColor: color.sage }}
    >
      <p style={titleStyle}>{strings.care.messageFrom(message.sender_name)}</p>
      <p style={bodyStyle}>&ldquo;{message.body}&rdquo;</p>
      <button
        onClick={() => onReceived(message.id)}
        disabled={receiving}
        aria-label={strings.care.thankYou}
        className={`flex w-fit items-center gap-xs rounded-pill border px-md py-xs disabled:opacity-60 ${PRESSABLE}`}
        style={{ borderColor: color.bloom, backgroundColor: color.bloomSoft }}
      >
        <span style={{ fontSize: 16 }}>💌</span>
        <span style={thankYouTextStyle}>{strings.care.thankYou}</span>
      </button>
    </div>
  );
}

export default MessageBanner;
