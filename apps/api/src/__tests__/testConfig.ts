// Test configuration for Jest
export const testConfig = {
  // Database
  DATABASE_URL: 'file:./test.db',
  
  // Redis
  REDIS_URL: 'redis://localhost:6379',
  
  // JWT
  JWT_SECRET: 'test-jwt-secret-key-for-testing-only',
  JWT_REFRESH_SECRET: 'test-refresh-secret-key-for-testing-only',
  
  // API Keys (fake for testing)
  OPENAI_API_KEY: 'sk-test-fake-key-for-testing',
  STRIPE_SECRET_KEY: 'sk_test_fake_key_for_testing',
  STRIPE_WEBHOOK_SECRET: 'whsec_fake_secret_for_testing',
  GOHIGHLEVEL_API_KEY: 'test-fake-key-for-testing',
  
  // AWS (fake credentials)
  AWS_ACCESS_KEY_ID: 'test-access-key',
  AWS_SECRET_ACCESS_KEY: 'test-secret-key',
  AWS_REGION: 'us-east-1',
  S3_BUCKET_NAME: 'test-bucket',
  
  // Encryption
  CREDENTIALS_ENCRYPTION_KEY: 'test-encryption-key-32-chars-long',
  
  // Limits
  GPT_MAX_TOKENS: 1000,
  MAX_FILE_SIZE: 100000000,
  MAX_REQUEST_SIZE: 1000000,
  
  // Logging
  LOG_LEVEL: 'error',
  SENTRY_DSN: '',
  
  // Workers
  VIDEO_WORKER_CONCURRENCY: 1,
  SCHEDULER_WORKER_CONCURRENCY: 1,
  GOHIGHLEVEL_WORKER_CONCURRENCY: 1,
  REPORTS_WORKER_CONCURRENCY: 1,
  
  // Performance
  SLOW_REQUEST_THRESHOLD: 5000,
};

// Set environment variables for tests
Object.entries(testConfig).forEach(([key, value]) => {
  process.env[key] = String(value);
});
