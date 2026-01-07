import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { env } from '../env';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').optional()
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

// Helper function to generate tokens
const generateTokens = (userId: string, email: string, role: string) => {
  const accessToken = jwt.sign(
    { userId, email, role },
    env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { userId, email, role },
    env.JWT_REFRESH_SECRET,
    { expiresIn: '30d' }
  );

  return { accessToken, refreshToken };
};

// Helper function to set refresh token cookie
const setRefreshTokenCookie = (res: Response, refreshToken: string) => {
  res.cookie('rft', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  });
};

// Helper function to clear refresh token cookie
const clearRefreshTokenCookie = (res: Response) => {
  res.clearCookie('rft', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
};

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists with this email',
        code: 'USER_EXISTS'
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name || null,
        role: 'BusinessOwner'
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    });

    // TODO: Send verification email token (see C3)
    // For now, we'll skip email verification

    res.status(201).json({
      message: 'User registered successfully',
      user
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/auth/login
 * Login user and return access token with refresh token cookie
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(
      user.id,
      user.email,
      user.role
    );

    // Hash refresh token for storage
    const refreshTokenHash = await bcrypt.hash(refreshToken, 12);

    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt
      }
    });

    // Set refresh token cookie
    setRefreshTokenCookie(res, refreshToken);

    res.json({
      accessToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token from cookie
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.rft;

    if (!refreshToken) {
      return res.status(401).json({
        error: 'Refresh token not provided',
        code: 'NO_REFRESH_TOKEN'
      });
    }

    // Verify refresh token
    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    } catch (error) {
      return res.status(401).json({
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    if (!decoded || !decoded.userId) {
      return res.status(401).json({
        error: 'Invalid refresh token payload',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    // Find refresh token in database
    const refreshTokens = await prisma.refreshToken.findMany({
      where: {
        userId: decoded.userId,
        revoked: false,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    // Check if any stored token matches
    let validToken = null;
    for (const tokenRecord of refreshTokens) {
      const isMatch = await bcrypt.compare(refreshToken, tokenRecord.tokenHash);
      if (isMatch) {
        validToken = tokenRecord;
        break;
      }
    }

    if (!validToken) {
      return res.status(401).json({
        error: 'Refresh token not found or expired',
        code: 'REFRESH_TOKEN_NOT_FOUND'
      });
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true
      }
    });

    if (!user) {
      return res.status(401).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      user.id,
      user.email,
      user.role
    );

    // Rotate refresh token: revoke old, create new
    await prisma.$transaction(async (tx) => {
      // Revoke old token
      await tx.refreshToken.update({
        where: { id: validToken.id },
        data: { revoked: true }
      });

      // Create new refresh token
      const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 12);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

      await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: newRefreshTokenHash,
          expiresAt
        }
      });
    });

    // Set new refresh token cookie
    setRefreshTokenCookie(res, newRefreshToken);

    res.json({
      accessToken,
      expiresIn: 15 * 60 // 15 minutes in seconds
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user and revoke refresh token
 */
router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.rft;

    if (refreshToken) {
      // Find and revoke refresh token
      const refreshTokens = await prisma.refreshToken.findMany({
        where: {
          userId: req.user!.id,
          revoked: false
        }
      });

      // Check if any stored token matches and revoke it
      for (const tokenRecord of refreshTokens) {
        const isMatch = await bcrypt.compare(refreshToken, tokenRecord.tokenHash);
        if (isMatch) {
          await prisma.refreshToken.update({
            where: { id: tokenRecord.id },
            data: { revoked: true }
          });
          break;
        }
      }
    }

    // Clear refresh token cookie
    clearRefreshTokenCookie(res);

    res.json({
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

export default router;
