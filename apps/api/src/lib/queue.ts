import { Queue, Worker, QueueEvents, JobsOptions } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');

export const PUBLISH_QUEUE = 'publish';

export const publishQueue = new Queue(PUBLISH_QUEUE, { connection });
export const publishQueueEvents = new QueueEvents(PUBLISH_QUEUE, { connection });

export type PublishJobPayload = {
  postId: string;
};

export function getBackoffOptions(): JobsOptions {
  return {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 1000,
    removeOnFail: 1000,
  } as JobsOptions;
}

export function createWorker(processor: Parameters<typeof Worker>[1]) {
  return new Worker(PUBLISH_QUEUE, processor, { connection });
}





