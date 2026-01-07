import { Queue } from 'bullmq';

const QUEUE_NAME = 'video-processing';

export function createVideoQueue(redisUrl?: string) {
  const connectionUrl = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';

  return new Queue(QUEUE_NAME, {
    connection: { url: connectionUrl },
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 1,
    },
  });
}

export const VIDEO_QUEUE_NAME = QUEUE_NAME;
