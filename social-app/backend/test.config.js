// Test configuration
export default {
  // Test environment variables
  NODE_ENV: 'test',
  PORT: 0,
  
  // Test database (use in-memory or test database)
  DATABASE_URL: 'sqlite:memory:',
  
  // Test API URLs
  API_BASE_URL: 'http://localhost:4000',
  ADS_API_BASE_URL: 'http://localhost:3003',
  SCHEDULER_API_BASE_URL: 'http://localhost:4000',
  GOHIGHLEVEL_API_BASE_URL: 'http://localhost:3004',
  
  // Test CORS
  ALLOWED_ORIGINS: 'http://localhost:3000,http://localhost:3001',
  
  // Test Logging
  LOG_LEVEL: 'error'
};



