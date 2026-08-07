'use client';

import { useEffect, useState } from 'react';
import type { CheckInFrequency } from '@sper/shared-types';
import { nextCheckInCountdown } from '../lib/time';
import { color, type } from '../design/tokens';
import { strings } from '../design/strings';

const TICK_MS = 1_000;

const textStyle = { ...type.label, fontSize: type.label.fontSize - 2, color: color.textPrimary };

/** Live, real-time "time until your next check-in" line, ticking down to the
 * second, shown once today's check-in is in. */
export function NextCheckInCountdown({
  lastCheckInAt,
  frequency,
}: {
  lastCheckInAt: string;
  frequency: CheckInFrequency;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <p style={textStyle} className="text-center">
      {strings.sper.nextCheckIn(nextCheckInCountdown(lastCheckInAt, frequency))}
    </p>
  );
}

export default NextCheckInCountdown;
