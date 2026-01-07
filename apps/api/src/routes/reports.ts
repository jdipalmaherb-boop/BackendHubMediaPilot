import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { generatePresignedUrl } from '../lib/s3';
import { enqueueReportJob } from '../jobs/generateReports';

const router = Router();

// Validation schemas
const dateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const generateReportSchema = z.object({
  type: z.enum(['weekly', 'monthly', 'custom']).default('weekly'),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  userIds: z.array(z.string().uuid()).optional(),
  includeLeads: z.boolean().default(true),
  includeCampaigns: z.boolean().default(true),
  includeMetrics: z.boolean().default(true),
});

/**
 * GET /api/reports/overview
 * Get aggregated overview of user's performance
 */
router.get('/overview', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { from, to } = dateRangeSchema.parse(req.query);

    // Set default date range if not provided
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const toDate = to ? new Date(to) : new Date();

    // Get campaign metrics for the user
    const campaignMetrics = await prisma.campaignMetrics.findMany({
      where: {
        campaign: {
          userId,
        },
        date: {
          gte: fromDate,
          lte: toDate,
        },
        metricType: 'ACTUAL',
      },
      include: {
        campaign: {
          include: {
            variants: true,
          },
        },
        variant: true,
      },
    });

    // Get leads for the user
    const leads = await prisma.lead.findMany({
      where: {
        userId,
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
    });

    // Get campaigns for the user
    const campaigns = await prisma.campaign.findMany({
      where: {
        userId,
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      include: {
        variants: true,
        metrics: {
          where: {
            metricType: 'ACTUAL',
          },
        },
      },
    });

    // Calculate aggregated metrics
    const totalSpend = campaignMetrics.reduce((sum, metric) => sum + metric.spendCents, 0);
    const totalImpressions = campaignMetrics.reduce((sum, metric) => sum + metric.impressions, 0);
    const totalClicks = campaignMetrics.reduce((sum, metric) => sum + metric.clicks, 0);
    const totalConversions = campaignMetrics.reduce((sum, metric) => sum + metric.conversions, 0);
    const totalLeads = leads.length;

    // Calculate rates
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
    const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
    const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;

    // Get top performing campaigns
    const campaignPerformance = campaigns.map(campaign => {
      const campaignMetrics = campaign.metrics;
      const campaignSpend = campaignMetrics.reduce((sum, metric) => sum + metric.spendCents, 0);
      const campaignLeads = leads.filter(lead => 
        lead.metadata?.campaignId === campaign.id
      ).length;
      const campaignCpl = campaignLeads > 0 ? campaignSpend / campaignLeads : 0;

      return {
        id: campaign.id,
        name: campaign.name,
        objective: campaign.objective,
        platforms: campaign.platforms,
        status: campaign.status,
        spendCents: campaignSpend,
        leads: campaignLeads,
        cpl: campaignCpl,
        variants: campaign.variants.length,
        createdAt: campaign.createdAt,
      };
    }).sort((a, b) => b.spendCents - a.spendCents);

    // Get top performing creatives (from campaign variants)
    const creativePerformance = campaigns.flatMap(campaign => 
      campaign.variants.map(variant => ({
        id: variant.id,
        creativeKey: variant.creativeKey,
        campaignName: campaign.name,
        platform: variant.platform,
        budgetCents: variant.budgetCents,
        status: variant.status,
        createdAt: variant.createdAt,
      }))
    ).sort((a, b) => b.budgetCents - a.budgetCents);

    // Get platform breakdown
    const platformBreakdown = campaigns.reduce((acc, campaign) => {
      campaign.platforms.forEach(platform => {
        if (!acc[platform]) {
          acc[platform] = {
            platform,
            campaigns: 0,
            spendCents: 0,
            leads: 0,
          };
        }
        acc[platform].campaigns += 1;
        acc[platform].spendCents += campaign.metrics.reduce((sum, metric) => sum + metric.spendCents, 0);
        acc[platform].leads += leads.filter(lead => 
          lead.metadata?.platform === platform
        ).length;
      });
      return acc;
    }, {} as Record<string, any>);

    // Get demographic breakdown if available
    const demographicBreakdown = {
      ageGroups: {},
      genders: {},
      locations: {},
    };

    leads.forEach(lead => {
      const metadata = lead.metadata as any;
      
      // Age groups
      if (metadata.age) {
        const ageGroup = metadata.age < 25 ? '18-24' : 
                        metadata.age < 35 ? '25-34' : 
                        metadata.age < 45 ? '35-44' : 
                        metadata.age < 55 ? '45-54' : '55+';
        demographicBreakdown.ageGroups[ageGroup] = (demographicBreakdown.ageGroups[ageGroup] || 0) + 1;
      }

      // Genders
      if (metadata.gender) {
        demographicBreakdown.genders[metadata.gender] = (demographicBreakdown.genders[metadata.gender] || 0) + 1;
      }

      // Locations
      if (metadata.location) {
        demographicBreakdown.locations[metadata.location] = (demographicBreakdown.locations[metadata.location] || 0) + 1;
      }
    });

    res.json({
      success: true,
      data: {
        period: {
          from: fromDate,
          to: toDate,
        },
        summary: {
          totalSpendCents: totalSpend,
          totalSpend: totalSpend / 100,
          totalImpressions,
          totalClicks,
          totalConversions,
          totalLeads,
          ctr: Math.round(ctr * 100) / 100,
          conversionRate: Math.round(conversionRate * 100) / 100,
          cpl: Math.round(cpl) / 100,
          cpc: Math.round(cpc) / 100,
          cpm: Math.round(cpm) / 100,
        },
        campaigns: {
          total: campaigns.length,
          active: campaigns.filter(c => c.status === 'ACTIVE').length,
          completed: campaigns.filter(c => c.status === 'COMPLETED').length,
          topPerforming: campaignPerformance.slice(0, 5),
        },
        creatives: {
          total: creativePerformance.length,
          topPerforming: creativePerformance.slice(0, 10),
        },
        platformBreakdown: Object.values(platformBreakdown),
        demographicBreakdown,
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

    console.error('Get overview error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/reports/leads.csv
 * Export leads as CSV
 */
router.get('/leads.csv', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { from, to } = dateRangeSchema.parse(req.query);

    // Set default date range if not provided
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    // Get leads
    const leads = await prisma.lead.findMany({
      where: {
        userId,
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Generate CSV content
    const csvHeaders = [
      'ID',
      'Email',
      'FirstName',
      'LastName',
      'Phone',
      'Source',
      'CampaignId',
      'Platform',
      'CreatedAt',
      'Metadata'
    ];

    const csvRows = leads.map(lead => [
      lead.id,
      lead.email,
      lead.firstName || '',
      lead.lastName || '',
      lead.phone || '',
      lead.source || '',
      lead.metadata?.campaignId || '',
      lead.metadata?.platform || '',
      lead.createdAt.toISOString(),
      JSON.stringify(lead.metadata || {}),
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n');

    // Set response headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="leads-${fromDate.toISOString().split('T')[0]}-to-${toDate.toISOString().split('T')[0]}.csv"`);
    
    res.send(csvContent);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Export leads CSV error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/reports/campaigns.csv
 * Export campaigns as CSV
 */
router.get('/campaigns.csv', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { from, to } = dateRangeSchema.parse(req.query);

    // Set default date range if not provided
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    // Get campaigns with metrics
    const campaigns = await prisma.campaign.findMany({
      where: {
        userId,
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      include: {
        variants: true,
        metrics: {
          where: {
            metricType: 'ACTUAL',
          },
        },
      },
    });

    // Generate CSV content
    const csvHeaders = [
      'ID',
      'Name',
      'Objective',
      'Platforms',
      'Status',
      'BudgetTotalCents',
      'TestGroups',
      'TestDurationDays',
      'AutoOptimize',
      'CreatedAt',
      'StartedAt',
      'CompletedAt',
      'TotalSpendCents',
      'TotalImpressions',
      'TotalClicks',
      'TotalConversions',
      'CTR',
      'CPC',
      'CPL',
      'VariantsCount'
    ];

    const csvRows = campaigns.map(campaign => {
      const totalSpend = campaign.metrics.reduce((sum, metric) => sum + metric.spendCents, 0);
      const totalImpressions = campaign.metrics.reduce((sum, metric) => sum + metric.impressions, 0);
      const totalClicks = campaign.metrics.reduce((sum, metric) => sum + metric.clicks, 0);
      const totalConversions = campaign.metrics.reduce((sum, metric) => sum + metric.conversions, 0);
      
      const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
      const cpl = totalConversions > 0 ? totalSpend / totalConversions : 0;

      return [
        campaign.id,
        campaign.name,
        campaign.objective,
        campaign.platforms.join(';'),
        campaign.status,
        campaign.budgetTotalCents,
        campaign.testGroups,
        campaign.testDurationDays,
        campaign.autoOptimize,
        campaign.createdAt.toISOString(),
        campaign.startedAt?.toISOString() || '',
        campaign.completedAt?.toISOString() || '',
        totalSpend,
        totalImpressions,
        totalClicks,
        totalConversions,
        Math.round(ctr * 100) / 100,
        Math.round(cpc) / 100,
        Math.round(cpl) / 100,
        campaign.variants.length,
      ];
    });

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n');

    // Set response headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="campaigns-${fromDate.toISOString().split('T')[0]}-to-${toDate.toISOString().split('T')[0]}.csv"`);
    
    res.send(csvContent);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Export campaigns CSV error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/reports/metrics.csv
 * Export campaign metrics as CSV
 */
router.get('/metrics.csv', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { from, to } = dateRangeSchema.parse(req.query);

    // Set default date range if not provided
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    // Get campaign metrics
    const metrics = await prisma.campaignMetrics.findMany({
      where: {
        campaign: {
          userId,
        },
        date: {
          gte: fromDate,
          lte: toDate,
        },
      },
      include: {
        campaign: true,
        variant: true,
      },
      orderBy: { date: 'desc' },
    });

    // Generate CSV content
    const csvHeaders = [
      'ID',
      'CampaignId',
      'CampaignName',
      'VariantId',
      'VariantName',
      'Platform',
      'Date',
      'MetricType',
      'Impressions',
      'Clicks',
      'Conversions',
      'SpendCents',
      'CTR',
      'CPC',
      'CPM',
      'CPL',
      'ROAS'
    ];

    const csvRows = metrics.map(metric => [
      metric.id,
      metric.campaignId,
      metric.campaign.name,
      metric.variantId || '',
      metric.variant?.variantName || '',
      metric.platform,
      metric.date.toISOString(),
      metric.metricType,
      metric.impressions,
      metric.clicks,
      metric.conversions,
      metric.spendCents,
      metric.ctr,
      metric.cpc,
      metric.cpm,
      metric.cpl,
      metric.roas,
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n');

    // Set response headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="metrics-${fromDate.toISOString().split('T')[0]}-to-${toDate.toISOString().split('T')[0]}.csv"`);
    
    res.send(csvContent);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Export metrics CSV error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/reports/generate
 * Generate and enqueue a report job (admin only)
 */
router.post('/generate', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { type, from, to, userIds, includeLeads, includeCampaigns, includeMetrics } = generateReportSchema.parse(req.body);

    // Check if user is admin (you might want to add role-based access control)
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // For now, allow any authenticated user to generate reports
    // In production, you'd check for admin role

    const reportJob = await enqueueReportJob({
      type,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      userIds: userIds || [userId],
      includeLeads,
      includeCampaigns,
      includeMetrics,
      requestedBy: userId,
    });

    res.json({
      success: true,
      data: {
        jobId: reportJob.id,
        type,
        status: 'queued',
        message: 'Report generation job enqueued successfully',
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

    console.error('Generate report error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/reports/jobs
 * Get user's report generation jobs
 */
router.get('/jobs', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const jobs = await prisma.job.findMany({
      where: {
        userId,
        type: { in: ['report_generation', 'weekly_report', 'monthly_report'] },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await prisma.job.count({
      where: {
        userId,
        type: { in: ['report_generation', 'weekly_report', 'monthly_report'] },
      },
    });

    res.json({
      success: true,
      data: {
        jobs: jobs.map(job => ({
          id: job.id,
          type: job.type,
          status: job.status,
          meta: job.meta,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get report jobs error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/reports/download/:jobId
 * Download a generated report
 */
router.get('/download/:jobId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const jobId = req.params.jobId;

    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        userId,
        status: 'completed',
        type: { in: ['report_generation', 'weekly_report', 'monthly_report'] },
      },
    });

    if (!job) {
      return res.status(404).json({
        error: 'Report not found or not ready',
        code: 'REPORT_NOT_FOUND'
      });
    }

    const outputKey = job.meta?.outputKey;
    if (!outputKey) {
      return res.status(404).json({
        error: 'Report file not found',
        code: 'REPORT_FILE_NOT_FOUND'
      });
    }

    // Generate presigned URL for download
    const downloadUrl = await generatePresignedUrl(outputKey, 'getObject', 3600); // 1 hour expiry

    res.json({
      success: true,
      data: {
        downloadUrl,
        expiresIn: 3600,
        filename: job.meta?.filename || 'report.zip',
      },
    });
  } catch (error) {
    console.error('Download report error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

export default router;
