import { Router, Request, Response } from 'express';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';
import verifyFirebaseToken from '../middleware/verifyFirebaseToken.js';
import { createS3Client } from '../lib/s3.js';
import { env } from '../env.js';
import { v4 as uuidv4 } from 'uuid';
import { createVideoQueue } from '../queues/videoQueue.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

// Validation schema for presign request
const presignSchema = z.object({
  filename: z.string()
    .min(1, 'Filename is required')
    .max(255, 'Filename too long')
    .regex(/^[^<>:"/\\|?*]+$/, 'Invalid filename characters'),
  contentType: z.string()
    .min(1, 'Content type is required'),
  folder: z.string()
    .optional()
    .default('uploads')
    .refine((folder) => /^[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*$/.test(folder), {
      message: 'Folder path must contain only alphanumeric characters, hyphens, underscores, and forward slashes'
    }),
});

// Validation schema for complete request
const completeSchema = z.object({
  key: z.string().min(1, 'S3 key is required'),
  meta: z.object({
    originalFilename: z.string().optional(),
    contentType: z.string().optional(),
    size: z.number().int().positive().optional(),
  }).optional(),
});

/**
 * Helper function to generate S3 key with folder support
 */
function generateS3Key(userId: string, filename: string, folder: string): string {
  const timestamp = Date.now();
  const uuid = uuidv4();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const sanitizedFolder = folder.replace(/^\/+|\/+$/g, ''); // Remove leading/trailing slashes
  
  // Ensure folder starts with user ID for security
  const folderPath = sanitizedFolder.startsWith(userId) 
    ? sanitizedFolder 
    : `${sanitizedFolder}/${userId}`;
  
  return `${folderPath}/${timestamp}-${uuid}-${sanitizedFilename}`;
}

/**
 * Helper function to generate public URL for S3 object
 */
function generatePublicUrl(key: string): string {
  const bucket = env.S3_BUCKET;
  const region = env.S3_REGION || 'us-east-1';
  
  // If custom endpoint is configured (e.g., MinIO, DigitalOcean Spaces)
  if (env.S3_ENDPOINT) {
    const endpoint = env.S3_ENDPOINT.replace(/\/$/, ''); // Remove trailing slash
    return `${endpoint}/${bucket}/${key}`;
  }
  
  // Standard AWS S3 URL format
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

/**
 * POST /api/uploads/presign
 * Generate presigned URL for direct S3 upload
 * 
 * Request body:
 * {
 *   "filename": "example.jpg",
 *   "contentType": "image/jpeg",
 *   "folder": "uploads" (optional, defaults to "uploads")
 * }
 * 
 * Response:
 * {
 *   "signedUrl": "https://s3.amazonaws.com/bucket/key?...",
 *   "publicUrl": "https://bucket.s3.region.amazonaws.com/key",
 *   "key": "uploads/userId/timestamp-uuid-filename.jpg",
 *   "expiresIn": 3600
 * }
 */
router.post('/presign', verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const { filename, contentType, folder } = presignSchema.parse(req.body);
    
    // Get user ID from Firebase token (attached by verifyFirebaseToken middleware)
    const userId = (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User ID not found in token'
      });
    }

    // Generate S3 key
    const key = generateS3Key(userId, filename, folder);

    // Create S3 client
    const s3Client = createS3Client();

    // Create PutObject command
    const command = new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      ContentType: contentType,
      // Add metadata for tracking
      Metadata: {
        'uploaded-by': userId,
        'original-filename': filename,
        'upload-timestamp': new Date().toISOString(),
      }
    });

    // Generate presigned URL
    const expiresIn = env.S3_PRESIGN_EXPIRE || 3600;
    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn
    });

    // Generate public URL
    const publicUrl = generatePublicUrl(key);

    res.json({
      signedUrl,
      publicUrl,
      key,
      expiresIn,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Presign upload error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/uploads/complete
 * Confirm upload completion and optionally trigger server-side processing
 * 
 * Request body:
 * {
 *   "key": "uploads/userId/timestamp-uuid-filename.jpg",
 *   "meta": {
 *     "originalFilename": "example.jpg",
 *     "contentType": "image/jpeg",
 *     "size": 12345
 *   } (optional)
 * }
 * 
 * Response:
 * {
 *   "message": "Upload confirmed successfully",
 *   "key": "uploads/userId/timestamp-uuid-filename.jpg",
 *   "publicUrl": "https://bucket.s3.region.amazonaws.com/key"
 * }
 */
router.post('/complete', verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const { key, meta } = completeSchema.parse(req.body);
    
    // Get user ID from Firebase token
    const userId = (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User ID not found in token'
      });
    }

    // Validate that the key belongs to the user
    const keyUserId = key.split('/').find((part, index, arr) => {
      // Look for userId in the path (typically after the folder name)
      return index > 0 && part;
    });

    // Basic security check: ensure key contains user ID
    if (!key.includes(userId)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Key does not belong to authenticated user',
        code: 'UNAUTHORIZED_KEY'
      });
    }

    // Generate public URL
    const publicUrl = generatePublicUrl(key);

    const video = await prisma.videoAsset.create({
      data: {
        ownerId: userId,
        originalUrl: publicUrl,
        status: 'pending',
        meta: {
          originalKey: key,
          completeMeta: meta || null,
        },
      },
    });

    const queue = createVideoQueue();
    const job = await queue.add(
      'process-video',
      {
        videoId: video.id,
        s3Key: key,
        ownerId: userId,
        options: meta || {},
      },
      { attempts: 3 }
    );
    await queue.close();

    res.json({
      message: 'Upload confirmed successfully',
      key,
      publicUrl,
      meta: meta || null,
      videoId: video.id,
      jobId: job.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Upload complete error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

