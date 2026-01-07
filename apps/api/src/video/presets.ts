import { env } from '../env';

export interface VideoPreset {
  name: string;
  description: string;
  ffmpegArgs: string[];
  maxResolution: string;
  bitrateLimit?: number;
}

export interface PresetConfig {
  mobile: VideoPreset;
  high: VideoPreset;
}

// Mobile-friendly preset: H.264 baseline, 1080p max, optimized for mobile
export const mobilePreset: VideoPreset = {
  name: 'mobile',
  description: 'Mobile-optimized encoding with H.264 baseline profile',
  maxResolution: '1920x1080',
  bitrateLimit: Number(env.MOBILE_BITRATE_LIMIT || '2000000'), // 2Mbps default
  ffmpegArgs: [
    '-c:v', 'libx264',
    '-profile:v', 'baseline',
    '-level', '3.1',
    '-preset', 'fast',
    '-crf', '28',
    '-maxrate', String(Number(env.MOBILE_BITRATE_LIMIT || '2000000')),
    '-bufsize', String(Number(env.MOBILE_BITRATE_LIMIT || '2000000') * 2),
    '-vf', 'scale=min(1920\\,iw):min(1080\\,ih):force_original_aspect_ratio=decrease',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ac', '2',
    '-ar', '44100',
    '-movflags', '+faststart'
  ]
};

// High-quality preset: H.264 high profile, 1080p-4K selectable, slow preset
export const highPreset: VideoPreset = {
  name: 'high',
  description: 'High-quality encoding with H.264 high profile',
  maxResolution: '3840x2160', // 4K
  bitrateLimit: Number(env.HIGH_BITRATE_LIMIT || '8000000'), // 8Mbps default
  ffmpegArgs: [
    '-c:v', 'libx264',
    '-profile:v', 'high',
    '-level', '4.1',
    '-preset', 'slow',
    '-crf', '18',
    '-maxrate', String(Number(env.HIGH_BITRATE_LIMIT || '8000000')),
    '-bufsize', String(Number(env.HIGH_BITRATE_LIMIT || '8000000') * 2),
    '-vf', 'scale=min(3840\\,iw):min(2160\\,ih):force_original_aspect_ratio=decrease',
    '-c:a', 'aac',
    '-b:a', '256k',
    '-ac', '2',
    '-ar', '48000',
    '-movflags', '+faststart'
  ]
};

export const presets: PresetConfig = {
  mobile: mobilePreset,
  high: highPreset
};

// Helper function to get preset by name
export function getPreset(presetName: string): VideoPreset {
  const preset = presets[presetName as keyof PresetConfig];
  if (!preset) {
    throw new Error(`Unknown preset: ${presetName}. Available presets: ${Object.keys(presets).join(', ')}`);
  }
  return preset;
}

// Helper function to build complete FFmpeg args with preset
export function buildPresetArgs(
  inputPath: string,
  outputPath: string,
  presetName: string,
  customEdits?: {
    trimStartSec?: number;
    trimDurationSec?: number;
    colorFilter?: 'grayscale' | 'sepia' | 'none';
    burnCaptions?: boolean;
    captionPath?: string;
  }
): string[] {
  const preset = getPreset(presetName);
  const args: string[] = ['-y'];

  // Add trim options
  if (typeof customEdits?.trimStartSec === 'number') {
    args.push('-ss', String(Math.max(0, customEdits.trimStartSec)));
  }
  if (typeof customEdits?.trimDurationSec === 'number') {
    args.push('-t', String(Math.max(0, customEdits.trimDurationSec)));
  }

  // Add input
  args.push('-i', inputPath);

  // Add caption input if burning captions
  if (customEdits?.burnCaptions && customEdits?.captionPath) {
    args.push('-i', customEdits.captionPath);
  }

  // Build video filters
  const videoFilters: string[] = [];
  
  // Add scaling filter from preset
  const scaleFilter = preset.ffmpegArgs.find(arg => arg.startsWith('scale='));
  if (scaleFilter) {
    videoFilters.push(scaleFilter);
  }

  // Add color filters
  if (customEdits?.colorFilter === 'grayscale') {
    videoFilters.push('hue=s=0');
  } else if (customEdits?.colorFilter === 'sepia') {
    videoFilters.push('colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131');
  }

  // Add caption burning filter
  if (customEdits?.burnCaptions && customEdits?.captionPath) {
    videoFilters.push(`subtitles=${customEdits.captionPath.replace(/\\/g, '\\\\')}`);
  }

  // Add preset video encoding args
  const videoArgs = preset.ffmpegArgs.filter(arg => 
    arg.startsWith('-c:v') || 
    arg.startsWith('-profile:v') || 
    arg.startsWith('-level') || 
    arg.startsWith('-preset') || 
    arg.startsWith('-crf') || 
    arg.startsWith('-maxrate') || 
    arg.startsWith('-bufsize')
  );
  args.push(...videoArgs);

  // Add video filters if any
  if (videoFilters.length > 0) {
    args.push('-vf', videoFilters.join(','));
  }

  // Add audio encoding args
  const audioArgs = preset.ffmpegArgs.filter(arg => 
    arg.startsWith('-c:a') || 
    arg.startsWith('-b:a') || 
    arg.startsWith('-ac') || 
    arg.startsWith('-ar')
  );
  args.push(...audioArgs);

  // Add movflags
  const movflags = preset.ffmpegArgs.find(arg => arg.startsWith('-movflags'));
  if (movflags) {
    args.push(movflags);
  }

  // Add output
  args.push(outputPath);

  return args;
}

// Helper function to get preset info
export function getPresetInfo(presetName: string) {
  const preset = getPreset(presetName);
  return {
    name: preset.name,
    description: preset.description,
    maxResolution: preset.maxResolution,
    bitrateLimit: preset.bitrateLimit,
    estimatedFileSize: preset.bitrateLimit ? `${Math.round(preset.bitrateLimit / 1000)}kbps` : 'variable'
  };
}
