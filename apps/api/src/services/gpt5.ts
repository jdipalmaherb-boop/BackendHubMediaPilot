import { OpenAI } from 'openai';
import { prisma } from '../lib/prisma';
import { env } from '../env';
import IORedis from 'ioredis';
import crypto from 'crypto';
import { metrics } from '../lib/metrics';
import { log } from '../lib/logger';

// Redis connection for rate limiting
const redis = new IORedis(env.REDIS_URL || 'redis://localhost:6379');

// OpenAI client
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export interface GPTRequest {
  model: 'gpt-5-thinking-mini' | 'gpt-4o-mini' | 'gpt-4o';
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  userId: string;
}

export interface GPTResponse {
  content: string;
  tokensUsed: number;
  estimatedCost: number;
  model: string;
  fallbackUsed: boolean;
}

export interface PromptTemplate {
  name: string;
  description: string;
  template: string;
  estimatedTokens: number;
}

// Prompt templates
export const PROMPT_TEMPLATES: Record<string, PromptTemplate> = {
  contentIdeas: {
    name: 'contentIdeas',
    description: 'Generate content ideas for social media',
    template: `Generate 5 creative content ideas for a {businessType} business on {platform}.

Business Type: {businessType}
Platform: {platform}
Tone: {tone}
Call-to-Action: {cta}
Constraints: {constraints}

For each idea, provide:
1. A catchy headline
2. Brief description (1-2 sentences)
3. Suggested visual elements
4. Engagement strategy

Format as JSON array with fields: headline, description, visualElements, engagementStrategy`,
    estimatedTokens: 800
  },
  adCopy: {
    name: 'adCopy',
    description: 'Generate ad copy using Sabri Suby structure',
    template: `Create compelling ad copy using the Sabri Suby structure for a {businessType} business.

Business Type: {businessType}
Target Audience: {audience}
Product/Service: {product}
Key Benefits: {benefits}

Structure:
1. HOOK: Attention-grabbing opening (15-20 words)
2. PROBLEM: Identify pain point (30-40 words)
3. SOLUTION: Present your offering (40-50 words)
4. PROOF: Social proof or credibility (20-30 words)
5. CTA: Clear call-to-action (10-15 words)

Format as JSON with fields: hook, problem, solution, proof, cta, totalWordCount`,
    estimatedTokens: 600
  },
  videoEditInstructions: {
    name: 'videoEditInstructions',
    description: 'Generate video editing instructions for workers',
    template: `Generate detailed video editing instructions for a {videoType} video.

Video Type: {videoType}
Duration: {duration} seconds
Style: {style}
Key Moments: {keyMoments}
Brand Guidelines: {brandGuidelines}

Provide:
1. Trim points (start/end timestamps)
2. Color grading suggestions
3. Caption timing recommendations
4. Audio adjustments
5. Visual effects suggestions

Format as JSON with fields: trimPoints, colorGrading, captionTiming, audioAdjustments, visualEffects`,
    estimatedTokens: 700
  }
};

// Rate limiting configuration
const RATE_LIMITS = {
  'gpt-5-thinking-mini': { requests: 10, window: 3600 }, // 10 requests per hour
  'gpt-4o-mini': { requests: 50, window: 3600 }, // 50 requests per hour
  'gpt-4o': { requests: 20, window: 3600 }, // 20 requests per hour
};

// Monthly token quotas per user
const MONTHLY_QUOTAS = {
  'gpt-5-thinking-mini': 100000, // 100k tokens
  'gpt-4o-mini': 500000, // 500k tokens
  'gpt-4o': 200000, // 200k tokens
};

// Token cost estimates (per 1k tokens)
const TOKEN_COSTS = {
  'gpt-5-thinking-mini': 0.002, // $0.002 per 1k tokens
  'gpt-4o-mini': 0.00015, // $0.00015 per 1k tokens
  'gpt-4o': 0.005, // $0.005 per 1k tokens
};

// Helper function to get rate limit key
function getRateLimitKey(userId: string, model: string): string {
  return `rate_limit:${userId}:${model}`;
}

// Helper function to get quota key
function getQuotaKey(userId: string, model: string): string {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return `quota:${userId}:${model}:${monthKey}`;
}

// Helper function to check rate limit
async function checkRateLimit(userId: string, model: string): Promise<boolean> {
  const key = getRateLimitKey(userId, model);
  const limit = RATE_LIMITS[model];
  
  if (!limit) return false;

  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, limit.window);
  }

  return current <= limit.requests;
}

// Helper function to check monthly quota
async function checkMonthlyQuota(userId: string, model: string, tokensToUse: number): Promise<boolean> {
  const key = getQuotaKey(userId, model);
  const quota = MONTHLY_QUOTAS[model];
  
  if (!quota) return false;

  const current = await redis.get(key);
  const used = current ? parseInt(current) : 0;

  return (used + tokensToUse) <= quota;
}

// Helper function to update monthly quota
async function updateMonthlyQuota(userId: string, model: string, tokensUsed: number): Promise<void> {
  const key = getQuotaKey(userId, model);
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const ttl = Math.floor((nextMonth.getTime() - now.getTime()) / 1000);

  await redis.incrby(key, tokensUsed);
  await redis.expire(key, ttl);
}

// Helper function to calculate estimated cost
function calculateCost(tokensUsed: number, model: string): number {
  const costPer1k = TOKEN_COSTS[model] || 0;
  return (tokensUsed / 1000) * costPer1k;
}

// Helper function to generate prompt hash
function generatePromptHash(prompt: string): string {
  return crypto.createHash('sha256').update(prompt).digest('hex').substring(0, 16);
}

// Main GPT service function
export async function callGPT(request: GPTRequest): Promise<GPTResponse> {
  const { model, prompt, maxTokens, temperature = 0.7, userId } = request;
  
  // Clamp max tokens to environment limit
  const clampedMaxTokens = Math.min(maxTokens || 1000, env.GPT_MAX_TOKENS || 4000);
  
  // Check rate limit
  const rateLimitOk = await checkRateLimit(userId, model);
  if (!rateLimitOk) {
    throw new Error(`Rate limit exceeded for model ${model}`);
  }

  // Check monthly quota
  const quotaOk = await checkMonthlyQuota(userId, model, clampedMaxTokens);
  if (!quotaOk) {
    // Try fallback model
    const fallbackModel = model === 'gpt-5-thinking-mini' ? 'gpt-4o-mini' : 'gpt-4o-mini';
    const fallbackQuotaOk = await checkMonthlyQuota(userId, fallbackModel, clampedMaxTokens);
    
    if (!fallbackQuotaOk) {
      throw new Error('Monthly quota exceeded for all models');
    }
    
    return await callGPT({ ...request, model: fallbackModel });
  }

  const startTime = Date.now();
  
  try {
    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: clampedMaxTokens,
      temperature,
    });

    const content = response.choices[0]?.message?.content || '';
    const tokensUsed = response.usage?.total_tokens || 0;
    const estimatedCost = calculateCost(tokensUsed, model);
    const duration = (Date.now() - startTime) / 1000;

    // Record GPT metrics
    metrics.recordGptTokens(model, 'general', tokensUsed, userId);
    metrics.recordGptRequest(model, 'success', 'general');
    metrics.recordGptDuration(model, duration, 'general');
    metrics.recordGptCost(model, Math.round(estimatedCost * 100), 'general'); // Convert to cents

    // Update monthly quota
    await updateMonthlyQuota(userId, model, tokensUsed);

    // Log usage to database
    await prisma.gptUsage.create({
      data: {
        userId,
        tokens: tokensUsed,
        costUsd: estimatedCost,
        meta: {
          model,
          promptHash: generatePromptHash(prompt),
          maxTokens: clampedMaxTokens,
          temperature,
          responseLength: content.length,
        },
      },
    });

    log.info(`GPT API call completed successfully`, {
      reqId: 'gpt-call',
      model,
      userId,
      tokensUsed,
      estimatedCost,
      duration,
    });

    return {
      content,
      tokensUsed,
      estimatedCost,
      model,
      fallbackUsed: false,
    };
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    
    // Record GPT failure metrics
    metrics.recordGptRequest(model, 'error', 'general');
    metrics.recordGptDuration(model, duration, 'general');
    
    log.error(`GPT API call failed:`, error as Error, {
      reqId: 'gpt-call',
      model,
      userId,
      duration,
      errorType: error.constructor.name,
    });
    console.error('GPT API error:', error);
    
    // Try fallback model on API error
    if (model !== 'gpt-4o-mini') {
      try {
        return await callGPT({ ...request, model: 'gpt-4o-mini' });
      } catch (fallbackError) {
        console.error('Fallback model also failed:', fallbackError);
      }
    }
    
    throw new Error(`GPT API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper function to process template with variables
export function processTemplate(templateName: string, variables: Record<string, string>): string {
  const template = PROMPT_TEMPLATES[templateName];
  if (!template) {
    throw new Error(`Unknown template: ${templateName}`);
  }

  let processedTemplate = template.template;
  
  // Replace variables in template
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    processedTemplate = processedTemplate.replace(new RegExp(placeholder, 'g'), value);
  }

  return processedTemplate;
}

// Helper function to get user usage stats
export async function getUserUsageStats(userId: string, model?: string) {
  const where: any = { userId };
  if (model) {
    where.meta = { path: ['model'], equals: model };
  }

  const usage = await prisma.gptUsage.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const totalTokens = usage.reduce((sum, record) => sum + record.tokens, 0);
  const totalCost = usage.reduce((sum, record) => sum + Number(record.costUsd), 0);

  return {
    totalTokens,
    totalCost,
    requestCount: usage.length,
    recentUsage: usage.slice(0, 10),
  };
}

// Helper function to get quota status
export async function getQuotaStatus(userId: string, model: string) {
  const key = getQuotaKey(userId, model);
  const current = await redis.get(key);
  const used = current ? parseInt(current) : 0;
  const quota = MONTHLY_QUOTAS[model] || 0;
  
  return {
    used,
    quota,
    remaining: Math.max(0, quota - used),
    percentage: quota > 0 ? (used / quota) * 100 : 0,
  };
}

// Helper function to get rate limit status
export async function getRateLimitStatus(userId: string, model: string) {
  const key = getRateLimitKey(userId, model);
  const current = await redis.get(key);
  const used = current ? parseInt(current) : 0;
  const limit = RATE_LIMITS[model] || { requests: 0, window: 3600 };
  
  return {
    used,
    limit: limit.requests,
    remaining: Math.max(0, limit.requests - used),
    window: limit.window,
  };
}
