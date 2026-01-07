import request from 'supertest';
import express from 'express';
import confirmRouter from '../../routes/uploads/confirm';
import presignRouter from '../../routes/uploads/presign';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';

// Mock dependencies
jest.mock('../../lib/prisma', () => ({
  prisma: {
    job: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
  },
}));

jest.mock('../../queues/videoQueue', () => ({
  addVideoJob: jest.fn(),
  VIDEO_JOB_TYPES: {
    VIDEO_PROCESS: 'video_process',
    ASSET_INGEST: 'asset_ingest',
  },
}));

jest.mock('../../lib/s3', () => ({
  createS3Client: jest.fn().mockReturnValue({}),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://s3.amazonaws.com/presigned-url'),
}));

// Mock auth middleware
jest.mock('../../middleware/auth', () => ({
  requireAuth: jest.fn((req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  }),
}));

describe('S3 Upload Ownership Validation Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/uploads', confirmRouter);
    app.use('/uploads', presignRouter);
    jest.clearAllMocks();
  });

  describe('Presign Upload - Key Generation', () => {
    it('should generate S3 key with user ID embedded', async () => {
      const mockUser = {
        id: 'user_abc123',
        email: 'test@example.com',
      };

      // Mock authenticated request
      app.use((req: any, res, next) => {
        req.user = mockUser;
        next();
      });

      const response = await request(app)
        .post('/uploads/presign')
        .send({
          filename: 'test-video.mp4',
          contentType: 'video/mp4',
          size: 1024000,
        });

      expect(response.status).toBe(200);
      expect(response.body.key).toMatch(/^uploads\/user_abc123\//);
      expect(response.body.url).toBeDefined();
    });

    it('should include timestamp and UUID in S3 key', async () => {
      const mockUser = {
        id: 'user_abc123',
        email: 'test@example.com',
      };

      app.use((req: any, res, next) => {
        req.user = mockUser;
        next();
      });

      const response = await request(app)
        .post('/uploads/presign')
        .send({
          filename: 'test-video.mp4',
          contentType: 'video/mp4',
          size: 1024000,
        });

      expect(response.status).toBe(200);
      
      // Key format: uploads/{userId}/{timestamp}-{uuid}-{filename}
      const keyPattern = /^uploads\/user_abc123\/\d+-[a-f0-9-]+-.*\.mp4$/;
      expect(response.body.key).toMatch(keyPattern);
    });
  });

  describe('Upload Confirmation - Ownership Validation', () => {
    it('should reject S3 key with spoofed user ID', async () => {
      const mockUser = {
        id: 'user_legitimate',
        email: 'legitimate@example.com',
      };

      app.use((req: any, res, next) => {
        req.user = mockUser;
        next();
      });

      // Attempt to confirm upload with key containing different user ID
      const spoofedKey = 'uploads/user_attacker/12345-uuid-test.mp4';

      const response = await request(app)
        .post('/uploads/confirm')
        .send({
          key: spoofedKey,
          type: 'video_process',
          meta: {
            originalFilename: 'test.mp4',
            contentType: 'video/mp4',
            size: 1024000,
          },
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Unauthorized access');
      expect(response.body.code).toBe('UNAUTHORIZED_FILE_ACCESS');
    });

    it('should accept S3 key with matching user ID', async () => {
      const mockUser = {
        id: 'user_legitimate',
        email: 'legitimate@example.com',
      };

      app.use((req: any, res, next) => {
        req.user = mockUser;
        next();
      });

      const validKey = 'uploads/user_legitimate/12345-uuid-test.mp4';

      (prisma.job.create as jest.Mock).mockResolvedValue({
        id: 'job_123',
        userId: mockUser.id,
        type: 'video_process',
        status: 'queued',
        s3Key: validKey,
      });

      const response = await request(app)
        .post('/uploads/confirm')
        .send({
          key: validKey,
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

    it('should reject S3 key with invalid format', async () => {
      const mockUser = {
        id: 'user_legitimate',
        email: 'legitimate@example.com',
      };

      app.use((req: any, res, next) => {
        req.user = mockUser;
        next();
      });

      // Key without proper format
      const invalidKey = 'random-file-path/test.mp4';

      const response = await request(app)
        .post('/uploads/confirm')
        .send({
          key: invalidKey,
          type: 'video_process',
          meta: {
            originalFilename: 'test.mp4',
            contentType: 'video/mp4',
            size: 1024000,
          },
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid S3 key format');
      expect(response.body.code).toBe('INVALID_KEY_FORMAT');
    });

    it('should extract correct user ID from various S3 key formats', async () => {
      const mockUser = {
        id: 'user-with-dashes-123',
        email: 'test@example.com',
      };

      app.use((req: any, res, next) => {
        req.user = mockUser;
        next();
      });

      const validKey = 'uploads/user-with-dashes-123/12345-uuid-test.mp4';

      (prisma.job.create as jest.Mock).mockResolvedValue({
        id: 'job_123',
        userId: mockUser.id,
        type: 'video_process',
        status: 'queued',
        s3Key: validKey,
      });

      const response = await request(app)
        .post('/uploads/confirm')
        .send({
          key: validKey,
          type: 'video_process',
          meta: {
            originalFilename: 'test.mp4',
            contentType: 'video/mp4',
            size: 1024000,
          },
        });

      expect(response.status).toBe(200);
    });
  });

  describe('Security - Path Traversal Prevention', () => {
    it('should reject S3 key with path traversal attempts', async () => {
      const mockUser = {
        id: 'user_legitimate',
        email: 'legitimate@example.com',
      };

      app.use((req: any, res, next) => {
        req.user = mockUser;
        next();
      });

      // Attempt path traversal
      const maliciousKey = 'uploads/user_legitimate/../user_attacker/file.mp4';

      const response = await request(app)
        .post('/uploads/confirm')
        .send({
          key: maliciousKey,
          type: 'video_process',
          meta: {
            originalFilename: 'test.mp4',
            contentType: 'video/mp4',
            size: 1024000,
          },
        });

      // Should fail because extracted user ID won't match after path traversal
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should sanitize filename to prevent injection', async () => {
      const mockUser = {
        id: 'user_abc123',
        email: 'test@example.com',
      };

      app.use((req: any, res, next) => {
        req.user = mockUser;
        next();
      });

      const response = await request(app)
        .post('/uploads/presign')
        .send({
          filename: '../../../etc/passwd',
          contentType: 'video/mp4',
          size: 1024000,
        });

      if (response.status === 200) {
        // Filename should be sanitized (special chars replaced with underscore)
        expect(response.body.key).not.toContain('../');
        expect(response.body.key).toMatch(/uploads\/user_abc123\/\d+-[a-f0-9-]+-[^/]+\.mp4$/);
      } else {
        // Or request should be rejected
        expect(response.status).toBe(400);
      }
    });
  });

  describe('Job Queries - User Isolation', () => {
    it('should only return jobs belonging to authenticated user', async () => {
      const mockUser = {
        id: 'user_legitimate',
        email: 'legitimate@example.com',
      };

      app.use((req: any, res, next) => {
        req.user = mockUser;
        next();
      });

      const mockJobs = [
        {
          id: 'job_1',
          userId: 'user_legitimate',
          type: 'video_process',
          status: 'queued',
          s3Key: 'uploads/user_legitimate/file1.mp4',
        },
        {
          id: 'job_2',
          userId: 'user_legitimate',
          type: 'asset_ingest',
          status: 'completed',
          s3Key: 'uploads/user_legitimate/file2.png',
        },
      ];

      (prisma.job.findMany as jest.Mock).mockResolvedValue(mockJobs);
      (prisma.job.count as jest.Mock).mockResolvedValue(2);

      const response = await request(app).get('/uploads/jobs');

      expect(response.status).toBe(200);
      expect(response.body.jobs).toHaveLength(2);
      
      // Verify all jobs belong to the user
      response.body.jobs.forEach((job: any) => {
        expect(job.userId).toBe(mockUser.id);
      });
    });

    it('should not allow accessing other users jobs by ID', async () => {
      const mockUser = {
        id: 'user_legitimate',
        email: 'legitimate@example.com',
      };

      app.use((req: any, res, next) => {
        req.user = mockUser;
        next();
      });

      // Mock finding no job (because userId doesn't match in query)
      (prisma.job.findFirst as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/uploads/jobs/job_from_other_user');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Job not found');
      expect(response.body.code).toBe('JOB_NOT_FOUND');
    });
  });
});

