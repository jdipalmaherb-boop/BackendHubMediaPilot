import cron from 'node-cron';
import axios from 'axios';
import { prisma } from '../lib/prisma';
import { log } from '../lib/logger';
import { env } from '../env';

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const DAILY_SUMMARY_TIME = process.env.DAILY_SUMMARY_TIME || '08:00';

interface CampaignPerformance {
  campaignId: string;
  campaignName: string;
  platform: string;
  ctr: number;
  cpc: number;
  roas: number;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

interface CreativePerformance {
  creativeId: string;
  headline: string;
  ctr: number;
  cpc: number;
  roas: number;
  impressions: number;
}

interface OptimizationAction {
  campaignId: string;
  action: string;
  reason: string;
  timestamp: Date;
}

/**
 * Get top performing creatives
 */
async function getTopPerformingCreatives(userId: string, days: number = 7): Promise<CreativePerformance[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get ad metrics for the user's campaigns
  const campaigns = await prisma.campaign.findMany({
    where: { userId },
    select: { id: true },
  });

  const campaignIds = campaigns.map(c => c.id);

  const metrics = await prisma.adMetric.findMany({
    where: {
      variant: {
        campaignId: { in: campaignIds },
      },
      date: { gte: startDate },
    },
    include: {
      variant: {
        include: {
          creative: {
            select: {
              id: true,
              headline: true,
            },
          },
        },
      },
    },
    orderBy: { date: 'desc' },
  });

  // Aggregate by creative
  const creativeMap = new Map<string, {
    headline: string;
    impressions: number;
    clicks: number;
    spend: number;
    conversions: number;
  }>();

  for (const metric of metrics) {
    const creativeId = metric.variant.creativeId;
    if (!creativeId || !metric.variant.creative) continue;

    const existing = creativeMap.get(creativeId) || {
      headline: metric.variant.creative.headline || 'Untitled',
      impressions: 0,
      clicks: 0,
      spend: 0,
      conversions: 0,
    };

    existing.impressions += metric.impressions;
    existing.clicks += metric.clicks;
    existing.spend += metric.spend;
    existing.conversions += metric.conversions;

    creativeMap.set(creativeId, existing);
  }

  // Calculate metrics and sort
  const creatives: CreativePerformance[] = Array.from(creativeMap.entries())
    .map(([creativeId, data]) => {
      const ctr = data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0;
      const cpc = data.clicks > 0 ? data.spend / data.clicks : 0;
      const roas = data.spend > 0 ? (data.conversions * 50) / data.spend : 0; // Assume $50 per conversion

      return {
        creativeId,
        headline: data.headline,
        ctr,
        cpc,
        roas,
        impressions: data.impressions,
      };
    })
    .sort((a, b) => b.ctr - a.ctr)
    .slice(0, 5); // Top 5

  return creatives;
}

/**
 * Get campaign performance summary
 */
async function getCampaignPerformance(userId: string, days: number = 1): Promise<CampaignPerformance[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const campaigns = await prisma.campaign.findMany({
    where: {
      userId,
      status: 'ACTIVE',
    },
    include: {
      variants: {
        include: {
          adMetrics: {
            where: {
              date: { gte: startDate },
            },
          },
        },
      },
    },
  });

  const performance: CampaignPerformance[] = [];

  for (const campaign of campaigns) {
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalSpend = 0;
    let totalConversions = 0;

    for (const variant of campaign.variants) {
      for (const metric of variant.adMetrics) {
        totalImpressions += metric.impressions;
        totalClicks += metric.clicks;
        totalSpend += metric.spend;
        totalConversions += metric.conversions;
      }
    }

    if (totalImpressions === 0) continue;

    const ctr = (totalClicks / totalImpressions) * 100;
    const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const roas = totalSpend > 0 ? (totalConversions * 50) / totalSpend : 0;

    performance.push({
      campaignId: campaign.id,
      campaignName: campaign.name,
      platform: campaign.platforms[0] || 'unknown',
      ctr,
      cpc,
      roas,
      spend: totalSpend,
      impressions: totalImpressions,
      clicks: totalClicks,
      conversions: totalConversions,
    });
  }

  return performance.sort((a, b) => b.ctr - a.ctr);
}

/**
 * Get recent optimizations
 */
async function getRecentOptimizations(userId: string, days: number = 1): Promise<OptimizationAction[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const campaigns = await prisma.campaign.findMany({
    where: { userId },
    select: { id: true },
  });

  const campaignIds = campaigns.map(c => c.id);

  const optimizations = await prisma.optimizationLog.findMany({
    where: {
      campaignId: { in: campaignIds },
      timestamp: { gte: startDate },
    },
    select: {
      campaignId: true,
      action: true,
      reason: true,
      timestamp: true,
    },
    orderBy: { timestamp: 'desc' },
    take: 10,
  });

  return optimizations.map(opt => ({
    campaignId: opt.campaignId,
    action: opt.action,
    reason: opt.reason,
    timestamp: opt.timestamp,
  }));
}

/**
 * Format Slack message
 */
function formatSlackMessage(
  topCreatives: CreativePerformance[],
  campaignPerformance: CampaignPerformance[],
  optimizations: OptimizationAction[],
  newSuggestions: string[]
): any {
  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '📊 Daily Campaign Summary',
        emoji: true,
      },
    },
    {
      type: 'divider',
    },
  ];

  // Top performing creatives
  if (topCreatives.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*🏆 Top Performing Creatives (Last 7 Days)*',
      },
    });

    for (const creative of topCreatives) {
      blocks.push({
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*${creative.headline}*\nCTR: ${creative.ctr.toFixed(2)}%\nCPC: $${creative.cpc.toFixed(2)}\nROAS: ${creative.roas.toFixed(2)}x`,
          },
        ],
      });
    }

    blocks.push({ type: 'divider' });
  }

  // Campaign performance
  if (campaignPerformance.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*📈 Campaign Performance (Today)*',
      },
    });

    for (const campaign of campaignPerformance.slice(0, 5)) {
      blocks.push({
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*${campaign.campaignName}*\nPlatform: ${campaign.platform}\nCTR: ${campaign.ctr.toFixed(2)}%\nCPC: $${campaign.cpc.toFixed(2)}\nROAS: ${campaign.roas.toFixed(2)}x\nSpend: $${(campaign.spend / 100).toFixed(2)}`,
          },
        ],
      });
    }

    blocks.push({ type: 'divider' });
  }

  // Optimizations
  if (optimizations.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*⚙️ AI Optimizations Made*',
      },
    });

    for (const opt of optimizations.slice(0, 5)) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${opt.action}*\nReason: ${opt.reason}\nTime: ${opt.timestamp.toLocaleString()}`,
        },
      });
    }

    blocks.push({ type: 'divider' });
  }

  // New suggestions
  if (newSuggestions.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*💡 New Creative Suggestions*\n' + newSuggestions.map(s => `• ${s}`).join('\n'),
      },
    });
  }

  return {
    blocks,
  };
}

/**
 * Send Slack notification
 */
async function sendSlackNotification(message: any): Promise<void> {
  if (!SLACK_WEBHOOK_URL) {
    log.warn('Slack webhook URL not configured, skipping notification');
    return;
  }

  try {
    await axios.post(SLACK_WEBHOOK_URL, message, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    log.info('Slack notification sent successfully');
  } catch (error) {
    log.error('Failed to send Slack notification', error as Error);
    throw error;
  }
}

/**
 * Generate daily summary for a user
 */
async function generateDailySummary(userId: string): Promise<void> {
  try {
    log.info('Generating daily summary', { userId });

    const topCreatives = await getTopPerformingCreatives(userId, 7);
    const campaignPerformance = await getCampaignPerformance(userId, 1);
    const optimizations = await getRecentOptimizations(userId, 1);

    // Generate new creative suggestions (simplified - could use GPT)
    const newSuggestions = [
      'Try A/B testing different hooks in your top performers',
      'Consider creating Reels versions of your best-performing feed posts',
      'Test shorter video formats (15-30s) for better engagement',
    ];

    const message = formatSlackMessage(
      topCreatives,
      campaignPerformance,
      optimizations,
      newSuggestions
    );

    await sendSlackNotification(message);

    log.info('Daily summary generated and sent', { userId });
  } catch (error) {
    log.error('Failed to generate daily summary', error as Error, { userId });
    throw error;
  }
}

/**
 * Generate daily summaries for all active users
 */
async function generateAllDailySummaries(): Promise<void> {
  try {
    // Get all users with active campaigns
    const users = await prisma.user.findMany({
      where: {
        campaigns: {
          some: {
            status: 'ACTIVE',
          },
        },
      },
      select: { id: true },
    });

    log.info(`Generating daily summaries for ${users.length} users`);

    // Generate summaries in parallel (with concurrency limit)
    const concurrency = 5;
    for (let i = 0; i < users.length; i += concurrency) {
      const batch = users.slice(i, i + concurrency);
      await Promise.allSettled(
        batch.map(user => generateDailySummary(user.id))
      );
    }

    log.info('All daily summaries generated');
  } catch (error) {
    log.error('Failed to generate all daily summaries', error as Error);
    throw error;
  }
}

/**
 * Parse time string (HH:MM) and return cron expression
 */
function parseTimeToCron(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  return `${minutes} ${hours} * * *`; // Every day at specified time
}

/**
 * Start the daily summary worker
 */
export function startDailySlackSummaryWorker(): void {
  if (!SLACK_WEBHOOK_URL) {
    log.warn('Slack webhook URL not configured, daily summary worker will not start');
    return;
  }

  const cronExpression = parseTimeToCron(DAILY_SUMMARY_TIME);
  
  log.info('Starting daily Slack summary worker', {
    cronExpression,
    summaryTime: DAILY_SUMMARY_TIME,
  });

  // Schedule daily summary
  cron.schedule(cronExpression, async () => {
    log.info('Running scheduled daily summary');
    try {
      await generateAllDailySummaries();
    } catch (error) {
      log.error('Error in scheduled daily summary', error as Error);
    }
  });

  log.info('Daily Slack summary worker started');
}

// Auto-start if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startDailySlackSummaryWorker();
  
  // Keep process alive
  process.on('SIGTERM', () => {
    log.info('Daily Slack summary worker shutting down');
    process.exit(0);
  });
  
  process.on('SIGINT', () => {
    log.info('Daily Slack summary worker shutting down');
    process.exit(0);
  });
}


