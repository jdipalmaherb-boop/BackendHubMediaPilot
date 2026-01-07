import pino from 'pino';
import { env } from '../env';

// Create Pino logger instance
const logger = pino({
  level: env.LOG_LEVEL || 'info',
  transport: env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  } : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    env: env.NODE_ENV,
    service: 'backendhub-api',
  },
});

// Extend logger with request context
export interface LogContext {
  reqId?: string;
  userId?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  duration?: number;
  error?: Error;
  [key: string]: any;
}

// Create typed logger methods
export const log = {
  info: (context: LogContext, message: string) => {
    logger.info(context, message);
  },

  warn: (context: LogContext, message: string) => {
    logger.warn(context, message);
  },

  error: (context: LogContext, message: string) => {
    logger.error(context, message);
  },

  debug: (context: LogContext, message: string) => {
    logger.debug(context, message);
  },

  fatal: (context: LogContext, message: string) => {
    logger.fatal(context, message);
  },

  // Convenience methods for common logging patterns
  request: (reqId: string, method: string, path: string, userId?: string) => {
    logger.info({
      reqId,
      method,
      path,
      userId,
      type: 'request',
    }, `${method} ${path}`);
  },

  response: (reqId: string, method: string, path: string, statusCode: number, duration: number, userId?: string) => {
    logger.info({
      reqId,
      method,
      path,
      statusCode,
      duration,
      userId,
      type: 'response',
    }, `${method} ${path} ${statusCode} - ${duration}ms`);
  },

  error: (reqId: string, error: Error, context?: LogContext) => {
    logger.error({
      reqId,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...context,
      type: 'error',
    }, `Error: ${error.message}`);
  },

  database: (reqId: string, operation: string, table: string, duration?: number, error?: Error) => {
    const context: LogContext = {
      reqId,
      operation,
      table,
      type: 'database',
    };

    if (duration) {
      context.duration = duration;
    }

    if (error) {
      context.error = error;
      logger.error(context, `Database ${operation} on ${table} failed`);
    } else {
      logger.debug(context, `Database ${operation} on ${table}`);
    }
  },

  queue: (reqId: string, queueName: string, jobId: string, operation: string, status?: string) => {
    logger.info({
      reqId,
      queueName,
      jobId,
      operation,
      status,
      type: 'queue',
    }, `Queue ${operation}: ${queueName}/${jobId}`);
  },

  auth: (reqId: string, operation: string, userId?: string, success: boolean = true, error?: Error) => {
    const context: LogContext = {
      reqId,
      operation,
      userId,
      success,
      type: 'auth',
    };

    if (error) {
      context.error = error;
      logger.warn(context, `Auth ${operation} failed`);
    } else {
      logger.info(context, `Auth ${operation} ${success ? 'successful' : 'failed'}`);
    }
  },

  business: (reqId: string, operation: string, entityType: string, entityId: string, userId?: string, metadata?: any) => {
    logger.info({
      reqId,
      operation,
      entityType,
      entityId,
      userId,
      metadata,
      type: 'business',
    }, `Business ${operation}: ${entityType}/${entityId}`);
  },

  performance: (reqId: string, operation: string, duration: number, metadata?: any) => {
    logger.info({
      reqId,
      operation,
      duration,
      metadata,
      type: 'performance',
    }, `Performance: ${operation} took ${duration}ms`);
  },

  security: (reqId: string, event: string, severity: 'low' | 'medium' | 'high' | 'critical', details?: any) => {
    const level = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
    logger[level]({
      reqId,
      event,
      severity,
      details,
      type: 'security',
    }, `Security ${event}: ${severity}`);
  },

  external: (reqId: string, service: string, operation: string, duration?: number, error?: Error, metadata?: any) => {
    const context: LogContext = {
      reqId,
      service,
      operation,
      type: 'external',
    };

    if (duration) {
      context.duration = duration;
    }

    if (metadata) {
      Object.assign(context, metadata);
    }

    if (error) {
      context.error = error;
      logger.error(context, `External service ${service} ${operation} failed`);
    } else {
      logger.info(context, `External service ${service} ${operation}`);
    }
  },
};

// Child logger factory for request-specific logging
export function createRequestLogger(reqId: string, userId?: string) {
  return {
    info: (message: string, context?: LogContext) => {
      log.info({ reqId, userId, ...context }, message);
    },

    warn: (message: string, context?: LogContext) => {
      log.warn({ reqId, userId, ...context }, message);
    },

    error: (message: string, context?: LogContext) => {
      log.error({ reqId, userId, ...context }, message);
    },

    debug: (message: string, context?: LogContext) => {
      log.debug({ reqId, userId, ...context }, message);
    },

    fatal: (message: string, context?: LogContext) => {
      log.fatal({ reqId, userId, ...context }, message);
    },
  };
}

// Performance timing helper
export class PerformanceTimer {
  private startTime: number;
  private reqId: string;
  private operation: string;

  constructor(reqId: string, operation: string) {
    this.reqId = reqId;
    this.operation = operation;
    this.startTime = Date.now();
  }

  end(metadata?: any): number {
    const duration = Date.now() - this.startTime;
    log.performance(this.reqId, this.operation, duration, metadata);
    return duration;
  }
}

// Error logging helper with Sentry integration
export function logError(reqId: string, error: Error, context?: LogContext) {
  log.error(reqId, error, context);

  // Capture with Sentry if available
  if (typeof window === 'undefined' && process.env.SENTRY_DSN) {
    try {
      const Sentry = require('@sentry/node');
      Sentry.captureException(error, {
        tags: {
          reqId,
          ...context,
        },
        extra: {
          context,
        },
      });
    } catch (sentryError) {
      // Fallback if Sentry is not properly configured
      logger.error({
        reqId,
        error: sentryError,
        originalError: error.message,
        type: 'sentry_error',
      }, 'Failed to capture error with Sentry');
    }
  }
}

// Request logging middleware helper
export function logRequest(reqId: string, req: any, res: any, startTime: number) {
  const duration = Date.now() - startTime;
  const userId = req.user?.id;
  
  log.response(
    reqId,
    req.method,
    req.path,
    res.statusCode,
    duration,
    userId
  );
}

// Database query logging helper
export function logDatabaseQuery(reqId: string, query: string, params?: any[], duration?: number, error?: Error) {
  log.database(reqId, 'query', 'unknown', duration, error);
  
  if (env.LOG_LEVEL === 'debug') {
    logger.debug({
      reqId,
      query,
      params,
      type: 'database_query',
    }, 'Database query executed');
  }
}

// Queue job logging helper
export function logQueueJob(reqId: string, queueName: string, jobId: string, operation: string, status?: string) {
  log.queue(reqId, queueName, jobId, operation, status);
}

// Business operation logging helper
export function logBusinessOperation(reqId: string, operation: string, entityType: string, entityId: string, userId?: string, metadata?: any) {
  log.business(reqId, operation, entityType, entityId, userId, metadata);
}

// Security event logging helper
export function logSecurityEvent(reqId: string, event: string, severity: 'low' | 'medium' | 'high' | 'critical', details?: any) {
  log.security(reqId, event, severity, details);
}

// External service logging helper
export function logExternalService(reqId: string, service: string, operation: string, duration?: number, error?: Error, metadata?: any) {
  log.external(reqId, service, operation, duration, error, metadata);
}

export default logger;
