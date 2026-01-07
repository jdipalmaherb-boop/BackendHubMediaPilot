import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { log } from '../lib/logger';

// Extend Express Request interface to include request ID
declare global {
  namespace Express {
    interface Request {
      reqId: string;
      startTime: number;
    }
  }
}

/**
 * Request ID middleware
 * Generates a unique UUID for each request and attaches it to the request object
 * Also sets the x-request-id header in the response
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Generate or use existing request ID
  const reqId = req.headers['x-request-id'] as string || uuidv4();
  
  // Attach to request object
  req.reqId = reqId;
  req.startTime = Date.now();
  
  // Set response header
  res.setHeader('x-request-id', reqId);
  
  // Log incoming request
  log.request(reqId, req.method, req.path, req.user?.id);
  
  next();
}

/**
 * Request logging middleware
 * Logs the response after the request is processed
 */
export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Store original end method
  const originalEnd = res.end;
  
  // Override end method to log response
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - req.startTime;
    const userId = req.user?.id;
    
    // Log response
    log.response(
      req.reqId,
      req.method,
      req.path,
      res.statusCode,
      duration,
      userId
    );
    
    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
}

/**
 * Error logging middleware
 * Logs errors with request context
 */
export function errorLoggingMiddleware(err: Error, req: Request, res: Response, next: NextFunction): void {
  const reqId = req.reqId || 'unknown';
  
  // Log error with request context
  log.error(reqId, err, {
    method: req.method,
    path: req.path,
    userId: req.user?.id,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    statusCode: res.statusCode,
  });
  
  next(err);
}

/**
 * Performance monitoring middleware
 * Logs slow requests
 */
export function performanceMiddleware(req: Request, res: Response, next: NextFunction): void {
  const slowRequestThreshold = parseInt(process.env.SLOW_REQUEST_THRESHOLD || '1000'); // 1 second
  
  // Store original end method
  const originalEnd = res.end;
  
  // Override end method to check performance
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - req.startTime;
    
    // Log slow requests
    if (duration > slowRequestThreshold) {
      log.warn({
        reqId: req.reqId,
        method: req.method,
        path: req.path,
        duration,
        userId: req.user?.id,
        type: 'slow_request',
      }, `Slow request detected: ${req.method} ${req.path} took ${duration}ms`);
    }
    
    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
}

/**
 * Security logging middleware
 * Logs security-related events
 */
export function securityLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const reqId = req.reqId || 'unknown';
  
  // Log suspicious patterns
  const suspiciousPatterns = [
    /\.\./,  // Path traversal
    /<script/i,  // XSS attempts
    /union\s+select/i,  // SQL injection
    /eval\s*\(/i,  // Code injection
  ];
  
  const url = req.url;
  const body = JSON.stringify(req.body || {});
  const query = JSON.stringify(req.query || {});
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(url) || pattern.test(body) || pattern.test(query)) {
      log.security(reqId, 'suspicious_request', 'medium', {
        pattern: pattern.toString(),
        url,
        method: req.method,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      break;
    }
  }
  
  // Log authentication attempts
  if (req.path.includes('/auth/') || req.path.includes('/login')) {
    log.auth(reqId, 'authentication_attempt', req.user?.id, true);
  }
  
  // Log admin access
  if (req.path.includes('/admin/') || req.path.includes('/admin')) {
    log.security(reqId, 'admin_access', 'high', {
      path: req.path,
      userId: req.user?.id,
      ip: req.ip,
    });
  }
  
  next();
}

/**
 * Database query logging middleware
 * Logs database operations (if enabled)
 */
export function databaseLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const reqId = req.reqId || 'unknown';
  
  // This would typically be implemented with Prisma middleware
  // For now, we'll just set up the context
  
  // Store original query methods if needed
  // This is a placeholder for actual database query logging
  
  next();
}

/**
 * Combined middleware that includes all logging functionality
 */
export function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Apply all logging middleware in sequence
  requestIdMiddleware(req, res, (err) => {
    if (err) return next(err);
    
    requestLoggingMiddleware(req, res, (err) => {
      if (err) return next(err);
      
      performanceMiddleware(req, res, (err) => {
        if (err) return next(err);
        
        securityLoggingMiddleware(req, res, (err) => {
          if (err) return next(err);
          
          databaseLoggingMiddleware(req, res, next);
        });
      });
    });
  });
}

/**
 * Health check middleware that doesn't log
 * Use this for health check endpoints to avoid noise
 */
export function noLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Just set request ID without logging
  const reqId = req.headers['x-request-id'] as string || uuidv4();
  req.reqId = reqId;
  res.setHeader('x-request-id', reqId);
  
  next();
}

/**
 * API key logging middleware
 * Logs API key usage for monitoring
 */
export function apiKeyLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const reqId = req.reqId || 'unknown';
  const apiKey = req.headers['x-api-key'] as string;
  
  if (apiKey) {
    // Mask the API key for security
    const maskedKey = apiKey.substring(0, 8) + '...';
    
    log.info({
      reqId,
      apiKey: maskedKey,
      method: req.method,
      path: req.path,
      type: 'api_key_usage',
    }, 'API key used');
  }
  
  next();
}

/**
 * Rate limiting logging middleware
 * Logs rate limit violations
 */
export function rateLimitLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const reqId = req.reqId || 'unknown';
  
  // Check if rate limit headers are present
  const remaining = res.getHeader('x-ratelimit-remaining');
  const limit = res.getHeader('x-ratelimit-limit');
  
  if (remaining === 0) {
    log.security(reqId, 'rate_limit_exceeded', 'medium', {
      limit,
      remaining,
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
  }
  
  next();
}

export default {
  requestIdMiddleware,
  requestLoggingMiddleware,
  errorLoggingMiddleware,
  performanceMiddleware,
  securityLoggingMiddleware,
  databaseLoggingMiddleware,
  loggingMiddleware,
  noLoggingMiddleware,
  apiKeyLoggingMiddleware,
  rateLimitLoggingMiddleware,
};
