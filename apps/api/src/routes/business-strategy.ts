import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { enhancedSanitizePromptInput } from '../middleware/sanitize';
import { prisma } from '../lib/prisma';
import { callGPT, processTemplate } from '../services/gpt5';
import { log } from '../lib/logger';

const router = Router();

// Validation schema
const businessStrategySchema = z.object({
  businessType: z.string().min(1, 'Business type is required'),
  targetAudience: z.string().min(1, 'Target audience is required'),
  mainGoals: z.array(z.string()).min(1, 'At least one goal is required'),
  platformPreferences: z.array(z.string()).min(1, 'At least one platform is required'),
});

interface ContentCalendar {
  week: number;
  theme: string;
  topics: string[];
  formats: string[];
  platforms: string[];
}

interface BusinessStrategyResponse {
  persona: string;
  contentCalendar: ContentCalendar[];
  recommendedAngles: string[];
  weeklyThemes: string[];
  callToActionIdeas: string[];
}

/**
 * POST /api/business-strategy
 * Generate AI-powered business strategy
 */
router.post('/', requireAuth, enhancedSanitizePromptInput, async (req: Request, res: Response) => {
  try {
    const requestData = businessStrategySchema.parse(req.body);
    const userId = req.user!.id;

    log.info('Generating business strategy', {
      reqId: req.headers['x-request-id'] as string || 'business-strategy',
      userId,
      businessType: requestData.businessType,
    });

    // Build prompt for GPT
    const prompt = `You are an expert marketing strategist. Generate a comprehensive business strategy for the following business:

Business Type: ${requestData.businessType}
Target Audience: ${requestData.targetAudience}
Main Goals: ${requestData.mainGoals.join(', ')}
Platform Preferences: ${requestData.platformPreferences.join(', ')}

Please provide a detailed strategy including:

1. AUDIENCE PERSONA: Create a detailed persona profile (demographics, psychographics, pain points, goals, preferred content types)

2. CONTENT CALENDAR: Generate a 4-week content calendar with:
   - Weekly theme
   - 3-5 content topics per week
   - Recommended formats (Reel, Story, Feed Post, Carousel, etc.)
   - Target platforms for each piece

3. RECOMMENDED ANGLES: List 5-7 video/content angles that would resonate with this audience (e.g., "Problem-Solution", "Behind the Scenes", "Educational", "Testimonial", "Curiosity Hook")

4. WEEKLY THEMES: Provide 4 weekly themes that align with the business goals

5. CALL-TO-ACTION IDEAS: Suggest 5-7 compelling CTAs tailored to the goals

Format your response as JSON with this structure:
{
  "persona": "detailed persona description (2-3 paragraphs)",
  "contentCalendar": [
    {
      "week": 1,
      "theme": "theme name",
      "topics": ["topic1", "topic2", "topic3"],
      "formats": ["Reel", "Feed Post"],
      "platforms": ["instagram", "facebook"]
    }
  ],
  "recommendedAngles": ["angle1", "angle2", ...],
  "weeklyThemes": ["theme1", "theme2", "theme3", "theme4"],
  "callToActionIdeas": ["cta1", "cta2", ...]
}`;

    // Call GPT
    const gptResponse = await callGPT({
      model: 'gpt-4o',
      prompt,
      maxTokens: 3000,
      temperature: 0.7,
      userId,
    });

    // Parse JSON response
    let strategy: BusinessStrategyResponse;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = gptResponse.content.match(/```json\s*([\s\S]*?)\s*```/) || 
                       gptResponse.content.match(/```\s*([\s\S]*?)\s*```/);
      const jsonContent = jsonMatch ? jsonMatch[1] : gptResponse.content;
      strategy = JSON.parse(jsonContent);
    } catch (parseError) {
      // If JSON parsing fails, try to extract structured data from text
      log.warn('Failed to parse GPT response as JSON, attempting text extraction', {
        reqId: req.headers['x-request-id'] as string || 'business-strategy',
        error: parseError instanceof Error ? parseError.message : 'Unknown error',
      });
      
      // Fallback: create a basic structure from text
      strategy = {
        persona: gptResponse.content.substring(0, 500),
        contentCalendar: [],
        recommendedAngles: [],
        weeklyThemes: [],
        callToActionIdeas: [],
      };
    }

    // Store strategy in database
    const savedStrategy = await prisma.businessStrategy.create({
      data: {
        userId,
        businessType: requestData.businessType,
        targetAudience: requestData.targetAudience,
        mainGoals: requestData.mainGoals,
        platformPreferences: requestData.platformPreferences,
        persona: strategy.persona,
        contentCalendar: strategy.contentCalendar as any,
        recommendedAngles: strategy.recommendedAngles,
        weeklyThemes: strategy.weeklyThemes,
        callToActionIdeas: strategy.callToActionIdeas,
      },
    });

    // Log action
    await prisma.actionLog.create({
      data: {
        campaignId: 'system', // System-level action
        actionType: 'business_strategy_generated',
        details: {
          userId,
          businessType: requestData.businessType,
          strategyId: savedStrategy.id,
        },
      },
    });

    res.json({
      success: true,
      data: {
        id: savedStrategy.id,
        ...strategy,
        createdAt: savedStrategy.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
        code: 'VALIDATION_ERROR',
      });
    }

    log.error('Business strategy generation error', error as Error, {
      reqId: req.headers['x-request-id'] as string || 'business-strategy',
      userId: req.user?.id,
    });

    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * GET /api/business-strategy
 * Get user's business strategies
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const strategies = await prisma.businessStrategy.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    res.json({
      success: true,
      data: strategies,
    });
  } catch (error) {
    log.error('Get business strategies error', error as Error, {
      reqId: req.headers['x-request-id'] as string || 'business-strategy',
      userId: req.user?.id,
    });

    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * GET /api/business-strategy/:id
 * Get specific business strategy
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const strategyId = req.params.id;

    const strategy = await prisma.businessStrategy.findFirst({
      where: {
        id: strategyId,
        userId,
      },
    });

    if (!strategy) {
      return res.status(404).json({
        error: 'Strategy not found',
        code: 'NOT_FOUND',
      });
    }

    res.json({
      success: true,
      data: strategy,
    });
  } catch (error) {
    log.error('Get business strategy error', error as Error, {
      reqId: req.headers['x-request-id'] as string || 'business-strategy',
      userId: req.user?.id,
    });

    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

export default router;


