import { Router } from 'express';
import { z } from 'zod';
import { notificationService } from '../services/notificationService.js';
import { logger } from '../services/logger.js';

const router = Router();

// Schema for getting notifications
const getNotificationsSchema = z.object({
  orgId: z.string().min(1, 'Organization ID is required'),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 50),
});

// Schema for marking notifications as read
const markReadSchema = z.object({
  notificationIds: z.array(z.string()).min(1, 'At least one notification ID is required'),
});

/**
 * GET /api/notifications?orgId=...&limit=...
 * Get notifications for an organization
 */
router.get('/', async (req, res) => {
  try {
    const { orgId, limit } = getNotificationsSchema.parse({
      orgId: req.query.orgId,
      limit: req.query.limit,
    });

    logger.info('Fetching notifications', { orgId, limit });

    const result = await notificationService.getNotifications(orgId, limit);

    res.json({
      success: true,
      notifications: result.notifications,
      unreadCount: result.unreadCount,
    });

  } catch (error: any) {
    logger.error('Failed to get notifications', { error: error.message });

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications',
    });
  }
});

/**
 * POST /api/notifications/mark-read
 * Mark notifications as read
 */
router.post('/mark-read', async (req, res) => {
  try {
    const { notificationIds } = markReadSchema.parse(req.body);

    logger.info('Marking notifications as read', { notificationIds });

    const updatedCount = await notificationService.markAsRead(notificationIds);

    res.json({
      success: true,
      updatedCount,
      message: `${updatedCount} notifications marked as read`,
    });

  } catch (error: any) {
    logger.error('Failed to mark notifications as read', { error: error.message });

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to mark notifications as read',
    });
  }
});

/**
 * POST /api/notifications/test
 * Create a test notification (for development/testing)
 */
router.post('/test', async (req, res) => {
  try {
    const { orgId, type, message } = req.body;

    if (!orgId || !type || !message) {
      return res.status(400).json({
        success: false,
        error: 'orgId, type, and message are required',
      });
    }

    logger.info('Creating test notification', { orgId, type });

    const notification = await notificationService.createNotification({
      orgId,
      type,
      message,
      metadata: { test: true },
    });

    res.json({
      success: true,
      notification,
      message: 'Test notification created',
    });

  } catch (error: any) {
    logger.error('Failed to create test notification', { error: error.message });

    res.status(500).json({
      success: false,
      error: 'Failed to create test notification',
    });
  }
});

export default router;