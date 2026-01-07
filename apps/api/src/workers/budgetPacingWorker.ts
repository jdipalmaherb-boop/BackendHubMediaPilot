import cron from 'node-cron';
import axios from 'axios';
import { prisma } from '../lib/prisma';
import { log } from '../lib/logger';
import { env } from '../env';

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const BUDGET_PACING_THRESHOLD_OVER = 1.1; // 110%
const BUDGET_PACING_THRESHOLD_UNDER = 0.7; // 70%

interface BudgetAlert {
  campaignId: string;
  campaignName: string;
  dailyBudget: number;
  actualSpend: number;
  percentage: number;
  type: 'overspending' | 'underspending';
}

/**
 * Check budget pacing for a campaign
 */
async function checkCampaignBudgetPacing(campaignId: string): Promise<BudgetAlert | null> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get budget tracking for today
  const budgetTracking = await prisma.adBudgetTracking.findUnique({
    where: {
      campaignId_date: {
        campaignId,
        date: today,
      },
    },
  });

  if (!budgetTracking) {
    // Try to get from campaign budget
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        name: true,
        budgetDaily: true,
      },
    });

    if (!campaign || !campaign.budgetDaily) {
      return null;
    }

    // Calculate actual spend from metrics
    const metrics = await prisma.campaignMetrics.findMany({
      where: {
        campaignId,
        date: { gte: today },
        metricType: 'ACTUAL',
      },
    });

    const actualSpend = metrics.reduce((sum, m) => sum + m.spendCents, 0) / 100; // Convert to dollars
    const dailyBudget = Number(campaign.budgetDaily);
    const percentage = dailyBudget > 0 ? (actualSpend / dailyBudget) * 100 : 0;

    // Check thresholds
    if (percentage >= BUDGET_PACING_THRESHOLD_OVER * 100) {
      return {
        campaignId,
        campaignName: campaign.name,
        dailyBudget,
        actualSpend,
        percentage,
        type: 'overspending',
      };
    } else if (percentage <= BUDGET_PACING_THRESHOLD_UNDER * 100 && actualSpend > 0) {
      return {
        campaignId,
        campaignName: campaign.name,
        dailyBudget,
        actualSpend,
        percentage,
        type: 'underspending',
      };
    }

    return null;
  }

  // Check if warning already sent
  if (budgetTracking.warningSent) {
    return null;
  }

  const dailyBudget = budgetTracking.dailyBudget / 100; // Convert to dollars
  const actualSpend = budgetTracking.actualSpend / 100;
  const percentage = dailyBudget > 0 ? (actualSpend / dailyBudget) * 100 : 0;

  // Check thresholds
  if (percentage >= BUDGET_PACING_THRESHOLD_OVER * 100) {
    return {
      campaignId,
      campaignName: '', // Will be fetched if needed
      dailyBudget,
      actualSpend,
      percentage,
      type: 'overspending',
    };
  } else if (percentage <= BUDGET_PACING_THRESHOLD_UNDER * 100 && actualSpend > 0) {
    return {
      campaignId,
      campaignName: '',
      dailyBudget,
      actualSpend,
      percentage,
      type: 'underspending',
    };
  }

  return null;
}

/**
 * Get campaign name
 */
async function getCampaignName(campaignId: string): Promise<string> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { name: true },
  });
  return campaign?.name || 'Unknown Campaign';
}

/**
 * Send budget alert to Slack
 */
async function sendBudgetAlert(alert: BudgetAlert): Promise<void> {
  if (!SLACK_WEBHOOK_URL) {
    log.warn('Slack webhook URL not configured, skipping budget alert');
    return;
  }

  const emoji = alert.type === 'overspending' ? '🚨' : '⚠️';
  const title = alert.type === 'overspending' 
    ? `🚨 *Overspend Alert:* Campaign ${alert.campaignName} has spent ${alert.percentage.toFixed(1)}% of its budget ($${alert.actualSpend.toFixed(2)}/$${alert.dailyBudget.toFixed(2)}). It is exceeding the budget!`
    : `⚠️ *Underspend Alert:* Campaign ${alert.campaignName} has only spent ${alert.percentage.toFixed(1)}% of its budget so far ($${alert.actualSpend.toFixed(2)}/$${alert.dailyBudget.toFixed(2)}). It may not fully deliver.`;

  const message = {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: title,
        },
      },
    ],
  };

  try {
    await axios.post(SLACK_WEBHOOK_URL, message, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    log.info('Budget alert sent to Slack', { campaignId: alert.campaignId, type: alert.type });
  } catch (error) {
    log.error('Failed to send budget alert to Slack', error as Error, {
      campaignId: alert.campaignId,
    });
    // Don't throw - Slack failures shouldn't break budget monitoring
  }
}

/**
 * Update budget tracking
 */
async function updateBudgetTracking(campaignId: string, alert: BudgetAlert): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.adBudgetTracking.upsert({
    where: {
      campaignId_date: {
        campaignId,
        date: today,
      },
    },
    update: {
      warningSent: true,
      updatedAt: new Date(),
    },
    create: {
      userId: '', // Will be set from campaign
      campaignId,
      dailyBudget: alert.dailyBudget * 100, // Convert to cents
      actualSpend: alert.actualSpend * 100,
      warningSent: true,
      date: today,
    },
  });
}

/**
 * Check all active campaigns for budget pacing
 */
async function checkAllCampaignsBudgetPacing(): Promise<void> {
  try {
    log.info('Checking budget pacing for all active campaigns');

    const campaigns = await prisma.campaign.findMany({
      where: {
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    log.info(`Checking ${campaigns.length} active campaigns`);

    const alerts: BudgetAlert[] = [];

    for (const campaign of campaigns) {
      try {
        const alert = await checkCampaignBudgetPacing(campaign.id);
        if (alert) {
          // Fetch campaign name if not available
          if (!alert.campaignName) {
            alert.campaignName = await getCampaignName(campaign.id);
          }
          alerts.push(alert);
        }
      } catch (error) {
        log.error('Error checking budget pacing for campaign', error as Error, {
          campaignId: campaign.id,
        });
      }
    }

    // Send alerts and update tracking
    for (const alert of alerts) {
      try {
        await sendBudgetAlert(alert);
        await updateBudgetTracking(alert.campaignId, alert);

        // Also log to ActionLog
        await prisma.actionLog.create({
          data: {
            campaignId: alert.campaignId,
            actionType: `budget_pacing_${alert.type}`,
            details: {
              dailyBudget: alert.dailyBudget,
              actualSpend: alert.actualSpend,
              percentage: alert.percentage,
            },
          },
        });
      } catch (error) {
        log.error('Error processing budget alert', error as Error, {
          campaignId: alert.campaignId,
        });
      }
    }

    log.info(`Budget pacing check completed. ${alerts.length} alerts sent.`);
  } catch (error) {
    log.error('Error checking budget pacing', error as Error);
    throw error;
  }
}

/**
 * Start the budget pacing worker
 */
export function startBudgetPacingWorker(): void {
  log.info('Starting budget pacing worker');

  // Run every hour
  cron.schedule('0 * * * *', async () => {
    log.info('Running scheduled budget pacing check');
    try {
      await checkAllCampaignsBudgetPacing();
    } catch (error) {
      log.error('Error in scheduled budget pacing check', error as Error);
    }
  });

  log.info('Budget pacing worker started (runs hourly)');
}

// Auto-start if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startBudgetPacingWorker();
  
  // Keep process alive
  process.on('SIGTERM', () => {
    log.info('Budget pacing worker shutting down');
    process.exit(0);
  });
  
  process.on('SIGINT', () => {
    log.info('Budget pacing worker shutting down');
    process.exit(0);
  });
}

