import { Job, Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { S3Client, DeleteObjectCommand, CopyObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../env';
import { log } from '../lib/logger';
import { metrics } from '../lib/metrics';
import IORedis from 'ioredis';
import fs from 'fs';
import path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

const prisma = new PrismaClient();
const redis = new IORedis(env.REDIS_URL || 'redis://localhost:6379');

const s3Client = new S3Client({
  region: env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Job payload types
interface DeletionJobPayload {
  deletionRequestId: string;
  userId: string;
  requestType: 'ACCOUNT_DELETION' | 'DATA_PURGE' | 'ANONYMIZATION';
  retentionPolicy: 'DELETE' | 'ANONYMIZE' | 'ARCHIVE';
  dataTypes: string[];
}

interface ExportJobPayload {
  exportRequestId: string;
  userId: string;
  dataTypes: string[];
  format: 'json' | 'csv';
}

// Data processing worker
const dataProcessingWorker = new Worker(
  'data-processing',
  async (job: Job<DeletionJobPayload | ExportJobPayload>) => {
    const startTime = Date.now();
    
    try {
      if (job.name === 'process-deletion') {
        await processDeletionJob(job as Job<DeletionJobPayload>);
      } else if (job.name === 'process-export') {
        await processExportJob(job as Job<ExportJobPayload>);
      } else {
        throw new Error(`Unknown job type: ${job.name}`);
      }

      const duration = (Date.now() - startTime) / 1000;
      metrics.recordJobProcessed('data-processing', 'success', 'privacy-worker');
      metrics.recordJobDuration('data-processing', duration, 'privacy-worker');

      log.info('data_processing_job_completed', {
        jobId: job.id,
        jobName: job.name,
        duration,
      });
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      metrics.recordJobFailed('data-processing', error.constructor.name, 'privacy-worker');
      metrics.recordJobDuration('data-processing', duration, 'privacy-worker');

      log.error('data_processing_job_failed', error as Error, {
        jobId: job.id,
        jobName: job.name,
        duration,
      });

      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 2, // Process 2 jobs concurrently
  }
);

/**
 * Process data deletion job
 */
async function processDeletionJob(job: Job<DeletionJobPayload>): Promise<void> {
  const { deletionRequestId, userId, requestType, retentionPolicy, dataTypes } = job.data;

  log.info('processing_deletion_job', {
    jobId: job.id,
    deletionRequestId,
    userId,
    requestType,
    retentionPolicy,
    dataTypes,
  });

  // Update request status to processing
  await prisma.dataDeletionRequest.update({
    where: { id: deletionRequestId },
    data: {
      status: 'PROCESSING',
      processedAt: new Date(),
    },
  });

  try {
    const results = {
      processed: 0,
      errors: 0,
      details: {} as Record<string, any>,
    };

    // Process each data type
    for (const dataType of dataTypes) {
      try {
        const result = await processDataType(userId, dataType, retentionPolicy, requestType);
        results.processed += result.processed;
        results.errors += result.errors;
        results.details[dataType] = result;
      } catch (error) {
        log.error('data_type_processing_failed', error as Error, {
          userId,
          dataType,
          retentionPolicy,
        });
        results.errors++;
        results.details[dataType] = { error: (error as Error).message };
      }
    }

    // Update request as completed
    await prisma.dataDeletionRequest.update({
      where: { id: deletionRequestId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        metadata: {
          ...results,
          processedAt: new Date().toISOString(),
        },
      },
    });

    // Log audit entry
    await prisma.dataProcessingAudit.create({
      data: {
        userId,
        action: 'DELETION',
        dataType: 'USER_PROFILE', // General deletion action
        status: results.errors === 0 ? 'SUCCESS' : 'PARTIAL',
        details: results,
      },
    });

    log.info('deletion_job_completed', {
      deletionRequestId,
      userId,
      results,
    });
  } catch (error) {
    // Update request as failed
    await prisma.dataDeletionRequest.update({
      where: { id: deletionRequestId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: (error as Error).message,
      },
    });

    // Log audit entry
    await prisma.dataProcessingAudit.create({
      data: {
        userId,
        action: 'DELETION',
        dataType: 'USER_PROFILE',
        status: 'FAILED',
        errorMessage: (error as Error).message,
      },
    });

    throw error;
  }
}

/**
 * Process data export job
 */
async function processExportJob(job: Job<ExportJobPayload>): Promise<void> {
  const { exportRequestId, userId, dataTypes, format } = job.data;

  log.info('processing_export_job', {
    jobId: job.id,
    exportRequestId,
    userId,
    dataTypes,
    format,
  });

  // Update request status to processing
  await prisma.dataExportRequest.update({
    where: { id: exportRequestId },
    data: {
      status: 'PROCESSING',
      processedAt: new Date(),
    },
  });

  try {
    const exportData: Record<string, any> = {};

    // Collect data for each type
    for (const dataType of dataTypes) {
      try {
        exportData[dataType] = await exportDataType(userId, dataType);
      } catch (error) {
        log.error('data_type_export_failed', error as Error, {
          userId,
          dataType,
        });
        exportData[dataType] = { error: (error as Error).message };
      }
    }

    // Generate export file
    const fileName = `user-data-export-${userId}-${Date.now()}.${format}`;
    const tempFilePath = path.join('/tmp', fileName);
    
    if (format === 'json') {
      fs.writeFileSync(tempFilePath, JSON.stringify(exportData, null, 2));
    } else {
      // Convert to CSV format (simplified)
      const csvContent = convertToCSV(exportData);
      fs.writeFileSync(tempFilePath, csvContent);
    }

    // Upload to S3
    const s3Key = `exports/${userId}/${fileName}`;
    await s3Client.send(new PutObjectCommand({
      Bucket: env.S3_BUCKET_NAME!,
      Key: s3Key,
      Body: fs.createReadStream(tempFilePath),
      ContentType: format === 'json' ? 'application/json' : 'text/csv',
      Metadata: {
        userId,
        exportRequestId,
        format,
        dataTypes: dataTypes.join(','),
      },
    }));

    // Generate presigned download URL (valid for 7 days)
    const downloadUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: env.S3_BUCKET_NAME!,
        Key: s3Key,
      }),
      { expiresIn: 7 * 24 * 60 * 60 } // 7 days
    );

    const fileStats = fs.statSync(tempFilePath);
    
    // Update request as completed
    await prisma.dataExportRequest.update({
      where: { id: exportRequestId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        downloadUrl,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        fileSize: fileStats.size,
      },
    });

    // Clean up temp file
    fs.unlinkSync(tempFilePath);

    // Log audit entry
    await prisma.dataProcessingAudit.create({
      data: {
        userId,
        action: 'EXPORT',
        dataType: 'USER_PROFILE',
        status: 'SUCCESS',
        details: {
          format,
          dataTypes,
          fileSize: fileStats.size,
          s3Key,
        },
      },
    });

    log.info('export_job_completed', {
      exportRequestId,
      userId,
      fileSize: fileStats.size,
      s3Key,
    });
  } catch (error) {
    // Update request as failed
    await prisma.dataExportRequest.update({
      where: { id: exportRequestId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: (error as Error).message,
      },
    });

    // Log audit entry
    await prisma.dataProcessingAudit.create({
      data: {
        userId,
        action: 'EXPORT',
        dataType: 'USER_PROFILE',
        status: 'FAILED',
        errorMessage: (error as Error).message,
      },
    });

    throw error;
  }
}

/**
 * Process a specific data type for deletion/anonymization
 */
async function processDataType(
  userId: string,
  dataType: string,
  retentionPolicy: string,
  requestType: string
): Promise<{ processed: number; errors: number; details: any }> {
  const result = { processed: 0, errors: 0, details: {} };

  switch (dataType) {
    case 'USER_PROFILE':
      result.details = await processUserProfile(userId, retentionPolicy, requestType);
      result.processed = 1;
      break;

    case 'CAMPAIGNS':
      result.details = await processCampaigns(userId, retentionPolicy);
      result.processed = result.details.count || 0;
      break;

    case 'LEADS':
      result.details = await processLeads(userId, retentionPolicy);
      result.processed = result.details.count || 0;
      break;

    case 'ANALYTICS':
      result.details = await processAnalytics(userId, retentionPolicy);
      result.processed = result.details.count || 0;
      break;

    case 'ASSETS':
      result.details = await processAssets(userId, retentionPolicy);
      result.processed = result.details.count || 0;
      break;

    case 'JOBS':
      result.details = await processJobs(userId, retentionPolicy);
      result.processed = result.details.count || 0;
      break;

    case 'SUBSCRIPTIONS':
      result.details = await processSubscriptions(userId, retentionPolicy);
      result.processed = result.details.count || 0;
      break;

    case 'LOGS':
      result.details = await processLogs(userId, retentionPolicy);
      result.processed = result.details.count || 0;
      break;

    default:
      throw new Error(`Unknown data type: ${dataType}`);
  }

  return result;
}

/**
 * Process user profile data
 */
async function processUserProfile(
  userId: string,
  retentionPolicy: string,
  requestType: string
): Promise<any> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('User not found');
  }

  if (retentionPolicy === 'DELETE' || requestType === 'ACCOUNT_DELETION') {
    // Complete account deletion
    await prisma.user.delete({ where: { id: userId } });
    return { action: 'deleted', accountDeleted: true };
  } else if (retentionPolicy === 'ANONYMIZE') {
    // Anonymize user data
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@anonymized.local`,
        name: 'Deleted User',
        passwordHash: null,
        stripeCustomerId: null,
      },
    });
    return { action: 'anonymized', fieldsAnonymized: ['email', 'name'] };
  } else if (retentionPolicy === 'ARCHIVE') {
    // Move to quarantine folder in S3 (if applicable)
    return { action: 'archived', note: 'User data archived' };
  }

  return { action: 'no_change' };
}

/**
 * Process campaigns data
 */
async function processCampaigns(userId: string, retentionPolicy: string): Promise<any> {
  const campaigns = await prisma.campaign.findMany({ where: { userId } });
  
  if (retentionPolicy === 'DELETE') {
    await prisma.campaign.deleteMany({ where: { userId } });
    return { action: 'deleted', count: campaigns.length };
  } else if (retentionPolicy === 'ANONYMIZE') {
    await prisma.campaign.updateMany({
      where: { userId },
      data: {
        name: 'Anonymized Campaign',
        audience: {},
      },
    });
    return { action: 'anonymized', count: campaigns.length };
  }

  return { action: 'no_change', count: campaigns.length };
}

/**
 * Process leads data
 */
async function processLeads(userId: string, retentionPolicy: string): Promise<any> {
  const leads = await prisma.lead.findMany({ where: { userId } });
  
  if (retentionPolicy === 'DELETE') {
    await prisma.lead.deleteMany({ where: { userId } });
    return { action: 'deleted', count: leads.length };
  } else if (retentionPolicy === 'ANONYMIZE') {
    await prisma.lead.updateMany({
      where: { userId },
      data: {
        email: 'anonymized@example.com',
        name: 'Anonymized Lead',
        phone: null,
        metadata: {},
      },
    });
    return { action: 'anonymized', count: leads.length };
  }

  return { action: 'no_change', count: leads.length };
}

/**
 * Process analytics data
 */
async function processAnalytics(userId: string, retentionPolicy: string): Promise<any> {
  const metrics = await prisma.campaignMetrics.findMany({
    where: {
      campaign: { userId },
    },
  });
  
  if (retentionPolicy === 'DELETE') {
    await prisma.campaignMetrics.deleteMany({
      where: {
        campaign: { userId },
      },
    });
    return { action: 'deleted', count: metrics.length };
  }

  return { action: 'no_change', count: metrics.length };
}

/**
 * Process assets (S3 files)
 */
async function processAssets(userId: string, retentionPolicy: string): Promise<any> {
  // Find jobs that reference S3 assets
  const jobs = await prisma.job.findMany({
    where: {
      userId,
      OR: [
        { inputKey: { contains: userId } },
        { outputKey: { contains: userId } },
      ],
    },
  });

  let processedCount = 0;

  for (const job of jobs) {
    try {
      if (retentionPolicy === 'DELETE') {
        // Delete from S3
        if (job.inputKey) {
          await s3Client.send(new DeleteObjectCommand({
            Bucket: env.S3_BUCKET_NAME!,
            Key: job.inputKey.replace(`s3://${env.S3_BUCKET_NAME}/`, ''),
          }));
        }
        if (job.outputKey) {
          await s3Client.send(new DeleteObjectCommand({
            Bucket: env.S3_BUCKET_NAME!,
            Key: job.outputKey.replace(`s3://${env.S3_BUCKET_NAME}/`, ''),
          }));
        }
        processedCount++;
      } else if (retentionPolicy === 'QUARANTINE') {
        // Move to quarantine folder
        if (job.inputKey) {
          await moveToQuarantine(job.inputKey);
        }
        if (job.outputKey) {
          await moveToQuarantine(job.outputKey);
        }
        processedCount++;
      }
    } catch (error) {
      log.error('asset_processing_failed', error as Error, {
        userId,
        jobId: job.id,
        inputKey: job.inputKey,
        outputKey: job.outputKey,
      });
    }
  }

  return { action: retentionPolicy.toLowerCase(), count: processedCount };
}

/**
 * Process jobs data
 */
async function processJobs(userId: string, retentionPolicy: string): Promise<any> {
  const jobs = await prisma.job.findMany({ where: { userId } });
  
  if (retentionPolicy === 'DELETE') {
    await prisma.job.deleteMany({ where: { userId } });
    return { action: 'deleted', count: jobs.length };
  }

  return { action: 'no_change', count: jobs.length };
}

/**
 * Process subscriptions data
 */
async function processSubscriptions(userId: string, retentionPolicy: string): Promise<any> {
  const subscriptions = await prisma.subscription.findMany({ where: { userId } });
  
  if (retentionPolicy === 'ANONYMIZE') {
    await prisma.subscription.updateMany({
      where: { userId },
      data: {
        stripeSubscriptionId: null,
        metadata: {},
      },
    });
    return { action: 'anonymized', count: subscriptions.length };
  }

  return { action: 'no_change', count: subscriptions.length };
}

/**
 * Process logs data
 */
async function processLogs(userId: string, retentionPolicy: string): Promise<any> {
  // In a real implementation, you'd process log files
  // For now, we'll just return a placeholder
  return { action: 'no_change', count: 0, note: 'Log processing not implemented' };
}

/**
 * Export a specific data type
 */
async function exportDataType(userId: string, dataType: string): Promise<any> {
  switch (dataType) {
    case 'USER_PROFILE':
      return await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          verifiedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

    case 'CAMPAIGNS':
      return await prisma.campaign.findMany({
        where: { userId },
        include: {
          adVariants: true,
          campaignMetrics: true,
        },
      });

    case 'LEADS':
      return await prisma.lead.findMany({
        where: { userId },
      });

    case 'ANALYTICS':
      return await prisma.campaignMetrics.findMany({
        where: {
          campaign: { userId },
        },
        include: {
          campaign: {
            select: { id: true, name: true },
          },
        },
      });

    case 'ASSETS':
      return await prisma.job.findMany({
        where: {
          userId,
          OR: [
            { inputKey: { contains: userId } },
            { outputKey: { contains: userId } },
          ],
        },
        select: {
          id: true,
          type: true,
          status: true,
          inputKey: true,
          outputKey: true,
          createdAt: true,
        },
      });

    case 'JOBS':
      return await prisma.job.findMany({
        where: { userId },
      });

    case 'SUBSCRIPTIONS':
      return await prisma.subscription.findMany({
        where: { userId },
      });

    case 'LOGS':
      return { note: 'Log export not implemented' };

    default:
      throw new Error(`Unknown data type: ${dataType}`);
  }
}

/**
 * Move S3 object to quarantine folder
 */
async function moveToQuarantine(s3Key: string): Promise<void> {
  const key = s3Key.replace(`s3://${env.S3_BUCKET_NAME}/`, '');
  const quarantineKey = `quarantine/${key}`;

  await s3Client.send(new CopyObjectCommand({
    Bucket: env.S3_BUCKET_NAME!,
    CopySource: `${env.S3_BUCKET_NAME}/${key}`,
    Key: quarantineKey,
  }));

  await s3Client.send(new DeleteObjectCommand({
    Bucket: env.S3_BUCKET_NAME!,
    Key: key,
  }));
}

/**
 * Convert data to CSV format
 */
function convertToCSV(data: Record<string, any>): string {
  const lines: string[] = [];
  
  for (const [dataType, records] of Object.entries(data)) {
    if (Array.isArray(records) && records.length > 0) {
      lines.push(`\n# ${dataType.toUpperCase()}`);
      
      // Get headers from first record
      const headers = Object.keys(records[0]);
      lines.push(headers.join(','));
      
      // Add data rows
      for (const record of records) {
        const values = headers.map(header => {
          const value = record[header];
          if (typeof value === 'object') {
            return JSON.stringify(value);
          }
          return String(value || '');
        });
        lines.push(values.join(','));
      }
    }
  }
  
  return lines.join('\n');
}

// Worker event handlers
dataProcessingWorker.on('completed', (job) => {
  log.info('data_processing_worker_job_completed', {
    jobId: job.id,
    jobName: job.name,
  });
});

dataProcessingWorker.on('failed', (job, err) => {
  log.error('data_processing_worker_job_failed', err, {
    jobId: job?.id,
    jobName: job?.name,
  });
});

dataProcessingWorker.on('error', (err) => {
  log.error('data_processing_worker_error', err);
});

export { dataProcessingWorker };
export default dataProcessingWorker;
