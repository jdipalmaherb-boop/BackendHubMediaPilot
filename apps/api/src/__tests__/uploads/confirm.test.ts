import request from 'supertest';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { prisma } from '../../lib/prisma';
import confirmRoutes from '../../routes/uploads/confirm';
import presignRoutes from '../../routes/uploads/presign';
import authRoutes from '../../routes/auth';
import { authMiddleware } from '../../middleware/auth';
import { videoQueue, clearVideoQueue } from '../../queues/videoQueue';

// Create test app
const app = express();
app.use(cors({ credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(authMiddleware);
app.use('/api/uploads', confirmRoutes);
app.use('/api/uploads', presignRoutes);
app.use('/api/auth', authRoutes);

// Mock the video queue to avoid actual Redis operations in tests
jest.mock('../../queues/videoQueue', () => ({
  addVideoJob: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
  videoQueue: {
    add: jest.fn().mockResolvedValue({ id: 'mock-queue-job-id' })
  },
  clearVideoQueue: jest.fn().mockResolvedValue(undefined),
  VIDEO_JOB_TYPES: {
    VIDEO_PROCESS: 'video_process',
    ASSET_INGEST: 'asset_ingest'
  }
}));

describe('Upload Confirmation with Job Creation', () => {
  const testUser = {
    email: 'test@example.com',
    password: 'password123',
    name: 'Test User'
  };

  let accessToken: string;
  let userId: string;

  beforeAll(async () => {
    // Register and login to get access token
    await request(app)
      .post('/api/auth/register')
      .send(testUser);

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });

    accessToken = loginResponse.body.accessToken;
    userId = loginResponse.body.user.id;
  });

  beforeEach(async () => {
    // Clear any existing jobs
    await prisma.job.deleteMany({
      where: { userId }
    });
  });

  describe('POST /api/uploads/confirm', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/uploads/confirm')
        .send({
          key: `uploads/${userId}/test-file.jpg`,
          type: 'video_process',
          meta: {
            originalFilename: 'test.jpg',
            contentType: 'image/jpeg',
            size: 1024
          }
        })
        .expect(401);

      expect(response.body.error).toBe('Authentication required');
      expect(response.body.code).toBe('UNAUTHORIZED');
    });

    it('should confirm upload and create video processing job', async () => {
      const key = `uploads/${userId}/1234567890-uuid-test-video.mp4`;
      
      const response = await request(app)
        .post('/api/uploads/confirm')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          key,
          type: 'video_process',
          meta: {
            originalFilename: 'test-video.mp4',
            contentType: 'video/mp4',
            size: 1024 * 1024, // 1MB
            title: 'Test Video',
            description: 'A test video file',
            tags: ['test', 'video']
          }
        })
        .expect(200);

      expect(response.body.message).toBe('Upload confirmed and job queued successfully');
      expect(response.body.jobId).toBeTruthy();
      expect(response.body.jobType).toBe('video_process');
      expect(response.body.status).toBe('queued');
      expect(response.body.key).toBe(key);
      expect(response.body.estimatedProcessingTime).toBe('2-5 minutes');

      // Verify job was created in database
      const job = await prisma.job.findUnique({
        where: { id: response.body.jobId }
      });
      expect(job).toBeTruthy();
      expect(job?.userId).toBe(userId);
      expect(job?.type).toBe('video_process');
      expect(job?.status).toBe('queued');
      expect(job?.s3Key).toBe(key);
      expect(job?.meta).toMatchObject({
        originalFilename: 'test-video.mp4',
        contentType: 'video/mp4',
        size: 1024 * 1024,
        title: 'Test Video',
        description: 'A test video file',
        tags: ['test', 'video'],
        requiresVirusScan: true
      });
    });

    it('should create asset ingest job for non-video files', async () => {
      const key = `uploads/${userId}/1234567890-uuid-test-image.jpg`;
      
      const response = await request(app)
        .post('/api/uploads/confirm')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          key,
          type: 'asset_ingest',
          meta: {
            originalFilename: 'test-image.jpg',
            contentType: 'image/jpeg',
            size: 1024
          }
        })
        .expect(200);

      expect(response.body.jobType).toBe('asset_ingest');

      // Verify job was created with correct type
      const job = await prisma.job.findUnique({
        where: { id: response.body.jobId }
      });
      expect(job?.type).toBe('asset_ingest');
    });

    it('should reject confirmation for file not owned by user', async () => {
      const otherUserId = 'other-user-id';
      const key = `uploads/${otherUserId}/1234567890-uuid-test-file.jpg`;
      
      const response = await request(app)
        .post('/api/uploads/confirm')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          key,
          type: 'video_process',
          meta: {
            originalFilename: 'test.jpg',
            contentType: 'image/jpeg',
            size: 1024
          }
        })
        .expect(403);

      expect(response.body.error).toBe('Unauthorized access to file');
      expect(response.body.code).toBe('UNAUTHORIZED_FILE_ACCESS');
    });

    it('should reject invalid S3 key format', async () => {
      const response = await request(app)
        .post('/api/uploads/confirm')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          key: 'invalid-key-format',
          type: 'video_process',
          meta: {
            originalFilename: 'test.jpg',
            contentType: 'image/jpeg',
            size: 1024
          }
        })
        .expect(400);

      expect(response.body.error).toBe('Invalid S3 key format');
      expect(response.body.code).toBe('INVALID_KEY_FORMAT');
    });

    it('should reject confirmation with invalid data', async () => {
      const response = await request(app)
        .post('/api/uploads/confirm')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          key: `uploads/${userId}/test-file.jpg`,
          type: 'invalid_type',
          meta: {
            originalFilename: '',
            contentType: 'image/jpeg',
            size: 1024
          }
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should handle queue errors gracefully', async () => {
      // Mock queue error
      const { addVideoJob } = require('../../queues/videoQueue');
      addVideoJob.mockRejectedValueOnce(new Error('Queue connection failed'));

      const key = `uploads/${userId}/1234567890-uuid-test-file.mp4`;
      
      const response = await request(app)
        .post('/api/uploads/confirm')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          key,
          type: 'video_process',
          meta: {
            originalFilename: 'test.mp4',
            contentType: 'video/mp4',
            size: 1024
          }
        })
        .expect(500);

      expect(response.body.error).toBe('Failed to queue processing job');
      expect(response.body.code).toBe('QUEUE_ERROR');
      expect(response.body.jobId).toBeTruthy();

      // Verify job was created but marked as failed
      const job = await prisma.job.findUnique({
        where: { id: response.body.jobId }
      });
      expect(job?.status).toBe('failed');
    });
  });

  describe('GET /api/uploads/jobs', () => {
    beforeEach(async () => {
      // Create some test jobs
      await prisma.job.createMany({
        data: [
          {
            userId,
            type: 'video_process',
            status: 'queued',
            s3Key: `uploads/${userId}/video1.mp4`,
            meta: { originalFilename: 'video1.mp4', contentType: 'video/mp4', size: 1024 }
          },
          {
            userId,
            type: 'asset_ingest',
            status: 'completed',
            s3Key: `uploads/${userId}/image1.jpg`,
            meta: { originalFilename: 'image1.jpg', contentType: 'image/jpeg', size: 512 }
          },
          {
            userId,
            type: 'video_process',
            status: 'failed',
            s3Key: `uploads/${userId}/video2.mp4`,
            meta: { originalFilename: 'video2.mp4', contentType: 'video/mp4', size: 2048 }
          }
        ]
      });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/uploads/jobs')
        .expect(401);

      expect(response.body.error).toBe('Authentication required');
      expect(response.body.code).toBe('UNAUTHORIZED');
    });

    it('should return user jobs', async () => {
      const response = await request(app)
        .get('/api/uploads/jobs')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.jobs).toHaveLength(3);
      expect(response.body.pagination.total).toBe(3);
      expect(response.body.jobs[0].userId).toBe(userId);
    });

    it('should filter jobs by status', async () => {
      const response = await request(app)
        .get('/api/uploads/jobs?status=completed')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.jobs).toHaveLength(1);
      expect(response.body.jobs[0].status).toBe('completed');
    });

    it('should filter jobs by type', async () => {
      const response = await request(app)
        .get('/api/uploads/jobs?type=video_process')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.jobs).toHaveLength(2);
      expect(response.body.jobs.every((job: any) => job.type === 'video_process')).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/uploads/jobs?limit=2&offset=1')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.jobs).toHaveLength(2);
      expect(response.body.pagination.limit).toBe(2);
      expect(response.body.pagination.offset).toBe(1);
    });
  });

  describe('GET /api/uploads/jobs/:jobId', () => {
    let jobId: string;

    beforeEach(async () => {
      const job = await prisma.job.create({
        data: {
          userId,
          type: 'video_process',
          status: 'queued',
          s3Key: `uploads/${userId}/test-job.mp4`,
          meta: { originalFilename: 'test-job.mp4', contentType: 'video/mp4', size: 1024 }
        }
      });
      jobId = job.id;
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/uploads/jobs/${jobId}`)
        .expect(401);

      expect(response.body.error).toBe('Authentication required');
      expect(response.body.code).toBe('UNAUTHORIZED');
    });

    it('should return job details', async () => {
      const response = await request(app)
        .get(`/api/uploads/jobs/${jobId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.job.id).toBe(jobId);
      expect(response.body.job.userId).toBe(userId);
      expect(response.body.job.type).toBe('video_process');
    });

    it('should return 404 for non-existent job', async () => {
      const response = await request(app)
        .get('/api/uploads/jobs/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.error).toBe('Job not found');
      expect(response.body.code).toBe('JOB_NOT_FOUND');
    });

    it('should not return jobs from other users', async () => {
      // Create another user and job
      const otherUser = {
        email: 'other@example.com',
        password: 'password123',
        name: 'Other User'
      };

      await request(app)
        .post('/api/auth/register')
        .send(otherUser);

      const otherLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: otherUser.email,
          password: otherUser.password
        });

      const otherAccessToken = otherLoginResponse.body.accessToken;
      const otherUserId = otherLoginResponse.body.user.id;

      const otherJob = await prisma.job.create({
        data: {
          userId: otherUserId,
          type: 'video_process',
          status: 'queued',
          s3Key: `uploads/${otherUserId}/other-job.mp4`,
          meta: { originalFilename: 'other-job.mp4', contentType: 'video/mp4', size: 1024 }
        }
      });

      // Try to access other user's job
      const response = await request(app)
        .get(`/api/uploads/jobs/${otherJob.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.error).toBe('Job not found');
    });
  });

  describe('Complete Upload Flow with Job Creation', () => {
    it('should complete full flow: presign -> upload -> confirm -> job creation', async () => {
      // 1. Get presigned URL
      const presignResponse = await request(app)
        .post('/api/uploads/presign')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          filename: 'complete-flow-test.mp4',
          contentType: 'video/mp4',
          size: 2048
        })
        .expect(200);

      const { key } = presignResponse.body;

      // 2. Confirm upload (simulating client upload completion)
      const confirmResponse = await request(app)
        .post('/api/uploads/confirm')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          key,
          type: 'video_process',
          meta: {
            originalFilename: 'complete-flow-test.mp4',
            contentType: 'video/mp4',
            size: 2048,
            title: 'Complete Flow Test',
            description: 'Testing the complete upload flow'
          }
        })
        .expect(200);

      expect(confirmResponse.body.message).toBe('Upload confirmed and job queued successfully');
      expect(confirmResponse.body.jobId).toBeTruthy();

      // 3. Verify job was created and queued
      const job = await prisma.job.findUnique({
        where: { id: confirmResponse.body.jobId }
      });
      expect(job).toBeTruthy();
      expect(job?.status).toBe('queued');
      expect(job?.type).toBe('video_process');
      expect(job?.s3Key).toBe(key);

      // 4. Check job appears in jobs list
      const jobsResponse = await request(app)
        .get('/api/uploads/jobs')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(jobsResponse.body.jobs).toHaveLength(1);
      expect(jobsResponse.body.jobs[0].id).toBe(confirmResponse.body.jobId);
    });
  });
});
