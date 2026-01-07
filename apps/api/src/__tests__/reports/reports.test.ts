import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { prisma } from '../../lib/prisma';
import reportsRoutes from '../routes/reports';
import { processReportJob, scheduleWeeklyReports, scheduleMonthlyReports } from '../jobs/generateReports';
import { requireAuth } from '../middleware/auth';

// Mock dependencies
jest.mock('../services/s3');
jest.mock('../services/email');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/reports', reportsRoutes);

describe('Reports Routes', () => {
  let testUser: any;
  let testCampaign: any;
  let testLeads: any[] = [];
  let testMetrics: any[] = [];

  beforeEach(async () => {
    // Clear database
    await prisma.campaignMetrics.deleteMany();
    await prisma.adVariant.deleteMany();
    await prisma.campaign.deleteMany();
    await prisma.lead.deleteMany();
    await prisma.job.deleteMany();
    await prisma.user.deleteMany();
    
    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: 'hashed',
      },
    });

    // Create test campaign
    testCampaign = await prisma.campaign.create({
      data: {
        userId: testUser.id,
        businessId: 'business123',
        name: 'Test Campaign',
        objective: 'conversions',
        budgetTotalCents: 10000,
        platforms: ['meta', 'tiktok'],
        audience: { age: '25-34', interests: ['technology'] },
        status: 'ACTIVE',
        testGroups: 3,
        testDurationDays: 7,
        autoOptimize: true,
      },
    });

    // Create test variants
    const variant1 = await prisma.adVariant.create({
      data: {
        campaignId: testCampaign.id,
        variantName: 'A',
        creativeKey: 'creative1',
        platform: 'meta',
        budgetCents: 3000,
        targeting: { age: '25-34' },
        status: 'ACTIVE',
        testGroup: 'A',
        rolloutDay: 0,
      },
    });

    const variant2 = await prisma.adVariant.create({
      data: {
        campaignId: testCampaign.id,
        variantName: 'B',
        creativeKey: 'creative2',
        platform: 'tiktok',
        budgetCents: 3000,
        targeting: { age: '25-34' },
        status: 'ACTIVE',
        testGroup: 'B',
        rolloutDay: 0,
      },
    });

    // Create test leads
    testLeads = [
      await prisma.lead.create({
        data: {
          userId: testUser.id,
          email: 'lead1@example.com',
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1234567890',
          source: 'meta',
          metadata: {
            campaignId: testCampaign.id,
            platform: 'meta',
            age: 28,
            gender: 'male',
            location: 'New York',
          },
        },
      }),
      await prisma.lead.create({
        data: {
          userId: testUser.id,
          email: 'lead2@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
          phone: '+1234567891',
          source: 'tiktok',
          metadata: {
            campaignId: testCampaign.id,
            platform: 'tiktok',
            age: 32,
            gender: 'female',
            location: 'California',
          },
        },
      }),
    ];

    // Create test metrics
    const baseDate = new Date();
    testMetrics = [
      await prisma.campaignMetrics.create({
        data: {
          campaignId: testCampaign.id,
          variantId: variant1.id,
          platform: 'meta',
          date: new Date(baseDate.getTime() - 24 * 60 * 60 * 1000), // Yesterday
          metricType: 'ACTUAL',
          impressions: 1000,
          clicks: 50,
          conversions: 5,
          spendCents: 500,
          ctr: 5.0,
          cpc: 10.0,
          cpm: 50.0,
          cpl: 100.0,
          roas: 2.0,
        },
      }),
      await prisma.campaignMetrics.create({
        data: {
          campaignId: testCampaign.id,
          variantId: variant2.id,
          platform: 'tiktok',
          date: new Date(baseDate.getTime() - 24 * 60 * 60 * 1000), // Yesterday
          metricType: 'ACTUAL',
          impressions: 800,
          clicks: 40,
          conversions: 3,
          spendCents: 400,
          ctr: 5.0,
          cpc: 10.0,
          cpm: 50.0,
          cpl: 133.33,
          roas: 1.5,
        },
      }),
    ];

    // Mock auth middleware
    app.use((req, res, next) => {
      req.user = { id: testUser.id, email: testUser.email, name: testUser.name };
      next();
    });
  });

  afterEach(async () => {
    await prisma.campaignMetrics.deleteMany();
    await prisma.adVariant.deleteMany();
    await prisma.campaign.deleteMany();
    await prisma.lead.deleteMany();
    await prisma.job.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('GET /api/reports/overview', () => {
    it('should return aggregated overview data', async () => {
      const response = await request(app)
        .get('/api/reports/overview')
        .query({
          from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          to: new Date().toISOString(),
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.summary).toBeDefined();
      expect(response.body.data.summary.totalSpendCents).toBe(900); // 500 + 400
      expect(response.body.data.summary.totalLeads).toBe(2);
      expect(response.body.data.summary.totalImpressions).toBe(1800); // 1000 + 800
      expect(response.body.data.summary.totalClicks).toBe(90); // 50 + 40
      expect(response.body.data.summary.totalConversions).toBe(8); // 5 + 3
      expect(response.body.data.campaigns.total).toBe(1);
      expect(response.body.data.campaigns.active).toBe(1);
      expect(response.body.data.platformBreakdown).toHaveLength(2);
    });

    it('should calculate correct CPL', async () => {
      const response = await request(app)
        .get('/api/reports/overview');

      expect(response.status).toBe(200);
      expect(response.body.data.summary.cpl).toBe(450); // 900 cents / 2 leads
    });

    it('should return demographic breakdown', async () => {
      const response = await request(app)
        .get('/api/reports/overview');

      expect(response.status).toBe(200);
      expect(response.body.data.demographicBreakdown.ageGroups).toBeDefined();
      expect(response.body.data.demographicBreakdown.genders).toBeDefined();
      expect(response.body.data.demographicBreakdown.locations).toBeDefined();
    });

    it('should handle date range validation', async () => {
      const response = await request(app)
        .get('/api/reports/overview')
        .query({
          from: 'invalid-date',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('GET /api/reports/leads.csv', () => {
    it('should export leads as CSV', async () => {
      const response = await request(app)
        .get('/api/reports/leads.csv')
        .query({
          from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          to: new Date().toISOString(),
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('.csv');

      const csvContent = response.text;
      expect(csvContent).toContain('ID,Email,FirstName,LastName');
      expect(csvContent).toContain('lead1@example.com');
      expect(csvContent).toContain('lead2@example.com');
      expect(csvContent).toContain('John');
      expect(csvContent).toContain('Jane');
    });

    it('should include metadata in CSV', async () => {
      const response = await request(app)
        .get('/api/reports/leads.csv');

      expect(response.status).toBe(200);
      const csvContent = response.text;
      expect(csvContent).toContain('meta');
      expect(csvContent).toContain('tiktok');
      expect(csvContent).toContain(testCampaign.id);
    });
  });

  describe('GET /api/reports/campaigns.csv', () => {
    it('should export campaigns as CSV', async () => {
      const response = await request(app)
        .get('/api/reports/campaigns.csv');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('.csv');

      const csvContent = response.text;
      expect(csvContent).toContain('ID,Name,Objective,Platforms,Status');
      expect(csvContent).toContain('Test Campaign');
      expect(csvContent).toContain('conversions');
      expect(csvContent).toContain('meta;tiktok');
      expect(csvContent).toContain('ACTIVE');
    });

    it('should include calculated metrics in CSV', async () => {
      const response = await request(app)
        .get('/api/reports/campaigns.csv');

      expect(response.status).toBe(200);
      const csvContent = response.text;
      expect(csvContent).toContain('TotalSpendCents');
      expect(csvContent).toContain('TotalImpressions');
      expect(csvContent).toContain('TotalClicks');
      expect(csvContent).toContain('CTR');
      expect(csvContent).toContain('CPC');
      expect(csvContent).toContain('CPL');
    });
  });

  describe('GET /api/reports/metrics.csv', () => {
    it('should export metrics as CSV', async () => {
      const response = await request(app)
        .get('/api/reports/metrics.csv');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('.csv');

      const csvContent = response.text;
      expect(csvContent).toContain('ID,CampaignId,CampaignName,VariantId,VariantName,Platform');
      expect(csvContent).toContain('Test Campaign');
      expect(csvContent).toContain('meta');
      expect(csvContent).toContain('tiktok');
      expect(csvContent).toContain('A');
      expect(csvContent).toContain('B');
    });

    it('should include all metric fields', async () => {
      const response = await request(app)
        .get('/api/reports/metrics.csv');

      expect(response.status).toBe(200);
      const csvContent = response.text;
      expect(csvContent).toContain('Impressions,Clicks,Conversions,SpendCents');
      expect(csvContent).toContain('CTR,CPC,CPM,CPL,ROAS');
    });
  });

  describe('POST /api/reports/generate', () => {
    it('should enqueue report generation job', async () => {
      const response = await request(app)
        .post('/api/reports/generate')
        .send({
          type: 'weekly',
          includeLeads: true,
          includeCampaigns: true,
          includeMetrics: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.jobId).toBeDefined();
      expect(response.body.data.type).toBe('weekly');
      expect(response.body.data.status).toBe('queued');

      // Check job was created in database
      const job = await prisma.job.findFirst({
        where: {
          userId: testUser.id,
          type: 'weekly_report',
        },
      });
      expect(job).toBeDefined();
      expect(job?.status).toBe('queued');
    });

    it('should validate report generation parameters', async () => {
      const response = await request(app)
        .post('/api/reports/generate')
        .send({
          type: 'invalid_type',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should handle custom date range', async () => {
      const fromDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const toDate = new Date();

      const response = await request(app)
        .post('/api/reports/generate')
        .send({
          type: 'custom',
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
        });

      expect(response.status).toBe(200);
      expect(response.body.data.type).toBe('custom');
    });
  });

  describe('GET /api/reports/jobs', () => {
    it('should return user report jobs', async () => {
      // Create test job
      await prisma.job.create({
        data: {
          userId: testUser.id,
          type: 'weekly_report',
          status: 'completed',
          meta: {
            type: 'weekly',
            completedAt: new Date().toISOString(),
          },
        },
      });

      const response = await request(app)
        .get('/api/reports/jobs');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.jobs).toHaveLength(1);
      expect(response.body.data.jobs[0].type).toBe('weekly_report');
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should handle pagination', async () => {
      const response = await request(app)
        .get('/api/reports/jobs')
        .query({
          page: 1,
          limit: 5,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(5);
    });
  });

  describe('GET /api/reports/download/:jobId', () => {
    it('should return download URL for completed report', async () => {
      const job = await prisma.job.create({
        data: {
          userId: testUser.id,
          type: 'weekly_report',
          status: 'completed',
          meta: {
            outputKey: 'reports/test-user/2024-01-01/weekly-report.zip',
            filename: 'weekly-report.zip',
          },
        },
      });

      const response = await request(app)
        .get(`/api/reports/download/${job.id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.downloadUrl).toBeDefined();
      expect(response.body.data.filename).toBe('weekly-report.zip');
    });

    it('should return 404 for non-existent job', async () => {
      const response = await request(app)
        .get('/api/reports/download/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Report not found or not ready');
    });

    it('should return 404 for incomplete job', async () => {
      const job = await prisma.job.create({
        data: {
          userId: testUser.id,
          type: 'weekly_report',
          status: 'processing',
        },
      });

      const response = await request(app)
        .get(`/api/reports/download/${job.id}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Report not found or not ready');
    });
  });
});

describe('Report Generation Jobs', () => {
  let testUser: any;
  let testCampaign: any;
  let testLeads: any[] = [];
  let testMetrics: any[] = [];

  beforeEach(async () => {
    await prisma.campaignMetrics.deleteMany();
    await prisma.adVariant.deleteMany();
    await prisma.campaign.deleteMany();
    await prisma.lead.deleteMany();
    await prisma.job.deleteMany();
    await prisma.user.deleteMany();
    
    testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: 'hashed',
      },
    });

    testCampaign = await prisma.campaign.create({
      data: {
        userId: testUser.id,
        businessId: 'business123',
        name: 'Test Campaign',
        objective: 'conversions',
        budgetTotalCents: 10000,
        platforms: ['meta'],
        audience: { age: '25-34' },
        status: 'ACTIVE',
        testGroups: 3,
        testDurationDays: 7,
        autoOptimize: true,
      },
    });

    const variant = await prisma.adVariant.create({
      data: {
        campaignId: testCampaign.id,
        variantName: 'A',
        creativeKey: 'creative1',
        platform: 'meta',
        budgetCents: 5000,
        targeting: { age: '25-34' },
        status: 'ACTIVE',
        testGroup: 'A',
        rolloutDay: 0,
      },
    });

    testLeads = [
      await prisma.lead.create({
        data: {
          userId: testUser.id,
          email: 'lead1@example.com',
          firstName: 'John',
          lastName: 'Doe',
          source: 'meta',
          metadata: { campaignId: testCampaign.id, platform: 'meta' },
        },
      }),
    ];

    testMetrics = [
      await prisma.campaignMetrics.create({
        data: {
          campaignId: testCampaign.id,
          variantId: variant.id,
          platform: 'meta',
          date: new Date(),
          metricType: 'ACTUAL',
          impressions: 1000,
          clicks: 50,
          conversions: 5,
          spendCents: 500,
          ctr: 5.0,
          cpc: 10.0,
          cpm: 50.0,
          cpl: 100.0,
          roas: 2.0,
        },
      }),
    ];
  });

  afterEach(async () => {
    await prisma.campaignMetrics.deleteMany();
    await prisma.adVariant.deleteMany();
    await prisma.campaign.deleteMany();
    await prisma.lead.deleteMany();
    await prisma.job.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('processReportJob', () => {
    it('should generate report successfully', async () => {
      const payload = {
        type: 'weekly' as const,
        userIds: [testUser.id],
        includeLeads: true,
        includeCampaigns: true,
        includeMetrics: true,
        requestedBy: testUser.id,
      };

      // Mock S3 upload
      const mockUploadToS3 = jest.fn().mockResolvedValue(undefined);
      jest.doMock('../services/s3', () => ({
        uploadToS3: mockUploadToS3,
      }));

      const result = await processReportJob(payload);

      expect(result.success).toBe(true);
      expect(result.outputKey).toBeDefined();
      expect(result.filename).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.summary?.totalUsers).toBe(1);
      expect(result.summary?.totalCampaigns).toBe(1);
      expect(result.summary?.totalLeads).toBe(1);
      expect(result.summary?.totalSpendCents).toBe(500);
    });

    it('should handle empty data gracefully', async () => {
      const payload = {
        type: 'weekly' as const,
        userIds: ['non-existent-user'],
        includeLeads: true,
        includeCampaigns: true,
        includeMetrics: true,
        requestedBy: testUser.id,
      };

      const mockUploadToS3 = jest.fn().mockResolvedValue(undefined);
      jest.doMock('../services/s3', () => ({
        uploadToS3: mockUploadToS3,
      }));

      const result = await processReportJob(payload);

      expect(result.success).toBe(true);
      expect(result.summary?.totalUsers).toBe(1);
      expect(result.summary?.totalCampaigns).toBe(0);
      expect(result.summary?.totalLeads).toBe(0);
      expect(result.summary?.totalSpendCents).toBe(0);
    });

    it('should handle custom date range', async () => {
      const fromDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const toDate = new Date();

      const payload = {
        type: 'custom' as const,
        from: fromDate,
        to: toDate,
        userIds: [testUser.id],
        includeLeads: true,
        includeCampaigns: true,
        includeMetrics: true,
        requestedBy: testUser.id,
      };

      const mockUploadToS3 = jest.fn().mockResolvedValue(undefined);
      jest.doMock('../services/s3', () => ({
        uploadToS3: mockUploadToS3,
      }));

      const result = await processReportJob(payload);

      expect(result.success).toBe(true);
      expect(result.summary?.period.from).toEqual(fromDate);
      expect(result.summary?.period.to).toEqual(toDate);
    });
  });

  describe('scheduleWeeklyReports', () => {
    it('should schedule reports for active users', async () => {
      // Create user with active subscription
      await prisma.subscription.create({
        data: {
          userId: testUser.id,
          stripeSubscriptionId: 'sub_test123',
          stripeCustomerId: 'cus_test123',
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          cancelAtPeriodEnd: false,
          priceId: 'price_test123',
        },
      });

      const mockEnqueueReportJob = jest.fn().mockResolvedValue({ id: 'job123' });
      jest.doMock('./generateReports', () => ({
        ...jest.requireActual('./generateReports'),
        enqueueReportJob: mockEnqueueReportJob,
      }));

      await scheduleWeeklyReports();

      expect(mockEnqueueReportJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'weekly',
          userIds: [testUser.id],
          includeLeads: true,
          includeCampaigns: true,
          includeMetrics: true,
          requestedBy: 'system',
        })
      );
    });

    it('should handle no active users', async () => {
      const mockEnqueueReportJob = jest.fn().mockResolvedValue({ id: 'job123' });
      jest.doMock('./generateReports', () => ({
        ...jest.requireActual('./generateReports'),
        enqueueReportJob: mockEnqueueReportJob,
      }));

      await scheduleWeeklyReports();

      expect(mockEnqueueReportJob).not.toHaveBeenCalled();
    });
  });

  describe('scheduleMonthlyReports', () => {
    it('should schedule monthly reports for active users', async () => {
      // Create user with active subscription
      await prisma.subscription.create({
        data: {
          userId: testUser.id,
          stripeSubscriptionId: 'sub_test123',
          stripeCustomerId: 'cus_test123',
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          cancelAtPeriodEnd: false,
          priceId: 'price_test123',
        },
      });

      const mockEnqueueReportJob = jest.fn().mockResolvedValue({ id: 'job123' });
      jest.doMock('./generateReports', () => ({
        ...jest.requireActual('./generateReports'),
        enqueueReportJob: mockEnqueueReportJob,
      }));

      await scheduleMonthlyReports();

      expect(mockEnqueueReportJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'monthly',
          userIds: [testUser.id],
          includeLeads: true,
          includeCampaigns: true,
          includeMetrics: true,
          requestedBy: 'system',
        })
      );
    });
  });
});
