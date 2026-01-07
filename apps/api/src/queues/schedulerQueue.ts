import { Queue, Worker, QueueEvents, JobsOptions } from 'bullmq';
import { getRedisConnection } from '../lib/redis';
import { env } from '../env';

const connection = getRedisConnection();

export const SCHEDULER_QUEUE_NAME = 'scheduler';

export const schedulerQueue = connection ? new Queue(SCHEDULER_QUEUE_NAME, { connection }) : null;
export const schedulerQueueEvents = connection ? new QueueEvents(SCHEDULER_QUEUE_NAME, { connection }) : null;
// export const schedulerQueueScheduler = new QueueScheduler(SCHEDULER_QUEUE_NAME, { connection });

export interface ScheduledJobPayload {
  scheduledPostId: string;
  userId: string;
  creativeKey: string;
  caption: string;
  platforms: Array<{
    platform: string;
    credentials: {
      encrypted: string;
      iv: string;
      tag: string;
    };
    targeting?: {
      audience?: string;
      hashtags?: string[];
      mentions?: string[];
      location?: string;
    };
    options?: {
      scheduleTime?: string;
      isStory?: boolean;
      isReel?: boolean;
      isCarousel?: boolean;
    };
  }>;
  publishAt: Date;
  timezone: string;
  metadata?: any;
}

export interface ScheduledJobResult {
  success: boolean;
  publishRecords: Array<{
    platform: string;
    externalId?: string;
    status: 'PUBLISHED' | 'FAILED';
    error?: string;
    meta?: any;
  }>;
  overallStatus: 'PUBLISHED' | 'PARTIAL' | 'FAILED';
}

// Idempotency key generation
function generateIdempotencyKey(payload: ScheduledJobPayload): string {
  const keyData = {
    scheduledPostId: payload.scheduledPostId,
    creativeKey: payload.creativeKey,
    caption: payload.caption,
    platforms: payload.platforms.map(p => p.platform).sort(),
    publishAt: payload.publishAt.toISOString(),
  };
  
  return `scheduler:${Buffer.from(JSON.stringify(keyData)).toString('base64')}`;
}

// Retry configuration with exponential backoff
export function getSchedulerBackoffOptions(): JobsOptions {
  return {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 seconds
    },
    removeOnComplete: 100,
    removeOnFail: 50,
    delay: 0, // No initial delay for immediate jobs
  } as JobsOptions;
}

// Add scheduled job to queue
export async function addScheduledJob(payload: ScheduledJobPayload): Promise<string> {
  const idempotencyKey = generateIdempotencyKey(payload);
  
  // Check if job already exists with same idempotency key
  const existingJobs = await schedulerQueue.getJobs(['waiting', 'delayed', 'active']);
  const duplicateJob = existingJobs.find(job => 
    job.opts.jobId === idempotencyKey && 
    job.data.scheduledPostId === payload.scheduledPostId
  );

  if (duplicateJob) {
    console.log(`Job with idempotency key ${idempotencyKey} already exists`);
    return duplicateJob.id!;
  }

  // Calculate delay for scheduled posts
  const now = new Date();
  const publishAt = new Date(payload.publishAt);
  const delay = Math.max(0, publishAt.getTime() - now.getTime());

  const jobOptions: JobsOptions = {
    ...getSchedulerBackoffOptions(),
    jobId: idempotencyKey,
    delay,
  };

  const job = await schedulerQueue.add('publish-post', payload, jobOptions);
  
  console.log(`Scheduled job ${job.id} for ${publishAt.toISOString()} (delay: ${delay}ms)`);
  
  return job.id!;
}

// Cancel scheduled job
export async function cancelScheduledJob(jobId: string): Promise<boolean> {
  try {
    const job = await schedulerQueue.getJob(jobId);
    
    if (!job) {
      console.log(`Job ${jobId} not found`);
      return false;
    }

    const removed = await job.remove();
    console.log(`Job ${jobId} ${removed ? 'canceled' : 'not found'}`);
    
    return removed;
  } catch (error) {
    console.error(`Failed to cancel job ${jobId}:`, error);
    return false;
  }
}

// Get scheduled job status
export async function getScheduledJob(jobId: string): Promise<any> {
  try {
    const job = await schedulerQueue.getJob(jobId);
    
    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress;
    const returnValue = job.returnvalue;
    const failedReason = job.failedReason;

    return {
      id: job.id,
      state,
      progress,
      returnValue,
      failedReason,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      data: {
        scheduledPostId: job.data.scheduledPostId,
        publishAt: job.data.publishAt,
        platforms: job.data.platforms.map((p: any) => p.platform),
      },
    };
  } catch (error) {
    console.error(`Failed to get job ${jobId}:`, error);
    return null;
  }
}

// Get all scheduled jobs for a user
export async function getUserScheduledJobs(userId: string): Promise<any[]> {
  try {
    const jobs = await schedulerQueue.getJobs(['waiting', 'delayed', 'active']);
    
    return jobs
      .filter(job => job.data.userId === userId)
      .map(job => ({
        id: job.id,
        scheduledPostId: job.data.scheduledPostId,
        publishAt: job.data.publishAt,
        platforms: job.data.platforms.map((p: any) => p.platform),
        state: job.getState(),
        progress: job.progress,
      }));
  } catch (error) {
    console.error(`Failed to get user scheduled jobs:`, error);
    return [];
  }
}

// Clean up old completed jobs
export async function cleanupOldJobs(): Promise<void> {
  try {
    const completedJobs = await schedulerQueue.getJobs(['completed']);
    const failedJobs = await schedulerQueue.getJobs(['failed']);
    
    const oldJobs = [...completedJobs, ...failedJobs].filter(job => {
      const finishedOn = job.finishedOn;
      if (!finishedOn) return false;
      
      const age = Date.now() - finishedOn;
      return age > 7 * 24 * 60 * 60 * 1000; // 7 days
    });

    for (const job of oldJobs) {
      await job.remove();
    }

    console.log(`Cleaned up ${oldJobs.length} old jobs`);
  } catch (error) {
    console.error('Failed to cleanup old jobs:', error);
  }
}

// Queue monitoring and health check
export async function getQueueHealth(): Promise<any> {
  try {
    const waiting = await schedulerQueue.getWaiting();
    const active = await schedulerQueue.getActive();
    const completed = await schedulerQueue.getCompleted();
    const failed = await schedulerQueue.getFailed();
    const delayed = await schedulerQueue.getDelayed();

    return {
      queue: SCHEDULER_QUEUE_NAME,
      counts: {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
      },
      isHealthy: failed.length < 100, // Consider unhealthy if more than 100 failed jobs
      oldestWaiting: waiting.length > 0 ? waiting[0].timestamp : null,
      oldestFailed: failed.length > 0 ? failed[0].timestamp : null,
    };
  } catch (error) {
    console.error('Failed to get queue health:', error);
    return {
      queue: SCHEDULER_QUEUE_NAME,
      error: error instanceof Error ? error.message : 'Unknown error',
      isHealthy: false,
    };
  }
}

// Retry failed jobs
export async function retryFailedJobs(jobIds?: string[]): Promise<number> {
  try {
    const failedJobs = await schedulerQueue.getJobs(['failed']);
    
    const jobsToRetry = jobIds 
      ? failedJobs.filter(job => jobIds.includes(job.id!))
      : failedJobs.filter(job => {
          // Only retry jobs that failed recently (last 24 hours)
          const failedOn = job.finishedOn;
          if (!failedOn) return false;
          
          const age = Date.now() - failedOn;
          return age < 24 * 60 * 60 * 1000; // 24 hours
        });

    let retriedCount = 0;
    for (const job of jobsToRetry) {
      try {
        await job.retry();
        retriedCount++;
      } catch (error) {
        console.error(`Failed to retry job ${job.id}:`, error);
      }
    }

    console.log(`Retried ${retriedCount} failed jobs`);
    return retriedCount;
  } catch (error) {
    console.error('Failed to retry failed jobs:', error);
    return 0;
  }
}

// Pause/Resume queue
export async function pauseQueue(): Promise<void> {
  await schedulerQueue.pause();
  console.log('Scheduler queue paused');
}

export async function resumeQueue(): Promise<void> {
  await schedulerQueue.resume();
  console.log('Scheduler queue resumed');
}

// Get queue statistics
export async function getQueueStats(): Promise<any> {
  try {
    const counts = await schedulerQueue.getJobCounts();
    const isPaused = await schedulerQueue.isPaused();
    
    return {
      counts,
      isPaused,
      queueName: SCHEDULER_QUEUE_NAME,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to get queue stats:', error);
    return {
      error: error instanceof Error ? error.message : 'Unknown error',
      queueName: SCHEDULER_QUEUE_NAME,
      timestamp: new Date().toISOString(),
    };
  }
}

// Event listeners for monitoring
schedulerQueueEvents.on('completed', (job) => {
  console.log(`Scheduler job ${job.jobId} completed successfully`);
});

schedulerQueueEvents.on('failed', (job, err) => {
  console.error(`Scheduler job ${job?.jobId} failed:`, err.message);
});

schedulerQueueEvents.on('stalled', (job) => {
  console.warn(`Scheduler job ${job?.jobId} stalled`);
});

schedulerQueueEvents.on('progress', (job, progress) => {
  console.log(`Scheduler job ${job?.jobId} progress: ${progress}%`);
});

// Periodic cleanup
setInterval(cleanupOldJobs, 24 * 60 * 60 * 1000); // Run daily

export default schedulerQueue;
