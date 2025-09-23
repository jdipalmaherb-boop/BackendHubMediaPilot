import { logger } from '../utils/logger.js';
import { MetaAdsAPI } from './MetaAdsAPI.js';
import { GoogleAdsAPI } from './GoogleAdsAPI.js';
import { TikTokAdsAPI } from './TikTokAdsAPI.js';
import { LinkedInAdsAPI } from './LinkedInAdsAPI.js';
import { TwitterAdsAPI } from './TwitterAdsAPI.js';

interface PlatformConfig {
  platform: 'META' | 'GOOGLE' | 'TIKTOK' | 'LINKEDIN' | 'TWITTER';
  accountId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  settings: any;
}

interface CampaignPerformance {
  campaignId: string;
  platform: string;
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
  timestamp: Date;
}

interface CampaignData {
  id: string;
  name: string;
  status: string;
  objective: string;
  budget: number;
  dailyBudget: number;
  startDate: Date;
  endDate?: Date;
  settings: any;
}

interface AdGroupData {
  id: string;
  campaignId: string;
  name: string;
  status: string;
  bidStrategy: string;
  bidAmount?: number;
  targeting: any;
  placements: string[];
  schedule: any;
}

interface CreativeData {
  id: string;
  campaignId: string;
  adGroupId?: string;
  name: string;
  type: string;
  format: string;
  content: any;
  assets: any[];
  status: string;
}

interface AudienceData {
  id: string;
  campaignId: string;
  name: string;
  type: string;
  demographics: any;
  interests: string[];
  behaviors: string[];
  size: number;
  status: string;
}

export class PlatformManager {
  private platforms: Map<string, any> = new Map();

  constructor() {
    this.initializePlatforms();
  }

  /**
   * Initialize platform APIs
   */
  private initializePlatforms(): void {
    this.platforms.set('META', new MetaAdsAPI());
    this.platforms.set('GOOGLE', new GoogleAdsAPI());
    this.platforms.set('TIKTOK', new TikTokAdsAPI());
    this.platforms.set('LINKEDIN', new LinkedInAdsAPI());
    this.platforms.set('TWITTER', new TwitterAdsAPI());
  }

  /**
   * Get platform API instance
   */
  private getPlatformAPI(platform: string): any {
    const api = this.platforms.get(platform);
    if (!api) {
      throw new Error(`Unsupported platform: ${platform}`);
    }
    return api;
  }

  /**
   * Configure platform connection
   */
  async configurePlatform(config: PlatformConfig): Promise<void> {
    try {
      const api = this.getPlatformAPI(config.platform);
      await api.configure(config);
      
      logger.info('Platform configured successfully', { 
        platform: config.platform,
        accountId: config.accountId
      });

    } catch (error) {
      logger.error('Platform configuration failed', { 
        platform: config.platform,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get campaign performance data
   */
  async getCampaignPerformance(
    campaignId: string,
    platform: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<CampaignPerformance> {
    try {
      const api = this.getPlatformAPI(platform);
      const performance = await api.getCampaignPerformance(campaignId, dateRange);
      
      logger.info('Campaign performance retrieved', { 
        campaignId,
        platform,
        impressions: performance.impressions,
        spend: performance.spend
      });

      return performance;

    } catch (error) {
      logger.error('Failed to get campaign performance', { 
        campaignId,
        platform,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create a new campaign
   */
  async createCampaign(
    platform: string,
    campaignData: CampaignData,
    adGroups: AdGroupData[],
    creatives: CreativeData[],
    audiences: AudienceData[]
  ): Promise<string> {
    try {
      const api = this.getPlatformAPI(platform);
      
      // Create campaign
      const campaignId = await api.createCampaign(campaignData);
      
      // Create ad groups
      for (const adGroup of adGroups) {
        adGroup.campaignId = campaignId;
        await api.createAdGroup(adGroup);
      }
      
      // Create creatives
      for (const creative of creatives) {
        creative.campaignId = campaignId;
        await api.createCreative(creative);
      }
      
      // Create audiences
      for (const audience of audiences) {
        audience.campaignId = campaignId;
        await api.createAudience(audience);
      }

      logger.info('Campaign created successfully', { 
        platform,
        campaignId,
        adGroupsCount: adGroups.length,
        creativesCount: creatives.length,
        audiencesCount: audiences.length
      });

      return campaignId;

    } catch (error) {
      logger.error('Campaign creation failed', { 
        platform,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update campaign settings
   */
  async updateCampaign(
    platform: string,
    campaignId: string,
    updates: Partial<CampaignData>
  ): Promise<void> {
    try {
      const api = this.getPlatformAPI(platform);
      await api.updateCampaign(campaignId, updates);
      
      logger.info('Campaign updated successfully', { 
        platform,
        campaignId,
        updates: Object.keys(updates)
      });

    } catch (error) {
      logger.error('Campaign update failed', { 
        platform,
        campaignId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Pause campaign
   */
  async pauseCampaign(platform: string, campaignId: string): Promise<void> {
    try {
      const api = this.getPlatformAPI(platform);
      await api.pauseCampaign(campaignId);
      
      logger.info('Campaign paused successfully', { 
        platform,
        campaignId
      });

    } catch (error) {
      logger.error('Campaign pause failed', { 
        platform,
        campaignId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Resume campaign
   */
  async resumeCampaign(platform: string, campaignId: string): Promise<void> {
    try {
      const api = this.getPlatformAPI(platform);
      await api.resumeCampaign(campaignId);
      
      logger.info('Campaign resumed successfully', { 
        platform,
        campaignId
      });

    } catch (error) {
      logger.error('Campaign resume failed', { 
        platform,
        campaignId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update bid strategy
   */
  async updateBidStrategy(
    platform: string,
    campaignId: string,
    bidStrategy: string,
    bidAmount?: number
  ): Promise<void> {
    try {
      const api = this.getPlatformAPI(platform);
      await api.updateBidStrategy(campaignId, bidStrategy, bidAmount);
      
      logger.info('Bid strategy updated successfully', { 
        platform,
        campaignId,
        bidStrategy,
        bidAmount
      });

    } catch (error) {
      logger.error('Bid strategy update failed', { 
        platform,
        campaignId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update budget allocation
   */
  async updateBudgetAllocation(
    platform: string,
    campaignId: string,
    budgetAllocation: { [audienceId: string]: number }
  ): Promise<void> {
    try {
      const api = this.getPlatformAPI(platform);
      await api.updateBudgetAllocation(campaignId, budgetAllocation);
      
      logger.info('Budget allocation updated successfully', { 
        platform,
        campaignId,
        allocationCount: Object.keys(budgetAllocation).length
      });

    } catch (error) {
      logger.error('Budget allocation update failed', { 
        platform,
        campaignId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update targeting
   */
  async updateTargeting(
    platform: string,
    campaignId: string,
    targeting: any
  ): Promise<void> {
    try {
      const api = this.getPlatformAPI(platform);
      await api.updateTargeting(campaignId, targeting);
      
      logger.info('Targeting updated successfully', { 
        platform,
        campaignId
      });

    } catch (error) {
      logger.error('Targeting update failed', { 
        platform,
        campaignId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update creative
   */
  async updateCreative(
    platform: string,
    creativeId: string,
    updates: Partial<CreativeData>
  ): Promise<void> {
    try {
      const api = this.getPlatformAPI(platform);
      await api.updateCreative(creativeId, updates);
      
      logger.info('Creative updated successfully', { 
        platform,
        creativeId
      });

    } catch (error) {
      logger.error('Creative update failed', { 
        platform,
        creativeId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get available placements
   */
  async getAvailablePlacements(platform: string): Promise<string[]> {
    try {
      const api = this.getPlatformAPI(platform);
      const placements = await api.getAvailablePlacements();
      
      logger.info('Available placements retrieved', { 
        platform,
        count: placements.length
      });

      return placements;

    } catch (error) {
      logger.error('Failed to get available placements', { 
        platform,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get targeting options
   */
  async getTargetingOptions(platform: string): Promise<any> {
    try {
      const api = this.getPlatformAPI(platform);
      const options = await api.getTargetingOptions();
      
      logger.info('Targeting options retrieved', { 
        platform
      });

      return options;

    } catch (error) {
      logger.error('Failed to get targeting options', { 
        platform,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get audience insights
   */
  async getAudienceInsights(
    platform: string,
    audienceId: string
  ): Promise<any> {
    try {
      const api = this.getPlatformAPI(platform);
      const insights = await api.getAudienceInsights(audienceId);
      
      logger.info('Audience insights retrieved', { 
        platform,
        audienceId
      });

      return insights;

    } catch (error) {
      logger.error('Failed to get audience insights', { 
        platform,
        audienceId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Test campaign before launch
   */
  async testCampaign(
    platform: string,
    campaignId: string
  ): Promise<any> {
    try {
      const api = this.getPlatformAPI(platform);
      const testResult = await api.testCampaign(campaignId);
      
      logger.info('Campaign test completed', { 
        platform,
        campaignId,
        success: testResult.success
      });

      return testResult;

    } catch (error) {
      logger.error('Campaign test failed', { 
        platform,
        campaignId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get platform-specific recommendations
   */
  async getPlatformRecommendations(
    platform: string,
    campaignId: string
  ): Promise<any[]> {
    try {
      const api = this.getPlatformAPI(platform);
      const recommendations = await api.getRecommendations(campaignId);
      
      logger.info('Platform recommendations retrieved', { 
        platform,
        campaignId,
        count: recommendations.length
      });

      return recommendations;

    } catch (error) {
      logger.error('Failed to get platform recommendations', { 
        platform,
        campaignId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Validate platform connection
   */
  async validateConnection(platform: string): Promise<boolean> {
    try {
      const api = this.getPlatformAPI(platform);
      const isValid = await api.validateConnection();
      
      logger.info('Platform connection validated', { 
        platform,
        isValid
      });

      return isValid;

    } catch (error) {
      logger.error('Platform connection validation failed', { 
        platform,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(platform: string): Promise<string> {
    try {
      const api = this.getPlatformAPI(platform);
      const newToken = await api.refreshAccessToken();
      
      logger.info('Access token refreshed', { 
        platform
      });

      return newToken;

    } catch (error) {
      logger.error('Access token refresh failed', { 
        platform,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get platform status
   */
  async getPlatformStatus(platform: string): Promise<any> {
    try {
      const api = this.getPlatformAPI(platform);
      const status = await api.getStatus();
      
      return status;

    } catch (error) {
      logger.error('Failed to get platform status', { 
        platform,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get all campaigns for a platform
   */
  async getCampaigns(platform: string): Promise<CampaignData[]> {
    try {
      const api = this.getPlatformAPI(platform);
      const campaigns = await api.getCampaigns();
      
      logger.info('Campaigns retrieved', { 
        platform,
        count: campaigns.length
      });

      return campaigns;

    } catch (error) {
      logger.error('Failed to get campaigns', { 
        platform,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get campaign details
   */
  async getCampaignDetails(
    platform: string,
    campaignId: string
  ): Promise<CampaignData> {
    try {
      const api = this.getPlatformAPI(platform);
      const campaign = await api.getCampaignDetails(campaignId);
      
      logger.info('Campaign details retrieved', { 
        platform,
        campaignId
      });

      return campaign;

    } catch (error) {
      logger.error('Failed to get campaign details', { 
        platform,
        campaignId,
        error: error.message
      });
      throw error;
    }
  }
}



