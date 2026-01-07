#!/usr/bin/env node
/**
 * Upload Worker Runner
 * Starts the upload processing worker
 * 
 * Usage:
 *   tsx src/worker-runner-upload.ts
 *   or
 *   pnpm worker:upload
 */

import dotenv from "dotenv";
import uploadWorker from "./workers/uploadWorker";

// Load environment variables
dotenv.config();

console.log("🚀 Starting Upload Worker...");
console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
console.log(`🔄 Concurrency: ${process.env.UPLOAD_WORKER_CONCURRENCY || 3}`);
console.log(`📦 Redis: ${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || 6379}`);

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("⚠️  SIGTERM received, closing worker...");
  await uploadWorker.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("⚠️  SIGINT received, closing worker...");
  await uploadWorker.close();
  process.exit(0);
});

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled rejection at:", promise, "reason:", reason);
  process.exit(1);
});

console.log("✅ Upload worker is ready and waiting for jobs");

