import { PrismaClient } from '@prisma/client';
import { jest } from '@jest/globals';
import './testConfig'; // Load test configuration

// Mock external services
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');
jest.mock('openai');
jest.mock('stripe');
jest.mock('bullmq');

// Test database client
export const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'file:./test.db',
    },
  },
});

// Global test utilities
export const testUtils = {
  // Create a test user
  async createTestUser(overrides: any = {}) {
    return await testPrisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: '$2b$10$test.hash.for.testing',
        ...overrides,
      },
    });
  },

  // Create a test campaign
  async createTestCampaign(userId: string, overrides: any = {}) {
    return await testPrisma.campaign.create({
      data: {
        userId,
        businessId: 'test-business',
        name: 'Test Campaign',
        objective: 'traffic',
        budgetTotalCents: 10000,
        platforms: ['meta'],
        audience: { age: '25-35' },
        ...overrides,
      },
    });
  },

  // Create a test job
  async createTestJob(userId: string, overrides: any = {}) {
    return await testPrisma.job.create({
      data: {
        userId,
        type: 'video_process',
        status: 'queued',
        metadata: { filename: 'test.mp4' },
        ...overrides,
      },
    });
  },

  // Clean up test data
  async cleanup() {
    await testPrisma.refreshToken.deleteMany();
    await testPrisma.gptUsage.deleteMany();
    await testPrisma.job.deleteMany();
    await testPrisma.scheduledPost.deleteMany();
    await testPrisma.publishRecord.deleteMany();
    await testPrisma.campaign.deleteMany();
    await testPrisma.lead.deleteMany();
    await testPrisma.goHighLevelSync.deleteMany();
    await testPrisma.subscription.deleteMany();
    await testPrisma.user.deleteMany();
  },

  // Generate test JWT token
  generateTestToken(payload: any = {}) {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      {
        userId: 'test-user-id',
        email: 'test@example.com',
        ...payload,
      },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  },
};

// Mock implementations
export const mockS3 = {
  send: jest.fn(),
  getSignedUrl: jest.fn(),
};

export const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn(),
    },
  },
};

export const mockStripe = {
  webhooks: {
    constructEvent: jest.fn(),
  },
  customers: {
    create: jest.fn(),
    retrieve: jest.fn(),
  },
  subscriptions: {
    create: jest.fn(),
    retrieve: jest.fn(),
    update: jest.fn(),
  },
  invoices: {
    retrieve: jest.fn(),
  },
};

export const mockQueue = {
  add: jest.fn(),
  getJob: jest.fn(),
  getWaiting: jest.fn(),
  getActive: jest.fn(),
  getCompleted: jest.fn(),
  getFailed: jest.fn(),
};

// Setup mocks
beforeEach(() => {
  jest.clearAllMocks();
  
  // Reset S3 mocks
  mockS3.send.mockResolvedValue({});
  mockS3.getSignedUrl.mockResolvedValue('https://test-signed-url.com');
  
  // Reset OpenAI mocks
  mockOpenAI.chat.completions.create.mockResolvedValue({
    choices: [{ message: { content: 'Test response' } }],
    usage: { total_tokens: 100 },
  });
  
  // Reset Stripe mocks
  mockStripe.webhooks.constructEvent.mockReturnValue({});
  mockStripe.customers.create.mockResolvedValue({ id: 'cus_test' });
  mockStripe.subscriptions.create.mockResolvedValue({ id: 'sub_test' });
  
  // Reset Queue mocks
  mockQueue.add.mockResolvedValue({ id: 'job_test' });
  mockQueue.getJob.mockResolvedValue(null);
  mockQueue.getWaiting.mockResolvedValue([]);
  mockQueue.getActive.mockResolvedValue([]);
  mockQueue.getCompleted.mockResolvedValue([]);
  mockQueue.getFailed.mockResolvedValue([]);
});

afterEach(async () => {
  await testUtils.cleanup();
});

afterAll(async () => {
  await testPrisma.$disconnect();
});