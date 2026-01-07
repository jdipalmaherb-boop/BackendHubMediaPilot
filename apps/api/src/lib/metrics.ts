import { register, collectDefaultMetrics, Counter, Gauge, Histogram, Summary } from 'prom-client';
import { log } from './logger';

// Enable default metrics collection (CPU, memory, etc.)
collectDefaultMetrics({
  register,
  prefix: 'backendhub_',
});

// Job Processing Metrics
export const jobsProcessedTotal = new Counter({
  name: 'backendhub_jobs_processed_total',
  help: 'Total number of jobs processed',
  labelNames: ['queue', 'status', 'worker_type'],
  registers: [register],
});

export const jobsFailedTotal = new Counter({
  name: 'backendhub_jobs_failed_total',
  help: 'Total number of jobs that failed',
  labelNames: ['queue', 'error_type', 'worker_type'],
  registers: [register],
});

export const jobsDuration = new Histogram({
  name: 'backendhub_jobs_duration_seconds',
  help: 'Duration of job processing in seconds',
  labelNames: ['queue', 'worker_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

export const queuedJobs = new Gauge({
  name: 'backendhub_queued_jobs',
  help: 'Number of jobs currently queued',
  labelNames: ['queue'],
  registers: [register],
});

// GPT Usage Metrics
export const gptTokensTotal = new Counter({
  name: 'backendhub_gpt_tokens_total',
  help: 'Total number of GPT tokens used',
  labelNames: ['model', 'operation', 'user_id'],
  registers: [register],
});

export const gptRequestsTotal = new Counter({
  name: 'backendhub_gpt_requests_total',
  help: 'Total number of GPT API requests',
  labelNames: ['model', 'status', 'operation'],
  registers: [register],
});

export const gptRequestDuration = new Histogram({
  name: 'backendhub_gpt_request_duration_seconds',
  help: 'Duration of GPT API requests in seconds',
  labelNames: ['model', 'operation'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

export const gptCostTotal = new Counter({
  name: 'backendhub_gpt_cost_total',
  help: 'Total cost of GPT API usage in cents',
  labelNames: ['model', 'operation'],
  registers: [register],
});

// Ad Platform Metrics
export const adCallsTotal = new Counter({
  name: 'backendhub_ad_calls_total',
  help: 'Total number of ad platform API calls',
  labelNames: ['platform', 'operation', 'status'],
  registers: [register],
});

export const adCallsFailedTotal = new Counter({
  name: 'backendhub_ad_calls_failed_total',
  help: 'Total number of failed ad platform API calls',
  labelNames: ['platform', 'operation', 'error_type'],
  registers: [register],
});

export const adCallsDuration = new Histogram({
  name: 'backendhub_ad_calls_duration_seconds',
  help: 'Duration of ad platform API calls in seconds',
  labelNames: ['platform', 'operation'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

export const adSpendTotal = new Counter({
  name: 'backendhub_ad_spend_total',
  help: 'Total ad spend in cents',
  labelNames: ['platform', 'campaign_id'],
  registers: [register],
});

// Database Metrics
export const dbQueriesTotal = new Counter({
  name: 'backendhub_db_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table', 'status'],
  registers: [register],
});

export const dbQueryDuration = new Histogram({
  name: 'backendhub_db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2],
  registers: [register],
});

export const dbConnections = new Gauge({
  name: 'backendhub_db_connections',
  help: 'Number of active database connections',
  registers: [register],
});

// HTTP Metrics
export const httpRequestsTotal = new Counter({
  name: 'backendhub_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'backendhub_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

// Business Metrics
export const campaignsCreatedTotal = new Counter({
  name: 'backendhub_campaigns_created_total',
  help: 'Total number of campaigns created',
  labelNames: ['platform', 'objective', 'user_id'],
  registers: [register],
});

export const leadsGeneratedTotal = new Counter({
  name: 'backendhub_leads_generated_total',
  help: 'Total number of leads generated',
  labelNames: ['source', 'platform', 'campaign_id'],
  registers: [register],
});

export const subscriptionsCreatedTotal = new Counter({
  name: 'backendhub_subscriptions_created_total',
  help: 'Total number of subscriptions created',
  labelNames: ['plan', 'status'],
  registers: [register],
});

export const revenueTotal = new Counter({
  name: 'backendhub_revenue_total',
  help: 'Total revenue in cents',
  labelNames: ['source', 'plan'],
  registers: [register],
});

// System Metrics
export const activeUsers = new Gauge({
  name: 'backendhub_active_users',
  help: 'Number of active users',
  registers: [register],
});

export const systemUptime = new Gauge({
  name: 'backendhub_system_uptime_seconds',
  help: 'System uptime in seconds',
  registers: [register],
});

// Error Metrics
export const errorsTotal = new Counter({
  name: 'backendhub_errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'severity', 'component'],
  registers: [register],
});

// Rate Limiting Metrics
export const rateLimitHitsTotal = new Counter({
  name: 'backendhub_rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['endpoint', 'user_id'],
  registers: [register],
});

// Cache Metrics
export const cacheHitsTotal = new Counter({
  name: 'backendhub_cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_type', 'key_pattern'],
  registers: [register],
});

export const cacheMissesTotal = new Counter({
  name: 'backendhub_cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_type', 'key_pattern'],
  registers: [register],
});

// Utility functions for common metric operations
export const metrics = {
  // Job metrics
  recordJobProcessed: (queue: string, status: string, workerType: string) => {
    jobsProcessedTotal.inc({ queue, status, worker_type: workerType });
  },

  recordJobFailed: (queue: string, errorType: string, workerType: string) => {
    jobsFailedTotal.inc({ queue, error_type: errorType, worker_type: workerType });
  },

  recordJobDuration: (queue: string, duration: number, workerType: string) => {
    jobsDuration.observe({ queue, worker_type: workerType }, duration);
  },

  updateQueuedJobs: (queue: string, count: number) => {
    queuedJobs.set({ queue }, count);
  },

  // GPT metrics
  recordGptTokens: (model: string, operation: string, tokens: number, userId?: string) => {
    gptTokensTotal.inc({ model, operation, user_id: userId || 'anonymous' }, tokens);
  },

  recordGptRequest: (model: string, status: string, operation: string) => {
    gptRequestsTotal.inc({ model, status, operation });
  },

  recordGptDuration: (model: string, duration: number, operation: string) => {
    gptRequestDuration.observe({ model, operation }, duration);
  },

  recordGptCost: (model: string, cost: number, operation: string) => {
    gptCostTotal.inc({ model, operation }, cost);
  },

  // Ad platform metrics
  recordAdCall: (platform: string, operation: string, status: string) => {
    adCallsTotal.inc({ platform, operation, status });
  },

  recordAdCallFailed: (platform: string, operation: string, errorType: string) => {
    adCallsFailedTotal.inc({ platform, operation, error_type: errorType });
  },

  recordAdCallDuration: (platform: string, duration: number, operation: string) => {
    adCallsDuration.observe({ platform, operation }, duration);
  },

  recordAdSpend: (platform: string, spend: number, campaignId: string) => {
    adSpendTotal.inc({ platform, campaign_id: campaignId }, spend);
  },

  // Database metrics
  recordDbQuery: (operation: string, table: string, status: string) => {
    dbQueriesTotal.inc({ operation, table, status });
  },

  recordDbQueryDuration: (operation: string, duration: number, table: string) => {
    dbQueryDuration.observe({ operation, table }, duration);
  },

  updateDbConnections: (count: number) => {
    dbConnections.set(count);
  },

  // HTTP metrics
  recordHttpRequest: (method: string, route: string, statusCode: number) => {
    httpRequestsTotal.inc({ method, route, status_code: statusCode.toString() });
  },

  recordHttpRequestDuration: (method: string, duration: number, route: string) => {
    httpRequestDuration.observe({ method, route }, duration);
  },

  // Business metrics
  recordCampaignCreated: (platform: string, objective: string, userId: string) => {
    campaignsCreatedTotal.inc({ platform, objective, user_id: userId });
  },

  recordLeadGenerated: (source: string, platform: string, campaignId: string) => {
    leadsGeneratedTotal.inc({ source, platform, campaign_id: campaignId });
  },

  recordSubscriptionCreated: (plan: string, status: string) => {
    subscriptionsCreatedTotal.inc({ plan, status });
  },

  recordRevenue: (source: string, amount: number, plan: string) => {
    revenueTotal.inc({ source, plan }, amount);
  },

  // System metrics
  updateActiveUsers: (count: number) => {
    activeUsers.set(count);
  },

  updateSystemUptime: (uptime: number) => {
    systemUptime.set(uptime);
  },

  // Error metrics
  recordError: (type: string, severity: string, component: string) => {
    errorsTotal.inc({ type, severity, component });
  },

  // Rate limiting metrics
  recordRateLimitHit: (endpoint: string, userId: string) => {
    rateLimitHitsTotal.inc({ endpoint, user_id: userId });
  },

  // Cache metrics
  recordCacheHit: (cacheType: string, keyPattern: string) => {
    cacheHitsTotal.inc({ cache_type: cacheType, key_pattern: keyPattern });
  },

  recordCacheMiss: (cacheType: string, keyPattern: string) => {
    cacheMissesTotal.inc({ cache_type: cacheType, key_pattern: keyPattern });
  },
};

// Performance timing decorator
export function withMetrics<T extends any[], R>(
  metricName: string,
  labels: Record<string, string>,
  fn: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now();
    
    try {
      const result = await fn(...args);
      const duration = (Date.now() - startTime) / 1000;
      
      // Record success metrics based on metric name
      if (metricName.startsWith('job_')) {
        metrics.recordJobProcessed(labels.queue || 'unknown', 'success', labels.worker_type || 'unknown');
        metrics.recordJobDuration(labels.queue || 'unknown', duration, labels.worker_type || 'unknown');
      } else if (metricName.startsWith('gpt_')) {
        metrics.recordGptRequest(labels.model || 'unknown', 'success', labels.operation || 'unknown');
        metrics.recordGptDuration(labels.model || 'unknown', duration, labels.operation || 'unknown');
      } else if (metricName.startsWith('ad_')) {
        metrics.recordAdCall(labels.platform || 'unknown', labels.operation || 'unknown', 'success');
        metrics.recordAdCallDuration(labels.platform || 'unknown', duration, labels.operation || 'unknown');
      }
      
      return result;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      
      // Record failure metrics
      if (metricName.startsWith('job_')) {
        metrics.recordJobFailed(labels.queue || 'unknown', error.constructor.name, labels.worker_type || 'unknown');
        metrics.recordJobDuration(labels.queue || 'unknown', duration, labels.worker_type || 'unknown');
      } else if (metricName.startsWith('gpt_')) {
        metrics.recordGptRequest(labels.model || 'unknown', 'error', labels.operation || 'unknown');
        metrics.recordGptDuration(labels.model || 'unknown', duration, labels.operation || 'unknown');
      } else if (metricName.startsWith('ad_')) {
        metrics.recordAdCallFailed(labels.platform || 'unknown', labels.operation || 'unknown', error.constructor.name);
        metrics.recordAdCallDuration(labels.platform || 'unknown', duration, labels.operation || 'unknown');
      }
      
      throw error;
    }
  };
}

// Initialize system uptime tracking
let startTime = Date.now();
setInterval(() => {
  const uptime = (Date.now() - startTime) / 1000;
  metrics.updateSystemUptime(uptime);
}, 60000); // Update every minute

// Log metrics initialization
log.info({ type: 'metrics_init' }, 'Prometheus metrics initialized');

export default register;
