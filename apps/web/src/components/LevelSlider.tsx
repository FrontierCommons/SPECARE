'use client';

import { useState, type CSSProperties } from 'react';
import { color, stateVisual, type } from '../design/tokens';
import { levelForScore, SCORE_MIN, SCORE_MAX } from '../lib/checkinState';

interface Props {
  /** Null until the member has actually dragged the thumb once. */
  value: number | null;
  onChange: (value: number) => void;
}

const feedbackStyle = { ...type.label, fontWeight: 600 as const };
const placeholderStyle = { ...type.caption, color: color.textMuted };
const endLabelStyle = { ...type.caption, fontSize: 13, fontWeight: 600 as const, color: color.textPrimary };

const pct = (v: number) => ((v - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 100;

/** Solid at the center of each band, fading through the gap between one
 * band's edge and the next (e.g. 3 → 4) — the transition itself reads as
 * the metaphor, weather easing from one condition into another. */
const TRACK_GRADIENT = `linear-gradient(to right, ${[
  [pct(1), stateVisual['In the Pit'].color],
  [pct(3), stateVisual['In the Pit'].color],
  [pct(4), stateVisual.Heavy.color],
  [pct(5), stateVisual.Heavy.color],
  [pct(6), stateVisual.Steady.color],
  [pct(8), stateVisual.Steady.color],
  [pct(9), stateVisual.Thriving.color],
  [pct(10), stateVisual.Thriving.color],
]
  .map(([p, c]) => `${c} ${p}%`)
  .join(', ')})`;

// Split so the thumb can grow and glow while actively dragged, on top of the
// always-on sizing/color rules — a purely visual cue that a touch registered.
const THUMB_BASE_CLASSES = [
  'absolute inset-0 h-3 w-full cursor-pointer appearance-none bg-transparent',
  '[&::-webkit-slider-runnable-track]:bg-transparent',
  '[&::-moz-range-track]:bg-transparent',
  '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:w-7',
  '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white',
  '[&::-webkit-slider-thumb]:bg-[var(--thumb-color)] [&::-webkit-slider-thumb]:transition-transform',
  '[&::-webkit-slider-thumb]:duration-150',
  '[&::-moz-range-thumb]:h-7 [&::-moz-range-thumb]:w-7 [&::-moz-range-thumb]:rounded-full',
  '[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[var(--thumb-color)]',
  '[&::-moz-range-thumb]:transition-transform [&::-moz-range-thumb]:duration-150',
].join(' ');

const THUMB_RESTING_CLASSES = '[&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:shadow-md';

const THUMB_DRAGGING_CLASSES = [
  '[&::-webkit-slider-thumb]:scale-125 [&::-webkit-slider-thumb]:shadow-lg',
  '[&::-moz-range-thumb]:scale-125 [&::-moz-range-thumb]:shadow-lg',
].join(' ');

/** A 1–10 drag slider standing in for the four-button picker in the
 * check-in's "explain in your own words" flow, so a score can land between
 * two states instead of snapping to one. */
export function LevelSlider({ value, onChange }: Props) {
  const [dragging, setDragging] = useState(false);
  const shown = value ?? Math.round((SCORE_MIN + SCORE_MAX) / 2);
  const level = levelForScore(shown);
  const levelColor = stateVisual[level].color;

  const stopDragging = () => setDragging(false);

  return (
    <div className="flex flex-col items-center gap-sm">
      {value !== null ? (
        <p
          style={{ ...feedbackStyle, color: levelColor }}
          className={`whitespace-nowrap transition-transform duration-150 ${dragging ? 'scale-110' : 'scale-100'}`}
        >
          {`${value}/10 — ${stateVisual[level].label}`}
        </p>
      ) : (
        <p style={placeholderStyle} className="whitespace-nowrap">
          Slide to show us
        </p>
      )}

      <div className="w-full">
        <div className="relative h-3 w-full">
          <div
            className="h-3 w-full rounded-pill transition-shadow duration-150"
            style={{
              background: TRACK_GRADIENT,
              boxShadow: dragging ? `0 0 0 6px ${levelColor}33` : '0 0 0 0 transparent',
            }}
          />
          <input
            type="range"
            min={SCORE_MIN}
            max={SCORE_MAX}
            step={1}
            value={shown}
            onChange={(e) => onChange(Number(e.target.value))}
            onPointerDown={() => setDragging(true)}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
            onBlur={stopDragging}
            aria-label="How's it going, from 1 (not well) to 10 (very well)"
            className={`${THUMB_BASE_CLASSES} ${dragging ? THUMB_DRAGGING_CLASSES : THUMB_RESTING_CLASSES}`}
            style={{ '--thumb-color': levelColor } as CSSProperties}
          />
        </div>
        <div className="mt-xs flex w-full justify-between">
          <span style={endLabelStyle}>Not well</span>
          <span style={endLabelStyle}>Very well</span>
        </div>
      </div>
    </div>
  );
}
