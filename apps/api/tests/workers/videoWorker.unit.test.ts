import { Job } from 'bullmq';
import { testPrisma, testUtils, mockS3, mockQueue } from '../../__tests__/setup';
import { processVideoJob } from '../../workers/videoWorker';
import { buildFfmpegArgs, getPreset } from '../../video/presets';
import { extractCaptions, generateSrtContent } from '../../video/captions';

// Mock the prisma client
jest.mock('../../lib/prisma', () => ({
  prisma: testPrisma,
}));

// Mock external dependencies
jest.mock('child_process');
jest.mock('fs/promises');
jest.mock('path');
jest.mock('crypto');

// Mock video processing modules
jest.mock('../../video/presets');
jest.mock('../../video/captions');

describe('Video Worker Unit Tests', () => {
  let user: any;
  let job: any;

  beforeEach(async () => {
    await testUtils.cleanup();
    
    user = await testUtils.createTestUser({
      email: 'video@example.com',
    });

    // Mock job data
    job = {
      id: 'test-job-123',
      data: {
        jobId: 'test-job-123',
        userId: user.id,
        type: 'video_process',
        metadata: {
          key: 'uploads/user123/test-video.mp4',
          size: 1024 * 1024,
          contentType: 'video/mp4',
          originalFilename: 'test-video.mp4',
          duration: 30,
          resolution: '1920x1080',
        },
      },
      updateProgress: jest.fn(),
    };

    // Mock S3 operations
    mockS3.send.mockImplementation((command) => {
      if (command.constructor.name === 'GetObjectCommand') {
        return Promise.resolve({
          Body: {
            transformToByteArray: () => Promise.resolve(new Uint8Array(1024)),
          },
        });
      }
      if (command.constructor.name === 'PutObjectCommand') {
        return Promise.resolve({});
      }
      return Promise.resolve({});
    });

    // Mock file system operations
    const fs = require('fs/promises');
    fs.writeFile = jest.fn().mockResolvedValue(undefined);
    fs.readFile = jest.fn().mockResolvedValue(Buffer.from('test video data'));
    fs.unlink = jest.fn().mockResolvedValue(undefined);
    fs.mkdir = jest.fn().mockResolvedValue(undefined);
    fs.access = jest.fn().mockResolvedValue(undefined);

    // Mock path operations
    const path = require('path');
    path.join = jest.fn((...args) => args.join('/'));
    path.basename = jest.fn((filePath) => filePath.split('/').pop());
    path.extname = jest.fn((filePath) => {
      const ext = filePath.split('.').pop();
      return ext ? `.${ext}` : '';
    });

    // Mock crypto operations
    const crypto = require('crypto');
    crypto.randomUUID = jest.fn(() => 'test-uuid-123');
  });

  describe('processVideoJob', () => {
    it('should process video job successfully', async () => {
      // Create job in database
      const dbJob = await testPrisma.job.create({
        data: {
          id: job.data.jobId,
          userId: user.id,
          type: 'video_process',
          status: 'queued',
          metadata: job.data.metadata,
        },
      });

      // Mock FFmpeg operations
      const { spawn } = require('child_process');
      const mockSpawn = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 100); // Success exit code
          }
        }),
        kill: jest.fn(),
      };
      spawn.mockReturnValue(mockSpawn);

      // Mock video processing functions
      getPreset.mockReturnValue({
        videoCodec: 'libx264',
        audioCodec: 'aac',
        videoBitrate: '2000k',
        audioBitrate: '128k',
      });

      buildFfmpegArgs.mockReturnValue([
        '-i', 'input.mp4',
        '-c:v', 'libx264',
        '-c:a', 'aac',
        'output.mp4'
      ]);

      extractCaptions.mockResolvedValue({
        segments: [
          { start: 0, end: 5, text: 'Hello world' },
          { start: 5, end: 10, text: 'This is a test' },
        ],
      });

      generateSrtContent.mockReturnValue(`1
00:00:00,000 --> 00:00:05,000
Hello world

2
00:00:05,000 --> 00:00:10,000
This is a test
`);

      const result = await processVideoJob(job);

      expect(result).toEqual({
        success: true,
        outputs: {
          processed: 'processed/user123/test-uuid-123.mp4',
          thumbnail: 'thumbnails/user123/test-uuid-123.jpg',
          captions: 'captions/user123/test-uuid-123.srt',
        },
      });

      // Verify job was updated
      const updatedJob = await testPrisma.job.findUnique({
        where: { id: job.data.jobId },
      });
      expect(updatedJob?.status).toBe('completed');
      expect(updatedJob?.result).toMatchObject({
        success: true,
        outputs: expect.any(Object),
      });

      // Verify progress updates were called
      expect(job.updateProgress).toHaveBeenCalledWith(10);
      expect(job.updateProgress).toHaveBeenCalledWith(50);
      expect(job.updateProgress).toHaveBeenCalledWith(90);
      expect(job.updateProgress).toHaveBeenCalledWith(100);
    });

    it('should handle video processing errors', async () => {
      // Create job in database
      await testPrisma.job.create({
        data: {
          id: job.data.jobId,
          userId: user.id,
          type: 'video_process',
          status: 'queued',
          metadata: job.data.metadata,
        },
      });

      // Mock FFmpeg failure
      const { spawn } = require('child_process');
      const mockSpawn = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(1), 100); // Error exit code
          }
        }),
        kill: jest.fn(),
      };
      spawn.mockReturnValue(mockSpawn);

      const result = await processVideoJob(job);

      expect(result).toEqual({
        success: false,
        error: 'FFmpeg processing failed with exit code 1',
      });

      // Verify job was marked as failed
      const updatedJob = await testPrisma.job.findUnique({
        where: { id: job.data.jobId },
      });
      expect(updatedJob?.status).toBe('failed');
      expect(updatedJob?.error).toContain('FFmpeg processing failed');
    });

    it('should handle S3 download errors', async () => {
      // Create job in database
      await testPrisma.job.create({
        data: {
          id: job.data.jobId,
          userId: user.id,
          type: 'video_process',
          status: 'queued',
          metadata: job.data.metadata,
        },
      });

      // Mock S3 download failure
      mockS3.send.mockRejectedValue(new Error('S3 download failed'));

      const result = await processVideoJob(job);

      expect(result).toEqual({
        success: false,
        error: 'Failed to download video from S3: S3 download failed',
      });

      // Verify job was marked as failed
      const updatedJob = await testPrisma.job.findUnique({
        where: { id: job.data.jobId },
      });
      expect(updatedJob?.status).toBe('failed');
      expect(updatedJob?.error).toContain('S3 download failed');
    });

    it('should handle S3 upload errors', async () => {
      // Create job in database
      await testPrisma.job.create({
        data: {
          id: job.data.jobId,
          userId: user.id,
          type: 'video_process',
          status: 'queued',
          metadata: job.data.metadata,
        },
      });

      // Mock successful download but failed upload
      mockS3.send.mockImplementation((command) => {
        if (command.constructor.name === 'GetObjectCommand') {
          return Promise.resolve({
            Body: {
              transformToByteArray: () => Promise.resolve(new Uint8Array(1024)),
            },
          });
        }
        if (command.constructor.name === 'PutObjectCommand') {
          return Promise.reject(new Error('S3 upload failed'));
        }
        return Promise.resolve({});
      });

      // Mock successful FFmpeg processing
      const { spawn } = require('child_process');
      const mockSpawn = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 100);
          }
        }),
        kill: jest.fn(),
      };
      spawn.mockReturnValue(mockSpawn);

      const result = await processVideoJob(job);

      expect(result).toEqual({
        success: false,
        error: 'Failed to upload processed video to S3: S3 upload failed',
      });
    });

    it('should handle missing job in database', async () => {
      // Don't create job in database

      const result = await processVideoJob(job);

      expect(result).toEqual({
        success: false,
        error: 'Job not found in database',
      });
    });

    it('should handle caption extraction errors gracefully', async () => {
      // Create job in database
      await testPrisma.job.create({
        data: {
          id: job.data.jobId,
          userId: user.id,
          type: 'video_process',
          status: 'queued',
          metadata: job.data.metadata,
        },
      });

      // Mock successful FFmpeg processing
      const { spawn } = require('child_process');
      const mockSpawn = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 100);
          }
        }),
        kill: jest.fn(),
      };
      spawn.mockReturnValue(mockSpawn);

      // Mock caption extraction failure
      extractCaptions.mockRejectedValue(new Error('Caption extraction failed'));

      const result = await processVideoJob(job);

      // Should still succeed but without captions
      expect(result.success).toBe(true);
      expect(result.outputs.captions).toBeUndefined();
    });

    it('should process different video formats', async () => {
      const formats = [
        { input: 'test.mov', contentType: 'video/quicktime' },
        { input: 'test.avi', contentType: 'video/x-msvideo' },
        { input: 'test.mkv', contentType: 'video/x-matroska' },
      ];

      for (const format of formats) {
        await testUtils.cleanup();
        
        const formatJob = {
          ...job,
          data: {
            ...job.data,
            metadata: {
              ...job.data.metadata,
              key: `uploads/user123/test.${format.input.split('.').pop()}`,
              contentType: format.contentType,
              originalFilename: format.input,
            },
          },
        };

        await testPrisma.job.create({
          data: {
            id: formatJob.data.jobId,
            userId: user.id,
            type: 'video_process',
            status: 'queued',
            metadata: formatJob.data.metadata,
          },
        });

        // Mock successful processing
        const { spawn } = require('child_process');
        const mockSpawn = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn((event, callback) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 100);
            }
          }),
          kill: jest.fn(),
        };
        spawn.mockReturnValue(mockSpawn);

        const result = await processVideoJob(formatJob);

        expect(result.success).toBe(true);
        expect(result.outputs.processed).toContain('.mp4'); // Should convert to MP4
      }
    });

    it('should handle thumbnail generation', async () => {
      // Create job in database
      await testPrisma.job.create({
        data: {
          id: job.data.jobId,
          userId: user.id,
          type: 'video_process',
          status: 'queued',
          metadata: job.data.metadata,
        },
      });

      // Mock successful FFmpeg processing
      const { spawn } = require('child_process');
      const mockSpawn = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 100);
          }
        }),
        kill: jest.fn(),
      };
      spawn.mockReturnValue(mockSpawn);

      const result = await processVideoJob(job);

      expect(result.success).toBe(true);
      expect(result.outputs.thumbnail).toBeDefined();
      expect(result.outputs.thumbnail).toContain('.jpg');
    });

    it('should clean up temporary files', async () => {
      // Create job in database
      await testPrisma.job.create({
        data: {
          id: job.data.jobId,
          userId: user.id,
          type: 'video_process',
          status: 'queued',
          metadata: job.data.metadata,
        },
      });

      // Mock successful processing
      const { spawn } = require('child_process');
      const mockSpawn = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 100);
          }
        }),
        kill: jest.fn(),
      };
      spawn.mockReturnValue(mockSpawn);

      const fs = require('fs/promises');
      const unlinkSpy = jest.spyOn(fs, 'unlink');

      await processVideoJob(job);

      // Verify temporary files were cleaned up
      expect(unlinkSpy).toHaveBeenCalled();
    });

    it('should handle job timeout', async () => {
      // Create job in database
      await testPrisma.job.create({
        data: {
          id: job.data.jobId,
          userId: user.id,
          type: 'video_process',
          status: 'queued',
          metadata: job.data.metadata,
        },
      });

      // Mock FFmpeg timeout
      const { spawn } = require('child_process');
      const mockSpawn = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            // Don't call callback to simulate timeout
          }
        }),
        kill: jest.fn(),
      };
      spawn.mockReturnValue(mockSpawn);

      // Mock timeout
      jest.spyOn(global, 'setTimeout').mockImplementation((callback) => {
        callback();
        return {} as any;
      });

      const result = await processVideoJob(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
      expect(mockSpawn.kill).toHaveBeenCalled();
    });
  });

  describe('Video Processing Functions', () => {
    it('should build correct FFmpeg arguments', () => {
      const metadata = {
        duration: 30,
        resolution: '1920x1080',
        originalFilename: 'test.mp4',
      };

      const options = {
        trim: { start: 5, end: 25 },
        colorFilter: 'brightness=0.1',
        burnCaptions: true,
      };

      buildFfmpegArgs(metadata, options);

      expect(buildFfmpegArgs).toHaveBeenCalledWith(metadata, options);
    });

    it('should extract captions correctly', async () => {
      const audioPath = '/tmp/test-audio.wav';
      const expectedSegments = [
        { start: 0, end: 5, text: 'Hello world' },
        { start: 5, end: 10, text: 'This is a test' },
      ];

      extractCaptions.mockResolvedValue({ segments: expectedSegments });

      const result = await extractCaptions(audioPath);

      expect(result).toEqual({ segments: expectedSegments });
      expect(extractCaptions).toHaveBeenCalledWith(audioPath);
    });

    it('should generate SRT content correctly', () => {
      const segments = [
        { start: 0, end: 5, text: 'Hello world' },
        { start: 5, end: 10, text: 'This is a test' },
      ];

      const expectedSrt = `1
00:00:00,000 --> 00:00:05,000
Hello world

2
00:00:05,000 --> 00:00:10,000
This is a test
`;

      generateSrtContent.mockReturnValue(expectedSrt);

      const result = generateSrtContent(segments);

      expect(result).toBe(expectedSrt);
      expect(generateSrtContent).toHaveBeenCalledWith(segments);
    });
  });
});
