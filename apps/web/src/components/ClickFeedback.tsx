'use client';

import { useEffect, useRef, useState } from 'react';
import { color } from '../design/tokens';

interface Ripple {
  id: number;
  left: number;
  top: number;
  width: number;
  height: number;
  borderRadius: string;
  originX: number;
  originY: number;
}

const CLICKABLE_SELECTOR = 'button, [role="tab"], [role="switch"], [role="checkbox"], a[href]';
const RIPPLE_LIFETIME_MS = 450;

let sharedAudioCtx: AudioContext | null = null;

/** A short synthesized tick (no audio asset to ship) that reads as a gentle
 * tap, not a chime. Reuses one lazily-created AudioContext per page since
 * browsers require it start from a user gesture — a click qualifies. */
function playClickTone() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!sharedAudioCtx) sharedAudioCtx = new Ctx();
    const ctx = sharedAudioCtx;
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(720, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.08);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  } catch {
    /* audio unsupported/blocked in this browser — the visual ripple still fires */
  }
}

/**
 * App-wide click feedback via one document-level listener, so every
 * button/tab/link gets the same ripple + tick for free with no per-component
 * wiring. Renders as an overlay sized to the clicked element's captured rect
 * rather than as a real child, so it never touches React's DOM ownership of
 * that element. (Hover styling is separate, plain CSS in globals.css.)
 */
export function ClickFeedback() {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      const el = target?.closest(CLICKABLE_SELECTOR) as (HTMLElement & { disabled?: boolean }) | null;
      if (!el || el.disabled) return;

      playClickTone();

      const rect = el.getBoundingClientRect();
      const id = nextId.current++;
      setRipples((rs) => [
        ...rs,
        {
          id,
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          borderRadius: getComputedStyle(el).borderRadius,
          originX: e.clientX - rect.left,
          originY: e.clientY - rect.top,
        },
      ]);
      setTimeout(() => setRipples((rs) => rs.filter((r) => r.id !== id)), RIPPLE_LIFETIME_MS);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]">
      {ripples.map((r) => {
        const size = Math.max(r.width, r.height) * 2;
        return (
          <div
            key={r.id}
            className="absolute overflow-hidden"
            style={{ left: r.left, top: r.top, width: r.width, height: r.height, borderRadius: r.borderRadius }}
          >
            <span
              className="absolute rounded-full"
              style={{
                left: r.originX - size / 2,
                top: r.originY - size / 2,
                width: size,
                height: size,
                backgroundColor: color.sage,
                animation: `sper-click-bubble ${RIPPLE_LIFETIME_MS}ms ease-out forwards`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

export default ClickFeedback;
