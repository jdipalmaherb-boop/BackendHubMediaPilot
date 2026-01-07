import { buildFfmpegArgs, processVideoJob } from '../../workers/videoWorker';
import { createS3Client } from '../../lib/s3';
import { prisma } from '../../lib/prisma';

jest.mock('@aws-sdk/client-s3', () => ({
  GetObjectCommand: jest.fn(),
  PutObjectCommand: jest.fn(),
}));

jest.mock('../../lib/s3', () => ({
  createS3Client: jest.fn().mockReturnValue({
    send: jest.fn().mockResolvedValue({ Body: require('stream').Readable.from(Buffer.from('data')) })
  }),
}));

jest.mock('child_process', () => ({
  execFile: (file: string, args: string[], opts: any, cb?: any) => {
    if (typeof opts === 'function') {
      cb = opts; // eslint-disable-line no-param-reassign
    }
    // Simulate ffmpeg success
    if (cb) cb(null, { stdout: 'ok', stderr: '' });
  }
}));

describe('videoWorker', () => {
  describe('buildFfmpegArgs', () => {
    it('builds args for trim and transcode with grayscale', () => {
      const args = buildFfmpegArgs('/in.mp4', '/out.mp4', {
        trimStartSec: 5,
        trimDurationSec: 10,
        transcode: true,
        colorFilter: 'grayscale'
      });
      expect(args).toEqual(expect.arrayContaining(['-ss', '5', '-t', '10', '-i', '/in.mp4']));
      expect(args).toEqual(expect.arrayContaining(['-c:v', 'libx264']));
      expect(args).toEqual(expect.arrayContaining(['-vf', 'hue=s=0']));
      expect(args[args.length - 1]).toBe('/out.mp4');
    });

    it('copies streams when transcode is false', () => {
      const args = buildFfmpegArgs('/in.mp4', '/out.mp4', { transcode: false });
      expect(args).toEqual(expect.arrayContaining(['-c', 'copy']));
    });
  });

  describe('processVideoJob', () => {
    it('uploads processed output and updates job', async () => {
      const user = await prisma.user.create({ data: { email: 'x@y.z' } });
      const job = await prisma.job.create({ data: { userId: user.id, type: 'video_process', status: 'queued', s3Key: 'uploads/k/in.mp4' } });

      // Mock S3 get to stream some content
      (createS3Client as jest.Mock).mockReturnValue({
        send: jest.fn().mockImplementation(async (cmd: any) => {
          if (cmd.constructor.name === 'GetObjectCommand') {
            return { Body: require('stream').Readable.from(Buffer.alloc(10)) };
          }
          if (cmd.constructor.name === 'PutObjectCommand') {
            return {};
          }
          return {};
        })
      });

      const res = await processVideoJob({
        s3Key: 'uploads/' + user.id + '/file.mp4',
        userId: user.id,
        jobId: job.id,
        originalFilename: 'file.mp4',
        contentType: 'video/mp4',
        size: 1000,
      });

      expect(res.success).toBe(true);
      const updated = await prisma.job.findUnique({ where: { id: job.id } });
      expect(updated?.status).toBe('completed');
      expect(updated?.outputKey).toBe(`outputs/${user.id}/${job.id}.mp4`);
    });
  });
});


