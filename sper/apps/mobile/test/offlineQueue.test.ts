import { describe, it, expect, beforeEach, vi } from 'vitest';
import './setup';
import { stores } from './setup';
import type { SubmitCheckInRequest } from '@sper/shared-types';

// Mock the api client the queue depends on before importing the queue.
const { submitCheckIn } = vi.hoisted(() => ({ submitCheckIn: vi.fn() }));
vi.mock('../src/api/client', () => ({ api: { submitCheckIn } }));

import { enqueueCheckIn, flushQueue, queueLength } from '../src/lib/offlineQueue';

const sample = (note: string): SubmitCheckInRequest => ({
  circle_id: 'c1',
  spiritual_state: 'Steady',
  physical_state: 'Steady',
  emotional_state: 'Steady',
  vocational_state: 'Steady',
  relational_state: 'Steady',
  optional_note: note,
});

beforeEach(() => {
  vi.clearAllMocks();
  stores.asyncMem.clear();
});

describe('offlineQueue', () => {
  it('enqueues items and reports length', async () => {
    await enqueueCheckIn(sample('a'));
    await enqueueCheckIn(sample('b'));
    expect(await queueLength()).toBe(2);
  });

  it('flushes all items when submissions succeed and empties the queue', async () => {
    submitCheckIn.mockResolvedValue({});
    await enqueueCheckIn(sample('a'));
    await enqueueCheckIn(sample('b'));
    const flushed = await flushQueue();
    expect(flushed).toBe(2);
    expect(await queueLength()).toBe(0);
  });

  it('retains items that fail to submit and reports only the flushed count', async () => {
    // First succeeds, second throws (still offline for that one).
    submitCheckIn
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('network'));
    await enqueueCheckIn(sample('ok'));
    await enqueueCheckIn(sample('fail'));

    const flushed = await flushQueue();
    expect(flushed).toBe(1);
    expect(await queueLength()).toBe(1); // the failed one is kept for retry
  });

  it('flushing an empty queue is a no-op', async () => {
    expect(await flushQueue()).toBe(0);
    expect(submitCheckIn).not.toHaveBeenCalled();
  });

  it('a retry after connectivity returns flushes the remaining item', async () => {
    submitCheckIn.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('network'));
    await enqueueCheckIn(sample('ok'));
    await enqueueCheckIn(sample('later'));
    await flushQueue(); // leaves 1

    submitCheckIn.mockResolvedValue({}); // back online
    const flushed = await flushQueue();
    expect(flushed).toBe(1);
    expect(await queueLength()).toBe(0);
  });
});
