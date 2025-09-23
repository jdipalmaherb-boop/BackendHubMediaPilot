import express from 'express';
import { logger } from '../utils/logger.js';
import { PlatformManager } from '../platforms/PlatformManager.js';

const router = express.Router();
const platformManager = new PlatformManager();

/**
 * Get campaign performance analytics
 */
router.get('/campaign/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { startDate, endDate, platform } = req.query;
    const orgId = req.user?.orgId;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    if (!platform) {
      return res.status(400).json({
        success: false,
        error: 'Platform is required'
      });
    }

    const dateRange = startDate && endDate ? {
      start: new Date(startDate as string),
      end: new Date(endDate as string)
    } : undefined;

    const performance = await platformManager.getCampaignPerformance(
      campaignId,
      platform as string,
      dateRange
    );

    res.json({
      success: true,
      campaignId,
      platform,
      performance,
      dateRange
    });

  } catch (error) {
    logger.error('Failed to get campaign analytics', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get campaign analytics'
    });
  }
});

/**
 * Get organization analytics summary
 */
router.get('/summary', async (req, res) => {
  try {
    const { startDate, endDate, platform } = req.query;
    const orgId = req.user?.orgId;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    // This would aggregate analytics across all campaigns
    const summary = {
      totalCampaigns: 0,
      totalSpend: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      averageCtr: 0,
      averageCpc: 0,
      averageCpa: 0,
      averageRoas: 0,
      topPerformingCampaigns: [],
      platformBreakdown: {}
    };

    res.json({
      success: true,
      summary,
      dateRange: { startDate, endDate },
      platform
    });

  } catch (error) {
    logger.error('Failed to get analytics summary', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics summary'
    });
  }
});

export { router as analyticsRoutes };



