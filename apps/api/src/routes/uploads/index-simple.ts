import express from "express";
import { PrismaClient } from "@prisma/client";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();
const prisma = new PrismaClient();
const s3 = new S3Client({ region: process.env.S3_REGION });

/**
 * POST /api/uploads/presign
 * Generate presigned URL for direct S3 upload
 */
router.post("/presign", async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { filename, contentType, size } = req.body;
  if (!filename || !contentType) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  // Generate S3 key with user ID embedded for ownership validation
  const key = `uploads/${userId}/${Date.now()}-${uuidv4()}-${filename}`;
  const expiresIn = Number(process.env.S3_PRESIGN_EXPIRE ?? 600);

  // Create presigned URL command
  const cmd = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  // Generate presigned URL
  const url = await getSignedUrl(s3, cmd, { expiresIn });

  // Record presign request for validation
  await prisma.presignRequest.create({
    data: {
      userId,
      key,
      contentType,
      size: size ?? null,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    },
  });

  return res.json({
    url,
    key,
    expiresIn,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString()
  });
});

/**
 * POST /api/uploads/confirm
 * Confirm upload and create processing job
 */
router.post("/confirm", async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { key, meta } = req.body;
  if (!key || !meta) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  // 1. Extract and validate user ID from S3 key
  const keyMatch = key.match(/^uploads\/([^/]+)\//);
  if (!keyMatch || keyMatch[1] !== userId) {
    return res.status(403).json({
      error: "Unauthorized file access",
      code: "UNAUTHORIZED_FILE_ACCESS"
    });
  }

  // 2. Validate presign request exists
  const presignRequest = await prisma.presignRequest.findUnique({
    where: { key }
  });

  if (!presignRequest) {
    return res.status(400).json({
      error: "No presign request found",
      code: "PRESIGN_NOT_FOUND"
    });
  }

  // 3. Validate user ownership matches
  if (presignRequest.userId !== userId) {
    return res.status(403).json({
      error: "Presign user mismatch",
      code: "PRESIGN_USER_MISMATCH"
    });
  }

  // 4. Validate not expired
  if (presignRequest.expiresAt < new Date()) {
    return res.status(400).json({
      error: "Presigned URL expired",
      code: "PRESIGN_EXPIRED"
    });
  }

  // 5. Validate content type matches
  if (presignRequest.contentType !== meta.contentType) {
    return res.status(400).json({
      error: "Content type mismatch",
      code: "CONTENT_TYPE_MISMATCH",
      details: {
        expected: presignRequest.contentType,
        received: meta.contentType
      }
    });
  }

  // All validations passed - create processing job
  const job = await prisma.job.create({
    data: {
      userId,
      type: meta.contentType.startsWith("video/") ? "video_process" : "asset_ingest",
      status: "queued",
      s3Key: key,
      meta: {
        originalFilename: meta.originalFilename,
        contentType: meta.contentType,
        size: meta.size,
        uploadedAt: new Date().toISOString(),
      }
    }
  });

  return res.json({
    jobId: job.id,
    status: job.status,
    key: job.s3Key,
    message: "Upload confirmed successfully"
  });
});

/**
 * GET /api/uploads/jobs
 * Get user's upload jobs
 */
router.get("/jobs", async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { status, limit = "10" } = req.query;

  const where: any = { userId };
  if (status) where.status = status;

  const jobs = await prisma.job.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: parseInt(limit as string),
    select: {
      id: true,
      type: true,
      status: true,
      s3Key: true,
      outputKey: true,
      meta: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return res.json({ jobs });
});

/**
 * GET /api/uploads/jobs/:jobId
 * Get specific job details
 */
router.get("/jobs/:jobId", async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { jobId } = req.params;

  const job = await prisma.job.findFirst({
    where: { id: jobId, userId }
  });

  if (!job) {
    return res.status(404).json({ error: "Job not found", code: "JOB_NOT_FOUND" });
  }

  return res.json({ job });
});

export default router;

