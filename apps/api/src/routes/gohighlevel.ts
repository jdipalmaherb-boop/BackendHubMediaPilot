import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { 
  enqueueLeadSync, 
  enqueueBatchLeadSync, 
  cancelLeadSync, 
  getSyncStatus, 
  getUserSyncHistory, 
  retryFailedSync,
  getGoHighLevelQueueHealth 
} from '../services/gohighlevel';
import { testGoHighLevelConnection } from '../workers/gohighlevelWorker';

const router = Router();

// Validation schemas
const enqueueSyncSchema = z.object({
  leadId: z.string().uuid('Invalid lead ID'),
  leadData: z.object({
    email: z.string().email('Invalid email'),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
    source: z.string().optional(),
    tags: z.array(z.string()).optional(),
    customFields: z.record(z.any()).optional(),
    locationId: z.string().optional(),
    campaignId: z.string().optional(),
  }),
  syncType: z.enum(['lead_create', 'lead_update', 'lead_tag', 'custom_field_update']).default('lead_create'),
  metadata: z.record(z.any()).optional(),
});

const batchSyncSchema = z.object({
  leads: z.array(z.object({
    leadId: z.string().uuid('Invalid lead ID'),
    leadData: z.object({
      email: z.string().email('Invalid email'),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      phone: z.string().optional(),
      source: z.string().optional(),
      tags: z.array(z.string()).optional(),
      customFields: z.record(z.any()).optional(),
      locationId: z.string().optional(),
      campaignId: z.string().optional(),
    }),
    syncType: z.enum(['lead_create', 'lead_update', 'lead_tag', 'custom_field_update']).default('lead_create'),
    metadata: z.record(z.any()).optional(),
  })).min(1, 'At least one lead is required'),
});

/**
 * POST /api/gohighlevel/sync
 * Enqueue a lead sync job
 */
router.post('/sync', requireAuth, async (req: Request, res: Response) => {
  try {
    const { leadId, leadData, syncType, metadata } = enqueueSyncSchema.parse(req.body);
    const userId = req.user!.id;

    // Verify lead ownership
    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        userId,
      },
    });

    if (!lead) {
      return res.status(404).json({
        error: 'Lead not found or access denied',
        code: 'LEAD_NOT_FOUND'
      });
    }

    const syncId = await enqueueLeadSync(leadId, userId, leadData, syncType, metadata);

    res.json({
      success: true,
      data: {
        syncId,
        leadId,
        syncType,
        status: 'queued',
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

    console.error('Enqueue sync error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/gohighlevel/sync/batch
 * Enqueue multiple lead sync jobs
 */
router.post('/sync/batch', requireAuth, async (req: Request, res: Response) => {
  try {
    const { leads } = batchSyncSchema.parse(req.body);
    const userId = req.user!.id;

    // Verify all leads belong to user
    const leadIds = leads.map(l => l.leadId);
    const userLeads = await prisma.lead.findMany({
      where: {
        id: { in: leadIds },
        userId,
      },
      select: { id: true },
    });

    const userLeadIds = new Set(userLeads.map(l => l.id));
    const invalidLeads = leadIds.filter(id => !userLeadIds.has(id));

    if (invalidLeads.length > 0) {
      return res.status(400).json({
        error: 'Some leads not found or access denied',
        invalidLeadIds: invalidLeads,
        code: 'INVALID_LEADS'
      });
    }

    const batchData = leads.map(lead => ({
      leadId: lead.leadId,
      userId,
      leadData: lead.leadData,
      syncType: lead.syncType,
      metadata: lead.metadata,
    }));

    const syncIds = await enqueueBatchLeadSync(batchData);

    res.json({
      success: true,
      data: {
        syncIds,
        totalRequested: leads.length,
        totalEnqueued: syncIds.length,
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

    console.error('Batch sync error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * DELETE /api/gohighlevel/sync/:id/cancel
 * Cancel a sync job
 */
router.delete('/sync/:id/cancel', requireAuth, async (req: Request, res: Response) => {
  try {
    const syncId = req.params.id;
    const userId = req.user!.id;

    // Verify sync ownership
    const syncRecord = await prisma.goHighLevelSync.findFirst({
      where: {
        id: syncId,
        lead: {
          userId,
        },
      },
    });

    if (!syncRecord) {
      return res.status(404).json({
        error: 'Sync record not found',
        code: 'SYNC_NOT_FOUND'
      });
    }

    const cancelled = await cancelLeadSync(syncId);

    res.json({
      success: true,
      data: {
        syncId,
        cancelled,
      },
    });
  } catch (error) {
    console.error('Cancel sync error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/gohighlevel/sync/:id/status
 * Get sync status
 */
router.get('/sync/:id/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const syncId = req.params.id;
    const userId = req.user!.id;

    // Verify sync ownership
    const syncRecord = await prisma.goHighLevelSync.findFirst({
      where: {
        id: syncId,
        lead: {
          userId,
        },
      },
    });

    if (!syncRecord) {
      return res.status(404).json({
        error: 'Sync record not found',
        code: 'SYNC_NOT_FOUND'
      });
    }

    const status = await getSyncStatus(syncId);

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Get sync status error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/gohighlevel/sync/history
 * Get user's sync history
 */
router.get('/sync/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;

    const history = await getUserSyncHistory(userId, page, limit, status);

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('Get sync history error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/gohighlevel/sync/:id/retry
 * Retry a failed sync
 */
router.post('/sync/:id/retry', requireAuth, async (req: Request, res: Response) => {
  try {
    const syncId = req.params.id;
    const userId = req.user!.id;

    // Verify sync ownership
    const syncRecord = await prisma.goHighLevelSync.findFirst({
      where: {
        id: syncId,
        lead: {
          userId,
        },
      },
    });

    if (!syncRecord) {
      return res.status(404).json({
        error: 'Sync record not found',
        code: 'SYNC_NOT_FOUND'
      });
    }

    const retried = await retryFailedSync(syncId);

    res.json({
      success: true,
      data: {
        syncId,
        retried,
      },
    });
  } catch (error) {
    console.error('Retry sync error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/gohighlevel/health
 * Get GoHighLevel integration health
 */
router.get('/health', requireAuth, async (req: Request, res: Response) => {
  try {
    const queueHealth = await getGoHighLevelQueueHealth();
    const connectionTest = await testGoHighLevelConnection();

    res.json({
      success: true,
      data: {
        queue: queueHealth,
        connection: connectionTest,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/gohighlevel/test-connection
 * Test GoHighLevel API connection
 */
router.post('/test-connection', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await testGoHighLevelConnection();

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Test connection error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

export default router;
