import { color, type } from '../design/tokens';
import { strings } from '../design/strings';

const textStyle = { ...type.label, color: color.textPrimary, fontWeight: 600 as const };

/**
 * A short, warm lead-in on every Care Card — not a paragraph of instructions
 * on how to comfort someone. Kept separate from the verse above it (see
 * CareCard / lib/encourageVerses) so this box stays reusable without one baked in.
 */
export function ResponderGuidanceBox() {
  return <p style={textStyle}>{strings.care.guidance}</p>;
}

export default ResponderGuidanceBox;
