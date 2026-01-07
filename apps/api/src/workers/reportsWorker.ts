import { Worker, Job } from 'bullmq';
import { reportsQueue, ReportJobPayload, ReportJobResult, processReportJob, sendReportNotification } from './generateReports';
import { prisma } from '../lib/prisma';
import { env } from '../env';

// Create and configure worker
export function createReportsWorker() {
  const worker = new Worker(
    'reports',
    async (job: Job<ReportJobPayload>) => {
      return await processReportJob(job.data);
    },
    {
      connection: reportsQueue.opts.connection,
      concurrency: env.REPORTS_WORKER_CONCURRENCY || 2,
      removeOnComplete: 50,
      removeOnFail: 20,
    }
  );

  // Worker event listeners
  worker.on('completed', async (job, result: ReportJobResult) => {
    console.log(`Reports worker completed job ${job?.id}:`, result.success ? 'success' : 'failed');
    
    if (result.success && result.outputKey) {
      // Update job record in database
      await prisma.job.updateMany({
        where: {
          meta: {
            path: ['jobId'],
            equals: job?.id,
          },
        },
        data: {
          status: 'completed',
          meta: {
            outputKey: result.outputKey,
            filename: result.filename,
            summary: result.summary,
            completedAt: new Date().toISOString(),
          },
        },
      });

      // Send notification email if requested by a user
      if (job?.data.requestedBy && job.data.requestedBy !== 'system') {
        try {
          const downloadUrl = `${process.env.FRONTEND_URL}/api/reports/download/${job.id}`;
          await sendReportNotification(
            job.data.requestedBy,
            job.data.type,
            downloadUrl,
            result.summary!
          );
        } catch (error) {
          console.error('Failed to send report notification:', error);
        }
      }
    } else {
      // Update job record with error
      await prisma.job.updateMany({
        where: {
          meta: {
            path: ['jobId'],
            equals: job?.id,
          },
        },
        data: {
          status: 'failed',
          meta: {
            error: result.error,
            failedAt: new Date().toISOString(),
          },
        },
      });
    }
  });

  worker.on('failed', async (job, err) => {
    console.error(`Reports worker failed job ${job?.id}:`, err.message);
    
    // Update job record with error
    await prisma.job.updateMany({
      where: {
        meta: {
          path: ['jobId'],
          equals: job?.id,
        },
      },
      data: {
        status: 'failed',
        meta: {
          error: err.message,
          failedAt: new Date().toISOString(),
        },
      },
    });
  });

  worker.on('error', (err) => {
    console.error('Reports worker error:', err.message);
  });

  worker.on('stalled', (jobId) => {
    console.warn(`Reports worker stalled job ${jobId}`);
  });

  console.log(`Reports worker started with concurrency: ${env.REPORTS_WORKER_CONCURRENCY || 2}`);
  
  return worker;
}

// Start the worker (for worker-runner.ts)
export function startReportsWorker() {
  return createReportsWorker();
}

// Graceful shutdown
export async function stopReportsWorker(worker: Worker): Promise<void> {
  console.log('Stopping reports worker...');
  await worker.close();
  console.log('Reports worker stopped');
}

// Health check for worker
export function getReportsWorkerHealth(worker: Worker): any {
  return {
    isRunning: worker.isRunning(),
    concurrency: worker.opts.concurrency,
    name: worker.name,
    timestamp: new Date().toISOString(),
  };
}

export default {
  createReportsWorker,
  startReportsWorker,
  stopReportsWorker,
  getReportsWorkerHealth,
};
