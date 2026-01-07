import { Request, Response, NextFunction } from 'express';
import { env } from '../env';
import { prisma } from '../lib/prisma';

// Suspicious patterns that might indicate prompt injection
const SUSPICIOUS_PATTERNS = [
  /ignore\s+(previous|above|all)\s+(instructions?|prompts?|rules?)/i,
  /forget\s+(everything|all)\s+(previous|above)/i,
  /you\s+are\s+now\s+(a|an)\s+\w+/i,
  /pretend\s+to\s+be/i,
  /act\s+as\s+(if\s+)?(you\s+are\s+)?(a|an)\s+\w+/i,
  /roleplay\s+as/i,
  /system\s*:\s*/i,
  /assistant\s*:\s*/i,
  /user\s*:\s*/i,
  /<\|.*?\|>/g, // Special tokens
  /\[.*?\]/g, // Bracketed instructions
  /\{.*?\}/g, // Curly brace instructions
  /```.*?```/gs, // Code blocks
  /---.*?---/gs, // Separator blocks
];

// Control characters that should be stripped
const CONTROL_CHARS_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

// Maximum unique tokens threshold
const MAX_UNIQUE_TOKENS = 100;

export interface SanitizationResult {
  sanitized: string;
  warnings: string[];
  blocked: boolean;
  reason?: string;
}

// Helper function to count unique tokens (simple word-based approach)
function countUniqueTokens(text: string): number {
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);
  
  return new Set(words).size;
}

// Helper function to detect suspicious patterns
function detectSuspiciousPatterns(text: string): string[] {
  const warnings: string[] = [];
  
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(text)) {
      warnings.push(`Suspicious pattern detected: ${pattern.source}`);
    }
  }
  
  return warnings;
}

// Main sanitization function
export function sanitizeInput(input: string, maxLength?: number): SanitizationResult {
  const maxLen = maxLength || env.PROMPT_MAX_INPUT_LENGTH || 4000;
  const warnings: string[] = [];
  
  // Check length
  if (input.length > maxLen) {
    return {
      sanitized: '',
      warnings: [`Input exceeds maximum length of ${maxLen} characters`],
      blocked: true,
      reason: 'Input too long'
    };
  }
  
  // Count unique tokens
  const uniqueTokens = countUniqueTokens(input);
  if (uniqueTokens > MAX_UNIQUE_TOKENS) {
    return {
      sanitized: '',
      warnings: [`Too many unique tokens: ${uniqueTokens} (max: ${MAX_UNIQUE_TOKENS})`],
      blocked: true,
      reason: 'Too many unique tokens'
    };
  }
  
  // Detect suspicious patterns
  const suspiciousWarnings = detectSuspiciousPatterns(input);
  if (suspiciousWarnings.length > 0) {
    warnings.push(...suspiciousWarnings);
    
    // Block if too many suspicious patterns
    if (suspiciousWarnings.length >= 3) {
      return {
        sanitized: '',
        warnings,
        blocked: true,
        reason: 'Too many suspicious patterns'
      };
    }
  }
  
  // Strip control characters
  let sanitized = input.replace(CONTROL_CHARS_REGEX, '');
  
  // Escape potential placeholder injections
  sanitized = sanitized
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  return {
    sanitized,
    warnings,
    blocked: false
  };
}

// Middleware to sanitize request body
export function sanitizePromptInput(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    const originalBody = { ...req.body };
    
    // Sanitize string fields in the request body
    const sanitizedBody: any = {};
    let hasBlockedContent = false;
    const allWarnings: string[] = [];
    
    for (const [key, value] of Object.entries(req.body)) {
      if (typeof value === 'string') {
        const result = sanitizeInput(value);
        
        if (result.blocked) {
          hasBlockedContent = true;
          allWarnings.push(...result.warnings);
          
          // Log suspicious attempt
          if (userId) {
            prisma.gptUsage.create({
              data: {
                userId,
                tokens: 0,
                costUsd: 0,
                meta: {
                  type: 'suspicious_input_blocked',
                  field: key,
                  originalValue: value.substring(0, 200), // Log first 200 chars
                  warnings: result.warnings,
                  userAgent: req.get('User-Agent'),
                  ip: req.ip,
                },
              },
            }).catch(console.error);
          }
        } else {
          sanitizedBody[key] = result.sanitized;
          if (result.warnings.length > 0) {
            allWarnings.push(...result.warnings);
          }
        }
      } else {
        sanitizedBody[key] = value;
      }
    }
    
    // Replace request body with sanitized version
    req.body = sanitizedBody;
    
    // If content was blocked, return error
    if (hasBlockedContent) {
      return res.status(400).json({
        error: 'Input blocked due to security concerns',
        code: 'INPUT_BLOCKED',
        warnings: allWarnings,
        message: 'Your input contains potentially harmful content and has been blocked for security reasons.'
      });
    }
    
    // Add warnings to response headers if any
    if (allWarnings.length > 0) {
      res.set('X-Input-Warnings', allWarnings.join('; '));
    }
    
    next();
  } catch (error) {
    console.error('Sanitization middleware error:', error);
    res.status(500).json({
      error: 'Input sanitization failed',
      code: 'SANITIZATION_ERROR'
    });
  }
}

// Helper function to sanitize specific fields
export function sanitizeFields(fields: string[], req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    const warnings: string[] = [];
    
    for (const field of fields) {
      if (req.body[field] && typeof req.body[field] === 'string') {
        const result = sanitizeInput(req.body[field]);
        
        if (result.blocked) {
          // Log suspicious attempt
          if (userId) {
            prisma.gptUsage.create({
              data: {
                userId,
                tokens: 0,
                costUsd: 0,
                meta: {
                  type: 'field_sanitization_blocked',
                  field,
                  warnings: result.warnings,
                },
              },
            }).catch(console.error);
          }
          
          return res.status(400).json({
            error: `Field '${field}' blocked due to security concerns`,
            code: 'FIELD_BLOCKED',
            warnings: result.warnings,
          });
        }
        
        req.body[field] = result.sanitized;
        warnings.push(...result.warnings);
      }
    }
    
    if (warnings.length > 0) {
      res.set('X-Input-Warnings', warnings.join('; '));
    }
    
    next();
  } catch (error) {
    console.error('Field sanitization error:', error);
    res.status(500).json({
      error: 'Field sanitization failed',
      code: 'SANITIZATION_ERROR'
    });
  }
}

// Rate limiting for suspicious attempts
const suspiciousAttempts = new Map<string, { count: number; lastAttempt: number }>();

export function checkSuspiciousAttempts(userId: string): boolean {
  const now = Date.now();
  const userAttempts = suspiciousAttempts.get(userId);
  
  if (!userAttempts) {
    suspiciousAttempts.set(userId, { count: 1, lastAttempt: now });
    return true;
  }
  
  // Reset counter if more than 1 hour has passed
  if (now - userAttempts.lastAttempt > 3600000) {
    suspiciousAttempts.set(userId, { count: 1, lastAttempt: now });
    return true;
  }
  
  // Block if more than 5 suspicious attempts in the last hour
  if (userAttempts.count >= 5) {
    return false;
  }
  
  userAttempts.count++;
  userAttempts.lastAttempt = now;
  return true;
}

// Enhanced sanitization middleware with rate limiting
export function enhancedSanitizePromptInput(req: Request, res: Response, next: NextFunction) {
  const userId = req.user?.id;
  
  if (userId && !checkSuspiciousAttempts(userId)) {
    return res.status(429).json({
      error: 'Too many suspicious attempts. Please try again later.',
      code: 'SUSPICIOUS_ATTEMPTS_EXCEEDED'
    });
  }
  
  return sanitizePromptInput(req, res, next);
}
