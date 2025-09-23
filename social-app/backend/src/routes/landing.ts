import { Router } from 'express';
import { z } from 'zod';
import { createLandingPage } from '../services/gohighlevelService.js';
import { schedulerDbService } from '../services/schedulerDbService.js';
import { notificationService } from '../services/notificationService.js';
import { CreateLandingRequest, CreateLandingResponse, GetLandingPagesResponse } from '../types/landing.js';
import { logger } from '../services/logger.js';

const router = Router();

const createLandingSchema = z.object({
  orgId: z.string().min(1, 'orgId required'),
  headline: z.string().min(1, 'headline required'),
  subtext: z.string().min(1, 'subtext required'),
  ctaText: z.string().min(1, 'ctaText required'),
  ctaUrl: z.string().url('ctaUrl must be a valid URL'),
});

// POST /api/landing/create
router.post('/create', async (req, res) => {
  try {
    // Validate input
    const request = createLandingSchema.parse(req.body);
    
    logger.info('Creating landing page', { 
      orgId: request.orgId, 
      headline: request.headline 
    });
    
    // Create landing page via GoHighLevel integration
    const goHighLevelResponse = await createLandingPage(request);
    
    if (!goHighLevelResponse.success) {
      throw new Error(goHighLevelResponse.error || 'Failed to create landing page in GoHighLevel');
    }
    
    logger.info('Landing page created in GoHighLevel', { 
      landingPageId: goHighLevelResponse.landingPageId,
      slug: goHighLevelResponse.slug 
    });
    
    // Store in scheduler DB
    const storedLandingPage = await schedulerDbService.storeLandingPage(request, goHighLevelResponse);
    
    logger.info('Landing page stored in database', { 
      landingPageId: storedLandingPage.id,
      orgId: request.orgId 
    });
    
    // Send notification
    await notificationService.notifyLandingPageCreated(
      request.orgId,
      storedLandingPage.id,
      request.headline
    );
    
    const response: CreateLandingResponse = {
      success: true,
      landingPageId: storedLandingPage.id,
      slug: storedLandingPage.slug,
      url: storedLandingPage.url,
      status: storedLandingPage.status,
    };

    res.json(response);

  } catch (error: any) {
    logger.error('Failed to create landing page', { 
      error: error.message, 
      body: req.body 
    });
    
    const response: CreateLandingResponse = {
      success: false,
      error: error.message || 'Failed to create landing page',
    };

    res.status(400).json(response);
  }
});

// GET /api/landing?orgId=...
router.get('/', async (req, res) => {
  try {
    const orgId = String(req.query.orgId || '');
    if (!orgId) {
      return res.status(400).json({ 
        success: false,
        landingPages: [],
        error: 'orgId required' 
      });
    }

    logger.info('Fetching landing pages', { orgId });
    const result = await schedulerDbService.getLandingPages(orgId);
    
    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);

  } catch (error: any) {
    logger.error('Failed to fetch landing pages', { 
      error: error.message, 
      query: req.query 
    });
    
    res.status(500).json({ 
      success: false,
      landingPages: [],
      error: error.message || 'Failed to fetch landing pages' 
    });
  }
});

export { router as landingRouter };
