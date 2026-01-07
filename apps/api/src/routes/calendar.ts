import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { log } from '../lib/logger';

const router = Router();

/**
 * Get start of day in UTC
 */
function getStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of day in UTC
 */
function getEndOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/**
 * Get start of week (Monday)
 */
function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setUTCDate(diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of week (Sunday)
 */
function getEndOfWeek(date: Date): Date {
  const start = getStartOfWeek(date);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

/**
 * Format time from DateTime
 */
function formatTime(date: Date): string {
  return date.toISOString().substring(11, 16); // HH:MM
}

/**
 * Group posts by platform
 */
function groupByPlatform(posts: any[]): Record<string, any[]> {
  const grouped: Record<string, any[]> = {};

  for (const post of posts) {
    const platform = post.platform || 'unknown';
    if (!grouped[platform]) {
      grouped[platform] = [];
    }
    grouped[platform].push({
      id: post.id,
      time: formatTime(post.scheduledAt),
      caption: post.caption || '',
      status: post.status,
      retryCount: post.retryCount,
      errorLog: post.errorLog,
      contentUrl: post.contentUrl || post.creativeKey,
    });
  }

  // Sort posts by time within each platform
  for (const platform in grouped) {
    grouped[platform].sort((a, b) => a.time.localeCompare(b.time));
  }

  return grouped;
}

/**
 * GET /api/calendar/today
 * Get all scheduled posts for today grouped by platform
 */
router.get('/today', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const today = new Date();
    const startOfDay = getStartOfDay(today);
    const endOfDay = getEndOfDay(today);

    // Query posts scheduled for today
    const posts = await prisma.scheduledPost.findMany({
      where: {
        userId,
        scheduledAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: {
        scheduledAt: 'asc',
      },
    });

    // Group by platform
    const platforms = groupByPlatform(posts);

    // Format date
    const dateStr = today.toISOString().substring(0, 10); // YYYY-MM-DD

    res.json({
      success: true,
      data: {
        date: dateStr,
        platforms,
      },
    });
  } catch (error) {
    log.error('Get calendar today error', error as Error, {
      reqId: req.headers['x-request-id'] as string || 'calendar',
      userId: req.user?.id,
    });

    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * GET /api/calendar/week
 * Get scheduled posts for the current week grouped by date and platform
 */
router.get('/week', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const today = new Date();
    const startOfWeek = getStartOfWeek(today);
    const endOfWeek = getEndOfWeek(today);

    // Query posts scheduled for this week
    const posts = await prisma.scheduledPost.findMany({
      where: {
        userId,
        scheduledAt: {
          gte: startOfWeek,
          lte: endOfWeek,
        },
      },
      orderBy: {
        scheduledAt: 'asc',
      },
    });

    // Group by date, then by platform
    const byDate: Record<string, Record<string, any[]>> = {};

    // Initialize all 7 days
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setUTCDate(date.getUTCDate() + i);
      const dateStr = date.toISOString().substring(0, 10);
      byDate[dateStr] = {};
    }

    // Group posts by date
    for (const post of posts) {
      const dateStr = post.scheduledAt.toISOString().substring(0, 10);
      if (!byDate[dateStr]) {
        byDate[dateStr] = {};
      }

      const platform = post.platform || 'unknown';
      if (!byDate[dateStr][platform]) {
        byDate[dateStr][platform] = [];
      }

      byDate[dateStr][platform].push({
        id: post.id,
        time: formatTime(post.scheduledAt),
        caption: post.caption || '',
        status: post.status,
        retryCount: post.retryCount,
        errorLog: post.errorLog,
        contentUrl: post.contentUrl || post.creativeKey,
      });
    }

    // Sort posts by time within each platform for each date
    for (const dateStr in byDate) {
      for (const platform in byDate[dateStr]) {
        byDate[dateStr][platform].sort((a, b) => a.time.localeCompare(b.time));
      }
    }

    // Convert to array format
    const weekData = Object.keys(byDate)
      .sort()
      .map(dateStr => ({
        date: dateStr,
        platforms: byDate[dateStr],
      }));

    res.json({
      success: true,
      data: weekData,
    });
  } catch (error) {
    log.error('Get calendar week error', error as Error, {
      reqId: req.headers['x-request-id'] as string || 'calendar',
      userId: req.user?.id,
    });

    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

export default router;

