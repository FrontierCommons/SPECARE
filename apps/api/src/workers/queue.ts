import { Queue, type QueueOptions, type WorkerOptions } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env';

/**
 * Shared Redis connection for BullMQ. maxRetriesPerRequest must be null for
 * BullMQ blocking commands.
 */
export const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const QUEUE_NAMES = {
  prompts: 'sper-prompts',
  grace: 'sper-grace',
  careGap: 'sper-care-gap',
} as const;

const baseQueueOpts: QueueOptions = { connection };
export const baseWorkerOpts: WorkerOptions = { connection };

export const promptsQueue = new Queue(QUEUE_NAMES.prompts, baseQueueOpts);
export const graceQueue = new Queue(QUEUE_NAMES.grace, baseQueueOpts);
export const careGapQueue = new Queue(QUEUE_NAMES.careGap, baseQueueOpts);

export async function closeQueues(): Promise<void> {
  await promptsQueue.close();
  await graceQueue.close();
  await careGapQueue.close();
  await connection.quit();
}
