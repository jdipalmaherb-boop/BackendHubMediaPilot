import { Queue, JobsOptions } from 'bullmq';
import { getRedisConnection } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { env } from '../env';
import { uploadToS3 } from '../lib/s3';
import { emailService } from '../services/email';
import archiver from 'archiver';
import { Readable } from 'stream';

const connection = getRedisConnection();

export const REPORTS_QUEUE_NAME = 'reports';

export const reportsQueue = connection ? new Queue(REPORTS_QUEUE_NAME, { connection }) : null;

export interface ReportJobPayload {
  type: 'weekly' | 'monthly' | 'custom';
  from?: Date;
  to?: Date;
  userIds: string[];
  includeLeads: boolean;
  includeCampaigns: boolean;
  includeMetrics: boolean;
  requestedBy: string;
}

export interface ReportJobResult {
  success: boolean;
  outputKey?: string;
  filename?: string;
  error?: string;
  summary?: {
    totalUsers: number;
    totalCampaigns: number;
    totalLeads: number;
    totalSpendCents: number;
    period: {
      from: Date;
      to: Date;
    };
  };
}

// Retry configuration
export function getReportsBackoffOptions(): JobsOptions {
  return {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // Start with 5 seconds
    },
    removeOnComplete: 50,
    removeOnFail: 20,
    delay: 0,
  } as JobsOptions;
}

// Enqueue report generation job
export async function enqueueReportJob(payload: ReportJobPayload): Promise<{ id: string }> {
  const jobOptions: JobsOptions = {
    ...getReportsBackoffOptions(),
  };

  const job = await reportsQueue.add('generate-report', payload, jobOptions);
  
  // Create job record in database
  await prisma.job.create({
    data: {
      userId: payload.requestedBy,
      type: payload.type === 'custom' ? 'report_generation' : `${payload.type}_report`,
      status: 'queued',
      meta: {
        ...payload,
        jobId: job.id,
        queuedAt: new Date().toISOString(),
      },
    },
  });

  console.log(`Enqueued report generation job ${job.id} for ${payload.userIds.length} users`);
  
  return { id: job.id! };
}

// Generate CSV content for leads
function generateLeadsCSV(leads: any[]): string {
  const headers = [
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

  const rows = leads.map(lead => [
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

  return [
    headers.join(','),
    ...rows.map(row => row.map(field => `"${field}"`).join(','))
  ].join('\n');
}

// Generate CSV content for campaigns
function generateCampaignsCSV(campaigns: any[]): string {
  const headers = [
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

  const rows = campaigns.map(campaign => {
    const totalSpend = campaign.metrics?.reduce((sum: number, metric: any) => sum + metric.spendCents, 0) || 0;
    const totalImpressions = campaign.metrics?.reduce((sum: number, metric: any) => sum + metric.impressions, 0) || 0;
    const totalClicks = campaign.metrics?.reduce((sum: number, metric: any) => sum + metric.clicks, 0) || 0;
    const totalConversions = campaign.metrics?.reduce((sum: number, metric: any) => sum + metric.conversions, 0) || 0;
    
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
      campaign.variants?.length || 0,
    ];
  });

  return [
    headers.join(','),
    ...rows.map(row => row.map(field => `"${field}"`).join(','))
  ].join('\n');
}

// Generate CSV content for metrics
function generateMetricsCSV(metrics: any[]): string {
  const headers = [
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

  const rows = metrics.map(metric => [
    metric.id,
    metric.campaignId,
    metric.campaign?.name || '',
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

  return [
    headers.join(','),
    ...rows.map(row => row.map(field => `"${field}"`).join(','))
  ].join('\n');
}

// Generate summary report
function generateSummaryReport(summary: any): string {
  return `
# Report Summary

## Period
- From: ${summary.period.from.toISOString().split('T')[0]}
- To: ${summary.period.to.toISOString().split('T')[0]}

## Overview
- Total Users: ${summary.totalUsers}
- Total Campaigns: ${summary.totalCampaigns}
- Total Leads: ${summary.totalLeads}
- Total Spend: $${(summary.totalSpendCents / 100).toFixed(2)}

## Performance Metrics
- Average CPL: $${summary.averageCpl.toFixed(2)}
- Average CTR: ${summary.averageCtr.toFixed(2)}%
- Average Conversion Rate: ${summary.averageConversionRate.toFixed(2)}%

## Top Performing Campaigns
${summary.topCampaigns.map((campaign: any, index: number) => 
  `${index + 1}. ${campaign.name} - $${(campaign.spendCents / 100).toFixed(2)} spend, ${campaign.leads} leads`
).join('\n')}

## Platform Breakdown
${summary.platformBreakdown.map((platform: any) => 
  `- ${platform.platform}: ${platform.campaigns} campaigns, $${(platform.spendCents / 100).toFixed(2)} spend, ${platform.leads} leads`
).join('\n')}
`;
}

// Process report generation job
export async function processReportJob(payload: ReportJobPayload): Promise<ReportJobResult> {
  console.log(`Processing report generation job for ${payload.userIds.length} users`);
  
  try {
    // Calculate date range
    let fromDate: Date;
    let toDate: Date;

    if (payload.from && payload.to) {
      fromDate = payload.from;
      toDate = payload.to;
    } else {
      toDate = new Date();
      if (payload.type === 'weekly') {
        fromDate = new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (payload.type === 'monthly') {
        fromDate = new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else {
        fromDate = new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
    }

    // Get data for all users
    const allLeads: any[] = [];
    const allCampaigns: any[] = [];
    const allMetrics: any[] = [];
    let totalSpendCents = 0;

    for (const userId of payload.userIds) {
      // Get leads
      if (payload.includeLeads) {
        const leads = await prisma.lead.findMany({
          where: {
            userId,
            createdAt: {
              gte: fromDate,
              lte: toDate,
            },
          },
        });
        allLeads.push(...leads);
      }

      // Get campaigns
      if (payload.includeCampaigns) {
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
                date: {
                  gte: fromDate,
                  lte: toDate,
                },
              },
            },
          },
        });
        allCampaigns.push(...campaigns);
      }

      // Get metrics
      if (payload.includeMetrics) {
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
        });
        allMetrics.push(...metrics);
        totalSpendCents += metrics.reduce((sum, metric) => sum + metric.spendCents, 0);
      }
    }

    // Generate summary
    const totalImpressions = allMetrics.reduce((sum, metric) => sum + metric.impressions, 0);
    const totalClicks = allMetrics.reduce((sum, metric) => sum + metric.clicks, 0);
    const totalConversions = allMetrics.reduce((sum, metric) => sum + metric.conversions, 0);
    const totalLeads = allLeads.length;

    const averageCpl = totalLeads > 0 ? totalSpendCents / totalLeads : 0;
    const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const averageConversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

    // Get top campaigns
    const topCampaigns = allCampaigns
      .map(campaign => {
        const campaignSpend = campaign.metrics?.reduce((sum: number, metric: any) => sum + metric.spendCents, 0) || 0;
        const campaignLeads = allLeads.filter(lead => 
          lead.metadata?.campaignId === campaign.id
        ).length;
        return {
          name: campaign.name,
          spendCents: campaignSpend,
          leads: campaignLeads,
        };
      })
      .sort((a, b) => b.spendCents - a.spendCents)
      .slice(0, 10);

    // Get platform breakdown
    const platformBreakdown = allCampaigns.reduce((acc, campaign) => {
      campaign.platforms.forEach((platform: string) => {
        if (!acc[platform]) {
          acc[platform] = {
            platform,
            campaigns: 0,
            spendCents: 0,
            leads: 0,
          };
        }
        acc[platform].campaigns += 1;
        acc[platform].spendCents += campaign.metrics?.reduce((sum: number, metric: any) => sum + metric.spendCents, 0) || 0;
        acc[platform].leads += allLeads.filter(lead => 
          lead.metadata?.platform === platform
        ).length;
      });
      return acc;
    }, {} as Record<string, any>);

    const summary = {
      totalUsers: payload.userIds.length,
      totalCampaigns: allCampaigns.length,
      totalLeads: totalLeads,
      totalSpendCents,
      period: { from: fromDate, to: toDate },
      averageCpl,
      averageCtr,
      averageConversionRate,
      topCampaigns,
      platformBreakdown: Object.values(platformBreakdown),
    };

    // Create archive
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on('data', (chunk) => {
      chunks.push(chunk);
    });

    // Add files to archive
    if (payload.includeLeads && allLeads.length > 0) {
      archive.append(generateLeadsCSV(allLeads), { name: 'leads.csv' });
    }

    if (payload.includeCampaigns && allCampaigns.length > 0) {
      archive.append(generateCampaignsCSV(allCampaigns), { name: 'campaigns.csv' });
    }

    if (payload.includeMetrics && allMetrics.length > 0) {
      archive.append(generateMetricsCSV(allMetrics), { name: 'metrics.csv' });
    }

    // Add summary report
    archive.append(generateSummaryReport(summary), { name: 'summary.md' });

    // Finalize archive
    await archive.finalize();

    // Wait for archive to complete
    await new Promise<void>((resolve, reject) => {
      archive.on('end', resolve);
      archive.on('error', reject);
    });

    // Combine chunks into buffer
    const buffer = Buffer.concat(chunks);

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${payload.type}-report-${timestamp}.zip`;

    // Upload to S3
    const outputKey = `reports/${payload.requestedBy}/${timestamp}/${filename}`;
    await uploadToS3(buffer, outputKey, 'application/zip');

    console.log(`Report generated successfully: ${outputKey}`);

    return {
      success: true,
      outputKey,
      filename,
      summary,
    };
  } catch (error) {
    console.error('Report generation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Schedule weekly reports
export async function scheduleWeeklyReports(): Promise<void> {
  try {
    // Get all active users
    const users = await prisma.user.findMany({
      where: {
        subscriptions: {
          some: {
            status: { in: ['active', 'trialing'] },
          },
        },
      },
      select: { id: true },
    });

    if (users.length === 0) {
      console.log('No active users found for weekly reports');
      return;
    }

    const userIds = users.map(user => user.id);

    // Enqueue weekly report job
    await enqueueReportJob({
      type: 'weekly',
      userIds,
      includeLeads: true,
      includeCampaigns: true,
      includeMetrics: true,
      requestedBy: 'system',
    });

    console.log(`Scheduled weekly reports for ${userIds.length} users`);
  } catch (error) {
    console.error('Failed to schedule weekly reports:', error);
  }
}

// Schedule monthly reports
export async function scheduleMonthlyReports(): Promise<void> {
  try {
    // Get all active users
    const users = await prisma.user.findMany({
      where: {
        subscriptions: {
          some: {
            status: { in: ['active', 'trialing'] },
          },
        },
      },
      select: { id: true },
    });

    if (users.length === 0) {
      console.log('No active users found for monthly reports');
      return;
    }

    const userIds = users.map(user => user.id);

    // Enqueue monthly report job
    await enqueueReportJob({
      type: 'monthly',
      userIds,
      includeLeads: true,
      includeCampaigns: true,
      includeMetrics: true,
      requestedBy: 'system',
    });

    console.log(`Scheduled monthly reports for ${userIds.length} users`);
  } catch (error) {
    console.error('Failed to schedule monthly reports:', error);
  }
}

// Send report email notification
export async function sendReportNotification(
  userId: string,
  reportType: string,
  downloadUrl: string,
  summary: any
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      console.error(`User ${userId} not found for report notification`);
      return;
    }

    await emailService.sendEmail({
      to: user.email,
      subject: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report Ready`,
      template: 'report_ready',
      data: {
        name: user.name || 'User',
        reportType,
        downloadUrl,
        summary: {
          totalCampaigns: summary.totalCampaigns,
          totalLeads: summary.totalLeads,
          totalSpend: (summary.totalSpendCents / 100).toFixed(2),
          period: {
            from: summary.period.from.toISOString().split('T')[0],
            to: summary.period.to.toISOString().split('T')[0],
          },
        },
      },
    });

    console.log(`Report notification sent to ${user.email}`);
  } catch (error) {
    console.error('Failed to send report notification:', error);
  }
}

export default reportsQueue;
