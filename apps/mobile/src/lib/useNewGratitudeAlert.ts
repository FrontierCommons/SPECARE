import { useEffect, useRef } from 'react';
import type { CareCardDTO } from '@sper/shared-types';

/**
 * Watches the viewer's care cards and fires once for each newly-appeared
 * `gratitude_shown` flag on a card that isn't their own — the moment a
 * friend they sent a voice note, message, or call to thanks them for it.
 * `gratitude_shown` is itself already a one-time server flag (true on the
 * first fetch after being thanked, false after), so the only thing this
 * adds is not firing on the very first load, same rule as
 * useNewPrayerAlert — that's catching up, not news.
 */
export function useNewGratitudeAlert(
  data: CareCardDTO[] | undefined,
  viewerId: string | undefined,
  onNewGratitude: (name: string) => void,
): void {
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!data) return;
    const grateful = data.filter((c) => c.target_user_id !== viewerId && c.gratitude_shown);
    if (seen.current === null) {
      seen.current = new Set(grateful.map((c) => c.checkin_id));
      return;
    }
    const fresh = grateful.filter((c) => !seen.current!.has(c.checkin_id));
    fresh.forEach((c) => {
      seen.current!.add(c.checkin_id);
      onNewGratitude(c.target_name);
    });
  }, [data, viewerId, onNewGratitude]);
}

export default useNewGratitudeAlert;
