import express from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { AutomationEngine } from '../automation/AutomationEngine.js';
import { PlatformManager } from '../platforms/PlatformManager.js';
import { CampaignService } from '../services/CampaignService.js';
import { AIAdvisor } from '../ai/modules/AIAdvisor.js';

const router = express.Router();
const automationEngine = new AutomationEngine();
const platformManager = new PlatformManager();
const campaignService = new CampaignService();
const aiAdvisor = new AIAdvisor();

// Validation schemas
const createCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  platform: z.enum(['META', 'GOOGLE', 'TIKTOK', 'LINKEDIN', 'TWITTER']),
  objective: z.enum(['AWARENESS', 'TRAFFIC', 'ENGAGEMENT', 'LEADS', 'SALES', 'APP_INSTALLS', 'VIDEO_VIEWS']),
  budget: z.number().positive(),
  dailyBudget: z.number().positive(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  targetAudience: z.object({
    demographics: z.object({
      ageMin: z.number().min(13).max(65).optional(),
      ageMax: z.number().min(13).max(65).optional(),
      gender: z.enum(['MALE', 'FEMALE', 'ALL']).optional(),
      locations: z.array(z.string()).optional(),
      languages: z.array(z.string()).optional()
    }),
    interests: z.array(z.string()).optional(),
    behaviors: z.array(z.string()).optional()
  }),
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
  })
});

const updateCampaignSchema = createCampaignSchema.partial();

/**
 * Create a new AI-powered campaign
 */
router.post('/', async (req, res) => {
  try {
    const validatedData = createCampaignSchema.parse(req.body);
    const orgId = req.user?.orgId;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    logger.info('Creating new AI-powered campaign', {
      name: validatedData.name,
      platform: validatedData.platform,
      objective: validatedData.objective,
      orgId
    });

    // Create campaign in database
    const campaign = await campaignService.createCampaign({
      ...validatedData,
      orgId,
      userId: req.user?.id,
      status: 'DRAFT'
    });

    // Configure platform connection
    await platformManager.configurePlatform({
      platform: validatedData.platform,
      accountId: req.user?.platformAccountId || '',
      accessToken: req.user?.platformAccessToken || '',
      settings: {
        apiVersion: '18.0',
        baseUrl: 'https://graph.facebook.com'
      }
    });

    // Generate AI-powered targeting strategy
    const targetingStrategy = await new TargetingOptimizer().generateTargetingStrategy({
      product: validatedData.name,
      targetAudience: JSON.stringify(validatedData.targetAudience),
      platform: validatedData.platform,
      objective: validatedData.objective,
      budget: validatedData.budget,
      duration: 30, // Default 30 days
      demographics: validatedData.targetAudience.demographics,
      interests: validatedData.targetAudience.interests || [],
      behaviors: validatedData.targetAudience.behaviors || []
    });

    // Generate AI-powered ad copy
    const adCopyVariations = await new AdCopyGenerator().generateAdCopy({
      product: validatedData.name,
      targetAudience: JSON.stringify(validatedData.targetAudience),
      painPoints: ['Generic pain point'], // This would come from product analysis
      benefits: ['Generic benefit'], // This would come from product analysis
      platform: validatedData.platform,
      objective: validatedData.objective
    });

    // Generate AI-powered creatives
    const creative = await new CreativeGenerator().generateCreative({
      product: validatedData.name,
      targetAudience: JSON.stringify(validatedData.targetAudience),
      platform: validatedData.platform,
      objective: validatedData.objective,
      adCopy: adCopyVariations[0]?.primaryText || '',
      brandGuidelines: {
        colors: ['#007bff', '#ffffff'],
        fonts: ['Arial', 'Helvetica'],
        style: 'modern',
        tone: 'professional'
      }
    });

    // Create campaign on platform
    const platformCampaignId = await platformManager.createCampaign(
      validatedData.platform,
      {
        id: campaign.id,
        name: campaign.name,
        status: 'DRAFT',
        objective: campaign.objective,
        budget: campaign.budget,
        dailyBudget: campaign.dailyBudget,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        settings: campaign.settings
      },
      targetingStrategy.audiences.map(audience => ({
        id: audience.id,
        campaignId: campaign.id,
        name: audience.name,
        status: 'ACTIVE',
        bidStrategy: targetingStrategy.bidStrategy.type,
        bidAmount: targetingStrategy.bidStrategy.amount,
        targeting: audience.demographics,
        placements: targetingStrategy.placements.map(p => p.placements).flat(),
        schedule: targetingStrategy.schedule
      })),
      [{
        id: creative.id,
        campaignId: campaign.id,
        name: creative.metadata.title,
        type: creative.type,
        format: creative.format,
        content: creative.metadata,
        assets: creative.assets,
        status: 'ACTIVE'
      }],
      targetingStrategy.audiences.map(audience => ({
        id: audience.id,
        campaignId: campaign.id,
        name: audience.name,
        type: audience.type,
        demographics: audience.demographics,
        interests: audience.interests,
        behaviors: audience.behaviors,
        size: audience.size,
        status: 'ACTIVE'
      }))
    );

    // Update campaign with platform ID
    await campaignService.updateCampaign(campaign.id, {
      platformId: platformCampaignId,
      status: 'ACTIVE'
    });

    // Start automation if enabled
    if (validatedData.aiSettings.performanceOptimization.enabled) {
      await automationEngine.runAutomation({
        orgId,
        campaignId: campaign.id,
        platform: validatedData.platform,
        objective: validatedData.objective,
        budget: validatedData.budget,
        duration: 30,
        rules: validatedData.rules,
        aiSettings: validatedData.aiSettings,
        userPreferences: {
          riskTolerance: 'MEDIUM',
          optimizationFrequency: 'DAILY',
          focusAreas: ['performance', 'efficiency'],
          excludedStrategies: [],
          budgetFlexibility: 'FLEXIBLE',
          notificationSettings: {
            email: true,
            push: true,
            sms: false,
            frequency: 'DAILY',
            types: ['insights', 'actions', 'alerts']
          }
        }
      });
    }

    res.status(201).json({
      success: true,
      campaign: {
        id: campaign.id,
        platformId: platformCampaignId,
        name: campaign.name,
        status: campaign.status,
        platform: campaign.platform,
        objective: campaign.objective,
        budget: campaign.budget,
        dailyBudget: campaign.dailyBudget,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        aiSettings: campaign.aiSettings,
        targetingStrategy: {
          audiences: targetingStrategy.audiences.length,
          placements: targetingStrategy.placements.length,
          confidence: targetingStrategy.confidence
        },
        adCopy: {
          variations: adCopyVariations.length,
          topConfidence: adCopyVariations[0]?.confidence
        },
        creative: {
          id: creative.id,
          type: creative.type,
          aiScore: creative.aiScore,
          confidence: creative.confidence
        }
      },
      message: 'AI-powered campaign created successfully'
    });

  } catch (error) {
    logger.error('Campaign creation failed', { error: error.message });
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Campaign creation failed',
      message: error.message
    });
  }
});

/**
 * Get all campaigns for organization
 */
router.get('/', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    const { status, platform, objective, page = 1, limit = 20 } = req.query;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    const campaigns = await campaignService.getCampaigns({
      orgId,
      status: status as string,
      platform: platform as string,
      objective: objective as string,
      page: parseInt(page as string),
      limit: parseInt(limit as string)
    });

    res.json({
      success: true,
      campaigns,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: campaigns.length
      }
    });

  } catch (error) {
    logger.error('Failed to get campaigns', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get campaigns'
    });
  }
});

/**
 * Get campaign details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user?.orgId;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    const campaign = await campaignService.getCampaign(id, orgId);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    // Get current performance
    const performance = await platformManager.getCampaignPerformance(
      campaign.platformId,
      campaign.platform
    );

    // Get AI insights
    const insights = await aiAdvisor.generateInsights({
      campaignId: campaign.id,
      orgId,
      platform: campaign.platform,
      objective: campaign.objective,
      currentPerformance: performance,
      historicalData: [],
      userPreferences: {
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
          types: ['insights']
        }
      }
    });

    res.json({
      success: true,
      campaign: {
        ...campaign,
        performance,
        insights: insights.slice(0, 5) // Top 5 insights
      }
    });

  } catch (error) {
    logger.error('Failed to get campaign details', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get campaign details'
    });
  }
});

/**
 * Update campaign
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateCampaignSchema.parse(req.body);
    const orgId = req.user?.orgId;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    const campaign = await campaignService.updateCampaign(id, validatedData);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    // Update on platform if needed
    if (campaign.platformId) {
      await platformManager.updateCampaign(
        campaign.platform,
        campaign.platformId,
        validatedData
      );
    }

    res.json({
      success: true,
      campaign,
      message: 'Campaign updated successfully'
    });

  } catch (error) {
    logger.error('Campaign update failed', { error: error.message });
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Campaign update failed'
    });
  }
});

/**
 * Pause campaign
 */
router.post('/:id/pause', async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user?.orgId;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    const campaign = await campaignService.getCampaign(id, orgId);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    // Pause on platform
    if (campaign.platformId) {
      await platformManager.pauseCampaign(campaign.platform, campaign.platformId);
    }

    // Update in database
    await campaignService.updateCampaign(id, { status: 'PAUSED' });

    res.json({
      success: true,
      message: 'Campaign paused successfully'
    });

  } catch (error) {
    logger.error('Campaign pause failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Campaign pause failed'
    });
  }
});

/**
 * Resume campaign
 */
router.post('/:id/resume', async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user?.orgId;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    const campaign = await campaignService.getCampaign(id, orgId);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    // Resume on platform
    if (campaign.platformId) {
      await platformManager.resumeCampaign(campaign.platform, campaign.platformId);
    }

    // Update in database
    await campaignService.updateCampaign(id, { status: 'ACTIVE' });

    res.json({
      success: true,
      message: 'Campaign resumed successfully'
    });

  } catch (error) {
    logger.error('Campaign resume failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Campaign resume failed'
    });
  }
});

/**
 * Delete campaign
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user?.orgId;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    const campaign = await campaignService.getCampaign(id, orgId);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    // Delete from platform
    if (campaign.platformId) {
      await platformManager.pauseCampaign(campaign.platform, campaign.platformId);
    }

    // Delete from database
    await campaignService.deleteCampaign(id);

    res.json({
      success: true,
      message: 'Campaign deleted successfully'
    });

  } catch (error) {
    logger.error('Campaign deletion failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Campaign deletion failed'
    });
  }
});

export { router as campaignRoutes };



