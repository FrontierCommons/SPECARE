import { color, type } from '../design/tokens';

const textStyle = { ...type.label, color: color.bg, fontWeight: 700 as const };

/**
 * A brief in-app notification that slides down from the top and springs
 * back out of view — used for events that happen while you're already
 * looking at the app (like a circle member praying for you) rather than
 * a push notification, which is for when you're not. Web port of
 * apps/mobile/src/components/Toast.tsx: RN `Animated.spring` becomes a plain
 * CSS transition on `transform`, no animation library needed.
 */
export function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed left-lg right-lg top-sm z-20 rounded-pill px-md py-sm text-center shadow-floating transition-transform duration-300 ease-out ${
        visible ? 'translate-y-0' : '-translate-y-[150%]'
      }`}
      style={{ backgroundColor: color.bloom }}
    >
      <span style={textStyle}>{message}</span>
    </div>
  );
}

export default Toast;
