import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { log } from '../lib/logger';
import { metrics } from '../lib/metrics';
import { S3Client, DeleteObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../env';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const router = Router();
const prisma = new PrismaClient();
const redis = new IORedis(env.REDIS_URL || 'redis://localhost:6379');
const s3Client = new S3Client({
  region: env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Queue for data processing jobs
const dataProcessingQueue = new Queue('data-processing', {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

// Validation schemas
const requestDeletionSchema = z.object({
  requestType: z.enum(['ACCOUNT_DELETION', 'DATA_PURGE', 'ANONYMIZATION']),
  reason: z.string().optional(),
  retentionPolicy: z.enum(['DELETE', 'ANONYMIZE', 'ARCHIVE']).default('ANONYMIZE'),
  dataTypes: z.array(z.enum([
    'USER_PROFILE',
    'CAMPAIGNS', 
    'LEADS',
    'ANALYTICS',
    'ASSETS',
    'JOBS',
    'SUBSCRIPTIONS',
    'LOGS'
  ])).optional(),
});

const exportDataSchema = z.object({
  dataTypes: z.array(z.enum([
    'USER_PROFILE',
    'CAMPAIGNS',
    'LEADS', 
    'ANALYTICS',
    'ASSETS',
    'JOBS',
    'SUBSCRIPTIONS',
    'LOGS'
  ])).default(['USER_PROFILE', 'CAMPAIGNS', 'LEADS']),
  format: z.enum(['json', 'csv']).default('json'),
});

/**
 * POST /api/privacy/request-deletion
 * Request data deletion or anonymization
 */
router.post('/request-deletion', requireAuth, async (req, res) => {
  try {
    const { requestType, reason, retentionPolicy, dataTypes } = requestDeletionSchema.parse(req.body);
    const userId = req.user!.id;

    // Check for existing pending requests
    const existingRequest = await prisma.dataDeletionRequest.findFirst({
      where: {
        userId,
        status: {
          in: ['PENDING', 'PROCESSING'],
        },
      },
    });

    if (existingRequest) {
      return res.status(409).json({
        error: 'Request Already Exists',
        message: 'You already have a pending data deletion request',
        requestId: existingRequest.id,
        status: existingRequest.status,
      });
    }

    // Create deletion request
    const deletionRequest = await prisma.dataDeletionRequest.create({
      data: {
        userId,
        requestType,
        reason,
        retentionPolicy,
        metadata: {
          dataTypes: dataTypes || [],
          requestedBy: 'user',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      },
    });

    // Queue deletion job
    await dataProcessingQueue.add(
      'process-deletion',
      {
        deletionRequestId: deletionRequest.id,
        userId,
        requestType,
        retentionPolicy,
        dataTypes: dataTypes || [],
      },
      {
        priority: requestType === 'ACCOUNT_DELETION' ? 10 : 5,
        delay: requestType === 'ACCOUNT_DELETION' ? 0 : 24 * 60 * 60 * 1000, // 24 hour delay for non-account deletions
      }
    );

    // Log the request
    log.info('data_deletion_requested', {
      reqId: req.headers['x-request-id'],
      userId,
      requestType,
      retentionPolicy,
      dataTypes: dataTypes || [],
      deletionRequestId: deletionRequest.id,
    });

    // Record metrics
    metrics.recordJobProcessed('data-processing', 'queued', 'privacy-worker');

    res.status(201).json({
      message: 'Data deletion request submitted successfully',
      requestId: deletionRequest.id,
      status: deletionRequest.status,
      estimatedProcessingTime: requestType === 'ACCOUNT_DELETION' ? 'Immediate' : '24-48 hours',
    });
  } catch (error) {
    log.error('data_deletion_request_failed', error as Error, {
      reqId: req.headers['x-request-id'],
      userId: req.user?.id,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid request data',
        details: error.errors,
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process deletion request',
    });
  }
});

/**
 * GET /api/privacy/deletion-status/:requestId
 * Get status of a deletion request
 */
router.get('/deletion-status/:requestId', requireAuth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user!.id;

    const deletionRequest = await prisma.dataDeletionRequest.findFirst({
      where: {
        id: requestId,
        userId,
      },
    });

    if (!deletionRequest) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Deletion request not found',
      });
    }

    res.json({
      requestId: deletionRequest.id,
      status: deletionRequest.status,
      requestType: deletionRequest.requestType,
      retentionPolicy: deletionRequest.retentionPolicy,
      requestedAt: deletionRequest.requestedAt,
      processedAt: deletionRequest.processedAt,
      completedAt: deletionRequest.completedAt,
      errorMessage: deletionRequest.errorMessage,
      metadata: deletionRequest.metadata,
    });
  } catch (error) {
    log.error('deletion_status_failed', error as Error, {
      reqId: req.headers['x-request-id'],
      userId: req.user?.id,
      requestId: req.params.requestId,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve deletion status',
    });
  }
});

/**
 * POST /api/privacy/cancel-deletion/:requestId
 * Cancel a pending deletion request
 */
router.post('/cancel-deletion/:requestId', requireAuth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user!.id;

    const deletionRequest = await prisma.dataDeletionRequest.findFirst({
      where: {
        id: requestId,
        userId,
        status: 'PENDING',
      },
    });

    if (!deletionRequest) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Pending deletion request not found',
      });
    }

    // Update status to cancelled
    await prisma.dataDeletionRequest.update({
      where: { id: requestId },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
        metadata: {
          ...deletionRequest.metadata,
          cancelledAt: new Date().toISOString(),
          cancelledBy: 'user',
        },
      },
    });

    // Remove job from queue if it hasn't started processing
    const job = await dataProcessingQueue.getJob(`process-deletion-${requestId}`);
    if (job && job.opts.delay) {
      await job.remove();
    }

    log.info('data_deletion_cancelled', {
      reqId: req.headers['x-request-id'],
      userId,
      requestId,
    });

    res.json({
      message: 'Deletion request cancelled successfully',
      requestId,
      status: 'CANCELLED',
    });
  } catch (error) {
    log.error('deletion_cancellation_failed', error as Error, {
      reqId: req.headers['x-request-id'],
      userId: req.user?.id,
      requestId: req.params.requestId,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to cancel deletion request',
    });
  }
});

/**
 * POST /api/privacy/export
 * Request data export
 */
router.post('/export', requireAuth, async (req, res) => {
  try {
    const { dataTypes, format } = exportDataSchema.parse(req.body);
    const userId = req.user!.id;

    // Check for existing pending export requests
    const existingRequest = await prisma.dataExportRequest.findFirst({
      where: {
        userId,
        status: {
          in: ['PENDING', 'PROCESSING'],
        },
      },
    });

    if (existingRequest) {
      return res.status(409).json({
        error: 'Request Already Exists',
        message: 'You already have a pending data export request',
        requestId: existingRequest.id,
        status: existingRequest.status,
      });
    }

    // Create export request
    const exportRequest = await prisma.dataExportRequest.create({
      data: {
        userId,
        metadata: {
          dataTypes,
          format,
          requestedBy: 'user',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      },
    });

    // Queue export job
    await dataProcessingQueue.add(
      'process-export',
      {
        exportRequestId: exportRequest.id,
        userId,
        dataTypes,
        format,
      },
      {
        priority: 3,
        delay: 0,
      }
    );

    log.info('data_export_requested', {
      reqId: req.headers['x-request-id'],
      userId,
      dataTypes,
      format,
      exportRequestId: exportRequest.id,
    });

    // Record metrics
    metrics.recordJobProcessed('data-processing', 'queued', 'privacy-worker');

    res.status(201).json({
      message: 'Data export request submitted successfully',
      requestId: exportRequest.id,
      status: exportRequest.status,
      estimatedProcessingTime: '1-2 hours',
    });
  } catch (error) {
    log.error('data_export_request_failed', error as Error, {
      reqId: req.headers['x-request-id'],
      userId: req.user?.id,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid request data',
        details: error.errors,
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process export request',
    });
  }
});

/**
 * GET /api/privacy/export/:requestId
 * Get export download link
 */
router.get('/export/:requestId', requireAuth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user!.id;

    const exportRequest = await prisma.dataExportRequest.findFirst({
      where: {
        id: requestId,
        userId,
      },
    });

    if (!exportRequest) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Export request not found',
      });
    }

    if (exportRequest.status !== 'COMPLETED') {
      return res.status(400).json({
        error: 'Not Ready',
        message: 'Export is not yet ready for download',
        status: exportRequest.status,
      });
    }

    if (!exportRequest.downloadUrl || !exportRequest.expiresAt) {
      return res.status(500).json({
        error: 'Download Unavailable',
        message: 'Download link is not available',
      });
    }

    // Check if download URL has expired
    if (new Date() > exportRequest.expiresAt) {
      // Update status to expired
      await prisma.dataExportRequest.update({
        where: { id: requestId },
        data: { status: 'EXPIRED' },
      });

      return res.status(410).json({
        error: 'Download Expired',
        message: 'Download link has expired. Please request a new export.',
      });
    }

    res.json({
      requestId: exportRequest.id,
      downloadUrl: exportRequest.downloadUrl,
      expiresAt: exportRequest.expiresAt,
      fileSize: exportRequest.fileSize,
      format: exportRequest.metadata?.format,
      dataTypes: exportRequest.metadata?.dataTypes,
    });
  } catch (error) {
    log.error('export_download_failed', error as Error, {
      reqId: req.headers['x-request-id'],
      userId: req.user?.id,
      requestId: req.params.requestId,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve download link',
    });
  }
});

/**
 * GET /api/privacy/retention-policies
 * Get data retention policies
 */
router.get('/retention-policies', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    // Get user-specific and global retention policies
    const policies = await prisma.dataRetentionPolicy.findMany({
      where: {
        OR: [
          { userId },
          { userId: null }, // Global policies
        ],
        isActive: true,
      },
      orderBy: [
        { userId: 'asc' }, // User-specific policies first
        { dataType: 'asc' },
      ],
    });

    // Group policies by data type
    const policiesByType = policies.reduce((acc, policy) => {
      if (!acc[policy.dataType]) {
        acc[policy.dataType] = [];
      }
      acc[policy.dataType].push({
        id: policy.id,
        userId: policy.userId,
        retentionDays: policy.retentionDays,
        action: policy.action,
        isGlobal: policy.userId === null,
      });
      return acc;
    }, {} as Record<string, any[]>);

    res.json({
      policies: policiesByType,
      defaultRetentionDays: 90, // Default retention period
      defaultAction: 'ANONYMIZE',
    });
  } catch (error) {
    log.error('retention_policies_failed', error as Error, {
      reqId: req.headers['x-request-id'],
      userId: req.user?.id,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve retention policies',
    });
  }
});

/**
 * GET /api/privacy/audit-log
 * Get data processing audit log
 */
router.get('/audit-log', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;

    const auditLogs = await prisma.dataProcessingAudit.findMany({
      where: { userId },
      orderBy: { processedAt: 'desc' },
      skip: offset,
      take: limit,
    });

    const totalCount = await prisma.dataProcessingAudit.count({
      where: { userId },
    });

    res.json({
      auditLogs,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    log.error('audit_log_failed', error as Error, {
      reqId: req.headers['x-request-id'],
      userId: req.user?.id,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve audit log',
    });
  }
});

export default router;
