import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

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

    // Get notifications from database
    const notifications = await prisma.notification.findMany({
      where: { orgId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    // Count unread notifications
    const unreadCount = await prisma.notification.count({
      where: { 
        orgId,
        read: false 
      },
    });

    res.json({
      success: true,
      notifications: notifications.map(n => ({
        id: n.id,
        orgId: n.orgId,
        type: n.type,
        message: n.message,
        timestamp: n.timestamp.toISOString(),
        read: n.read,
        metadata: n.metadata,
      })),
      unreadCount,
    });

  } catch (error: any) {
    console.error('Failed to get notifications:', error);

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

    // Update notifications to mark as read
    const result = await prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
      },
      data: {
        read: true,
      },
    });

    res.json({
      success: true,
      updatedCount: result.count,
      message: `${result.count} notifications marked as read`,
    });

  } catch (error: any) {
    console.error('Failed to mark notifications as read:', error);

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
 * POST /api/notifications
 * Create a new notification
 */
router.post('/', async (req, res) => {
  try {
    const { orgId, type, message, metadata } = req.body;

    if (!orgId || !type || !message) {
      return res.status(400).json({
        success: false,
        error: 'orgId, type, and message are required',
      });
    }

    const notification = await prisma.notification.create({
      data: {
        orgId,
        type,
        message,
        metadata: metadata || {},
        read: false,
      },
    });

    res.json({
      success: true,
      notification: {
        id: notification.id,
        orgId: notification.orgId,
        type: notification.type,
        message: notification.message,
        timestamp: notification.timestamp.toISOString(),
        read: notification.read,
        metadata: notification.metadata,
      },
    });

  } catch (error: any) {
    console.error('Failed to create notification:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to create notification',
    });
  }
});

export default router;



