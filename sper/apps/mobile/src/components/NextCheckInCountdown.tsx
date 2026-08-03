import React, { useEffect, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import type { CheckInFrequency } from '@sper/shared-types';
import { nextCheckInCountdown } from '../lib/time';
import { strings } from '../design/strings';
import { color, space, type as typeTokens } from '../design/tokens';

const TICK_MS = 30_000;

/** Live "time until your next check-in" line, shown once today's is in. */
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
    <Text style={styles.text}>
      {strings.sper.nextCheckIn(nextCheckInCountdown(lastCheckInAt, frequency))}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    ...typeTokens.label,
    fontSize: typeTokens.label.fontSize - 2,
    color: color.textSecondary,
    textAlign: 'center',
    marginBottom: -space.sm,
  },
});

export default NextCheckInCountdown;
