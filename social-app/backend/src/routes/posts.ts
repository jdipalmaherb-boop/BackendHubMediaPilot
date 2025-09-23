import { Router } from 'express';
import { z } from 'zod';
import { schedulerDbService } from '../services/schedulerDbService.js';
import { logger } from '../services/logger.js';

const router = Router();

// Validation schemas
const savePostSchema = z.object({
  fileUrl: z.string().url('fileUrl must be a valid URL'),
  caption: z.string().min(1, 'caption is required'),
  platforms: z.array(z.string()).min(1, 'at least one platform is required'),
  scheduledDate: z.string().optional(),
  orgId: z.string().min(1, 'orgId is required'),
});

const getPostsSchema = z.object({
  orgId: z.string().min(1, 'orgId is required'),
});

// POST /api/posts/save - Save a draft post
router.post('/save', async (req, res) => {
  try {
    // Validate request body
    const validationResult = savePostSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationResult.error.errors
      });
    }

    const { fileUrl, caption, platforms, scheduledDate, orgId } = validationResult.data;

    logger.info('Saving draft post', { 
      orgId, 
      platforms, 
      hasScheduledDate: !!scheduledDate 
    });

    // Save the draft post
    const result = await schedulerDbService.saveDraftPost({
      fileUrl,
      caption,
      platforms,
      scheduledDate,
      orgId
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.status(201).json(result);

  } catch (error: any) {
    logger.error('Error saving draft post', { 
      error: error.message, 
      body: req.body 
    });

    res.status(500).json({
      success: false,
      draftId: '',
      message: 'Internal server error',
      error: error.message
    });
  }
});

// GET /api/posts - Get posts for an organization
router.get('/', async (req, res) => {
  try {
    // Validate query parameters
    const validationResult = getPostsSchema.safeParse(req.query);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        posts: [],
        error: 'Validation failed',
        details: validationResult.error.errors
      });
    }

    const { orgId } = validationResult.data;

    logger.info('Fetching posts for organization', { orgId });

    // Get posts from scheduler database
    const result = await schedulerDbService.getPosts(orgId);

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);

  } catch (error: any) {
    logger.error('Error fetching posts', { 
      error: error.message, 
      query: req.query 
    });

    res.status(500).json({
      success: false,
      posts: [],
      error: 'Internal server error'
    });
  }
});

// GET /api/posts/drafts - Get only draft posts for an organization
router.get('/drafts', async (req, res) => {
  try {
    // Validate query parameters
    const validationResult = getPostsSchema.safeParse(req.query);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        posts: [],
        error: 'Validation failed',
        details: validationResult.error.errors
      });
    }

    const { orgId } = validationResult.data;

    logger.info('Fetching draft posts for organization', { orgId });

    // Get all posts and filter for drafts
    const result = await schedulerDbService.getPosts(orgId);

    if (!result.success) {
      return res.status(500).json(result);
    }

    // Filter for draft posts
    const draftPosts = result.posts.filter(post => 
      post.status === 'DRAFT' || post.status === 'PENDING'
    );

    res.json({
      success: true,
      posts: draftPosts
    });

  } catch (error: any) {
    logger.error('Error fetching draft posts', { 
      error: error.message, 
      query: req.query 
    });

    res.status(500).json({
      success: false,
      posts: [],
      error: 'Internal server error'
    });
  }
});

export { router as postsRouter };



