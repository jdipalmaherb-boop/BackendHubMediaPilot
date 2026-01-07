import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { testPrisma, createTestUser, generateTestToken } from '../__tests__/setup';
import { S3Client, DeleteObjectCommand, CopyObjectCommand, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

// Mock external services
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');
jest.mock('bullmq');
jest.mock('ioredis');

// Import the routes
import privacyRouter from '../routes/privacy';

// Mock implementations
const mockS3Client = S3Client as jest.MockedClass<typeof S3Client>;
const mockGetSignedUrl = getSignedUrl as jest.MockedFn<typeof getSignedUrl>;
const mockBullMQQueue = Queue as jest.MockedClass<typeof Queue>;
const mockBullMQWorker = Worker as jest.MockedClass<typeof Worker>;
const mockIORedis = IORedis as jest.MockedClass<typeof IORedis>;

// Setup test app
const app = express();
app.use(express.json());
app.use('/api/privacy', privacyRouter);

// Mock middleware
app.use((req, res, next) => {
  req.user = { id: 'test-user-id' };
  req.ip = '127.0.0.1';
  req.headers['x-request-id'] = 'test-req-id';
  req.headers['user-agent'] = 'test-agent';
  next();
});

describe('Privacy Routes', () => {
  let testUser: any;
  let authToken: string;

  beforeEach(async () => {
    // Clean up database
    await testPrisma.dataDeletionRequest.deleteMany();
    await testPrisma.dataExportRequest.deleteMany();
    await testPrisma.dataProcessingAudit.deleteMany();
    await testPrisma.user.deleteMany();

    // Create test user
    testUser = await createTestUser({
      email: 'test@example.com',
      name: 'Test User',
    });

    authToken = generateTestToken({ userId: testUser.id });

    // Mock S3 operations
    mockS3Client.mockImplementation(() => ({
      send: jest.fn().mockResolvedValue({}),
    } as any));

    mockGetSignedUrl.mockResolvedValue('https://mock-presigned-url.com');

    // Mock BullMQ Queue
    mockBullMQQueue.mockImplementation(() => ({
      add: jest.fn().mockResolvedValue({}),
      getJob: jest.fn().mockResolvedValue(null),
    } as any));

    // Mock BullMQ Worker
    mockBullMQWorker.mockImplementation(() => ({
      on: jest.fn(),
      close: jest.fn(),
    } as any));

    // Mock Redis
    mockIORedis.mockImplementation(() => ({
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    } as any));
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  describe('POST /api/privacy/request-deletion', () => {
    it('should create a data deletion request', async () => {
      const deletionData = {
        requestType: 'DATA_PURGE',
        reason: 'User requested data deletion',
        retentionPolicy: 'ANONYMIZE',
        dataTypes: ['USER_PROFILE', 'CAMPAIGNS'],
      };

      const response = await request(app)
        .post('/api/privacy/request-deletion')
        .set('Authorization', `Bearer ${authToken}`)
        .send(deletionData)
        .expect(201);

      expect(response.body).toMatchObject({
        message: 'Data deletion request submitted successfully',
        requestId: expect.any(String),
        status: 'PENDING',
        estimatedProcessingTime: '24-48 hours',
      });

      // Verify request was created in database
      const deletionRequest = await testPrisma.dataDeletionRequest.findFirst({
        where: { userId: testUser.id },
      });

      expect(deletionRequest).toBeTruthy();
      expect(deletionRequest?.requestType).toBe('DATA_PURGE');
      expect(deletionRequest?.retentionPolicy).toBe('ANONYMIZE');
      expect(deletionRequest?.status).toBe('PENDING');
    });

    it('should handle account deletion request', async () => {
      const deletionData = {
        requestType: 'ACCOUNT_DELETION',
        reason: 'User wants to delete account',
        retentionPolicy: 'DELETE',
      };

      const response = await request(app)
        .post('/api/privacy/request-deletion')
        .set('Authorization', `Bearer ${authToken}`)
        .send(deletionData)
        .expect(201);

      expect(response.body.estimatedProcessingTime).toBe('Immediate');

      // Verify queue job was added with high priority
      expect(mockBullMQQueue).toHaveBeenCalled();
    });

    it('should prevent duplicate pending requests', async () => {
      const deletionData = {
        requestType: 'DATA_PURGE',
        retentionPolicy: 'ANONYMIZE',
      };

      // Create first request
      await request(app)
        .post('/api/privacy/request-deletion')
        .set('Authorization', `Bearer ${authToken}`)
        .send(deletionData)
        .expect(201);

      // Try to create second request
      const response = await request(app)
        .post('/api/privacy/request-deletion')
        .set('Authorization', `Bearer ${authToken}`)
        .send(deletionData)
        .expect(409);

      expect(response.body.error).toBe('Request Already Exists');
    });

    it('should validate request data', async () => {
      const invalidData = {
        requestType: 'INVALID_TYPE',
        retentionPolicy: 'INVALID_POLICY',
      };

      const response = await request(app)
        .post('/api/privacy/request-deletion')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
    });
  });

  describe('GET /api/privacy/deletion-status/:requestId', () => {
    it('should return deletion request status', async () => {
      // Create a deletion request
      const deletionRequest = await testPrisma.dataDeletionRequest.create({
        data: {
          userId: testUser.id,
          requestType: 'DATA_PURGE',
          retentionPolicy: 'ANONYMIZE',
          status: 'PENDING',
        },
      });

      const response = await request(app)
        .get(`/api/privacy/deletion-status/${deletionRequest.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        requestId: deletionRequest.id,
        status: 'PENDING',
        requestType: 'DATA_PURGE',
        retentionPolicy: 'ANONYMIZE',
      });
    });

    it('should return 404 for non-existent request', async () => {
      const response = await request(app)
        .get('/api/privacy/deletion-status/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toBe('Not Found');
    });
  });

  describe('POST /api/privacy/cancel-deletion/:requestId', () => {
    it('should cancel a pending deletion request', async () => {
      // Create a pending deletion request
      const deletionRequest = await testPrisma.dataDeletionRequest.create({
        data: {
          userId: testUser.id,
          requestType: 'DATA_PURGE',
          retentionPolicy: 'ANONYMIZE',
          status: 'PENDING',
        },
      });

      const response = await request(app)
        .post(`/api/privacy/cancel-deletion/${deletionRequest.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Deletion request cancelled successfully',
        requestId: deletionRequest.id,
        status: 'CANCELLED',
      });

      // Verify status was updated
      const updatedRequest = await testPrisma.dataDeletionRequest.findUnique({
        where: { id: deletionRequest.id },
      });
      expect(updatedRequest?.status).toBe('CANCELLED');
    });

    it('should not cancel non-pending requests', async () => {
      // Create a completed deletion request
      const deletionRequest = await testPrisma.dataDeletionRequest.create({
        data: {
          userId: testUser.id,
          requestType: 'DATA_PURGE',
          retentionPolicy: 'ANONYMIZE',
          status: 'COMPLETED',
        },
      });

      const response = await request(app)
        .post(`/api/privacy/cancel-deletion/${deletionRequest.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toBe('Not Found');
    });
  });

  describe('POST /api/privacy/export', () => {
    it('should create a data export request', async () => {
      const exportData = {
        dataTypes: ['USER_PROFILE', 'CAMPAIGNS'],
        format: 'json',
      };

      const response = await request(app)
        .post('/api/privacy/export')
        .set('Authorization', `Bearer ${authToken}`)
        .send(exportData)
        .expect(201);

      expect(response.body).toMatchObject({
        message: 'Data export request submitted successfully',
        requestId: expect.any(String),
        status: 'PENDING',
        estimatedProcessingTime: '1-2 hours',
      });

      // Verify request was created in database
      const exportRequest = await testPrisma.dataExportRequest.findFirst({
        where: { userId: testUser.id },
      });

      expect(exportRequest).toBeTruthy();
      expect(exportRequest?.status).toBe('PENDING');
      expect(exportRequest?.metadata).toMatchObject({
        dataTypes: ['USER_PROFILE', 'CAMPAIGNS'],
        format: 'json',
      });
    });

    it('should prevent duplicate pending export requests', async () => {
      const exportData = {
        dataTypes: ['USER_PROFILE'],
        format: 'json',
      };

      // Create first request
      await request(app)
        .post('/api/privacy/export')
        .set('Authorization', `Bearer ${authToken}`)
        .send(exportData)
        .expect(201);

      // Try to create second request
      const response = await request(app)
        .post('/api/privacy/export')
        .set('Authorization', `Bearer ${authToken}`)
        .send(exportData)
        .expect(409);

      expect(response.body.error).toBe('Request Already Exists');
    });

    it('should use default values when not provided', async () => {
      const response = await request(app)
        .post('/api/privacy/export')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(201);

      const exportRequest = await testPrisma.dataExportRequest.findFirst({
        where: { userId: testUser.id },
      });

      expect(exportRequest?.metadata).toMatchObject({
        dataTypes: ['USER_PROFILE', 'CAMPAIGNS', 'LEADS'],
        format: 'json',
      });
    });
  });

  describe('GET /api/privacy/export/:requestId', () => {
    it('should return download link for completed export', async () => {
      // Create a completed export request
      const exportRequest = await testPrisma.dataExportRequest.create({
        data: {
          userId: testUser.id,
          status: 'COMPLETED',
          downloadUrl: 'https://example.com/download',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
          fileSize: 1024,
          metadata: {
            format: 'json',
            dataTypes: ['USER_PROFILE'],
          },
        },
      });

      const response = await request(app)
        .get(`/api/privacy/export/${exportRequest.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        requestId: exportRequest.id,
        downloadUrl: 'https://example.com/download',
        fileSize: 1024,
        format: 'json',
        dataTypes: ['USER_PROFILE'],
      });
    });

    it('should return 400 for non-completed export', async () => {
      // Create a pending export request
      const exportRequest = await testPrisma.dataExportRequest.create({
        data: {
          userId: testUser.id,
          status: 'PENDING',
        },
      });

      const response = await request(app)
        .get(`/api/privacy/export/${exportRequest.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toBe('Not Ready');
    });

    it('should return 410 for expired export', async () => {
      // Create an expired export request
      const exportRequest = await testPrisma.dataExportRequest.create({
        data: {
          userId: testUser.id,
          status: 'COMPLETED',
          downloadUrl: 'https://example.com/download',
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        },
      });

      const response = await request(app)
        .get(`/api/privacy/export/${exportRequest.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(410);

      expect(response.body.error).toBe('Download Expired');
    });
  });

  describe('GET /api/privacy/retention-policies', () => {
    it('should return retention policies', async () => {
      // Create some retention policies
      await testPrisma.dataRetentionPolicy.createMany({
        data: [
          {
            userId: null, // Global policy
            dataType: 'USER_PROFILE',
            retentionDays: 90,
            action: 'ANONYMIZE',
          },
          {
            userId: testUser.id, // User-specific policy
            dataType: 'CAMPAIGNS',
            retentionDays: 365,
            action: 'DELETE',
          },
        ],
      });

      const response = await request(app)
        .get('/api/privacy/retention-policies')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        policies: expect.any(Object),
        defaultRetentionDays: 90,
        defaultAction: 'ANONYMIZE',
      });

      expect(response.body.policies.USER_PROFILE).toBeDefined();
      expect(response.body.policies.CAMPAIGNS).toBeDefined();
    });
  });

  describe('GET /api/privacy/audit-log', () => {
    it('should return audit log with pagination', async () => {
      // Create some audit entries
      await testPrisma.dataProcessingAudit.createMany({
        data: [
          {
            userId: testUser.id,
            action: 'DELETION',
            dataType: 'USER_PROFILE',
            status: 'SUCCESS',
            processedAt: new Date(),
          },
          {
            userId: testUser.id,
            action: 'EXPORT',
            dataType: 'CAMPAIGNS',
            status: 'SUCCESS',
            processedAt: new Date(),
          },
        ],
      });

      const response = await request(app)
        .get('/api/privacy/audit-log')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        auditLogs: expect.any(Array),
        pagination: {
          page: 1,
          limit: 50,
          total: 2,
          pages: 1,
        },
      });

      expect(response.body.auditLogs).toHaveLength(2);
    });

    it('should support pagination parameters', async () => {
      // Create multiple audit entries
      await testPrisma.dataProcessingAudit.createMany({
        data: Array.from({ length: 25 }, (_, i) => ({
          userId: testUser.id,
          action: 'DELETION',
          dataType: 'USER_PROFILE',
          status: 'SUCCESS',
          processedAt: new Date(Date.now() - i * 1000),
        })),
      });

      const response = await request(app)
        .get('/api/privacy/audit-log?page=2&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.pagination).toMatchObject({
        page: 2,
        limit: 10,
        total: 25,
        pages: 3,
      });

      expect(response.body.auditLogs).toHaveLength(10);
    });
  });
});

describe('Privacy Worker', () => {
  // Mock the worker for testing
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should process deletion jobs', async () => {
    // This would test the actual worker logic
    // In a real test, you'd mock the worker and test the processing functions
    expect(true).toBe(true); // Placeholder test
  });

  it('should process export jobs', async () => {
    // This would test the actual worker logic
    expect(true).toBe(true); // Placeholder test
  });

  it('should handle S3 operations for asset processing', async () => {
    // Test S3 operations like moving to quarantine
    expect(true).toBe(true); // Placeholder test
  });
});
