import { useEffect, useRef } from 'react';
import type { TouchpointDTO } from '@sper/shared-types';

/**
 * Watches a checkin's touchpoints and fires once for each newly-appeared
 * "PrayedFor" entry — never on the first load (that's just catching up, not
 * news), and never for a voice note or text (those aren't prayer). Paired
 * with polling on the touchpoints query, this is what makes the in-app
 * "someone just prayed for you" toast feel live without a websocket.
 */
export function useNewPrayerAlert(data: TouchpointDTO[] | undefined, onNewPrayer: () => void): void {
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!data) return;
    if (seen.current === null) {
      seen.current = new Set(data.map((t) => t.id));
      return;
    }
    const fresh = data.filter((t) => !seen.current!.has(t.id));
    if (fresh.some((t) => t.type === 'PrayedFor')) onNewPrayer();
    fresh.forEach((t) => seen.current!.add(t.id));
  }, [data, onNewPrayer]);
}

export default useNewPrayerAlert;
