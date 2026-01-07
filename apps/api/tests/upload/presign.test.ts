import request from 'supertest';
import express from 'express';
import { testPrisma, testUtils, mockS3 } from '../../__tests__/setup';

// Mock the prisma client
jest.mock('../../lib/prisma', () => ({
  prisma: testPrisma,
}));

// Mock AWS SDK
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(),
  PutObjectCommand: jest.fn(),
}));

// Import routes after mocking
import presignRoutes from '../../routes/uploads/presign';
import confirmRoutes from '../../routes/uploads/confirm';

const app = express();
app.use(express.json());
app.use('/presign', presignRoutes);
app.use('/confirm', confirmRoutes);

describe('Upload Presign Routes', () => {
  let user: any;
  let accessToken: string;

  beforeEach(async () => {
    await testUtils.cleanup();
    
    user = await testUtils.createTestUser({
      email: 'upload@example.com',
    });

    accessToken = testUtils.generateTestToken({
      userId: user.id,
      email: user.email,
    });

    // Mock S3 presigned URL generation
    const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
    getSignedUrl.mockResolvedValue('https://test-bucket.s3.amazonaws.com/test-key?signature=test');
  });

  describe('POST /presign', () => {
    it('should generate presigned URL for valid upload request', async () => {
      const uploadData = {
        filename: 'test-video.mp4',
        contentType: 'video/mp4',
        size: 1024 * 1024, // 1MB
      };

      const response = await request(app)
        .post('/presign')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(uploadData)
        .expect(200);

      expect(response.body).toMatchObject({
        presignedUrl: expect.stringContaining('https://test-bucket.s3.amazonaws.com'),
        key: expect.stringContaining(user.id),
        expiresIn: 3600,
      });

      // Verify the key contains user ID and timestamp
      expect(response.body.key).toContain(user.id);
      expect(response.body.key).toContain('test-video.mp4');
    });

    it('should reject upload without authentication', async () => {
      const uploadData = {
        filename: 'test-video.mp4',
        contentType: 'video/mp4',
        size: 1024 * 1024,
      };

      const response = await request(app)
        .post('/presign')
        .send(uploadData)
        .expect(401);

      expect(response.body.error).toContain('No token provided');
    });

    it('should reject upload with invalid file type', async () => {
      const uploadData = {
        filename: 'test.exe',
        contentType: 'application/x-executable',
        size: 1024 * 1024,
      };

      const response = await request(app)
        .post('/presign')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(uploadData)
        .expect(400);

      expect(response.body.error).toContain('Invalid file type');
    });

    it('should reject upload with file too large', async () => {
      const uploadData = {
        filename: 'huge-video.mp4',
        contentType: 'video/mp4',
        size: 500 * 1024 * 1024, // 500MB
      };

      const response = await request(app)
        .post('/presign')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(uploadData)
        .expect(400);

      expect(response.body.error).toContain('File too large');
    });

    it('should reject upload with missing required fields', async () => {
      const uploadData = {
        filename: 'test-video.mp4',
        // Missing contentType and size
      };

      const response = await request(app)
        .post('/presign')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(uploadData)
        .expect(400);

      expect(response.body.error).toContain('Required fields missing');
    });

    it('should handle S3 service errors gracefully', async () => {
      const uploadData = {
        filename: 'test-video.mp4',
        contentType: 'video/mp4',
        size: 1024 * 1024,
      };

      // Mock S3 error
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      getSignedUrl.mockRejectedValue(new Error('S3 service unavailable'));

      const response = await request(app)
        .post('/presign')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(uploadData)
        .expect(500);

      expect(response.body.error).toContain('Failed to generate presigned URL');
    });

    it('should validate file extensions', async () => {
      const testCases = [
        { filename: 'test.mp4', contentType: 'video/mp4', shouldPass: true },
        { filename: 'test.mov', contentType: 'video/quicktime', shouldPass: true },
        { filename: 'test.avi', contentType: 'video/x-msvideo', shouldPass: true },
        { filename: 'test.jpg', contentType: 'image/jpeg', shouldPass: true },
        { filename: 'test.png', contentType: 'image/png', shouldPass: true },
        { filename: 'test.exe', contentType: 'application/x-executable', shouldPass: false },
        { filename: 'test.bat', contentType: 'application/x-bat', shouldPass: false },
        { filename: 'test.sh', contentType: 'application/x-sh', shouldPass: false },
      ];

      for (const testCase of testCases) {
        const uploadData = {
          filename: testCase.filename,
          contentType: testCase.contentType,
          size: 1024 * 1024,
        };

        const response = await request(app)
          .post('/presign')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(uploadData);

        if (testCase.shouldPass) {
          expect(response.status).toBe(200);
          expect(response.body.presignedUrl).toBeDefined();
        } else {
          expect(response.status).toBe(400);
          expect(response.body.error).toContain('Invalid file type');
        }
      }
    });

    it('should enforce file size limits', async () => {
      const testCases = [
        { size: 1024 * 1024, shouldPass: true }, // 1MB
        { size: 10 * 1024 * 1024, shouldPass: true }, // 10MB
        { size: 100 * 1024 * 1024, shouldPass: true }, // 100MB
        { size: 200 * 1024 * 1024, shouldPass: false }, // 200MB
        { size: 500 * 1024 * 1024, shouldPass: false }, // 500MB
      ];

      for (const testCase of testCases) {
        const uploadData = {
          filename: 'test-video.mp4',
          contentType: 'video/mp4',
          size: testCase.size,
        };

        const response = await request(app)
          .post('/presign')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(uploadData);

        if (testCase.shouldPass) {
          expect(response.status).toBe(200);
        } else {
          expect(response.status).toBe(400);
          expect(response.body.error).toContain('File too large');
        }
      }
    });
  });

  describe('POST /confirm', () => {
    let presignedData: any;

    beforeEach(async () => {
      // First get a presigned URL
      const uploadData = {
        filename: 'test-video.mp4',
        contentType: 'video/mp4',
        size: 1024 * 1024,
      };

      const presignResponse = await request(app)
        .post('/presign')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(uploadData)
        .expect(200);

      presignedData = presignResponse.body;
    });

    it('should confirm upload and create job', async () => {
      const confirmData = {
        key: presignedData.key,
        size: 1024 * 1024,
        contentType: 'video/mp4',
        metadata: {
          originalFilename: 'test-video.mp4',
          duration: 30,
        },
      };

      const response = await request(app)
        .post('/confirm')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(confirmData)
        .expect(201);

      expect(response.body).toMatchObject({
        jobId: expect.any(String),
        status: 'queued',
        message: 'Upload confirmed and job queued',
      });

      // Verify job was created
      const job = await testPrisma.job.findFirst({
        where: { userId: user.id },
      });
      expect(job).toBeTruthy();
      expect(job?.type).toBe('video_process');
      expect(job?.status).toBe('queued');
      expect(job?.metadata).toMatchObject({
        key: presignedData.key,
        size: 1024 * 1024,
        contentType: 'video/mp4',
        originalFilename: 'test-video.mp4',
        duration: 30,
      });
    });

    it('should reject confirmation without authentication', async () => {
      const confirmData = {
        key: presignedData.key,
        size: 1024 * 1024,
        contentType: 'video/mp4',
      };

      const response = await request(app)
        .post('/confirm')
        .send(confirmData)
        .expect(401);

      expect(response.body.error).toContain('No token provided');
    });

    it('should reject confirmation for non-existent key', async () => {
      const confirmData = {
        key: 'non-existent-key',
        size: 1024 * 1024,
        contentType: 'video/mp4',
      };

      const response = await request(app)
        .post('/confirm')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(confirmData)
        .expect(404);

      expect(response.body.error).toContain('Upload not found');
    });

    it('should reject confirmation with invalid ownership', async () => {
      // Create another user
      const otherUser = await testUtils.createTestUser({
        email: 'other@example.com',
      });

      const otherAccessToken = testUtils.generateTestToken({
        userId: otherUser.id,
        email: otherUser.email,
      });

      const confirmData = {
        key: presignedData.key,
        size: 1024 * 1024,
        contentType: 'video/mp4',
      };

      const response = await request(app)
        .post('/confirm')
        .set('Authorization', `Bearer ${otherAccessToken}`)
        .send(confirmData)
        .expect(403);

      expect(response.body.error).toContain('Unauthorized');
    });

    it('should handle job creation errors gracefully', async () => {
      // Mock job creation failure
      jest.spyOn(testPrisma.job, 'create').mockRejectedValue(new Error('Database error'));

      const confirmData = {
        key: presignedData.key,
        size: 1024 * 1024,
        contentType: 'video/mp4',
      };

      const response = await request(app)
        .post('/confirm')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(confirmData)
        .expect(500);

      expect(response.body.error).toContain('Failed to create job');
    });

    it('should validate required confirmation fields', async () => {
      const testCases = [
        { data: {}, error: 'key' },
        { data: { key: presignedData.key }, error: 'size' },
        { data: { key: presignedData.key, size: 1024 }, error: 'contentType' },
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .post('/confirm')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(testCase.data)
          .expect(400);

        expect(response.body.error).toContain(testCase.error);
      }
    });

    it('should handle different job types based on content type', async () => {
      const testCases = [
        { contentType: 'video/mp4', expectedType: 'video_process' },
        { contentType: 'video/quicktime', expectedType: 'video_process' },
        { contentType: 'image/jpeg', expectedType: 'asset_ingest' },
        { contentType: 'image/png', expectedType: 'asset_ingest' },
      ];

      for (const testCase of testCases) {
        // Get new presigned URL for each test
        const uploadData = {
          filename: `test.${testCase.contentType.split('/')[1]}`,
          contentType: testCase.contentType,
          size: 1024 * 1024,
        };

        const presignResponse = await request(app)
          .post('/presign')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(uploadData)
          .expect(200);

        const confirmData = {
          key: presignResponse.body.key,
          size: 1024 * 1024,
          contentType: testCase.contentType,
        };

        const response = await request(app)
          .post('/confirm')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(confirmData)
          .expect(201);

        // Verify job type
        const job = await testPrisma.job.findFirst({
          where: { userId: user.id, type: testCase.expectedType },
        });
        expect(job).toBeTruthy();
        expect(job?.type).toBe(testCase.expectedType);
      }
    });
  });

  describe('Upload Flow Integration', () => {
    it('should complete full upload flow', async () => {
      // Step 1: Get presigned URL
      const uploadData = {
        filename: 'integration-test.mp4',
        contentType: 'video/mp4',
        size: 5 * 1024 * 1024, // 5MB
      };

      const presignResponse = await request(app)
        .post('/presign')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(uploadData)
        .expect(200);

      expect(presignResponse.body.presignedUrl).toBeDefined();
      expect(presignResponse.body.key).toBeDefined();

      // Step 2: Simulate file upload (we can't actually upload to S3 in tests)
      // In real scenario, client would upload to presigned URL

      // Step 3: Confirm upload
      const confirmData = {
        key: presignResponse.body.key,
        size: uploadData.size,
        contentType: uploadData.contentType,
        metadata: {
          originalFilename: uploadData.filename,
          duration: 60,
          resolution: '1920x1080',
        },
      };

      const confirmResponse = await request(app)
        .post('/confirm')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(confirmData)
        .expect(201);

      expect(confirmResponse.body.jobId).toBeDefined();
      expect(confirmResponse.body.status).toBe('queued');

      // Step 4: Verify job was created with correct data
      const job = await testPrisma.job.findFirst({
        where: { userId: user.id },
      });

      expect(job).toBeTruthy();
      expect(job?.type).toBe('video_process');
      expect(job?.status).toBe('queued');
      expect(job?.metadata).toMatchObject({
        key: presignResponse.body.key,
        size: uploadData.size,
        contentType: uploadData.contentType,
        originalFilename: uploadData.filename,
        duration: 60,
        resolution: '1920x1080',
      });
    });
  });
});
