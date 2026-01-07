import express from "express";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

router.post("/confirm", async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { key, meta } = req.body;
  if (!key || !meta) return res.status(400).json({ error: "Missing parameters" });

  // 1. Extract user ID from key and validate ownership
  const keyMatch = key.match(/^uploads\/([^/]+)\//);
  if (!keyMatch || keyMatch[1] !== userId) {
    return res.status(403).json({ error: "Unauthorized file access", code: "UNAUTHORIZED_FILE_ACCESS" });
  }

  // 2. Validate presign request exists
  const presignRequest = await prisma.presignRequest.findUnique({
    where: { key }
  });

  if (!presignRequest) {
    return res.status(400).json({ error: "No presign request found", code: "PRESIGN_NOT_FOUND" });
  }

  // 3. Validate user ownership
  if (presignRequest.userId !== userId) {
    return res.status(403).json({ error: "Presign user mismatch", code: "PRESIGN_USER_MISMATCH" });
  }

  // 4. Validate not expired
  if (presignRequest.expiresAt < new Date()) {
    return res.status(400).json({ error: "Presigned URL expired", code: "PRESIGN_EXPIRED" });
  }

  // 5. Validate content type matches
  if (presignRequest.contentType !== meta.contentType) {
    return res.status(400).json({
      error: "Content type mismatch",
      code: "CONTENT_TYPE_MISMATCH",
      details: { expected: presignRequest.contentType, received: meta.contentType }
    });
  }

  // All validations passed - create job
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

export default router;

