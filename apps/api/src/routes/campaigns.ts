import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { enhancedSanitizePromptInput } from '../middleware/sanitize';
import { CampaignEngine, CampaignCreateRequest } from '../services/campaignEngine';
import { prisma } from '../lib/prisma';

const router = Router();
const campaignEngine = new CampaignEngine();

// Validation schemas
const createCampaignSchema = z.object({
  businessId: z.string().min(1, 'Business ID is required'),
  objective: z.enum(['traffic', 'conversions', 'awareness', 'engagement']),
  creativeKeys: z.array(z.string().min(1)).min(1, 'At least one creative key is required'),
  budgetTotalCents: z.number().int().min(1000, 'Minimum budget is $10'),
  platforms: z.array(z.enum(['meta', 'tiktok', 'youtube'])).min(1, 'At least one platform is required'),
  audience: z.object({
    ageMin: z.number().int().min(13).max(65).optional(),
    ageMax: z.number().int().min(13).max(65).optional(),
    genders: z.array(z.string()).optional(),
    locations: z.array(z.string()).optional(),
    interests: z.array(z.string()).optional(),
    behaviors: z.array(z.string()).optional(),
    customAudiences: z.array(z.string()).optional(),
  }),
  testGroups: z.number().int().min(2).max(5).optional(),
  testDurationDays: z.number().int().min(1).max(30).optional(),
  autoOptimize: z.boolean().optional(),
});

const createMultiCreativeCampaignSchema = z.object({
  businessId: z.string().min(1, 'Business ID is required'),
  objective: z.enum(['traffic', 'conversions', 'awareness', 'engagement']),
  creatives: z.array(z.object({
    creativeKey: z.string().min(1, 'Creative key is required'),
    platform: z.string().min(1, 'Platform is required'),
    postType: z.enum(['story', 'reel', 'carousel', 'feed', 'shorts', 'video']).optional(),
    exportStyle: z.enum(['square', 'portrait', 'landscape']).optional(),
    audienceSegment: z.string().optional(),
  })).min(1, 'At least one creative is required'),
  budgetTotalCents: z.number().int().min(1000, 'Minimum budget is $10'),
  platforms: z.array(z.enum(['meta', 'tiktok', 'youtube', 'instagram', 'facebook', 'linkedin'])).min(1, 'At least one platform is required'),
  audience: z.object({
    ageMin: z.number().int().min(13).max(65).optional(),
    ageMax: z.number().int().min(13).max(65).optional(),
    genders: z.array(z.string()).optional(),
    locations: z.array(z.string()).optional(),
    interests: z.array(z.string()).optional(),
    behaviors: z.array(z.string()).optional(),
    customAudiences: z.array(z.string()).optional(),
  }),
  testGroups: z.number().int().min(2).max(5).optional(),
  testDurationDays: z.number().int().min(1).max(30).optional(),
  autoOptimize: z.boolean().optional(),
});

const launchCampaignSchema = z.object({
  campaignId: z.string().uuid(),
});

const optimizeCampaignSchema = z.object({
  campaignId: z.string().uuid(),
});

/**
 * POST /api/campaigns/create
 * Create a new campaign with A/B test variants
 */
router.post('/create', requireAuth, enhancedSanitizePromptInput, async (req: Request, res: Response) => {
  try {
    const requestData = createCampaignSchema.parse(req.body);

    const result = await campaignEngine.createCampaign(req.user!.id, requestData);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Create campaign error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/campaigns/create-multi
 * Create a new campaign with multiple creatives and platform-specific format enforcement
 */
router.post('/create-multi', requireAuth, enhancedSanitizePromptInput, async (req: Request, res: Response) => {
  try {
    const requestData = createMultiCreativeCampaignSchema.parse(req.body);
    const userId = req.user!.id;

    // Create campaign
    const campaign = await prisma.campaign.create({
      data: {
        userId,
        businessId: requestData.businessId,
        name: `Campaign - ${new Date().toLocaleDateString()}`,
        objective: requestData.objective,
        budgetTotalCents: requestData.budgetTotalCents,
        budgetDaily: requestData.budgetTotalCents / (requestData.testDurationDays || 7) / 100, // Convert to dollars
        platforms: requestData.platforms,
        audience: requestData.audience as any,
        testGroups: requestData.testGroups || 3,
        testDurationDays: requestData.testDurationDays || 7,
        autoOptimize: requestData.autoOptimize ?? true,
        status: 'DRAFT',
      },
    });

    // Create creatives with platform-specific metadata
    const creatives = await Promise.all(
      requestData.creatives.map(async (creativeData) => {
        // Get video asset metadata if available
        const videoAsset = await prisma.videoAsset.findFirst({
          where: {
            ownerId: userId,
            originalUrl: { contains: creativeData.creativeKey },
          },
          select: {
            width: true,
            height: true,
            duration: true,
            meta: true,
          },
        });

        // Detect creative type
        const creativeType = videoAsset
          ? require('../lib/platformFormats').detectCreativeType(
              videoAsset.width || 0,
              videoAsset.height || 0,
              videoAsset.duration || undefined
            )
          : null;

        const aspectRatio = videoAsset && videoAsset.width && videoAsset.height
          ? require('../lib/platformFormats').getAspectRatioString(videoAsset.width, videoAsset.height)
          : null;

        return prisma.adCreative.create({
          data: {
            campaignId: campaign.id,
            ownerId: userId,
            originalUrl: creativeData.creativeKey,
            platform: creativeData.platform,
            postType: creativeData.postType || null,
            exportStyle: creativeData.exportStyle || null,
            audienceSegment: creativeData.audienceSegment || null,
            creativeType: creativeType as any,
            aspectRatio,
            width: videoAsset?.width || null,
            height: videoAsset?.height || null,
            duration: videoAsset?.duration || null,
          },
        });
      })
    );

    // Create variants for A/B testing
    const testGroups = requestData.testGroups || 3;
    const variantsPerGroup = Math.ceil(creatives.length / testGroups);
    const variants = [];

    for (let groupIndex = 0; groupIndex < testGroups; groupIndex++) {
      const groupName = String.fromCharCode(65 + groupIndex); // A, B, C, etc.
      const groupCreatives = creatives.slice(
        groupIndex * variantsPerGroup,
        (groupIndex + 1) * variantsPerGroup
      );

      for (const creative of groupCreatives) {
        const variant = await prisma.adVariant.create({
          data: {
            campaignId: campaign.id,
            variantName: `${groupName}-${creative.id.substring(0, 8)}`,
            creativeKey: creative.originalUrl,
            platform: creative.platform || requestData.platforms[0],
            budgetCents: Math.floor(requestData.budgetTotalCents / (testGroups * groupCreatives.length)),
            targeting: requestData.audience as any,
            testGroup: groupName,
            rolloutDay: groupIndex * (requestData.testDurationDays || 7) / testGroups,
            creativeId: creative.id,
            status: 'PENDING',
          },
        });
        variants.push(variant);
      }
    }

    // Log action
    await prisma.actionLog.create({
      data: {
        campaignId: campaign.id,
        actionType: 'campaign_created_multi',
        details: {
          creativesCount: creatives.length,
          platforms: requestData.platforms,
          testGroups,
        },
      },
    });

    res.json({
      success: true,
      data: {
        campaign: {
          id: campaign.id,
          name: campaign.name,
          objective: campaign.objective,
          budgetTotalCents: campaign.budgetTotalCents,
          platforms: campaign.platforms,
          status: campaign.status,
          testGroups: campaign.testGroups,
          testDurationDays: campaign.testDurationDays,
          autoOptimize: campaign.autoOptimize,
          createdAt: campaign.createdAt,
        },
        creatives: creatives.map(c => ({
          id: c.id,
          platform: c.platform,
          postType: c.postType,
          exportStyle: c.exportStyle,
          creativeType: c.creativeType,
          aspectRatio: c.aspectRatio,
        })),
        variants: variants.map(v => ({
          id: v.id,
          variantName: v.variantName,
          platform: v.platform,
          testGroup: v.testGroup,
          status: v.status,
        })),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
        code: 'VALIDATION_ERROR',
      });
    }

    console.error('Create multi-creative campaign error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /api/campaigns/launch
 * Launch a campaign (create actual ads on platforms)
 */
router.post('/launch', requireAuth, async (req: Request, res: Response) => {
  try {
    const { campaignId } = launchCampaignSchema.parse(req.body);

    // Verify campaign ownership
    const campaign = await prisma.campaign.findFirst({
      where: { 
        id: campaignId,
        userId: req.user!.id,
      },
    });

    if (!campaign) {
      return res.status(404).json({
        error: 'Campaign not found',
        code: 'CAMPAIGN_NOT_FOUND'
      });
    }

    await campaignEngine.launchCampaign(campaignId);

    res.json({
      success: true,
      message: 'Campaign launched successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Launch campaign error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/campaigns/optimize
 * Optimize campaign based on performance data
 */
router.post('/optimize', requireAuth, async (req: Request, res: Response) => {
  try {
    const { campaignId } = optimizeCampaignSchema.parse(req.body);

    // Verify campaign ownership
    const campaign = await prisma.campaign.findFirst({
      where: { 
        id: campaignId,
        userId: req.user!.id,
      },
    });

    if (!campaign) {
      return res.status(404).json({
        error: 'Campaign not found',
        code: 'CAMPAIGN_NOT_FOUND'
      });
    }

    await campaignEngine.optimizeCampaign(campaignId);

    res.json({
      success: true,
      message: 'Campaign optimization completed',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Optimize campaign error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/campaigns
 * Get user's campaigns with pagination
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const platform = req.query.platform as string;

    const where: any = { userId: req.user!.id };
    
    if (status) {
      where.status = status;
    }

    const campaigns = await prisma.campaign.findMany({
      where,
      include: {
        variants: {
          where: platform ? { platform } : undefined,
          select: {
            id: true,
            variantName: true,
            platform: true,
            status: true,
            budgetCents: true,
            testGroup: true,
            rolloutDay: true,
            externalId: true,
          },
        },
        _count: {
          select: {
            variants: true,
            metrics: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await prisma.campaign.count({ where });

    res.json({
      success: true,
      data: {
        campaigns,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get campaigns error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/campaigns/:id
 * Get detailed campaign information
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const campaignId = req.params.id;

    const campaign = await prisma.campaign.findFirst({
      where: { 
        id: campaignId,
        userId: req.user!.id,
      },
      include: {
        variants: {
          include: {
            metrics: {
              where: {
                date: {
                  gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
                },
              },
              orderBy: { date: 'desc' },
            },
          },
        },
        metrics: {
          where: {
            date: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
            },
          },
          orderBy: { date: 'desc' },
        },
      },
    });

    if (!campaign) {
      return res.status(404).json({
        error: 'Campaign not found',
        code: 'CAMPAIGN_NOT_FOUND'
      });
    }

    // Calculate performance summary
    const performanceSummary = campaign.variants.map(variant => {
      const actualMetrics = variant.metrics.filter(m => m.metricType === 'ACTUAL');
      const expectedMetrics = variant.metrics.filter(m => m.metricType === 'EXPECTED');

      const totalActualSpend = actualMetrics.reduce((sum, m) => sum + m.spendCents, 0);
      const totalActualConversions = actualMetrics.reduce((sum, m) => sum + m.conversions, 0);
      const totalActualClicks = actualMetrics.reduce((sum, m) => sum + m.clicks, 0);
      const totalActualImpressions = actualMetrics.reduce((sum, m) => sum + m.impressions, 0);

      const totalExpectedSpend = expectedMetrics.reduce((sum, m) => sum + m.spendCents, 0);
      const totalExpectedConversions = expectedMetrics.reduce((sum, m) => sum + m.conversions, 0);

      return {
        variantId: variant.id,
        variantName: variant.variantName,
        platform: variant.platform,
        testGroup: variant.testGroup,
        status: variant.status,
        budgetCents: variant.budgetCents,
        externalId: variant.externalId,
        performance: {
          actualSpendCents: totalActualSpend,
          actualConversions: totalActualConversions,
          actualClicks: totalActualClicks,
          actualImpressions: totalActualImpressions,
          expectedSpendCents: totalExpectedSpend,
          expectedConversions: totalExpectedConversions,
          cpl: totalActualSpend / Math.max(1, totalActualConversions),
          ctr: totalActualClicks / Math.max(1, totalActualImpressions) * 100,
          roas: totalActualConversions * 50 / Math.max(1, totalActualSpend), // Assume $50 value per conversion
        },
      };
    });

    res.json({
      success: true,
      data: {
        campaign: {
          id: campaign.id,
          name: campaign.name,
          objective: campaign.objective,
          budgetTotalCents: campaign.budgetTotalCents,
          platforms: campaign.platforms,
          audience: campaign.audience,
          status: campaign.status,
          testGroups: campaign.testGroups,
          testDurationDays: campaign.testDurationDays,
          autoOptimize: campaign.autoOptimize,
          createdAt: campaign.createdAt,
          updatedAt: campaign.updatedAt,
          startedAt: campaign.startedAt,
          completedAt: campaign.completedAt,
        },
        variants: performanceSummary,
        totalVariants: campaign.variants.length,
        totalMetrics: campaign.metrics.length,
      },
    });
  } catch (error) {
    console.error('Get campaign error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * PUT /api/campaigns/:id
 * Update campaign settings
 */
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const campaignId = req.params.id;
    const updateData = z.object({
      name: z.string().min(1).optional(),
      budgetTotalCents: z.number().int().min(1000).optional(),
      testDurationDays: z.number().int().min(1).max(30).optional(),
      autoOptimize: z.boolean().optional(),
    }).parse(req.body);

    // Verify campaign ownership
    const campaign = await prisma.campaign.findFirst({
      where: { 
        id: campaignId,
        userId: req.user!.id,
      },
    });

    if (!campaign) {
      return res.status(404).json({
        error: 'Campaign not found',
        code: 'CAMPAIGN_NOT_FOUND'
      });
    }

    if (campaign.status === 'ACTIVE') {
      return res.status(400).json({
        error: 'Cannot update active campaign',
        code: 'CAMPAIGN_ACTIVE'
      });
    }

    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: updateData,
    });

    res.json({
      success: true,
      data: updatedCampaign,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Update campaign error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * DELETE /api/campaigns/:id
 * Delete a campaign
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const campaignId = req.params.id;

    // Verify campaign ownership
    const campaign = await prisma.campaign.findFirst({
      where: { 
        id: campaignId,
        userId: req.user!.id,
      },
      include: { variants: true },
    });

    if (!campaign) {
      return res.status(404).json({
        error: 'Campaign not found',
        code: 'CAMPAIGN_NOT_FOUND'
      });
    }

    // If campaign is active, pause all variants first
    if (campaign.status === 'ACTIVE') {
      for (const variant of campaign.variants) {
        if (variant.externalId) {
          try {
            await campaignEngine.pauseVariant(variant.id);
          } catch (error) {
            console.error(`Failed to pause variant ${variant.id}:`, error);
          }
        }
      }
    }

    // Delete campaign (cascades to variants and metrics)
    await prisma.campaign.delete({
      where: { id: campaignId },
    });

    res.json({
      success: true,
      message: 'Campaign deleted successfully',
    });
  } catch (error) {
    console.error('Delete campaign error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/campaigns/:id/metrics
 * Get campaign metrics with filtering
 */
router.get('/:id/metrics', requireAuth, async (req: Request, res: Response) => {
  try {
    const campaignId = req.params.id;
    const variantId = req.query.variantId as string;
    const platform = req.query.platform as string;
    const metricType = req.query.metricType as string;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

    // Verify campaign ownership
    const campaign = await prisma.campaign.findFirst({
      where: { 
        id: campaignId,
        userId: req.user!.id,
      },
    });

    if (!campaign) {
      return res.status(404).json({
        error: 'Campaign not found',
        code: 'CAMPAIGN_NOT_FOUND'
      });
    }

    const where: any = {
      campaignId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (variantId) where.variantId = variantId;
    if (platform) where.platform = platform;
    if (metricType) where.metricType = metricType;

    const metrics = await prisma.campaignMetrics.findMany({
      where,
      include: {
        variant: {
          select: {
            id: true,
            variantName: true,
            platform: true,
            testGroup: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    // Aggregate metrics by date
    const aggregatedMetrics = metrics.reduce((acc, metric) => {
      const dateKey = metric.date.toISOString().split('T')[0];
      
      if (!acc[dateKey]) {
        acc[dateKey] = {
          date: dateKey,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          spendCents: 0,
          ctr: 0,
          cpc: 0,
          cpm: 0,
          cpl: 0,
          roas: 0,
          variants: {},
        };
      }

      acc[dateKey].impressions += metric.impressions;
      acc[dateKey].clicks += metric.clicks;
      acc[dateKey].conversions += metric.conversions;
      acc[dateKey].spendCents += metric.spendCents;

      // Store variant-specific metrics
      if (metric.variant) {
        const variantKey = `${metric.variant.platform}-${metric.variant.testGroup}`;
        if (!acc[dateKey].variants[variantKey]) {
          acc[dateKey].variants[variantKey] = {
            variantName: metric.variant.variantName,
            platform: metric.variant.platform,
            testGroup: metric.variant.testGroup,
            impressions: 0,
            clicks: 0,
            conversions: 0,
            spendCents: 0,
          };
        }
        
        acc[dateKey].variants[variantKey].impressions += metric.impressions;
        acc[dateKey].variants[variantKey].clicks += metric.clicks;
        acc[dateKey].variants[variantKey].conversions += metric.conversions;
        acc[dateKey].variants[variantKey].spendCents += metric.spendCents;
      }

      return acc;
    }, {} as any);

    // Calculate derived metrics
    Object.values(aggregatedMetrics).forEach((day: any) => {
      day.ctr = day.clicks / Math.max(1, day.impressions) * 100;
      day.cpc = day.spendCents / Math.max(1, day.clicks);
      day.cpm = day.spendCents / Math.max(1, day.impressions) * 1000;
      day.cpl = day.spendCents / Math.max(1, day.conversions);
      day.roas = day.conversions * 50 / Math.max(1, day.spendCents); // Assume $50 value per conversion
    });

    res.json({
      success: true,
      data: {
        metrics: Object.values(aggregatedMetrics),
        totalRecords: metrics.length,
        dateRange: {
          startDate,
          endDate,
        },
      },
    });
  } catch (error) {
    console.error('Get campaign metrics error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/campaigns/budget-recommendation
 * Get budget recommendation for a campaign
 */
router.get('/budget-recommendation', requireAuth, async (req: Request, res: Response) => {
  try {
    const requestData = z.object({
      objective: z.enum(['traffic', 'conversions', 'awareness', 'engagement']),
      platforms: z.array(z.enum(['meta', 'tiktok', 'youtube'])),
      audience: z.object({
        ageMin: z.number().int().min(13).max(65).optional(),
        ageMax: z.number().int().min(13).max(65).optional(),
        genders: z.array(z.string()).optional(),
        locations: z.array(z.string()).optional(),
        interests: z.array(z.string()).optional(),
        behaviors: z.array(z.string()).optional(),
        customAudiences: z.array(z.string()).optional(),
      }),
      budgetTotalCents: z.number().int().min(1000).optional(),
    }).parse(req.query);

    const recommendation = await campaignEngine.generateBudgetRecommendation(req.user!.id, {
      businessId: 'temp',
      objective: requestData.objective,
      creativeKeys: ['temp'],
      budgetTotalCents: requestData.budgetTotalCents || 10000,
      platforms: requestData.platforms,
      audience: requestData.audience,
    });

    res.json({
      success: true,
      data: recommendation,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Get budget recommendation error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

export default router;
