import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { log } from '../lib/logger';
import { publishTikTokVideo } from '../services/tiktokAds';
import { uploadYouTubeVideo } from '../services/youtubeUploader';
import { createLinkedInPost } from '../services/linkedinPoster';

const MAX_RETRIES = 3;
const RETRY_DELAYS = [5, 15, 30]; // Minutes

/**
 * Calculate retry delay in milliseconds
 */
function getRetryDelay(retryCount: number): number {
  const delayMinutes = RETRY_DELAYS[retryCount - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
  return delayMinutes * 60 * 1000;
}

/**
 * Publish post to platform
 */
async function publishPost(post: any): Promise<{ success: boolean; externalId?: string; error?: string }> {
  const { id, userId, platform, contentUrl, creativeKey, caption, options } = post;
  
  // Use contentUrl if available, otherwise fall back to creativeKey
  const mediaUrl = contentUrl || creativeKey;
  
  if (!mediaUrl) {
    return {
      success: false,
      error: 'No content URL or creative key provided',
    };
  }

  try {
    switch (platform) {
      case 'tiktok': {
        const result = await publishTikTokVideo(userId, mediaUrl, caption || '', {
          privacyLevel: options?.privacyLevel || 'PUBLIC_TO_EVERYONE',
          disableDuet: options?.disableDuet,
          disableComment: options?.disableComment,
          disableStitch: options?.disableStitch,
        });
        return {
          success: result.status === 'PUBLISHED',
          externalId: result.publishId,
        };
      }

      case 'youtube': {
        const result = await uploadYouTubeVideo(userId, mediaUrl, caption || '', {
          metadata: {
            title: caption || 'Untitled Video',
            description: options?.description || caption,
            tags: options?.tags || [],
            privacyStatus: options?.privacyStatus || 'public',
          },
        });
        return {
          success: true,
          externalId: result.videoId,
        };
      }

      case 'linkedin': {
        const result = await createLinkedInPost(userId, caption || '', {
          imageUrl: options?.imageUrl,
          linkUrl: options?.linkUrl,
          linkTitle: options?.linkTitle,
          linkDescription: options?.linkDescription,
          visibility: options?.visibility || 'PUBLIC',
          organizationURN: options?.organizationURN,
        });
        return {
          success: true,
          externalId: result.postId,
        };
      }

      case 'instagram':
      case 'facebook': {
        // Use existing Meta/Facebook integration
        // This would call the existing Meta ads service
        log.warn('Instagram/Facebook posting via scheduler not yet implemented', { postId: id });
        return {
          success: false,
          error: 'Platform not yet supported in scheduler',
        };
      }

      default:
        return {
          success: false,
          error: `Unknown platform: ${platform}`,
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error('Post publish failed', error as Error, {
      postId: id,
      platform,
      userId,
    });
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Process a single scheduled post
 */
async function processScheduledPost(post: any): Promise<void> {
  const { id, userId, platform, retryCount } = post;

  log.info('Processing scheduled post', {
    postId: id,
    platform,
    userId,
    retryCount,
  });

  try {
    const result = await publishPost(post);

    if (result.success) {
      // Update post status to posted
      await prisma.scheduledPost.update({
        where: { id },
        data: {
          status: 'posted',
          errorLog: null,
          updatedAt: new Date(),
        },
      });

      // Create publish record
      await prisma.publishRecord.create({
        data: {
          scheduledPostId: id,
          platform,
          externalId: result.externalId,
          status: 'published',
          meta: {
            publishedAt: new Date().toISOString(),
          },
        },
      });

      // Log action
      await prisma.actionLog.create({
        data: {
          campaignId: 'system',
          actionType: 'scheduled_post_published',
          details: {
            postId: id,
            platform,
            externalId: result.externalId,
          },
        },
      });

      log.info('Scheduled post published successfully', {
        postId: id,
        platform,
        externalId: result.externalId,
      });
    } else {
      // Post failed, handle retry logic
      const newRetryCount = retryCount + 1;

      if (newRetryCount <= MAX_RETRIES) {
        // Reschedule with exponential backoff
        const delayMs = getRetryDelay(newRetryCount);
        const newScheduledAt = new Date(Date.now() + delayMs);

        await prisma.scheduledPost.update({
          where: { id },
          data: {
            status: 'pending',
            retryCount: newRetryCount,
            scheduledAt: newScheduledAt,
            errorLog: result.error || 'Unknown error',
            updatedAt: new Date(),
          },
        });

        log.warn('Scheduled post failed, will retry', {
          postId: id,
          platform,
          retryCount: newRetryCount,
          nextAttempt: newScheduledAt,
          error: result.error,
        });
      } else {
        // Max retries exceeded, mark as error
        await prisma.scheduledPost.update({
          where: { id },
          data: {
            status: 'error',
            errorLog: result.error || 'Max retries exceeded',
            updatedAt: new Date(),
          },
        });

        // Log action
        await prisma.actionLog.create({
          data: {
            campaignId: 'system',
            actionType: 'scheduled_post_failed',
            details: {
              postId: id,
              platform,
              error: result.error,
              retryCount: newRetryCount,
            },
          },
        });

        log.error('Scheduled post failed after max retries', {
          postId: id,
          platform,
          retryCount: newRetryCount,
          error: result.error,
        });
      }
    }
  } catch (error) {
    // Unexpected error during processing
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const newRetryCount = retryCount + 1;

    if (newRetryCount <= MAX_RETRIES) {
      const delayMs = getRetryDelay(newRetryCount);
      const newScheduledAt = new Date(Date.now() + delayMs);

      await prisma.scheduledPost.update({
        where: { id },
        data: {
          status: 'pending',
          retryCount: newRetryCount,
          scheduledAt: newScheduledAt,
          errorLog: errorMessage,
          updatedAt: new Date(),
        },
      });
    } else {
      await prisma.scheduledPost.update({
        where: { id },
        data: {
          status: 'error',
          errorLog: errorMessage,
          updatedAt: new Date(),
        },
      });
    }

    log.error('Unexpected error processing scheduled post', error as Error, {
      postId: id,
      platform,
      retryCount: newRetryCount,
    });
  }
}

/**
 * Check for due posts and process them
 */
async function checkAndPostDueContent(): Promise<void> {
  try {
    const now = new Date();
    const in5Minutes = new Date(now.getTime() + 5 * 60 * 1000);

    // Find all posts scheduled up to 5 minutes from now
    const duePosts = await prisma.scheduledPost.findMany({
      where: {
        status: 'pending',
        scheduledAt: {
          lte: in5Minutes,
        },
      },
      orderBy: {
        scheduledAt: 'asc',
      },
    });

    if (duePosts.length === 0) {
      return; // No posts to process
    }

    log.info(`Found ${duePosts.length} due posts to process`);

    // Process posts in parallel (with concurrency limit)
    const concurrency = 5;
    for (let i = 0; i < duePosts.length; i += concurrency) {
      const batch = duePosts.slice(i, i + concurrency);
      await Promise.allSettled(
        batch.map(post => processScheduledPost(post))
      );
    }

    log.info('Finished processing due posts');
  } catch (error) {
    log.error('Error in scheduled post check', error as Error);
  }
}

/**
 * Start the post scheduler worker
 */
export function startPostSchedulerWorker(): void {
  log.info('Starting post scheduler worker');

  // Run every minute
  cron.schedule('* * * * *', async () => {
    await checkAndPostDueContent();
  });

  // Also run immediately on startup
  checkAndPostDueContent().catch(error => {
    log.error('Error in initial post check', error as Error);
  });

  log.info('Post scheduler worker started (runs every minute)');
}

// Auto-start if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startPostSchedulerWorker();
  
  // Keep process alive
  process.on('SIGTERM', () => {
    log.info('Post scheduler worker shutting down');
    process.exit(0);
  });
  
  process.on('SIGINT', () => {
    log.info('Post scheduler worker shutting down');
    process.exit(0);
  });
}

