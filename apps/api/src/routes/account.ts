import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { emailService, EmailTemplates } from '../services/email';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Validation schemas
const requestVerificationSchema = z.object({
  email: z.string().email('Invalid email format')
});

const requestPasswordResetSchema = z.object({
  email: z.string().email('Invalid email format')
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters')
});

// Helper function to generate secure token
const generateSecureToken = (): string => {
  return uuidv4();
};

// Helper function to create verification URL
const createVerificationUrl = (token: string): string => {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${baseUrl}/verify?token=${token}`;
};

// Helper function to create password reset URL
const createPasswordResetUrl = (token: string): string => {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${baseUrl}/reset-password?token=${token}`;
};

/**
 * POST /api/account/request-verification
 * Request email verification for a user
 */
router.post('/request-verification', async (req: Request, res: Response) => {
  try {
    const { email } = requestVerificationSchema.parse(req.body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Check if already verified
    if (user.verifiedAt) {
      return res.status(400).json({
        error: 'Email already verified',
        code: 'ALREADY_VERIFIED'
      });
    }

    // Generate verification token
    const token = generateSecureToken();
    const tokenHash = await bcrypt.hash(token, 12);

    // Set expiration (24 hours)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Create verification record
    await prisma.emailVerification.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt
      }
    });

    // Send verification email
    const verificationUrl = createVerificationUrl(token);
    const emailTemplate = EmailTemplates.verificationEmail(email, verificationUrl);
    
    const emailSent = await emailService.sendEmail(emailTemplate);
    
    if (!emailSent) {
      console.error('Failed to send verification email to:', email);
      return res.status(500).json({
        error: 'Failed to send verification email',
        code: 'EMAIL_SEND_FAILED'
      });
    }

    res.json({
      message: 'Verification email sent successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Request verification error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/account/verify
 * Verify email with token
 */
router.get('/verify', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        error: 'Verification token is required',
        code: 'TOKEN_REQUIRED'
      });
    }

    // Find verification record
    const verificationRecords = await prisma.emailVerification.findMany({
      where: {
        used: false,
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        user: true
      }
    });

    // Check if any token matches
    let validVerification = null;
    for (const record of verificationRecords) {
      const isMatch = await bcrypt.compare(token, record.tokenHash);
      if (isMatch) {
        validVerification = record;
        break;
      }
    }

    if (!validVerification) {
      return res.status(400).json({
        error: 'Invalid or expired verification token',
        code: 'INVALID_TOKEN'
      });
    }

    // Mark verification as used and update user
    await prisma.$transaction(async (tx) => {
      await tx.emailVerification.update({
        where: { id: validVerification.id },
        data: { used: true }
      });

      await tx.user.update({
        where: { id: validVerification.userId },
        data: { verifiedAt: new Date() }
      });
    });

    res.json({
      message: 'Email verified successfully',
      user: {
        id: validVerification.user.id,
        email: validVerification.user.email,
        verifiedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/account/request-password-reset
 * Request password reset for a user
 */
router.post('/request-password-reset', async (req: Request, res: Response) => {
  try {
    const { email } = requestPasswordResetSchema.parse(req.body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({
        message: 'If an account with that email exists, a password reset link has been sent'
      });
    }

    // Generate reset token
    const token = generateSecureToken();
    const tokenHash = await bcrypt.hash(token, 12);

    // Set expiration (1 hour)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Create password reset record
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt
      }
    });

    // Send password reset email
    const resetUrl = createPasswordResetUrl(token);
    const emailTemplate = EmailTemplates.passwordResetEmail(email, resetUrl);
    
    const emailSent = await emailService.sendEmail(emailTemplate);
    
    if (!emailSent) {
      console.error('Failed to send password reset email to:', email);
      return res.status(500).json({
        error: 'Failed to send password reset email',
        code: 'EMAIL_SEND_FAILED'
      });
    }

    res.json({
      message: 'If an account with that email exists, a password reset link has been sent'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Request password reset error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/account/reset-password
 * Reset password with token
 */
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);

    // Find password reset record
    const resetRecords = await prisma.passwordReset.findMany({
      where: {
        used: false,
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        user: true
      }
    });

    // Check if any token matches
    let validReset = null;
    for (const record of resetRecords) {
      const isMatch = await bcrypt.compare(token, record.tokenHash);
      if (isMatch) {
        validReset = record;
        break;
      }
    }

    if (!validReset) {
      return res.status(400).json({
        error: 'Invalid or expired reset token',
        code: 'INVALID_TOKEN'
      });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password and revoke all refresh tokens for security
    await prisma.$transaction(async (tx) => {
      // Mark reset token as used
      await tx.passwordReset.update({
        where: { id: validReset.id },
        data: { used: true }
      });

      // Update user password
      await tx.user.update({
        where: { id: validReset.userId },
        data: { passwordHash }
      });

      // Revoke all refresh tokens for security
      await tx.refreshToken.updateMany({
        where: { userId: validReset.userId },
        data: { revoked: true }
      });
    });

    res.json({
      message: 'Password reset successfully. Please log in with your new password.'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Reset password error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/account/verify-status
 * Check if current user's email is verified
 */
router.get('/verify-status', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        verifiedAt: true
      }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({
      verified: !!user.verifiedAt,
      verifiedAt: user.verifiedAt
    });
  } catch (error) {
    console.error('Verify status error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

export default router;
