import { buildPresetArgs, getPreset, getPresetInfo, presets } from '../../video/presets';
import { 
  generateSrtContent, 
  parseSrtContent, 
  formatSrtTime, 
  validateCaptionSegments,
  mergeOverlappingSegments,
  CaptionSegment 
} from '../../video/captions';

// Mock environment variables
jest.mock('../../env', () => ({
  env: {
    MOBILE_BITRATE_LIMIT: '2000000',
    HIGH_BITRATE_LIMIT: '8000000'
  }
}));

describe('Video Presets', () => {
  describe('getPreset', () => {
    it('should return mobile preset', () => {
      const preset = getPreset('mobile');
      expect(preset.name).toBe('mobile');
      expect(preset.description).toContain('Mobile-optimized');
      expect(preset.maxResolution).toBe('1920x1080');
      expect(preset.bitrateLimit).toBe(2000000);
    });

    it('should return high preset', () => {
      const preset = getPreset('high');
      expect(preset.name).toBe('high');
      expect(preset.description).toContain('High-quality');
      expect(preset.maxResolution).toBe('3840x2160');
      expect(preset.bitrateLimit).toBe(8000000);
    });

    it('should throw error for unknown preset', () => {
      expect(() => getPreset('unknown')).toThrow('Unknown preset: unknown');
    });
  });

  describe('buildPresetArgs', () => {
    it('should build mobile preset args with trim', () => {
      const args = buildPresetArgs('/input.mp4', '/output.mp4', 'mobile', {
        trimStartSec: 10,
        trimDurationSec: 30
      });

      expect(args).toContain('-ss');
      expect(args).toContain('10');
      expect(args).toContain('-t');
      expect(args).toContain('30');
      expect(args).toContain('-i');
      expect(args).toContain('/input.mp4');
      expect(args).toContain('-c:v');
      expect(args).toContain('libx264');
      expect(args).toContain('-profile:v');
      expect(args).toContain('baseline');
      expect(args).toContain('/output.mp4');
    });

    it('should build high preset args with color filter', () => {
      const args = buildPresetArgs('/input.mp4', '/output.mp4', 'high', {
        colorFilter: 'grayscale'
      });

      expect(args).toContain('-c:v');
      expect(args).toContain('libx264');
      expect(args).toContain('-profile:v');
      expect(args).toContain('high');
      expect(args).toContain('-vf');
      expect(args).toContain('hue=s=0');
    });

    it('should build args with caption burning', () => {
      const args = buildPresetArgs('/input.mp4', '/output.mp4', 'mobile', {
        burnCaptions: true,
        captionPath: '/captions.srt'
      });

      expect(args).toContain('-i');
      expect(args).toContain('/captions.srt');
      expect(args).toContain('-vf');
      expect(args).toContain('subtitles=');
    });

    it('should handle sepia filter', () => {
      const args = buildPresetArgs('/input.mp4', '/output.mp4', 'mobile', {
        colorFilter: 'sepia'
      });

      expect(args).toContain('-vf');
      expect(args).toContain('colorchannelmixer=');
    });
  });

  describe('getPresetInfo', () => {
    it('should return preset info for mobile', () => {
      const info = getPresetInfo('mobile');
      expect(info.name).toBe('mobile');
      expect(info.description).toContain('Mobile-optimized');
      expect(info.maxResolution).toBe('1920x1080');
      expect(info.bitrateLimit).toBe(2000000);
      expect(info.estimatedFileSize).toBe('2000kbps');
    });

    it('should return preset info for high', () => {
      const info = getPresetInfo('high');
      expect(info.name).toBe('high');
      expect(info.description).toContain('High-quality');
      expect(info.maxResolution).toBe('3840x2160');
      expect(info.bitrateLimit).toBe(8000000);
      expect(info.estimatedFileSize).toBe('8000kbps');
    });
  });

  describe('preset configurations', () => {
    it('should have mobile preset with correct settings', () => {
      expect(presets.mobile.ffmpegArgs).toContain('-profile:v');
      expect(presets.mobile.ffmpegArgs).toContain('baseline');
      expect(presets.mobile.ffmpegArgs).toContain('-preset');
      expect(presets.mobile.ffmpegArgs).toContain('fast');
      expect(presets.mobile.ffmpegArgs).toContain('-crf');
      expect(presets.mobile.ffmpegArgs).toContain('28');
    });

    it('should have high preset with correct settings', () => {
      expect(presets.high.ffmpegArgs).toContain('-profile:v');
      expect(presets.high.ffmpegArgs).toContain('high');
      expect(presets.high.ffmpegArgs).toContain('-preset');
      expect(presets.high.ffmpegArgs).toContain('slow');
      expect(presets.high.ffmpegArgs).toContain('-crf');
      expect(presets.high.ffmpegArgs).toContain('18');
    });
  });
});

describe('Caption Processing', () => {
  describe('formatSrtTime', () => {
    it('should format time correctly', () => {
      expect(formatSrtTime(0)).toBe('00:00:00,000');
      expect(formatSrtTime(65.5)).toBe('00:01:05,500');
      expect(formatSrtTime(3661.123)).toBe('01:01:01,123');
    });
  });

  describe('generateSrtContent', () => {
    it('should generate valid SRT content', () => {
      const segments: CaptionSegment[] = [
        { start: 0, end: 3, text: 'Hello world' },
        { start: 3, end: 6, text: 'This is a test' }
      ];

      const srtContent = generateSrtContent(segments);
      
      expect(srtContent).toContain('1\n00:00:00,000 --> 00:00:03,000\nHello world\n');
      expect(srtContent).toContain('2\n00:00:03,000 --> 00:00:06,000\nThis is a test\n');
    });
  });

  describe('parseSrtContent', () => {
    it('should parse SRT content correctly', () => {
      const srtContent = `1
00:00:00,000 --> 00:00:03,000
Hello world

2
00:00:03,000 --> 00:00:06,000
This is a test`;

      const segments = parseSrtContent(srtContent);
      
      expect(segments).toHaveLength(2);
      expect(segments[0]).toEqual({
        start: 0,
        end: 3,
        text: 'Hello world'
      });
      expect(segments[1]).toEqual({
        start: 3,
        end: 6,
        text: 'This is a test'
      });
    });

    it('should handle malformed SRT content', () => {
      const srtContent = `1
Invalid time format
Hello world`;

      const segments = parseSrtContent(srtContent);
      expect(segments).toHaveLength(0);
    });
  });

  describe('validateCaptionSegments', () => {
    it('should validate correct segments', () => {
      const segments: CaptionSegment[] = [
        { start: 0, end: 3, text: 'Hello' },
        { start: 3, end: 6, text: 'World' }
      ];

      expect(validateCaptionSegments(segments)).toBe(true);
    });

    it('should reject invalid segments', () => {
      expect(validateCaptionSegments([])).toBe(false);
      expect(validateCaptionSegments([
        { start: -1, end: 3, text: 'Hello' }
      ])).toBe(false);
      expect(validateCaptionSegments([
        { start: 3, end: 1, text: 'Hello' }
      ])).toBe(false);
      expect(validateCaptionSegments([
        { start: 0, end: 3, text: '' }
      ])).toBe(false);
    });
  });

  describe('mergeOverlappingSegments', () => {
    it('should merge overlapping segments', () => {
      const segments: CaptionSegment[] = [
        { start: 0, end: 3, text: 'Hello' },
        { start: 2, end: 5, text: 'World' },
        { start: 6, end: 9, text: 'Test' }
      ];

      const merged = mergeOverlappingSegments(segments);
      
      expect(merged).toHaveLength(2);
      expect(merged[0]).toEqual({
        start: 0,
        end: 5,
        text: 'Hello World'
      });
      expect(merged[1]).toEqual({
        start: 6,
        end: 9,
        text: 'Test'
      });
    });

    it('should handle non-overlapping segments', () => {
      const segments: CaptionSegment[] = [
        { start: 0, end: 3, text: 'Hello' },
        { start: 4, end: 7, text: 'World' }
      ];

      const merged = mergeOverlappingSegments(segments);
      
      expect(merged).toHaveLength(2);
      expect(merged[0]).toEqual({ start: 0, end: 3, text: 'Hello' });
      expect(merged[1]).toEqual({ start: 4, end: 7, text: 'World' });
    });

    it('should handle empty segments', () => {
      expect(mergeOverlappingSegments([])).toEqual([]);
    });
  });
});

describe('Integration Tests', () => {
  describe('Preset and Caption Integration', () => {
    it('should build complete args with preset and captions', () => {
      const args = buildPresetArgs('/input.mp4', '/output.mp4', 'high', {
        trimStartSec: 10,
        trimDurationSec: 60,
        colorFilter: 'grayscale',
        burnCaptions: true,
        captionPath: '/captions.srt'
      });

      // Should include all features
      expect(args).toContain('-ss');
      expect(args).toContain('10');
      expect(args).toContain('-t');
      expect(args).toContain('60');
      expect(args).toContain('-i');
      expect(args).toContain('/input.mp4');
      expect(args).toContain('-i');
      expect(args).toContain('/captions.srt');
      expect(args).toContain('-profile:v');
      expect(args).toContain('high');
      expect(args).toContain('-vf');
      expect(args).toContain('hue=s=0');
      expect(args).toContain('subtitles=');
    });
  });

  describe('Caption SRT Format', () => {
    it('should generate and parse SRT correctly', () => {
      const originalSegments: CaptionSegment[] = [
        { start: 0, end: 3.5, text: 'Hello world' },
        { start: 3.5, end: 7.2, text: 'This is a test caption' },
        { start: 7.2, end: 10, text: 'With multiple lines\nof text' }
      ];

      // Generate SRT
      const srtContent = generateSrtContent(originalSegments);
      
      // Parse back
      const parsedSegments = parseSrtContent(srtContent);
      
      // Should match original
      expect(parsedSegments).toHaveLength(3);
      expect(parsedSegments[0].text).toBe('Hello world');
      expect(parsedSegments[1].text).toBe('This is a test caption');
      expect(parsedSegments[2].text).toBe('With multiple lines\nof text');
    });
  });
});
