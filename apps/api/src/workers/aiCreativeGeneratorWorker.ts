import { Worker, Job } from 'bullmq';
import { prisma } from '../lib/prisma';
import { callGPT } from '../services/gpt5';
import { log } from '../lib/logger';
import { createS3Client } from '../lib/s3';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../env';

const s3Client = createS3Client();
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

interface AICreativeJobData {
  creativeId: string;
  baseCreativeId: string;
  concept: string;
  userId: string;
  variantCount?: number; // Number of variants to generate (default: 2-3)
}

interface CreativeVariant {
  hook: string;
  headline: string;
  text: string;
  cta: string;
  angle: string;
}

/**
 * Generate creative variants using GPT
 */
async function generateCreativeVariants(
  baseCreative: any,
  concept: string,
  variantCount: number = 3
): Promise<CreativeVariant[]> {
  const prompt = `You are an expert ad copywriter. Generate ${variantCount} creative variants for an ad campaign.

Base Creative:
- Headline: ${baseCreative.headline || 'N/A'}
- Text: ${baseCreative.text || 'N/A'}
- CTA: ${baseCreative.cta || 'N/A'}

Concept/Brief: ${concept}

For each variant, create:
1. A different hook (attention-grabbing opening, 10-15 words)
2. A new headline (compelling, 5-10 words)
3. Revised text (benefit-focused, 30-50 words)
4. A strong CTA (action-oriented, 5-10 words)
5. The angle used (e.g., "Problem-Solution", "Curiosity", "Social Proof", "Benefit-Driven")

Format as JSON array:
[
  {
    "hook": "hook text",
    "headline": "headline text",
    "text": "body text",
    "cta": "call to action",
    "angle": "angle name"
  }
]`;

  try {
    const gptResponse = await callGPT({
      model: 'gpt-4o',
      prompt,
      maxTokens: 2000,
      temperature: 0.8, // Higher temperature for more creative variation
      userId: baseCreative.ownerId,
    });

    // Parse JSON response
    let variants: CreativeVariant[];
    try {
      const jsonMatch = gptResponse.content.match(/```json\s*([\s\S]*?)\s*```/) ||
                       gptResponse.content.match(/```\s*([\s\S]*?)\s*```/);
      const jsonContent = jsonMatch ? jsonMatch[1] : gptResponse.content;
      variants = JSON.parse(jsonContent);
    } catch (parseError) {
      log.warn('Failed to parse GPT response as JSON', {
        error: parseError instanceof Error ? parseError.message : 'Unknown error',
      });
      // Fallback: create a single variant from the response
      variants = [{
        hook: gptResponse.content.substring(0, 50),
        headline: baseCreative.headline || 'New Creative',
        text: gptResponse.content.substring(0, 200),
        cta: baseCreative.cta || 'Learn More',
        angle: 'AI-Generated',
      }];
    }

    return variants.slice(0, variantCount);
  } catch (error) {
    log.error('Failed to generate creative variants', error as Error);
    throw error;
  }
}

/**
 * Process AI creative generation job
 */
async function processAICreativeJob(job: Job<AICreativeJobData>): Promise<void> {
  const { creativeId, baseCreativeId, concept, userId, variantCount = 3 } = job.data;

  try {
    await job.updateProgress(10);

    // Get base creative
    const baseCreative = await prisma.adCreative.findUnique({
      where: { id: baseCreativeId },
      include: {
        campaign: {
          select: {
            objective: true,
            audience: true,
          },
        },
      },
    });

    if (!baseCreative) {
      throw new Error(`Base creative ${baseCreativeId} not found`);
    }

    await job.updateProgress(20);

    // Generate variants using GPT
    const variants = await generateCreativeVariants(baseCreative, concept, variantCount);
    await job.updateProgress(60);

    // Create new creative records for each variant
    const createdCreatives = [];
    for (const variant of variants) {
      const newCreative = await prisma.adCreative.create({
        data: {
          campaignId: baseCreative.campaignId,
          ownerId: userId,
          originalUrl: baseCreative.originalUrl, // Use same asset
          processedUrl: baseCreative.processedUrl,
          thumbnailUrl: baseCreative.thumbnailUrl,
          text: variant.text,
          headline: variant.headline,
          cta: variant.cta,
          platform: baseCreative.platform,
          postType: baseCreative.postType,
          exportStyle: baseCreative.exportStyle,
          creativeType: baseCreative.creativeType,
          aspectRatio: baseCreative.aspectRatio,
          width: baseCreative.width,
          height: baseCreative.height,
          duration: baseCreative.duration,
          isAIGenerated: true,
          aiTag: `variant-${variant.angle.toLowerCase().replace(/\s+/g, '-')}`,
          meta: {
            baseCreativeId,
            hook: variant.hook,
            angle: variant.angle,
            generatedAt: new Date().toISOString(),
            concept,
          },
        },
      });
      createdCreatives.push(newCreative);
    }

    await job.updateProgress(90);

    // Log action
    await prisma.actionLog.create({
      data: {
        campaignId: baseCreative.campaignId,
        actionType: 'ai_creative_variants_generated',
        details: {
          baseCreativeId,
          variantsGenerated: createdCreatives.length,
          concept,
        },
      },
    });

    await job.updateProgress(100);

    log.info('AI creative variants generated successfully', {
      creativeId,
      baseCreativeId,
      variantsCount: createdCreatives.length,
    });
  } catch (error) {
    log.error('AI creative generation job failed', error as Error, {
      creativeId,
      baseCreativeId,
    });
    throw error;
  }
}

/**
 * Create AI creative generator worker
 */
export function createAICreativeGeneratorWorker() {
  // Note: This would typically use a queue, but for simplicity we'll use a direct worker
  // In production, you'd set up a BullMQ queue for this
  return {
    processJob: processAICreativeJob,
  };
}

/**
 * Queue an AI creative generation job
 */
export async function queueAICreativeGeneration(
  baseCreativeId: string,
  concept: string,
  userId: string,
  variantCount: number = 3
): Promise<string> {
  // In a real implementation, this would add a job to a queue
  // For now, we'll process it directly
  const creative = await prisma.adCreative.findUnique({
    where: { id: baseCreativeId },
    select: { id: true },
  });

  if (!creative) {
    throw new Error(`Creative ${baseCreativeId} not found`);
  }

  // Process directly (in production, use a queue)
  const jobData: AICreativeJobData = {
    creativeId: creative.id,
    baseCreativeId,
    concept,
    userId,
    variantCount,
  };

  // Create a mock job object
  const mockJob = {
    data: jobData,
    updateProgress: async (progress: number) => {
      log.info('AI creative generation progress', { progress, baseCreativeId });
    },
  } as Job<AICreativeJobData>;

  await processAICreativeJob(mockJob);
  return creative.id;
}


