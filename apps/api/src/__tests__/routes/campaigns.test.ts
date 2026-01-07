import request from 'supertest';
import express from 'express';
import campaignsRouter from '../../routes/campaigns';
import { CampaignEngine } from '../../services/campaignEngine';
import { prisma } from '../../lib/prisma';

// Mock dependencies
jest.mock('../../services/campaignEngine');
jest.mock('../../lib/prisma', () => ({
  prisma: {
    campaign: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    adVariant: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    campaignMetrics: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

const app = express();
app.use(express.json());
app.use('/api/campaigns', campaignsRouter);

// Mock authentication middleware
app.use((req, res, next) => {
  req.user = { id: 'test-user-id' };
  next();
});

describe('Campaign Routes', () => {
  let mockCampaignEngine: jest.Mocked<CampaignEngine>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCampaignEngine = new CampaignEngine() as jest.Mocked<CampaignEngine>;
    (CampaignEngine as jest.Mock).mockImplementation(() => mockCampaignEngine);
  });

  describe('POST /api/campaigns/create', () => {
    const validRequest = {
      businessId: 'test-business',
      objective: 'traffic',
      creativeKeys: ['creative1.jpg', 'creative2.jpg'],
      budgetTotalCents: 30000,
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

    it('should create a campaign successfully', async () => {
      const mockResponse = {
        campaign: {
          id: 'campaign-123',
          name: 'Test Campaign',
          objective: 'traffic',
          budgetTotalCents: 30000,
          platforms: ['meta', 'tiktok'],
          status: 'DRAFT',
          testGroups: 3,
          testDurationDays: 7,
          autoOptimize: true,
          createdAt: new Date(),
        },
        variants: [
          {
            id: 'variant-1',
            variantName: 'A',
            creativeKey: 'creative1.jpg',
            platform: 'meta',
            budgetCents: 10000,
            testGroup: 'A',
            rolloutDay: 0,
            status: 'PENDING',
          },
        ],
        budgetRecommendation: {
          suggestedBudgetCents: 30000,
          dailyBudgetCents: 1000,
          platformAllocation: { meta: 0.5, tiktok: 0.5 },
          reasoning: 'Balanced allocation',
        },
      };

      mockCampaignEngine.createCampaign.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/campaigns/create')
        .send(validRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.campaign.id).toBe('campaign-123');
      expect(response.body.data.variants).toHaveLength(1);
      expect(mockCampaignEngine.createCampaign).toHaveBeenCalledWith('test-user-id', validRequest);
    });

    it('should validate request data', async () => {
      const invalidRequest = {
        businessId: '',
        objective: 'invalid',
        creativeKeys: [],
        budgetTotalCents: 500,
        platforms: [],
        audience: {},
      };

      const response = await request(app)
        .post('/api/campaigns/create')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.details).toBeDefined();
    });

    it('should handle campaign creation errors', async () => {
      mockCampaignEngine.createCampaign.mockRejectedValue(new Error('Campaign creation failed'));

      const response = await request(app)
        .post('/api/campaigns/create')
        .send(validRequest)
        .expect(500);

      expect(response.body.error).toBe('Campaign creation failed');
      expect(response.body.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('POST /api/campaigns/launch', () => {
    it('should launch a campaign successfully', async () => {
      const mockCampaign = {
        id: 'campaign-123',
        userId: 'test-user-id',
        status: 'DRAFT',
      };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      mockCampaignEngine.launchCampaign.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/campaigns/launch')
        .send({ campaignId: 'campaign-123' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Campaign launched successfully');
      expect(mockCampaignEngine.launchCampaign).toHaveBeenCalledWith('campaign-123');
    });

    it('should return 404 for non-existent campaign', async () => {
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/campaigns/launch')
        .send({ campaignId: 'non-existent' })
        .expect(404);

      expect(response.body.error).toBe('Campaign not found');
      expect(response.body.code).toBe('CAMPAIGN_NOT_FOUND');
    });

    it('should validate campaign ID format', async () => {
      const response = await request(app)
        .post('/api/campaigns/launch')
        .send({ campaignId: 'invalid-id' })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/campaigns/optimize', () => {
    it('should optimize a campaign successfully', async () => {
      const mockCampaign = {
        id: 'campaign-123',
        userId: 'test-user-id',
        autoOptimize: true,
      };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      mockCampaignEngine.optimizeCampaign.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/campaigns/optimize')
        .send({ campaignId: 'campaign-123' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Campaign optimization completed');
      expect(mockCampaignEngine.optimizeCampaign).toHaveBeenCalledWith('campaign-123');
    });

    it('should return 404 for non-existent campaign', async () => {
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/campaigns/optimize')
        .send({ campaignId: 'non-existent' })
        .expect(404);

      expect(response.body.error).toBe('Campaign not found');
      expect(response.body.code).toBe('CAMPAIGN_NOT_FOUND');
    });
  });

  describe('GET /api/campaigns', () => {
    it('should return campaigns with pagination', async () => {
      const mockCampaigns = [
        {
          id: 'campaign-1',
          name: 'Campaign 1',
          objective: 'traffic',
          status: 'ACTIVE',
          createdAt: new Date(),
          variants: [],
          _count: { variants: 2, metrics: 10 },
        },
        {
          id: 'campaign-2',
          name: 'Campaign 2',
          objective: 'conversions',
          status: 'DRAFT',
          createdAt: new Date(),
          variants: [],
          _count: { variants: 3, metrics: 15 },
        },
      ];

      (prisma.campaign.findMany as jest.Mock).mockResolvedValue(mockCampaigns);
      (prisma.campaign.count as jest.Mock).mockResolvedValue(2);

      const response = await request(app)
        .get('/api/campaigns')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.campaigns).toHaveLength(2);
      expect(response.body.data.pagination.total).toBe(2);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(10);
    });

    it('should filter campaigns by status', async () => {
      const mockCampaigns = [
        {
          id: 'campaign-1',
          name: 'Active Campaign',
          status: 'ACTIVE',
          variants: [],
          _count: { variants: 2, metrics: 10 },
        },
      ];

      (prisma.campaign.findMany as jest.Mock).mockResolvedValue(mockCampaigns);
      (prisma.campaign.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/campaigns')
        .query({ status: 'ACTIVE' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.campaigns).toHaveLength(1);
      expect(response.body.data.campaigns[0].status).toBe('ACTIVE');
    });

    it('should filter campaigns by platform', async () => {
      const mockCampaigns = [
        {
          id: 'campaign-1',
          name: 'Meta Campaign',
          variants: [
            {
              id: 'variant-1',
              platform: 'meta',
              status: 'ACTIVE',
            },
          ],
          _count: { variants: 1, metrics: 5 },
        },
      ];

      (prisma.campaign.findMany as jest.Mock).mockResolvedValue(mockCampaigns);
      (prisma.campaign.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/campaigns')
        .query({ platform: 'meta' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.campaigns).toHaveLength(1);
    });
  });

  describe('GET /api/campaigns/:id', () => {
    it('should return detailed campaign information', async () => {
      const mockCampaign = {
        id: 'campaign-123',
        userId: 'test-user-id',
        name: 'Test Campaign',
        objective: 'traffic',
        budgetTotalCents: 30000,
        platforms: ['meta', 'tiktok'],
        audience: { ageMin: 25, ageMax: 45 },
        status: 'ACTIVE',
        testGroups: 3,
        testDurationDays: 7,
        autoOptimize: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: new Date(),
        completedAt: null,
        variants: [
          {
            id: 'variant-1',
            variantName: 'A',
            platform: 'meta',
            status: 'ACTIVE',
            budgetCents: 10000,
            externalId: 'external-1',
            testGroup: 'A',
            metrics: [
              {
                metricType: 'ACTUAL',
                spendCents: 1000,
                conversions: 5,
                clicks: 50,
                impressions: 1000,
              },
            ],
          },
        ],
        metrics: [],
      };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);

      const response = await request(app)
        .get('/api/campaigns/campaign-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.campaign.id).toBe('campaign-123');
      expect(response.body.data.variants).toHaveLength(1);
      expect(response.body.data.variants[0].performance.actualSpendCents).toBe(1000);
      expect(response.body.data.variants[0].performance.actualConversions).toBe(5);
    });

    it('should return 404 for non-existent campaign', async () => {
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/campaigns/non-existent')
        .expect(404);

      expect(response.body.error).toBe('Campaign not found');
      expect(response.body.code).toBe('CAMPAIGN_NOT_FOUND');
    });
  });

  describe('PUT /api/campaigns/:id', () => {
    it('should update campaign successfully', async () => {
      const mockCampaign = {
        id: 'campaign-123',
        userId: 'test-user-id',
        status: 'DRAFT',
      };

      const updatedCampaign = {
        ...mockCampaign,
        name: 'Updated Campaign',
        budgetTotalCents: 40000,
      };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.campaign.update as jest.Mock).mockResolvedValue(updatedCampaign);

      const response = await request(app)
        .put('/api/campaigns/campaign-123')
        .send({
          name: 'Updated Campaign',
          budgetTotalCents: 40000,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Campaign');
      expect(response.body.data.budgetTotalCents).toBe(40000);
    });

    it('should return 400 for updating active campaign', async () => {
      const mockCampaign = {
        id: 'campaign-123',
        userId: 'test-user-id',
        status: 'ACTIVE',
      };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);

      const response = await request(app)
        .put('/api/campaigns/campaign-123')
        .send({
          name: 'Updated Campaign',
        })
        .expect(400);

      expect(response.body.error).toBe('Cannot update active campaign');
      expect(response.body.code).toBe('CAMPAIGN_ACTIVE');
    });

    it('should validate update data', async () => {
      const mockCampaign = {
        id: 'campaign-123',
        userId: 'test-user-id',
        status: 'DRAFT',
      };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);

      const response = await request(app)
        .put('/api/campaigns/campaign-123')
        .send({
          name: '',
          budgetTotalCents: 500,
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/campaigns/:id', () => {
    it('should delete campaign successfully', async () => {
      const mockCampaign = {
        id: 'campaign-123',
        userId: 'test-user-id',
        status: 'DRAFT',
        variants: [],
      };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.campaign.delete as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .delete('/api/campaigns/campaign-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Campaign deleted successfully');
      expect(prisma.campaign.delete).toHaveBeenCalledWith({
        where: { id: 'campaign-123' },
      });
    });

    it('should pause active variants before deletion', async () => {
      const mockCampaign = {
        id: 'campaign-123',
        userId: 'test-user-id',
        status: 'ACTIVE',
        variants: [
          {
            id: 'variant-1',
            externalId: 'external-1',
          },
        ],
      };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.campaign.delete as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .delete('/api/campaigns/campaign-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockCampaignEngine.pauseVariant).toHaveBeenCalledWith('variant-1');
    });

    it('should return 404 for non-existent campaign', async () => {
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/campaigns/non-existent')
        .expect(404);

      expect(response.body.error).toBe('Campaign not found');
      expect(response.body.code).toBe('CAMPAIGN_NOT_FOUND');
    });
  });

  describe('GET /api/campaigns/:id/metrics', () => {
    it('should return campaign metrics with filtering', async () => {
      const mockCampaign = {
        id: 'campaign-123',
        userId: 'test-user-id',
      };

      const mockMetrics = [
        {
          id: 'metric-1',
          campaignId: 'campaign-123',
          variantId: 'variant-1',
          platform: 'meta',
          date: new Date(),
          metricType: 'ACTUAL',
          impressions: 1000,
          clicks: 20,
          conversions: 2,
          spendCents: 1000,
          ctr: 2.0,
          cpc: 0.5,
          cpm: 10.0,
          cpl: 5.0,
          roas: 0.1,
          variant: {
            id: 'variant-1',
            variantName: 'A',
            platform: 'meta',
            testGroup: 'A',
          },
        },
      ];

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.campaignMetrics.findMany as jest.Mock).mockResolvedValue(mockMetrics);

      const response = await request(app)
        .get('/api/campaigns/campaign-123/metrics')
        .query({
          variantId: 'variant-1',
          platform: 'meta',
          metricType: 'ACTUAL',
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.metrics).toHaveLength(1);
      expect(response.body.data.totalRecords).toBe(1);
      expect(response.body.data.dateRange).toBeDefined();
    });

    it('should aggregate metrics by date', async () => {
      const mockCampaign = {
        id: 'campaign-123',
        userId: 'test-user-id',
      };

      const mockMetrics = [
        {
          id: 'metric-1',
          campaignId: 'campaign-123',
          variantId: 'variant-1',
          platform: 'meta',
          date: new Date('2024-01-01'),
          metricType: 'ACTUAL',
          impressions: 1000,
          clicks: 20,
          conversions: 2,
          spendCents: 1000,
          ctr: 2.0,
          cpc: 0.5,
          cpm: 10.0,
          cpl: 5.0,
          roas: 0.1,
          variant: {
            id: 'variant-1',
            variantName: 'A',
            platform: 'meta',
            testGroup: 'A',
          },
        },
        {
          id: 'metric-2',
          campaignId: 'campaign-123',
          variantId: 'variant-2',
          platform: 'meta',
          date: new Date('2024-01-01'),
          metricType: 'ACTUAL',
          impressions: 500,
          clicks: 10,
          conversions: 1,
          spendCents: 500,
          ctr: 2.0,
          cpc: 0.5,
          cpm: 10.0,
          cpl: 5.0,
          roas: 0.1,
          variant: {
            id: 'variant-2',
            variantName: 'B',
            platform: 'meta',
            testGroup: 'B',
          },
        },
      ];

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.campaignMetrics.findMany as jest.Mock).mockResolvedValue(mockMetrics);

      const response = await request(app)
        .get('/api/campaigns/campaign-123/metrics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.metrics).toHaveLength(1); // Aggregated by date
      expect(response.body.data.metrics[0].impressions).toBe(1500); // Sum of both metrics
      expect(response.body.data.metrics[0].clicks).toBe(30);
      expect(response.body.data.metrics[0].conversions).toBe(3);
      expect(response.body.data.metrics[0].spendCents).toBe(1500);
    });
  });

  describe('GET /api/campaigns/budget-recommendation', () => {
    it('should return budget recommendation', async () => {
      const mockRecommendation = {
        suggestedBudgetCents: 50000,
        dailyBudgetCents: 1667,
        platformAllocation: { meta: 0.6, tiktok: 0.4 },
        reasoning: 'Optimal budget for conversions',
        riskLevel: 'medium',
        expectedMetrics: {
          impressions: 10000,
          clicks: 200,
          conversions: 20,
          ctr: 2.0,
          cpc: 0.83,
          cpm: 8.33,
        },
      };

      mockCampaignEngine.generateBudgetRecommendation.mockResolvedValue(mockRecommendation);

      const response = await request(app)
        .get('/api/campaigns/budget-recommendation')
        .query({
          objective: 'conversions',
          platforms: ['meta', 'tiktok'],
          audience: JSON.stringify({ ageMin: 25, ageMax: 45 }),
          budgetTotalCents: 50000,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.suggestedBudgetCents).toBe(50000);
      expect(response.body.data.platformAllocation.meta).toBe(0.6);
      expect(response.body.data.platformAllocation.tiktok).toBe(0.4);
    });

    it('should validate query parameters', async () => {
      const response = await request(app)
        .get('/api/campaigns/budget-recommendation')
        .query({
          objective: 'invalid',
          platforms: [],
          budgetTotalCents: 500,
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });
});
