# AI Video Editing Pipeline

## Overview
BackendHub''s video flow converts raw uploads into ready-to-publish marketing assets. The API orchestrates S3 storage, Whisper transcription, ffmpeg processing, and AI copy services via BullMQ workers.

## End-to-end Stages
1. **Upload & Intake**
   - Frontend requests a presigned URL (`POST /api/uploads/presign`).
   - File uploads to S3 and is finalized via `POST /api/uploads/complete`.
   - API stores a `VideoAsset` record and enqueues a `process-video` job.
2. **Queue & Worker**
   - Worker: `apps/api/src/workers/videoProcessor.ts` (BullMQ).
   - Job payload: `{ videoId, s3Key, ownerId, options }`.
   - Options control trimming, captioning, variant generation, thumbnails.
3. **Processing Steps**
   | Step | Tooling | Notes |
   |------|---------|-------|
   | Download | AWS SDK `GetObject` | Streams asset to `/tmp` or mounted volume. |
   | Silence Trim | `ffmpeg -af silenceremove` | Optional aggressive or light trim. |
   | Transcription | OpenAI Whisper (`aiTranscribe.ts`) | Falls back to Replicate when configured. |
   | Captions | `generateVttFromWords()` | Saves VTT to S3, optional burned captions. |
   | Variant Render | `generateVideoVariants()` | Produces square / vertical / horizontal crops. |
   | Thumbnail | `ffmpeg` screenshot | Seeks to configured timestamp. |
   | Upload | `uploadToS3()` | Stores all outputs under a shared prefix. |
   | Prisma Updates | `VideoAsset` row | Status `ready`, meta updated with transcript/options. |
4. **Outputs**
   ```json
   {
     "videoId": "cuid123",
     "status": "ready",
     "processedUrl": "https://s3.amazonaws.com/.../captions.mp4",
     "vttUrl": "https://.../video.vtt",
     "thumbnailUrl": "https://.../video.jpg",
     "meta": {
       "transcription": "...",
       "processingOptions": {
         "trimSilence": true,
         "generateCaptions": true,
         "generateVariants": true,
         "seekThumbnail": 2
       },
       "variants": [
         { "format": "square", "key": "...", "url": "..." },
         { "format": "vertical", "key": "...", "url": "..." }
       ]
     }
   }
   ```

## Configuration & Inputs
- **Environment**
  - `OPENAI_API_KEY` (Whisper + GPT)
  - `FFMPEG_PATH`, `FFPROBE_PATH` (optional if `ffmpeg-static` works)
  - `S3_BUCKET`, `S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
  - `REDIS_URL` (BullMQ backend)
- **Runtime Options** (job `options` payload)
  - `trimSilence: boolean`
  - `generateCaptions: boolean`
  - `generateVariants: boolean`
  - `seekThumbnail: number` (seconds)
  - `context` / `industry` for downstream copy generation

## Cost & Latency Considerations
| Component | Typical Latency | Approx. Cost | Notes |
|-----------|-----------------|--------------|-------|
| S3 Upload | Depends on client bandwidth | S3 PUT (~$0.005 per 1k requests) | Use multipart for >50 MB assets. |
| Whisper Transcription | 30–120 s for 3–5 min clip | ~$0.006 / minute (Whisper-1) | Latency scales linearly with duration. |
| ffmpeg Trim/Variants | 1–3× real time | Compute only | GPU / additional CPU workers reduce wall time. |
| VTT + Metadata | <5 s | Negligible | Ensures accessibility + editing context. |
| GPT Tips | 5–10 s | ~$0.02 per call (gpt-4o) | Cache per video to avoid repeat cost. |

> **Throughput note:** On 2 vCPU / 8 GB RAM, one worker clears ~3 five-minute jobs per hour. Scale via `VIDEO_WORKER_CONCURRENCY` and horizontal replicas.

## Failure & Retries
- BullMQ retries each job up to 3 times (default queue policy).
- Worker errors stored in `VideoAsset.meta.error` for UI debugging.
- Monitor BullMQ events (`completed`, `failed`) via logs or Bull Board.
- Use `apps/api/scripts/enqueueTestVideo.ts` to smoke-test the pipeline.

## Runbook Checklist
- [ ] Verify S3 credentials and bucket policy.
- [ ] Install ffmpeg/ffprobe (see `OPS/FFMPEG.md`).
- [ ] Confirm Redis is running (`REDIS_URL`).
- [ ] Set `OPENAI_API_KEY` (optionally `REPLICATE_API_KEY`).
- [ ] Start worker: `pnpm --filter api start-worker video`.
- [ ] Upload sample via `/upload` page and tail worker logs.
- [ ] Validate processed outputs inside `/ads` editor.
