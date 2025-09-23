import request from 'supertest';
import express from 'express';
import { postsRouter } from '../routes/posts.js';
import { schedulerDbService } from '../services/schedulerDbService.js';

// Mock the schedulerDbService
const mockSchedulerDbService = schedulerDbService as jest.Mocked<typeof schedulerDbService>;

const app = express();
app.use(express.json());
app.use('/api/posts', postsRouter);

describe('POST /api/posts/save', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should save a draft post successfully', async () => {
    const mockPost = {
      id: 'post_123',
      fileUrl: 'https://example.com/image.jpg',
      caption: 'Test caption',
      platforms: ['facebook', 'instagram'],
      scheduledDate: null,
      status: 'DRAFT',
      orgId: 'org_123',
      userId: 'user_123',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    mockSchedulerDbService.saveDraftPost.mockResolvedValue(mockPost);

    const postData = {
      fileUrl: 'https://example.com/image.jpg',
      caption: 'Test caption',
      platforms: ['facebook', 'instagram'],
      orgId: 'org_123',
      userId: 'user_123'
    };

    const response = await request(app)
      .post('/api/posts/save')
      .send(postData)
      .expect(201);

    expect(response.body).toEqual({
      success: true,
      post: mockPost,
      message: 'Draft post saved successfully'
    });

    expect(mockSchedulerDbService.saveDraftPost).toHaveBeenCalledWith({
      fileUrl: postData.fileUrl,
      caption: postData.caption,
      platforms: postData.platforms,
      scheduledDate: null,
      orgId: postData.orgId,
      userId: postData.userId,
      status: 'DRAFT'
    });
  });

  it('should save a scheduled post successfully', async () => {
    const scheduledDate = new Date('2024-12-31T10:00:00Z');
    const mockPost = {
      id: 'post_456',
      fileUrl: 'https://example.com/video.mp4',
      caption: 'Scheduled post',
      platforms: ['twitter'],
      scheduledDate: scheduledDate.toISOString(),
      status: 'DRAFT',
      orgId: 'org_123',
      userId: 'user_123',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    mockSchedulerDbService.saveDraftPost.mockResolvedValue(mockPost);

    const postData = {
      fileUrl: 'https://example.com/video.mp4',
      caption: 'Scheduled post',
      platforms: ['twitter'],
      scheduledDate: scheduledDate.toISOString(),
      orgId: 'org_123',
      userId: 'user_123'
    };

    const response = await request(app)
      .post('/api/posts/save')
      .send(postData)
      .expect(201);

    expect(response.body).toEqual({
      success: true,
      post: mockPost,
      message: 'Draft post saved successfully'
    });

    expect(mockSchedulerDbService.saveDraftPost).toHaveBeenCalledWith({
      fileUrl: postData.fileUrl,
      caption: postData.caption,
      platforms: postData.platforms,
      scheduledDate: scheduledDate,
      orgId: postData.orgId,
      userId: postData.userId,
      status: 'DRAFT'
    });
  });

  it('should return 400 for invalid input', async () => {
    const invalidData = {
      fileUrl: 'not-a-url',
      caption: '',
      platforms: [],
      orgId: '',
      userId: ''
    };

    const response = await request(app)
      .post('/api/posts/save')
      .send(invalidData)
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Validation failed');
    expect(response.body.details).toBeDefined();
  });

  it('should return 500 when database save fails', async () => {
    mockSchedulerDbService.saveDraftPost.mockRejectedValue(new Error('Database error'));

    const postData = {
      fileUrl: 'https://example.com/image.jpg',
      caption: 'Test caption',
      platforms: ['facebook'],
      orgId: 'org_123',
      userId: 'user_123'
    };

    const response = await request(app)
      .post('/api/posts/save')
      .send(postData)
      .expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Failed to save draft post');
  });
});

describe('GET /api/posts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch posts by organization ID', async () => {
    const mockPosts = [
      {
        id: 'post_123',
        fileUrl: 'https://example.com/image.jpg',
        caption: 'Test post 1',
        platforms: ['facebook'],
        status: 'DRAFT',
        orgId: 'org_123',
        userId: 'user_123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'post_456',
        fileUrl: 'https://example.com/video.mp4',
        caption: 'Test post 2',
        platforms: ['instagram'],
        status: 'SCHEDULED',
        orgId: 'org_123',
        userId: 'user_123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    mockSchedulerDbService.getPostsByOrgId.mockResolvedValue(mockPosts);

    const response = await request(app)
      .get('/api/posts')
      .query({ orgId: 'org_123' })
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      posts: mockPosts,
      message: 'Posts retrieved successfully'
    });

    expect(mockSchedulerDbService.getPostsByOrgId).toHaveBeenCalledWith('org_123');
  });

  it('should return 400 when orgId is missing', async () => {
    const response = await request(app)
      .get('/api/posts')
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Organization ID is required');
  });

  it('should return 500 when database fetch fails', async () => {
    mockSchedulerDbService.getPostsByOrgId.mockRejectedValue(new Error('Database error'));

    const response = await request(app)
      .get('/api/posts')
      .query({ orgId: 'org_123' })
      .expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Failed to fetch posts');
  });
});



