import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SubmitCheckInRequest } from '@sper/shared-types';
import { api } from '../api/client';

/**
 * A person in transition may have spotty data. Check-ins queue locally and
 * flush when connectivity returns, so an honest signal is never lost.
 */

const QUEUE_KEY = 'sper.offlineCheckIns';

async function read(): Promise<SubmitCheckInRequest[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SubmitCheckInRequest[];
  } catch {
    return [];
  }
}

async function write(items: SubmitCheckInRequest[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export async function enqueueCheckIn(item: SubmitCheckInRequest): Promise<void> {
  const items = await read();
  items.push(item);
  await write(items);
}

/** Attempt to submit everything queued. Returns count successfully flushed. */
export async function flushQueue(): Promise<number> {
  const items = await read();
  if (items.length === 0) return 0;

  const remaining: SubmitCheckInRequest[] = [];
  let flushed = 0;
  for (const item of items) {
    try {
      await api.submitCheckIn(item);
      flushed++;
    } catch {
      remaining.push(item); // keep for the next attempt
    }
  }
  await write(remaining);
  return flushed;
}

export async function queueLength(): Promise<number> {
  return (await read()).length;
}
