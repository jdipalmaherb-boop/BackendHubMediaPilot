import { prisma } from '../lib/prisma';
import { callGPT } from '../services/gpt5';
import { MockAdapter } from '../ad/mockAdapter';
import { MetaAdapter } from '../ad/metaAdapter';
import { TikTokAdapter } from '../ad/tiktokAdapter';
import { YouTubeAdapter } from '../ad/youtubeAdapter';
import { AdPlatform, CampaignSpec, AdPlatformConfig } from '../ad/adapter';

export interface CampaignCreateRequest {
  businessId: string;
  objective: 'traffic' | 'conversions' | 'awareness' | 'engagement';
  creativeKeys: string[];
  budgetTotalCents: number;
  platforms: ('meta' | 'tiktok' | 'youtube')[];
  audience: {
    ageMin?: number;
    ageMax?: number;
    genders?: string[];
    locations?: string[];
    interests?: string[];
    behaviors?: string[];
    customAudiences?: string[];
  };
  testGroups?: number;
  testDurationDays?: number;
  autoOptimize?: boolean;
}

export interface CampaignResponse {
  campaign: {
    id: string;
    name: string;
    objective: string;
    budgetTotalCents: number;
    platforms: string[];
    status: string;
    testGroups: number;
    testDurationDays: number;
    autoOptimize: boolean;
    createdAt: Date;
  };
  variants: Array<{
    id: string;
    variantName: string;
    creativeKey: string;
    platform: string;
    budgetCents: number;
    testGroup: string;
    rolloutDay: number;
    status: string;
  }>;
  budgetRecommendation: {
    suggestedBudgetCents: number;
    dailyBudgetCents: number;
    platformAllocation: Record<string, number>;
    reasoning: string;
  };
}

export interface BudgetRecommendation {
  suggestedBudgetCents: number;
  dailyBudgetCents: number;
  platformAllocation: Record<string, number>;
  reasoning: string;
  riskLevel: 'low' | 'medium' | 'high';
  expectedMetrics: {
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    cpc: number;
    cpm: number;
  };
}

export class CampaignEngine {
  private platformAdapters: Map<string, AdPlatform> = new Map();
  private userSubscriptionLimits: Map<string, any> = new Map();

  constructor() {
    this.initializePlatformAdapters();
  }

  private initializePlatformAdapters(): void {
    // Initialize mock adapter for development/testing
    const mockConfig: AdPlatformConfig = {
      platform: 'mock',
      enabled: true,
      sandboxMode: true,
      credentials: {},
      settings: {
        defaultBudgetCents: 1000,
        maxBudgetCents: 1000000,
      },
    };
    this.platformAdapters.set('mock', new MockAdapter(mockConfig));

    // Initialize real adapters (would be configured with actual credentials)
    // Meta adapter
    const metaConfig: AdPlatformConfig = {
      platform: 'meta',
      enabled: true,
      sandboxMode: false,
      credentials: {
        accessToken: process.env.META_ACCESS_TOKEN,
        accountId: process.env.META_ACCOUNT_ID,
        pageId: process.env.META_PAGE_ID,
      },
      settings: {
        defaultBudgetCents: 1000,
        maxBudgetCents: 1000000,
      },
    };
    this.platformAdapters.set('meta', new MetaAdapter(metaConfig));

    // TikTok adapter
    const tiktokConfig: AdPlatformConfig = {
      platform: 'tiktok',
      enabled: true,
      sandboxMode: true, // Enable sandbox mode for TikTok
      credentials: {
        accessToken: process.env.TIKTOK_ACCESS_TOKEN,
        advertiserId: process.env.TIKTOK_ADVERTISER_ID,
      },
      settings: {
        defaultBudgetCents: 2000,
        maxBudgetCents: 1000000,
      },
    };
    this.platformAdapters.set('tiktok', new TikTokAdapter(tiktokConfig));

    // YouTube adapter
    const youtubeConfig: AdPlatformConfig = {
      platform: 'youtube',
      enabled: true,
      sandboxMode: true, // Enable sandbox mode for YouTube
      credentials: {
        accessToken: process.env.YOUTUBE_ACCESS_TOKEN,
        customerId: process.env.YOUTUBE_CUSTOMER_ID,
        developerToken: process.env.YOUTUBE_DEVELOPER_TOKEN,
      },
      settings: {
        defaultBudgetCents: 1000,
        maxBudgetCents: 1000000,
      },
    };
    this.platformAdapters.set('youtube', new YouTubeAdapter(youtubeConfig));
  }

  async createCampaign(userId: string, request: CampaignCreateRequest): Promise<CampaignResponse> {
    // Validate user subscription limits
    await this.validateUserLimits(userId, request);

    // Generate campaign name using GPT-5
    const campaignName = await this.generateCampaignName(request);

    // Generate budget recommendation
    const budgetRecommendation = await this.generateBudgetRecommendation(userId, request);

    // Create campaign record
    const campaign = await prisma.campaign.create({
      data: {
        userId,
        businessId: request.businessId,
        name: campaignName,
        objective: request.objective,
        budgetTotalCents: request.budgetTotalCents,
        platforms: request.platforms,
        audience: request.audience,
        status: 'DRAFT',
        testGroups: request.testGroups || 3,
        testDurationDays: request.testDurationDays || 7,
        autoOptimize: request.autoOptimize !== false,
      },
    });

    // Generate ad variants using GPT-5
    const variants = await this.generateAdVariants(campaign.id, request);

    // Create variant records
    const createdVariants = await Promise.all(
      variants.map(variant =>
        prisma.adVariant.create({
          data: {
            campaignId: campaign.id,
            variantName: variant.variantName,
            creativeKey: variant.creativeKey,
            platform: variant.platform,
            budgetCents: variant.budgetCents,
            targeting: variant.targeting,
            testGroup: variant.testGroup,
            rolloutDay: variant.rolloutDay,
            status: 'PENDING',
          },
        })
      )
    );

    // Generate expected metrics for each variant
    await this.generateExpectedMetrics(campaign.id, createdVariants);

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        objective: campaign.objective,
        budgetTotalCents: campaign.budgetTotalCents,
        platforms: campaign.platforms,
        status: campaign.status,
        testGroups: campaign.testGroups,
        testDurationDays: campaign.testDurationDays,
        autoOptimize: campaign.autoOptimize,
        createdAt: campaign.createdAt,
      },
      variants: createdVariants.map(variant => ({
        id: variant.id,
        variantName: variant.variantName,
        creativeKey: variant.creativeKey,
        platform: variant.platform,
        budgetCents: variant.budgetCents,
        testGroup: variant.testGroup,
        rolloutDay: variant.rolloutDay,
        status: variant.status,
      })),
      budgetRecommendation,
    };
  }

  private async generateCampaignName(request: CampaignCreateRequest): Promise<string> {
    const prompt = `Generate a compelling campaign name for a ${request.objective} campaign.

Campaign Details:
- Objective: ${request.objective}
- Platforms: ${request.platforms.join(', ')}
- Target Audience: ${JSON.stringify(request.audience)}
- Budget: $${(request.budgetTotalCents / 100).toFixed(2)}

Generate a professional, memorable campaign name that reflects the objective and target audience. Keep it under 50 characters.

Format your response as JSON:
{
  "name": "Campaign Name Here"
}`;

    try {
      const result = await callGPT({
        model: 'gpt-5-thinking-mini',
        prompt,
        userId: 'system', // Use system user for campaign generation
        maxTokens: 200,
      });

      const parsed = JSON.parse(result.content);
      return parsed.name || `Campaign ${Date.now()}`;
    } catch (error) {
      console.error('Failed to generate campaign name:', error);
      return `Campaign ${Date.now()}`;
    }
  }

  private async generateAdVariants(campaignId: string, request: CampaignCreateRequest) {
    const prompt = `Generate A/B test variants for a ${request.objective} campaign.

Campaign Details:
- Objective: ${request.objective}
- Platforms: ${request.platforms.join(', ')}
- Creative Assets: ${request.creativeKeys.join(', ')}
- Total Budget: $${(request.budgetTotalCents / 100).toFixed(2)}
- Test Groups: ${request.testGroups || 3}
- Target Audience: ${JSON.stringify(request.audience)}

Create ${request.testGroups || 3} test variants (A, B, C) with:
1. Different creative-to-platform mappings
2. Budget allocation across platforms
3. Platform-specific targeting variations
4. Rollout schedule (staggered over ${request.testDurationDays || 7} days)

Format your response as JSON:
{
  "variants": [
    {
      "variantName": "A",
      "creativeKey": "creative1.jpg",
      "platform": "meta",
      "budgetCents": 10000,
      "targeting": { /* platform-specific targeting */ },
      "testGroup": "A",
      "rolloutDay": 0
    }
  ]
}`;

    try {
      const result = await callGPT({
        model: 'gpt-5-thinking-mini',
        prompt,
        userId: 'system',
        maxTokens: 1000,
      });

      const parsed = JSON.parse(result.content);
      return parsed.variants || [];
    } catch (error) {
      console.error('Failed to generate ad variants:', error);
      // Fallback to simple variant generation
      return this.generateFallbackVariants(request);
    }
  }

  private generateFallbackVariants(request: CampaignCreateRequest) {
    const variants = [];
    const budgetPerVariant = Math.floor(request.budgetTotalCents / (request.testGroups || 3));
    const budgetPerPlatform = Math.floor(budgetPerVariant / request.platforms.length);

    for (let i = 0; i < (request.testGroups || 3); i++) {
      const variantName = String.fromCharCode(65 + i); // A, B, C
      
      request.platforms.forEach((platform, platformIndex) => {
        const creativeKey = request.creativeKeys[i % request.creativeKeys.length];
        const rolloutDay = Math.floor(i * (request.testDurationDays || 7) / (request.testGroups || 3));

        variants.push({
          variantName: `${variantName}-${platform}`,
          creativeKey,
          platform,
          budgetCents: budgetPerPlatform,
          targeting: this.generatePlatformTargeting(platform, request.audience),
          testGroup: variantName,
          rolloutDay,
        });
      });
    }

    return variants;
  }

  private generatePlatformTargeting(platform: string, audience: any) {
    const baseTargeting = {
      ageMin: audience.ageMin || 18,
      ageMax: audience.ageMax || 65,
      genders: audience.genders || ['all'],
      locations: audience.locations || ['US'],
      interests: audience.interests || [],
    };

    switch (platform) {
      case 'meta':
        return {
          ...baseTargeting,
          devicePlatforms: ['mobile', 'desktop'],
          placements: ['feed', 'stories'],
        };
      case 'tiktok':
        return {
          ...baseTargeting,
          deviceTypes: ['mobile'],
          osTypes: ['ios', 'android'],
        };
      case 'youtube':
        return {
          ...baseTargeting,
          deviceTypes: ['mobile', 'desktop'],
          placements: ['video'],
        };
      default:
        return baseTargeting;
    }
  }

  private async generateExpectedMetrics(campaignId: string, variants: any[]) {
    const expectedMetrics = [];

    for (const variant of variants) {
      // Generate expected metrics based on platform and budget
      const platformMetrics = this.calculateExpectedMetrics(variant.platform, variant.budgetCents);
      
      for (let day = 0; day < 30; day++) { // Generate 30 days of expected metrics
        expectedMetrics.push({
          campaignId,
          variantId: variant.id,
          platform: variant.platform,
          date: new Date(Date.now() + day * 24 * 60 * 60 * 1000),
          metricType: 'EXPECTED',
          impressions: Math.floor(platformMetrics.impressions * (1 + Math.random() * 0.2)),
          clicks: Math.floor(platformMetrics.clicks * (1 + Math.random() * 0.2)),
          conversions: Math.floor(platformMetrics.conversions * (1 + Math.random() * 0.2)),
          spendCents: Math.floor(platformMetrics.spendCents * (1 + Math.random() * 0.1)),
          ctr: platformMetrics.ctr * (1 + Math.random() * 0.1),
          cpc: platformMetrics.cpc * (1 + Math.random() * 0.1),
          cpm: platformMetrics.cpm * (1 + Math.random() * 0.1),
          cpl: platformMetrics.cpl * (1 + Math.random() * 0.1),
          roas: platformMetrics.roas * (1 + Math.random() * 0.1),
        });
      }
    }

    await prisma.campaignMetrics.createMany({
      data: expectedMetrics,
    });
  }

  private calculateExpectedMetrics(platform: string, budgetCents: number) {
    const dailyBudgetCents = budgetCents / 30;
    
    // Platform-specific metrics (based on industry averages)
    const platformMetrics = {
      meta: {
        cpm: 8.0, // $8 CPM
        ctr: 0.02, // 2% CTR
        conversionRate: 0.05, // 5% conversion rate
      },
      tiktok: {
        cpm: 6.0, // $6 CPM
        ctr: 0.03, // 3% CTR
        conversionRate: 0.04, // 4% conversion rate
      },
      youtube: {
        cpm: 10.0, // $10 CPM
        ctr: 0.015, // 1.5% CTR
        conversionRate: 0.06, // 6% conversion rate
      },
    };

    const metrics = platformMetrics[platform] || platformMetrics.meta;
    
    const impressions = Math.floor((dailyBudgetCents / 100) / (metrics.cpm / 1000));
    const clicks = Math.floor(impressions * metrics.ctr);
    const conversions = Math.floor(clicks * metrics.conversionRate);
    const cpc = dailyBudgetCents / Math.max(1, clicks);
    const cpl = dailyBudgetCents / Math.max(1, conversions);
    const roas = conversions * 50 / dailyBudgetCents; // Assume $50 value per conversion

    return {
      impressions,
      clicks,
      conversions,
      spendCents: dailyBudgetCents,
      ctr: metrics.ctr * 100,
      cpc: cpc / 100,
      cpm: metrics.cpm,
      cpl: cpl / 100,
      roas,
    };
  }

  async generateBudgetRecommendation(userId: string, request: CampaignCreateRequest): Promise<BudgetRecommendation> {
    const prompt = `Generate a budget recommendation for a ${request.objective} campaign.

Campaign Details:
- Objective: ${request.objective}
- Platforms: ${request.platforms.join(', ')}
- Target Audience: ${JSON.stringify(request.audience)}
- Requested Budget: $${(request.budgetTotalCents / 100).toFixed(2)}

Consider:
1. Platform-specific minimum budgets
2. Audience size and competition
3. Campaign objective requirements
4. Industry benchmarks for ${request.objective} campaigns
5. Risk level based on budget size

Format your response as JSON:
{
  "suggestedBudgetCents": 50000,
  "dailyBudgetCents": 1667,
  "platformAllocation": {
    "meta": 0.4,
    "tiktok": 0.3,
    "youtube": 0.3
  },
  "reasoning": "Explanation of recommendation",
  "riskLevel": "low",
  "expectedMetrics": {
    "impressions": 10000,
    "clicks": 200,
    "conversions": 10,
    "ctr": 2.0,
    "cpc": 0.83,
    "cpm": 8.33
  }
}`;

    try {
      const result = await callGPT({
        model: 'gpt-5-thinking-mini',
        prompt,
        userId: 'system',
        maxTokens: 500,
      });

      const parsed = JSON.parse(result.content);
      return {
        suggestedBudgetCents: parsed.suggestedBudgetCents || request.budgetTotalCents,
        dailyBudgetCents: parsed.dailyBudgetCents || Math.floor(request.budgetTotalCents / 30),
        platformAllocation: parsed.platformAllocation || this.generateDefaultPlatformAllocation(request.platforms),
        reasoning: parsed.reasoning || 'Budget recommendation based on industry benchmarks',
        riskLevel: parsed.riskLevel || 'medium',
        expectedMetrics: parsed.expectedMetrics || this.calculateExpectedMetrics('meta', request.budgetTotalCents),
      };
    } catch (error) {
      console.error('Failed to generate budget recommendation:', error);
      return this.generateFallbackBudgetRecommendation(request);
    }
  }

  private generateDefaultPlatformAllocation(platforms: string[]) {
    const allocation: Record<string, number> = {};
    const equalShare = 1 / platforms.length;
    
    platforms.forEach(platform => {
      allocation[platform] = equalShare;
    });
    
    return allocation;
  }

  private generateFallbackBudgetRecommendation(request: CampaignCreateRequest): BudgetRecommendation {
    const suggestedBudgetCents = Math.max(request.budgetTotalCents, 10000); // Minimum $100
    const dailyBudgetCents = Math.floor(suggestedBudgetCents / 30);
    
    return {
      suggestedBudgetCents,
      dailyBudgetCents,
      platformAllocation: this.generateDefaultPlatformAllocation(request.platforms),
      reasoning: 'Conservative budget recommendation based on platform minimums',
      riskLevel: 'low',
      expectedMetrics: this.calculateExpectedMetrics('meta', suggestedBudgetCents),
    };
  }

  private async validateUserLimits(userId: string, request: CampaignCreateRequest): Promise<void> {
    // Get user subscription info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscriptions: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check subscription limits
    const activeSubscription = user.subscriptions.find(sub => sub.status === 'active');
    
    if (!activeSubscription) {
      // Free tier limits
      if (request.budgetTotalCents > 50000) { // $500 max
        throw new Error('Budget exceeds free tier limit of $500');
      }
      if (request.platforms.length > 1) {
        throw new Error('Free tier limited to 1 platform');
      }
    } else {
      // Paid tier limits based on subscription
      const subscriptionLimits = this.getSubscriptionLimits(activeSubscription.status);
      
      if (request.budgetTotalCents > subscriptionLimits.maxBudgetCents) {
        throw new Error(`Budget exceeds ${activeSubscription.status} tier limit of $${subscriptionLimits.maxBudgetCents / 100}`);
      }
    }

    // Check monthly spending limits
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const monthlySpend = await prisma.campaignMetrics.aggregate({
      where: {
        campaign: { userId },
        date: { gte: currentMonth },
        metricType: 'ACTUAL',
      },
      _sum: { spendCents: true },
    });

    const totalSpentCents = monthlySpend._sum.spendCents || 0;
    const monthlyLimitCents = activeSubscription ? 1000000 : 100000; // $10k for paid, $1k for free

    if (totalSpentCents + request.budgetTotalCents > monthlyLimitCents) {
      throw new Error(`Campaign would exceed monthly spending limit of $${monthlyLimitCents / 100}`);
    }
  }

  private getSubscriptionLimits(subscriptionStatus: string) {
    switch (subscriptionStatus) {
      case 'basic':
        return { maxBudgetCents: 100000 }; // $1,000
      case 'pro':
        return { maxBudgetCents: 500000 }; // $5,000
      case 'enterprise':
        return { maxBudgetCents: 5000000 }; // $50,000
      default:
        return { maxBudgetCents: 50000 }; // $500
    }
  }

  async launchCampaign(campaignId: string): Promise<void> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { variants: true },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status !== 'DRAFT') {
      throw new Error('Campaign must be in DRAFT status to launch');
    }

    // Update campaign status
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { 
        status: 'ACTIVE',
        startedAt: new Date(),
      },
    });

    // Launch variants based on rollout schedule
    for (const variant of campaign.variants) {
      if (variant.rolloutDay === 0) {
        await this.launchVariant(variant.id);
      }
    }
  }

  private async launchVariant(variantId: string): Promise<void> {
    const variant = await prisma.adVariant.findUnique({
      where: { id: variantId },
      include: { campaign: true },
    });

    if (!variant) {
      throw new Error('Variant not found');
    }

    const adapter = this.platformAdapters.get(variant.platform);
    if (!adapter) {
      throw new Error(`No adapter found for platform: ${variant.platform}`);
    }

    try {
      const campaignSpec: CampaignSpec = {
        title: `${variant.campaign.name} - ${variant.variantName}`,
        creativeKey: variant.creativeKey,
        budgetCents: variant.budgetCents,
        targeting: variant.targeting,
        metadata: {
          campaignId: variant.campaignId,
          variantId: variant.id,
          testGroup: variant.testGroup,
        },
      };

      const result = await adapter.createCampaign(campaignSpec);

      // Update variant with external ID
      await prisma.adVariant.update({
        where: { id: variantId },
        data: {
          externalId: result.id,
          status: 'ACTIVE',
        },
      });
    } catch (error) {
      console.error(`Failed to launch variant ${variantId}:`, error);
      
      await prisma.adVariant.update({
        where: { id: variantId },
        data: { status: 'FAILED' },
      });
    }
  }

  async optimizeCampaign(campaignId: string): Promise<void> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { variants: true },
    });

    if (!campaign || !campaign.autoOptimize) {
      return;
    }

    // Get actual metrics for all variants
    const variantMetrics = await Promise.all(
      campaign.variants.map(async (variant) => {
        const metrics = await prisma.campaignMetrics.findMany({
          where: {
            variantId: variant.id,
            metricType: 'ACTUAL',
            date: {
              gte: new Date(Date.now() - campaign.testDurationDays * 24 * 60 * 60 * 1000),
            },
          },
        });

        const totalSpend = metrics.reduce((sum, m) => sum + m.spendCents, 0);
        const totalConversions = metrics.reduce((sum, m) => sum + m.conversions, 0);
        const cpl = totalSpend / Math.max(1, totalConversions);

        return {
          variantId: variant.id,
          variantName: variant.variantName,
          testGroup: variant.testGroup,
          cpl,
          totalSpend,
          totalConversions,
        };
      })
    );

    // Find best performing variant by CPL
    const bestVariant = variantMetrics.reduce((best, current) => 
      current.cpl < best.cpl ? current : best
    );

    // Pause losing variants and scale up winner
    for (const variant of campaign.variants) {
      if (variant.testGroup !== bestVariant.testGroup) {
        await this.pauseVariant(variant.id);
      } else {
        await this.scaleUpVariant(variant.id, 1.5); // Scale up by 50%
      }
    }
  }

  private async pauseVariant(variantId: string): Promise<void> {
    const variant = await prisma.adVariant.findUnique({
      where: { id: variantId },
    });

    if (!variant || !variant.externalId) {
      return;
    }

    const adapter = this.platformAdapters.get(variant.platform);
    if (!adapter) {
      return;
    }

    try {
      await adapter.pauseCampaign(variant.externalId);
      
      await prisma.adVariant.update({
        where: { id: variantId },
        data: { status: 'PAUSED' },
      });
    } catch (error) {
      console.error(`Failed to pause variant ${variantId}:`, error);
    }
  }

  private async scaleUpVariant(variantId: string, scaleFactor: number): Promise<void> {
    const variant = await prisma.adVariant.findUnique({
      where: { id: variantId },
    });

    if (!variant || !variant.externalId) {
      return;
    }

    const adapter = this.platformAdapters.get(variant.platform);
    if (!adapter) {
      return;
    }

    try {
      const newBudgetCents = Math.floor(variant.budgetCents * scaleFactor);
      
      await adapter.updateCampaign(variant.externalId, {
        budgetCents: newBudgetCents,
      });

      await prisma.adVariant.update({
        where: { id: variantId },
        data: { budgetCents: newBudgetCents },
      });
    } catch (error) {
      console.error(`Failed to scale up variant ${variantId}:`, error);
    }
  }
}
