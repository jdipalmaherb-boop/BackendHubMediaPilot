import { Queue } from 'bullmq';

export const AD_OPTIMIZATION_QUEUE = 'ad-optimization';
export const VIDEO_AD_OPTIMIZATION_QUEUE = 'video-ad-optimization';

export function createAdOptimizationQueue(redisUrl?: string) {
  const connectionUrl = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';

  return new Queue(AD_OPTIMIZATION_QUEUE, {
    connection: { url: connectionUrl },
    defaultJobOptions: {
      removeOnComplete: true,
      attempts: 1,
    },
  });
}

export function createVideoAdOptimizationQueue(redisUrl?: string) {
  const connectionUrl = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';

  return new Queue(VIDEO_AD_OPTIMIZATION_QUEUE, {
    connection: { url: connectionUrl },
    defaultJobOptions: {
      removeOnComplete: true,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    },
  });
}
