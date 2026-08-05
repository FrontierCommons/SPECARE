import type { TouchpointDTO, TouchpointType } from '@sper/shared-types';

/**
 * Names for the Care Card's "already reached out" line. The viewer's own
 * touchpoint reads as "You" (never their own name reflected back at them)
 * and is surfaced first so it's the first thing they recognize.
 *
 * `onlyType` narrows this to a single touchpoint type — the Care Card uses
 * this to count only an actual sent voice note as "reached out", since a
 * prayer or a logged text is quieter and shouldn't claim the same credit.
 */
export function reachedNames(
  touchpoints: TouchpointDTO[] | undefined,
  viewerId?: string,
  onlyType?: TouchpointType,
): string[] {
  if (!touchpoints) return [];
  const filtered = onlyType ? touchpoints.filter((t) => t.type === onlyType) : touchpoints;
  const names = filtered.map((t) => (t.responder_id === viewerId ? 'You' : t.responder_name));
  return [...new Set(names)].sort((a, b) => (a === 'You' ? -1 : b === 'You' ? 1 : 0));
}
