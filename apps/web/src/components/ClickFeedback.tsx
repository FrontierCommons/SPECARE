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

/** A short, soft synthesized tick — no audio asset to ship, just a brief
 * sine blip with a fast attack/decay envelope so it reads as a gentle tap,
 * not a notification chime. Lazily creates one AudioContext per page (the
 * browser requires it start from a user gesture, and a click is exactly
 * that) and reuses it for every subsequent click. */
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
 * App-wide click feedback: a ripple that expands from the tap point but
 * stays clipped to the shape of the button/tab/link that was actually
 * clicked, plus a short synthesized tick — via one document-level listener
 * instead of per-component wiring, so every functional control gets the
 * same felt response automatically. Rendered as a fixed-position overlay
 * sized to match the clicked element's own rect (captured at click time)
 * rather than injected as a real child of it, so this never touches React's
 * ownership of that element's DOM subtree. Hover highlighting for
 * pointer/mouse users is plain CSS, in globals.css.
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
