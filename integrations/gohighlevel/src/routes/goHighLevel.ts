import { Router } from 'express';
import { z } from 'zod';
import { createLandingPage, captureLead, getLeads } from '../services/goHighLevelService.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Validation schemas
const createLandingPageSchema = z.object({
  headline: z.string().min(1, 'Headline is required'),
  subtext: z.string().min(1, 'Subtext is required'),
  ctaText: z.string().min(1, 'CTA text is required'),
  ctaUrl: z.string().url('Invalid CTA URL'),
  orgId: z.string().min(1, 'Organization ID is required')
});

const captureLeadSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  landingPageId: z.string().min(1, 'Landing page ID is required'),
  source: z.string().optional().default('social_post')
});

// POST /api/landing-pages/create
router.post('/landing-pages/create', async (req, res) => {
  try {
    const data = createLandingPageSchema.parse(req.body);
    
    logger.info('Creating GoHighLevel landing page', { 
      headline: data.headline,
      orgId: data.orgId
    });

    const landingPage = await createLandingPage(data);
    
    res.status(201).json({
      success: true,
      landingPage,
      message: 'Landing page created successfully'
    });

  } catch (error: any) {
    logger.error('Failed to create landing page:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create landing page'
    });
  }
});

// POST /api/leads
router.post('/leads', async (req, res) => {
  try {
    const data = captureLeadSchema.parse(req.body);
    
    logger.info('Capturing lead in GoHighLevel', { 
      email: data.email,
      landingPageId: data.landingPageId
    });

    const lead = await captureLead(data);
    
    res.status(201).json({
      success: true,
      lead,
      message: 'Lead captured successfully'
    });

  } catch (error: any) {
    logger.error('Failed to capture lead:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to capture lead'
    });
  }
});

// GET /api/leads
router.get('/leads', async (req, res) => {
  try {
    const { orgId, limit = '50' } = req.query;
    
    if (!orgId) {
      return res.status(400).json({
        success: false,
        error: 'Organization ID is required'
      });
    }

    logger.info('Getting leads from GoHighLevel', { 
      orgId,
      limit: parseInt(limit as string)
    });

    const leads = await getLeads(orgId as string, parseInt(limit as string));
    
    res.json({
      success: true,
      leads,
      message: 'Leads retrieved successfully'
    });

  } catch (error: any) {
    logger.error('Failed to get leads:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get leads'
    });
  }
});

export { router as goHighLevelRouter };



