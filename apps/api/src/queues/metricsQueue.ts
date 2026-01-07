import { Queue } from 'bullmq';
import { env } from '../env.js';

export const AD_METRICS_QUEUE = 'ad-metrics-aggregation';

export function createMetricsQueue() {
  return new Queue(AD_METRICS_QUEUE, {
    connection: {
      url: env.REDIS_URL || 'redis://localhost:6379',
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    },
    defaultJobOptions: {
      removeOnComplete: true,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    },
  });
}
