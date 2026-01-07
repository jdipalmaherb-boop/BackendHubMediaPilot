import { Queue, JobsOptions } from 'bullmq';
import { getRedisConnection } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { env } from '../env';
import crypto from 'crypto';

const connection = getRedisConnection();

export const GOHIGHLEVEL_QUEUE_NAME = 'gohighlevel';

export const gohighlevelQueue = connection ? new Queue(GOHIGHLEVEL_QUEUE_NAME, { connection }) : null;

export interface GoHighLevelJobPayload {
  leadId: string;
  userId: string;
  leadData: {
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    source?: string;
    tags?: string[];
    customFields?: Record<string, any>;
    locationId?: string;
    campaignId?: string;
  };
  syncType: 'lead_create' | 'lead_update' | 'lead_tag' | 'custom_field_update';
  metadata?: Record<string, any>;
}

export interface GoHighLevelResponse {
  success: boolean;
  externalId?: string;
  status: 'synced' | 'failed' | 'duplicate' | 'rate_limited';
  response?: any;
  error?: string;
  retryAfter?: number; // seconds
}

// Generate idempotency key based on lead data
function generateIdempotencyKey(leadData: GoHighLevelJobPayload['leadData'], syncType: string): string {
  const keyData = {
    email: leadData.email.toLowerCase().trim(),
    phone: leadData.phone?.replace(/\D/g, ''), // Remove non-digits
    syncType,
    locationId: leadData.locationId,
  };
  
  return crypto.createHash('sha256')
    .update(JSON.stringify(keyData))
    .digest('hex')
    .substring(0, 16); // Use first 16 chars for shorter keys
}

// Retry configuration with exponential backoff
export function getGoHighLevelBackoffOptions(): JobsOptions {
  return {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 seconds
    },
    removeOnComplete: 100,
    removeOnFail: 50,
    delay: 0,
  } as JobsOptions;
}

// Enqueue lead sync job
export async function enqueueLeadSync(
  leadId: string,
  userId: string,
  leadData: GoHighLevelJobPayload['leadData'],
  syncType: GoHighLevelJobPayload['syncType'] = 'lead_create',
  metadata?: Record<string, any>
): Promise<string> {
  const payload: GoHighLevelJobPayload = {
    leadId,
    userId,
    leadData,
    syncType,
    metadata,
  };

  const idempotencyKey = generateIdempotencyKey(leadData, syncType);
  
  // Check for existing sync record to avoid duplicates
  const existingSync = await prisma.goHighLevelSync.findFirst({
    where: {
      leadId,
      syncType,
      status: { in: ['synced', 'processing'] },
    },
  });

  if (existingSync) {
    console.log(`Lead ${leadId} already synced or processing for ${syncType}`);
    return existingSync.id;
  }

  // Check if job already exists in queue
  const existingJobs = await gohighlevelQueue.getJobs(['waiting', 'delayed', 'active']);
  const duplicateJob = existingJobs.find(job => 
    job.opts.jobId === idempotencyKey && 
    job.data.leadId === leadId &&
    job.data.syncType === syncType
  );

  if (duplicateJob) {
    console.log(`Job with idempotency key ${idempotencyKey} already exists`);
    return duplicateJob.id!;
  }

  // Create GoHighLevelSync record
  const syncRecord = await prisma.goHighLevelSync.create({
    data: {
      leadId,
      syncType,
      status: 'queued',
      requestData: payload,
      idempotencyKey,
    },
  });

  // Add job to queue
  const jobOptions: JobsOptions = {
    ...getGoHighLevelBackoffOptions(),
    jobId: idempotencyKey,
  };

  const job = await gohighlevelQueue.add('sync-lead', payload, jobOptions);
  
  // Update sync record with job ID
  await prisma.goHighLevelSync.update({
    where: { id: syncRecord.id },
    data: { 
      meta: { 
        jobId: job.id,
        queuedAt: new Date().toISOString(),
      } 
    },
  });

  console.log(`Enqueued GoHighLevel sync job ${job.id} for lead ${leadId}`);
  
  return syncRecord.id;
}

// Enqueue multiple leads in batch
export async function enqueueBatchLeadSync(
  leads: Array<{
    leadId: string;
    userId: string;
    leadData: GoHighLevelJobPayload['leadData'];
    syncType?: GoHighLevelJobPayload['syncType'];
    metadata?: Record<string, any>;
  }>
): Promise<string[]> {
  const syncIds: string[] = [];

  for (const lead of leads) {
    try {
      const syncId = await enqueueLeadSync(
        lead.leadId,
        lead.userId,
        lead.leadData,
        lead.syncType || 'lead_create',
        lead.metadata
      );
      syncIds.push(syncId);
    } catch (error) {
      console.error(`Failed to enqueue lead ${lead.leadId}:`, error);
      // Continue with other leads
    }
  }

  console.log(`Enqueued ${syncIds.length} GoHighLevel sync jobs`);
  return syncIds;
}

// Cancel sync job
export async function cancelLeadSync(syncId: string): Promise<boolean> {
  try {
    const syncRecord = await prisma.goHighLevelSync.findUnique({
      where: { id: syncId },
    });

    if (!syncRecord) {
      console.log(`Sync record ${syncId} not found`);
      return false;
    }

    if (syncRecord.status === 'synced') {
      console.log(`Sync record ${syncId} already completed`);
      return false;
    }

    const jobId = syncRecord.meta?.jobId;
    if (jobId) {
      const job = await gohighlevelQueue.getJob(jobId);
      if (job) {
        await job.remove();
      }
    }

    // Update sync record
    await prisma.goHighLevelSync.update({
      where: { id: syncId },
      data: {
        status: 'cancelled',
        meta: {
          ...syncRecord.meta,
          cancelledAt: new Date().toISOString(),
        },
      },
    });

    console.log(`Cancelled sync job ${syncId}`);
    return true;
  } catch (error) {
    console.error(`Failed to cancel sync job ${syncId}:`, error);
    return false;
  }
}

// Get sync status
export async function getSyncStatus(syncId: string): Promise<any> {
  try {
    const syncRecord = await prisma.goHighLevelSync.findUnique({
      where: { id: syncId },
      include: {
        lead: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!syncRecord) {
      return null;
    }

    // Get job status from queue
    const jobId = syncRecord.meta?.jobId;
    let jobStatus = null;
    if (jobId) {
      try {
        const job = await gohighlevelQueue.getJob(jobId);
        if (job) {
          jobStatus = {
            id: job.id,
            state: await job.getState(),
            progress: job.progress,
            processedOn: job.processedOn,
            finishedOn: job.finishedOn,
            failedReason: job.failedReason,
          };
        }
      } catch (error) {
        console.warn('Failed to get job status:', error);
      }
    }

    return {
      id: syncRecord.id,
      leadId: syncRecord.leadId,
      syncType: syncRecord.syncType,
      status: syncRecord.status,
      externalId: syncRecord.externalId,
      createdAt: syncRecord.createdAt,
      updatedAt: syncRecord.updatedAt,
      jobStatus,
      response: syncRecord.response,
      error: syncRecord.error,
      meta: syncRecord.meta,
      lead: syncRecord.lead,
    };
  } catch (error) {
    console.error(`Failed to get sync status for ${syncId}:`, error);
    return null;
  }
}

// Get user's sync history
export async function getUserSyncHistory(
  userId: string,
  page: number = 1,
  limit: number = 20,
  status?: string
): Promise<any> {
  try {
    const where: any = {
      lead: {
        userId,
      },
    };

    if (status) {
      where.status = status;
    }

    const syncRecords = await prisma.goHighLevelSync.findMany({
      where,
      include: {
        lead: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await prisma.goHighLevelSync.count({ where });

    return {
      syncRecords: syncRecords.map(record => ({
        id: record.id,
        leadId: record.leadId,
        syncType: record.syncType,
        status: record.status,
        externalId: record.externalId,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        lead: record.lead,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error(`Failed to get sync history for user ${userId}:`, error);
    return {
      syncRecords: [],
      pagination: { page, limit, total: 0, pages: 0 },
    };
  }
}

// Retry failed sync
export async function retryFailedSync(syncId: string): Promise<boolean> {
  try {
    const syncRecord = await prisma.goHighLevelSync.findUnique({
      where: { id: syncId },
    });

    if (!syncRecord) {
      console.log(`Sync record ${syncId} not found`);
      return false;
    }

    if (syncRecord.status === 'synced') {
      console.log(`Sync record ${syncId} already synced`);
      return false;
    }

    // Reset status and retry
    await prisma.goHighLevelSync.update({
      where: { id: syncId },
      data: {
        status: 'queued',
        error: null,
        meta: {
          ...syncRecord.meta,
          retryAttemptedAt: new Date().toISOString(),
        },
      },
    });

    // Re-enqueue job
    const payload = syncRecord.requestData as GoHighLevelJobPayload;
    const idempotencyKey = generateIdempotencyKey(payload.leadData, payload.syncType);
    
    const jobOptions: JobsOptions = {
      ...getGoHighLevelBackoffOptions(),
      jobId: `${idempotencyKey}-retry-${Date.now()}`, // Unique retry job ID
    };

    const job = await gohighlevelQueue.add('sync-lead', payload, jobOptions);
    
    // Update sync record with new job ID
    await prisma.goHighLevelSync.update({
      where: { id: syncId },
      data: { 
        meta: { 
          ...syncRecord.meta,
          jobId: job.id,
          retryJobId: job.id,
          retriedAt: new Date().toISOString(),
        } 
      },
    });

    console.log(`Retried sync job ${job.id} for sync record ${syncId}`);
    return true;
  } catch (error) {
    console.error(`Failed to retry sync ${syncId}:`, error);
    return false;
  }
}

// Get queue health
export async function getGoHighLevelQueueHealth(): Promise<any> {
  try {
    const waiting = await gohighlevelQueue.getWaiting();
    const active = await gohighlevelQueue.getActive();
    const completed = await gohighlevelQueue.getCompleted();
    const failed = await gohighlevelQueue.getFailed();
    const delayed = await gohighlevelQueue.getDelayed();

    return {
      queue: GOHIGHLEVEL_QUEUE_NAME,
      counts: {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
      },
      isHealthy: failed.length < 50, // Consider unhealthy if more than 50 failed jobs
      oldestWaiting: waiting.length > 0 ? waiting[0].timestamp : null,
      oldestFailed: failed.length > 0 ? failed[0].timestamp : null,
    };
  } catch (error) {
    console.error('Failed to get GoHighLevel queue health:', error);
    return {
      queue: GOHIGHLEVEL_QUEUE_NAME,
      error: error instanceof Error ? error.message : 'Unknown error',
      isHealthy: false,
    };
  }
}

// Clean up old completed syncs
export async function cleanupOldSyncs(): Promise<void> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 days ago

    const deletedCount = await prisma.goHighLevelSync.deleteMany({
      where: {
        status: { in: ['synced', 'failed', 'cancelled'] },
        updatedAt: { lt: cutoffDate },
      },
    });

    console.log(`Cleaned up ${deletedCount.count} old GoHighLevel sync records`);
  } catch (error) {
    console.error('Failed to cleanup old syncs:', error);
  }
}

// Periodic cleanup
setInterval(cleanupOldSyncs, 24 * 60 * 60 * 1000); // Run daily

export default gohighlevelQueue;
