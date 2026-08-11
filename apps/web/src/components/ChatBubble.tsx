'use client';

import { useEffect, useState } from 'react';
import { color, type } from '../design/tokens';

const botTextStyle = { ...type.body, fontSize: 17, color: color.textPrimary };
const userTextStyle = { ...type.body, fontSize: 17, color: color.bg, fontWeight: 500 as const };

/**
 * One message in the check-in "conversation" — bot on the left, the
 * member's own answers on the right. Keeps the five-question check-in
 * feeling like a quick chat rather than a form. Each bubble is a fresh
 * component instance when it's added to the transcript, so a mount-time
 * CSS transition is enough to animate every new message as it arrives.
 */
export function ChatBubble({
  from,
  text,
  bubbleColor,
  nowrap,
}: {
  from: 'bot' | 'user';
  text: string;
  /** Overrides the default bubble background — used to echo the state color of a user's answer. */
  bubbleColor?: string;
  /** Short, known-length text (a picked answer, not free prose) that must
   * stay on one line — drops the 82%-width cap too, since a wrapped-off
   * single line would otherwise just get clipped instead of shrinking. */
  nowrap?: boolean;
}) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className={`flex transition-all duration-200 ease-out ${from === 'user' ? 'justify-end' : ''} ${
        entered ? 'translate-y-0 opacity-100' : 'translate-y-1.5 opacity-0'
      }`}
    >
      <div
        className={`rounded-lg px-md py-sm ${nowrap ? 'max-w-full' : 'max-w-[82%]'} ${
          from === 'bot' ? 'rounded-bl-sm bg-surface' : 'rounded-br-sm bg-sage'
        }`}
        style={from === 'user' && bubbleColor ? { backgroundColor: bubbleColor } : undefined}
      >
        <span
          style={from === 'user' ? userTextStyle : botTextStyle}
          className={nowrap ? 'whitespace-nowrap' : undefined}
        >
          {text}
        </span>
      </div>
    </div>
  );
}

export default ChatBubble;
