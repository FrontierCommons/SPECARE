'use client';

import { color, type } from '../design/tokens';
import { strings } from '../design/strings';

const likeTextStyle = { ...type.label, fontWeight: 600 as const };

/**
 * A quiet, count-only reaction — no list of who liked it, just a warm nudge
 * that someone noticed. Shared between the pure "share something special"
 * card and a Care Card's post-action notes, which use the same treatment.
 */
export function LikeButton({
  liked,
  count,
  onToggle,
  pending,
}: {
  liked: boolean;
  count: number;
  onToggle: () => void;
  pending?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={pending}
      aria-pressed={liked}
      aria-label={liked ? strings.care.liked : strings.care.like}
      className="flex w-fit items-center gap-xs rounded-pill border px-md py-xs disabled:opacity-60"
      style={{
        borderColor: liked ? color.bloom : color.border,
        backgroundColor: liked ? color.surfaceRaised : 'transparent',
      }}
    >
      <span style={{ fontSize: 16 }}>{liked ? '❤️' : '🤍'}</span>
      <span style={{ ...likeTextStyle, color: liked ? color.bloom : color.textSecondary }}>
        {strings.care.likeCount(count)}
      </span>
    </button>
  );
}

export default LikeButton;
