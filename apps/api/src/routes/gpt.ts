import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { enhancedSanitizePromptInput, sanitizeFields } from '../middleware/sanitize';
import { 
  callGPT, 
  processTemplate, 
  getUserUsageStats, 
  getQuotaStatus, 
  getRateLimitStatus,
  PROMPT_TEMPLATES 
} from '../services/gpt5';
import { 
  contentIdeaPrompt, 
  adOutlinePrompt, 
  editInstructionsPrompt,
  socialMediaCaptionPrompt,
  emailSubjectPrompt 
} from '../services/prompts';

const router = Router();

// Validation schemas
const contentIdeasSchema = z.object({
  businessType: z.string().min(1, 'Business type is required'),
  platform: z.string().min(1, 'Platform is required'),
  tone: z.string().min(1, 'Tone is required'),
  cta: z.string().min(1, 'Call-to-action is required'),
  constraints: z.string().optional(),
  model: z.enum(['gpt-5-thinking-mini', 'gpt-4o-mini', 'gpt-4o']).default('gpt-5-thinking-mini'),
  maxTokens: z.number().int().min(100).max(4000).optional(),
});

const adCopySchema = z.object({
  businessType: z.string().min(1, 'Business type is required'),
  audience: z.string().min(1, 'Target audience is required'),
  product: z.string().min(1, 'Product/service is required'),
  benefits: z.string().min(1, 'Key benefits are required'),
  model: z.enum(['gpt-5-thinking-mini', 'gpt-4o-mini', 'gpt-4o']).default('gpt-5-thinking-mini'),
  maxTokens: z.number().int().min(100).max(4000).optional(),
});

const videoEditSchema = z.object({
  videoType: z.string().min(1, 'Video type is required'),
  duration: z.number().int().min(1, 'Duration must be positive'),
  style: z.string().min(1, 'Style is required'),
  keyMoments: z.string().min(1, 'Key moments are required'),
  brandGuidelines: z.string().optional(),
  model: z.enum(['gpt-5-thinking-mini', 'gpt-4o-mini', 'gpt-4o']).default('gpt-5-thinking-mini'),
  maxTokens: z.number().int().min(100).max(4000).optional(),
});

const customPromptSchema = z.object({
  prompt: z.string().min(10, 'Prompt must be at least 10 characters'),
  model: z.enum(['gpt-5-thinking-mini', 'gpt-4o-mini', 'gpt-4o']).default('gpt-5-thinking-mini'),
  maxTokens: z.number().int().min(100).max(4000).optional(),
  temperature: z.number().min(0).max(2).optional(),
});

/**
 * POST /api/gpt/content-ideas
 * Generate content ideas for social media
 */
router.post('/content-ideas', requireAuth, enhancedSanitizePromptInput, async (req: Request, res: Response) => {
  try {
    const { businessType, platform, tone, cta, constraints, model, maxTokens } = contentIdeasSchema.parse(req.body);

    // Use the new prompt template function
    const prompt = contentIdeaPrompt({
      business: businessType,
      platform,
      tone,
      industry: constraints,
      targetAudience: undefined,
      keyBenefits: undefined,
    });

    // Call GPT service
    const result = await callGPT({
      model,
      prompt,
      maxTokens,
      userId: req.user!.id,
    });

    // Parse JSON response
    let ideas;
    try {
      ideas = JSON.parse(result.content);
    } catch (parseError) {
      // If JSON parsing fails, return raw content
      ideas = { rawContent: result.content };
    }

    res.json({
      success: true,
      ideas,
      metadata: {
        model: result.model,
        tokensUsed: result.tokensUsed,
        estimatedCost: result.estimatedCost,
        fallbackUsed: result.fallbackUsed,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Content ideas error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/gpt/ad-copy
 * Generate ad copy using Sabri Suby structure
 */
router.post('/ad-copy', requireAuth, enhancedSanitizePromptInput, async (req: Request, res: Response) => {
  try {
    const { businessType, audience, product, benefits, model, maxTokens } = adCopySchema.parse(req.body);

    // Use the new prompt template function
    const prompt = adOutlinePrompt({
      business: businessType,
      product,
      targetAudience: audience,
      keyBenefits: benefits,
      uniqueValueProp: undefined,
      competitorDifferentiation: undefined,
    });

    // Call GPT service
    const result = await callGPT({
      model,
      prompt,
      maxTokens,
      userId: req.user!.id,
    });

    // Parse JSON response
    let adCopy;
    try {
      adCopy = JSON.parse(result.content);
    } catch (parseError) {
      // If JSON parsing fails, return raw content
      adCopy = { rawContent: result.content };
    }

    res.json({
      success: true,
      adCopy,
      metadata: {
        model: result.model,
        tokensUsed: result.tokensUsed,
        estimatedCost: result.estimatedCost,
        fallbackUsed: result.fallbackUsed,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Ad copy error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/gpt/video-edit-instructions
 * Generate video editing instructions for workers
 */
router.post('/video-edit-instructions', requireAuth, enhancedSanitizePromptInput, async (req: Request, res: Response) => {
  try {
    const { videoType, duration, style, keyMoments, brandGuidelines, model, maxTokens } = videoEditSchema.parse(req.body);

    // Use the new prompt template function
    const prompt = editInstructionsPrompt({
      videoType,
      duration,
      style,
      keyMoments,
      brandGuidelines,
      targetPlatform: undefined,
    });

    // Call GPT service
    const result = await callGPT({
      model,
      prompt,
      maxTokens,
      userId: req.user!.id,
    });

    // Parse JSON response
    let instructions;
    try {
      instructions = JSON.parse(result.content);
    } catch (parseError) {
      // If JSON parsing fails, return raw content
      instructions = { rawContent: result.content };
    }

    res.json({
      success: true,
      instructions,
      metadata: {
        model: result.model,
        tokensUsed: result.tokensUsed,
        estimatedCost: result.estimatedCost,
        fallbackUsed: result.fallbackUsed,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Video edit instructions error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/gpt/custom-prompt
 * Send custom prompt to GPT
 */
router.post('/custom-prompt', requireAuth, enhancedSanitizePromptInput, async (req: Request, res: Response) => {
  try {
    const { prompt, model, maxTokens, temperature } = customPromptSchema.parse(req.body);

    // Call GPT service
    const result = await callGPT({
      model,
      prompt,
      maxTokens,
      temperature,
      userId: req.user!.id,
    });

    res.json({
      success: true,
      content: result.content,
      metadata: {
        model: result.model,
        tokensUsed: result.tokensUsed,
        estimatedCost: result.estimatedCost,
        fallbackUsed: result.fallbackUsed,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Custom prompt error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/gpt/usage
 * Get user's GPT usage statistics
 */
router.get('/usage', requireAuth, async (req: Request, res: Response) => {
  try {
    const { model } = req.query;
    
    const usageStats = await getUserUsageStats(req.user!.id, model as string);
    
    res.json({
      success: true,
      usage: usageStats,
    });
  } catch (error) {
    console.error('Usage stats error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/gpt/quotas
 * Get user's quota and rate limit status
 */
router.get('/quotas', requireAuth, async (req: Request, res: Response) => {
  try {
    const { model } = req.query;
    const modelParam = model as string || 'gpt-5-thinking-mini';
    
    const [quotaStatus, rateLimitStatus] = await Promise.all([
      getQuotaStatus(req.user!.id, modelParam),
      getRateLimitStatus(req.user!.id, modelParam),
    ]);
    
    res.json({
      success: true,
      quota: quotaStatus,
      rateLimit: rateLimitStatus,
      model: modelParam,
    });
  } catch (error) {
    console.error('Quota status error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/gpt/templates
 * Get available prompt templates
 */
router.get('/templates', requireAuth, async (req: Request, res: Response) => {
  try {
    const templates = Object.entries(PROMPT_TEMPLATES).map(([key, template]) => ({
      key,
      name: template.name,
      description: template.description,
      estimatedTokens: template.estimatedTokens,
    }));
    
    res.json({
      success: true,
      templates,
    });
  } catch (error) {
    console.error('Templates error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/gpt/models
 * Get available models with their limits
 */
router.get('/models', requireAuth, async (req: Request, res: Response) => {
  try {
    const models = [
      {
        id: 'gpt-5-thinking-mini',
        name: 'GPT-5 Thinking Mini',
        description: 'Most advanced model with enhanced reasoning capabilities',
        monthlyQuota: 100000,
        rateLimit: 10,
        costPer1k: 0.002,
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: 'Fast and efficient model for most tasks',
        monthlyQuota: 500000,
        rateLimit: 50,
        costPer1k: 0.00015,
      },
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: 'High-quality model for complex tasks',
        monthlyQuota: 200000,
        rateLimit: 20,
        costPer1k: 0.005,
      },
    ];
    
    res.json({
      success: true,
      models,
    });
  } catch (error) {
    console.error('Models error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

export default router;
