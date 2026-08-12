import type { StateLevel } from '@sper/shared-types';
import { color, stateVisual, type } from '../design/tokens';
import { PRESSABLE } from '../design/interaction';

interface Props {
  state: StateLevel;
  selected?: boolean;
  onPress?: () => void;
  compact?: boolean;
}

const labelStyle = { ...type.label };

/**
 * The core state chip. Conveys state THREE ways — color, icon, and label —
 * so it never relies on color alone (WCAG 2.1 AA, and kinder to everyone).
 */
export function StateBadge({ state, selected, onPress, compact }: Props) {
  const v = stateVisual[state];
  const body = (
    <div
      style={{
        borderColor: v.color,
        backgroundColor: selected ? v.color : undefined,
      }}
      className={`flex items-center gap-sm rounded-pill border-[1.5px] ${
        compact ? 'px-sm py-xs' : 'px-md py-sm'
      }`}
    >
      <span style={{ fontSize: 18, color: selected ? color.bg : v.color }}>{v.icon}</span>
      {!compact && <span style={{ ...labelStyle, color: selected ? color.bg : color.textPrimary }}>{v.label}</span>}
    </div>
  );

  if (!onPress) return body;
  return (
    <button onClick={onPress} aria-pressed={!!selected} aria-label={v.label} className={PRESSABLE}>
      {body}
    </button>
  );
}

export default StateBadge;
