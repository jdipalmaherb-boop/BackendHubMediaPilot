# 🧪 Testing Guide

This document describes the testing setup and guidelines for the Social App backend service.

## 📋 Test Structure

### Test Files
- `src/__tests__/setup.ts` - Test setup and global mocks
- `src/__tests__/posts.test.ts` - Posts API endpoint tests
- `src/__tests__/boost-post.test.ts` - Boost post API endpoint tests
- `src/__tests__/landing.test.ts` - Landing page API endpoint tests
- `src/__tests__/lead.test.ts` - Lead capture API endpoint tests
- `src/__tests__/notifications.test.ts` - Notifications API endpoint tests

### Configuration Files
- `jest.config.js` - Jest configuration
- `test.config.js` - Test environment configuration
- `test-runner.js` - Custom test runner script

## 🚀 Running Tests

### Basic Test Commands
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests for CI/CD
npm run test:ci
```

### Individual Test Files
```bash
# Run specific test file
npx jest src/__tests__/posts.test.ts

# Run tests matching pattern
npx jest --testNamePattern="should save a draft post"

# Run tests with verbose output
npx jest --verbose
```

## 🏗️ Test Architecture

### Mocking Strategy
- **External Services**: All external API calls are mocked
- **Database**: Database operations are mocked using Jest mocks
- **File System**: File operations are mocked when needed
- **Environment**: Test environment variables are isolated

### Test Categories

#### 1. Unit Tests
- Test individual functions and methods
- Mock all dependencies
- Focus on business logic

#### 2. Integration Tests
- Test API endpoints end-to-end
- Mock external services but test internal flow
- Verify request/response handling

#### 3. Contract Tests
- Test API contracts and schemas
- Verify input validation
- Test error handling

## 📊 Test Coverage

### Coverage Goals
- **Statements**: > 90%
- **Branches**: > 85%
- **Functions**: > 90%
- **Lines**: > 90%

### Coverage Reports
```bash
# Generate coverage report
npm run test:coverage

# View coverage in browser
open coverage/lcov-report/index.html
```

## 🧪 Test Examples

### API Endpoint Test
```typescript
describe('POST /api/posts/save', () => {
  it('should save a draft post successfully', async () => {
    const mockPost = { id: 'post_123', ... };
    mockSchedulerDbService.saveDraftPost.mockResolvedValue(mockPost);

    const response = await request(app)
      .post('/api/posts/save')
      .send(postData)
      .expect(201);

    expect(response.body).toEqual({
      success: true,
      post: mockPost,
      message: 'Draft post saved successfully'
    });
  });
});
```

### Error Handling Test
```typescript
it('should return 400 for invalid input', async () => {
  const invalidData = { fileUrl: 'not-a-url' };

  const response = await request(app)
    .post('/api/posts/save')
    .send(invalidData)
    .expect(400);

  expect(response.body.success).toBe(false);
  expect(response.body.error).toBe('Validation failed');
});
```

### Mock Verification Test
```typescript
it('should call external service with correct parameters', async () => {
  mockCreateAdCampaign.mockResolvedValue(mockCampaign);

  await request(app)
    .post('/api/ads/boost-post')
    .send(boostData)
    .expect(200);

  expect(mockCreateAdCampaign).toHaveBeenCalledWith({
    name: expect.stringContaining('Boost'),
    budget: 100,
    platforms: ['facebook']
  });
});
```

## 🔧 Test Configuration

### Jest Configuration
```javascript
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapping: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true }],
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 10000
};
```

### Test Setup
```typescript
// Global mocks
jest.mock('../services/schedulerDbService.js', () => ({
  schedulerDbService: {
    saveDraftPost: jest.fn(),
    getPostsByOrgId: jest.fn(),
    // ... other methods
  }
}));

// Test environment
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
```

## 📝 Test Guidelines

### Writing Tests

#### 1. Test Structure
```typescript
describe('Feature Name', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Happy Path', () => {
    it('should handle valid input', async () => {
      // Arrange
      const input = { valid: 'data' };
      const expected = { success: true };

      // Act
      const result = await functionUnderTest(input);

      // Assert
      expect(result).toEqual(expected);
    });
  });

  describe('Error Cases', () => {
    it('should handle invalid input', async () => {
      // Test error scenarios
    });
  });
});
```

#### 2. Naming Conventions
- Test files: `*.test.ts`
- Test descriptions: `should [expected behavior]`
- Mock variables: `mock[ServiceName]`

#### 3. Assertions
- Use specific matchers: `toBe()`, `toEqual()`, `toHaveBeenCalledWith()`
- Test both success and error cases
- Verify mock calls and parameters

### Mocking Best Practices

#### 1. Service Mocks
```typescript
const mockService = {
  method: jest.fn().mockResolvedValue(mockData),
  errorMethod: jest.fn().mockRejectedValue(new Error('Test error'))
};
```

#### 2. Reset Mocks
```typescript
beforeEach(() => {
  jest.clearAllMocks();
});
```

#### 3. Mock Verification
```typescript
expect(mockService.method).toHaveBeenCalledWith(expectedParams);
expect(mockService.method).toHaveBeenCalledTimes(1);
```

## 🐛 Debugging Tests

### Debug Mode
```bash
# Run tests in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand

# Run specific test in debug mode
npx jest --testNamePattern="should save a draft post" --verbose
```

### Common Issues

#### 1. Mock Not Working
- Check mock path matches import path
- Ensure mock is defined before import
- Verify mock is not being overridden

#### 2. Async Test Issues
- Use `async/await` or return promises
- Check test timeout settings
- Verify mock resolves/rejects correctly

#### 3. Environment Issues
- Check test environment variables
- Verify database connections are mocked
- Ensure external services are mocked

## 📈 Continuous Integration

### CI Test Script
```bash
#!/bin/bash
# ci-test.sh

echo "🧪 Running tests..."

# Install dependencies
npm ci

# Run linting
npm run lint

# Run tests with coverage
npm run test:ci

# Check coverage thresholds
if [ $? -eq 0 ]; then
  echo "✅ All tests passed!"
  exit 0
else
  echo "❌ Tests failed!"
  exit 1
fi
```

### GitHub Actions
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run lint
      - run: npm run test:ci
```

## 🎯 Test Data

### Mock Data Examples
```typescript
const mockPost = {
  id: 'post_123',
  fileUrl: 'https://example.com/image.jpg',
  caption: 'Test caption',
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
  platforms: ['facebook'],
  status: 'CREATED',
  content: {
    caption: 'Test post',
    mediaUrl: 'https://example.com/image.jpg'
  },
  createdAt: new Date().toISOString()
};
```

## 🔍 Test Utilities

### Helper Functions
```typescript
// Test data factory
export const createMockPost = (overrides = {}) => ({
  id: 'post_123',
  fileUrl: 'https://example.com/image.jpg',
  caption: 'Test caption',
  platforms: ['facebook'],
  status: 'DRAFT',
  orgId: 'org_123',
  userId: 'user_123',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

// Test assertion helpers
export const expectSuccessResponse = (response: any) => {
  expect(response.body.success).toBe(true);
  expect(response.body.message).toBeDefined();
};

export const expectErrorResponse = (response: any, status: number) => {
  expect(response.status).toBe(status);
  expect(response.body.success).toBe(false);
  expect(response.body.error).toBeDefined();
};
```

## 📚 Resources

### Documentation
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

### Tools
- [Jest](https://jestjs.io/) - Testing framework
- [Supertest](https://github.com/visionmedia/supertest) - HTTP assertions
- [ts-jest](https://kulshekhar.github.io/ts-jest/) - TypeScript support

---

## 🎉 Quick Start

1. **Install dependencies**: `npm install`
2. **Run tests**: `npm test`
3. **Watch mode**: `npm run test:watch`
4. **Coverage**: `npm run test:coverage`

Happy testing! 🧪✨



