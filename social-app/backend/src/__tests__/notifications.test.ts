import request from 'supertest';
import express from 'express';
import { notificationRouter } from '../routes/notifications.js';
import { schedulerDbService } from '../services/schedulerDbService.js';

// Mock the schedulerDbService
const mockSchedulerDbService = schedulerDbService as jest.Mocked<typeof schedulerDbService>;

const app = express();
app.use(express.json());
app.use('/api/notifications', notificationRouter);

describe('POST /api/notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a notification successfully', async () => {
    const mockNotification = {
      id: 'notif_123',
      orgId: 'org_123',
      type: 'post_published',
      message: 'Your post has been published successfully',
      timestamp: new Date().toISOString(),
      read: false,
      metadata: {
        postId: 'post_123',
        platforms: ['facebook', 'instagram']
      }
    };

    mockSchedulerDbService.createNotification.mockResolvedValue(mockNotification);

    const notificationData = {
      orgId: 'org_123',
      type: 'post_published',
      message: 'Your post has been published successfully',
      metadata: {
        postId: 'post_123',
        platforms: ['facebook', 'instagram']
      }
    };

    const response = await request(app)
      .post('/api/notifications')
      .send(notificationData)
      .expect(201);

    expect(response.body).toEqual({
      success: true,
      notification: mockNotification,
      message: 'Notification created successfully'
    });

    expect(mockSchedulerDbService.createNotification).toHaveBeenCalledWith({
      orgId: notificationData.orgId,
      type: notificationData.type,
      message: notificationData.message,
      metadata: notificationData.metadata
    });
  });

  it('should create a notification without metadata', async () => {
    const mockNotification = {
      id: 'notif_456',
      orgId: 'org_123',
      type: 'info',
      message: 'General information notification',
      timestamp: new Date().toISOString(),
      read: false,
      metadata: {}
    };

    mockSchedulerDbService.createNotification.mockResolvedValue(mockNotification);

    const notificationData = {
      orgId: 'org_123',
      type: 'info',
      message: 'General information notification'
    };

    const response = await request(app)
      .post('/api/notifications')
      .send(notificationData)
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(mockSchedulerDbService.createNotification).toHaveBeenCalledWith({
      orgId: notificationData.orgId,
      type: notificationData.type,
      message: notificationData.message,
      metadata: {}
    });
  });

  it('should return 400 for invalid input', async () => {
    const invalidData = {
      orgId: '',
      type: '',
      message: ''
    };

    const response = await request(app)
      .post('/api/notifications')
      .send(invalidData)
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Validation failed');
    expect(response.body.details).toBeDefined();
  });

  it('should return 500 when database creation fails', async () => {
    mockSchedulerDbService.createNotification.mockRejectedValue(new Error('Database error'));

    const notificationData = {
      orgId: 'org_123',
      type: 'post_published',
      message: 'Test notification'
    };

    const response = await request(app)
      .post('/api/notifications')
      .send(notificationData)
      .expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Failed to create notification');
  });
});

describe('GET /api/notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch notifications by organization ID', async () => {
    const mockNotifications = [
      {
        id: 'notif_123',
        orgId: 'org_123',
        type: 'post_published',
        message: 'Your post has been published',
        timestamp: new Date().toISOString(),
        read: false,
        metadata: { postId: 'post_123' }
      },
      {
        id: 'notif_456',
        orgId: 'org_123',
        type: 'lead_captured',
        message: 'New lead captured',
        timestamp: new Date().toISOString(),
        read: true,
        metadata: { leadId: 'lead_123' }
      }
    ];

    const mockResult = {
      notifications: mockNotifications,
      unreadCount: 1
    };

    mockSchedulerDbService.getNotifications.mockResolvedValue(mockResult);

    const response = await request(app)
      .get('/api/notifications')
      .query({ orgId: 'org_123' })
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      notifications: mockNotifications,
      unreadCount: 1,
      message: 'Notifications retrieved successfully'
    });

    expect(mockSchedulerDbService.getNotifications).toHaveBeenCalledWith('org_123', 50);
  });

  it('should fetch notifications with custom limit', async () => {
    const mockNotifications = [
      {
        id: 'notif_123',
        orgId: 'org_123',
        type: 'post_published',
        message: 'Your post has been published',
        timestamp: new Date().toISOString(),
        read: false,
        metadata: {}
      }
    ];

    const mockResult = {
      notifications: mockNotifications,
      unreadCount: 1
    };

    mockSchedulerDbService.getNotifications.mockResolvedValue(mockResult);

    const response = await request(app)
      .get('/api/notifications')
      .query({ orgId: 'org_123', limit: '10' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(mockSchedulerDbService.getNotifications).toHaveBeenCalledWith('org_123', 10);
  });

  it('should return 400 when orgId is missing', async () => {
    const response = await request(app)
      .get('/api/notifications')
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Organization ID is required');
  });

  it('should return 500 when database fetch fails', async () => {
    mockSchedulerDbService.getNotifications.mockRejectedValue(new Error('Database error'));

    const response = await request(app)
      .get('/api/notifications')
      .query({ orgId: 'org_123' })
      .expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Failed to fetch notifications');
  });
});

describe('POST /api/notifications/mark-read', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should mark notifications as read successfully', async () => {
    const notificationIds = ['notif_123', 'notif_456', 'notif_789'];
    const updatedCount = 3;

    mockSchedulerDbService.markNotificationsAsRead.mockResolvedValue(updatedCount);

    const response = await request(app)
      .post('/api/notifications/mark-read')
      .send({ notificationIds })
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      updatedCount,
      message: `${updatedCount} notifications marked as read`
    });

    expect(mockSchedulerDbService.markNotificationsAsRead).toHaveBeenCalledWith(notificationIds);
  });

  it('should handle empty notification IDs array', async () => {
    const notificationIds: string[] = [];

    mockSchedulerDbService.markNotificationsAsRead.mockResolvedValue(0);

    const response = await request(app)
      .post('/api/notifications/mark-read')
      .send({ notificationIds })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.updatedCount).toBe(0);
  });

  it('should return 400 for invalid input', async () => {
    const invalidData = {
      notificationIds: 'not-an-array'
    };

    const response = await request(app)
      .post('/api/notifications/mark-read')
      .send(invalidData)
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Validation failed');
    expect(response.body.details).toBeDefined();
  });

  it('should return 400 for empty notification IDs', async () => {
    const response = await request(app)
      .post('/api/notifications/mark-read')
      .send({ notificationIds: [] })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Notification IDs array is required');
  });

  it('should return 500 when database update fails', async () => {
    const notificationIds = ['notif_123'];

    mockSchedulerDbService.markNotificationsAsRead.mockRejectedValue(new Error('Database error'));

    const response = await request(app)
      .post('/api/notifications/mark-read')
      .send({ notificationIds })
      .expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Failed to mark notifications as read');
  });
});

describe('POST /api/notifications/test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a test notification successfully', async () => {
    const mockNotification = {
      id: 'notif_test_123',
      orgId: 'org_123',
      type: 'info',
      message: 'Test notification',
      timestamp: new Date().toISOString(),
      read: false,
      metadata: { test: true }
    };

    mockSchedulerDbService.createNotification.mockResolvedValue(mockNotification);

    const testData = {
      orgId: 'org_123',
      type: 'info',
      message: 'Test notification',
      metadata: { test: true }
    };

    const response = await request(app)
      .post('/api/notifications/test')
      .send(testData)
      .expect(201);

    expect(response.body).toEqual({
      success: true,
      notification: mockNotification
    });

    expect(mockSchedulerDbService.createNotification).toHaveBeenCalledWith({
      orgId: testData.orgId,
      type: testData.type,
      message: testData.message,
      metadata: testData.metadata
    });
  });

  it('should return 400 for missing required fields', async () => {
    const response = await request(app)
      .post('/api/notifications/test')
      .send({})
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('orgId, type, and message are required');
  });

  it('should return 500 when test notification creation fails', async () => {
    mockSchedulerDbService.createNotification.mockRejectedValue(new Error('Database error'));

    const testData = {
      orgId: 'org_123',
      type: 'info',
      message: 'Test notification'
    };

    const response = await request(app)
      .post('/api/notifications/test')
      .send(testData)
      .expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Failed to create test notification');
  });
});



