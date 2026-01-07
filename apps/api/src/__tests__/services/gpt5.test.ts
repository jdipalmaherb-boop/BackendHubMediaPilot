import { callGPT, processTemplate, getUserUsageStats, getQuotaStatus, getRateLimitStatus } from '../../services/gpt5';
import { prisma } from '../../lib/prisma';

// Mock OpenAI client
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: '{"test": "response"}' } }],
          usage: { total_tokens: 100 },
        }),
      },
    },
  })),
}));

// Mock Redis
jest.mock('ioredis', () => {
  const mockRedis = {
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    get: jest.fn().mockResolvedValue('0'),
    incrby: jest.fn().mockResolvedValue(1),
  };
  return jest.fn(() => mockRedis);
});

// Mock environment
jest.mock('../../env', () => ({
  env: {
    OPENAI_API_KEY: 'test-key',
    GPT_MAX_TOKENS: 4000,
    REDIS_URL: 'redis://localhost:6379',
  },
}));

describe('GPT-5 Service', () => {
  const testUserId = 'test-user-id';
  const mockRedis = {
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    get: jest.fn().mockResolvedValue('0'),
    incrby: jest.fn().mockResolvedValue(1),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Redis mocks
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);
    mockRedis.get.mockResolvedValue('0');
    mockRedis.incrby.mockResolvedValue(1);
  });

  describe('callGPT', () => {
    it('should call GPT API successfully', async () => {
      const request = {
        model: 'gpt-5-thinking-mini' as const,
        prompt: 'Test prompt',
        maxTokens: 1000,
        userId: testUserId,
      };

      const result = await callGPT(request);

      expect(result.content).toBe('{"test": "response"}');
      expect(result.tokensUsed).toBe(100);
      expect(result.model).toBe('gpt-5-thinking-mini');
      expect(result.fallbackUsed).toBe(false);
      expect(result.estimatedCost).toBeGreaterThan(0);
    });

    it('should enforce rate limits', async () => {
      // Mock rate limit exceeded
      mockRedis.incr.mockResolvedValue(11); // Exceeds limit of 10

      const request = {
        model: 'gpt-5-thinking-mini' as const,
        prompt: 'Test prompt',
        userId: testUserId,
      };

      await expect(callGPT(request)).rejects.toThrow('Rate limit exceeded');
    });

    it('should enforce monthly quotas', async () => {
      // Mock quota exceeded
      mockRedis.get.mockResolvedValue('100000'); // Exceeds quota of 100k

      const request = {
        model: 'gpt-5-thinking-mini' as const,
        prompt: 'Test prompt',
        maxTokens: 1000,
        userId: testUserId,
      };

      await expect(callGPT(request)).rejects.toThrow('Monthly quota exceeded');
    });

    it('should use fallback model when quota exceeded', async () => {
      // Mock quota exceeded for gpt-5, but OK for fallback
      mockRedis.get
        .mockResolvedValueOnce('100000') // gpt-5 quota exceeded
        .mockResolvedValueOnce('0'); // gpt-4o-mini quota OK

      const request = {
        model: 'gpt-5-thinking-mini' as const,
        prompt: 'Test prompt',
        maxTokens: 1000,
        userId: testUserId,
      };

      const result = await callGPT(request);

      expect(result.model).toBe('gpt-4o-mini');
      expect(result.fallbackUsed).toBe(true);
    });

    it('should clamp max tokens to environment limit', async () => {
      const request = {
        model: 'gpt-5-thinking-mini' as const,
        prompt: 'Test prompt',
        maxTokens: 10000, // Exceeds env limit of 4000
        userId: testUserId,
      };

      await callGPT(request);

      // Verify that the OpenAI client was called with clamped tokens
      const { OpenAI } = require('openai');
      const mockClient = new OpenAI();
      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 4000, // Should be clamped to env limit
        })
      );
    });

    it('should log usage to database', async () => {
      const request = {
        model: 'gpt-5-thinking-mini' as const,
        prompt: 'Test prompt',
        userId: testUserId,
      };

      await callGPT(request);

      // Verify database log was created
      expect(prisma.gptUsage.create).toHaveBeenCalledWith({
        data: {
          userId: testUserId,
          tokens: 100,
          costUsd: expect.any(Number),
          meta: expect.objectContaining({
            model: 'gpt-5-thinking-mini',
            promptHash: expect.any(String),
            responseLength: expect.any(Number),
          }),
        },
      });
    });
  });

  describe('processTemplate', () => {
    it('should process content ideas template', () => {
      const variables = {
        businessType: 'Restaurant',
        platform: 'Instagram',
        tone: 'Friendly',
        cta: 'Visit us today',
        constraints: 'Budget-friendly',
      };

      const result = processTemplate('contentIdeas', variables);

      expect(result).toContain('Restaurant');
      expect(result).toContain('Instagram');
      expect(result).toContain('Friendly');
      expect(result).toContain('Visit us today');
      expect(result).toContain('Budget-friendly');
    });

    it('should process ad copy template', () => {
      const variables = {
        businessType: 'SaaS',
        audience: 'Small businesses',
        product: 'Project management tool',
        benefits: 'Increased productivity',
      };

      const result = processTemplate('adCopy', variables);

      expect(result).toContain('SaaS');
      expect(result).toContain('Small businesses');
      expect(result).toContain('Project management tool');
      expect(result).toContain('Increased productivity');
    });

    it('should throw error for unknown template', () => {
      expect(() => processTemplate('unknown', {})).toThrow('Unknown template: unknown');
    });
  });

  describe('getUserUsageStats', () => {
    it('should return usage statistics', async () => {
      const mockUsage = [
        { tokens: 100, costUsd: 0.002, createdAt: new Date() },
        { tokens: 200, costUsd: 0.004, createdAt: new Date() },
      ];

      prisma.gptUsage.findMany.mockResolvedValue(mockUsage);

      const stats = await getUserUsageStats(testUserId);

      expect(stats.totalTokens).toBe(300);
      expect(stats.totalCost).toBe(0.006);
      expect(stats.requestCount).toBe(2);
      expect(stats.recentUsage).toHaveLength(2);
    });

    it('should filter by model when specified', async () => {
      await getUserUsageStats(testUserId, 'gpt-5-thinking-mini');

      expect(prisma.gptUsage.findMany).toHaveBeenCalledWith({
        where: {
          userId: testUserId,
          meta: { path: ['model'], equals: 'gpt-5-thinking-mini' },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    });
  });

  describe('getQuotaStatus', () => {
    it('should return quota status', async () => {
      mockRedis.get.mockResolvedValue('50000'); // 50k tokens used

      const status = await getQuotaStatus(testUserId, 'gpt-5-thinking-mini');

      expect(status.used).toBe(50000);
      expect(status.quota).toBe(100000);
      expect(status.remaining).toBe(50000);
      expect(status.percentage).toBe(50);
    });

    it('should handle zero usage', async () => {
      mockRedis.get.mockResolvedValue(null);

      const status = await getQuotaStatus(testUserId, 'gpt-5-thinking-mini');

      expect(status.used).toBe(0);
      expect(status.remaining).toBe(100000);
      expect(status.percentage).toBe(0);
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return rate limit status', async () => {
      mockRedis.get.mockResolvedValue('5'); // 5 requests used

      const status = await getRateLimitStatus(testUserId, 'gpt-5-thinking-mini');

      expect(status.used).toBe(5);
      expect(status.limit).toBe(10);
      expect(status.remaining).toBe(5);
      expect(status.window).toBe(3600);
    });

    it('should handle zero usage', async () => {
      mockRedis.get.mockResolvedValue(null);

      const status = await getRateLimitStatus(testUserId, 'gpt-5-thinking-mini');

      expect(status.used).toBe(0);
      expect(status.remaining).toBe(10);
    });
  });

  describe('Error Handling', () => {
    it('should handle OpenAI API errors', async () => {
      const { OpenAI } = require('openai');
      const mockClient = new OpenAI();
      mockClient.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const request = {
        model: 'gpt-5-thinking-mini' as const,
        prompt: 'Test prompt',
        userId: testUserId,
      };

      await expect(callGPT(request)).rejects.toThrow('GPT API error: API Error');
    });

    it('should try fallback model on API error', async () => {
      const { OpenAI } = require('openai');
      const mockClient = new OpenAI();
      
      // First call fails, second succeeds
      mockClient.chat.completions.create
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Fallback response' } }],
          usage: { total_tokens: 50 },
        });

      const request = {
        model: 'gpt-5-thinking-mini' as const,
        prompt: 'Test prompt',
        userId: testUserId,
      };

      const result = await callGPT(request);

      expect(result.model).toBe('gpt-4o-mini');
      expect(result.content).toBe('Fallback response');
      expect(result.fallbackUsed).toBe(true);
    });
  });

  describe('Cost Calculation', () => {
    it('should calculate correct costs for different models', async () => {
      const models = [
        { model: 'gpt-5-thinking-mini', expectedCost: 0.002 },
        { model: 'gpt-4o-mini', expectedCost: 0.00015 },
        { model: 'gpt-4o', expectedCost: 0.005 },
      ];

      for (const { model, expectedCost } of models) {
        const request = {
          model: model as any,
          prompt: 'Test prompt',
          userId: testUserId,
        };

        const result = await callGPT(request);
        expect(result.estimatedCost).toBe(expectedCost);
      }
    });
  });
});
