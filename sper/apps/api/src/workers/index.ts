import { Worker } from 'bullmq';
import {
  QUEUE_NAMES,
  baseWorkerOpts,
  promptsQueue,
  graceQueue,
  careGapQueue,
  closeQueues,
} from './queue';
import { wireDelivery } from '../delivery/wire';
import { runPromptScheduler, promptSender } from './prompt-scheduler';
import { runGraceLoop, graceDispatcher } from './grace-loop';
import { runCareGapLoop, careGapDispatcher } from './care-gap-loop';
import { closeDb } from '../config/db';

/**
 * Worker process. Registers repeatable schedulers and the workers that execute
 * them. Run as a separate process from the HTTP server.
 */
async function main(): Promise<void> {
  wireDelivery();

  // Repeatable triggers.
  await promptsQueue.add(
    'tick',
    {},
    { repeat: { pattern: '0 * * * *' }, removeOnComplete: true, removeOnFail: 100 }, // hourly
  );
  await graceQueue.add(
    'tick',
    {},
    { repeat: { pattern: '0 3 * * *' }, removeOnComplete: true, removeOnFail: 100 }, // daily 03:00 UTC
  );
  await careGapQueue.add(
    'tick',
    {},
    { repeat: { pattern: '*/15 * * * *' }, removeOnComplete: true, removeOnFail: 100 }, // every 15 min
  );

  const promptWorker = new Worker(
    QUEUE_NAMES.prompts,
    async () => {
      const sent = await runPromptScheduler(promptSender);
      return { sent };
    },
    baseWorkerOpts,
  );

  const graceWorker = new Worker(
    QUEUE_NAMES.grace,
    async () => {
      const processed = await runGraceLoop(graceDispatcher);
      return { processed };
    },
    baseWorkerOpts,
  );

  const careGapWorker = new Worker(
    QUEUE_NAMES.careGap,
    async () => {
      const nudged = await runCareGapLoop(careGapDispatcher);
      return { nudged };
    },
    baseWorkerOpts,
  );

  promptWorker.on('completed', (job, res) => {
    // eslint-disable-next-line no-console
    console.info(`[prompt-scheduler] ${JSON.stringify(res)}`);
  });
  graceWorker.on('completed', (job, res) => {
    // eslint-disable-next-line no-console
    console.info(`[grace-loop] ${JSON.stringify(res)}`);
  });
  careGapWorker.on('completed', (job, res) => {
    // eslint-disable-next-line no-console
    console.info(`[care-gap-loop] ${JSON.stringify(res)}`);
  });

  const shutdown = async () => {
    await promptWorker.close();
    await graceWorker.close();
    await careGapWorker.close();
    await closeQueues();
    await closeDb();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  // eslint-disable-next-line no-console
  console.info('[workers] prompt-scheduler + grace-loop + care-gap-loop running');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
