import { Request, Response, NextFunction } from 'express';
import IORedis from 'ioredis';
import { env } from '../env';
import { log } from '../lib/logger';

// Redis client for rate limiting
const redis = new IORedis(env.REDIS_URL || 'redis://localhost:6379');

// Rate limit configurations
const RATE_LIMITS = {
  // General API rate limits
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per window
    skipSuccessfulRequests: false,
  },
  
  // Authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 login attempts per window
    skipSuccessfulRequests: true,
  },
  
  // Password reset
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 password reset attempts per hour
    skipSuccessfulRequests: true,
  },
  
  // Email verification
  emailVerification: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 verification attempts per hour
    skipSuccessfulRequests: true,
  },
  
  // GPT API endpoints
  gpt: {
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 GPT requests per minute
    skipSuccessfulRequests: false,
  },
  
  // File upload endpoints
  upload: {
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 uploads per minute
    skipSuccessfulRequests: false,
  },
  
  // Stripe webhooks (more lenient)
  webhook: {
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 webhook calls per minute
    skipSuccessfulRequests: false,
  },
  
  // Admin endpoints
  admin: {
    windowMs: 60 * 1000, // 1 minute
    max: 50, // 50 admin requests per minute
    skipSuccessfulRequests: false,
  },
};

interface RateLimitConfig {
  windowMs: number;
  max: number;
  skipSuccessfulRequests: boolean;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalHits: number;
}

/**
 * Redis-based rate limiter
 */
class RedisRateLimiter {
  private redis: IORedis;

  constructor(redis: IORedis) {
    this.redis = redis;
  }

  async checkLimit(
    key: string,
    config: RateLimitConfig,
    identifier: string
  ): Promise<RateLimitResult> {
    const window = Math.floor(Date.now() / config.windowMs);
    const redisKey = `rate_limit:${key}:${identifier}:${window}`;
    
    try {
      // Use Redis pipeline for atomic operations
      const pipeline = this.redis.pipeline();
      
      // Increment counter
      pipeline.incr(redisKey);
      
      // Set expiration (only if this is the first request in the window)
      pipeline.expire(redisKey, Math.ceil(config.windowMs / 1000));
      
      const results = await pipeline.exec();
      
      if (!results || results.length === 0) {
        throw new Error('Redis pipeline execution failed');
      }
      
      const totalHits = results[0][1] as number;
      const remaining = Math.max(0, config.max - totalHits);
      const allowed = totalHits <= config.max;
      const resetTime = (window + 1) * config.windowMs;
      
      return {
        allowed,
        remaining,
        resetTime,
        totalHits,
      };
    } catch (error) {
      log.error('rate_limit_error', error as Error, {
        key,
        identifier,
        config,
      });
      
      // Fail open - allow request if Redis is down
      return {
        allowed: true,
        remaining: config.max,
        resetTime: Date.now() + config.windowMs,
        totalHits: 0,
      };
    }
  }

  async getRemaining(key: string, identifier: string): Promise<number> {
    const window = Math.floor(Date.now() / RATE_LIMITS.general.windowMs);
    const redisKey = `rate_limit:${key}:${identifier}:${window}`;
    
    try {
      const hits = await this.redis.get(redisKey);
      return Math.max(0, RATE_LIMITS.general.max - (parseInt(hits || '0')));
    } catch (error) {
      log.error('rate_limit_check_error', error as Error, {
        key,
        identifier,
      });
      return RATE_LIMITS.general.max;
    }
  }
}

const rateLimiter = new RedisRateLimiter(redis);

/**
 * Generate rate limit key based on request
 */
function generateRateLimitKey(req: Request): string {
  const path = req.path;
  
  // Determine rate limit category based on path
  if (path.startsWith('/auth/login') || path.startsWith('/auth/register')) {
    return 'auth';
  } else if (path.startsWith('/auth/password-reset')) {
    return 'passwordReset';
  } else if (path.startsWith('/auth/verify-email')) {
    return 'emailVerification';
  } else if (path.startsWith('/gpt')) {
    return 'gpt';
  } else if (path.startsWith('/uploads')) {
    return 'upload';
  } else if (path.startsWith('/webhooks')) {
    return 'webhook';
  } else if (path.startsWith('/admin')) {
    return 'admin';
  } else {
    return 'general';
  }
}

/**
 * Generate identifier for rate limiting
 */
function generateIdentifier(req: Request): string {
  // Use user ID if authenticated, otherwise use IP
  if (req.user?.id) {
    return `user:${req.user.id}`;
  }
  
  // Use IP address with X-Forwarded-For support
  const ip = req.ip || 
    req.connection.remoteAddress || 
    req.socket.remoteAddress ||
    (req.connection as any)?.socket?.remoteAddress ||
    'unknown';
    
  return `ip:${ip}`;
}

/**
 * Rate limiting middleware
 */
export async function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const key = generateRateLimitKey(req);
    const identifier = generateIdentifier(req);
    const config = RATE_LIMITS[key as keyof typeof RATE_LIMITS] || RATE_LIMITS.general;
    
    // Skip rate limiting for successful requests if configured
    if (config.skipSuccessfulRequests) {
      // We'll check this after the request is processed
      (req as any).rateLimitConfig = config;
      (req as any).rateLimitIdentifier = identifier;
      (req as any).rateLimitKey = key;
      return next();
    }
    
    const result = await rateLimiter.checkLimit(key, config, identifier);
    
    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': config.max.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
      'X-RateLimit-Window': config.windowMs.toString(),
    });
    
    if (!result.allowed) {
      // Log rate limit violation
      log.security('rate_limit_exceeded', 'medium', {
        key,
        identifier,
        totalHits: result.totalHits,
        limit: config.max,
        windowMs: config.windowMs,
        path: req.path,
        method: req.method,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      });
      
      res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Maximum ${config.max} requests per ${Math.floor(config.windowMs / 1000 / 60)} minutes.`,
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
        limit: config.max,
        remaining: result.remaining,
        resetTime: new Date(result.resetTime).toISOString(),
      });
      return;
    }
    
    // Store rate limit info for post-processing
    (req as any).rateLimitResult = result;
    (req as any).rateLimitConfig = config;
    
    next();
  } catch (error) {
    log.error('rate_limit_middleware_error', error as Error, {
      path: req.path,
      method: req.method,
    });
    
    // Fail open - allow request if rate limiting fails
    next();
  }
}

/**
 * Post-request rate limiting for skipSuccessfulRequests
 */
export async function postRequestRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const config = (req as any).rateLimitConfig;
    const identifier = (req as any).rateLimitIdentifier;
    const key = (req as any).rateLimitKey;
    
    if (!config || !config.skipSuccessfulRequests) {
      return next();
    }
    
    // Only apply rate limiting to failed requests
    if (res.statusCode >= 200 && res.statusCode < 400) {
      return next();
    }
    
    const result = await rateLimiter.checkLimit(key, config, identifier);
    
    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': config.max.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
      'X-RateLimit-Window': config.windowMs.toString(),
    });
    
    if (!result.allowed) {
      // Log rate limit violation
      log.security('rate_limit_exceeded', 'medium', {
        key,
        identifier,
        totalHits: result.totalHits,
        limit: config.max,
        windowMs: config.windowMs,
        path: req.path,
        method: req.method,
        statusCode: res.statusCode,
      });
      
      res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Maximum ${config.max} requests per ${Math.floor(config.windowMs / 1000 / 60)} minutes.`,
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
      });
      return;
    }
    
    next();
  } catch (error) {
    log.error('post_rate_limit_error', error as Error);
    next();
  }
}

/**
 * Get current rate limit status for a user/IP
 */
export async function getRateLimitStatus(
  identifier: string,
  key: string = 'general'
): Promise<{
  remaining: number;
  limit: number;
  resetTime: number;
  windowMs: number;
}> {
  const config = RATE_LIMITS[key as keyof typeof RATE_LIMITS] || RATE_LIMITS.general;
  const remaining = await rateLimiter.getRemaining(key, identifier);
  const window = Math.floor(Date.now() / config.windowMs);
  const resetTime = (window + 1) * config.windowMs;
  
  return {
    remaining,
    limit: config.max,
    resetTime,
    windowMs: config.windowMs,
  };
}

/**
 * Reset rate limit for a specific identifier
 */
export async function resetRateLimit(
  identifier: string,
  key: string = 'general'
): Promise<void> {
  const window = Math.floor(Date.now() / RATE_LIMITS.general.windowMs);
  const redisKey = `rate_limit:${key}:${identifier}:${window}`;
  
  try {
    await redis.del(redisKey);
    log.info('rate_limit_reset', {
      identifier,
      key,
      redisKey,
    });
  } catch (error) {
    log.error('rate_limit_reset_error', error as Error, {
      identifier,
      key,
    });
  }
}

/**
 * Rate limit bypass for admin users
 */
export function createAdminRateLimitBypass() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check if user is admin
    if (req.user?.role === 'admin' || req.user?.role === 'super_admin') {
      // Set unlimited rate limit headers
      res.set({
        'X-RateLimit-Limit': 'unlimited',
        'X-RateLimit-Remaining': 'unlimited',
        'X-RateLimit-Reset': new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        'X-RateLimit-Window': 'unlimited',
      });
    }
    next();
  };
}

export default {
  rateLimitMiddleware,
  postRequestRateLimit,
  getRateLimitStatus,
  resetRateLimit,
  createAdminRateLimitBypass,
};
