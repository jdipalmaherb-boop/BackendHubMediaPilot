import request from 'supertest';
import express from 'express';
import { leadRouter } from '../routes/lead.js';
import { schedulerDbService } from '../services/schedulerDbService.js';
import { captureLead } from '../services/leadService.js';

// Mock the services
const mockSchedulerDbService = schedulerDbService as jest.Mocked<typeof schedulerDbService>;
const mockCaptureLead = captureLead as jest.MockedFunction<typeof captureLead>;

const app = express();
app.use(express.json());
app.use('/api/lead', leadRouter);

describe('POST /api/lead/capture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should capture a lead successfully', async () => {
    const mockGoHighLevelResponse = {
      id: 'ghl_lead_123',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      status: 'NEW',
      createdAt: new Date().toISOString()
    };

    const mockStoredLead = {
      id: 'lead_123',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      landingPageId: 'lp_123',
      orgId: 'org_123',
      userId: 'user_123',
      goHighLevelId: 'ghl_lead_123',
      source: 'social_post',
      createdAt: new Date().toISOString()
    };

    mockCaptureLead.mockResolvedValue(mockGoHighLevelResponse);
    mockSchedulerDbService.storeLead.mockResolvedValue(mockStoredLead);

    const leadData = {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      landingPageId: 'lp_123',
      orgId: 'org_123',
      userId: 'user_123',
      source: 'social_post'
    };

    const response = await request(app)
      .post('/api/lead/capture')
      .send(leadData)
      .expect(201);

    expect(response.body).toEqual({
      success: true,
      leadId: mockGoHighLevelResponse.id,
      status: mockGoHighLevelResponse.status,
      timestamp: expect.any(String),
      landingPageId: leadData.landingPageId,
      message: 'Lead captured successfully'
    });

    expect(mockCaptureLead).toHaveBeenCalledWith({
      name: leadData.name,
      email: leadData.email,
      phone: leadData.phone,
      landingPageId: leadData.landingPageId,
      source: leadData.source
    });

    expect(mockSchedulerDbService.storeLead).toHaveBeenCalledWith({
      name: leadData.name,
      email: leadData.email,
      phone: leadData.phone,
      landingPageId: leadData.landingPageId,
      orgId: leadData.orgId,
      userId: leadData.userId,
      goHighLevelId: mockGoHighLevelResponse.id,
      source: leadData.source
    });
  });

  it('should capture a lead without phone number', async () => {
    const mockGoHighLevelResponse = {
      id: 'ghl_lead_456',
      name: 'Jane Smith',
      email: 'jane@example.com',
      phone: undefined,
      status: 'NEW',
      createdAt: new Date().toISOString()
    };

    const mockStoredLead = {
      id: 'lead_456',
      name: 'Jane Smith',
      email: 'jane@example.com',
      phone: undefined,
      landingPageId: 'lp_456',
      orgId: 'org_123',
      userId: 'user_123',
      goHighLevelId: 'ghl_lead_456',
      source: 'social_post',
      createdAt: new Date().toISOString()
    };

    mockCaptureLead.mockResolvedValue(mockGoHighLevelResponse);
    mockSchedulerDbService.storeLead.mockResolvedValue(mockStoredLead);

    const leadData = {
      name: 'Jane Smith',
      email: 'jane@example.com',
      landingPageId: 'lp_456',
      orgId: 'org_123',
      userId: 'user_123'
    };

    const response = await request(app)
      .post('/api/lead/capture')
      .send(leadData)
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.leadId).toBe(mockGoHighLevelResponse.id);
    expect(response.body.landingPageId).toBe(leadData.landingPageId);
  });

  it('should return 400 for invalid input', async () => {
    const invalidData = {
      name: '',
      email: 'invalid-email',
      phone: 'invalid-phone',
      landingPageId: '',
      orgId: '',
      userId: ''
    };

    const response = await request(app)
      .post('/api/lead/capture')
      .send(invalidData)
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Validation failed');
    expect(response.body.details).toBeDefined();
  });

  it('should return 500 when GoHighLevel API fails', async () => {
    mockCaptureLead.mockRejectedValue(new Error('GoHighLevel API error'));

    const leadData = {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      landingPageId: 'lp_123',
      orgId: 'org_123',
      userId: 'user_123'
    };

    const response = await request(app)
      .post('/api/lead/capture')
      .send(leadData)
      .expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Failed to capture lead');
  });

  it('should return 500 when database storage fails', async () => {
    const mockGoHighLevelResponse = {
      id: 'ghl_lead_123',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      status: 'NEW',
      createdAt: new Date().toISOString()
    };

    mockCaptureLead.mockResolvedValue(mockGoHighLevelResponse);
    mockSchedulerDbService.storeLead.mockRejectedValue(new Error('Database error'));

    const leadData = {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      landingPageId: 'lp_123',
      orgId: 'org_123',
      userId: 'user_123'
    };

    const response = await request(app)
      .post('/api/lead/capture')
      .send(leadData)
      .expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Failed to capture lead');
  });

  it('should handle missing optional fields gracefully', async () => {
    const mockGoHighLevelResponse = {
      id: 'ghl_lead_789',
      name: 'Bob Wilson',
      email: 'bob@example.com',
      phone: undefined,
      status: 'NEW',
      createdAt: new Date().toISOString()
    };

    const mockStoredLead = {
      id: 'lead_789',
      name: 'Bob Wilson',
      email: 'bob@example.com',
      phone: undefined,
      landingPageId: 'lp_789',
      orgId: 'org_123',
      userId: 'user_123',
      goHighLevelId: 'ghl_lead_789',
      source: 'social_post',
      createdAt: new Date().toISOString()
    };

    mockCaptureLead.mockResolvedValue(mockGoHighLevelResponse);
    mockSchedulerDbService.storeLead.mockResolvedValue(mockStoredLead);

    const leadData = {
      name: 'Bob Wilson',
      email: 'bob@example.com',
      landingPageId: 'lp_789',
      orgId: 'org_123',
      userId: 'user_123'
      // phone and source are optional
    };

    const response = await request(app)
      .post('/api/lead/capture')
      .send(leadData)
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(mockCaptureLead).toHaveBeenCalledWith({
      name: leadData.name,
      email: leadData.email,
      phone: undefined,
      landingPageId: leadData.landingPageId,
      source: 'social_post' // default value
    });
  });
});



