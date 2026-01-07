import request from 'supertest';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { prisma } from '../../lib/prisma';
import presignRoutes from '../../routes/uploads/presign';
import authRoutes from '../../routes/auth';
import { authMiddleware } from '../../middleware/auth';

// Create test app
const app = express();
app.use(cors({ credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(authMiddleware);
app.use('/api/uploads', presignRoutes);
app.use('/api/auth', authRoutes);

// Mock S3 client to avoid actual AWS calls in tests
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn()
  })),
  PutObjectCommand: jest.fn()
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://mock-s3-url.com/presigned-url')
}));

describe('Presigned Upload Endpoints', () => {
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

  describe('POST /api/uploads/presign', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/uploads/presign')
        .send({
          filename: 'test.jpg',
          contentType: 'image/jpeg',
          size: 1024
        })
        .expect(401);

      expect(response.body.error).toBe('Authentication required');
      expect(response.body.code).toBe('UNAUTHORIZED');
    });

    it('should generate presigned URL for valid image upload', async () => {
      const response = await request(app)
        .post('/api/uploads/presign')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          filename: 'test-image.jpg',
          contentType: 'image/jpeg',
          size: 1024
        })
        .expect(200);

      expect(response.body.url).toBe('https://mock-s3-url.com/presigned-url');
      expect(response.body.key).toMatch(/^uploads\/[a-f0-9-]+\/\d+-[a-f0-9-]+-test-image\.jpg$/);
      expect(response.body.expiresIn).toBe(3600);
      expect(response.body.contentType).toBe('image/jpeg');
      expect(response.body.size).toBe(1024);
    });

    it('should generate presigned URL for valid video upload', async () => {
      const response = await request(app)
        .post('/api/uploads/presign')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          filename: 'test-video.mp4',
          contentType: 'video/mp4',
          size: 1024 * 1024 // 1MB
        })
        .expect(200);

      expect(response.body.url).toBe('https://mock-s3-url.com/presigned-url');
      expect(response.body.key).toMatch(/^uploads\/[a-f0-9-]+\/\d+-[a-f0-9-]+-test-video\.mp4$/);
      expect(response.body.contentType).toBe('video/mp4');
    });

    it('should reject invalid MIME type', async () => {
      const response = await request(app)
        .post('/api/uploads/presign')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          filename: 'test.txt',
          contentType: 'text/plain',
          size: 1024
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject file extension that does not match MIME type', async () => {
      const response = await request(app)
        .post('/api/uploads/presign')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          filename: 'test.mp4',
          contentType: 'image/jpeg',
          size: 1024
        })
        .expect(400);

      expect(response.body.error).toBe('File extension does not match content type');
      expect(response.body.code).toBe('INVALID_FILE_TYPE');
    });

    it('should reject file that exceeds size limit', async () => {
      const response = await request(app)
        .post('/api/uploads/presign')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          filename: 'large-file.jpg',
          contentType: 'image/jpeg',
          size: 200 * 1024 * 1024 // 200MB
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid filename characters', async () => {
      const response = await request(app)
        .post('/api/uploads/presign')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          filename: 'test<>file.jpg',
          contentType: 'image/jpeg',
          size: 1024
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject empty filename', async () => {
      const response = await request(app)
        .post('/api/uploads/presign')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          filename: '',
          contentType: 'image/jpeg',
          size: 1024
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject negative file size', async () => {
      const response = await request(app)
        .post('/api/uploads/presign')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          filename: 'test.jpg',
          contentType: 'image/jpeg',
          size: -1
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should accept all allowed MIME types', async () => {
      const allowedTypes = [
        { filename: 'test.mp4', contentType: 'video/mp4' },
        { filename: 'test.mov', contentType: 'video/quicktime' },
        { filename: 'test.jpg', contentType: 'image/jpeg' },
        { filename: 'test.jpeg', contentType: 'image/jpeg' },
        { filename: 'test.png', contentType: 'image/png' },
        { filename: 'test.webp', contentType: 'image/webp' },
        { filename: 'test.gif', contentType: 'image/gif' }
      ];

      for (const { filename, contentType } of allowedTypes) {
        const response = await request(app)
          .post('/api/uploads/presign')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            filename,
            contentType,
            size: 1024
          })
          .expect(200);

        expect(response.body.contentType).toBe(contentType);
        expect(response.body.key).toContain(filename);
      }
    });

    it('should sanitize filename in S3 key', async () => {
      const response = await request(app)
        .post('/api/uploads/presign')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          filename: 'test file with spaces & special chars!.jpg',
          contentType: 'image/jpeg',
          size: 1024
        })
        .expect(200);

      expect(response.body.key).toMatch(/test_file_with_spaces___special_chars_\.jpg$/);
    });
  });

  describe('POST /api/uploads/confirm', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/uploads/confirm')
        .send({
          key: 'uploads/test/file.jpg',
          originalFilename: 'test.jpg',
          contentType: 'image/jpeg',
          size: 1024
        })
        .expect(401);

      expect(response.body.error).toBe('Authentication required');
      expect(response.body.code).toBe('UNAUTHORIZED');
    });

    it('should confirm upload and create job entry', async () => {
      const key = `uploads/${userId}/1234567890-uuid-test.jpg`;
      
      const response = await request(app)
        .post('/api/uploads/confirm')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          key,
          originalFilename: 'test.jpg',
          contentType: 'image/jpeg',
          size: 1024
        })
        .expect(200);

      expect(response.body.message).toBe('Upload confirmed successfully');
      expect(response.body.jobId).toBeTruthy();
      expect(response.body.key).toBe(key);

      // Verify job was created
      const job = await prisma.job.findUnique({
        where: { id: response.body.jobId }
      });
      expect(job).toBeTruthy();
      expect(job?.userId).toBe(userId);
      expect(job?.type).toBe('file_upload');
      expect(job?.status).toBe('completed');
      expect(job?.s3Key).toBe(key);
      expect(job?.meta).toMatchObject({
        originalFilename: 'test.jpg',
        contentType: 'image/jpeg',
        size: 1024
      });
    });

    it('should reject confirmation for file not owned by user', async () => {
      const response = await request(app)
        .post('/api/uploads/confirm')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          key: 'uploads/other-user/file.jpg',
          originalFilename: 'test.jpg',
          contentType: 'image/jpeg',
          size: 1024
        })
        .expect(403);

      expect(response.body.error).toBe('Unauthorized access to file');
      expect(response.body.code).toBe('UNAUTHORIZED_FILE_ACCESS');
    });

    it('should reject confirmation with invalid data', async () => {
      const response = await request(app)
        .post('/api/uploads/confirm')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          key: '',
          originalFilename: 'test.jpg',
          contentType: 'image/jpeg',
          size: 1024
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Complete Upload Flow', () => {
    it('should complete full upload flow: presign -> confirm', async () => {
      // 1. Get presigned URL
      const presignResponse = await request(app)
        .post('/api/uploads/presign')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          filename: 'flow-test.jpg',
          contentType: 'image/jpeg',
          size: 2048
        })
        .expect(200);

      const { key, url } = presignResponse.body;
      expect(url).toBeTruthy();
      expect(key).toMatch(/^uploads\/[a-f0-9-]+\/\d+-[a-f0-9-]+-flow-test\.jpg$/);

      // 2. Confirm upload
      const confirmResponse = await request(app)
        .post('/api/uploads/confirm')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          key,
          originalFilename: 'flow-test.jpg',
          contentType: 'image/jpeg',
          size: 2048
        })
        .expect(200);

      expect(confirmResponse.body.message).toBe('Upload confirmed successfully');
      expect(confirmResponse.body.jobId).toBeTruthy();

      // 3. Verify job was created with correct data
      const job = await prisma.job.findUnique({
        where: { id: confirmResponse.body.jobId }
      });
      expect(job?.meta).toMatchObject({
        originalFilename: 'flow-test.jpg',
        contentType: 'image/jpeg',
        size: 2048
      });
    });
  });

  describe('Security Tests', () => {
    it('should not allow access to other users files', async () => {
      // Create another user
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

      // Try to confirm file with other user's key
      const response = await request(app)
        .post('/api/uploads/confirm')
        .set('Authorization', `Bearer ${otherAccessToken}`)
        .send({
          key: `uploads/${userId}/1234567890-uuid-test.jpg`,
          originalFilename: 'test.jpg',
          contentType: 'image/jpeg',
          size: 1024
        })
        .expect(403);

      expect(response.body.error).toBe('Unauthorized access to file');
    });

    it('should sanitize malicious filenames', async () => {
      const maliciousFilenames = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32\\config\\sam',
        'file<script>alert("xss")</script>.jpg',
        'file\x00null.jpg',
        'file\x01\x02\x03.jpg'
      ];

      for (const filename of maliciousFilenames) {
        const response = await request(app)
          .post('/api/uploads/presign')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            filename,
            contentType: 'image/jpeg',
            size: 1024
          })
          .expect(200);

        // Check that filename was sanitized
        expect(response.body.key).not.toContain('..');
        expect(response.body.key).not.toContain('<');
        expect(response.body.key).not.toContain('>');
        expect(response.body.key).not.toContain('\x00');
      }
    });
  });
});
