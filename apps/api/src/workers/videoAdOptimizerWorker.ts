/**
 * Video Ad Optimization Worker
 * 
 * Polls Meta API for ad insights and automatically optimizes campaigns
 * based on performance metrics (CTR, CPM, conversions)
 * 
 * Runs periodically (every few hours) to:
 * - Fetch metrics from Meta API
 * - Identify underperforming ads (low CTR, high CPM)
 * - Pause underperforming ads
 * - Log optimization actions
 */

import { Worker } from 'bullmq';
import { prisma } from '../lib/prisma.js';
import { env } from '../env.js';
import { fetchMetaAdInsights, pauseMetaAd, isMetaConfigured } from '../services/metaAds.js';
import { log } from '../lib/logger.js';
import { VIDEO_AD_OPTIMIZATION_QUEUE } from '../queues/adQueue.js';

const OPTIMIZATION_QUEUE = VIDEO_AD_OPTIMIZATION_QUEUE;
const CONNECTION_CONFIG = {
  url: env.REDIS_URL || 'redis://localhost:6379',
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

// Optimization thresholds
const MIN_CTR_THRESHOLD = 0.5; // 0.5% CTR minimum
const MAX_CPM_THRESHOLD = 15.0; // $15 CPM maximum
const MIN_IMPRESSIONS_FOR_DECISION = 1000; // Need at least 1000 impressions to make decisions

interface OptimizationJobData {
  campaignId?: string;
  lookbackHours?: number;
}

/**
 * Fetch and update metrics for a variant from Meta API
 */
async function updateVariantMetricsFromMeta(
  variantId: string,
  externalId: string,
  lookbackDays: number = 7
): Promise<void> {
  if (!isMetaConfigured()) {
    log.warn({
      type: 'meta_not_configured',
      variantId,
    }, 'Meta API not configured, skipping metric update');
    return;
  }

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - lookbackDays);

    const insights = await fetchMetaAdInsights(
      externalId,
      {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
      }
    );

    // Aggregate insights data
    const aggregated = insights.reduce(
      (acc, insight) => {
        acc.impressions += parseInt(insight.impressions || '0', 10);
        acc.clicks += parseInt(insight.clicks || '0', 10);
        acc.spend += parseFloat(insight.spend || '0');
        acc.conversions += parseInt(insight.conversions || '0', 10);
        return acc;
      },
      { impressions: 0, clicks: 0, spend: 0, conversions: 0 }
    );

    if (aggregated.impressions === 0) {
      log.debug({
        type: 'no_metrics_found',
        variantId,
        externalId,
      }, 'No metrics found for variant');
      return;
    }

    const ctr = (aggregated.clicks / aggregated.impressions) * 100;
    const cpm = aggregated.impressions > 0 ? (aggregated.spend / aggregated.impressions) * 1000 : 0;
    const cpc = aggregated.clicks > 0 ? aggregated.spend / aggregated.clicks : 0;

    // Update or create AdMetric record for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if metric exists for today
    const existingMetric = await prisma.adMetric.findFirst({
      where: {
        variantId,
        date: today,
      },
    });

    if (existingMetric) {
      await prisma.adMetric.update({
        where: { id: existingMetric.id },
        data: {
          impressions: aggregated.impressions,
          clicks: aggregated.clicks,
          spend: aggregated.spend,
          conversions: aggregated.conversions,
          ctr,
          cpm,
          cpc,
          raw: insights,
        },
      });
    } else {
      await prisma.adMetric.create({
        data: {
          variantId,
          date: today,
          impressions: aggregated.impressions,
          clicks: aggregated.clicks,
          spend: aggregated.spend,
          conversions: aggregated.conversions,
          ctr,
          cpm,
          cpc,
          raw: insights,
        },
      });
    }

    log.info({
      type: 'metrics_updated',
      variantId,
      impressions: aggregated.impressions,
      clicks: aggregated.clicks,
      ctr: ctr.toFixed(2),
      cpm: cpm.toFixed(2),
    }, 'Variant metrics updated from Meta API');
  } catch (error) {
    log.error({
      type: 'metric_update_failed',
      variantId,
      externalId,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Failed to update variant metrics from Meta');
  }
}

/**
 * Evaluate and optimize a single variant
 */
async function optimizeVariant(
  variant: {
    id: string;
    externalId: string | null;
    status: string;
    campaignId: string;
  },
  metrics: {
    impressions: number;
    clicks: number;
    ctr: number | null;
    cpm: number | null;
    spend: number;
    conversions: number;
  }
): Promise<{ action: string; reason: string } | null> {
  // Need sufficient data to make decisions
  if (metrics.impressions < MIN_IMPRESSIONS_FOR_DECISION) {
    return null;
  }

  const ctr = metrics.ctr || (metrics.clicks / metrics.impressions) * 100;
  const cpm = metrics.cpm || (metrics.impressions > 0 ? (metrics.spend / metrics.impressions) * 1000 : 0);

  // Check if ad should be paused
  if (variant.status === 'ACTIVE' && variant.externalId) {
    if (ctr < MIN_CTR_THRESHOLD) {
      try {
        await pauseMetaAd(variant.externalId);
        await prisma.adVariant.update({
          where: { id: variant.id },
          data: { status: 'PAUSED' },
        });

        await prisma.optimizationLog.create({
          data: {
            campaignId: variant.campaignId,
            variantId: variant.id,
            reason: `Low CTR: ${ctr.toFixed(2)}% (threshold: ${MIN_CTR_THRESHOLD}%)`,
            action: 'pause_ad',
            details: {
              ctr,
              impressions: metrics.impressions,
              clicks: metrics.clicks,
            },
          },
        });

        log.info({
          type: 'ad_paused_low_ctr',
          variantId: variant.id,
          ctr: ctr.toFixed(2),
        }, 'Ad paused due to low CTR');

        return {
          action: 'pause_ad',
          reason: `Low CTR: ${ctr.toFixed(2)}%`,
        };
      } catch (error) {
        log.error({
          type: 'pause_ad_failed',
          variantId: variant.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        }, 'Failed to pause ad');
      }
    }

    if (cpm > MAX_CPM_THRESHOLD) {
      try {
        await pauseMetaAd(variant.externalId);
        await prisma.adVariant.update({
          where: { id: variant.id },
          data: { status: 'PAUSED' },
        });

        await prisma.optimizationLog.create({
          data: {
            campaignId: variant.campaignId,
            variantId: variant.id,
            reason: `High CPM: $${cpm.toFixed(2)} (threshold: $${MAX_CPM_THRESHOLD})`,
            action: 'pause_ad',
            details: {
              cpm,
              impressions: metrics.impressions,
              spend: metrics.spend,
            },
          },
        });

        log.info({
          type: 'ad_paused_high_cpm',
          variantId: variant.id,
          cpm: cpm.toFixed(2),
        }, 'Ad paused due to high CPM');

        return {
          action: 'pause_ad',
          reason: `High CPM: $${cpm.toFixed(2)}`,
        };
      } catch (error) {
        log.error({
          type: 'pause_ad_failed',
          variantId: variant.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        }, 'Failed to pause ad');
      }
    }
  }

  return null;
}

/**
 * Process optimization for a campaign
 */
async function optimizeCampaign(campaignId: string, lookbackHours: number = 72): Promise<void> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      variants: {
        where: {
          platform: 'meta',
          externalId: { not: null },
        },
      },
    },
  });

  if (!campaign || campaign.status !== 'ACTIVE') {
    return;
  }

  log.info({
    type: 'optimization_started',
    campaignId,
    variantCount: campaign.variants.length,
  }, 'Starting campaign optimization');

  const since = new Date();
  since.setHours(since.getHours() - lookbackHours);

  // Fetch and update metrics from Meta for each variant
  for (const variant of campaign.variants) {
    if (variant.externalId) {
      await updateVariantMetricsFromMeta(variant.id, variant.externalId, Math.ceil(lookbackHours / 24));
    }
  }

  // Get aggregated metrics for each variant
  const variantMetrics = await prisma.adMetric.groupBy({
    by: ['variantId'],
    where: {
      variantId: { in: campaign.variants.map(v => v.id) },
      date: { gte: since },
    },
    _sum: {
      impressions: true,
      clicks: true,
      spend: true,
      conversions: true,
    },
    _avg: {
      ctr: true,
      cpm: true,
    },
  });

  const metricsMap = new Map(
    variantMetrics.map(m => [
      m.variantId,
      {
        impressions: m._sum.impressions || 0,
        clicks: m._sum.clicks || 0,
        spend: m._sum.spend || 0,
        conversions: m._sum.conversions || 0,
        ctr: m._avg.ctr,
        cpm: m._avg.cpm,
      },
    ])
  );

  // Optimize each variant
  const actions: Array<{ variantId: string; action: string; reason: string }> = [];
  for (const variant of campaign.variants) {
    const metrics = metricsMap.get(variant.id) || {
      impressions: 0,
      clicks: 0,
      spend: 0,
      conversions: 0,
      ctr: null,
      cpm: null,
    };

    const result = await optimizeVariant(variant, metrics);
    if (result) {
      actions.push({
        variantId: variant.id,
        ...result,
      });
    }
  }

  log.info({
    type: 'optimization_completed',
    campaignId,
    actionsTaken: actions.length,
    actions,
  }, 'Campaign optimization completed');
}

/**
 * Worker that processes optimization jobs
 */
export const videoAdOptimizerWorker = new Worker<OptimizationJobData>(
  OPTIMIZATION_QUEUE,
  async (job) => {
    const { campaignId, lookbackHours = 72 } = job.data;

    if (campaignId) {
      // Optimize specific campaign
      await optimizeCampaign(campaignId, lookbackHours);
    } else {
      // Optimize all active campaigns
      const activeCampaigns = await prisma.campaign.findMany({
        where: {
          status: 'ACTIVE',
          platforms: { has: 'meta' },
        },
        select: { id: true },
      });

      log.info({
        type: 'bulk_optimization_started',
        campaignCount: activeCampaigns.length,
      }, 'Starting bulk optimization for all active campaigns');

      for (const campaign of activeCampaigns) {
        await optimizeCampaign(campaign.id, lookbackHours);
      }
    }

    await job.updateProgress(100);
  },
  {
    connection: CONNECTION_CONFIG,
    concurrency: env.AD_OPTIMIZER_CONCURRENCY || 2,
  }
);

videoAdOptimizerWorker.on('completed', (job) => {
  log.info({
    type: 'optimization_job_completed',
    jobId: job.id,
  }, 'Optimization job completed');
});

videoAdOptimizerWorker.on('failed', (job, err) => {
  log.error({
    type: 'optimization_job_failed',
    jobId: job?.id,
    error: err.message,
  }, 'Optimization job failed');
});

videoAdOptimizerWorker.on('error', (err) => {
  log.error({
    type: 'optimization_worker_error',
    error: err.message,
  }, 'Optimization worker error');
});

log.info({
  type: 'optimization_worker_started',
}, 'Video ad optimization worker started');

// Graceful shutdown
process.on('SIGTERM', async () => {
  log.info({ type: 'optimization_worker_shutdown' }, 'Shutting down optimization worker');
  await videoAdOptimizerWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  log.info({ type: 'optimization_worker_shutdown' }, 'Shutting down optimization worker');
  await videoAdOptimizerWorker.close();
  process.exit(0);
});

