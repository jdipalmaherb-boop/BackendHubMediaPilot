import express from "express";
import { PrismaClient } from "@prisma/client";
import { Queue } from "bullmq";

const router = express.Router();
const prisma = new PrismaClient();
const uploadQueue = new Queue("uploads", {
  connection: {
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT) || 6379
  }
});

router.post("/confirm", async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { key, meta } = req.body;
  if (!key) return res.status(400).json({ error: "Missing key" });

  // Validate presign request
  const presign = await prisma.presignRequest.findUnique({ where: { key } });
  if (!presign) {
    return res.status(403).json({ error: "Unknown or expired presign key", code: "PRESIGN_NOT_FOUND" });
  }

  if (presign.userId !== userId) {
    return res.status(403).json({ error: "S3 key does not belong to this user", code: "PRESIGN_USER_MISMATCH" });
  }

  if (new Date() > presign.expiresAt) {
    return res.status(410).json({ error: "Presigned URL expired", code: "PRESIGN_EXPIRED" });
  }

  // Optional: Validate content type if provided in meta
  if (meta?.contentType && presign.contentType !== meta.contentType) {
    return res.status(400).json({
      error: "Content type mismatch",
      code: "CONTENT_TYPE_MISMATCH",
      details: { expected: presign.contentType, received: meta.contentType }
    });
  }

  // Create job
  const job = await prisma.job.create({
    data: {
      userId,
      type: presign.contentType.startsWith("video/") ? "video_process" : "asset_ingest",
      status: "queued",
      s3Key: key,
      meta: {
        ...meta,
        contentType: presign.contentType,
        confirmedAt: new Date().toISOString(),
        presignRequestId: presign.id
      }
    }
  });

  // Enqueue for processing
  await uploadQueue.add(
    "process-upload",
    {
      jobId: job.id,
      s3Key: key,
      userId,
      contentType: presign.contentType,
      meta
    },
    {
      jobId: job.id, // Use job ID for idempotency
      removeOnComplete: 1000, // Keep last 1000 completed jobs
      removeOnFail: 5000, // Keep last 5000 failed jobs
      attempts: 3, // Retry up to 3 times
      backoff: {
        type: "exponential",
        delay: 2000 // Start with 2 seconds
      }
    }
  );

  return res.json({
    ok: true,
    jobId: job.id,
    status: job.status,
    queuePosition: await uploadQueue.count()
  });
});

export default router;

