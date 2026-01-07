import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../env';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

/**
 * JWT Authentication Middleware
 * Parses Authorization header Bearer tokens and verifies JWT_SECRET
 * Attaches user info to req.user if valid, allows unauthenticated routes to continue
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without authentication
      return next();
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      return next();
    }

    // Verify JWT token
    const decoded = jwt.verify(token, env.JWT_SECRET) as any;
    
    if (!decoded || !decoded.userId || !decoded.email) {
      return next();
    }

    // Attach user info to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role || 'BusinessOwner'
    };

    next();
  } catch (error) {
    // Invalid token, continue without authentication
    next();
  }
};

/**
 * Require authentication middleware
 * Use this for protected routes that require authentication
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'UNAUTHORIZED'
    });
  }
  next();
};

/**
 * Require specific role middleware
 */
export const requireRole = (roles: string | string[]) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        code: 'FORBIDDEN'
      });
    }

    next();
  };
};
