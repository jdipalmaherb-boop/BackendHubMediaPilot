import express from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { PlatformManager } from '../platforms/PlatformManager.js';

const router = express.Router();
const platformManager = new PlatformManager();

// Validation schemas
const platformConfigSchema = z.object({
  platform: z.enum(['META', 'GOOGLE', 'TIKTOK', 'LINKEDIN', 'TWITTER']),
  accountId: z.string().min(1),
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  settings: z.object({
    apiVersion: z.string().optional(),
    baseUrl: z.string().url().optional()
  }).optional()
});

/**
 * Configure platform connection
 */
router.post('/configure', async (req, res) => {
  try {
    const validatedData = platformConfigSchema.parse(req.body);
    const orgId = req.user?.orgId;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    logger.info('Configuring platform connection', {
      platform: validatedData.platform,
      accountId: validatedData.accountId,
      orgId
    });

    await platformManager.configurePlatform(validatedData);

    res.json({
      success: true,
      message: 'Platform configured successfully'
    });

  } catch (error) {
    logger.error('Platform configuration failed', { error: error.message });
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Platform configuration failed'
    });
  }
});

/**
 * Get platform status
 */
router.get('/status/:platform', async (req, res) => {
  try {
    const { platform } = req.params;
    const orgId = req.user?.orgId;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    const status = await platformManager.getPlatformStatus(platform);

    res.json({
      success: true,
      platform,
      status
    });

  } catch (error) {
    logger.error('Failed to get platform status', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get platform status'
    });
  }
});

/**
 * Validate platform connection
 */
router.post('/validate/:platform', async (req, res) => {
  try {
    const { platform } = req.params;
    const orgId = req.user?.orgId;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    const isValid = await platformManager.validateConnection(platform);

    res.json({
      success: true,
      platform,
      valid: isValid
    });

  } catch (error) {
    logger.error('Platform validation failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Platform validation failed'
    });
  }
});

/**
 * Get available placements
 */
router.get('/placements/:platform', async (req, res) => {
  try {
    const { platform } = req.params;
    const orgId = req.user?.orgId;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    const placements = await platformManager.getAvailablePlacements(platform);

    res.json({
      success: true,
      platform,
      placements
    });

  } catch (error) {
    logger.error('Failed to get placements', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get placements'
    });
  }
});

/**
 * Get targeting options
 */
router.get('/targeting/:platform', async (req, res) => {
  try {
    const { platform } = req.params;
    const orgId = req.user?.orgId;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    const options = await platformManager.getTargetingOptions(platform);

    res.json({
      success: true,
      platform,
      options
    });

  } catch (error) {
    logger.error('Failed to get targeting options', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get targeting options'
    });
  }
});

export { router as platformRoutes };



