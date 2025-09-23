import express from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { AutomationEngine } from '../automation/AutomationEngine.js';
import { CampaignService } from '../services/CampaignService.js';

const router = express.Router();
const automationEngine = new AutomationEngine();
const campaignService = new CampaignService();

// Validation schemas
const automationConfigSchema = z.object({
  campaignId: z.string().cuid(),
  aiSettings: z.object({
    copyGeneration: z.object({
      enabled: z.boolean(),
      frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
      variations: z.number().min(1).max(10)
    }),
    creativeGeneration: z.object({
      enabled: z.boolean(),
      frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
      variations: z.number().min(1).max(10)
    }),
    targetingOptimization: z.object({
      enabled: z.boolean(),
      frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY'])
    }),
    performanceOptimization: z.object({
      enabled: z.boolean(),
      frequency: z.enum(['HOURLY', 'DAILY', 'WEEKLY']),
      autoApply: z.boolean(),
      confidenceThreshold: z.number().min(0).max(1)
    }),
    learningEnabled: z.boolean(),
    abTestingEnabled: z.boolean()
  }),
  rules: z.object({
    maxDailySpend: z.number().positive(),
    minCtr: z.number().min(0).max(1),
    maxCpc: z.number().positive(),
    minRoas: z.number().positive(),
    maxCpa: z.number().positive(),
    allowedPlacements: z.array(z.string()),
    allowedAudiences: z.array(z.string()),
    pauseConditions: z.array(z.object({
      metric: z.string(),
      operator: z.enum(['LESS_THAN', 'GREATER_THAN', 'EQUALS']),
      value: z.number(),
      duration: z.number(),
      action: z.enum(['PAUSE_CAMPAIGN', 'PAUSE_ADGROUP', 'PAUSE_CREATIVE'])
    })),
    scaleConditions: z.array(z.object({
      metric: z.string(),
      operator: z.enum(['GREATER_THAN', 'EQUALS']),
      value: z.number(),
      duration: z.number(),
      action: z.enum(['INCREASE_BUDGET', 'EXPAND_AUDIENCE', 'ADD_CREATIVES']),
      maxIncrease: z.number().min(0).max(100)
    }))
  }),
  userPreferences: z.object({
    riskTolerance: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    optimizationFrequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
    focusAreas: z.array(z.string()),
    excludedStrategies: z.array(z.string()),
    budgetFlexibility: z.enum(['RIGID', 'FLEXIBLE', 'AGGRESSIVE']),
    notificationSettings: z.object({
      email: z.boolean(),
      push: z.boolean(),
      sms: z.boolean(),
      frequency: z.enum(['IMMEDIATE', 'DAILY', 'WEEKLY']),
      types: z.array(z.string())
    })
  })
});

/**
 * Start automation for a campaign
 */
router.post('/start', async (req, res) => {
  try {
    const validatedData = automationConfigSchema.parse(req.body);
    const orgId = req.user?.orgId;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    // Get campaign details
    const campaign = await campaignService.getCampaign(validatedData.campaignId, orgId);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    logger.info('Starting automation for campaign', {
      campaignId: validatedData.campaignId,
      orgId
    });

    // Run automation
    const result = await automationEngine.runAutomation({
      orgId,
      campaignId: validatedData.campaignId,
      platform: campaign.platform,
      objective: campaign.objective,
      budget: campaign.budget,
      duration: 30, // Default duration
      rules: validatedData.rules,
      aiSettings: validatedData.aiSettings,
      userPreferences: validatedData.userPreferences
    });

    // Update campaign with automation settings
    await campaignService.updateCampaign(validatedData.campaignId, {
      aiSettings: validatedData.aiSettings,
      automationEnabled: true,
      lastAutomationRun: new Date()
    });

    res.json({
      success: true,
      automation: {
        campaignId: validatedData.campaignId,
        status: result.success ? 'ACTIVE' : 'FAILED',
        actions: result.actions.length,
        insights: result.insights.length,
        recommendations: result.recommendations.length,
        nextRun: result.nextRun,
        errors: result.errors
      },
      message: 'Automation started successfully'
    });

  } catch (error) {
    logger.error('Automation start failed', { error: error.message });
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Automation start failed',
      message: error.message
    });
  }
});

/**
 * Stop automation for a campaign
 */
router.post('/stop/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const orgId = req.user?.orgId;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    // Get campaign details
    const campaign = await campaignService.getCampaign(campaignId, orgId);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    logger.info('Stopping automation for campaign', {
      campaignId,
      orgId
    });

    // Update campaign to disable automation
    await campaignService.updateCampaign(campaignId, {
      automationEnabled: false,
      lastAutomationRun: new Date()
    });

    res.json({
      success: true,
      message: 'Automation stopped successfully'
    });

  } catch (error) {
    logger.error('Automation stop failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Automation stop failed'
    });
  }
});

/**
 * Get automation status for a campaign
 */
router.get('/status/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const orgId = req.user?.orgId;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    // Get campaign details
    const campaign = await campaignService.getCampaign(campaignId, orgId);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    // Get automation history
    const automationHistory = await campaignService.getAutomationHistory(campaignId);

    res.json({
      success: true,
      automation: {
        campaignId,
        enabled: campaign.automationEnabled || false,
        aiSettings: campaign.aiSettings,
        lastRun: campaign.lastAutomationRun,
        nextRun: campaign.nextAutomationRun,
        history: automationHistory
      }
    });

  } catch (error) {
    logger.error('Failed to get automation status', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get automation status'
    });
  }
});

/**
 * Update automation settings
 */
router.put('/settings/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const validatedData = automationConfigSchema.pick({
      aiSettings: true,
      rules: true,
      userPreferences: true
    }).parse(req.body);
    const orgId = req.user?.orgId;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    // Get campaign details
    const campaign = await campaignService.getCampaign(campaignId, orgId);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    logger.info('Updating automation settings', {
      campaignId,
      orgId
    });

    // Update campaign with new settings
    await campaignService.updateCampaign(campaignId, {
      aiSettings: validatedData.aiSettings,
      rules: validatedData.rules,
      userPreferences: validatedData.userPreferences
    });

    res.json({
      success: true,
      message: 'Automation settings updated successfully'
    });

  } catch (error) {
    logger.error('Automation settings update failed', { error: error.message });
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Automation settings update failed'
    });
  }
});

/**
 * Run manual automation cycle
 */
router.post('/run/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const orgId = req.user?.orgId;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    // Get campaign details
    const campaign = await campaignService.getCampaign(campaignId, orgId);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    logger.info('Running manual automation cycle', {
      campaignId,
      orgId
    });

    // Run automation
    const result = await automationEngine.runAutomation({
      orgId,
      campaignId,
      platform: campaign.platform,
      objective: campaign.objective,
      budget: campaign.budget,
      duration: 30,
      rules: campaign.rules || {},
      aiSettings: campaign.aiSettings || {},
      userPreferences: campaign.userPreferences || {
        riskTolerance: 'MEDIUM',
        optimizationFrequency: 'DAILY',
        focusAreas: ['performance'],
        excludedStrategies: [],
        budgetFlexibility: 'FLEXIBLE',
        notificationSettings: {
          email: true,
          push: true,
          sms: false,
          frequency: 'DAILY',
          types: ['insights', 'actions']
        }
      }
    });

    res.json({
      success: true,
      result: {
        actions: result.actions,
        insights: result.insights,
        recommendations: result.recommendations,
        errors: result.errors
      },
      message: 'Manual automation cycle completed'
    });

  } catch (error) {
    logger.error('Manual automation run failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Manual automation run failed'
    });
  }
});

/**
 * Get automation insights
 */
router.get('/insights/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { limit = 10 } = req.query;
    const orgId = req.user?.orgId;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    // Get campaign details
    const campaign = await campaignService.getCampaign(campaignId, orgId);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    // Get automation insights
    const insights = await campaignService.getAutomationInsights(campaignId, parseInt(limit as string));

    res.json({
      success: true,
      insights,
      message: 'Automation insights retrieved successfully'
    });

  } catch (error) {
    logger.error('Failed to get automation insights', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get automation insights'
    });
  }
});

/**
 * Get automation recommendations
 */
router.get('/recommendations/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { limit = 5 } = req.query;
    const orgId = req.user?.orgId;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    // Get campaign details
    const campaign = await campaignService.getCampaign(campaignId, orgId);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    // Get automation recommendations
    const recommendations = await campaignService.getAutomationRecommendations(campaignId, parseInt(limit as string));

    res.json({
      success: true,
      recommendations,
      message: 'Automation recommendations retrieved successfully'
    });

  } catch (error) {
    logger.error('Failed to get automation recommendations', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get automation recommendations'
    });
  }
});

export { router as automationRoutes };



