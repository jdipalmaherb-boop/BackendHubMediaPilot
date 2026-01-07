import { Worker } from 'bullmq';
import { AD_OPTIMIZATION_QUEUE } from '../queues/adQueue.js';
import { prisma } from '../lib/prisma.js';
import { env } from '../env.js';
import { generateVideoTips } from '../services/tipsGenerator.js';

interface OptimizationJobData {
  campaignId?: string;
  ownerId?: string;
  lookbackHours?: number;
  reason?: 'manual' | 'scheduled' | 'start-trigger';
}

const CONNECTION_CONFIG = {
  url: env.REDIS_URL || 'redis://localhost:6379',
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

const DEFAULT_LOOKBACK_HOURS = 72;
const MIN_IMPRESSIONS_FOR_DECISION = 100;
const MAX_BUDGET_MULTIPLIER = 2;
const BUDGET_INCREMENT = 1.2; // +20%
const PROFITABILITY_WINDOW_DAYS = 5;

function toNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : fallback;
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function logAction(input: {
  campaignId: string;
  variantId?: string | null;
  actionType: string;
  details?: Record<string, unknown>;
}) {
  const { campaignId, variantId, actionType, details } = input;
  await prisma.actionLog.create({
    data: {
      campaignId,
      variantId: variantId ?? null,
      actionType,
      details: details ?? null,
    },
  });
}

async function computeVariantMetrics(variantIds: string[], since: Date) {
  if (!variantIds.length) return new Map<string, ReturnType<typeof emptyMetrics>>();

  const grouped = await prisma.adMetric.groupBy({
    by: ['variantId'],
    where: {
      variantId: { in: variantIds },
      date: { gte: since },
    },
    _sum: {
      impressions: true,
      clicks: true,
      conversions: true,
      spend: true,
    },
  });

  const metrics = new Map<string, ReturnType<typeof emptyMetrics>>();
  for (const group of grouped) {
    const base = emptyMetrics();
    const impressions = group._sum.impressions ?? 0;
    const clicks = group._sum.clicks ?? 0;
    const conversions = group._sum.conversions ?? 0;
    const spend = group._sum.spend ?? 0;

    metrics.set(group.variantId, {
      impressions,
      clicks,
      conversions,
      spend,
      ctr: impressions > 0 ? clicks / impressions : 0,
      cpa: conversions > 0 ? spend / conversions : Infinity,
      conversionRate: clicks > 0 ? conversions / clicks : 0,
    });
  }

  return metrics;
}

function emptyMetrics() {
  return {
    impressions: 0,
    clicks: 0,
    conversions: 0,
    spend: 0,
    ctr: 0,
    cpa: Infinity,
    conversionRate: 0,
  };
}

async function maybeCreateMutationVariant(params: {
  campaignId: string;
  ownerId?: string | null;
  transcript?: string;
  context?: string;
  industry?: string;
  baseCreativeId?: string;
}) {
  const { campaignId, ownerId, transcript, context, industry, baseCreativeId } = params;

  const creative = baseCreativeId
    ? await prisma.adCreative.findUnique({ where: { id: baseCreativeId }, include: { campaign: true } })
    : await prisma.adCreative.findFirst({
        where: { campaignId },
        orderBy: { createdAt: 'desc' },
        include: { campaign: true },
      });

  if (!creative) return null;

  try {
    const tips = await generateVideoTips({
      transcript: transcript ?? creative.text ?? 'Generic offer',
      context: context ?? 'Paid social refresh',
      industry: industry ?? 'General',
    });

    const caption = tips.captionVariations[0] ?? creative.text ?? 'Fresh angle headline';
    const cta = tips.suggestedCta ?? creative.cta ?? 'Learn More';
    const headline = tips.thumbnailTextSuggestions[0] ?? creative.headline ?? 'New Offer';

    const variant = await prisma.adVariant.create({
      data: {
        campaignId,
        creativeId: creative.id,
        variantName: `Mutation ${new Date().toISOString()}`,
        creativeKey: creative.originalUrl ?? creative.processedUrl ?? 'creative',
        platform: 'meta',
        budgetCents: 0,
        targeting: creative.campaign?.audience ?? {},
        status: 'PENDING',
        testGroup: 'M',
        meta: {
          caption,
          cta,
          headline,
          mutationSource: 'optimizer',
          tips,
        },
      },
    });

    await logAction({
      campaignId,
      variantId: variant.id,
      actionType: 'variant_mutated',
      details: {
        caption,
        cta,
        headline,
      },
    });

    return variant;
  } catch (error) {
    await logAction({
      campaignId,
      actionType: 'variant_mutation_failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    return null;
  }
}

function subHours(date: Date, hours: number) {
  return new Date(date.getTime() - hours * 60 * 60 * 1000);
}

function differenceInHours(later: Date, earlier: Date) {
  return (later.getTime() - earlier.getTime()) / (60 * 60 * 1000);
}

async function evaluateCampaign(campaignId: string, options: { lookbackHours: number }) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      variants: true,
      creatives: true,
    },
  });

  if (!campaign) return null;
  if (campaign.status !== 'ACTIVE' || !campaign.autoOptimize) return null;

  const meta = (campaign.meta as Record<string, unknown> | null) ?? {};
  const targetCpa = toNumber(meta.targetCpa, 75);
  const minImpressions = toNumber(meta.minImpressions ?? MIN_IMPRESSIONS_FOR_DECISION, MIN_IMPRESSIONS_FOR_DECISION);
  const lookbackHours = toNumber(meta.optimizationWindowHours ?? options.lookbackHours, options.lookbackHours);
  const since = subHours(new Date(), lookbackHours);

  const variantIds = campaign.variants.map((v) => v.id);
  const metricsMap = await computeVariantMetrics(variantIds, since);

  const insights: string[] = [];
  const actions: Array<Record<string, unknown>> = [];

  if (!variantIds.length) {
    insights.push('No variants available for optimization.');
    return { campaign, insights, actions };
  }

  const variantSummaries = campaign.variants.map((variant) => {
    const metrics = metricsMap.get(variant.id) ?? emptyMetrics();
    return {
      variant,
      metrics,
    };
  });

  for (const summary of variantSummaries) {
    const { variant, metrics } = summary;
    if (metrics.impressions >= minImpressions && metrics.cpa > targetCpa && metrics.conversions === 0) {
      if (variant.status === 'ACTIVE') {
        await prisma.adVariant.update({ where: { id: variant.id }, data: { status: 'PAUSED' } });
        await logAction({
          campaignId: campaign.id,
          variantId: variant.id,
          actionType: 'variant_paused_cpa_too_high',
          details: { cpa: metrics.cpa, targetCpa, periodHours: lookbackHours },
        });
        actions.push({ type: 'pause', variantId: variant.id, cpa: metrics.cpa });
      }
    }

    if (metrics.ctr > 0.04 && metrics.conversions < 1) {
      insights.push(
        `Variant ${variant.variantName} has strong CTR ${(metrics.ctr * 100).toFixed(1)}% but low conversions. Review landing page.`
      );
      await logAction({
        campaignId: campaign.id,
        variantId: variant.id,
        actionType: 'insight_high_ctr_low_conv',
        details: metrics,
      });
    }
  }

  const activeVariants = variantSummaries.filter((entry) => entry.variant.status === 'ACTIVE' && entry.metrics.impressions >= minImpressions);
  if (activeVariants.length) {
    const sortedByPerformance = [...activeVariants].sort((a, b) => {
      if (b.metrics.conversions !== a.metrics.conversions) {
        return b.metrics.conversions - a.metrics.conversions;
      }
      return b.metrics.ctr - a.metrics.ctr;
    });

    const best = sortedByPerformance[0];
    const worst = sortedByPerformance[sortedByPerformance.length - 1];

    if (best && worst && best.variant.id !== worst.variant.id) {
      const budgetCap = Math.round(best.variant.budgetCents * MAX_BUDGET_MULTIPLIER);
      const proposedBudget = Math.min(Math.round(best.variant.budgetCents * BUDGET_INCREMENT), budgetCap);

      if (proposedBudget > best.variant.budgetCents) {
        await prisma.adVariant.update({
          where: { id: best.variant.id },
          data: { budgetCents: proposedBudget },
        });
        await logAction({
          campaignId: campaign.id,
          variantId: best.variant.id,
          actionType: 'budget_increase',
          details: { previous: best.variant.budgetCents, new: proposedBudget },
        });
        actions.push({ type: 'budget_increase', variantId: best.variant.id, budgetCents: proposedBudget });
      }

      if (worst.metrics.cpa > targetCpa && worst.variant.status === 'ACTIVE') {
        await prisma.adVariant.update({ where: { id: worst.variant.id }, data: { status: 'PAUSED' } });
        await logAction({
          campaignId: campaign.id,
          variantId: worst.variant.id,
          actionType: 'variant_paused_low_performance',
          details: worst.metrics,
        });
        actions.push({ type: 'pause', variantId: worst.variant.id });
      }
    }
  }

  const totalSpend = variantSummaries.reduce((sum, entry) => sum + entry.metrics.spend, 0);
  const totalConversions = variantSummaries.reduce((sum, entry) => sum + entry.metrics.conversions, 0);
  const campaignCpa = totalConversions > 0 ? totalSpend / totalConversions : Infinity;

  if (campaignCpa > targetCpa) {
    const mutation = await maybeCreateMutationVariant({
      campaignId: campaign.id,
      ownerId: campaign.ownerId,
      baseCreativeId: campaign.creatives[0]?.id,
    });
    if (mutation) {
      actions.push({ type: 'mutation_created', variantId: mutation.id });
    }
  }

  const campaignDuration = campaign.startedAt ? differenceInHours(new Date(), campaign.startedAt) / 24 : 0;
  if (campaignDuration >= PROFITABILITY_WINDOW_DAYS && campaignCpa > targetCpa) {
    const metaUpdates = {
      ...(meta || {}),
      retargetingPoolActivated: true,
      lastOptimizationSuggestion: new Date().toISOString(),
    };

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: 'PAUSED',
        meta: metaUpdates,
      },
    });

    insights.push('Campaign paused and moved to retargeting pool due to persistent unprofitability.');
    await logAction({
      campaignId: campaign.id,
      actionType: 'campaign_shift_to_retargeting',
      details: { campaignCpa, targetCpa },
    });
    actions.push({ type: 'campaign_paused_retargeting' });
  }

  return { campaign, insights, actions };
}

export const adOptimizerWorker = new Worker<OptimizationJobData>(
  AD_OPTIMIZATION_QUEUE,
  async (job) => {
    const lookbackHours = job.data.lookbackHours ?? DEFAULT_LOOKBACK_HOURS;

    const campaigns = job.data.campaignId
      ? [job.data.campaignId]
      : (
          await prisma.campaign.findMany({
            where: {
              status: 'ACTIVE',
              autoOptimize: true,
            },
            select: { id: true },
          })
        ).map((c) => c.id);

    const results = [] as Array<ReturnType<typeof evaluateCampaign> extends Promise<infer R> ? R : never>;

    for (const campaignId of campaigns) {
      const evaluated = await evaluateCampaign(campaignId, { lookbackHours });
      if (evaluated) {
        results.push(evaluated);
      }
    }

    await job.updateProgress(100);

    return {
      campaignsProcessed: campaigns.length,
      results: results.map((r) => ({
        campaignId: r?.campaign.id,
        actions: r?.actions,
        insights: r?.insights,
      })),
    };
  },
  {
    connection: CONNECTION_CONFIG,
    concurrency: env.AD_OPTIMIZER_CONCURRENCY ? Number(env.AD_OPTIMIZER_CONCURRENCY) : 2,
  }
);

adOptimizerWorker.on('completed', (job, result) => {
  console.log(`[ad-optimizer] job ${job.id} completed`, result);
});

adOptimizerWorker.on('failed', (job, err) => {
  console.error(`[ad-optimizer] job ${job?.id} failed:`, err);
});

process.on('SIGINT', async () => {
  console.log('[ad-optimizer] shutting down');
  await adOptimizerWorker.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[ad-optimizer] shutting down');
  await adOptimizerWorker.close();
  process.exit(0);
});
