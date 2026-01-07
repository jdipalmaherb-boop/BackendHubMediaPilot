import { Request, Response, NextFunction } from 'express';
import { log } from '../lib/logger';

// Input sanitization configuration
const SANITIZATION_CONFIG = {
  maxStringLength: 10000, // 10KB max string length
  maxObjectDepth: 10, // Maximum object nesting depth
  maxArrayLength: 1000, // Maximum array length
  maxTotalSize: 1024 * 1024, // 1MB max total request size
  allowedFields: new Set([
    'email', 'name', 'password', 'title', 'description', 'content',
    'message', 'subject', 'body', 'filename', 'contentType', 'size',
    'metadata', 'options', 'settings', 'config', 'data'
  ]),
  blockedPatterns: [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /onload=/gi,
    /onerror=/gi,
    /onclick=/gi,
    /onmouseover=/gi,
    /eval\s*\(/gi,
    /expression\s*\(/gi,
    /url\s*\(/gi,
    /import\s+/gi,
    /require\s*\(/gi,
    /process\.env/gi,
    /\.\.\//g, // Path traversal
    /\.\.\\/g, // Windows path traversal
    /union\s+select/gi, // SQL injection
    /drop\s+table/gi, // SQL injection
    /delete\s+from/gi, // SQL injection
    /insert\s+into/gi, // SQL injection
    /update\s+set/gi, // SQL injection
  ],
  controlChars: /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,
};

/**
 * Sanitize a string value
 */
function sanitizeString(value: string, fieldName: string): string {
  if (typeof value !== 'string') {
    return value;
  }

  // Check length
  if (value.length > SANITIZATION_CONFIG.maxStringLength) {
    throw new Error(`Field '${fieldName}' exceeds maximum length of ${SANITIZATION_CONFIG.maxStringLength} characters`);
  }

  // Remove control characters
  let sanitized = value.replace(SANITIZATION_CONFIG.controlChars, '');

  // Check for blocked patterns
  for (const pattern of SANITIZATION_CONFIG.blockedPatterns) {
    if (pattern.test(sanitized)) {
      log.security('suspicious_input_detected', 'high', {
        field: fieldName,
        pattern: pattern.toString(),
        value: sanitized.substring(0, 100), // Log first 100 chars
      });
      throw new Error(`Field '${fieldName}' contains potentially malicious content`);
    }
  }

  // Escape HTML entities
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');

  return sanitized;
}

/**
 * Sanitize an object recursively
 */
function sanitizeObject(obj: any, fieldName: string = 'root', depth: number = 0): any {
  if (depth > SANITIZATION_CONFIG.maxObjectDepth) {
    throw new Error(`Object nesting depth exceeds maximum of ${SANITIZATION_CONFIG.maxObjectDepth}`);
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj, fieldName);
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    if (obj.length > SANITIZATION_CONFIG.maxArrayLength) {
      throw new Error(`Array length exceeds maximum of ${SANITIZATION_CONFIG.maxArrayLength}`);
    }
    return obj.map((item, index) => sanitizeObject(item, `${fieldName}[${index}]`, depth + 1));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Check if field is allowed
      if (!SANITIZATION_CONFIG.allowedFields.has(key) && !key.startsWith('_')) {
        log.security('unknown_field_detected', 'medium', {
          field: key,
          parentField: fieldName,
        });
        // Skip unknown fields instead of throwing error
        continue;
      }

      // Sanitize field name
      const sanitizedKey = sanitizeString(key, `${fieldName}.key`);
      sanitized[sanitizedKey] = sanitizeObject(value, `${fieldName}.${key}`, depth + 1);
    }
    return sanitized;
  }

  return obj;
}

/**
 * Calculate object size
 */
function calculateSize(obj: any): number {
  return JSON.stringify(obj).length;
}

/**
 * Input sanitization middleware
 */
export function inputSanitizerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const startTime = Date.now();
    let totalSize = 0;

    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      const bodySize = calculateSize(req.body);
      totalSize += bodySize;

      if (totalSize > SANITIZATION_CONFIG.maxTotalSize) {
        throw new Error(`Request size exceeds maximum of ${SANITIZATION_CONFIG.maxTotalSize} bytes`);
      }

      req.body = sanitizeObject(req.body, 'body');
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      const querySize = calculateSize(req.query);
      totalSize += querySize;

      if (totalSize > SANITIZATION_CONFIG.maxTotalSize) {
        throw new Error(`Request size exceeds maximum of ${SANITIZATION_CONFIG.maxTotalSize} bytes`);
      }

      req.query = sanitizeObject(req.query, 'query');
    }

    // Sanitize route parameters
    if (req.params && typeof req.params === 'object') {
      const paramsSize = calculateSize(req.params);
      totalSize += paramsSize;

      if (totalSize > SANITIZATION_CONFIG.maxTotalSize) {
        throw new Error(`Request size exceeds maximum of ${SANITIZATION_CONFIG.maxTotalSize} bytes`);
      }

      req.params = sanitizeObject(req.params, 'params');
    }

    const processingTime = Date.now() - startTime;
    
    // Log suspicious processing time
    if (processingTime > 100) {
      log.security('slow_sanitization', 'low', {
        processingTime,
        totalSize,
        path: req.path,
        method: req.method,
      });
    }

    next();
  } catch (error) {
    log.security('input_sanitization_failed', 'high', {
      error: (error as Error).message,
      path: req.path,
      method: req.method,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    res.status(400).json({
      error: 'Invalid Input',
      message: 'Request contains invalid or potentially malicious data',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
}

/**
 * Field-specific sanitization middleware
 */
export function createFieldSanitizer(allowedFields: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.body && typeof req.body === 'object') {
        const sanitizedBody: any = {};
        
        for (const field of allowedFields) {
          if (req.body[field] !== undefined) {
            sanitizedBody[field] = sanitizeObject(req.body[field], field);
          }
        }
        
        req.body = sanitizedBody;
      }
      
      next();
    } catch (error) {
      log.security('field_sanitization_failed', 'medium', {
        error: (error as Error).message,
        allowedFields,
        path: req.path,
      });

      res.status(400).json({
        error: 'Invalid Field Data',
        message: 'One or more fields contain invalid data',
      });
    }
  };
}

/**
 * SQL injection prevention middleware
 */
export function sqlInjectionPreventionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const sqlPatterns = [
    /union\s+select/gi,
    /drop\s+table/gi,
    /delete\s+from/gi,
    /insert\s+into/gi,
    /update\s+set/gi,
    /alter\s+table/gi,
    /create\s+table/gi,
    /exec\s*\(/gi,
    /execute\s*\(/gi,
    /sp_executesql/gi,
  ];

  const checkValue = (value: any, path: string): boolean => {
    if (typeof value === 'string') {
      for (const pattern of sqlPatterns) {
        if (pattern.test(value)) {
          log.security('sql_injection_attempt', 'critical', {
            pattern: pattern.toString(),
            path,
            value: value.substring(0, 100),
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          });
          return false;
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      for (const [key, val] of Object.entries(value)) {
        if (!checkValue(val, `${path}.${key}`)) {
          return false;
        }
      }
    }
    return true;
  };

  try {
    // Check body
    if (req.body && !checkValue(req.body, 'body')) {
      throw new Error('SQL injection attempt detected in request body');
    }

    // Check query
    if (req.query && !checkValue(req.query, 'query')) {
      throw new Error('SQL injection attempt detected in query parameters');
    }

    // Check params
    if (req.params && !checkValue(req.params, 'params')) {
      throw new Error('SQL injection attempt detected in route parameters');
    }

    next();
  } catch (error) {
    res.status(400).json({
      error: 'Security Violation',
      message: 'Request contains potentially malicious SQL content',
    });
  }
}

export default {
  inputSanitizerMiddleware,
  createFieldSanitizer,
  sqlInjectionPreventionMiddleware,
};
