#!/usr/bin/env node

import { startGoHighLevelWorker } from '../workers/gohighlevelWorker';

console.log('Starting GoHighLevel worker...');

const worker = startGoHighLevelWorker();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await worker.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await worker.close();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  console.error('Uncaught exception:', error);
  await worker.close();
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  await worker.close();
  process.exit(1);
});

console.log('GoHighLevel worker started successfully');
