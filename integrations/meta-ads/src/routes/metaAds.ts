import { Router } from 'express';
import { z } from 'zod';
import { createAdCampaign, testAdCampaign, getCampaignStatus } from '../services/metaAdsService.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Validation schemas
const createCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  budget: z.number().positive('Budget must be positive'),
  duration: z.number().positive('Duration must be positive'),
  platforms: z.array(z.string()).min(1, 'At least one platform is required'),
  content: z.object({
    caption: z.string(),
    mediaUrl: z.string().url('Invalid media URL'),
    aiScore: z.number().optional(),
    aiTips: z.array(z.string()).optional()
  })
});

const testCampaignSchema = z.object({
  campaignId: z.string().min(1, 'Campaign ID is required'),
  variants: z.array(z.object({
    name: z.string(),
    content: z.object({
      caption: z.string(),
      mediaUrl: z.string().url('Invalid media URL')
    })
  })).optional()
});

// POST /api/ads/create
router.post('/ads/create', async (req, res) => {
  try {
    const data = createCampaignSchema.parse(req.body);
    
    logger.info('Creating Meta ad campaign', { 
      name: data.name, 
      budget: data.budget,
      platforms: data.platforms 
    });

    const campaign = await createAdCampaign(data);
    
    res.status(201).json({
      success: true,
      campaign,
      message: 'Ad campaign created successfully'
    });

  } catch (error: any) {
    logger.error('Failed to create ad campaign:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create ad campaign'
    });
  }
});

// POST /api/ads/test
router.post('/ads/test', async (req, res) => {
  try {
    const data = testCampaignSchema.parse(req.body);
    
    logger.info('Testing Meta ad campaign', { campaignId: data.campaignId });

    const result = await testAdCampaign(data.campaignId, data.variants);
    
    res.json({
      success: true,
      result,
      message: 'Ad campaign test completed'
    });

  } catch (error: any) {
    logger.error('Failed to test ad campaign:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to test ad campaign'
    });
  }
});

// GET /api/ads/status/:campaignId
router.get('/ads/status/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    logger.info('Getting campaign status', { campaignId });

    const status = await getCampaignStatus(campaignId);
    
    res.json({
      success: true,
      status,
      message: 'Campaign status retrieved successfully'
    });

  } catch (error: any) {
    logger.error('Failed to get campaign status:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get campaign status'
    });
  }
});

export { router as metaAdsRouter };



