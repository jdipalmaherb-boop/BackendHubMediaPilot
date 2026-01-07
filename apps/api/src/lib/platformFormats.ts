/**
 * Platform-specific format configurations for video/image exports
 */

export interface PlatformFormat {
  width: number;
  height: number;
  aspectRatio: string;
  codec: 'h264' | 'h265';
  format: 'mp4' | 'webm';
  bitrate: number; // Target bitrate in bps
  maxDuration?: number; // Max duration in seconds
  minDuration?: number; // Min duration in seconds
}

export const PLATFORM_FORMATS: Record<string, PlatformFormat> = {
  'instagram_feed': {
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    codec: 'h264',
    format: 'mp4',
    bitrate: 5000000, // 5 Mbps
    maxDuration: 60,
  },
  'instagram_story': {
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    codec: 'h264',
    format: 'mp4',
    bitrate: 5000000,
    maxDuration: 15,
  },
  'instagram_reels': {
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    codec: 'h264',
    format: 'mp4',
    bitrate: 5000000,
    minDuration: 15,
    maxDuration: 90,
  },
  'facebook_feed': {
    width: 1200,
    height: 628,
    aspectRatio: '1.91:1',
    codec: 'h264',
    format: 'mp4',
    bitrate: 6000000, // 6 Mbps
    maxDuration: 240,
  },
  'youtube_shorts': {
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    codec: 'h264',
    format: 'mp4',
    bitrate: 8000000, // 8 Mbps
    maxDuration: 60,
  },
  'youtube_video': {
    width: 1920,
    height: 1080,
    aspectRatio: '16:9',
    codec: 'h264',
    format: 'mp4',
    bitrate: 8000000,
    minDuration: 60,
  },
  'linkedin': {
    width: 1200,
    height: 627,
    aspectRatio: '1.91:1',
    codec: 'h264',
    format: 'mp4',
    bitrate: 6000000,
    maxDuration: 300,
  },
  'tiktok': {
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    codec: 'h264',
    format: 'mp4',
    bitrate: 5000000,
    minDuration: 15,
    maxDuration: 180,
  },
};

/**
 * Get platform format configuration
 */
export function getPlatformFormat(platform: string, postType?: string): PlatformFormat | null {
  const key = postType 
    ? `${platform}_${postType}`.toLowerCase()
    : platform.toLowerCase();
  
  return PLATFORM_FORMATS[key] || null;
}

/**
 * Detect creative type based on dimensions and duration
 */
export function detectCreativeType(
  width: number,
  height: number,
  duration?: number
): 'SHORT' | 'REEL' | 'FEED_VIDEO' | 'STORY' | 'CAROUSEL' | 'IMAGE' {
  const aspectRatio = width / height;
  
  // Image (no duration)
  if (!duration) {
    return 'IMAGE';
  }
  
  // Story format: 9:16, < 15s
  if (Math.abs(aspectRatio - 9/16) < 0.1 && duration < 15) {
    return 'STORY';
  }
  
  // Short: 9:16, < 60s
  if (Math.abs(aspectRatio - 9/16) < 0.1 && duration < 60) {
    return 'SHORT';
  }
  
  // Reel: 9:16, 15s-90s
  if (Math.abs(aspectRatio - 9/16) < 0.1 && duration >= 15 && duration <= 90) {
    return 'REEL';
  }
  
  // Feed video: 16:9 or 1:1, 60-180s
  if (
    (Math.abs(aspectRatio - 16/9) < 0.1 || Math.abs(aspectRatio - 1) < 0.1) &&
    duration >= 60 && duration <= 180
  ) {
    return 'FEED_VIDEO';
  }
  
  // Default to feed video for other cases
  return 'FEED_VIDEO';
}

/**
 * Validate creative against platform requirements
 */
export function validateCreativeForPlatform(
  platform: string,
  postType: string,
  width: number,
  height: number,
  duration?: number
): { valid: boolean; warnings: string[]; errors: string[] } {
  const format = getPlatformFormat(platform, postType);
  const warnings: string[] = [];
  const errors: string[] = [];
  
  if (!format) {
    warnings.push(`No format configuration found for ${platform}/${postType}`);
    return { valid: true, warnings, errors };
  }
  
  const aspectRatio = width / height;
  const targetAspectRatio = parseFloat(format.aspectRatio.replace(':', '/'));
  
  // Check aspect ratio
  if (Math.abs(aspectRatio - targetAspectRatio) > 0.1) {
    errors.push(
      `Aspect ratio mismatch: ${width}x${height} (${aspectRatio.toFixed(2)}) doesn't match required ${format.aspectRatio}`
    );
  }
  
  // Check duration
  if (duration) {
    if (format.maxDuration && duration > format.maxDuration) {
      errors.push(`Duration ${duration}s exceeds maximum ${format.maxDuration}s for ${platform} ${postType}`);
    }
    if (format.minDuration && duration < format.minDuration) {
      errors.push(`Duration ${duration}s is below minimum ${format.minDuration}s for ${platform} ${postType}`);
    }
  }
  
  // Check dimensions (warn if significantly different)
  if (width < format.width * 0.8 || height < format.height * 0.8) {
    warnings.push(
      `Dimensions ${width}x${height} are smaller than recommended ${format.width}x${format.height}`
    );
  }
  
  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Get aspect ratio string from dimensions
 */
export function getAspectRatioString(width: number, height: number): string {
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
}


