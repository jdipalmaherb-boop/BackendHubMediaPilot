import { CampaignEngine, CampaignCreateRequest } from '../../services/campaignEngine';
import { prisma } from '../../lib/prisma';
import { callGPT } from '../../services/gpt5';

// Mock dependencies
jest.mock('../../lib/prisma', () => ({
  prisma: {
    campaign: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    adVariant: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    campaignMetrics: {
      createMany: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../services/gpt5', () => ({
  callGPT: jest.fn(),
}));

jest.mock('../../ad/mockAdapter', () => ({
  MockAdapter: jest.fn().mockImplementation(() => ({
    createCampaign: jest.fn().mockResolvedValue({ id: 'mock-campaign-123' }),
    updateCampaign: jest.fn().mockResolvedValue(undefined),
    pauseCampaign: jest.fn().mockResolvedValue(undefined),
    resumeCampaign: jest.fn().mockResolvedValue(undefined),
    getCampaignStatus: jest.fn().mockResolvedValue({
      id: 'mock-campaign-123',
      status: 'active',
      budgetSpentCents: 1000,
      impressions: 1000,
      clicks: 20,
      conversions: 2,
      ctr: 2.0,
      cpc: 0.5,
      cpm: 10.0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    deleteCampaign: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../ad/metaAdapter', () => ({
  MetaAdapter: jest.fn().mockImplementation(() => ({
    createCampaign: jest.fn().mockResolvedValue({ id: 'meta-campaign-123' }),
    updateCampaign: jest.fn().mockResolvedValue(undefined),
    pauseCampaign: jest.fn().mockResolvedValue(undefined),
    resumeCampaign: jest.fn().mockResolvedValue(undefined),
    getCampaignStatus: jest.fn().mockResolvedValue({
      id: 'meta-campaign-123',
      status: 'active',
      budgetSpentCents: 1000,
      impressions: 1000,
      clicks: 20,
      conversions: 2,
      ctr: 2.0,
      cpc: 0.5,
      cpm: 10.0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    deleteCampaign: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../ad/tiktokAdapter', () => ({
  TikTokAdapter: jest.fn().mockImplementation(() => ({
    createCampaign: jest.fn().mockResolvedValue({ id: 'tiktok-campaign-123' }),
    updateCampaign: jest.fn().mockResolvedValue(undefined),
    pauseCampaign: jest.fn().mockResolvedValue(undefined),
    resumeCampaign: jest.fn().mockResolvedValue(undefined),
    getCampaignStatus: jest.fn().mockResolvedValue({
      id: 'tiktok-campaign-123',
      status: 'active',
      budgetSpentCents: 1000,
      impressions: 1000,
      clicks: 20,
      conversions: 2,
      ctr: 2.0,
      cpc: 0.5,
      cpm: 10.0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    deleteCampaign: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../ad/youtubeAdapter', () => ({
  YouTubeAdapter: jest.fn().mockImplementation(() => ({
    createCampaign: jest.fn().mockResolvedValue({ id: 'youtube-campaign-123' }),
    updateCampaign: jest.fn().mockResolvedValue(undefined),
    pauseCampaign: jest.fn().mockResolvedValue(undefined),
    resumeCampaign: jest.fn().mockResolvedValue(undefined),
    getCampaignStatus: jest.fn().mockResolvedValue({
      id: 'youtube-campaign-123',
      status: 'active',
      budgetSpentCents: 1000,
      impressions: 1000,
      clicks: 20,
      conversions: 2,
      ctr: 2.0,
      cpc: 0.5,
      cpm: 10.0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    deleteCampaign: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('CampaignEngine', () => {
  let campaignEngine: CampaignEngine;
  const mockUserId = 'test-user-id';

  beforeEach(() => {
    jest.clearAllMocks();
    campaignEngine = new CampaignEngine();
  });

  describe('createCampaign', () => {
    const mockRequest: CampaignCreateRequest = {
      businessId: 'test-business',
      objective: 'traffic',
      creativeKeys: ['creative1.jpg', 'creative2.jpg'],
      budgetTotalCents: 30000, // $300
      platforms: ['meta', 'tiktok'],
      audience: {
        ageMin: 25,
        ageMax: 45,
        genders: ['all'],
        locations: ['US'],
        interests: ['technology'],
      },
      testGroups: 3,
      testDurationDays: 7,
      autoOptimize: true,
    };

    it('should create a campaign with variants successfully', async () => {
      // Mock GPT responses
      (callGPT as jest.Mock)
        .mockResolvedValueOnce({
          content: '{"name": "Test Campaign"}',
          tokensUsed: 50,
          estimatedCost: 0.001,
          model: 'gpt-5-thinking-mini',
          fallbackUsed: false,
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({
            variants: [
              {
                variantName: 'A',
                creativeKey: 'creative1.jpg',
                platform: 'meta',
                budgetCents: 10000,
                targeting: { ageMin: 25, ageMax: 45 },
                testGroup: 'A',
                rolloutDay: 0,
              },
              {
                variantName: 'B',
                creativeKey: 'creative2.jpg',
                platform: 'tiktok',
                budgetCents: 10000,
                targeting: { ageMin: 25, ageMax: 45 },
                testGroup: 'B',
                rolloutDay: 2,
              },
            ],
          }),
          tokensUsed: 200,
          estimatedCost: 0.004,
          model: 'gpt-5-thinking-mini',
          fallbackUsed: false,
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({
            suggestedBudgetCents: 30000,
            dailyBudgetCents: 1000,
            platformAllocation: { meta: 0.5, tiktok: 0.5 },
            reasoning: 'Balanced allocation for traffic objective',
            riskLevel: 'low',
            expectedMetrics: {
              impressions: 5000,
              clicks: 100,
              conversions: 5,
              ctr: 2.0,
              cpc: 0.3,
              cpm: 6.0,
            },
          }),
          tokensUsed: 150,
          estimatedCost: 0.003,
          model: 'gpt-5-thinking-mini',
          fallbackUsed: false,
        });

      // Mock Prisma responses
      const mockCampaign = {
        id: 'campaign-123',
        userId: mockUserId,
        businessId: 'test-business',
        name: 'Test Campaign',
        objective: 'traffic',
        budgetTotalCents: 30000,
        platforms: ['meta', 'tiktok'],
        audience: mockRequest.audience,
        status: 'DRAFT',
        testGroups: 3,
        testDurationDays: 7,
        autoOptimize: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: null,
        completedAt: null,
      };

      const mockVariants = [
        {
          id: 'variant-1',
          campaignId: 'campaign-123',
          variantName: 'A',
          creativeKey: 'creative1.jpg',
          platform: 'meta',
          budgetCents: 10000,
          targeting: { ageMin: 25, ageMax: 45 },
          externalId: null,
          status: 'PENDING',
          testGroup: 'A',
          rolloutDay: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'variant-2',
          campaignId: 'campaign-123',
          variantName: 'B',
          creativeKey: 'creative2.jpg',
          platform: 'tiktok',
          budgetCents: 10000,
          targeting: { ageMin: 25, ageMax: 45 },
          externalId: null,
          status: 'PENDING',
          testGroup: 'B',
          rolloutDay: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.campaign.create as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.adVariant.create as jest.Mock)
        .mockResolvedValueOnce(mockVariants[0])
        .mockResolvedValueOnce(mockVariants[1]);
      (prisma.campaignMetrics.createMany as jest.Mock).mockResolvedValue({ count: 60 });

      const result = await campaignEngine.createCampaign(mockUserId, mockRequest);

      expect(result.campaign.id).toBe('campaign-123');
      expect(result.campaign.name).toBe('Test Campaign');
      expect(result.campaign.objective).toBe('traffic');
      expect(result.campaign.budgetTotalCents).toBe(30000);
      expect(result.variants).toHaveLength(2);
      expect(result.budgetRecommendation.suggestedBudgetCents).toBe(30000);
      expect(result.budgetRecommendation.platformAllocation.meta).toBe(0.5);
      expect(result.budgetRecommendation.platformAllocation.tiktok).toBe(0.5);

      expect(prisma.campaign.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          businessId: 'test-business',
          name: 'Test Campaign',
          objective: 'traffic',
          budgetTotalCents: 30000,
          platforms: ['meta', 'tiktok'],
          audience: mockRequest.audience,
          status: 'DRAFT',
          testGroups: 3,
          testDurationDays: 7,
          autoOptimize: true,
        }),
      });

      expect(prisma.adVariant.create).toHaveBeenCalledTimes(2);
      expect(prisma.campaignMetrics.createMany).toHaveBeenCalled();
    });

    it('should handle GPT API failures gracefully', async () => {
      (callGPT as jest.Mock)
        .mockRejectedValueOnce(new Error('GPT API error'))
        .mockRejectedValueOnce(new Error('GPT API error'))
        .mockRejectedValueOnce(new Error('GPT API error'));

      const mockCampaign = {
        id: 'campaign-123',
        userId: mockUserId,
        businessId: 'test-business',
        name: 'Campaign 1234567890', // Fallback name
        objective: 'traffic',
        budgetTotalCents: 30000,
        platforms: ['meta', 'tiktok'],
        audience: mockRequest.audience,
        status: 'DRAFT',
        testGroups: 3,
        testDurationDays: 7,
        autoOptimize: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: null,
        completedAt: null,
      };

      const mockVariants = [
        {
          id: 'variant-1',
          campaignId: 'campaign-123',
          variantName: 'A-meta',
          creativeKey: 'creative1.jpg',
          platform: 'meta',
          budgetCents: 15000,
          targeting: expect.any(Object),
          externalId: null,
          status: 'PENDING',
          testGroup: 'A',
          rolloutDay: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'variant-2',
          campaignId: 'campaign-123',
          variantName: 'A-tiktok',
          creativeKey: 'creative1.jpg',
          platform: 'tiktok',
          budgetCents: 15000,
          targeting: expect.any(Object),
          externalId: null,
          status: 'PENDING',
          testGroup: 'A',
          rolloutDay: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.campaign.create as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.adVariant.create as jest.Mock)
        .mockResolvedValueOnce(mockVariants[0])
        .mockResolvedValueOnce(mockVariants[1]);
      (prisma.campaignMetrics.createMany as jest.Mock).mockResolvedValue({ count: 60 });

      const result = await campaignEngine.createCampaign(mockUserId, mockRequest);

      expect(result.campaign.name).toMatch(/Campaign \d+/); // Fallback name pattern
      expect(result.variants).toHaveLength(2);
      expect(result.budgetRecommendation.reasoning).toBe('Conservative budget recommendation based on platform minimums');
    });

    it('should validate user subscription limits', async () => {
      const mockUser = {
        id: mockUserId,
        subscriptions: [], // No active subscription (free tier)
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const freeTierRequest = {
        ...mockRequest,
        budgetTotalCents: 60000, // $600 - exceeds free tier limit
      };

      await expect(campaignEngine.createCampaign(mockUserId, freeTierRequest))
        .rejects.toThrow('Budget exceeds free tier limit of $500');
    });

    it('should validate monthly spending limits', async () => {
      const mockUser = {
        id: mockUserId,
        subscriptions: [], // Free tier
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.campaignMetrics.aggregate as jest.Mock).mockResolvedValue({
        _sum: { spendCents: 80000 }, // $800 already spent
      });

      const requestExceedingLimit = {
        ...mockRequest,
        budgetTotalCents: 30000, // $300 - would exceed $1000 monthly limit
      };

      await expect(campaignEngine.createCampaign(mockUserId, requestExceedingLimit))
        .rejects.toThrow('Campaign would exceed monthly spending limit of $100');
    });
  });

  describe('generateBudgetRecommendation', () => {
    it('should generate budget recommendation using GPT-5', async () => {
      const mockRequest: CampaignCreateRequest = {
        businessId: 'test-business',
        objective: 'conversions',
        creativeKeys: ['creative1.jpg'],
        budgetTotalCents: 50000,
        platforms: ['meta'],
        audience: {
          ageMin: 25,
          ageMax: 45,
          interests: ['technology'],
        },
      };

      (callGPT as jest.Mock).mockResolvedValue({
        content: JSON.stringify({
          suggestedBudgetCents: 50000,
          dailyBudgetCents: 1667,
          platformAllocation: { meta: 1.0 },
          reasoning: 'Optimal budget for conversions objective',
          riskLevel: 'medium',
          expectedMetrics: {
            impressions: 10000,
            clicks: 200,
            conversions: 20,
            ctr: 2.0,
            cpc: 0.83,
            cpm: 8.33,
          },
        }),
        tokensUsed: 200,
        estimatedCost: 0.004,
        model: 'gpt-5-thinking-mini',
        fallbackUsed: false,
      });

      const recommendation = await campaignEngine.generateBudgetRecommendation(mockUserId, mockRequest);

      expect(recommendation.suggestedBudgetCents).toBe(50000);
      expect(recommendation.dailyBudgetCents).toBe(1667);
      expect(recommendation.platformAllocation.meta).toBe(1.0);
      expect(recommendation.reasoning).toBe('Optimal budget for conversions objective');
      expect(recommendation.riskLevel).toBe('medium');
      expect(recommendation.expectedMetrics.impressions).toBe(10000);
    });

    it('should fallback to default recommendation on GPT failure', async () => {
      const mockRequest: CampaignCreateRequest = {
        businessId: 'test-business',
        objective: 'awareness',
        creativeKeys: ['creative1.jpg'],
        budgetTotalCents: 20000,
        platforms: ['meta', 'tiktok'],
        audience: {
          ageMin: 18,
          ageMax: 35,
        },
      };

      (callGPT as jest.Mock).mockRejectedValue(new Error('GPT API error'));

      const recommendation = await campaignEngine.generateBudgetRecommendation(mockUserId, mockRequest);

      expect(recommendation.suggestedBudgetCents).toBe(20000);
      expect(recommendation.dailyBudgetCents).toBe(667);
      expect(recommendation.platformAllocation.meta).toBe(0.5);
      expect(recommendation.platformAllocation.tiktok).toBe(0.5);
      expect(recommendation.reasoning).toBe('Conservative budget recommendation based on platform minimums');
      expect(recommendation.riskLevel).toBe('low');
    });
  });

  describe('launchCampaign', () => {
    it('should launch campaign and create ads on platforms', async () => {
      const mockCampaign = {
        id: 'campaign-123',
        userId: mockUserId,
        businessId: 'test-business',
        name: 'Test Campaign',
        objective: 'traffic',
        budgetTotalCents: 30000,
        platforms: ['meta', 'tiktok'],
        audience: {},
        status: 'DRAFT',
        testGroups: 3,
        testDurationDays: 7,
        autoOptimize: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: null,
        completedAt: null,
        variants: [
          {
            id: 'variant-1',
            campaignId: 'campaign-123',
            variantName: 'A',
            creativeKey: 'creative1.jpg',
            platform: 'meta',
            budgetCents: 10000,
            targeting: {},
            externalId: null,
            status: 'PENDING',
            testGroup: 'A',
            rolloutDay: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'variant-2',
            campaignId: 'campaign-123',
            variantName: 'B',
            creativeKey: 'creative2.jpg',
            platform: 'tiktok',
            budgetCents: 10000,
            targeting: {},
            externalId: null,
            status: 'PENDING',
            testGroup: 'B',
            rolloutDay: 2,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.campaign.update as jest.Mock).mockResolvedValue({
        ...mockCampaign,
        status: 'ACTIVE',
        startedAt: new Date(),
      });
      (prisma.adVariant.update as jest.Mock).mockResolvedValue({
        ...mockCampaign.variants[0],
        externalId: 'mock-campaign-123',
        status: 'ACTIVE',
      });

      await campaignEngine.launchCampaign('campaign-123');

      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: 'campaign-123' },
        data: {
          status: 'ACTIVE',
          startedAt: expect.any(Date),
        },
      });

      expect(prisma.adVariant.update).toHaveBeenCalledWith({
        where: { id: 'variant-1' },
        data: {
          externalId: 'mock-campaign-123',
          status: 'ACTIVE',
        },
      });
    });

    it('should throw error for non-existent campaign', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(campaignEngine.launchCampaign('non-existent'))
        .rejects.toThrow('Campaign not found');
    });

    it('should throw error for non-draft campaign', async () => {
      const mockCampaign = {
        id: 'campaign-123',
        status: 'ACTIVE',
        variants: [],
      };

      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(mockCampaign);

      await expect(campaignEngine.launchCampaign('campaign-123'))
        .rejects.toThrow('Campaign must be in DRAFT status to launch');
    });
  });

  describe('optimizeCampaign', () => {
    it('should optimize campaign by pausing losers and scaling winners', async () => {
      const mockCampaign = {
        id: 'campaign-123',
        userId: mockUserId,
        autoOptimize: true,
        testDurationDays: 7,
        variants: [
          {
            id: 'variant-1',
            variantName: 'A',
            testGroup: 'A',
            externalId: 'external-1',
            platform: 'meta',
          },
          {
            id: 'variant-2',
            variantName: 'B',
            testGroup: 'B',
            externalId: 'external-2',
            platform: 'tiktok',
          },
        ],
      };

      const mockMetrics = [
        {
          variantId: 'variant-1',
          spendCents: 1000,
          conversions: 10,
        },
        {
          variantId: 'variant-2',
          spendCents: 1000,
          conversions: 5,
        },
      ];

      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.campaignMetrics.findMany as jest.Mock).mockResolvedValue(mockMetrics);
      (prisma.adVariant.update as jest.Mock).mockResolvedValue({});

      await campaignEngine.optimizeCampaign('campaign-123');

      // Should pause variant-2 (lower conversions) and scale variant-1
      expect(prisma.adVariant.update).toHaveBeenCalledWith({
        where: { id: 'variant-2' },
        data: { status: 'PAUSED' },
      });

      expect(prisma.adVariant.update).toHaveBeenCalledWith({
        where: { id: 'variant-1' },
        data: { budgetCents: expect.any(Number) },
      });
    });

    it('should skip optimization for campaigns with autoOptimize disabled', async () => {
      const mockCampaign = {
        id: 'campaign-123',
        userId: mockUserId,
        autoOptimize: false,
        variants: [],
      };

      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(mockCampaign);

      await campaignEngine.optimizeCampaign('campaign-123');

      expect(prisma.campaignMetrics.findMany).not.toHaveBeenCalled();
    });
  });

  describe('calculateExpectedMetrics', () => {
    it('should calculate realistic metrics for Meta platform', () => {
      const engine = new CampaignEngine();
      const metrics = (engine as any).calculateExpectedMetrics('meta', 30000); // $300

      expect(metrics.impressions).toBeGreaterThan(0);
      expect(metrics.clicks).toBeGreaterThan(0);
      expect(metrics.conversions).toBeGreaterThan(0);
      expect(metrics.spendCents).toBe(1000); // $300 / 30 days
      expect(metrics.ctr).toBeGreaterThan(0);
      expect(metrics.cpc).toBeGreaterThan(0);
      expect(metrics.cpm).toBeGreaterThan(0);
      expect(metrics.cpl).toBeGreaterThan(0);
      expect(metrics.roas).toBeGreaterThan(0);
    });

    it('should calculate different metrics for different platforms', () => {
      const engine = new CampaignEngine();
      const metaMetrics = (engine as any).calculateExpectedMetrics('meta', 30000);
      const tiktokMetrics = (engine as any).calculateExpectedMetrics('tiktok', 30000);

      expect(metaMetrics.cpm).not.toBe(tiktokMetrics.cpm);
      expect(metaMetrics.ctr).not.toBe(tiktokMetrics.ctr);
    });
  });

  describe('validateUserLimits', () => {
    it('should validate free tier limits', async () => {
      const mockUser = {
        id: mockUserId,
        subscriptions: [],
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const freeTierRequest: CampaignCreateRequest = {
        businessId: 'test-business',
        objective: 'traffic',
        creativeKeys: ['creative1.jpg'],
        budgetTotalCents: 60000, // $600
        platforms: ['meta', 'tiktok'], // Multiple platforms
        audience: {},
      };

      await expect(campaignEngine.createCampaign(mockUserId, freeTierRequest))
        .rejects.toThrow('Budget exceeds free tier limit of $500');
    });

    it('should validate paid tier limits', async () => {
      const mockUser = {
        id: mockUserId,
        subscriptions: [{ status: 'basic' }],
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const basicTierRequest: CampaignCreateRequest = {
        businessId: 'test-business',
        objective: 'traffic',
        creativeKeys: ['creative1.jpg'],
        budgetTotalCents: 150000, // $1500
        platforms: ['meta'],
        audience: {},
      };

      await expect(campaignEngine.createCampaign(mockUserId, basicTierRequest))
        .rejects.toThrow('Budget exceeds basic tier limit of $1000');
    });
  });
});
