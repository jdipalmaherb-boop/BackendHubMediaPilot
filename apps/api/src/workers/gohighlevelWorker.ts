import { Worker, Job } from 'bullmq';
import { prisma } from '../lib/prisma';
import { gohighlevelQueue, GoHighLevelJobPayload, GoHighLevelResponse } from '../services/gohighlevel';
import { env } from '../env';
import { metrics } from '../lib/metrics';
import { log } from '../lib/logger';

// GoHighLevel API configuration
const GOHIGHLEVEL_BASE_URL = 'https://rest.gohighlevel.com/v1';
const API_KEY = env.GOHIGHLEVEL_API_KEY;

// Rate limiting configuration
const RATE_LIMIT_DELAYS = {
  429: 60000, // 1 minute for 429 errors
  500: 30000, // 30 seconds for server errors
  502: 30000,
  503: 30000,
  504: 30000,
};

// Check for duplicate external ID to handle idempotency
async function checkDuplicateExternalId(externalId: string): Promise<boolean> {
  const existingSync = await prisma.goHighLevelSync.findFirst({
    where: {
      externalId,
      status: 'synced',
    },
  });

  return !!existingSync;
}

// Make HTTP request to GoHighLevel API
async function makeGoHighLevelRequest(
  endpoint: string,
  method: 'POST' | 'PUT' | 'PATCH',
  data: any
): Promise<{ success: boolean; data?: any; error?: string; statusCode?: number; retryAfter?: number }> {
  try {
    const url = `${GOHIGHLEVEL_BASE_URL}${endpoint}`;
    
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'BackendHub-Integration/1.0',
      },
      body: JSON.stringify(data),
    });

    const responseData = await response.json();

    if (response.ok) {
      return {
        success: true,
        data: responseData,
        statusCode: response.status,
      };
    } else {
      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        return {
          success: false,
          error: 'Rate limited',
          statusCode: response.status,
          retryAfter: retryAfter ? parseInt(retryAfter) : 60,
        };
      }

      return {
        success: false,
        error: responseData.message || `HTTP ${response.status}`,
        statusCode: response.status,
      };
    }
  } catch (error) {
    console.error('GoHighLevel API request failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

// Create contact in GoHighLevel
async function createContact(leadData: GoHighLevelJobPayload['leadData']): Promise<GoHighLevelResponse> {
  try {
    const contactData = {
      email: leadData.email,
      firstName: leadData.firstName || '',
      lastName: leadData.lastName || '',
      phone: leadData.phone || '',
      source: leadData.source || 'BackendHub',
      tags: leadData.tags || [],
      customFields: leadData.customFields || {},
      locationId: leadData.locationId,
    };

    const result = await makeGoHighLevelRequest('/contacts/', 'POST', contactData);

    if (result.success && result.data?.contact) {
      const externalId = result.data.contact.id;
      
      // Check for duplicate
      if (await checkDuplicateExternalId(externalId)) {
        return {
          success: true,
          externalId,
          status: 'duplicate',
          response: result.data,
        };
      }

      return {
        success: true,
        externalId,
        status: 'synced',
        response: result.data,
      };
    } else {
      return {
        success: false,
        status: result.statusCode === 429 ? 'rate_limited' : 'failed',
        error: result.error,
        retryAfter: result.retryAfter,
      };
    }
  } catch (error) {
    console.error('Failed to create contact:', error);
    return {
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Update contact in GoHighLevel
async function updateContact(
  externalId: string,
  leadData: GoHighLevelJobPayload['leadData']
): Promise<GoHighLevelResponse> {
  try {
    const updateData = {
      email: leadData.email,
      firstName: leadData.firstName,
      lastName: leadData.lastName,
      phone: leadData.phone,
      customFields: leadData.customFields,
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData];
      }
    });

    const result = await makeGoHighLevelRequest(`/contacts/${externalId}`, 'PUT', updateData);

    if (result.success) {
      return {
        success: true,
        externalId,
        status: 'synced',
        response: result.data,
      };
    } else {
      return {
        success: false,
        status: result.statusCode === 429 ? 'rate_limited' : 'failed',
        error: result.error,
        retryAfter: result.retryAfter,
      };
    }
  } catch (error) {
    console.error('Failed to update contact:', error);
    return {
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Add tags to contact
async function addContactTags(
  externalId: string,
  tags: string[]
): Promise<GoHighLevelResponse> {
  try {
    const result = await makeGoHighLevelRequest(`/contacts/${externalId}/tags`, 'POST', { tags });

    if (result.success) {
      return {
        success: true,
        externalId,
        status: 'synced',
        response: result.data,
      };
    } else {
      return {
        success: false,
        status: result.statusCode === 429 ? 'rate_limited' : 'failed',
        error: result.error,
        retryAfter: result.retryAfter,
      };
    }
  } catch (error) {
    console.error('Failed to add contact tags:', error);
    return {
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Update custom fields
async function updateCustomFields(
  externalId: string,
  customFields: Record<string, any>
): Promise<GoHighLevelResponse> {
  try {
    const result = await makeGoHighLevelRequest(`/contacts/${externalId}`, 'PATCH', { customFields });

    if (result.success) {
      return {
        success: true,
        externalId,
        status: 'synced',
        response: result.data,
      };
    } else {
      return {
        success: false,
        status: result.statusCode === 429 ? 'rate_limited' : 'failed',
        error: result.error,
        retryAfter: result.retryAfter,
      };
    }
  } catch (error) {
    console.error('Failed to update custom fields:', error);
    return {
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Process GoHighLevel sync job
export async function processGoHighLevelJob(job: Job<GoHighLevelJobPayload>): Promise<GoHighLevelResponse> {
  const { leadId, userId, leadData, syncType, metadata } = job.data;
  const startTime = Date.now();
  
  log.info(`Processing GoHighLevel sync job ${job.id} for lead ${leadId} (${syncType})`, {
    reqId: `job-${job.id}`,
    jobId: job.id,
    leadId,
    syncType,
    userId,
  });
  
  try {
    // Update sync record status to processing
    await prisma.goHighLevelSync.updateMany({
      where: {
        leadId,
        syncType,
        status: 'queued',
      },
      data: {
        status: 'processing',
        meta: {
          processingStartedAt: new Date().toISOString(),
          jobId: job.id,
          attempt: job.attemptsMade + 1,
        },
      },
    });

    let result: GoHighLevelResponse;

    // Process based on sync type
    switch (syncType) {
      case 'lead_create':
        result = await createContact(leadData);
        break;
      case 'lead_update':
        // For updates, we need the external ID from a previous sync
        const existingSync = await prisma.goHighLevelSync.findFirst({
          where: {
            leadId,
            status: 'synced',
          },
          orderBy: { createdAt: 'desc' },
        });

        if (!existingSync?.externalId) {
          throw new Error('No external ID found for lead update');
        }

        result = await updateContact(existingSync.externalId, leadData);
        break;
      case 'lead_tag':
        const tagSync = await prisma.goHighLevelSync.findFirst({
          where: {
            leadId,
            status: 'synced',
          },
          orderBy: { createdAt: 'desc' },
        });

        if (!tagSync?.externalId) {
          throw new Error('No external ID found for lead tagging');
        }

        result = await addContactTags(tagSync.externalId, leadData.tags || []);
        break;
      case 'custom_field_update':
        const fieldSync = await prisma.goHighLevelSync.findFirst({
          where: {
            leadId,
            status: 'synced',
          },
          orderBy: { createdAt: 'desc' },
        });

        if (!fieldSync?.externalId) {
          throw new Error('No external ID found for custom field update');
        }

        result = await updateCustomFields(fieldSync.externalId, leadData.customFields || {});
        break;
      default:
        throw new Error(`Unsupported sync type: ${syncType}`);
    }

    // Update sync record with result
    await prisma.goHighLevelSync.updateMany({
      where: {
        leadId,
        syncType,
        status: 'processing',
      },
      data: {
        status: result.status,
        externalId: result.externalId,
        response: result.response,
        error: result.error,
        meta: {
          processingCompletedAt: new Date().toISOString(),
          jobId: job.id,
          attempt: job.attemptsMade + 1,
          success: result.success,
          retryAfter: result.retryAfter,
        },
      },
    });

    // Handle rate limiting
    if (result.status === 'rate_limited' && result.retryAfter) {
      console.log(`Rate limited, retrying after ${result.retryAfter} seconds`);
      throw new Error(`Rate limited: retry after ${result.retryAfter}s`);
    }

    const duration = (Date.now() - startTime) / 1000;
    
    // Record success metrics
    metrics.recordJobProcessed('gohighlevel', result.status, 'gohighlevel-worker');
    metrics.recordJobDuration('gohighlevel', duration, 'gohighlevel-worker');
    
    log.info(`Completed GoHighLevel sync job ${job.id}: ${result.status}`, {
      reqId: `job-${job.id}`,
      jobId: job.id,
      duration,
      status: result.status,
    });

    return result;
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    
    // Record failure metrics
    metrics.recordJobFailed('gohighlevel', error.constructor.name, 'gohighlevel-worker');
    metrics.recordJobDuration('gohighlevel', duration, 'gohighlevel-worker');
    
    log.error(`Failed to process GoHighLevel sync job ${job.id}:`, error as Error, {
      reqId: `job-${job.id}`,
      jobId: job.id,
      duration,
      errorType: error.constructor.name,
    });
    
    // Update sync record with error
    await prisma.goHighLevelSync.updateMany({
      where: {
        leadId,
        syncType,
        status: 'processing',
      },
      data: {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        meta: {
          processingFailedAt: new Date().toISOString(),
          jobId: job.id,
          attempt: job.attemptsMade + 1,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      },
    });

    throw error; // Re-throw to trigger retry mechanism
  }
}

// Create and configure worker
export function createGoHighLevelWorker() {
  const worker = new Worker(
    'gohighlevel',
    async (job: Job<GoHighLevelJobPayload>) => {
      return await processGoHighLevelJob(job);
    },
    {
      connection: gohighlevelQueue.opts.connection,
      concurrency: env.GOHIGHLEVEL_WORKER_CONCURRENCY || 3,
      removeOnComplete: 100,
      removeOnFail: 50,
    }
  );

  // Worker event listeners
  worker.on('completed', (job, result) => {
    console.log(`GoHighLevel worker completed job ${job?.id}:`, result.status);
  });

  worker.on('failed', (job, err) => {
    console.error(`GoHighLevel worker failed job ${job?.id}:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('GoHighLevel worker error:', err.message);
  });

  worker.on('stalled', (jobId) => {
    console.warn(`GoHighLevel worker stalled job ${jobId}`);
  });

  console.log(`GoHighLevel worker started with concurrency: ${env.GOHIGHLEVEL_WORKER_CONCURRENCY || 3}`);
  
  return worker;
}

// Start the worker (for worker-runner.ts)
export function startGoHighLevelWorker() {
  return createGoHighLevelWorker();
}

// Graceful shutdown
export async function stopGoHighLevelWorker(worker: Worker): Promise<void> {
  console.log('Stopping GoHighLevel worker...');
  await worker.close();
  console.log('GoHighLevel worker stopped');
}

// Health check for worker
export function getGoHighLevelWorkerHealth(worker: Worker): any {
  return {
    isRunning: worker.isRunning(),
    concurrency: worker.opts.concurrency,
    name: worker.name,
    timestamp: new Date().toISOString(),
  };
}

// Manual job processing (for testing)
export async function processGoHighLevelJobManually(jobId: string): Promise<GoHighLevelResponse> {
  const job = await gohighlevelQueue.getJob(jobId);
  
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  return await processGoHighLevelJob(job);
}

// Test API connection
export async function testGoHighLevelConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await makeGoHighLevelRequest('/contacts/', 'POST', {
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    });

    if (result.success || result.statusCode === 422) { // 422 means validation error, which is expected for test data
      return { success: true };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export default {
  createGoHighLevelWorker,
  startGoHighLevelWorker,
  stopGoHighLevelWorker,
  getGoHighLevelWorkerHealth,
  processGoHighLevelJobManually,
  testGoHighLevelConnection,
};
