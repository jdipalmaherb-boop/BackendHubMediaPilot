import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { enhancedSanitizePromptInput } from '../middleware/sanitize';
import { prisma } from '../lib/prisma';
import { addScheduledJob, cancelScheduledJob, getScheduledJob } from '../queues/schedulerQueue';
import crypto from 'crypto';

const router = Router();

// Encryption utilities for platform credentials
const ENCRYPTION_KEY = process.env.CREDENTIALS_ENCRYPTION_KEY || 'default-key-change-in-production';
const ALGORITHM = 'aes-256-gcm';

function encryptCredentials(credentials: any): { encrypted: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY);
  cipher.setAAD(Buffer.from('platform-credentials'));
  
  let encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

function decryptCredentials(encryptedData: { encrypted: string; iv: string; tag: string }): any {
  const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
  decipher.setAAD(Buffer.from('platform-credentials'));
  decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return JSON.parse(decrypted);
}

// Validation schemas
const schedulePostSchema = z.object({
  creativeKey: z.string().min(1, 'Creative key is required'),
  caption: z.string().min(1, 'Caption is required'),
  platforms: z.array(z.object({
    platform: z.enum(['meta', 'tiktok', 'youtube', 'twitter', 'linkedin']),
    credentials: z.object({
      accessToken: z.string().min(1, 'Access token is required'),
      refreshToken: z.string().optional(),
      accountId: z.string().optional(),
      pageId: z.string().optional(),
      additionalData: z.record(z.any()).optional(),
    }),
    targeting: z.object({
      audience: z.string().optional(),
      hashtags: z.array(z.string()).optional(),
      mentions: z.array(z.string()).optional(),
      location: z.string().optional(),
    }).optional(),
    options: z.object({
      scheduleTime: z.string().datetime().optional(),
      isStory: z.boolean().optional(),
      isReel: z.boolean().optional(),
      isCarousel: z.boolean().optional(),
    }).optional(),
  })).min(1, 'At least one platform is required'),
  publishAt: z.string().datetime('Invalid publish date'),
  timezone: z.string().default('UTC'),
  metadata: z.record(z.any()).optional(),
});

const reschedulePostSchema = z.object({
  publishAt: z.string().datetime('Invalid publish date'),
  timezone: z.string().default('UTC'),
});

const cancelPostSchema = z.object({
  reason: z.string().optional(),
});

/**
 * POST /api/scheduler/schedule
 * Schedule a post for publishing across multiple platforms
 */
router.post('/schedule', requireAuth, enhancedSanitizePromptInput, async (req: Request, res: Response) => {
  try {
    const requestData = schedulePostSchema.parse(req.body);
    const userId = req.user!.id;

    // Validate creative ownership
    const creative = await prisma.asset.findFirst({
      where: {
        key: requestData.creativeKey,
        orgId: userId, // Assuming userId maps to orgId for now
      },
    });

    if (!creative) {
      return res.status(404).json({
        error: 'Creative asset not found or access denied',
        code: 'CREATIVE_NOT_FOUND'
      });
    }

    // Encrypt platform credentials
    const platformsWithEncryptedCredentials = requestData.platforms.map(platform => ({
      ...platform,
      credentials: encryptCredentials(platform.credentials),
    }));

    // Create scheduled post record
    const scheduledPost = await prisma.scheduledPost.create({
      data: {
        userId,
        creativeKey: requestData.creativeKey,
        caption: requestData.caption,
        targetPlatforms: requestData.platforms.map(p => p.platform),
        options: {
          platforms: platformsWithEncryptedCredentials,
          timezone: requestData.timezone,
          metadata: requestData.metadata,
        },
        publishAt: new Date(requestData.publishAt),
        status: 'SCHEDULED',
      },
    });

    // Add job to scheduler queue
    const jobId = await addScheduledJob({
      scheduledPostId: scheduledPost.id,
      userId,
      creativeKey: requestData.creativeKey,
      caption: requestData.caption,
      platforms: platformsWithEncryptedCredentials,
      publishAt: new Date(requestData.publishAt),
      timezone: requestData.timezone,
      metadata: requestData.metadata,
    });

    // Update scheduled post with job ID
    await prisma.scheduledPost.update({
      where: { id: scheduledPost.id },
      data: { 
        meta: { 
          jobId,
          scheduledAt: new Date().toISOString(),
        } 
      },
    });

    res.json({
      success: true,
      data: {
        scheduledPostId: scheduledPost.id,
        jobId,
        publishAt: scheduledPost.publishAt,
        platforms: requestData.platforms.map(p => p.platform),
        status: 'SCHEDULED',
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Schedule post error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * PUT /api/scheduler/:id/reschedule
 * Reschedule an existing post
 */
router.put('/:id/reschedule', requireAuth, async (req: Request, res: Response) => {
  try {
    const scheduledPostId = req.params.id;
    const { publishAt, timezone } = reschedulePostSchema.parse(req.body);
    const userId = req.user!.id;

    // Verify ownership and get scheduled post
    const scheduledPost = await prisma.scheduledPost.findFirst({
      where: {
        id: scheduledPostId,
        userId,
      },
    });

    if (!scheduledPost) {
      return res.status(404).json({
        error: 'Scheduled post not found',
        code: 'SCHEDULED_POST_NOT_FOUND'
      });
    }

    if (scheduledPost.status === 'PUBLISHED') {
      return res.status(400).json({
        error: 'Cannot reschedule published post',
        code: 'POST_ALREADY_PUBLISHED'
      });
    }

    // Cancel existing job
    const jobId = scheduledPost.meta?.jobId;
    if (jobId) {
      await cancelScheduledJob(jobId);
    }

    // Add new job with updated schedule
    const newJobId = await addScheduledJob({
      scheduledPostId: scheduledPost.id,
      userId,
      creativeKey: scheduledPost.creativeKey,
      caption: scheduledPost.caption,
      platforms: scheduledPost.options?.platforms || [],
      publishAt: new Date(publishAt),
      timezone: timezone || 'UTC',
      metadata: scheduledPost.options?.metadata,
    });

    // Update scheduled post
    const updatedPost = await prisma.scheduledPost.update({
      where: { id: scheduledPostId },
      data: {
        publishAt: new Date(publishAt),
        status: 'SCHEDULED',
        meta: {
          ...scheduledPost.meta,
          jobId: newJobId,
          rescheduledAt: new Date().toISOString(),
        },
      },
    });

    res.json({
      success: true,
      data: {
        scheduledPostId: updatedPost.id,
        jobId: newJobId,
        publishAt: updatedPost.publishAt,
        status: updatedPost.status,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Reschedule post error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * DELETE /api/scheduler/:id/cancel
 * Cancel a scheduled post
 */
router.delete('/:id/cancel', requireAuth, async (req: Request, res: Response) => {
  try {
    const scheduledPostId = req.params.id;
    const { reason } = cancelPostSchema.parse(req.body);
    const userId = req.user!.id;

    // Verify ownership and get scheduled post
    const scheduledPost = await prisma.scheduledPost.findFirst({
      where: {
        id: scheduledPostId,
        userId,
      },
    });

    if (!scheduledPost) {
      return res.status(404).json({
        error: 'Scheduled post not found',
        code: 'SCHEDULED_POST_NOT_FOUND'
      });
    }

    if (scheduledPost.status === 'PUBLISHED') {
      return res.status(400).json({
        error: 'Cannot cancel published post',
        code: 'POST_ALREADY_PUBLISHED'
      });
    }

    // Cancel job in queue
    const jobId = scheduledPost.meta?.jobId;
    if (jobId) {
      await cancelScheduledJob(jobId);
    }

    // Update scheduled post status
    const updatedPost = await prisma.scheduledPost.update({
      where: { id: scheduledPostId },
      data: {
        status: 'CANCELED',
        meta: {
          ...scheduledPost.meta,
          canceledAt: new Date().toISOString(),
          cancelReason: reason,
        },
      },
    });

    res.json({
      success: true,
      data: {
        scheduledPostId: updatedPost.id,
        status: updatedPost.status,
        canceledAt: updatedPost.meta?.canceledAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Cancel post error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/scheduler/:id/status
 * Get status of a scheduled post
 */
router.get('/:id/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const scheduledPostId = req.params.id;
    const userId = req.user!.id;

    // Get scheduled post with publish records
    const scheduledPost = await prisma.scheduledPost.findFirst({
      where: {
        id: scheduledPostId,
        userId,
      },
      include: {
        publishRecords: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!scheduledPost) {
      return res.status(404).json({
        error: 'Scheduled post not found',
        code: 'SCHEDULED_POST_NOT_FOUND'
      });
    }

    // Get job status from queue
    const jobId = scheduledPost.meta?.jobId;
    let jobStatus = null;
    if (jobId) {
      try {
        jobStatus = await getScheduledJob(jobId);
      } catch (error) {
        console.warn('Failed to get job status:', error);
      }
    }

    // Calculate overall status
    const publishRecords = scheduledPost.publishRecords;
    const totalPlatforms = scheduledPost.targetPlatforms.length;
    const publishedPlatforms = publishRecords.filter(record => record.status === 'PUBLISHED').length;
    const failedPlatforms = publishRecords.filter(record => record.status === 'FAILED').length;

    let overallStatus = scheduledPost.status;
    if (scheduledPost.status === 'SCHEDULED' && publishRecords.length > 0) {
      if (publishedPlatforms === totalPlatforms) {
        overallStatus = 'PUBLISHED';
      } else if (failedPlatforms === totalPlatforms) {
        overallStatus = 'FAILED';
      } else if (publishedPlatforms > 0 || failedPlatforms > 0) {
        overallStatus = 'PARTIAL';
      }
    }

    res.json({
      success: true,
      data: {
        scheduledPostId: scheduledPost.id,
        status: overallStatus,
        publishAt: scheduledPost.publishAt,
        platforms: scheduledPost.targetPlatforms,
        jobStatus,
        publishRecords: publishRecords.map(record => ({
          id: record.id,
          platform: record.platform,
          status: record.status,
          externalId: record.externalId,
          createdAt: record.createdAt,
          meta: record.meta,
        })),
        summary: {
          totalPlatforms,
          publishedPlatforms,
          failedPlatforms,
          pendingPlatforms: totalPlatforms - publishedPlatforms - failedPlatforms,
        },
      },
    });
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/scheduler
 * Get user's scheduled posts with pagination
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const platform = req.query.platform as string;

    const where: any = { userId };
    
    if (status) {
      where.status = status;
    }

    if (platform) {
      where.targetPlatforms = {
        has: platform,
      };
    }

    const scheduledPosts = await prisma.scheduledPost.findMany({
      where,
      include: {
        publishRecords: {
          select: {
            id: true,
            platform: true,
            status: true,
            externalId: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            publishRecords: true,
          },
        },
      },
      orderBy: { publishAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await prisma.scheduledPost.count({ where });

    res.json({
      success: true,
      data: {
        scheduledPosts: scheduledPosts.map(post => ({
          id: post.id,
          creativeKey: post.creativeKey,
          caption: post.caption,
          platforms: post.targetPlatforms,
          publishAt: post.publishAt,
          status: post.status,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
          publishRecords: post.publishRecords,
          totalRecords: post._count.publishRecords,
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get scheduled posts error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/scheduler/:id/publish-now
 * Publish a scheduled post immediately
 */
router.post('/:id/publish-now', requireAuth, async (req: Request, res: Response) => {
  try {
    const scheduledPostId = req.params.id;
    const userId = req.user!.id;

    // Verify ownership and get scheduled post
    const scheduledPost = await prisma.scheduledPost.findFirst({
      where: {
        id: scheduledPostId,
        userId,
      },
    });

    if (!scheduledPost) {
      return res.status(404).json({
        error: 'Scheduled post not found',
        code: 'SCHEDULED_POST_NOT_FOUND'
      });
    }

    if (scheduledPost.status === 'PUBLISHED') {
      return res.status(400).json({
        error: 'Post already published',
        code: 'POST_ALREADY_PUBLISHED'
      });
    }

    // Cancel existing scheduled job
    const jobId = scheduledPost.meta?.jobId;
    if (jobId) {
      await cancelScheduledJob(jobId);
    }

    // Add immediate job (publish now)
    const immediateJobId = await addScheduledJob({
      scheduledPostId: scheduledPost.id,
      userId,
      creativeKey: scheduledPost.creativeKey,
      caption: scheduledPost.caption,
      platforms: scheduledPost.options?.platforms || [],
      publishAt: new Date(), // Immediate
      timezone: scheduledPost.options?.timezone || 'UTC',
      metadata: scheduledPost.options?.metadata,
    });

    // Update scheduled post
    const updatedPost = await prisma.scheduledPost.update({
      where: { id: scheduledPostId },
      data: {
        status: 'SCHEDULED',
        meta: {
          ...scheduledPost.meta,
          jobId: immediateJobId,
          publishedNowAt: new Date().toISOString(),
        },
      },
    });

    res.json({
      success: true,
      data: {
        scheduledPostId: updatedPost.id,
        jobId: immediateJobId,
        status: 'PUBLISHING',
        message: 'Post is being published immediately',
      },
    });
  } catch (error) {
    console.error('Publish now error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

export default router;
