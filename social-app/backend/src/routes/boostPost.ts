import { Router } from 'express';
import { z } from 'zod';
import { fetchPost } from '../services/postService.js';
import { createAdCampaign, testAdCampaign } from '../services/adsService.js';
import { BoostLogger } from '../services/logger.js';
import { notificationService } from '../services/notificationService.js';
import { schedulerDbService } from '../services/schedulerDbService.js';
import { BoostPostRequest, BoostPostResponse } from '../types.js';

const router = Router();

const boostPostSchema = z.object({
  postId: z.string().min(1, 'postId required'),
  budget: z.number().positive('budget must be positive'),
  duration: z.number().positive('duration must be positive'),
  platforms: z.array(z.string()).min(1, 'at least one platform required'),
});

// POST /api/ads/boost-post
router.post('/boost-post', async (req, res) => {
  const logger = new BoostLogger();
  
  try {
    // Validate input
    const { postId, budget, duration, platforms } = boostPostSchema.parse(req.body);
    logger.log('validation', 'success', 'Request validated', { postId, budget, duration, platforms });

    // Look up draft post by postId from database
    logger.log('fetch_post', 'success', 'Looking up post in database', { postId });
    const postsResult = await schedulerDbService.getPosts(''); // We need to get all posts and find by ID
    if (!postsResult.success) {
      throw new Error('Failed to fetch posts from database');
    }
    
    const post = postsResult.posts.find(p => p.id === postId);
    if (!post) {
      throw new Error(`Post with ID ${postId} not found`);
    }
    
    logger.log('fetch_post', 'success', 'Post found in database', { 
      postId: post.id,
      orgId: post.orgId,
      status: post.status,
      platforms: post.platforms
    });

    // Create enhanced post data for ad campaign
    const postData = {
      id: post.id,
      orgId: post.orgId,
      content: post.content,
      platforms: platforms, // Use the platforms from the request
      scheduledAt: post.scheduledAt,
      status: post.status,
      assetId: post.assetId,
      // AI enhancement fields (if available)
      finalCaption: post.content, // Use the post content as caption
      editedAssetUrl: null, // Will be populated if available
      aiScore: null,
      aiTips: null
    };

    // Create ad campaign with Meta Ads integration
    logger.log('create_campaign', 'success', 'Creating ad campaign with Meta Ads', { budget, duration, platforms });
    const campaign = await createAdCampaign(postData, budget, duration);
    logger.log('create_campaign', 'success', 'Campaign created', { campaignId: campaign.id });

    // Test the campaign
    logger.log('test_campaign', 'success', 'Testing ad variants', { campaignId: campaign.id });
    const testResult = await testAdCampaign(campaign.id);
    logger.log('test_campaign', 'success', 'Campaign tested', { status: testResult.status });

    // Log result in database (update post status or create ad campaign record)
    await schedulerDbService.updatePostStatus(postId, 'SCHEDULED');
    logger.log('database', 'success', 'Post status updated to SCHEDULED', { postId });

    // Send notification
    await notificationService.notifyBoostPostCreated(
      post.orgId,
      postId,
      campaign.id
    );

    const response: BoostPostResponse = {
      success: true,
      campaignId: campaign.id,
      status: testResult.status,
      logs: logger.getLogs(),
    };

    res.json(response);

  } catch (error: any) {
    logger.log('boost_post', 'error', error.message || 'Unknown error', { error: error.toString() });
    
    const response: BoostPostResponse = {
      success: false,
      error: error.message || 'Failed to boost post',
      logs: logger.getLogs(),
    };

    res.status(400).json(response);
  }
});

export { router as boostPostRouter };
