import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // Use random available port for tests

// Mock external services
jest.mock('../services/schedulerDbService.js', () => ({
  schedulerDbService: {
    saveDraftPost: jest.fn(),
    getPostsByOrgId: jest.fn(),
    createNotification: jest.fn(),
    getNotifications: jest.fn(),
    markNotificationsAsRead: jest.fn(),
    storeLandingPage: jest.fn(),
    storeLead: jest.fn(),
  }
}));

jest.mock('../services/adsService.js', () => ({
  createAdCampaign: jest.fn(),
  testAdCampaign: jest.fn(),
}));

jest.mock('../services/gohighlevelService.js', () => ({
  createLandingPage: jest.fn(),
  captureLead: jest.fn(),
}));

jest.mock('../services/leadService.js', () => ({
  captureLead: jest.fn(),
}));

// Global test timeout
jest.setTimeout(10000);



