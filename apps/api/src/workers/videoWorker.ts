import { createWriteStream, promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { prisma } from '../lib/prisma';
import { createS3Client } from '../lib/s3';
import { env } from '../env';
import { VideoJobPayload, VideoJobResult } from '../queues/videoQueue';
import { buildPresetArgs, getPreset } from '../video/presets';
import { processCaptions, CaptionOptions } from '../video/captions';

const execFileAsync = promisify(execFile);

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function downloadFromS3(s3: S3Client, key: string, destPath: string): Promise<void> {
  const res = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  const body = res.Body as NodeJS.ReadableStream;
  await new Promise<void>((resolve, reject) => {
    const writeStream = createWriteStream(destPath);
    body.pipe(writeStream);
    body.on('error', reject);
    writeStream.on('finish', () => resolve());
    writeStream.on('error', reject);
  });
}

async function uploadToS3(s3: S3Client, key: string, filePath: string, contentType = 'video/mp4'): Promise<void> {
  const data = await fs.readFile(filePath);
  await s3.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: data, ContentType: contentType }));
}

export function buildFfmpegArgs(inputPath: string, outputPath: string, edits: VideoJobPayload['edits'] = {}): string[] {
  // Use preset-based args instead of manual building
  const presetName = edits?.preset || 'mobile'; // default to mobile preset
  return buildPresetArgs(inputPath, outputPath, presetName, {
    trimStartSec: edits?.trimStartSec,
    trimDurationSec: edits?.trimDurationSec,
    colorFilter: edits?.colorFilter,
    burnCaptions: edits?.burnCaptions,
    captionPath: edits?.captionPath
  });
}

export async function processVideoJob(payload: VideoJobPayload): Promise<VideoJobResult> {
  const s3 = createS3Client();

  // Create isolated tmp dir
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `vh-${payload.jobId}-`));
  const inputName = sanitizeFilename(payload.originalFilename || 'input.mp4');
  const inputPath = path.join(tmpDir, inputName);
  const outputPath = path.join(tmpDir, 'output.mp4');

  try {
    // Download source
    await downloadFromS3(s3, payload.s3Key, inputPath);

    // Process captions if requested
    let captionPath: string | undefined;
    let captionResult: any = null;
    
    if (payload.edits?.captions) {
      const captionOptions: CaptionOptions = {
        language: payload.edits?.captionLanguage || 'en',
        model: payload.edits?.captionModel || 'whisper',
        generateSrt: true,
        burnIntoVideo: payload.edits?.burnCaptions || false
      };

      const captionProcess = await processCaptions(inputPath, tmpDir, captionOptions);
      captionPath = captionProcess.srtPath;
      captionResult = captionProcess.result;

      // If burning captions, update the edits to include caption path
      if (payload.edits?.burnCaptions && captionPath) {
        payload.edits.captionPath = captionPath;
      }
    }

    // Build ffmpeg args using presets
    const ffmpegArgs = buildFfmpegArgs(inputPath, outputPath, payload.edits);

    // Execute ffmpeg with constrained process priority
    await execFileAsync('ffmpeg', ffmpegArgs, {
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
    });

    // Upload output
    const outputKey = `outputs/${payload.userId}/${payload.jobId}.mp4`;
    await uploadToS3(s3, outputKey, outputPath, 'video/mp4');

    // Upload SRT file if generated
    let srtKey: string | undefined;
    if (captionPath && payload.edits?.captions) {
      srtKey = `outputs/${payload.userId}/${payload.jobId}.srt`;
      await uploadToS3(s3, srtKey, captionPath, 'text/plain');
    }

    // Update job status with comprehensive metadata
    const preset = getPreset(payload.edits?.preset || 'mobile');
    await prisma.job.update({
      where: { id: payload.jobId },
      data: {
        status: 'completed',
        outputKey,
        meta: {
          result: {
            format: 'mp4',
            preset: preset.name,
            presetDescription: preset.description,
            maxResolution: preset.maxResolution,
            bitrateLimit: preset.bitrateLimit,
            srtKey,
            captionSegments: captionResult?.segments?.length || 0,
            captionLanguage: captionResult?.language,
            captionConfidence: captionResult?.confidence,
          },
          processedAt: new Date().toISOString(),
        } as any,
      },
    });

    return { 
      success: true, 
      outputKey,
      metadata: {
        format: 'mp4',
        preset: preset.name,
        captionSegments: captionResult?.segments?.length || 0,
        srtKey
      }
    };
  } catch (error) {
    // Let BullMQ retry via throw, but persist attempt details
    await prisma.job.update({
      where: { id: payload.jobId },
      data: {
        status: 'failed',
        attempts: { increment: 1 } as any,
        meta: {
          error: error instanceof Error ? error.message : 'Unknown error',
          failedAt: new Date().toISOString(),
        } as any,
      },
    });
    throw error;
  } finally {
    // Cleanup
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

export default async function videoWorkerHandler(job: { data: VideoJobPayload }): Promise<VideoJobResult> {
  return processVideoJob(job.data);
}


