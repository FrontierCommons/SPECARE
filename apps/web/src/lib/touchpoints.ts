import type { TouchpointDTO } from '@sper/shared-types';

/**
 * Names for the Care Card's "already reached out" line. The viewer's own
 * touchpoint reads as "You" (never their own name reflected back at them)
 * and is surfaced first so it's the first thing they recognize.
 */
export function reachedNames(touchpoints: TouchpointDTO[] | undefined, viewerId?: string): string[] {
  if (!touchpoints) return [];
  const names = touchpoints.map((t) => (t.responder_id === viewerId ? 'You' : t.responder_name));
  return [...new Set(names)].sort((a, b) => (a === 'You' ? -1 : b === 'You' ? 1 : 0));
}
