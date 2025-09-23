import express from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { AdCopyGenerator } from '../ai/modules/AdCopyGenerator.js';
import { CreativeGenerator } from '../ai/modules/CreativeGenerator.js';
import { TargetingOptimizer } from '../ai/modules/TargetingOptimizer.js';
import { AIAdvisor } from '../ai/modules/AIAdvisor.js';

const router = express.Router();
const adCopyGenerator = new AdCopyGenerator();
const creativeGenerator = new CreativeGenerator();
const targetingOptimizer = new TargetingOptimizer();
const aiAdvisor = new AIAdvisor();

// Validation schemas
const copyGenerationSchema = z.object({
  product: z.string().min(1).max(255),
  targetAudience: z.string().min(1),
  painPoints: z.array(z.string()).min(1),
  benefits: z.array(z.string()).min(1),
  platform: z.enum(['META', 'GOOGLE', 'TIKTOK', 'LINKEDIN', 'TWITTER']),
  objective: z.enum(['AWARENESS', 'TRAFFIC', 'ENGAGEMENT', 'LEADS', 'SALES', 'APP_INSTALLS', 'VIDEO_VIEWS']),
  brandVoice: z.string().optional(),
  previousPerformance: z.array(z.any()).optional(),
  competitorAnalysis: z.array(z.any()).optional()
});

const creativeGenerationSchema = z.object({
  product: z.string().min(1).max(255),
  targetAudience: z.string().min(1),
  platform: z.enum(['META', 'GOOGLE', 'TIKTOK', 'LINKEDIN', 'TWITTER']),
  objective: z.enum(['AWARENESS', 'TRAFFIC', 'ENGAGEMENT', 'LEADS', 'SALES', 'APP_INSTALLS', 'VIDEO_VIEWS']),
  adCopy: z.string().min(1),
  brandGuidelines: z.object({
    colors: z.array(z.string()).optional(),
    fonts: z.array(z.string()).optional(),
    logo: z.string().optional(),
    style: z.enum(['modern', 'classic', 'playful', 'professional', 'bold']).optional(),
    tone: z.enum(['serious', 'friendly', 'energetic', 'trustworthy', 'innovative']).optional()
  }).optional(),
  existingAssets: z.array(z.string()).optional(),
  budget: z.number().positive().optional()
});

const targetingSchema = z.object({
  product: z.string().min(1).max(255),
  targetAudience: z.string().min(1),
  platform: z.enum(['META', 'GOOGLE', 'TIKTOK', 'LINKEDIN', 'TWITTER']),
  objective: z.enum(['AWARENESS', 'TRAFFIC', 'ENGAGEMENT', 'LEADS', 'SALES', 'APP_INSTALLS', 'VIDEO_VIEWS']),
  budget: z.number().positive(),
  duration: z.number().positive(),
  demographics: z.object({
    ageMin: z.number().min(13).max(65).optional(),
    ageMax: z.number().min(13).max(65).optional(),
    gender: z.enum(['MALE', 'FEMALE', 'ALL']).optional(),
    locations: z.array(z.string()).optional(),
    languages: z.array(z.string()).optional(),
    education: z.array(z.string()).optional(),
    income: z.array(z.string()).optional(),
    relationshipStatus: z.array(z.string()).optional()
  }).optional(),
  interests: z.array(z.string()).optional(),
  behaviors: z.array(z.string()).optional(),
  competitorAnalysis: z.array(z.any()).optional(),
  marketResearch: z.array(z.any()).optional()
});

const insightsSchema = z.object({
  campaignId: z.string().cuid(),
  platform: z.enum(['META', 'GOOGLE', 'TIKTOK', 'LINKEDIN', 'TWITTER']),
  objective: z.enum(['AWARENESS', 'TRAFFIC', 'ENGAGEMENT', 'LEADS', 'SALES', 'APP_INSTALLS', 'VIDEO_VIEWS']),
  currentPerformance: z.object({
    impressions: z.number().min(0),
    clicks: z.number().min(0),
    conversions: z.number().min(0),
    spend: z.number().min(0),
    ctr: z.number().min(0).max(1),
    cpc: z.number().min(0),
    cpa: z.number().min(0),
    roas: z.number().min(0),
    engagementRate: z.number().min(0).max(1).optional(),
    videoViews: z.number().min(0).optional(),
    completionRate: z.number().min(0).max(1).optional()
  }),
  historicalData: z.array(z.any()).optional(),
  marketTrends: z.array(z.any()).optional(),
  competitorAnalysis: z.array(z.any()).optional(),
  userPreferences: z.object({
    riskTolerance: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    optimizationFrequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional(),
    focusAreas: z.array(z.string()).optional(),
    excludedStrategies: z.array(z.string()).optional(),
    budgetFlexibility: z.enum(['RIGID', 'FLEXIBLE', 'AGGRESSIVE']).optional()
  }).optional()
});

/**
 * Generate ad copy variations
 */
router.post('/copy/generate', async (req, res) => {
  try {
    const validatedData = copyGenerationSchema.parse(req.body);
    const orgId = req.user?.orgId;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    logger.info('Generating ad copy variations', {
      product: validatedData.product,
      platform: validatedData.platform,
      objective: validatedData.objective,
      orgId
    });

    const variations = await adCopyGenerator.generateAdCopy(validatedData);

    res.json({
      success: true,
      variations,
      count: variations.length,
      message: 'Ad copy variations generated successfully'
    });

  } catch (error) {
    logger.error('Ad copy generation failed', { error: error.message });
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Ad copy generation failed',
      message: error.message
    });
  }
});

/**
 * Analyze copy performance
 */
router.post('/copy/analyze', async (req, res) => {
  try {
    const { copyId, performance } = req.body;
    const orgId = req.user?.orgId;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    if (!copyId || !performance) {
      return res.status(400).json({
        success: false,
        error: 'Copy ID and performance data required'
      });
    }

    await adCopyGenerator.analyzeCopyPerformance(copyId, performance);

    res.json({
      success: true,
      message: 'Copy performance analyzed successfully'
    });

  } catch (error) {
    logger.error('Copy performance analysis failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Copy performance analysis failed'
    });
  }
});

/**
 * Get copy recommendations
 */
router.get('/copy/recommendations', async (req, res) => {
  try {
    const { platform, objective, targetAudience } = req.query;
    const orgId = req.user?.orgId;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    if (!platform || !objective || !targetAudience) {
      return res.status(400).json({
        success: false,
        error: 'Platform, objective, and target audience are required'
      });
    }

    const recommendations = await adCopyGenerator.getCopyRecommendations(
      platform as string,
      objective as string,
      targetAudience as string
    );

    res.json({
      success: true,
      recommendations,
      message: 'Copy recommendations retrieved successfully'
    });

  } catch (error) {
    logger.error('Failed to get copy recommendations', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get copy recommendations'
    });
  }
});

/**
 * Generate creative assets
 */
router.post('/creative/generate', async (req, res) => {
  try {
    const validatedData = creativeGenerationSchema.parse(req.body);
    const orgId = req.user?.orgId;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    logger.info('Generating creative assets', {
      product: validatedData.product,
      platform: validatedData.platform,
      objective: validatedData.objective,
      orgId
    });

    const creative = await creativeGenerator.generateCreative(validatedData);

    res.json({
      success: true,
      creative,
      message: 'Creative assets generated successfully'
    });

  } catch (error) {
    logger.error('Creative generation failed', { error: error.message });
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Creative generation failed',
      message: error.message
    });
  }
});

/**
 * Generate targeting strategy
 */
router.post('/targeting/generate', async (req, res) => {
  try {
    const validatedData = targetingSchema.parse(req.body);
    const orgId = req.user?.orgId;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    logger.info('Generating targeting strategy', {
      product: validatedData.product,
      platform: validatedData.platform,
      objective: validatedData.objective,
      orgId
    });

    const strategy = await targetingOptimizer.generateTargetingStrategy(validatedData);

    res.json({
      success: true,
      strategy,
      message: 'Targeting strategy generated successfully'
    });

  } catch (error) {
    logger.error('Targeting strategy generation failed', { error: error.message });
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Targeting strategy generation failed',
      message: error.message
    });
  }
});

/**
 * Generate AI insights
 */
router.post('/insights/generate', async (req, res) => {
  try {
    const validatedData = insightsSchema.parse(req.body);
    const orgId = req.user?.orgId;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    logger.info('Generating AI insights', {
      campaignId: validatedData.campaignId,
      platform: validatedData.platform,
      objective: validatedData.objective,
      orgId
    });

    const insights = await aiAdvisor.generateInsights({
      ...validatedData,
      orgId
    });

    res.json({
      success: true,
      insights,
      count: insights.length,
      message: 'AI insights generated successfully'
    });

  } catch (error) {
    logger.error('AI insights generation failed', { error: error.message });
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'AI insights generation failed',
      message: error.message
    });
  }
});

/**
 * Generate strategic recommendations
 */
router.post('/recommendations/generate', async (req, res) => {
  try {
    const validatedData = insightsSchema.parse(req.body);
    const orgId = req.user?.orgId;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    logger.info('Generating strategic recommendations', {
      campaignId: validatedData.campaignId,
      platform: validatedData.platform,
      objective: validatedData.objective,
      orgId
    });

    const recommendations = await aiAdvisor.generateStrategicRecommendations({
      ...validatedData,
      orgId
    });

    res.json({
      success: true,
      recommendations,
      count: recommendations.length,
      message: 'Strategic recommendations generated successfully'
    });

  } catch (error) {
    logger.error('Strategic recommendations generation failed', { error: error.message });
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Strategic recommendations generation failed',
      message: error.message
    });
  }
});

/**
 * Get AI model status
 */
router.get('/status', async (req, res) => {
  try {
    const orgId = req.user?.orgId;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    // This would check the status of all AI models
    const status = {
      adCopyGenerator: {
        status: 'ACTIVE',
        lastUpdated: new Date().toISOString(),
        version: '1.0.0'
      },
      creativeGenerator: {
        status: 'ACTIVE',
        lastUpdated: new Date().toISOString(),
        version: '1.0.0'
      },
      targetingOptimizer: {
        status: 'ACTIVE',
        lastUpdated: new Date().toISOString(),
        version: '1.0.0'
      },
      aiAdvisor: {
        status: 'ACTIVE',
        lastUpdated: new Date().toISOString(),
        version: '1.0.0'
      }
    };

    res.json({
      success: true,
      status,
      message: 'AI model status retrieved successfully'
    });

  } catch (error) {
    logger.error('Failed to get AI model status', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get AI model status'
    });
  }
});

/**
 * Test AI functionality
 */
router.post('/test', async (req, res) => {
  try {
    const { module, testData } = req.body;
    const orgId = req.user?.orgId;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    if (!module || !testData) {
      return res.status(400).json({
        success: false,
        error: 'Module and test data are required'
      });
    }

    let result;
    let testModule;

    switch (module) {
      case 'copy':
        testModule = adCopyGenerator;
        result = await testModule.generateAdCopy(testData);
        break;
      case 'creative':
        testModule = creativeGenerator;
        result = await testModule.generateCreative(testData);
        break;
      case 'targeting':
        testModule = targetingOptimizer;
        result = await testModule.generateTargetingStrategy(testData);
        break;
      case 'insights':
        testModule = aiAdvisor;
        result = await testModule.generateInsights({ ...testData, orgId });
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid module specified'
        });
    }

    res.json({
      success: true,
      module,
      result,
      message: 'AI module test completed successfully'
    });

  } catch (error) {
    logger.error('AI module test failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'AI module test failed',
      message: error.message
    });
  }
});

export { router as aiRoutes };



