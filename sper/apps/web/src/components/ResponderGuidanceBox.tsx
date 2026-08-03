import { color, type } from '../design/tokens';
import { strings } from '../design/strings';

const textStyle = { ...type.label, color: color.textPrimary, fontWeight: 600 as const };

/**
 * Shown on every Care Card, right above the action buttons — a short, warm
 * lead-in rather than a paragraph of instructions on how to comfort someone.
 */
export function ResponderGuidanceBox() {
  return <p style={textStyle}>{strings.care.guidance}</p>;
}

export default ResponderGuidanceBox;
