import type { SperEntryDTO } from '@sper/shared-types';
import { Avatar } from './Avatar';
import { DIMENSIONS, dimState } from '../lib/checkinState';
import { relativeTime } from '../lib/time';
import { color, stateVisual, type } from '../design/tokens';
import { PRESSABLE } from '../design/interaction';

const SIZE = 96; // overall ring diameter
const STROKE = 10; // bold — this is the whole point
// Round line caps extend past each arc's geometric endpoint by ~STROKE/2 on
// both sides, so a 10px stroke was eating most of the old 8° gap (only ~6px
// of arc length at this radius) — two adjacent segments could visually touch.
// Butt caps make the gap exactly match GAP_DEG with no encroachment.
const GAP_DEG = 10; // breathing room between arcs
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SEGMENT_DEG = 360 / DIMENSIONS.length;
const ARC_DEG = SEGMENT_DEG - GAP_DEG;
const ARC_LEN = (ARC_DEG / 360) * CIRCUMFERENCE;
const DASH = `${ARC_LEN} ${CIRCUMFERENCE - ARC_LEN}`;
const AVATAR_SIZE = SIZE - STROKE * 2 - 8;

const nameStyle = { ...type.caption, color: color.textPrimary };

/**
 * One person in the circle: their avatar wrapped in a bold ring split into
 * five arcs, one per check-in dimension, each colored by that dimension's
 * latest weather state. At a glance the ring reads "mostly clear" or "storm
 * on one side" without a single number ever appearing. Tap for the full
 * picture.
 */
export function MemberOrb({
  entry,
  isSelf,
  onPress,
}: {
  entry: SperEntryDTO;
  isSelf?: boolean;
  onPress: (entry: SperEntryDTO) => void;
}) {
  const displayName = isSelf ? 'You' : entry.name;
  const label = DIMENSIONS.map((d) => dimState(entry, d) ?? 'no answer').join(', ');
  return (
    <button
      onClick={() => onPress(entry)}
      aria-label={`${displayName}: ${label}`}
      className={`flex flex-col items-center gap-xs ${PRESSABLE}`}
      style={{ width: SIZE }}
    >
      <div className="relative flex items-center justify-center" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="absolute left-0 top-0">
          {DIMENSIONS.map((dim, i) => {
            const st = dimState(entry, dim);
            const arcColor = st ? stateVisual[st].color : color.border;
            const rotation = -90 + i * SEGMENT_DEG + GAP_DEG / 2;
            return (
              <circle
                key={dim}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                stroke={arcColor}
                strokeWidth={STROKE}
                strokeDasharray={DASH}
                strokeLinecap="butt"
                fill="none"
                transform={`rotate(${rotation} ${SIZE / 2} ${SIZE / 2})`}
              />
            );
          })}
        </svg>
        <div className="rounded-full" style={{ borderRadius: AVATAR_SIZE / 2 }}>
          <Avatar name={entry.name} avatarUrl={entry.avatar_url} size={AVATAR_SIZE} />
        </div>
        {entry.created_at ? (
          <span
            className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-pill px-xs shadow-sm"
            style={{ top: -6, backgroundColor: '#F5E1A0', fontSize: 11, fontWeight: 700, color: '#1C2024' }}
          >
            {relativeTime(entry.created_at)}
          </span>
        ) : null}
      </div>
      <span style={nameStyle} className="w-full truncate text-center">
        {displayName}
      </span>
    </button>
  );
}

export default MemberOrb;
