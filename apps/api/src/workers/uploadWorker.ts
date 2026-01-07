import { Worker, Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";

const prisma = new PrismaClient();
const s3 = new S3Client({ region: process.env.S3_REGION });

interface UploadJobData {
  jobId: string;
  s3Key: string;
  userId: string;
  contentType?: string;
  meta?: any;
}

/**
 * Upload processing worker
 * Handles video processing, image optimization, etc.
 */
const uploadWorker = new Worker<UploadJobData>(
  "uploads",
  async (job: Job<UploadJobData>) => {
    const { jobId, s3Key, userId, contentType, meta } = job.data;

    console.log(`Processing upload job ${jobId} for user ${userId}`);
    await job.updateProgress(10);

    try {
      // Update job status to processing
      await prisma.job.update({
        where: { id: jobId },
        data: { status: "processing" }
      });

      await job.updateProgress(20);

      // Download file from S3
      console.log(`Downloading ${s3Key} from S3...`);
      const getCommand = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: s3Key
      });

      const s3Response = await s3.send(getCommand);
      await job.updateProgress(40);

      // Process based on content type
      let outputKey: string;
      if (contentType?.startsWith("video/")) {
        outputKey = await processVideo(s3Key, s3Response.Body as Readable, job);
      } else if (contentType?.startsWith("image/")) {
        outputKey = await processImage(s3Key, s3Response.Body as Readable, job);
      } else {
        // Just mark as completed for other file types
        outputKey = s3Key;
        await job.updateProgress(100);
      }

      // Update job as completed
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: "completed",
          outputKey,
          meta: {
            ...meta,
            processedAt: new Date().toISOString(),
            outputKey
          }
        }
      });

      console.log(`✅ Upload job ${jobId} completed successfully`);
      return { success: true, outputKey };

    } catch (error) {
      console.error(`❌ Upload job ${jobId} failed:`, error);

      // Update job as failed
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: "failed",
          meta: {
            ...meta,
            error: error instanceof Error ? error.message : "Unknown error",
            failedAt: new Date().toISOString()
          }
        }
      });

      throw error;
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST || "localhost",
      port: Number(process.env.REDIS_PORT) || 6379
    },
    concurrency: Number(process.env.UPLOAD_WORKER_CONCURRENCY) || 3,
    limiter: {
      max: 10, // Max 10 jobs
      duration: 1000 // Per second
    }
  }
);

/**
 * Process video file
 */
async function processVideo(
  s3Key: string,
  stream: Readable,
  job: Job<UploadJobData>
): Promise<string> {
  console.log(`Processing video: ${s3Key}`);
  await job.updateProgress(50);

  // TODO: Implement video processing with FFmpeg
  // - Extract metadata
  // - Generate thumbnail
  // - Transcode if needed
  // - Upload processed video

  await job.updateProgress(90);

  // For now, return original key
  // Replace with processed video key when implemented
  const outputKey = s3Key.replace("/uploads/", "/processed/");

  return outputKey;
}

/**
 * Process image file
 */
async function processImage(
  s3Key: string,
  stream: Readable,
  job: Job<UploadJobData>
): Promise<string> {
  console.log(`Processing image: ${s3Key}`);
  await job.updateProgress(50);

  // TODO: Implement image processing
  // - Resize for different screen sizes
  // - Optimize compression
  // - Generate WebP versions
  // - Upload processed images

  await job.updateProgress(90);

  // For now, return original key
  // Replace with processed image key when implemented
  const outputKey = s3Key.replace("/uploads/", "/processed/");

  return outputKey;
}

// Handle worker events
uploadWorker.on("completed", (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

uploadWorker.on("failed", (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

uploadWorker.on("error", (err) => {
  console.error("Worker error:", err);
});

console.log("🚀 Upload worker started");

export default uploadWorker;

