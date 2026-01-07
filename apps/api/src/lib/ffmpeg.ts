import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';

if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
}

if (process.env.FFPROBE_PATH) {
  ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);
}

function ensureDir(filePath: string) {
  return fs.mkdir(path.dirname(filePath), { recursive: true });
}

function runFfmpeg(command: ffmpeg.FfmpegCommand, output: string) {
  return new Promise<void>(async (resolve, reject) => {
    await ensureDir(output).catch(() => undefined);

    command
      .on('error', (error) => reject(error))
      .on('end', () => resolve())
      .save(output);
  });
}

export async function trimSilence(input: string, output: string, filter?: string | { filter?: string }) {
  const filterString = typeof filter === 'string' ? filter : filter?.filter ?? 'silenceremove=1:0:-50dB';
  const command = ffmpeg(input).audioFilters(filterString);
  await runFfmpeg(command, output);
}

function escapeForFilter(file: string) {
  return file.replace(/\\/g, '/').replace(/:/g, '\\:');
}

interface BurnOptions {
  scale?: string;
}

export async function burnSubtitles(input: string, vtt: string | null, output: string, options: BurnOptions = {}) {
  const command = ffmpeg(input);

  if (options.scale) {
    command.videoFilters(`scale=${options.scale}`);
  }

  if (vtt) {
    const escaped = escapeForFilter(path.resolve(vtt));
    command.outputOptions('-vf', `subtitles=${escaped}`);
  }

  await runFfmpeg(command, output);
}

export async function generateThumbnail(input: string, output: string, seekTime = 1) {
  const command = ffmpeg(input)
    .seekInput(seekTime)
    .frames(1)
    .outputOptions('-vf', 'thumbnail');

  await runFfmpeg(command, output);
}

/**
 * Get video metadata (width, height, duration)
 */
export async function getVideoMetadata(input: string): Promise<{
  width: number;
  height: number;
  duration: number;
  aspectRatio: string;
}> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(input, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const videoStream = metadata.streams?.find(s => s.codec_type === 'video');
      if (!videoStream) {
        reject(new Error('No video stream found'));
        return;
      }

      const width = videoStream.width || 0;
      const height = videoStream.height || 0;
      const duration = metadata.format?.duration || 0;
      const aspectRatio = width && height ? `${width}:${height}` : '1:1';

      resolve({
        width,
        height,
        duration,
        aspectRatio,
      });
    });
  });
}

/**
 * Resize and transcode video for platform-specific format
 */
export async function resizeVideoForPlatform(
  input: string,
  output: string,
  width: number,
  height: number,
  bitrate: number,
  codec: 'h264' | 'h265' = 'h264'
): Promise<void> {
  const command = ffmpeg(input)
    .videoCodec(codec === 'h265' ? 'libx265' : 'libx264')
    .videoFilters(`scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`)
    .videoBitrate(bitrate)
    .audioCodec('aac')
    .audioBitrate('128k')
    .outputOptions('-movflags', '+faststart');

  await runFfmpeg(command, output);
}
