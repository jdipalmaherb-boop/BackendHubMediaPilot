import { logger } from '../utils/logger.js';
import { AdCopyGenerator } from '../ai/modules/AdCopyGenerator.js';
import { CreativeGenerator } from '../ai/modules/CreativeGenerator.js';
import { TargetingOptimizer } from '../ai/modules/TargetingOptimizer.js';
import { OptimizationEngine } from '../ai/modules/OptimizationEngine.js';
import { AIAdvisor } from '../ai/modules/AIAdvisor.js';
import { PlatformManager } from '../platforms/PlatformManager.js';
import { LearningDataService } from '../ai/services/LearningDataService.js';
import { PerformanceAnalyzer } from '../utils/PerformanceAnalyzer.js';
import { ABTestManager } from '../testing/ABTestManager.js';
import { NotificationService } from '../services/NotificationService.js';
import { CampaignService } from '../services/CampaignService.js';

interface AutomationConfig {
  orgId: string;
  campaignId: string;
  platform: 'META' | 'GOOGLE' | 'TIKTOK' | 'LINKEDIN' | 'TWITTER';
  objective: 'AWARENESS' | 'TRAFFIC' | 'ENGAGEMENT' | 'LEADS' | 'SALES' | 'APP_INSTALLS' | 'VIDEO_VIEWS';
  budget: number;
  duration: number; // days
  rules: AutomationRules;
  aiSettings: AISettings;
  userPreferences: UserPreferences;
}

interface AutomationRules {
  maxDailySpend: number;
  minCtr: number;
  maxCpc: number;
  minRoas: number;
  maxCpa: number;
  allowedPlacements: string[];
  allowedAudiences: string[];
  budgetLimits: { [audienceId: string]: number };
  pauseConditions: PauseCondition[];
  scaleConditions: ScaleCondition[];
}

interface PauseCondition {
  metric: string;
  operator: 'LESS_THAN' | 'GREATER_THAN' | 'EQUALS';
  value: number;
  duration: number; // hours
  action: 'PAUSE_CAMPAIGN' | 'PAUSE_ADGROUP' | 'PAUSE_CREATIVE';
}

interface ScaleCondition {
  metric: string;
  operator: 'GREATER_THAN' | 'EQUALS';
  value: number;
  duration: number; // hours
  action: 'INCREASE_BUDGET' | 'EXPAND_AUDIENCE' | 'ADD_CREATIVES';
  maxIncrease: number; // percentage
}

interface AISettings {
  copyGeneration: {
    enabled: boolean;
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    variations: number;
    testingEnabled: boolean;
  };
  creativeGeneration: {
    enabled: boolean;
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    variations: number;
    testingEnabled: boolean;
  };
  targetingOptimization: {
    enabled: boolean;
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    expansionEnabled: boolean;
    refinementEnabled: boolean;
  };
  performanceOptimization: {
    enabled: boolean;
    frequency: 'HOURLY' | 'DAILY' | 'WEEKLY';
    autoApply: boolean;
    confidenceThreshold: number;
  };
  learningEnabled: boolean;
  abTestingEnabled: boolean;
}

interface UserPreferences {
  riskTolerance: 'LOW' | 'MEDIUM' | 'HIGH';
  optimizationFrequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  focusAreas: string[];
  excludedStrategies: string[];
  budgetFlexibility: 'RIGID' | 'FLEXIBLE' | 'AGGRESSIVE';
  notificationSettings: NotificationSettings;
}

interface NotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
  frequency: 'IMMEDIATE' | 'DAILY' | 'WEEKLY';
  types: string[];
}

interface AutomationResult {
  success: boolean;
  actions: AutomationAction[];
  insights: any[];
  recommendations: any[];
  errors: string[];
  nextRun: Date;
}

interface AutomationAction {
  id: string;
  type: string;
  description: string;
  status: 'PENDING' | 'APPLIED' | 'FAILED' | 'REJECTED';
  timestamp: Date;
  result?: any;
}

export class AutomationEngine {
  private adCopyGenerator: AdCopyGenerator;
  private creativeGenerator: CreativeGenerator;
  private targetingOptimizer: TargetingOptimizer;
  private optimizationEngine: OptimizationEngine;
  private aiAdvisor: AIAdvisor;
  private platformManager: PlatformManager;
  private learningService: LearningDataService;
  private performanceAnalyzer: PerformanceAnalyzer;
  private abTestManager: ABTestManager;
  private notificationService: NotificationService;
  private campaignService: CampaignService;

  constructor() {
    this.adCopyGenerator = new AdCopyGenerator();
    this.creativeGenerator = new CreativeGenerator();
    this.targetingOptimizer = new TargetingOptimizer();
    this.optimizationEngine = new OptimizationEngine();
    this.aiAdvisor = new AIAdvisor();
    this.platformManager = new PlatformManager();
    this.learningService = new LearningDataService();
    this.performanceAnalyzer = new PerformanceAnalyzer();
    this.abTestManager = new ABTestManager();
    this.notificationService = new NotificationService();
    this.campaignService = new CampaignService();
  }

  /**
   * Main automation method - orchestrates all AI modules
   */
  async runAutomation(config: AutomationConfig): Promise<AutomationResult> {
    try {
      logger.info('Starting automation run', { 
        campaignId: config.campaignId,
        platform: config.platform,
        objective: config.objective
      });

      const result: AutomationResult = {
        success: true,
        actions: [],
        insights: [],
        recommendations: [],
        errors: [],
        nextRun: this.calculateNextRun(config)
      };

      // 1. Analyze current performance
      const performanceAnalysis = await this.analyzePerformance(config);
      result.insights.push(...performanceAnalysis.insights);

      // 2. Check automation rules and conditions
      const ruleResults = await this.checkAutomationRules(config, performanceAnalysis);
      result.actions.push(...ruleResults.actions);

      // 3. Generate AI insights and recommendations
      const aiInsights = await this.generateAIInsights(config, performanceAnalysis);
      result.insights.push(...aiInsights);

      // 4. Generate strategic recommendations
      const recommendations = await this.generateRecommendations(config, performanceAnalysis);
      result.recommendations.push(...recommendations);

      // 5. Execute AI-powered optimizations
      if (config.aiSettings.performanceOptimization.enabled) {
        const optimizations = await this.executeOptimizations(config, performanceAnalysis);
        result.actions.push(...optimizations);
      }

      // 6. Generate new content if needed
      if (this.shouldGenerateContent(config)) {
        const contentActions = await this.generateContent(config, performanceAnalysis);
        result.actions.push(...contentActions);
      }

      // 7. Run A/B tests if enabled
      if (config.aiSettings.abTestingEnabled) {
        const abTestActions = await this.runABTests(config, performanceAnalysis);
        result.actions.push(...abTestActions);
      }

      // 8. Update learning data
      if (config.aiSettings.learningEnabled) {
        await this.updateLearningData(config, performanceAnalysis);
      }

      // 9. Send notifications
      await this.sendNotifications(config, result);

      // 10. Update campaign status
      await this.updateCampaignStatus(config, result);

      logger.info('Automation run completed', { 
        campaignId: config.campaignId,
        actionsCount: result.actions.length,
        insightsCount: result.insights.length,
        recommendationsCount: result.recommendations.length
      });

      return result;

    } catch (error) {
      logger.error('Automation run failed', { 
        campaignId: config.campaignId,
        error: error.message 
      });

      return {
        success: false,
        actions: [],
        insights: [],
        recommendations: [],
        errors: [error.message],
        nextRun: this.calculateNextRun(config)
      };
    }
  }

  /**
   * Analyze current campaign performance
   */
  private async analyzePerformance(config: AutomationConfig): Promise<any> {
    try {
      // Get current performance data from platform
      const currentPerformance = await this.platformManager.getCampaignPerformance(
        config.campaignId,
        config.platform
      );

      // Get historical performance data
      const historicalData = await this.learningService.getCampaignPerformanceData(
        config.campaignId
      );

      // Analyze performance using AI
      const analysis = await this.performanceAnalyzer.analyzePerformance(
        currentPerformance,
        historicalData
      );

      return {
        currentPerformance,
        historicalData,
        analysis,
        insights: analysis.insights || []
      };

    } catch (error) {
      logger.error('Performance analysis failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Check automation rules and execute actions
   */
  private async checkAutomationRules(
    config: AutomationConfig,
    performanceAnalysis: any
  ): Promise<{ actions: AutomationAction[] }> {
    const actions: AutomationAction[] = [];

    try {
      // Check pause conditions
      for (const condition of config.rules.pauseConditions) {
        const shouldPause = this.evaluateCondition(
          condition,
          performanceAnalysis.currentPerformance
        );

        if (shouldPause) {
          const action = await this.executePauseAction(condition, config);
          actions.push(action);
        }
      }

      // Check scale conditions
      for (const condition of config.rules.scaleConditions) {
        const shouldScale = this.evaluateCondition(
          condition,
          performanceAnalysis.currentPerformance
        );

        if (shouldScale) {
          const action = await this.executeScaleAction(condition, config);
          actions.push(action);
        }
      }

      return { actions };

    } catch (error) {
      logger.error('Rule checking failed', { error: error.message });
      return { actions: [] };
    }
  }

  /**
   * Generate AI insights and recommendations
   */
  private async generateAIInsights(
    config: AutomationConfig,
    performanceAnalysis: any
  ): Promise<any[]> {
    try {
      const insights = await this.aiAdvisor.generateInsights({
        campaignId: config.campaignId,
        orgId: config.orgId,
        platform: config.platform,
        objective: config.objective,
        currentPerformance: performanceAnalysis.currentPerformance,
        historicalData: performanceAnalysis.historicalData,
        userPreferences: config.userPreferences
      });

      return insights;

    } catch (error) {
      logger.error('AI insights generation failed', { error: error.message });
      return [];
    }
  }

  /**
   * Generate strategic recommendations
   */
  private async generateRecommendations(
    config: AutomationConfig,
    performanceAnalysis: any
  ): Promise<any[]> {
    try {
      const recommendations = await this.aiAdvisor.generateStrategicRecommendations({
        campaignId: config.campaignId,
        orgId: config.orgId,
        platform: config.platform,
        objective: config.objective,
        currentPerformance: performanceAnalysis.currentPerformance,
        historicalData: performanceAnalysis.historicalData,
        userPreferences: config.userPreferences
      });

      return recommendations;

    } catch (error) {
      logger.error('Recommendations generation failed', { error: error.message });
      return [];
    }
  }

  /**
   * Execute AI-powered optimizations
   */
  private async executeOptimizations(
    config: AutomationConfig,
    performanceAnalysis: any
  ): Promise<AutomationAction[]> {
    const actions: AutomationAction[] = [];

    try {
      const optimizations = await this.optimizationEngine.optimizeCampaign({
        campaignId: config.campaignId,
        platform: config.platform,
        objective: config.objective,
        currentPerformance: performanceAnalysis.currentPerformance,
        budget: config.budget,
        constraints: config.rules,
        learningData: performanceAnalysis.historicalData
      });

      // Convert optimizations to automation actions
      for (const optimization of optimizations) {
        const action: AutomationAction = {
          id: optimization.id,
          type: optimization.type,
          description: optimization.reason,
          status: optimization.status === 'APPLIED' ? 'APPLIED' : 'PENDING',
          timestamp: new Date(),
          result: optimization.result
        };

        actions.push(action);
      }

      return actions;

    } catch (error) {
      logger.error('Optimization execution failed', { error: error.message });
      return [];
    }
  }

  /**
   * Generate new content if needed
   */
  private async generateContent(
    config: AutomationConfig,
    performanceAnalysis: any
  ): Promise<AutomationAction[]> {
    const actions: AutomationAction[] = [];

    try {
      // Generate ad copy if enabled
      if (config.aiSettings.copyGeneration.enabled) {
        const copyActions = await this.generateAdCopy(config, performanceAnalysis);
        actions.push(...copyActions);
      }

      // Generate creatives if enabled
      if (config.aiSettings.creativeGeneration.enabled) {
        const creativeActions = await this.generateCreatives(config, performanceAnalysis);
        actions.push(...creativeActions);
      }

      return actions;

    } catch (error) {
      logger.error('Content generation failed', { error: error.message });
      return [];
    }
  }

  /**
   * Generate ad copy variations
   */
  private async generateAdCopy(
    config: AutomationConfig,
    performanceAnalysis: any
  ): Promise<AutomationAction[]> {
    const actions: AutomationAction[] = [];

    try {
      const copyVariations = await this.adCopyGenerator.generateAdCopy({
        product: config.campaignId, // This would come from campaign data
        targetAudience: 'General', // This would come from campaign data
        painPoints: ['Generic pain point'], // This would come from campaign data
        benefits: ['Generic benefit'], // This would come from campaign data
        platform: config.platform,
        objective: config.objective,
        previousPerformance: performanceAnalysis.historicalData
      });

      // Create automation actions for each variation
      for (const variation of copyVariations) {
        const action: AutomationAction = {
          id: `copy_gen_${Date.now()}`,
          type: 'COPY_GENERATION',
          description: `Generated new ad copy: ${variation.headline}`,
          status: 'PENDING',
          timestamp: new Date(),
          result: { variation }
        };

        actions.push(action);
      }

      return actions;

    } catch (error) {
      logger.error('Ad copy generation failed', { error: error.message });
      return [];
    }
  }

  /**
   * Generate creative variations
   */
  private async generateCreatives(
    config: AutomationConfig,
    performanceAnalysis: any
  ): Promise<AutomationAction[]> {
    const actions: AutomationAction[] = [];

    try {
      const creative = await this.creativeGenerator.generateCreative({
        product: config.campaignId, // This would come from campaign data
        targetAudience: 'General', // This would come from campaign data
        platform: config.platform,
        objective: config.objective,
        adCopy: 'Generated ad copy', // This would come from generated copy
        existingAssets: [] // This would come from campaign data
      });

      const action: AutomationAction = {
        id: `creative_gen_${Date.now()}`,
        type: 'CREATIVE_GENERATION',
        description: `Generated new creative: ${creative.metadata.title}`,
        status: 'PENDING',
        timestamp: new Date(),
        result: { creative }
      };

      actions.push(action);

      return actions;

    } catch (error) {
      logger.error('Creative generation failed', { error: error.message });
      return [];
    }
  }

  /**
   * Run A/B tests
   */
  private async runABTests(
    config: AutomationConfig,
    performanceAnalysis: any
  ): Promise<AutomationAction[]> {
    const actions: AutomationAction[] = [];

    try {
      // Check if there are any active A/B tests
      const activeTests = await this.abTestManager.getActiveTests(config.campaignId);

      for (const test of activeTests) {
        // Check if test is ready for analysis
        if (this.isTestReadyForAnalysis(test)) {
          const testResult = await this.abTestManager.analyzeTest(test.id);
          
          const action: AutomationAction = {
            id: `ab_test_${test.id}`,
            type: 'AB_TEST_ANALYSIS',
            description: `Analyzed A/B test: ${test.name}`,
            status: 'APPLIED',
            timestamp: new Date(),
            result: { testResult }
          };

          actions.push(action);
        }
      }

      return actions;

    } catch (error) {
      logger.error('A/B test execution failed', { error: error.message });
      return [];
    }
  }

  /**
   * Update learning data
   */
  private async updateLearningData(
    config: AutomationConfig,
    performanceAnalysis: any
  ): Promise<void> {
    try {
      await this.learningService.recordCampaignPerformance({
        campaignId: config.campaignId,
        performance: performanceAnalysis.currentPerformance,
        timestamp: new Date()
      });

      logger.info('Learning data updated', { campaignId: config.campaignId });

    } catch (error) {
      logger.error('Learning data update failed', { error: error.message });
    }
  }

  /**
   * Send notifications
   */
  private async sendNotifications(
    config: AutomationConfig,
    result: AutomationResult
  ): Promise<void> {
    try {
      const settings = config.userPreferences.notificationSettings;

      if (settings.email && result.insights.length > 0) {
        await this.notificationService.sendEmailNotification({
          to: 'user@example.com', // This would come from user data
          subject: 'AI Ads Automation Insights',
          content: this.formatNotificationContent(result),
          type: 'AUTOMATION_INSIGHTS'
        });
      }

      if (settings.push && result.actions.length > 0) {
        await this.notificationService.sendPushNotification({
          userId: config.orgId,
          title: 'Automation Actions Applied',
          message: `${result.actions.length} actions were applied to your campaign`,
          type: 'AUTOMATION_ACTIONS'
        });
      }

    } catch (error) {
      logger.error('Notification sending failed', { error: error.message });
    }
  }

  /**
   * Update campaign status
   */
  private async updateCampaignStatus(
    config: AutomationConfig,
    result: AutomationResult
  ): Promise<void> {
    try {
      await this.campaignService.updateCampaignStatus({
        campaignId: config.campaignId,
        status: result.success ? 'ACTIVE' : 'NEEDS_ATTENTION',
        lastAutomationRun: new Date(),
        automationResult: result
      });

    } catch (error) {
      logger.error('Campaign status update failed', { error: error.message });
    }
  }

  // Helper methods
  private shouldGenerateContent(config: AutomationConfig): boolean {
    const now = new Date();
    const lastGeneration = new Date(); // This would come from campaign data
    
    const frequency = config.aiSettings.copyGeneration.frequency;
    const hoursSinceLastGeneration = (now.getTime() - lastGeneration.getTime()) / (1000 * 60 * 60);
    
    switch (frequency) {
      case 'DAILY':
        return hoursSinceLastGeneration >= 24;
      case 'WEEKLY':
        return hoursSinceLastGeneration >= 168; // 7 days
      case 'MONTHLY':
        return hoursSinceLastGeneration >= 720; // 30 days
      default:
        return false;
    }
  }

  private evaluateCondition(condition: PauseCondition | ScaleCondition, performance: any): boolean {
    const value = performance[condition.metric];
    if (value === undefined) return false;

    switch (condition.operator) {
      case 'LESS_THAN':
        return value < condition.value;
      case 'GREATER_THAN':
        return value > condition.value;
      case 'EQUALS':
        return value === condition.value;
      default:
        return false;
    }
  }

  private async executePauseAction(condition: PauseCondition, config: AutomationConfig): Promise<AutomationAction> {
    // Implementation for pause action
    return {
      id: `pause_${Date.now()}`,
      type: 'PAUSE_CAMPAIGN',
      description: `Paused campaign due to ${condition.metric} ${condition.operator} ${condition.value}`,
      status: 'APPLIED',
      timestamp: new Date()
    };
  }

  private async executeScaleAction(condition: ScaleCondition, config: AutomationConfig): Promise<AutomationAction> {
    // Implementation for scale action
    return {
      id: `scale_${Date.now()}`,
      type: 'SCALE_CAMPAIGN',
      description: `Scaled campaign due to ${condition.metric} ${condition.operator} ${condition.value}`,
      status: 'APPLIED',
      timestamp: new Date()
    };
  }

  private isTestReadyForAnalysis(test: any): boolean {
    const now = new Date();
    const testDuration = (now.getTime() - test.startDate.getTime()) / (1000 * 60 * 60 * 24);
    return testDuration >= test.minDuration;
  }

  private calculateNextRun(config: AutomationConfig): Date {
    const now = new Date();
    const frequency = config.aiSettings.performanceOptimization.frequency;
    
    switch (frequency) {
      case 'HOURLY':
        return new Date(now.getTime() + 60 * 60 * 1000);
      case 'DAILY':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case 'WEEKLY':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  private formatNotificationContent(result: AutomationResult): string {
    let content = 'AI Ads Automation Report\n\n';
    
    if (result.insights.length > 0) {
      content += `Insights (${result.insights.length}):\n`;
      result.insights.slice(0, 3).forEach(insight => {
        content += `- ${insight.title}: ${insight.description}\n`;
      });
    }
    
    if (result.actions.length > 0) {
      content += `\nActions Applied (${result.actions.length}):\n`;
      result.actions.slice(0, 3).forEach(action => {
        content += `- ${action.type}: ${action.description}\n`;
      });
    }
    
    return content;
  }
}



