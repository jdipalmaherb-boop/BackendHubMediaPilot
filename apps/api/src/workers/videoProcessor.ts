import { Worker, Job } from 'bullmq';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import OpenAI from 'openai';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

import { VIDEO_QUEUE_NAME } from '../queues/videoQueue.js';
import { createS3Client } from '../lib/s3.js';
import { prisma } from '../lib/prisma.js';
import { trimSilence, burnSubtitles, generateThumbnail, getVideoMetadata, resizeVideoForPlatform } from '../lib/ffmpeg.js';
import { getPlatformFormat, detectCreativeType, getAspectRatioString, validateCreativeForPlatform } from '../lib/platformFormats.js';

const TEMP_DIR = process.env.VIDEO_TEMP_DIR || path.join(os.tmpdir(), 'video-processing');
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const openaiApiKey = process.env.OPENAI_API_KEY;
const s3Client = createS3Client();

const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

interface VideoJobData {
  videoId: string;
  s3Key: string;
  ownerId: string;
  scheduledPlatforms?: Array<{
    platform: string;
    postType?: string;
  }>;
  options?: {
    trimSilence?: boolean;
    generateVariants?: boolean;
    generateCaptions?: boolean;
    seekThumbnail?: number;
  };
}

async function ensureTempDir() {
  await fs.mkdir(TEMP_DIR, { recursive: true });
}

async function downloadFromS3(key: string): Promise<string> {
  await ensureTempDir();
  const tempFile = path.join(TEMP_DIR, `${randomUUID()}-${path.basename(key)}`);
  const response = await s3Client.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }));
  if (!response.Body) throw new Error(`Empty body returned for ${key}`);
  const buffer = await response.Body.transformToByteArray();
  await fs.writeFile(tempFile, Buffer.from(buffer));
  return tempFile;
}

async function uploadToS3(localPath: string, key: string, contentType?: string) {
  const body = await fs.readFile(localPath);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return key;
}

async function transcribeVideo(filePath: string): Promise<string | null> {
  if (!openai) {
    return null;
  }

  try {
    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: createReadStream(filePath),
      response_format: 'vtt',
    });

    return typeof transcription === 'string' ? transcription : transcription.text ?? null;
  } catch (error) {
    console.error('Transcription failed:', error);
    return null;
  }
}

function buildS3Key(prefix: string, filename: string): string {
  return `${prefix}/${filename}`;
}

async function processVideoJob(job: Job<VideoJobData>) {
  const { videoId, s3Key, ownerId, scheduledPlatforms = [], options = {} } = job.data;

  const sourcePath = await downloadFromS3(s3Key);
  let workingPath = sourcePath;
  const generatedFiles: Array<{ path: string; key: string; contentType?: string; platform?: string; postType?: string }> = [];

  try {
    // Update status to processing
    await prisma.videoAsset.update({
      where: { id: videoId },
      data: { status: 'processing' },
    });
    await job.updateProgress(10);

    // Get video metadata
    const metadata = await getVideoMetadata(workingPath);
    const creativeType = detectCreativeType(metadata.width, metadata.height, metadata.duration);
    const aspectRatio = getAspectRatioString(metadata.width, metadata.height);
    
    // Update video asset with metadata
    await prisma.videoAsset.update({
      where: { id: videoId },
      data: {
        width: metadata.width,
        height: metadata.height,
        duration: metadata.duration,
        meta: {
          aspectRatio,
          creativeType,
          originalMetadata: metadata,
        },
      },
    });
    await job.updateProgress(15);

    if (options.trimSilence) {
      const trimmedPath = path.join(TEMP_DIR, `${randomUUID()}-trimmed.mp4`);
      await trimSilence(workingPath, trimmedPath);
      generatedFiles.push({ path: trimmedPath, key: buildS3Key('videos/processed', path.basename(trimmedPath)), contentType: 'video/mp4' });
      workingPath = trimmedPath;
      await job.updateProgress(30);
    }

    let vttKey: string | undefined;
    let transcript: string | undefined;
    if (options.generateCaptions) {
      const vttContent = await transcribeVideo(workingPath);
      if (vttContent) {
        const vttPath = path.join(TEMP_DIR, `${randomUUID()}.vtt`);
        await fs.writeFile(vttPath, vttContent, 'utf8');
        const key = buildS3Key('videos/captions', path.basename(vttPath));
        await uploadToS3(vttPath, key, 'text/vtt');
        generatedFiles.push({ path: vttPath, key, contentType: 'text/vtt' });
        vttKey = key;

        // Extract transcript text from VTT (simple extraction)
        transcript = vttContent.replace(/WEBVTT[\s\S]*?\n\n/g, '').replace(/\d+\n\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}\n/g, '').trim();

        const burnedPath = path.join(TEMP_DIR, `${randomUUID()}-burned.mp4`);
        await burnSubtitles(workingPath, vttPath, burnedPath);
        generatedFiles.push({ path: burnedPath, key: buildS3Key('videos/burned', path.basename(burnedPath)), contentType: 'video/mp4' });
        workingPath = burnedPath; // Use burned video as main processed output
        await job.updateProgress(60);
      }
    }

    // Generate platform-specific variants if scheduled platforms are provided
    if (scheduledPlatforms.length > 0) {
      await job.updateProgress(50);
      
      for (const platformConfig of scheduledPlatforms) {
        const { platform, postType } = platformConfig;
        const format = getPlatformFormat(platform, postType);
        
        if (!format) {
          console.warn(`No format configuration for ${platform}/${postType}`);
          continue;
        }

        // Validate creative for platform
        const validation = validateCreativeForPlatform(
          platform,
          postType || 'feed',
          metadata.width,
          metadata.height,
          metadata.duration
        );

        if (!validation.valid) {
          console.warn(`Creative validation failed for ${platform}/${postType}:`, validation.errors);
          // Continue anyway but log warnings
        }

        // Generate platform-specific variant
        const variantPath = path.join(TEMP_DIR, `${randomUUID()}-${platform}-${postType || 'feed'}.mp4`);
        await resizeVideoForPlatform(
          workingPath,
          variantPath,
          format.width,
          format.height,
          format.bitrate,
          format.codec
        );

        const variantKey = buildS3Key(`videos/platforms/${platform}/${postType || 'feed'}`, path.basename(variantPath));
        generatedFiles.push({
          path: variantPath,
          key: variantKey,
          contentType: 'video/mp4',
          platform,
          postType: postType || 'feed',
        });
      }
      await job.updateProgress(70);
    } else if (options.generateVariants) {
      // Fallback to square variant if no platforms specified
      const squarePath = path.join(TEMP_DIR, `${randomUUID()}-square.mp4`);
      await burnSubtitles(workingPath, null, squarePath, { scale: '1080:1080' });
      generatedFiles.push({ path: squarePath, key: buildS3Key('videos/square', path.basename(squarePath)), contentType: 'video/mp4' });
      await job.updateProgress(70);
    }

    const thumbnailPath = path.join(TEMP_DIR, `${randomUUID()}.jpg`);
    await generateThumbnail(workingPath, thumbnailPath, options.seekThumbnail || 1);
    const thumbnailKey = buildS3Key('videos/thumbs', path.basename(thumbnailPath));
    generatedFiles.push({ path: thumbnailPath, key: thumbnailKey, contentType: 'image/jpeg' });
    await job.updateProgress(80);

    await job.updateProgress(85);
    const uploadResults = await Promise.all(
      generatedFiles.map((file) => uploadToS3(file.path, file.key, file.contentType))
    );

    const findKey = (predicate: (key: string) => boolean) => uploadResults.find(predicate);

    const processedKey =
      findKey((key) => key.includes('/processed/')) ||
      findKey((key) => key.includes('/burned/')) ||
      findKey((key) => key.endsWith('.mp4')) ||
      null;

    const thumbnailKey = findKey((key) => key.includes('/thumbs/')) || undefined;

    // Generate public URLs
    const generatePublicUrl = (key: string): string => {
      const bucket = process.env.S3_BUCKET!;
      const region = process.env.S3_REGION || 'us-east-1';
      if (process.env.S3_ENDPOINT) {
        return `${process.env.S3_ENDPOINT.replace(/\/$/, '')}/${bucket}/${key}`;
      }
      return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    };

    // Build variants array for meta with platform information
    const variants = generatedFiles
      .filter((file) => file.platform)
      .map((file) => {
        const key = uploadResults.find(k => k === file.key) || file.key;
        return {
          platform: file.platform,
          postType: file.postType,
          format: `${file.platform}_${file.postType}`,
          url: generatePublicUrl(key),
          key,
        };
      });

    // Also include legacy variants (square, burned)
    const legacyVariants = uploadResults
      .filter((key) => key.includes('/square/') || key.includes('/burned/'))
      .map((key) => ({
        format: key.includes('/square/') ? 'square' : 'burned',
        url: generatePublicUrl(key),
        key,
      }));

    await prisma.videoAsset.update({
      where: { id: videoId },
      data: {
        processedUrl: processedKey ? generatePublicUrl(processedKey) : undefined,
        vttUrl: vttKey ? generatePublicUrl(vttKey) : undefined,
        thumbnailUrl: thumbnailKey ? generatePublicUrl(thumbnailKey) : undefined,
        status: 'ready',
        meta: {
          originalKey: s3Key,
          outputs: uploadResults,
          variants: [...variants, ...legacyVariants],
          platformVariants: variants,
          transcript,
          processingOptions: options,
          scheduledPlatforms,
          creativeType,
          aspectRatio,
          validation: scheduledPlatforms.map(p => {
            const format = getPlatformFormat(p.platform, p.postType);
            if (!format) return null;
            return {
              platform: p.platform,
              postType: p.postType,
              ...validateCreativeForPlatform(
                p.platform,
                p.postType || 'feed',
                metadata.width,
                metadata.height,
                metadata.duration
              ),
            };
          }).filter(Boolean),
        },
      },
    });
    await job.updateProgress(100);
  } catch (error) {
    console.error('videoProcessor job failed:', error);
    await prisma.videoAsset.update({
      where: { id: videoId },
      data: {
        status: 'failed',
        meta: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      },
    });
    throw error;
  } finally {
    await Promise.allSettled(generatedFiles.map((file) => fs.rm(file.path, { force: true }).catch(() => undefined)));
    await fs.rm(sourcePath, { force: true }).catch(() => undefined);
  }
}

export const videoProcessorWorker = new Worker<VideoJobData>(
  VIDEO_QUEUE_NAME,
  async (job) => {
    await processVideoJob(job);
  },
  {
    connection: { url: redisUrl },
    concurrency: Number(process.env.VIDEO_WORKER_CONCURRENCY || 2),
  }
);

videoProcessorWorker.on('completed', (job) => {
  console.log(`[video-processor-worker] completed job ${job.id}`);
});

videoProcessorWorker.on('failed', (job, err) => {
  console.error(`[video-processor-worker] failed job ${job?.id}:`, err);
});

async function shutdown() {
  console.log('[video-processor-worker] shutting down');
  await videoProcessorWorker.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

