import { Router, Request, Response } from 'express';
import register, { metrics } from '../lib/metrics';
import { log } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { gohighlevelQueue } from '../services/gohighlevel';
import { schedulerQueue } from '../queues/schedulerQueue';
import { reportsQueue } from '../jobs/generateReports';
import { videoQueue } from '../queues/videoQueue';

const router = Router();

/**
 * GET /metrics
 * Expose Prometheus metrics
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Update dynamic metrics before exposing
    await updateDynamicMetrics();

    // Get metrics in Prometheus format
    const metricsData = await register.metrics();
    
    res.setHeader('Content-Type', register.contentType);
    res.send(metricsData);
  } catch (error) {
    log.error(req.reqId, error as Error, {
      endpoint: '/metrics',
      operation: 'get_metrics',
    });
    
    res.status(500).json({
      error: 'Failed to collect metrics',
      code: 'METRICS_ERROR'
    });
  }
});

/**
 * GET /metrics/health
 * Health check endpoint for metrics collection
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Check if we can collect basic metrics
    const testMetrics = await register.metrics();
    
    res.json({
      status: 'healthy',
      metricsAvailable: testMetrics.length > 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error(req.reqId, error as Error, {
      endpoint: '/metrics/health',
      operation: 'health_check',
    });
    
    res.status(500).json({
      status: 'unhealthy',
      error: 'Metrics collection failed',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /metrics/summary
 * Get a summary of key metrics in JSON format
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const summary = await getMetricsSummary();
    
    res.json({
      success: true,
      data: summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error(req.reqId, error as Error, {
      endpoint: '/metrics/summary',
      operation: 'get_summary',
    });
    
    res.status(500).json({
      error: 'Failed to get metrics summary',
      code: 'METRICS_SUMMARY_ERROR'
    });
  }
});

/**
 * POST /metrics/reset
 * Reset all metrics (admin only - for testing)
 */
router.post('/reset', async (req: Request, res: Response) => {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        error: 'Metrics reset not allowed in production',
        code: 'FORBIDDEN'
      });
    }

    // Reset all metrics
    register.clear();
    
    log.info(req.reqId, 'Metrics reset requested', {
      userId: req.user?.id,
      endpoint: '/metrics/reset',
    });
    
    res.json({
      success: true,
      message: 'Metrics reset successfully',
    });
  } catch (error) {
    log.error(req.reqId, error as Error, {
      endpoint: '/metrics/reset',
      operation: 'reset_metrics',
    });
    
    res.status(500).json({
      error: 'Failed to reset metrics',
      code: 'METRICS_RESET_ERROR'
    });
  }
});

/**
 * Update dynamic metrics that change over time
 */
async function updateDynamicMetrics(): Promise<void> {
  try {
    // Update queue metrics
    await updateQueueMetrics();
    
    // Update database connection metrics
    await updateDatabaseMetrics();
    
    // Update active users metric
    await updateActiveUsersMetric();
    
    // Update business metrics
    await updateBusinessMetrics();
    
  } catch (error) {
    log.error('system', error as Error, {
      operation: 'update_dynamic_metrics',
      component: 'metrics',
    });
  }
}

/**
 * Update queue-related metrics
 */
async function updateQueueMetrics(): Promise<void> {
  try {
    // GoHighLevel queue
    const ghlWaiting = await gohighlevelQueue.getWaiting();
    const ghlActive = await gohighlevelQueue.getActive();
    const ghlCompleted = await gohighlevelQueue.getCompleted();
    const ghlFailed = await gohighlevelQueue.getFailed();
    
    metrics.updateQueuedJobs('gohighlevel', ghlWaiting.length);
    
    // Scheduler queue
    const schedulerWaiting = await schedulerQueue.getWaiting();
    const schedulerActive = await schedulerQueue.getActive();
    const schedulerCompleted = await schedulerQueue.getCompleted();
    const schedulerFailed = await schedulerQueue.getFailed();
    
    metrics.updateQueuedJobs('scheduler', schedulerWaiting.length);
    
    // Reports queue
    const reportsWaiting = await reportsQueue.getWaiting();
    const reportsActive = await reportsQueue.getActive();
    const reportsCompleted = await reportsQueue.getCompleted();
    const reportsFailed = await reportsQueue.getFailed();
    
    metrics.updateQueuedJobs('reports', reportsWaiting.length);
    
    // Video queue
    const videoWaiting = await videoQueue.getWaiting();
    const videoActive = await videoQueue.getActive();
    const videoCompleted = await videoQueue.getCompleted();
    const videoFailed = await videoQueue.getFailed();
    
    metrics.updateQueuedJobs('video', videoWaiting.length);
    
  } catch (error) {
    log.error('system', error as Error, {
      operation: 'update_queue_metrics',
      component: 'metrics',
    });
  }
}

/**
 * Update database-related metrics
 */
async function updateDatabaseMetrics(): Promise<void> {
  try {
    // This would typically be done through Prisma middleware
    // For now, we'll just set a placeholder value
    metrics.updateDbConnections(1);
    
  } catch (error) {
    log.error('system', error as Error, {
      operation: 'update_database_metrics',
      component: 'metrics',
    });
  }
}

/**
 * Update active users metric
 */
async function updateActiveUsersMetric(): Promise<void> {
  try {
    // Count users who have been active in the last 24 hours
    const activeUsersCount = await prisma.user.count({
      where: {
        updatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });
    
    metrics.updateActiveUsers(activeUsersCount);
    
  } catch (error) {
    log.error('system', error as Error, {
      operation: 'update_active_users_metric',
      component: 'metrics',
    });
  }
}

/**
 * Update business metrics
 */
async function updateBusinessMetrics(): Promise<void> {
  try {
    // These would typically be updated when events occur
    // This is just a placeholder for demonstration
    
    // Count total campaigns
    const totalCampaigns = await prisma.campaign.count();
    
    // Count total leads
    const totalLeads = await prisma.lead.count();
    
    // Count active subscriptions
    const activeSubscriptions = await prisma.subscription.count({
      where: {
        status: { in: ['active', 'trialing'] },
      },
    });
    
    // Log these for monitoring
    log.debug('system', 'Business metrics updated', {
      totalCampaigns,
      totalLeads,
      activeSubscriptions,
    });
    
  } catch (error) {
    log.error('system', error as Error, {
      operation: 'update_business_metrics',
      component: 'metrics',
    });
  }
}

/**
 * Get a summary of key metrics
 */
async function getMetricsSummary(): Promise<any> {
  try {
    const metricsData = await register.getMetricsAsJSON();
    
    const summary = {
      jobs: {
        processed: getMetricValue(metricsData, 'backendhub_jobs_processed_total'),
        failed: getMetricValue(metricsData, 'backendhub_jobs_failed_total'),
        queued: getMetricValue(metricsData, 'backendhub_queued_jobs'),
      },
      gpt: {
        tokens: getMetricValue(metricsData, 'backendhub_gpt_tokens_total'),
        requests: getMetricValue(metricsData, 'backendhub_gpt_requests_total'),
        cost: getMetricValue(metricsData, 'backendhub_gpt_cost_total'),
      },
      adPlatforms: {
        calls: getMetricValue(metricsData, 'backendhub_ad_calls_total'),
        failed: getMetricValue(metricsData, 'backendhub_ad_calls_failed_total'),
        spend: getMetricValue(metricsData, 'backendhub_ad_spend_total'),
      },
      http: {
        requests: getMetricValue(metricsData, 'backendhub_http_requests_total'),
      },
      business: {
        campaigns: getMetricValue(metricsData, 'backendhub_campaigns_created_total'),
        leads: getMetricValue(metricsData, 'backendhub_leads_generated_total'),
        subscriptions: getMetricValue(metricsData, 'backendhub_subscriptions_created_total'),
        revenue: getMetricValue(metricsData, 'backendhub_revenue_total'),
      },
      system: {
        activeUsers: getMetricValue(metricsData, 'backendhub_active_users'),
        uptime: getMetricValue(metricsData, 'backendhub_system_uptime_seconds'),
        errors: getMetricValue(metricsData, 'backendhub_errors_total'),
      },
    };
    
    return summary;
  } catch (error) {
    log.error('system', error as Error, {
      operation: 'get_metrics_summary',
      component: 'metrics',
    });
    
    return {
      error: 'Failed to get metrics summary',
    };
  }
}

/**
 * Helper function to extract metric values
 */
function getMetricValue(metricsData: any[], metricName: string): number {
  const metric = metricsData.find(m => m.name === metricName);
  if (!metric) return 0;
  
  if (metric.type === 'counter' || metric.type === 'gauge') {
    return metric.values.reduce((sum: number, val: any) => sum + val.value, 0);
  }
  
  return 0;
}

/**
 * Middleware to record HTTP request metrics
 */
export function httpMetricsMiddleware(req: Request, res: Response, next: Function): void {
  const startTime = Date.now();
  
  // Override res.end to capture response metrics
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = (Date.now() - startTime) / 1000;
    
    // Record HTTP metrics
    metrics.recordHttpRequest(req.method, req.route?.path || req.path, res.statusCode);
    metrics.recordHttpRequestDuration(req.method, duration, req.route?.path || req.path);
    
    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
}

export default router;
