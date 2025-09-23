import OpenAI from 'openai';
import { z } from 'zod';
import { logger } from '../../utils/logger.js';
import { LearningDataService } from '../services/LearningDataService.js';
import { PerformanceAnalyzer } from '../utils/PerformanceAnalyzer.js';

interface AdvisorRequest {
  campaignId: string;
  orgId: string;
  platform: 'META' | 'GOOGLE' | 'TIKTOK' | 'LINKEDIN' | 'TWITTER';
  objective: 'AWARENESS' | 'TRAFFIC' | 'ENGAGEMENT' | 'LEADS' | 'SALES' | 'APP_INSTALLS' | 'VIDEO_VIEWS';
  currentPerformance: PerformanceData;
  historicalData: any[];
  marketTrends?: any[];
  competitorAnalysis?: any[];
  userPreferences?: UserPreferences;
}

interface PerformanceData {
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
  engagementRate?: number;
  videoViews?: number;
  completionRate?: number;
}

interface UserPreferences {
  riskTolerance: 'LOW' | 'MEDIUM' | 'HIGH';
  optimizationFrequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  focusAreas: string[];
  excludedStrategies: string[];
  budgetFlexibility: 'RIGID' | 'FLEXIBLE' | 'AGGRESSIVE';
}

interface AdvisorInsight {
  id: string;
  type: 'OPPORTUNITY' | 'WARNING' | 'RECOMMENDATION' | 'TREND' | 'OPTIMIZATION';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  actionableSteps: ActionableStep[];
  expectedImpact: ImpactPrediction;
  confidence: number;
  evidence: Evidence[];
  relatedCampaigns?: string[];
  marketContext?: MarketContext;
  aiReasoning: string;
  createdAt: Date;
  expiresAt?: Date;
}

interface ActionableStep {
  id: string;
  title: string;
  description: string;
  action: string;
  parameters: { [key: string]: any };
  estimatedTime: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  requiredPermissions: string[];
  expectedOutcome: string;
}

interface ImpactPrediction {
  metric: string;
  currentValue: number;
  predictedValue: number;
  change: number;
  changePercentage: number;
  timeframe: string;
  confidence: number;
}

interface Evidence {
  type: 'PERFORMANCE_DATA' | 'MARKET_RESEARCH' | 'COMPETITOR_ANALYSIS' | 'HISTORICAL_DATA' | 'AI_ANALYSIS';
  source: string;
  data: any;
  relevance: number;
  timestamp: Date;
}

interface MarketContext {
  trend: 'RISING' | 'STABLE' | 'DECLINING';
  seasonality: string;
  competition: 'LOW' | 'MEDIUM' | 'HIGH';
  opportunity: 'LOW' | 'MEDIUM' | 'HIGH';
  marketSize: number;
  growthRate: number;
}

interface CampaignHealth {
  overall: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';
  metrics: {
    performance: number;
    efficiency: number;
    scalability: number;
    sustainability: number;
  };
  issues: string[];
  strengths: string[];
  recommendations: string[];
}

interface StrategicRecommendation {
  id: string;
  title: string;
  description: string;
  category: 'BUDGET' | 'TARGETING' | 'CREATIVE' | 'TIMING' | 'PLATFORM' | 'STRATEGY';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  implementation: ImplementationPlan;
  expectedResults: ExpectedResults;
  risks: Risk[];
  alternatives: Alternative[];
  confidence: number;
}

interface ImplementationPlan {
  steps: ActionableStep[];
  timeline: string;
  resources: string[];
  dependencies: string[];
  milestones: Milestone[];
}

interface ExpectedResults {
  timeframe: string;
  metrics: { [key: string]: number };
  roi: number;
  confidence: number;
}

interface Risk {
  type: string;
  description: string;
  probability: number;
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
  mitigation: string;
}

interface Alternative {
  title: string;
  description: string;
  pros: string[];
  cons: string[];
  expectedResults: ExpectedResults;
}

interface Milestone {
  name: string;
  description: string;
  targetDate: Date;
  successCriteria: string[];
}

export class AIAdvisor {
  private openai: OpenAI;
  private learningService: LearningDataService;
  private performanceAnalyzer: PerformanceAnalyzer;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.learningService = new LearningDataService();
    this.performanceAnalyzer = new PerformanceAnalyzer();
  }

  /**
   * Generate comprehensive AI insights and recommendations
   */
  async generateInsights(request: AdvisorRequest): Promise<AdvisorInsight[]> {
    try {
      logger.info('Generating AI insights', { 
        campaignId: request.campaignId,
        platform: request.platform,
        objective: request.objective
      });

      // Analyze campaign health
      const campaignHealth = await this.analyzeCampaignHealth(request);
      
      // Generate performance insights
      const performanceInsights = await this.generatePerformanceInsights(request);
      
      // Generate market insights
      const marketInsights = await this.generateMarketInsights(request);
      
      // Generate optimization insights
      const optimizationInsights = await this.generateOptimizationInsights(request);
      
      // Generate strategic recommendations
      const strategicInsights = await this.generateStrategicInsights(request);
      
      // Combine all insights
      const allInsights = [
        ...performanceInsights,
        ...marketInsights,
        ...optimizationInsights,
        ...strategicInsights
      ];

      // Prioritize and filter insights
      const prioritizedInsights = this.prioritizeInsights(allInsights, request.userPreferences);
      
      // Add campaign health context
      const insightsWithContext = this.addHealthContext(prioritizedInsights, campaignHealth);

      logger.info('Generated AI insights', { 
        campaignId: request.campaignId,
        insightCount: insightsWithContext.length,
        criticalCount: insightsWithContext.filter(i => i.priority === 'CRITICAL').length
      });

      return insightsWithContext;

    } catch (error) {
      logger.error('Failed to generate AI insights', { error: error.message });
      throw new Error(`AI insights generation failed: ${error.message}`);
    }
  }

  /**
   * Generate strategic recommendations for campaign improvement
   */
  async generateStrategicRecommendations(request: AdvisorRequest): Promise<StrategicRecommendation[]> {
    try {
      const prompt = this.buildStrategicRecommendationPrompt(request);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are a world-class paid advertising strategist and consultant. 
            Provide strategic recommendations that drive significant improvements in campaign performance, 
            ROI, and business outcomes. Focus on high-impact, actionable strategies.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.4,
        max_tokens: 2000
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No strategic recommendations generated');
      }

      return this.parseStrategicRecommendations(content);

    } catch (error) {
      logger.error('Failed to generate strategic recommendations', { error: error.message });
      return [];
    }
  }

  /**
   * Analyze campaign health and performance
   */
  private async analyzeCampaignHealth(request: AdvisorRequest): Promise<CampaignHealth> {
    const performance = request.currentPerformance;
    const historicalData = request.historicalData;

    // Calculate performance metrics
    const performanceScore = this.calculatePerformanceScore(performance, request.objective);
    const efficiencyScore = this.calculateEfficiencyScore(performance);
    const scalabilityScore = this.calculateScalabilityScore(performance, historicalData);
    const sustainabilityScore = this.calculateSustainabilityScore(performance, historicalData);

    // Identify issues and strengths
    const issues = this.identifyIssues(performance, request.objective);
    const strengths = this.identifyStrengths(performance, request.objective);

    // Generate recommendations
    const recommendations = this.generateHealthRecommendations(issues, strengths);

    // Calculate overall health
    const overallScore = (performanceScore + efficiencyScore + scalabilityScore + sustainabilityScore) / 4;
    const overall = this.getHealthLevel(overallScore);

    return {
      overall,
      metrics: {
        performance: performanceScore,
        efficiency: efficiencyScore,
        scalability: scalabilityScore,
        sustainability: sustainabilityScore
      },
      issues,
      strengths,
      recommendations
    };
  }

  /**
   * Generate performance-based insights
   */
  private async generatePerformanceInsights(request: AdvisorRequest): Promise<AdvisorInsight[]> {
    const insights: AdvisorInsight[] = [];
    const performance = request.currentPerformance;
    const historicalData = request.historicalData;

    // CTR Analysis
    if (performance.ctr < 0.02) {
      insights.push({
        id: `ctr_low_${Date.now()}`,
        type: 'WARNING',
        priority: 'HIGH',
        title: 'Low Click-Through Rate',
        description: `Your CTR of ${(performance.ctr * 100).toFixed(2)}% is below industry average. This indicates your ads may not be compelling enough or targeting the wrong audience.`,
        actionableSteps: [
          {
            id: 'ctr_1',
            title: 'Improve Ad Copy',
            description: 'Rewrite headlines and descriptions to be more compelling',
            action: 'update_copy',
            parameters: { focus: 'headlines', style: 'emotional' },
            estimatedTime: '2-4 hours',
            difficulty: 'MEDIUM',
            requiredPermissions: ['edit_ads'],
            expectedOutcome: 'Increase CTR by 20-30%'
          },
          {
            id: 'ctr_2',
            title: 'Refine Targeting',
            description: 'Narrow audience targeting to more qualified prospects',
            action: 'refine_targeting',
            parameters: { method: 'interest_refinement' },
            estimatedTime: '1-2 hours',
            difficulty: 'EASY',
            requiredPermissions: ['edit_targeting'],
            expectedOutcome: 'Improve audience quality and CTR'
          }
        ],
        expectedImpact: {
          metric: 'CTR',
          currentValue: performance.ctr,
          predictedValue: performance.ctr * 1.3,
          change: performance.ctr * 0.3,
          changePercentage: 30,
          timeframe: '1-2 weeks',
          confidence: 0.8
        },
        confidence: 0.8,
        evidence: [
          {
            type: 'PERFORMANCE_DATA',
            source: 'Campaign Analytics',
            data: { ctr: performance.ctr, benchmark: 0.02 },
            relevance: 0.9,
            timestamp: new Date()
          }
        ],
        aiReasoning: 'CTR below 2% indicates poor ad relevance or targeting issues. Industry average is 2-3% for most platforms.',
        createdAt: new Date()
      });
    }

    // CPA Analysis
    if (performance.cpa > 100) {
      insights.push({
        id: `cpa_high_${Date.now()}`,
        type: 'WARNING',
        priority: 'CRITICAL',
        title: 'High Cost Per Acquisition',
        description: `Your CPA of $${performance.cpa.toFixed(2)} is significantly high. This is eating into your profit margins and reducing campaign efficiency.`,
        actionableSteps: [
          {
            id: 'cpa_1',
            title: 'Optimize Bidding Strategy',
            description: 'Switch to target CPA bidding or adjust manual bids',
            action: 'update_bidding',
            parameters: { strategy: 'target_cpa', target: performance.cpa * 0.7 },
            estimatedTime: '30 minutes',
            difficulty: 'EASY',
            requiredPermissions: ['edit_bidding'],
            expectedOutcome: 'Reduce CPA by 20-30%'
          },
          {
            id: 'cpa_2',
            title: 'Improve Landing Page',
            description: 'Optimize landing page for better conversion rates',
            action: 'optimize_landing_page',
            parameters: { focus: 'conversion_rate' },
            estimatedTime: '4-8 hours',
            difficulty: 'HARD',
            requiredPermissions: ['edit_landing_page'],
            expectedOutcome: 'Increase conversion rate by 15-25%'
          }
        ],
        expectedImpact: {
          metric: 'CPA',
          currentValue: performance.cpa,
          predictedValue: performance.cpa * 0.75,
          change: performance.cpa * -0.25,
          changePercentage: -25,
          timeframe: '1-2 weeks',
          confidence: 0.85
        },
        confidence: 0.85,
        evidence: [
          {
            type: 'PERFORMANCE_DATA',
            source: 'Campaign Analytics',
            data: { cpa: performance.cpa, benchmark: 50 },
            relevance: 0.95,
            timestamp: new Date()
          }
        ],
        aiReasoning: 'CPA above $100 is unsustainable for most businesses. Target CPA should be 30-50% of customer lifetime value.',
        createdAt: new Date()
      });
    }

    // ROAS Analysis
    if (performance.roas < 2.0) {
      insights.push({
        id: `roas_low_${Date.now()}`,
        type: 'WARNING',
        priority: 'HIGH',
        title: 'Low Return on Ad Spend',
        description: `Your ROAS of ${performance.roas.toFixed(2)} indicates poor profitability. You're spending more on ads than you're earning back.`,
        actionableSteps: [
          {
            id: 'roas_1',
            title: 'Focus on High-Value Audiences',
            description: 'Shift budget to audiences with higher conversion values',
            action: 'reallocate_budget',
            parameters: { method: 'value_based' },
            estimatedTime: '1 hour',
            difficulty: 'MEDIUM',
            requiredPermissions: ['edit_budget'],
            expectedOutcome: 'Improve ROAS by 40-60%'
          },
          {
            id: 'roas_2',
            title: 'Improve Ad Quality',
            description: 'Create more compelling ads that drive higher-value actions',
            action: 'improve_creative',
            parameters: { focus: 'value_proposition' },
            estimatedTime: '3-6 hours',
            difficulty: 'HARD',
            requiredPermissions: ['edit_creative'],
            expectedOutcome: 'Increase conversion value by 25-35%'
          }
        ],
        expectedImpact: {
          metric: 'ROAS',
          currentValue: performance.roas,
          predictedValue: performance.roas * 1.5,
          change: performance.roas * 0.5,
          changePercentage: 50,
          timeframe: '2-3 weeks',
          confidence: 0.75
        },
        confidence: 0.75,
        evidence: [
          {
            type: 'PERFORMANCE_DATA',
            source: 'Campaign Analytics',
            data: { roas: performance.roas, benchmark: 3.0 },
            relevance: 0.9,
            timestamp: new Date()
          }
        ],
        aiReasoning: 'ROAS below 2.0 means you\'re losing money on ads. Healthy ROAS should be 3.0+ for sustainable growth.',
        createdAt: new Date()
      });
    }

    return insights;
  }

  /**
   * Generate market-based insights
   */
  private async generateMarketInsights(request: AdvisorRequest): Promise<AdvisorInsight[]> {
    const insights: AdvisorInsight[] = [];

    // This would integrate with market research APIs
    // For now, we'll generate sample insights

    insights.push({
      id: `market_trend_${Date.now()}`,
      type: 'OPPORTUNITY',
      priority: 'MEDIUM',
      title: 'Seasonal Opportunity Detected',
      description: 'Market data shows increased demand for your product category during this time of year. Consider increasing budget to capture this opportunity.',
      actionableSteps: [
        {
          id: 'market_1',
          title: 'Increase Budget by 30%',
          description: 'Temporarily increase budget to capture seasonal demand',
          action: 'increase_budget',
          parameters: { increase: 0.3, duration: '2_weeks' },
          estimatedTime: '15 minutes',
          difficulty: 'EASY',
          requiredPermissions: ['edit_budget'],
          expectedOutcome: 'Capture 25-40% more conversions'
        }
      ],
      expectedImpact: {
        metric: 'Conversions',
        currentValue: request.currentPerformance.conversions,
        predictedValue: request.currentPerformance.conversions * 1.35,
        change: request.currentPerformance.conversions * 0.35,
        changePercentage: 35,
        timeframe: '2 weeks',
        confidence: 0.7
      },
      confidence: 0.7,
      evidence: [
        {
          type: 'MARKET_RESEARCH',
          source: 'Market Analysis',
          data: { trend: 'seasonal_increase', confidence: 0.7 },
          relevance: 0.8,
          timestamp: new Date()
        }
      ],
      marketContext: {
        trend: 'RISING',
        seasonality: 'Q4 Holiday Season',
        competition: 'MEDIUM',
        opportunity: 'HIGH',
        marketSize: 1000000,
        growthRate: 0.15
      },
      aiReasoning: 'Historical data and market trends indicate increased demand during this period.',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 2 weeks
    });

    return insights;
  }

  /**
   * Generate optimization insights
   */
  private async generateOptimizationInsights(request: AdvisorRequest): Promise<AdvisorInsight[]> {
    const insights: AdvisorInsight[] = [];

    // This would analyze current optimizations and suggest improvements
    // For now, we'll generate sample insights

    return insights;
  }

  /**
   * Generate strategic insights
   */
  private async generateStrategicInsights(request: AdvisorRequest): Promise<AdvisorInsight[]> {
    const insights: AdvisorInsight[] = [];

    // This would provide high-level strategic recommendations
    // For now, we'll generate sample insights

    return insights;
  }

  /**
   * Build prompt for strategic recommendations
   */
  private buildStrategicRecommendationPrompt(request: AdvisorRequest): string {
    return `
Provide strategic recommendations for improving this paid advertising campaign.

Campaign Details:
- Platform: ${request.platform}
- Objective: ${request.objective}
- Current Performance: ${JSON.stringify(request.currentPerformance, null, 2)}
- Budget: $${request.currentPerformance.spend}

Historical Performance:
${request.historicalData.map(data => 
  `- ${data.date}: CTR ${data.ctr}%, CPC $${data.cpc}, Conversions ${data.conversions}`
).join('\n')}

User Preferences:
- Risk Tolerance: ${request.userPreferences?.riskTolerance || 'MEDIUM'}
- Optimization Frequency: ${request.userPreferences?.optimizationFrequency || 'WEEKLY'}
- Focus Areas: ${request.userPreferences?.focusAreas?.join(', ') || 'Performance'}
- Budget Flexibility: ${request.userPreferences?.budgetFlexibility || 'FLEXIBLE'}

Provide strategic recommendations in JSON format:
{
  "recommendations": [
    {
      "id": "strategy_1",
      "title": "Strategic Recommendation Title",
      "description": "Detailed description of the recommendation",
      "category": "BUDGET|TARGETING|CREATIVE|TIMING|PLATFORM|STRATEGY",
      "priority": "LOW|MEDIUM|HIGH|CRITICAL",
      "implementation": {
        "steps": [
          {
            "id": "step_1",
            "title": "Step Title",
            "description": "Step description",
            "action": "action_type",
            "parameters": {},
            "estimatedTime": "1-2 hours",
            "difficulty": "EASY|MEDIUM|HARD",
            "requiredPermissions": ["permission1"],
            "expectedOutcome": "Expected result"
          }
        ],
        "timeline": "2-4 weeks",
        "resources": ["resource1", "resource2"],
        "dependencies": ["dependency1"],
        "milestones": [
          {
            "name": "Milestone 1",
            "description": "Description",
            "targetDate": "2024-01-15",
            "successCriteria": ["criteria1", "criteria2"]
          }
        ]
      },
      "expectedResults": {
        "timeframe": "4-6 weeks",
        "metrics": {
          "ctr": 0.03,
          "cpc": 1.20,
          "cpa": 45.00,
          "roas": 3.5
        },
        "roi": 250,
        "confidence": 0.85
      },
      "risks": [
        {
          "type": "Budget",
          "description": "Risk description",
          "probability": 0.3,
          "impact": "LOW|MEDIUM|HIGH",
          "mitigation": "Mitigation strategy"
        }
      ],
      "alternatives": [
        {
          "title": "Alternative Title",
          "description": "Alternative description",
          "pros": ["pro1", "pro2"],
          "cons": ["con1", "con2"],
          "expectedResults": {
            "timeframe": "3-5 weeks",
            "metrics": {},
            "roi": 200,
            "confidence": 0.75
          }
        }
      ],
      "confidence": 0.85
    }
  ]
}

Focus on:
1. High-impact strategic changes
2. Specific, actionable steps
3. Realistic timelines and expectations
4. Risk assessment and mitigation
5. Measurable outcomes
    `.trim();
  }

  /**
   * Parse strategic recommendations from AI response
   */
  private parseStrategicRecommendations(content: string): StrategicRecommendation[] {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.recommendations || [];

    } catch (error) {
      logger.error('Failed to parse strategic recommendations', { error: error.message });
      return [];
    }
  }

  // Helper methods for health analysis
  private calculatePerformanceScore(performance: PerformanceData, objective: string): number {
    // Calculate performance score based on objective
    const weights = {
      'AWARENESS': { impressions: 0.4, ctr: 0.3, cpc: 0.3 },
      'TRAFFIC': { clicks: 0.4, ctr: 0.3, cpc: 0.3 },
      'ENGAGEMENT': { engagementRate: 0.5, ctr: 0.3, cpc: 0.2 },
      'LEADS': { conversions: 0.4, cpa: 0.3, ctr: 0.3 },
      'SALES': { roas: 0.5, cpa: 0.3, conversions: 0.2 },
      'APP_INSTALLS': { conversions: 0.4, cpa: 0.3, ctr: 0.3 },
      'VIDEO_VIEWS': { videoViews: 0.4, completionRate: 0.3, ctr: 0.3 }
    };

    const weight = weights[objective] || weights['SALES'];
    let score = 0;

    Object.entries(weight).forEach(([metric, weightValue]) => {
      const value = performance[metric as keyof PerformanceData] as number || 0;
      const normalizedValue = this.normalizeMetric(metric, value);
      score += normalizedValue * weightValue;
    });

    return Math.min(Math.max(score, 0), 1);
  }

  private calculateEfficiencyScore(performance: PerformanceData): number {
    // Calculate efficiency based on cost metrics
    const cpcScore = this.normalizeMetric('cpc', performance.cpc, true); // Lower is better
    const cpaScore = this.normalizeMetric('cpa', performance.cpa, true);
    const roasScore = this.normalizeMetric('roas', performance.roas);
    
    return (cpcScore + cpaScore + roasScore) / 3;
  }

  private calculateScalabilityScore(performance: PerformanceData, historicalData: any[]): number {
    // Calculate scalability based on growth trends
    if (historicalData.length < 2) return 0.5;
    
    const recentData = historicalData.slice(-7); // Last 7 days
    const olderData = historicalData.slice(-14, -7); // Previous 7 days
    
    const recentAvg = this.calculateAveragePerformance(recentData);
    const olderAvg = this.calculateAveragePerformance(olderData);
    
    const growthRate = (recentAvg.conversions - olderAvg.conversions) / olderAvg.conversions;
    return Math.min(Math.max(growthRate + 0.5, 0), 1);
  }

  private calculateSustainabilityScore(performance: PerformanceData, historicalData: any[]): number {
    // Calculate sustainability based on consistency
    if (historicalData.length < 7) return 0.5;
    
    const recentData = historicalData.slice(-7);
    const ctrVariance = this.calculateVariance(recentData.map(d => d.ctr));
    const cpcVariance = this.calculateVariance(recentData.map(d => d.cpc));
    
    const consistency = 1 - ((ctrVariance + cpcVariance) / 2);
    return Math.min(Math.max(consistency, 0), 1);
  }

  private identifyIssues(performance: PerformanceData, objective: string): string[] {
    const issues: string[] = [];
    
    if (performance.ctr < 0.02) issues.push('Low click-through rate');
    if (performance.cpc > 2.0) issues.push('High cost per click');
    if (performance.cpa > 100) issues.push('High cost per acquisition');
    if (performance.roas < 2.0) issues.push('Low return on ad spend');
    
    return issues;
  }

  private identifyStrengths(performance: PerformanceData, objective: string): string[] {
    const strengths: string[] = [];
    
    if (performance.ctr > 0.03) strengths.push('High click-through rate');
    if (performance.cpc < 1.0) strengths.push('Low cost per click');
    if (performance.cpa < 50) strengths.push('Low cost per acquisition');
    if (performance.roas > 3.0) strengths.push('High return on ad spend');
    
    return strengths;
  }

  private generateHealthRecommendations(issues: string[], strengths: string[]): string[] {
    const recommendations: string[] = [];
    
    if (issues.includes('Low click-through rate')) {
      recommendations.push('Improve ad copy and targeting to increase CTR');
    }
    if (issues.includes('High cost per click')) {
      recommendations.push('Optimize bidding strategy and ad quality');
    }
    if (issues.includes('High cost per acquisition')) {
      recommendations.push('Improve landing page conversion rate');
    }
    if (issues.includes('Low return on ad spend')) {
      recommendations.push('Focus on higher-value audiences and products');
    }
    
    return recommendations;
  }

  private getHealthLevel(score: number): 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL' {
    if (score >= 0.8) return 'EXCELLENT';
    if (score >= 0.6) return 'GOOD';
    if (score >= 0.4) return 'FAIR';
    if (score >= 0.2) return 'POOR';
    return 'CRITICAL';
  }

  private normalizeMetric(metric: string, value: number, lowerIsBetter = false): number {
    // Normalize metric values to 0-1 scale
    const benchmarks = {
      ctr: { min: 0, max: 0.1 },
      cpc: { min: 0.5, max: 5.0 },
      cpa: { min: 10, max: 200 },
      roas: { min: 0, max: 10 },
      engagementRate: { min: 0, max: 0.2 },
      completionRate: { min: 0, max: 1 }
    };
    
    const benchmark = benchmarks[metric as keyof typeof benchmarks] || { min: 0, max: 1 };
    const normalized = (value - benchmark.min) / (benchmark.max - benchmark.min);
    
    return lowerIsBetter ? 1 - normalized : normalized;
  }

  private calculateAveragePerformance(data: any[]): PerformanceData {
    if (data.length === 0) return {
      impressions: 0, clicks: 0, conversions: 0, spend: 0,
      ctr: 0, cpc: 0, cpa: 0, roas: 0
    };
    
    return {
      impressions: data.reduce((sum, d) => sum + d.impressions, 0) / data.length,
      clicks: data.reduce((sum, d) => sum + d.clicks, 0) / data.length,
      conversions: data.reduce((sum, d) => sum + d.conversions, 0) / data.length,
      spend: data.reduce((sum, d) => sum + d.spend, 0) / data.length,
      ctr: data.reduce((sum, d) => sum + d.ctr, 0) / data.length,
      cpc: data.reduce((sum, d) => sum + d.cpc, 0) / data.length,
      cpa: data.reduce((sum, d) => sum + d.cpa, 0) / data.length,
      roas: data.reduce((sum, d) => sum + d.roas, 0) / data.length
    };
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return variance;
  }

  private prioritizeInsights(insights: AdvisorInsight[], preferences?: UserPreferences): AdvisorInsight[] {
    // Sort by priority and confidence
    return insights.sort((a, b) => {
      const priorityOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
      const aPriority = priorityOrder[a.priority] || 0;
      const bPriority = priorityOrder[b.priority] || 0;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      return b.confidence - a.confidence;
    });
  }

  private addHealthContext(insights: AdvisorInsight[], health: CampaignHealth): AdvisorInsight[] {
    return insights.map(insight => ({
      ...insight,
      aiReasoning: `${insight.aiReasoning} Campaign health: ${health.overall}.`
    }));
  }
}



