import { Worker, Job } from 'bullmq';
import { prisma } from '../lib/prisma';
import { schedulerQueue, ScheduledJobPayload, ScheduledJobResult } from '../queues/schedulerQueue';
import { MockAdapter } from '../ad/mockAdapter';
import { MetaAdapter } from '../ad/metaAdapter';
import { TikTokAdapter } from '../ad/tiktokAdapter';
import { YouTubeAdapter } from '../ad/youtubeAdapter';
import { AdPlatform, AdPlatformConfig } from '../ad/adapter';
import { metrics } from '../lib/metrics';
import { log } from '../lib/logger';
import crypto from 'crypto';

// Decryption utility for platform credentials
const ENCRYPTION_KEY = process.env.CREDENTIALS_ENCRYPTION_KEY || 'default-key-change-in-production';
const ALGORITHM = 'aes-256-gcm';

function decryptCredentials(encryptedData: { encrypted: string; iv: string; tag: string }): any {
  try {
    const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
    decipher.setAAD(Buffer.from('platform-credentials'));
    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Failed to decrypt credentials:', error);
    throw new Error('Invalid encrypted credentials');
  }
}

// Platform adapter factory
function createPlatformAdapter(platform: string, credentials: any): AdPlatform {
  const config: AdPlatformConfig = {
    platform,
    enabled: true,
    sandboxMode: platform === 'mock' || process.env.NODE_ENV === 'development',
    credentials,
    settings: {
      defaultBudgetCents: 1000,
      maxBudgetCents: 1000000,
    },
  };

  switch (platform) {
    case 'mock':
      return new MockAdapter(config);
    case 'meta':
      return new MetaAdapter(config);
    case 'tiktok':
      return new TikTokAdapter(config);
    case 'youtube':
      return new YouTubeAdapter(config);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

// Check for duplicate external IDs to handle idempotency
async function checkDuplicateExternalId(platform: string, externalId: string): Promise<boolean> {
  const existingRecord = await prisma.publishRecord.findFirst({
    where: {
      platform,
      externalId,
    },
  });

  return !!existingRecord;
}

// Process individual platform publish
async function processPlatformPublish(
  platform: string,
  credentials: any,
  creativeKey: string,
  caption: string,
  targeting: any,
  options: any,
  scheduledPostId: string
): Promise<{ externalId?: string; status: 'PUBLISHED' | 'FAILED'; error?: string; meta?: any }> {
  const startTime = Date.now();
  
  try {
    const adapter = createPlatformAdapter(platform, credentials);
    
    // For now, we'll use a simplified publish approach
    // In a real implementation, this would call platform-specific publish methods
    const campaignSpec = {
      title: caption.substring(0, 50), // Use caption as title
      creativeKey,
      budgetCents: 1000, // Minimal budget for social posts
      targeting: targeting || {},
      metadata: {
        caption,
        ...options,
        scheduledPostId,
      },
    };

    // Create campaign (this simulates publishing a post)
    const result = await adapter.createCampaign(campaignSpec);
    const duration = (Date.now() - startTime) / 1000;
    
    // Record ad platform metrics
    metrics.recordAdCall(platform, 'create_campaign', 'success');
    metrics.recordAdCallDuration(platform, duration, 'create_campaign');
    
    // Check for duplicate external ID
    if (result.id && await checkDuplicateExternalId(platform, result.id)) {
      log.info(`Duplicate external ID detected for ${platform}: ${result.id}`, {
        platform,
        externalId: result.id,
        scheduledPostId,
      });
      
      return {
        externalId: result.id,
        status: 'PUBLISHED',
        meta: { duplicate: true, message: 'Post already published' },
      };
    }

    return {
      externalId: result.id,
      status: 'PUBLISHED',
      meta: {
        publishedAt: new Date().toISOString(),
        platform,
        campaignId: result.id,
      },
    };
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    
    // Record ad platform failure metrics
    metrics.recordAdCallFailed(platform, 'create_campaign', error.constructor.name);
    metrics.recordAdCallDuration(platform, duration, 'create_campaign');
    
    log.error(`Failed to publish to ${platform}:`, error as Error, {
      platform,
      scheduledPostId,
      duration,
      errorType: error.constructor.name,
    });
    
    return {
      status: 'FAILED',
      error: error instanceof Error ? error.message : 'Unknown error',
      meta: {
        failedAt: new Date().toISOString(),
        platform,
        errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
      },
    };
  }
}

// Main job processor
export async function processScheduledJob(job: Job<ScheduledJobPayload>): Promise<ScheduledJobResult> {
  const { scheduledPostId, userId, creativeKey, caption, platforms, publishAt, timezone, metadata } = job.data;
  const startTime = Date.now();
  
  log.info(`Processing scheduled job ${job.id} for post ${scheduledPostId}`, {
    reqId: `job-${job.id}`,
    jobId: job.id,
    scheduledPostId,
    userId,
    platforms: platforms.map(p => p.platform),
  });
  
  try {
    // Update scheduled post status to processing
    await prisma.scheduledPost.update({
      where: { id: scheduledPostId },
      data: { 
        status: 'PROCESSING',
        meta: {
          ...metadata,
          processingStartedAt: new Date().toISOString(),
          jobId: job.id,
        },
      },
    });

    const publishRecords = [];
    let successCount = 0;
    let failureCount = 0;

    // Process each platform
    for (const platformConfig of platforms) {
      try {
        // Decrypt credentials
        const credentials = decryptCredentials(platformConfig.credentials);
        
        // Process platform publish
        const result = await processPlatformPublish(
          platformConfig.platform,
          credentials,
          creativeKey,
          caption,
          platformConfig.targeting,
          platformConfig.options,
          scheduledPostId
        );

        // Create publish record
        const publishRecord = await prisma.publishRecord.create({
          data: {
            scheduledPostId,
            platform: platformConfig.platform,
            externalId: result.externalId,
            status: result.status,
            meta: {
              ...result.meta,
              targeting: platformConfig.targeting,
              options: platformConfig.options,
              processedAt: new Date().toISOString(),
            },
          },
        });

        publishRecords.push({
          platform: platformConfig.platform,
          externalId: result.externalId,
          status: result.status,
          error: result.error,
          meta: result.meta,
        });

        if (result.status === 'PUBLISHED') {
          successCount++;
        } else {
          failureCount++;
        }

        console.log(`Published to ${platformConfig.platform}: ${result.status}`);
      } catch (error) {
        console.error(`Failed to process platform ${platformConfig.platform}:`, error);
        
        // Create failed publish record
        await prisma.publishRecord.create({
          data: {
            scheduledPostId,
            platform: platformConfig.platform,
            status: 'FAILED',
            meta: {
              error: error instanceof Error ? error.message : 'Unknown error',
              failedAt: new Date().toISOString(),
              platform: platformConfig.platform,
            },
          },
        });

        publishRecords.push({
          platform: platformConfig.platform,
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        failureCount++;
      }
    }

    // Determine overall status
    let overallStatus: 'PUBLISHED' | 'PARTIAL' | 'FAILED';
    if (successCount === platforms.length) {
      overallStatus = 'PUBLISHED';
    } else if (successCount > 0) {
      overallStatus = 'PARTIAL';
    } else {
      overallStatus = 'FAILED';
    }

    // Update scheduled post with final status
    await prisma.scheduledPost.update({
      where: { id: scheduledPostId },
      data: { 
        status: overallStatus,
        meta: {
          ...metadata,
          processingCompletedAt: new Date().toISOString(),
          jobId: job.id,
          successCount,
          failureCount,
          totalPlatforms: platforms.length,
        },
      },
    });

    const duration = (Date.now() - startTime) / 1000;
    
    // Record job metrics
    metrics.recordJobProcessed('scheduler', overallStatus, 'publisher-worker');
    metrics.recordJobDuration('scheduler', duration, 'publisher-worker');
    
    log.info(`Completed scheduled job ${job.id}: ${overallStatus} (${successCount}/${platforms.length} platforms)`, {
      reqId: `job-${job.id}`,
      jobId: job.id,
      duration,
      overallStatus,
      successCount,
      totalPlatforms: platforms.length,
    });

    return {
      success: overallStatus !== 'FAILED',
      publishRecords,
      overallStatus,
    };
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    
    // Record job failure metrics
    metrics.recordJobFailed('scheduler', error.constructor.name, 'publisher-worker');
    metrics.recordJobDuration('scheduler', duration, 'publisher-worker');
    
    log.error(`Failed to process scheduled job ${job.id}:`, error as Error, {
      reqId: `job-${job.id}`,
      jobId: job.id,
      duration,
      errorType: error.constructor.name,
    });
    
    // Update scheduled post with error status
    await prisma.scheduledPost.update({
      where: { id: scheduledPostId },
      data: { 
        status: 'FAILED',
        meta: {
          ...metadata,
          processingFailedAt: new Date().toISOString(),
          jobId: job.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      },
    });

    throw error; // Re-throw to trigger retry mechanism
  }
}

// Create and configure worker
export function createPublisherWorker() {
  const worker = new Worker(
    'scheduler',
    async (job: Job<ScheduledJobPayload>) => {
      return await processScheduledJob(job);
    },
    {
      connection: schedulerQueue.opts.connection,
      concurrency: env.SCHEDULER_WORKER_CONCURRENCY || 2,
      removeOnComplete: 100,
      removeOnFail: 50,
    }
  );

  // Worker event listeners
  worker.on('completed', (job, result) => {
    console.log(`Publisher worker completed job ${job?.id}:`, result.overallStatus);
  });

  worker.on('failed', (job, err) => {
    console.error(`Publisher worker failed job ${job?.id}:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('Publisher worker error:', err.message);
  });

  worker.on('stalled', (jobId) => {
    console.warn(`Publisher worker stalled job ${jobId}`);
  });

  console.log(`Publisher worker started with concurrency: ${env.SCHEDULER_WORKER_CONCURRENCY || 2}`);
  
  return worker;
}

// Start the worker (for worker-runner.ts)
export function startPublisherWorker() {
  return createPublisherWorker();
}

// Graceful shutdown
export async function stopPublisherWorker(worker: Worker): Promise<void> {
  console.log('Stopping publisher worker...');
  await worker.close();
  console.log('Publisher worker stopped');
}

// Health check for worker
export function getWorkerHealth(worker: Worker): any {
  return {
    isRunning: worker.isRunning(),
    concurrency: worker.opts.concurrency,
    name: worker.name,
    timestamp: new Date().toISOString(),
  };
}

// Manual job processing (for testing)
export async function processJobManually(jobId: string): Promise<ScheduledJobResult> {
  const job = await schedulerQueue.getJob(jobId);
  
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  return await processScheduledJob(job);
}

// Retry specific platforms for a job
export async function retryPlatformPublish(
  scheduledPostId: string,
  platform: string,
  credentials: any,
  creativeKey: string,
  caption: string,
  targeting: any,
  options: any
): Promise<{ externalId?: string; status: 'PUBLISHED' | 'FAILED'; error?: string; meta?: any }> {
  try {
    const result = await processPlatformPublish(
      platform,
      credentials,
      creativeKey,
      caption,
      targeting,
      options,
      scheduledPostId
    );

    // Update or create publish record
    await prisma.publishRecord.upsert({
      where: {
        scheduledPostId_platform: {
          scheduledPostId,
          platform,
        },
      },
      update: {
        externalId: result.externalId,
        status: result.status,
        meta: result.meta,
      },
      create: {
        scheduledPostId,
        platform,
        externalId: result.externalId,
        status: result.status,
        meta: result.meta,
      },
    });

    return result;
  } catch (error) {
    console.error(`Failed to retry platform ${platform}:`, error);
    
    // Update publish record with error
    await prisma.publishRecord.upsert({
      where: {
        scheduledPostId_platform: {
          scheduledPostId,
          platform,
        },
      },
      update: {
        status: 'FAILED',
        meta: {
          error: error instanceof Error ? error.message : 'Unknown error',
          retryFailedAt: new Date().toISOString(),
        },
      },
      create: {
        scheduledPostId,
        platform,
        status: 'FAILED',
        meta: {
          error: error instanceof Error ? error.message : 'Unknown error',
          retryFailedAt: new Date().toISOString(),
        },
      },
    });

    return {
      status: 'FAILED',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export default {
  createPublisherWorker,
  startPublisherWorker,
  stopPublisherWorker,
  getWorkerHealth,
  processJobManually,
  retryPlatformPublish,
};
