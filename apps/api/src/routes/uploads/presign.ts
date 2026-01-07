import { Router, Request, Response } from 'express';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { createS3Client } from '../../lib/s3';
import { prisma } from '../../lib/prisma';
import { env } from '../../env';

const router = Router();

// MIME type whitelist for security
const ALLOWED_MIME_TYPES = [
  'video/mp4',
  'video/quicktime', // .mov files
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
] as const;

// File extension mapping for additional validation
const MIME_TYPE_EXTENSIONS: Record<string, string[]> = {
  'video/mp4': ['.mp4'],
  'video/quicktime': ['.mov'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif']
};

// Validation schema
const presignSchema = z.object({
  filename: z.string()
    .min(1, 'Filename is required')
    .max(255, 'Filename too long')
    .regex(/^[^<>:"/\\|?*]+$/, 'Invalid filename characters'),
  contentType: z.string()
    .min(1, 'Content type is required')
    .refine((type) => ALLOWED_MIME_TYPES.includes(type as any), {
      message: `Content type must be one of: ${ALLOWED_MIME_TYPES.join(', ')}`
    }),
  size: z.number()
    .int('Size must be an integer')
    .min(1, 'Size must be positive')
    .max(env.MAX_UPLOAD_SIZE, `File size must not exceed ${env.MAX_UPLOAD_SIZE} bytes`)
});

// Helper function to validate file extension matches MIME type
const validateFileExtension = (filename: string, contentType: string): boolean => {
  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  const allowedExtensions = MIME_TYPE_EXTENSIONS[contentType] || [];
  return allowedExtensions.includes(extension);
};

// Helper function to generate S3 key
const generateS3Key = (userId: string, filename: string): string => {
  const timestamp = Date.now();
  const uuid = uuidv4();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `uploads/${userId}/${timestamp}-${uuid}-${sanitizedFilename}`;
};

/**
 * POST /api/uploads/presign
 * Generate presigned URL for file upload
 */
router.post('/presign', requireAuth, async (req: Request, res: Response) => {
  try {
    const { filename, contentType, size } = presignSchema.parse(req.body);

    // Additional validation: check file extension matches MIME type
    if (!validateFileExtension(filename, contentType)) {
      return res.status(400).json({
        error: 'File extension does not match content type',
        code: 'INVALID_FILE_TYPE',
        details: {
          filename,
          contentType,
          expectedExtensions: MIME_TYPE_EXTENSIONS[contentType]
        }
      });
    }

    // Generate S3 key
    const key = generateS3Key(req.user!.id, filename);

    // Create S3 client
    const s3Client = createS3Client();

    // Create PutObject command
    const command = new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
      // Add metadata for tracking
      Metadata: {
        'uploaded-by': req.user!.id,
        'original-filename': filename,
        'upload-timestamp': new Date().toISOString()
      }
    });

    // Generate presigned URL
    const url = await getSignedUrl(s3Client, command, {
      expiresIn: env.S3_PRESIGN_EXPIRE
    });

    // Record presign request for tracking and validation
    const expiresAt = new Date(Date.now() + env.S3_PRESIGN_EXPIRE * 1000);
    await prisma.presignRequest.create({
      data: {
        userId: req.user!.id,
        key,
        contentType,
        size,
        expiresAt,
      }
    });

    res.json({
      url,
      key,
      expiresIn: env.S3_PRESIGN_EXPIRE,
      contentType,
      size,
      expiresAt: expiresAt.toISOString(),
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
      code: 'INTERNAL_ERROR'
    });
  }
});


export default router;
