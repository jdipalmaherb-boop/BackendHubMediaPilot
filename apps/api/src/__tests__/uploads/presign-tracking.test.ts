import request from 'supertest';
import express from 'express';
import presignRouter from '../../routes/uploads/presign';
import confirmRouter from '../../routes/uploads/confirm';
import { prisma } from '../../lib/prisma';

// Mock dependencies
jest.mock('../../lib/prisma', () => ({
  prisma: {
    presignRequest: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    job: {
      create: jest.fn(),
    },
  },
}));

jest.mock('../../lib/s3', () => ({
  createS3Client: jest.fn().mockReturnValue({}),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://s3.amazonaws.com/presigned-url'),
}));

jest.mock('../../queues/videoQueue', () => ({
  addVideoJob: jest.fn(),
  VIDEO_JOB_TYPES: {
    VIDEO_PROCESS: 'video_process',
    ASSET_INGEST: 'asset_ingest',
  },
}));

describe('Presign Request Tracking Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock auth middleware
    app.use((req: any, res, next) => {
      req.user = { id: 'user_123', email: 'test@example.com' };
      next();
    });
    
    app.use('/uploads', presignRouter);
    app.use('/uploads', confirmRouter);
    
    jest.clearAllMocks();
  });

  describe('Presign Request Creation', () => {
    it('should create presign request record when generating presigned URL', async () => {
      (prisma.presignRequest.create as jest.Mock).mockResolvedValue({
        id: 'presign_123',
        userId: 'user_123',
        key: 'uploads/user_123/12345-uuid-test.mp4',
        contentType: 'video/mp4',
        size: 1024000,
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
      });

      const response = await request(app)
        .post('/uploads/presign')
        .send({
          filename: 'test-video.mp4',
          contentType: 'video/mp4',
          size: 1024000,
        });

      expect(response.status).toBe(200);
      expect(response.body.url).toBeDefined();
      expect(response.body.key).toMatch(/^uploads\/user_123\//);
      expect(response.body.expiresAt).toBeDefined();

      // Verify presign request was created
      expect(prisma.presignRequest.create).toHaveBeenCalledWith({
        data: {
          userId: 'user_123',
          key: expect.stringMatching(/^uploads\/user_123\//),
          contentType: 'video/mp4',
          size: 1024000,
          expiresAt: expect.any(Date),
        },
      });
    });

    it('should include expiration time in response', async () => {
      const now = Date.now();
      const expiresAt = new Date(now + 3600000);

      (prisma.presignRequest.create as jest.Mock).mockResolvedValue({
        id: 'presign_123',
        userId: 'user_123',
        key: 'uploads/user_123/test.mp4',
        contentType: 'video/mp4',
        size: 1024000,
        expiresAt,
        createdAt: new Date(now),
      });

      const response = await request(app)
        .post('/uploads/presign')
        .send({
          filename: 'test.mp4',
          contentType: 'video/mp4',
          size: 1024000,
        });

      expect(response.status).toBe(200);
      expect(response.body.expiresAt).toBeDefined();
      expect(response.body.expiresIn).toBe(3600); // Default expiry
    });
  });

  describe('Upload Confirmation with Presign Validation', () => {
    it('should validate presign request exists before confirming', async () => {
      const key = 'uploads/user_123/12345-uuid-test.mp4';

      // Mock presign request not found
      (prisma.presignRequest.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/uploads/confirm')
        .send({
          key,
          type: 'video_process',
          meta: {
            originalFilename: 'test.mp4',
            contentType: 'video/mp4',
            size: 1024000,
          },
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('PRESIGN_NOT_FOUND');
      expect(response.body.error).toContain('No presign request found');
    });

    it('should reject confirmation if presign request belongs to different user', async () => {
      const key = 'uploads/user_123/12345-uuid-test.mp4';

      // Mock presign request belonging to different user
      (prisma.presignRequest.findUnique as jest.Mock).mockResolvedValue({
        id: 'presign_123',
        userId: 'user_different',
        key,
        contentType: 'video/mp4',
        size: 1024000,
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
      });

      const response = await request(app)
        .post('/uploads/confirm')
        .send({
          key,
          type: 'video_process',
          meta: {
            originalFilename: 'test.mp4',
            contentType: 'video/mp4',
            size: 1024000,
          },
        });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('PRESIGN_USER_MISMATCH');
    });

    it('should reject confirmation if presigned URL has expired', async () => {
      const key = 'uploads/user_123/12345-uuid-test.mp4';

      // Mock expired presign request
      (prisma.presignRequest.findUnique as jest.Mock).mockResolvedValue({
        id: 'presign_123',
        userId: 'user_123',
        key,
        contentType: 'video/mp4',
        size: 1024000,
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        createdAt: new Date(Date.now() - 3601000),
      });

      const response = await request(app)
        .post('/uploads/confirm')
        .send({
          key,
          type: 'video_process',
          meta: {
            originalFilename: 'test.mp4',
            contentType: 'video/mp4',
            size: 1024000,
          },
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('PRESIGN_EXPIRED');
      expect(response.body.error).toContain('expired');
    });

    it('should reject confirmation if content type does not match', async () => {
      const key = 'uploads/user_123/12345-uuid-test.mp4';

      // Mock presign request with different content type
      (prisma.presignRequest.findUnique as jest.Mock).mockResolvedValue({
        id: 'presign_123',
        userId: 'user_123',
        key,
        contentType: 'video/mp4',
        size: 1024000,
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
      });

      const response = await request(app)
        .post('/uploads/confirm')
        .send({
          key,
          type: 'video_process',
          meta: {
            originalFilename: 'test.jpg',
            contentType: 'image/jpeg', // Different content type!
            size: 1024000,
          },
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('CONTENT_TYPE_MISMATCH');
      expect(response.body.details).toEqual({
        expected: 'video/mp4',
        received: 'image/jpeg',
      });
    });

    it('should successfully confirm upload when presign request is valid', async () => {
      const key = 'uploads/user_123/12345-uuid-test.mp4';

      // Mock valid presign request
      (prisma.presignRequest.findUnique as jest.Mock).mockResolvedValue({
        id: 'presign_123',
        userId: 'user_123',
        key,
        contentType: 'video/mp4',
        size: 1024000,
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
      });

      // Mock job creation
      (prisma.job.create as jest.Mock).mockResolvedValue({
        id: 'job_123',
        userId: 'user_123',
        type: 'video_process',
        status: 'queued',
        s3Key: key,
      });

      const response = await request(app)
        .post('/uploads/confirm')
        .send({
          key,
          type: 'video_process',
          meta: {
            originalFilename: 'test.mp4',
            contentType: 'video/mp4',
            size: 1024000,
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.jobId).toBe('job_123');
      expect(response.body.status).toBe('queued');
    });
  });

  describe('Security - Presign Request Tampering', () => {
    it('should prevent using presign request from different user', async () => {
      const attackerKey = 'uploads/user_attacker/12345-uuid-test.mp4';

      // Attacker tries to confirm upload with their own key
      // but authenticated as user_123
      (prisma.presignRequest.findUnique as jest.Mock).mockResolvedValue({
        id: 'presign_attacker',
        userId: 'user_attacker',
        key: attackerKey,
        contentType: 'video/mp4',
        size: 1024000,
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
      });

      const response = await request(app)
        .post('/uploads/confirm')
        .send({
          key: attackerKey,
          type: 'video_process',
          meta: {
            originalFilename: 'test.mp4',
            contentType: 'video/mp4',
            size: 1024000,
          },
        });

      // Should fail because key doesn't match authenticated user
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('UNAUTHORIZED_FILE_ACCESS');
    });

    it('should prevent replay attacks with expired presign requests', async () => {
      const key = 'uploads/user_123/old-upload.mp4';

      // Mock expired presign request (from previous upload attempt)
      (prisma.presignRequest.findUnique as jest.Mock).mockResolvedValue({
        id: 'presign_old',
        userId: 'user_123',
        key,
        contentType: 'video/mp4',
        size: 1024000,
        expiresAt: new Date(Date.now() - 7200000), // Expired 2 hours ago
        createdAt: new Date(Date.now() - 10800000), // Created 3 hours ago
      });

      const response = await request(app)
        .post('/uploads/confirm')
        .send({
          key,
          type: 'video_process',
          meta: {
            originalFilename: 'old.mp4',
            contentType: 'video/mp4',
            size: 1024000,
          },
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('PRESIGN_EXPIRED');
    });

    it('should prevent content type switching attack', async () => {
      const key = 'uploads/user_123/test.mp4';

      // Presign request was for image, but attacker tries to upload video
      (prisma.presignRequest.findUnique as jest.Mock).mockResolvedValue({
        id: 'presign_123',
        userId: 'user_123',
        key,
        contentType: 'image/jpeg',
        size: 1024000,
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
      });

      const response = await request(app)
        .post('/uploads/confirm')
        .send({
          key,
          type: 'video_process',
          meta: {
            originalFilename: 'test.mp4',
            contentType: 'video/mp4', // Trying to switch content type
            size: 1024000,
          },
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('CONTENT_TYPE_MISMATCH');
    });
  });

  describe('Presign Request Cleanup', () => {
    it('should track presign request creation time', async () => {
      const now = new Date();

      (prisma.presignRequest.create as jest.Mock).mockResolvedValue({
        id: 'presign_123',
        userId: 'user_123',
        key: 'uploads/user_123/test.mp4',
        contentType: 'video/mp4',
        size: 1024000,
        expiresAt: new Date(now.getTime() + 3600000),
        createdAt: now,
      });

      await request(app)
        .post('/uploads/presign')
        .send({
          filename: 'test.mp4',
          contentType: 'video/mp4',
          size: 1024000,
        });

      expect(prisma.presignRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expiresAt: expect.any(Date),
        }),
      });
    });
  });
});

