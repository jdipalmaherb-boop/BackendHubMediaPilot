import request from 'supertest';
import express from 'express';
import { boostPostRouter } from '../routes/boostPost.js';
import { schedulerDbService } from '../services/schedulerDbService.js';
import { createAdCampaign, testAdCampaign } from '../services/adsService.js';

// Mock the services
const mockSchedulerDbService = schedulerDbService as jest.Mocked<typeof schedulerDbService>;
const mockCreateAdCampaign = createAdCampaign as jest.MockedFunction<typeof createAdCampaign>;
const mockTestAdCampaign = testAdCampaign as jest.MockedFunction<typeof testAdCampaign>;

const app = express();
app.use(express.json());
app.use('/api/ads', boostPostRouter);

describe('POST /api/ads/boost-post', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should boost a post successfully', async () => {
    const mockPost = {
      id: 'post_123',
      fileUrl: 'https://example.com/image.jpg',
      caption: 'Test post for boosting',
      platforms: ['facebook', 'instagram'],
      status: 'DRAFT',
      orgId: 'org_123',
      userId: 'user_123',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const mockCampaign = {
      id: 'campaign_123',
      name: 'Boost Test Post',
      budget: 100,
      duration: 7,
      platforms: ['facebook', 'instagram'],
      status: 'CREATED',
      content: {
        caption: 'Test post for boosting',
        mediaUrl: 'https://example.com/image.jpg',
        aiScore: 8.5,
        aiTips: ['Great hook!', 'Strong CTA']
      },
      createdAt: new Date().toISOString()
    };

    const mockTestResult = {
      campaignId: 'campaign_123',
      status: 'SUCCESS',
      message: 'Campaign test completed successfully',
      variants: [
        {
          name: 'Variant 1',
          performance: {
            impressions: 1000,
            clicks: 50,
            conversions: 5
          }
        }
      ]
    };

    mockSchedulerDbService.getPostById.mockResolvedValue(mockPost);
    mockCreateAdCampaign.mockResolvedValue(mockCampaign);
    mockTestAdCampaign.mockResolvedValue(mockTestResult);
    mockSchedulerDbService.updatePostStatus.mockResolvedValue(undefined);

    const boostData = {
      postId: 'post_123',
      budget: 100,
      duration: 7,
      platforms: ['facebook', 'instagram']
    };

    const response = await request(app)
      .post('/api/ads/boost-post')
      .send(boostData)
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      campaignId: mockCampaign.id,
      status: mockTestResult.status,
      logs: expect.any(Array)
    });

    expect(mockSchedulerDbService.getPostById).toHaveBeenCalledWith('post_123');
    expect(mockCreateAdCampaign).toHaveBeenCalledWith({
      name: expect.stringContaining('Boost'),
      budget: 100,
      duration: 7,
      platforms: ['facebook', 'instagram'],
      content: {
        caption: 'Test post for boosting',
        mediaUrl: 'https://example.com/image.jpg',
        aiScore: undefined,
        aiTips: undefined
      }
    });
    expect(mockTestAdCampaign).toHaveBeenCalledWith(mockCampaign.id);
    expect(mockSchedulerDbService.updatePostStatus).toHaveBeenCalledWith('post_123', 'SCHEDULED');
  });

  it('should return 400 for invalid input', async () => {
    const invalidData = {
      postId: '',
      budget: -10,
      duration: 0,
      platforms: []
    };

    const response = await request(app)
      .post('/api/ads/boost-post')
      .send(invalidData)
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Validation failed');
    expect(response.body.details).toBeDefined();
  });

  it('should return 404 when post is not found', async () => {
    mockSchedulerDbService.getPostById.mockResolvedValue(null);

    const boostData = {
      postId: 'nonexistent_post',
      budget: 100,
      duration: 7,
      platforms: ['facebook']
    };

    const response = await request(app)
      .post('/api/ads/boost-post')
      .send(boostData)
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Post not found');
  });

  it('should return 500 when ad campaign creation fails', async () => {
    const mockPost = {
      id: 'post_123',
      fileUrl: 'https://example.com/image.jpg',
      caption: 'Test post',
      platforms: ['facebook'],
      status: 'DRAFT',
      orgId: 'org_123',
      userId: 'user_123',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    mockSchedulerDbService.getPostById.mockResolvedValue(mockPost);
    mockCreateAdCampaign.mockRejectedValue(new Error('Meta Ads API error'));

    const boostData = {
      postId: 'post_123',
      budget: 100,
      duration: 7,
      platforms: ['facebook']
    };

    const response = await request(app)
      .post('/api/ads/boost-post')
      .send(boostData)
      .expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Failed to boost post');
  });

  it('should return 500 when campaign testing fails', async () => {
    const mockPost = {
      id: 'post_123',
      fileUrl: 'https://example.com/image.jpg',
      caption: 'Test post',
      platforms: ['facebook'],
      status: 'DRAFT',
      orgId: 'org_123',
      userId: 'user_123',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const mockCampaign = {
      id: 'campaign_123',
      name: 'Boost Test Post',
      budget: 100,
      duration: 7,
      platforms: ['facebook'],
      status: 'CREATED',
      content: {
        caption: 'Test post',
        mediaUrl: 'https://example.com/image.jpg'
      },
      createdAt: new Date().toISOString()
    };

    mockSchedulerDbService.getPostById.mockResolvedValue(mockPost);
    mockCreateAdCampaign.mockResolvedValue(mockCampaign);
    mockTestAdCampaign.mockRejectedValue(new Error('Campaign test failed'));

    const boostData = {
      postId: 'post_123',
      budget: 100,
      duration: 7,
      platforms: ['facebook']
    };

    const response = await request(app)
      .post('/api/ads/boost-post')
      .send(boostData)
      .expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Failed to boost post');
  });
});



