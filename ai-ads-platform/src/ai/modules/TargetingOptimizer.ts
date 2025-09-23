import OpenAI from 'openai';
import { z } from 'zod';
import { logger } from '../../utils/logger.js';
import { LearningDataService } from '../services/LearningDataService.js';

interface TargetingRequest {
  product: string;
  targetAudience: string;
  platform: 'META' | 'GOOGLE' | 'TIKTOK' | 'LINKEDIN' | 'TWITTER';
  objective: 'AWARENESS' | 'TRAFFIC' | 'ENGAGEMENT' | 'LEADS' | 'SALES' | 'APP_INSTALLS' | 'VIDEO_VIEWS';
  budget: number;
  duration: number; // days
  demographics?: Demographics;
  interests?: string[];
  behaviors?: string[];
  competitorAnalysis?: any[];
  marketResearch?: any[];
}

interface Demographics {
  ageMin?: number;
  ageMax?: number;
  gender?: 'MALE' | 'FEMALE' | 'ALL';
  locations?: string[];
  languages?: string[];
  education?: string[];
  income?: string[];
  relationshipStatus?: string[];
}

interface TargetingStrategy {
  id: string;
  name: string;
  platform: string;
  audiences: AudienceSegment[];
  placements: PlacementStrategy[];
  schedule: ScheduleStrategy;
  bidStrategy: BidStrategy;
  budgetAllocation: BudgetAllocation;
  confidence: number;
  expectedPerformance: PerformancePrediction;
  testingPlan: TestingPlan;
}

interface AudienceSegment {
  id: string;
  name: string;
  type: 'CORE' | 'LOOKALIKE' | 'CUSTOM' | 'RETARGETING' | 'INTEREST' | 'BEHAVIORAL';
  demographics: Demographics;
  interests: string[];
  behaviors: string[];
  customAudience?: any;
  lookalikeSettings?: LookalikeSettings;
  size: number;
  quality: number;
  priority: number;
}

interface LookalikeSettings {
  sourceAudience: string;
  percentage: number; // 1-10%
  country: string;
}

interface PlacementStrategy {
  platform: string;
  placements: string[];
  exclusions: string[];
  optimization: string;
  priority: number;
}

interface ScheduleStrategy {
  timezone: string;
  days: number[]; // 0-6 (Sunday-Saturday)
  hours: number[]; // 0-23
  frequency: 'CONTINUOUS' | 'PULSED' | 'BURST';
  seasonalAdjustments?: any[];
}

interface BidStrategy {
  type: 'MANUAL' | 'TARGET_CPA' | 'TARGET_ROAS' | 'MAXIMIZE_CONVERSIONS' | 'MAXIMIZE_CLICKS' | 'LOWEST_COST';
  amount?: number;
  target?: number;
  adjustments: BidAdjustment[];
}

interface BidAdjustment {
  criteria: string;
  adjustment: number; // percentage
  reason: string;
}

interface BudgetAllocation {
  total: number;
  audiences: { [audienceId: string]: number };
  placements: { [placement: string]: number };
  timeframes: { [timeframe: string]: number };
}

interface PerformancePrediction {
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
  confidence: number;
}

interface TestingPlan {
  audiences: string[];
  creatives: string[];
  placements: string[];
  schedules: string[];
  duration: number;
  successMetrics: string[];
}

export class TargetingOptimizer {
  private openai: OpenAI;
  private learningService: LearningDataService;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.learningService = new LearningDataService();
  }

  /**
   * Generate comprehensive targeting strategy using AI
   */
  async generateTargetingStrategy(request: TargetingRequest): Promise<TargetingStrategy> {
    try {
      logger.info('Generating targeting strategy', { 
        product: request.product, 
        platform: request.platform,
        objective: request.objective 
      });

      // Get historical performance data
      const historicalData = await this.learningService.getTargetingPerformanceData({
        platform: request.platform,
        objective: request.objective,
        targetAudience: request.targetAudience
      });

      // Get market research data
      const marketData = await this.getMarketResearchData(request);

      // Generate audience segments
      const audiences = await this.generateAudienceSegments(request, historicalData, marketData);

      // Generate placement strategy
      const placements = await this.generatePlacementStrategy(request, historicalData);

      // Generate schedule strategy
      const schedule = await this.generateScheduleStrategy(request, historicalData);

      // Generate bid strategy
      const bidStrategy = await this.generateBidStrategy(request, historicalData);

      // Generate budget allocation
      const budgetAllocation = await this.generateBudgetAllocation(request, audiences, placements);

      // Generate performance prediction
      const performancePrediction = await this.generatePerformancePrediction(
        request, audiences, placements, historicalData
      );

      // Generate testing plan
      const testingPlan = await this.generateTestingPlan(audiences, request);

      const strategy: TargetingStrategy = {
        id: `strategy_${Date.now()}`,
        name: `${request.product} - ${request.platform} Strategy`,
        platform: request.platform,
        audiences,
        placements,
        schedule,
        bidStrategy,
        budgetAllocation,
        confidence: this.calculateStrategyConfidence(audiences, historicalData),
        expectedPerformance: performancePrediction,
        testingPlan
      };

      logger.info('Generated targeting strategy', { 
        strategyId: strategy.id,
        audienceCount: audiences.length,
        confidence: strategy.confidence
      });

      return strategy;

    } catch (error) {
      logger.error('Failed to generate targeting strategy', { error: error.message });
      throw new Error(`Targeting strategy generation failed: ${error.message}`);
    }
  }

  /**
   * Generate audience segments using AI
   */
  private async generateAudienceSegments(
    request: TargetingRequest,
    historicalData: any[],
    marketData: any
  ): Promise<AudienceSegment[]> {
    const prompt = this.buildAudienceGenerationPrompt(request, historicalData, marketData);
    
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a world-class audience targeting specialist for ${request.platform} ads. 
          Create highly targeted audience segments that maximize conversions and ROI.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No audience segments generated');
    }

    return this.parseAudienceSegments(content);
  }

  /**
   * Generate placement strategy
   */
  private async generatePlacementStrategy(
    request: TargetingRequest,
    historicalData: any[]
  ): Promise<PlacementStrategy[]> {
    const platformPlacements = this.getPlatformPlacements(request.platform);
    const optimalPlacements = this.analyzeOptimalPlacements(historicalData, platformPlacements);

    return optimalPlacements.map(placement => ({
      platform: request.platform,
      placements: [placement.name],
      exclusions: placement.exclusions || [],
      optimization: placement.optimization || 'AUTOMATIC',
      priority: placement.priority || 1
    }));
  }

  /**
   * Generate schedule strategy
   */
  private async generateScheduleStrategy(
    request: TargetingRequest,
    historicalData: any[]
  ): Promise<ScheduleStrategy> {
    const optimalTimes = this.analyzeOptimalTimes(historicalData, request.targetAudience);
    
    return {
      timezone: 'UTC',
      days: optimalTimes.days,
      hours: optimalTimes.hours,
      frequency: this.determineFrequency(request.budget, request.duration),
      seasonalAdjustments: this.getSeasonalAdjustments(request.product)
    };
  }

  /**
   * Generate bid strategy
   */
  private async generateBidStrategy(
    request: TargetingRequest,
    historicalData: any[]
  ): Promise<BidStrategy> {
    const optimalBidType = this.determineOptimalBidType(request.objective, historicalData);
    const bidAmount = this.calculateOptimalBid(request.budget, historicalData);
    const adjustments = this.generateBidAdjustments(request, historicalData);

    return {
      type: optimalBidType,
      amount: bidAmount,
      target: this.calculateTargetValue(request.objective, historicalData),
      adjustments
    };
  }

  /**
   * Generate budget allocation
   */
  private async generateBudgetAllocation(
    request: TargetingRequest,
    audiences: AudienceSegment[],
    placements: PlacementStrategy[]
  ): Promise<BudgetAllocation> {
    const totalBudget = request.budget;
    
    // Allocate budget based on audience quality and historical performance
    const audienceAllocation: { [key: string]: number } = {};
    const placementAllocation: { [key: string]: number } = {};
    const timeframeAllocation: { [key: string]: number } = {};

    // Allocate to audiences based on quality scores
    audiences.forEach(audience => {
      const allocation = (audience.quality / audiences.reduce((sum, a) => sum + a.quality, 0)) * totalBudget * 0.7;
      audienceAllocation[audience.id] = allocation;
    });

    // Allocate to placements
    placements.forEach(placement => {
      const allocation = (placement.priority / placements.reduce((sum, p) => sum + p.priority, 0)) * totalBudget * 0.2;
      placementAllocation[placement.placements[0]] = allocation;
    });

    // Allocate to timeframes (daily distribution)
    timeframeAllocation['daily'] = totalBudget * 0.1;

    return {
      total: totalBudget,
      audiences: audienceAllocation,
      placements: placementAllocation,
      timeframes: timeframeAllocation
    };
  }

  /**
   * Generate performance prediction
   */
  private async generatePerformancePrediction(
    request: TargetingRequest,
    audiences: AudienceSegment[],
    placements: PlacementStrategy[],
    historicalData: any[]
  ): Promise<PerformancePrediction> {
    const totalAudienceSize = audiences.reduce((sum, a) => sum + a.size, 0);
    const avgCtr = this.calculateAverageCtr(historicalData);
    const avgCpc = this.calculateAverageCpc(historicalData);
    const avgConversionRate = this.calculateAverageConversionRate(historicalData);

    const impressions = Math.min(totalAudienceSize * 0.1, request.budget / avgCpc * 1000);
    const clicks = impressions * avgCtr;
    const conversions = clicks * avgConversionRate;
    const ctr = avgCtr;
    const cpc = avgCpc;
    const cpa = avgCpc / avgConversionRate;
    const roas = this.calculateExpectedRoas(request.objective, conversions, request.budget);

    return {
      impressions: Math.round(impressions),
      clicks: Math.round(clicks),
      conversions: Math.round(conversions),
      ctr: Math.round(ctr * 100) / 100,
      cpc: Math.round(cpc * 100) / 100,
      cpa: Math.round(cpa * 100) / 100,
      roas: Math.round(roas * 100) / 100,
      confidence: this.calculatePredictionConfidence(historicalData.length, audiences.length)
    };
  }

  /**
   * Generate testing plan
   */
  private async generateTestingPlan(
    audiences: AudienceSegment[],
    request: TargetingRequest
  ): Promise<TestingPlan> {
    return {
      audiences: audiences.slice(0, 3).map(a => a.id), // Test top 3 audiences
      creatives: ['creative_1', 'creative_2', 'creative_3'], // Test 3 creatives
      placements: ['feed', 'stories', 'reels'], // Test different placements
      schedules: ['morning', 'afternoon', 'evening'], // Test different times
      duration: Math.min(request.duration, 14), // Test for up to 2 weeks
      successMetrics: this.getSuccessMetrics(request.objective)
    };
  }

  /**
   * Build prompt for audience generation
   */
  private buildAudienceGenerationPrompt(
    request: TargetingRequest,
    historicalData: any[],
    marketData: any
  ): string {
    const historicalInsights = historicalData.length > 0 
      ? `\n\nTop performing audiences:\n${historicalData.map(item => 
          `- ${item.name}: CTR ${item.ctr}%, CPA $${item.cpa}, Size ${item.size}`
        ).join('\n')}`
      : '';

    return `
Generate highly targeted audience segments for a ${request.platform} ad campaign.

Product: ${request.product}
Target Audience: ${request.targetAudience}
Objective: ${request.objective}
Budget: $${request.budget}
Duration: ${request.duration} days
Platform: ${request.platform}

Demographics:
- Age: ${request.demographics?.ageMin || '18'} - ${request.demographics?.ageMax || '65'}
- Gender: ${request.demographics?.gender || 'ALL'}
- Locations: ${request.demographics?.locations?.join(', ') || 'Global'}

Interests: ${request.interests?.join(', ') || 'General interests'}
Behaviors: ${request.behaviors?.join(', ') || 'General behaviors'}

${historicalInsights}

Generate audience segments in JSON format:
[
  {
    "id": "audience_1",
    "name": "Core Target Audience",
    "type": "CORE",
    "demographics": {
      "ageMin": 25,
      "ageMax": 45,
      "gender": "ALL",
      "locations": ["US", "CA", "UK"],
      "languages": ["en"],
      "education": ["college", "graduate"],
      "income": ["middle", "high"]
    },
    "interests": ["technology", "business", "entrepreneurship"],
    "behaviors": ["online_shopping", "social_media_active"],
    "size": 5000000,
    "quality": 0.85,
    "priority": 1
  }
]

Guidelines:
- Create 3-5 audience segments with different approaches
- Include core, lookalike, and interest-based audiences
- Balance audience size with quality
- Consider platform-specific targeting options
- Include retargeting audiences if applicable
- Prioritize audiences based on conversion potential
    `.trim();
  }

  /**
   * Parse audience segments from AI response
   */
  private parseAudienceSegments(content: string): AudienceSegment[] {
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      const schema = z.array(z.object({
        id: z.string(),
        name: z.string(),
        type: z.enum(['CORE', 'LOOKALIKE', 'CUSTOM', 'RETARGETING', 'INTEREST', 'BEHAVIORAL']),
        demographics: z.object({
          ageMin: z.number().optional(),
          ageMax: z.number().optional(),
          gender: z.enum(['MALE', 'FEMALE', 'ALL']).optional(),
          locations: z.array(z.string()).optional(),
          languages: z.array(z.string()).optional(),
          education: z.array(z.string()).optional(),
          income: z.array(z.string()).optional(),
          relationshipStatus: z.array(z.string()).optional()
        }),
        interests: z.array(z.string()),
        behaviors: z.array(z.string()),
        customAudience: z.any().optional(),
        lookalikeSettings: z.object({
          sourceAudience: z.string(),
          percentage: z.number(),
          country: z.string()
        }).optional(),
        size: z.number(),
        quality: z.number().min(0).max(1),
        priority: z.number()
      }));

      return schema.parse(parsed);

    } catch (error) {
      logger.error('Failed to parse audience segments', { error: error.message });
      return this.createFallbackAudiences();
    }
  }

  /**
   * Create fallback audiences if parsing fails
   */
  private createFallbackAudiences(): AudienceSegment[] {
    return [
      {
        id: 'fallback_1',
        name: 'General Target Audience',
        type: 'CORE',
        demographics: {
          ageMin: 25,
          ageMax: 55,
          gender: 'ALL'
        },
        interests: ['general'],
        behaviors: ['online_shopping'],
        size: 1000000,
        quality: 0.6,
        priority: 1
      }
    ];
  }

  // Helper methods
  private getPlatformPlacements(platform: string): any[] {
    const placements = {
      META: [
        { name: 'feed', priority: 1, optimization: 'AUTOMATIC' },
        { name: 'stories', priority: 2, optimization: 'AUTOMATIC' },
        { name: 'reels', priority: 3, optimization: 'AUTOMATIC' },
        { name: 'marketplace', priority: 4, optimization: 'MANUAL' }
      ],
      GOOGLE: [
        { name: 'search', priority: 1, optimization: 'AUTOMATIC' },
        { name: 'display', priority: 2, optimization: 'AUTOMATIC' },
        { name: 'youtube', priority: 3, optimization: 'AUTOMATIC' }
      ],
      TIKTOK: [
        { name: 'feed', priority: 1, optimization: 'AUTOMATIC' },
        { name: 'brand_takeover', priority: 2, optimization: 'MANUAL' }
      ]
    };

    return placements[platform] || placements.META;
  }

  private analyzeOptimalPlacements(historicalData: any[], platformPlacements: any[]): any[] {
    // Analyze historical performance to determine optimal placements
    return platformPlacements.filter(p => p.priority <= 2);
  }

  private analyzeOptimalTimes(historicalData: any[], targetAudience: string): { days: number[], hours: number[] } {
    // Analyze historical data to determine optimal posting times
    return {
      days: [1, 2, 3, 4, 5], // Monday-Friday
      hours: [9, 10, 11, 14, 15, 16, 19, 20, 21] // Peak hours
    };
  }

  private determineFrequency(budget: number, duration: number): 'CONTINUOUS' | 'PULSED' | 'BURST' {
    if (budget > 1000 && duration > 30) return 'CONTINUOUS';
    if (budget > 500 && duration > 14) return 'PULSED';
    return 'BURST';
  }

  private getSeasonalAdjustments(product: string): any[] {
    // Return seasonal adjustments based on product type
    return [];
  }

  private determineOptimalBidType(objective: string, historicalData: any[]): any {
    const bidTypes = {
      'AWARENESS': 'MAXIMIZE_CLICKS',
      'TRAFFIC': 'MAXIMIZE_CLICKS',
      'ENGAGEMENT': 'MAXIMIZE_CONVERSIONS',
      'LEADS': 'TARGET_CPA',
      'SALES': 'TARGET_ROAS',
      'APP_INSTALLS': 'MAXIMIZE_CONVERSIONS',
      'VIDEO_VIEWS': 'MAXIMIZE_CLICKS'
    };

    return bidTypes[objective] || 'MAXIMIZE_CONVERSIONS';
  }

  private calculateOptimalBid(budget: number, historicalData: any[]): number {
    const avgCpc = this.calculateAverageCpc(historicalData);
    return avgCpc * 1.2; // 20% above average for competitive advantage
  }

  private generateBidAdjustments(request: TargetingRequest, historicalData: any[]): BidAdjustment[] {
    return [
      {
        criteria: 'mobile',
        adjustment: 1.1,
        reason: 'Higher conversion rate on mobile'
      },
      {
        criteria: 'weekend',
        adjustment: 0.9,
        reason: 'Lower competition on weekends'
      }
    ];
  }

  private calculateTargetValue(objective: string, historicalData: any[]): number {
    // Calculate target CPA or ROAS based on objective and historical data
    return objective === 'SALES' ? 3.0 : 50.0; // ROAS 3.0 or CPA $50
  }

  private calculateAverageCtr(historicalData: any[]): number {
    if (historicalData.length === 0) return 0.02; // Default 2% CTR
    return historicalData.reduce((sum, item) => sum + item.ctr, 0) / historicalData.length;
  }

  private calculateAverageCpc(historicalData: any[]): number {
    if (historicalData.length === 0) return 1.50; // Default $1.50 CPC
    return historicalData.reduce((sum, item) => sum + item.cpc, 0) / historicalData.length;
  }

  private calculateAverageConversionRate(historicalData: any[]): number {
    if (historicalData.length === 0) return 0.05; // Default 5% conversion rate
    return historicalData.reduce((sum, item) => sum + item.conversionRate, 0) / historicalData.length;
  }

  private calculateExpectedRoas(objective: string, conversions: number, budget: number): number {
    if (objective === 'SALES') {
      const avgOrderValue = 100; // Default average order value
      return (conversions * avgOrderValue) / budget;
    }
    return 0;
  }

  private calculatePredictionConfidence(historicalDataLength: number, audienceCount: number): number {
    const dataConfidence = Math.min(historicalDataLength / 10, 1);
    const audienceConfidence = Math.min(audienceCount / 5, 1);
    return (dataConfidence + audienceConfidence) / 2;
  }

  private getSuccessMetrics(objective: string): string[] {
    const metrics = {
      'AWARENESS': ['impressions', 'reach', 'frequency'],
      'TRAFFIC': ['clicks', 'ctr', 'cpc'],
      'ENGAGEMENT': ['likes', 'comments', 'shares', 'engagement_rate'],
      'LEADS': ['conversions', 'cpa', 'lead_quality'],
      'SALES': ['conversions', 'roas', 'revenue'],
      'APP_INSTALLS': ['installs', 'cpi', 'retention'],
      'VIDEO_VIEWS': ['views', 'view_rate', 'completion_rate']
    };

    return metrics[objective] || ['conversions', 'cpa'];
  }

  private calculateStrategyConfidence(audiences: AudienceSegment[], historicalData: any[]): number {
    const avgAudienceQuality = audiences.reduce((sum, a) => sum + a.quality, 0) / audiences.length;
    const dataConfidence = Math.min(historicalData.length / 20, 1);
    return (avgAudienceQuality + dataConfidence) / 2;
  }

  private async getMarketResearchData(request: TargetingRequest): Promise<any> {
    // Implementation for market research data retrieval
    return {};
  }
}



