import request from 'supertest';
import express from 'express';
import { landingRouter } from '../routes/landing.js';
import { schedulerDbService } from '../services/schedulerDbService.js';
import { createLandingPage } from '../services/gohighlevelService.js';

// Mock the services
const mockSchedulerDbService = schedulerDbService as jest.Mocked<typeof schedulerDbService>;
const mockCreateLandingPage = createLandingPage as jest.MockedFunction<typeof createLandingPage>;

const app = express();
app.use(express.json());
app.use('/api/landing', landingRouter);

describe('POST /api/landing/create', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a landing page successfully', async () => {
    const mockGoHighLevelResponse = {
      id: 'ghl_lp_123',
      headline: 'Amazing Product Launch',
      subtext: 'Get early access to our revolutionary product',
      ctaText: 'Get Early Access',
      ctaUrl: 'https://example.com/signup',
      url: 'https://app.gohighlevel.com/landing-page/123',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    const mockStoredLandingPage = {
      id: 'lp_123',
      orgId: 'org_123',
      headline: 'Amazing Product Launch',
      subtext: 'Get early access to our revolutionary product',
      ctaText: 'Get Early Access',
      ctaUrl: 'https://example.com/signup',
      url: 'https://app.gohighlevel.com/landing-page/123',
      slug: 'amazing-product-launch',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    mockCreateLandingPage.mockResolvedValue(mockGoHighLevelResponse);
    mockSchedulerDbService.storeLandingPage.mockResolvedValue(mockStoredLandingPage);

    const landingData = {
      orgId: 'org_123',
      headline: 'Amazing Product Launch',
      subtext: 'Get early access to our revolutionary product',
      ctaText: 'Get Early Access',
      ctaUrl: 'https://example.com/signup'
    };

    const response = await request(app)
      .post('/api/landing/create')
      .send(landingData)
      .expect(201);

    expect(response.body).toEqual({
      success: true,
      landingPageId: mockStoredLandingPage.id,
      slug: mockStoredLandingPage.slug,
      url: mockStoredLandingPage.url,
      status: mockStoredLandingPage.status
    });

    expect(mockCreateLandingPage).toHaveBeenCalledWith({
      orgId: landingData.orgId,
      headline: landingData.headline,
      subtext: landingData.subtext,
      ctaText: landingData.ctaText,
      ctaUrl: landingData.ctaUrl
    });

    expect(mockSchedulerDbService.storeLandingPage).toHaveBeenCalledWith({
      orgId: landingData.orgId,
      goHighLevelId: mockGoHighLevelResponse.id,
      headline: landingData.headline,
      subtext: landingData.subtext,
      ctaText: landingData.ctaText,
      ctaUrl: landingData.ctaUrl,
      url: mockGoHighLevelResponse.url,
      status: mockGoHighLevelResponse.status
    });
  });

  it('should return 400 for invalid input', async () => {
    const invalidData = {
      orgId: '',
      headline: '',
      subtext: '',
      ctaText: '',
      ctaUrl: 'not-a-url'
    };

    const response = await request(app)
      .post('/api/landing/create')
      .send(invalidData)
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Validation failed');
    expect(response.body.details).toBeDefined();
  });

  it('should return 500 when GoHighLevel API fails', async () => {
    mockCreateLandingPage.mockRejectedValue(new Error('GoHighLevel API error'));

    const landingData = {
      orgId: 'org_123',
      headline: 'Test Landing Page',
      subtext: 'Test subtext',
      ctaText: 'Test CTA',
      ctaUrl: 'https://example.com/test'
    };

    const response = await request(app)
      .post('/api/landing/create')
      .send(landingData)
      .expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Failed to create landing page');
  });

  it('should return 500 when database storage fails', async () => {
    const mockGoHighLevelResponse = {
      id: 'ghl_lp_123',
      headline: 'Test Landing Page',
      subtext: 'Test subtext',
      ctaText: 'Test CTA',
      ctaUrl: 'https://example.com/test',
      url: 'https://app.gohighlevel.com/landing-page/123',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    mockCreateLandingPage.mockResolvedValue(mockGoHighLevelResponse);
    mockSchedulerDbService.storeLandingPage.mockRejectedValue(new Error('Database error'));

    const landingData = {
      orgId: 'org_123',
      headline: 'Test Landing Page',
      subtext: 'Test subtext',
      ctaText: 'Test CTA',
      ctaUrl: 'https://example.com/test'
    };

    const response = await request(app)
      .post('/api/landing/create')
      .send(landingData)
      .expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Failed to create landing page');
  });
});

describe('GET /api/landing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch landing pages by organization ID', async () => {
    const mockLandingPages = [
      {
        id: 'lp_123',
        orgId: 'org_123',
        headline: 'Landing Page 1',
        subtext: 'Subtext 1',
        ctaText: 'CTA 1',
        ctaUrl: 'https://example.com/1',
        url: 'https://app.gohighlevel.com/lp/1',
        slug: 'landing-page-1',
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      },
      {
        id: 'lp_456',
        orgId: 'org_123',
        headline: 'Landing Page 2',
        subtext: 'Subtext 2',
        ctaText: 'CTA 2',
        ctaUrl: 'https://example.com/2',
        url: 'https://app.gohighlevel.com/lp/2',
        slug: 'landing-page-2',
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      }
    ];

    mockSchedulerDbService.getLandingPagesByOrgId.mockResolvedValue(mockLandingPages);

    const response = await request(app)
      .get('/api/landing')
      .query({ orgId: 'org_123' })
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      landingPages: mockLandingPages,
      message: 'Landing pages retrieved successfully'
    });

    expect(mockSchedulerDbService.getLandingPagesByOrgId).toHaveBeenCalledWith('org_123');
  });

  it('should return 400 when orgId is missing', async () => {
    const response = await request(app)
      .get('/api/landing')
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Organization ID is required');
  });

  it('should return 500 when database fetch fails', async () => {
    mockSchedulerDbService.getLandingPagesByOrgId.mockRejectedValue(new Error('Database error'));

    const response = await request(app)
      .get('/api/landing')
      .query({ orgId: 'org_123' })
      .expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Failed to fetch landing pages');
  });
});



