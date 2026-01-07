#!/usr/bin/env node

import { dataProcessingWorker } from './privacyWorker';
import { log } from '../lib/logger';

// Graceful shutdown handling
process.on('SIGINT', async () => {
  log.info('privacy_worker_shutdown', { signal: 'SIGINT' });
  await dataProcessingWorker.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  log.info('privacy_worker_shutdown', { signal: 'SIGTERM' });
  await dataProcessingWorker.close();
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  log.error('privacy_worker_uncaught_exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log.error('privacy_worker_unhandled_rejection', new Error(String(reason)), {
    promise: promise.toString(),
  });
  process.exit(1);
});

log.info('privacy_worker_started', {
  pid: process.pid,
  nodeVersion: process.version,
  platform: process.platform,
});

// Keep the process alive
setInterval(() => {
  // Health check - just log that we're alive
  log.debug('privacy_worker_heartbeat', {
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
  });
}, 60000); // Every minute
