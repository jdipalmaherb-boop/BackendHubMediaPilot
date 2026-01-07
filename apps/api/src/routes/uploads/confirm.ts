import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { prisma } from '../../lib/prisma';
import { addVideoJob, VIDEO_JOB_TYPES, VideoJobType } from '../../queues/videoQueue';

const router = Router();

// Validation schema
const confirmSchema = z.object({
  key: z.string().min(1, 'S3 key is required'),
  type: z.enum(['video_process', 'asset_ingest']).default('video_process'),
  meta: z.object({
    originalFilename: z.string().min(1, 'Original filename is required'),
    contentType: z.string().min(1, 'Content type is required'),
    size: z.number().int().min(1, 'Size must be positive'),
    // Optional additional metadata
    title: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })
});

// Helper function to extract user ID from S3 key
const extractUserIdFromKey = (key: string): string | null => {
  const match = key.match(/^uploads\/([a-f0-9-]+)\//);
  return match ? match[1] : null;
};

// Helper function to determine job type based on content type
const determineJobType = (contentType: string): VideoJobType => {
  if (contentType.startsWith('video/')) {
    return VIDEO_JOB_TYPES.VIDEO_PROCESS;
  }
  return VIDEO_JOB_TYPES.ASSET_INGEST;
};

// Helper function to check if content type requires virus scanning
const requiresVirusScan = (contentType: string): boolean => {
  // TODO: Integrate ClamAV or 3rd-party upload scanning
  // For now, we'll scan all video files and executable content
  const scanTypes = [
    'video/',
    'application/',
    'text/',
    'image/svg+xml' // SVG can contain scripts
  ];
  
  return scanTypes.some(type => contentType.startsWith(type));
};

/**
 * POST /api/uploads/confirm
 * Confirm successful upload and create processing job
 */
router.post('/confirm', requireAuth, async (req: Request, res: Response) => {
  try {
    const { key, type, meta } = confirmSchema.parse(req.body);

    // Extract user ID from S3 key and validate ownership
    const keyUserId = extractUserIdFromKey(key);
    if (!keyUserId) {
      return res.status(400).json({
        error: 'Invalid S3 key format',
        code: 'INVALID_KEY_FORMAT'
      });
    }

    if (keyUserId !== req.user!.id) {
      return res.status(403).json({
        error: 'Unauthorized access to file',
        code: 'UNAUTHORIZED_FILE_ACCESS'
      });
    }

    // Validate against presign request
    const presignRequest = await prisma.presignRequest.findUnique({
      where: { key }
    });

    if (!presignRequest) {
      return res.status(400).json({
        error: 'No presign request found for this key',
        code: 'PRESIGN_NOT_FOUND'
      });
    }

    if (presignRequest.userId !== req.user!.id) {
      return res.status(403).json({
        error: 'Presign request belongs to different user',
        code: 'PRESIGN_USER_MISMATCH'
      });
    }

    if (presignRequest.expiresAt < new Date()) {
      return res.status(400).json({
        error: 'Presigned URL has expired',
        code: 'PRESIGN_EXPIRED'
      });
    }

    // Validate content type matches
    if (presignRequest.contentType !== meta.contentType) {
      return res.status(400).json({
        error: 'Content type mismatch',
        code: 'CONTENT_TYPE_MISMATCH',
        details: {
          expected: presignRequest.contentType,
          received: meta.contentType
        }
      });
    }

    // Determine the appropriate job type
    const jobType = type === 'video_process' ? 
      determineJobType(meta.contentType) : 
      VIDEO_JOB_TYPES.ASSET_INGEST;

    // Create job record
    const job = await prisma.job.create({
      data: {
        userId: req.user!.id,
        type: jobType,
        status: 'queued',
        s3Key: key,
        meta: {
          originalFilename: meta.originalFilename,
          contentType: meta.contentType,
          size: meta.size,
          uploadedAt: new Date().toISOString(),
          title: meta.title,
          description: meta.description,
          tags: meta.tags || [],
          requiresVirusScan: requiresVirusScan(meta.contentType),
          // Add processing metadata
          processingMetadata: {
            estimatedDuration: 'unknown',
            priority: 'normal',
            retryCount: 0
          }
        }
      }
    });

    // Enqueue job for processing
    try {
      await addVideoJob({
        s3Key: key,
        userId: req.user!.id,
        jobId: job.id,
        originalFilename: meta.originalFilename,
        contentType: meta.contentType,
        size: meta.size
      }, jobType);

      console.log(`Job ${job.id} queued for processing: ${jobType}`);
    } catch (queueError) {
      console.error('Failed to queue job:', queueError);
      
      // Update job status to failed if queuing fails
      await prisma.job.update({
        where: { id: job.id },
        data: { 
          status: 'failed',
          meta: {
            ...job.meta as any,
            queueError: queueError instanceof Error ? queueError.message : 'Unknown queue error',
            queuedAt: new Date().toISOString()
          }
        }
      });

      return res.status(500).json({
        error: 'Failed to queue processing job',
        code: 'QUEUE_ERROR',
        jobId: job.id
      });
    }

    res.json({
      message: 'Upload confirmed and job queued successfully',
      jobId: job.id,
      jobType: jobType,
      status: 'queued',
      key,
      estimatedProcessingTime: '2-5 minutes'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Upload confirm error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/uploads/jobs
 * Get user's upload jobs with status
 */
router.get('/jobs', requireAuth, async (req: Request, res: Response) => {
  try {
    const { status, type, limit = '10', offset = '0' } = req.query;

    const where: any = {
      userId: req.user!.id
    };

    if (status && typeof status === 'string') {
      where.status = status;
    }

    if (type && typeof type === 'string') {
      where.type = type;
    }

    const jobs = await prisma.job.findMany({
      where,
      select: {
        id: true,
        type: true,
        status: true,
        s3Key: true,
        outputKey: true,
        attempts: true,
        meta: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });

    res.json({
      jobs,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        total: await prisma.job.count({ where })
      }
    });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/uploads/jobs/:jobId
 * Get specific job details
 */
router.get('/jobs/:jobId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        userId: req.user!.id
      }
    });

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        code: 'JOB_NOT_FOUND'
      });
    }

    res.json({ job });
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

export default router;
