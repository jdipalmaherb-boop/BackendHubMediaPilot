import { Router } from 'express';
import { z } from 'zod';
import { captureLead } from '../services/leadService.js';
import { logLeadCapture } from '../services/leadLogger.js';
import { notificationService } from '../services/notificationService.js';
import { schedulerDbService } from '../services/schedulerDbService.js';
import { LeadCaptureRequest, LeadCaptureResponse } from '../types/lead.js';
import { logger } from '../services/logger.js';

const router = Router();

const leadCaptureSchema = z.object({
  name: z.string().min(1, 'name required'),
  email: z.string().email('valid email required'),
  phone: z.string().optional(),
  landingPageId: z.string().min(1, 'landingPageId required'), // Changed from landingPageSlug to landingPageId
  source: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

// POST /api/lead/capture
router.post('/capture', async (req, res) => {
  const timestamp = new Date().toISOString();
  
  try {
    // Validate input
    const request = leadCaptureSchema.parse(req.body);
    
    logger.info('Capturing lead', { 
      email: request.email, 
      landingPageId: request.landingPageId 
    });
    
    // Capture lead via GoHighLevel integration
    const goHighLevelResponse = await captureLead(request);
    
    logger.info('Lead captured in GoHighLevel', { 
      leadId: goHighLevelResponse.id,
      contactId: goHighLevelResponse.contactId 
    });
    
    // Store lead in local database
    const storedLead = await schedulerDbService.storeLead(request, goHighLevelResponse);
    
    logger.info('Lead stored in database', { 
      leadId: storedLead.id,
      email: request.email 
    });
    
    // Log the capture for tracking
    await logLeadCapture(request, goHighLevelResponse);
    
    // Send notification
    await notificationService.notifyLeadCaptured(
      request.metadata?.orgId || 'unknown',
      goHighLevelResponse.id,
      request.name,
      request.source || 'social_post'
    );
    
    const response: LeadCaptureResponse = {
      success: true,
      leadId: goHighLevelResponse.id,
      status: goHighLevelResponse.status,
      timestamp,
      landingPageId: request.landingPageId,
      message: 'Lead captured successfully'
    };

    res.json(response);

  } catch (error: any) {
    logger.error('Failed to capture lead', { 
      error: error.message, 
      body: req.body 
    });
    
    // Log the error
    const request = req.body as LeadCaptureRequest;
    if (request) {
      await logLeadCapture(request, undefined, error.message);
    }
    
    const response: LeadCaptureResponse = {
      success: false,
      error: error.message || 'Failed to capture lead',
      timestamp,
    };

    res.status(400).json(response);
  }
});

export { router as leadRouter };
