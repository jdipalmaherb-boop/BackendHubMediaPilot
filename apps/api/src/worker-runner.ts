import dotenv from 'dotenv';
dotenv.config();

import { createVideoWorker } from './queues/videoQueue';
import videoWorkerHandler from './workers/videoWorker';

// Start video worker as a separate process
const worker = createVideoWorker(videoWorkerHandler);

worker.on('completed', (job) => {
  // eslint-disable-next-line no-console
  console.log(`[worker] completed job ${job.id}`);
});

worker.on('failed', (job, err) => {
  // eslint-disable-next-line no-console
  console.error(`[worker] failed job ${job?.id}`, err);
});

worker.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('[worker] error', err);
});

process.on('SIGINT', async () => {
  await worker.close();
  process.exit(0);
});


