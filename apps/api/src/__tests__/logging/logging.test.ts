import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { 
  requestIdMiddleware, 
  requestLoggingMiddleware, 
  errorLoggingMiddleware,
  performanceMiddleware,
  securityLoggingMiddleware,
  loggingMiddleware,
  noLoggingMiddleware 
} from '../middleware/requestId';
import { log, createRequestLogger, PerformanceTimer, logError } from '../lib/logger';

// Mock Pino logger
jest.mock('pino', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    fatal: jest.fn(),
  };
  
  return jest.fn(() => mockLogger);
});

// Mock Sentry
jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
}));

describe('Request ID Middleware', () => {
  let app: express.Application;
  let mockLogger: any;

  beforeEach(() => {
    app = express();
    mockLogger = require('pino')();
    
    // Clear mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('requestIdMiddleware', () => {
    it('should generate and set request ID', async () => {
      app.use(requestIdMiddleware);
      app.get('/test', (req, res) => {
        expect(req.reqId).toBeDefined();
        expect(typeof req.reqId).toBe('string');
        res.json({ reqId: req.reqId });
      });

      const response = await request(app)
        .get('/test');

      expect(response.status).toBe(200);
      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.body.reqId).toBe(response.headers['x-request-id']);
    });

    it('should use existing request ID from header', async () => {
      const existingReqId = 'existing-request-id';
      
      app.use(requestIdMiddleware);
      app.get('/test', (req, res) => {
        expect(req.reqId).toBe(existingReqId);
        res.json({ reqId: req.reqId });
      });

      const response = await request(app)
        .get('/test')
        .set('x-request-id', existingReqId);

      expect(response.status).toBe(200);
      expect(response.headers['x-request-id']).toBe(existingReqId);
      expect(response.body.reqId).toBe(existingReqId);
    });

    it('should set start time', async () => {
      app.use(requestIdMiddleware);
      app.get('/test', (req, res) => {
        expect(req.startTime).toBeDefined();
        expect(typeof req.startTime).toBe('number');
        res.json({ startTime: req.startTime });
      });

      const response = await request(app)
        .get('/test');

      expect(response.status).toBe(200);
      expect(response.body.startTime).toBeDefined();
    });

    it('should log incoming request', async () => {
      app.use(requestIdMiddleware);
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      await request(app)
        .get('/test');

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          reqId: expect.any(String),
          method: 'GET',
          path: '/test',
          type: 'request',
        }),
        'GET /test'
      );
    });
  });

  describe('requestLoggingMiddleware', () => {
    it('should log response after request completion', async () => {
      app.use(requestIdMiddleware);
      app.use(requestLoggingMiddleware);
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      await request(app)
        .get('/test');

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          reqId: expect.any(String),
          method: 'GET',
          path: '/test',
          statusCode: 200,
          duration: expect.any(Number),
          type: 'response',
        }),
        expect.stringContaining('GET /test 200')
      );
    });

    it('should log response with user ID if available', async () => {
      app.use(requestIdMiddleware);
      app.use(requestLoggingMiddleware);
      app.get('/test', (req, res) => {
        req.user = { id: 'user123', email: 'test@example.com' };
        res.json({ success: true });
      });

      await request(app)
        .get('/test');

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user123',
        }),
        expect.any(String)
      );
    });
  });

  describe('errorLoggingMiddleware', () => {
    it('should log errors with request context', async () => {
      app.use(requestIdMiddleware);
      app.use(errorLoggingMiddleware);
      app.get('/test', (req, res, next) => {
        const error = new Error('Test error');
        next(error);
      });

      await request(app)
        .get('/test');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          reqId: expect.any(String),
          method: 'GET',
          path: '/test',
          error: expect.objectContaining({
            name: 'Error',
            message: 'Test error',
            stack: expect.any(String),
          }),
          type: 'error',
        }),
        'Error: Test error'
      );
    });

    it('should include user agent and IP in error logs', async () => {
      app.use(requestIdMiddleware);
      app.use(errorLoggingMiddleware);
      app.get('/test', (req, res, next) => {
        req.ip = '192.168.1.1';
        const error = new Error('Test error');
        next(error);
      });

      await request(app)
        .get('/test')
        .set('user-agent', 'test-agent');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent: 'test-agent',
          ip: '192.168.1.1',
        }),
        expect.any(String)
      );
    });
  });

  describe('performanceMiddleware', () => {
    it('should log slow requests', async () => {
      // Set a very low threshold for testing
      process.env.SLOW_REQUEST_THRESHOLD = '10';
      
      app.use(requestIdMiddleware);
      app.use(performanceMiddleware);
      app.get('/test', (req, res) => {
        // Simulate slow request
        setTimeout(() => {
          res.json({ success: true });
        }, 50);
      });

      await request(app)
        .get('/test');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          reqId: expect.any(String),
          method: 'GET',
          path: '/test',
          duration: expect.any(Number),
          type: 'slow_request',
        }),
        expect.stringContaining('Slow request detected')
      );
    });

    it('should not log fast requests', async () => {
      process.env.SLOW_REQUEST_THRESHOLD = '1000';
      
      app.use(requestIdMiddleware);
      app.use(performanceMiddleware);
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      await request(app)
        .get('/test');

      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'slow_request',
        }),
        expect.any(String)
      );
    });
  });

  describe('securityLoggingMiddleware', () => {
    it('should log suspicious patterns', async () => {
      app.use(requestIdMiddleware);
      app.use(securityLoggingMiddleware);
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      await request(app)
        .get('/test/../../../etc/passwd');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          reqId: expect.any(String),
          event: 'suspicious_request',
          severity: 'medium',
          type: 'security',
        }),
        'Security suspicious_request: medium'
      );
    });

    it('should log authentication attempts', async () => {
      app.use(requestIdMiddleware);
      app.use(securityLoggingMiddleware);
      app.get('/auth/login', (req, res) => {
        res.json({ success: true });
      });

      await request(app)
        .get('/auth/login');

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          reqId: expect.any(String),
          operation: 'authentication_attempt',
          success: true,
          type: 'auth',
        }),
        'Auth authentication_attempt successful'
      );
    });

    it('should log admin access', async () => {
      app.use(requestIdMiddleware);
      app.use(securityLoggingMiddleware);
      app.get('/admin/users', (req, res) => {
        res.json({ success: true });
      });

      await request(app)
        .get('/admin/users');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          reqId: expect.any(String),
          event: 'admin_access',
          severity: 'high',
          path: '/admin/users',
          type: 'security',
        }),
        'Security admin_access: high'
      );
    });
  });

  describe('noLoggingMiddleware', () => {
    it('should set request ID without logging', async () => {
      app.use(noLoggingMiddleware);
      app.get('/test', (req, res) => {
        expect(req.reqId).toBeDefined();
        res.json({ reqId: req.reqId });
      });

      const response = await request(app)
        .get('/test');

      expect(response.status).toBe(200);
      expect(response.headers['x-request-id']).toBeDefined();
      expect(mockLogger.info).not.toHaveBeenCalled();
    });
  });

  describe('loggingMiddleware', () => {
    it('should apply all logging middleware', async () => {
      app.use(loggingMiddleware);
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      await request(app)
        .get('/test');

      // Should have logged request
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'request',
        }),
        expect.any(String)
      );

      // Should have logged response
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'response',
        }),
        expect.any(String)
      );
    });
  });
});

describe('Logger', () => {
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = require('pino')();
    jest.clearAllMocks();
  });

  describe('log methods', () => {
    it('should call appropriate logger methods', () => {
      const context = { reqId: 'test123', userId: 'user456' };

      log.info(context, 'Test info message');
      log.warn(context, 'Test warn message');
      log.error(context, 'Test error message');
      log.debug(context, 'Test debug message');
      log.fatal(context, 'Test fatal message');

      expect(mockLogger.info).toHaveBeenCalledWith(context, 'Test info message');
      expect(mockLogger.warn).toHaveBeenCalledWith(context, 'Test warn message');
      expect(mockLogger.error).toHaveBeenCalledWith(context, 'Test error message');
      expect(mockLogger.debug).toHaveBeenCalledWith(context, 'Test debug message');
      expect(mockLogger.fatal).toHaveBeenCalledWith(context, 'Test fatal message');
    });
  });

  describe('convenience methods', () => {
    it('should log request with correct format', () => {
      log.request('req123', 'GET', '/test', 'user456');

      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          reqId: 'req123',
          method: 'GET',
          path: '/test',
          userId: 'user456',
          type: 'request',
        },
        'GET /test'
      );
    });

    it('should log response with correct format', () => {
      log.response('req123', 'GET', '/test', 200, 150, 'user456');

      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          reqId: 'req123',
          method: 'GET',
          path: '/test',
          statusCode: 200,
          duration: 150,
          userId: 'user456',
          type: 'response',
        },
        'GET /test 200 - 150ms'
      );
    });

    it('should log error with correct format', () => {
      const error = new Error('Test error');
      log.error('req123', error, { userId: 'user456' });

      expect(mockLogger.error).toHaveBeenCalledWith(
        {
          reqId: 'req123',
          error: {
            name: 'Error',
            message: 'Test error',
            stack: expect.any(String),
          },
          userId: 'user456',
          type: 'error',
        },
        'Error: Test error'
      );
    });

    it('should log database operations', () => {
      log.database('req123', 'SELECT', 'users', 50);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        {
          reqId: 'req123',
          operation: 'SELECT',
          table: 'users',
          duration: 50,
          type: 'database',
        },
        'Database SELECT on users'
      );
    });

    it('should log queue operations', () => {
      log.queue('req123', 'email', 'job456', 'process', 'completed');

      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          reqId: 'req123',
          queueName: 'email',
          jobId: 'job456',
          operation: 'process',
          status: 'completed',
          type: 'queue',
        },
        'Queue process: email/job456'
      );
    });

    it('should log auth operations', () => {
      log.auth('req123', 'login', 'user456', true);

      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          reqId: 'req123',
          operation: 'login',
          userId: 'user456',
          success: true,
          type: 'auth',
        },
        'Auth login successful'
      );
    });

    it('should log business operations', () => {
      log.business('req123', 'create', 'campaign', 'camp789', 'user456', { budget: 1000 });

      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          reqId: 'req123',
          operation: 'create',
          entityType: 'campaign',
          entityId: 'camp789',
          userId: 'user456',
          metadata: { budget: 1000 },
          type: 'business',
        },
        'Business create: campaign/camp789'
      );
    });

    it('should log performance metrics', () => {
      log.performance('req123', 'database_query', 150, { table: 'users' });

      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          reqId: 'req123',
          operation: 'database_query',
          duration: 150,
          metadata: { table: 'users' },
          type: 'performance',
        },
        'Performance: database_query took 150ms'
      );
    });

    it('should log security events', () => {
      log.security('req123', 'suspicious_request', 'high', { pattern: 'xss' });

      expect(mockLogger.error).toHaveBeenCalledWith(
        {
          reqId: 'req123',
          event: 'suspicious_request',
          severity: 'high',
          details: { pattern: 'xss' },
          type: 'security',
        },
        'Security suspicious_request: high'
      );
    });

    it('should log external service calls', () => {
      log.external('req123', 'stripe', 'create_customer', 200, undefined, { customerId: 'cus123' });

      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          reqId: 'req123',
          service: 'stripe',
          operation: 'create_customer',
          duration: 200,
          customerId: 'cus123',
          type: 'external',
        },
        'External service stripe create_customer'
      );
    });
  });

  describe('createRequestLogger', () => {
    it('should create logger with request context', () => {
      const requestLogger = createRequestLogger('req123', 'user456');

      requestLogger.info('Test message', { additional: 'data' });

      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          reqId: 'req123',
          userId: 'user456',
          additional: 'data',
        },
        'Test message'
      );
    });
  });

  describe('PerformanceTimer', () => {
    it('should measure and log performance', () => {
      jest.useFakeTimers();
      
      const timer = new PerformanceTimer('req123', 'test_operation');
      
      jest.advanceTimersByTime(150);
      const duration = timer.end({ metadata: 'test' });

      expect(duration).toBe(150);
      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          reqId: 'req123',
          operation: 'test_operation',
          duration: 150,
          metadata: 'test',
          type: 'performance',
        },
        'Performance: test_operation took 150ms'
      );

      jest.useRealTimers();
    });
  });

  describe('logError', () => {
    it('should log error and capture with Sentry', () => {
      const mockSentry = require('@sentry/node');
      const error = new Error('Test error');
      
      logError('req123', error, { userId: 'user456' });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          reqId: 'req123',
          userId: 'user456',
        }),
        expect.any(String)
      );

      expect(mockSentry.captureException).toHaveBeenCalledWith(error, {
        tags: {
          reqId: 'req123',
          userId: 'user456',
        },
        extra: {
          userId: 'user456',
        },
      });
    });

    it('should handle Sentry errors gracefully', () => {
      const mockSentry = require('@sentry/node');
      mockSentry.captureException.mockImplementation(() => {
        throw new Error('Sentry error');
      });

      const error = new Error('Test error');
      
      logError('req123', error, { userId: 'user456' });

      expect(mockLogger.error).toHaveBeenCalledTimes(2); // Original error + Sentry error
    });
  });
});
