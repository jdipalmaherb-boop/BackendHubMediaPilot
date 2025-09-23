import express from 'express';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * Platform webhook handler
 */
router.post('/platform/:platform', async (req, res) => {
  try {
    const { platform } = req.params;
    const webhookData = req.body;

    logger.info('Received platform webhook', {
      platform,
      eventType: webhookData.event_type || 'unknown',
      timestamp: new Date().toISOString()
    });

    // Process webhook based on platform
    switch (platform) {
      case 'meta':
        await processMetaWebhook(webhookData);
        break;
      case 'google':
        await processGoogleWebhook(webhookData);
        break;
      case 'tiktok':
        await processTikTokWebhook(webhookData);
        break;
      default:
        logger.warn('Unknown platform webhook', { platform });
    }

    res.json({
      success: true,
      message: 'Webhook processed successfully'
    });

  } catch (error) {
    logger.error('Webhook processing failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Webhook processing failed'
    });
  }
});

/**
 * Process Meta webhook
 */
async function processMetaWebhook(data: any): Promise<void> {
  try {
    logger.info('Processing Meta webhook', { data });
    
    // Handle different Meta webhook events
    switch (data.event_type) {
      case 'campaign_updated':
        await handleCampaignUpdate(data);
        break;
      case 'ad_insights':
        await handleAdInsights(data);
        break;
      case 'account_insights':
        await handleAccountInsights(data);
        break;
      default:
        logger.warn('Unknown Meta webhook event', { eventType: data.event_type });
    }

  } catch (error) {
    logger.error('Meta webhook processing failed', { error: error.message });
    throw error;
  }
}

/**
 * Process Google webhook
 */
async function processGoogleWebhook(data: any): Promise<void> {
  try {
    logger.info('Processing Google webhook', { data });
    
    // Handle different Google webhook events
    switch (data.event_type) {
      case 'campaign_updated':
        await handleCampaignUpdate(data);
        break;
      case 'ad_performance':
        await handleAdPerformance(data);
        break;
      default:
        logger.warn('Unknown Google webhook event', { eventType: data.event_type });
    }

  } catch (error) {
    logger.error('Google webhook processing failed', { error: error.message });
    throw error;
  }
}

/**
 * Process TikTok webhook
 */
async function processTikTokWebhook(data: any): Promise<void> {
  try {
    logger.info('Processing TikTok webhook', { data });
    
    // Handle different TikTok webhook events
    switch (data.event_type) {
      case 'campaign_updated':
        await handleCampaignUpdate(data);
        break;
      case 'ad_insights':
        await handleAdInsights(data);
        break;
      default:
        logger.warn('Unknown TikTok webhook event', { eventType: data.event_type });
    }

  } catch (error) {
    logger.error('TikTok webhook processing failed', { error: error.message });
    throw error;
  }
}

/**
 * Handle campaign update webhook
 */
async function handleCampaignUpdate(data: any): Promise<void> {
  try {
    logger.info('Handling campaign update', { campaignId: data.campaign_id });
    
    // Update campaign in database
    // Trigger automation if needed
    // Send notifications

  } catch (error) {
    logger.error('Campaign update handling failed', { error: error.message });
    throw error;
  }
}

/**
 * Handle ad insights webhook
 */
async function handleAdInsights(data: any): Promise<void> {
  try {
    logger.info('Handling ad insights', { campaignId: data.campaign_id });
    
    // Store performance data
    // Update AI learning models
    // Trigger optimization if needed

  } catch (error) {
    logger.error('Ad insights handling failed', { error: error.message });
    throw error;
  }
}

/**
 * Handle account insights webhook
 */
async function handleAccountInsights(data: any): Promise<void> {
  try {
    logger.info('Handling account insights', { accountId: data.account_id });
    
    // Store account-level performance data
    // Update organization analytics

  } catch (error) {
    logger.error('Account insights handling failed', { error: error.message });
    throw error;
  }
}

/**
 * Handle ad performance webhook
 */
async function handleAdPerformance(data: any): Promise<void> {
  try {
    logger.info('Handling ad performance', { adId: data.ad_id });
    
    // Store ad performance data
    // Update creative performance tracking

  } catch (error) {
    logger.error('Ad performance handling failed', { error: error.message });
    throw error;
  }
}

export { router as webhookRoutes };



