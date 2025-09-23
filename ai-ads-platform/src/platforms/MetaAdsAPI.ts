import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger.js';

interface MetaConfig {
  platform: 'META';
  accountId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  settings: {
    apiVersion: string;
    baseUrl: string;
  };
}

interface MetaCampaignPerformance {
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

interface MetaCampaignData {
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

interface MetaAdGroupData {
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

interface MetaCreativeData {
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

interface MetaAudienceData {
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

export class MetaAdsAPI {
  private config: MetaConfig | null = null;
  private api: AxiosInstance | null = null;

  /**
   * Configure Meta Ads API
   */
  async configure(config: MetaConfig): Promise<void> {
    this.config = config;
    
    this.api = axios.create({
      baseURL: `${config.settings.baseUrl}/v${config.settings.apiVersion}`,
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    // Add request interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          logger.error('Meta API authentication failed', { error: error.message });
          throw new Error('Authentication failed. Please refresh your access token.');
        }
        return Promise.reject(error);
      }
    );

    logger.info('Meta Ads API configured', { 
      accountId: config.accountId,
      apiVersion: config.settings.apiVersion
    });
  }

  /**
   * Get campaign performance data
   */
  async getCampaignPerformance(
    campaignId: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<MetaCampaignPerformance> {
    if (!this.api) {
      throw new Error('Meta API not configured');
    }

    try {
      const startDate = dateRange?.start.toISOString().split('T')[0] || 
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = dateRange?.end.toISOString().split('T')[0] || 
        new Date().toISOString().split('T')[0];

      const response = await this.api.get(`/${campaignId}/insights`, {
        params: {
          fields: [
            'impressions',
            'clicks',
            'conversions',
            'spend',
            'ctr',
            'cpc',
            'cpa',
            'roas',
            'engagement_rate',
            'video_views',
            'video_completion_rate'
          ].join(','),
          time_range: JSON.stringify({
            since: startDate,
            until: endDate
          }),
          level: 'campaign'
        }
      });

      const data = response.data.data[0];
      
      const performance: MetaCampaignPerformance = {
        campaignId,
        platform: 'META',
        impressions: parseInt(data.impressions) || 0,
        clicks: parseInt(data.clicks) || 0,
        conversions: parseInt(data.conversions) || 0,
        spend: parseFloat(data.spend) || 0,
        ctr: parseFloat(data.ctr) || 0,
        cpc: parseFloat(data.cpc) || 0,
        cpa: parseFloat(data.cpa) || 0,
        roas: parseFloat(data.roas) || 0,
        engagementRate: parseFloat(data.engagement_rate) || 0,
        videoViews: parseInt(data.video_views) || 0,
        completionRate: parseFloat(data.video_completion_rate) || 0,
        timestamp: new Date()
      };

      logger.info('Meta campaign performance retrieved', { 
        campaignId,
        impressions: performance.impressions,
        spend: performance.spend
      });

      return performance;

    } catch (error) {
      logger.error('Failed to get Meta campaign performance', { 
        campaignId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create a new campaign
   */
  async createCampaign(campaignData: MetaCampaignData): Promise<string> {
    if (!this.api) {
      throw new Error('Meta API not configured');
    }

    try {
      const campaignPayload = {
        name: campaignData.name,
        objective: this.mapObjectiveToMeta(campaignData.objective),
        status: campaignData.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED',
        budget_remaining: campaignData.budget,
        daily_budget: campaignData.dailyBudget,
        start_time: Math.floor(campaignData.startDate.getTime() / 1000),
        ...(campaignData.endDate && {
          stop_time: Math.floor(campaignData.endDate.getTime() / 1000)
        }),
        ...campaignData.settings
      };

      const response = await this.api.post(`/act_${this.config!.accountId}/campaigns`, campaignPayload);
      const campaignId = response.data.id;

      logger.info('Meta campaign created successfully', { 
        campaignId,
        name: campaignData.name
      });

      return campaignId;

    } catch (error) {
      logger.error('Meta campaign creation failed', { 
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update campaign settings
   */
  async updateCampaign(
    campaignId: string,
    updates: Partial<MetaCampaignData>
  ): Promise<void> {
    if (!this.api) {
      throw new Error('Meta API not configured');
    }

    try {
      const updatePayload: any = {};

      if (updates.name) updatePayload.name = updates.name;
      if (updates.status) updatePayload.status = updates.status;
      if (updates.budget) updatePayload.budget_remaining = updates.budget;
      if (updates.dailyBudget) updatePayload.daily_budget = updates.dailyBudget;
      if (updates.endDate) {
        updatePayload.stop_time = Math.floor(updates.endDate.getTime() / 1000);
      }

      await this.api.post(`/${campaignId}`, updatePayload);

      logger.info('Meta campaign updated successfully', { 
        campaignId,
        updates: Object.keys(updatePayload)
      });

    } catch (error) {
      logger.error('Meta campaign update failed', { 
        campaignId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Pause campaign
   */
  async pauseCampaign(campaignId: string): Promise<void> {
    await this.updateCampaign(campaignId, { status: 'PAUSED' });
  }

  /**
   * Resume campaign
   */
  async resumeCampaign(campaignId: string): Promise<void> {
    await this.updateCampaign(campaignId, { status: 'ACTIVE' });
  }

  /**
   * Update bid strategy
   */
  async updateBidStrategy(
    campaignId: string,
    bidStrategy: string,
    bidAmount?: number
  ): Promise<void> {
    if (!this.api) {
      throw new Error('Meta API not configured');
    }

    try {
      // Get ad sets for the campaign
      const adSetsResponse = await this.api.get(`/${campaignId}/adsets`);
      const adSets = adSetsResponse.data.data;

      // Update bid strategy for each ad set
      for (const adSet of adSets) {
        const updatePayload: any = {
          bid_strategy: this.mapBidStrategyToMeta(bidStrategy)
        };

        if (bidAmount && bidStrategy === 'MANUAL') {
          updatePayload.bid_amount = bidAmount;
        }

        await this.api.post(`/${adSet.id}`, updatePayload);
      }

      logger.info('Meta bid strategy updated successfully', { 
        campaignId,
        bidStrategy,
        bidAmount
      });

    } catch (error) {
      logger.error('Meta bid strategy update failed', { 
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
    campaignId: string,
    budgetAllocation: { [audienceId: string]: number }
  ): Promise<void> {
    if (!this.api) {
      throw new Error('Meta API not configured');
    }

    try {
      // Get ad sets for the campaign
      const adSetsResponse = await this.api.get(`/${campaignId}/adsets`);
      const adSets = adSetsResponse.data.data;

      // Update budget for each ad set based on audience
      for (const adSet of adSets) {
        const audienceId = adSet.targeting?.custom_audiences?.[0]?.id;
        if (audienceId && budgetAllocation[audienceId]) {
          await this.api.post(`/${adSet.id}`, {
            daily_budget: budgetAllocation[audienceId]
          });
        }
      }

      logger.info('Meta budget allocation updated successfully', { 
        campaignId,
        allocationCount: Object.keys(budgetAllocation).length
      });

    } catch (error) {
      logger.error('Meta budget allocation update failed', { 
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
    campaignId: string,
    targeting: any
  ): Promise<void> {
    if (!this.api) {
      throw new Error('Meta API not configured');
    }

    try {
      // Get ad sets for the campaign
      const adSetsResponse = await this.api.get(`/${campaignId}/adsets`);
      const adSets = adSetsResponse.data.data;

      // Update targeting for each ad set
      for (const adSet of adSets) {
        await this.api.post(`/${adSet.id}`, {
          targeting: this.mapTargetingToMeta(targeting)
        });
      }

      logger.info('Meta targeting updated successfully', { 
        campaignId
      });

    } catch (error) {
      logger.error('Meta targeting update failed', { 
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
    creativeId: string,
    updates: Partial<MetaCreativeData>
  ): Promise<void> {
    if (!this.api) {
      throw new Error('Meta API not configured');
    }

    try {
      const updatePayload: any = {};

      if (updates.name) updatePayload.name = updates.name;
      if (updates.status) updatePayload.status = updates.status;
      if (updates.content) {
        updatePayload.object_story_spec = this.mapCreativeContentToMeta(updates.content);
      }

      await this.api.post(`/${creativeId}`, updatePayload);

      logger.info('Meta creative updated successfully', { 
        creativeId
      });

    } catch (error) {
      logger.error('Meta creative update failed', { 
        creativeId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get available placements
   */
  async getAvailablePlacements(): Promise<string[]> {
    return [
      'feed',
      'stories',
      'reels',
      'marketplace',
      'video_feeds',
      'messenger',
      'instagram_explore',
      'instagram_shop',
      'facebook_search',
      'facebook_marketplace',
      'facebook_video_feeds',
      'messenger_stories',
      'instagram_stories',
      'instagram_feed',
      'instagram_reels'
    ];
  }

  /**
   * Get targeting options
   */
  async getTargetingOptions(): Promise<any> {
    if (!this.api) {
      throw new Error('Meta API not configured');
    }

    try {
      const response = await this.api.get('/search', {
        params: {
          type: 'adinterest',
          q: 'technology'
        }
      });

      return {
        interests: response.data.data,
        demographics: {
          age: { min: 18, max: 65 },
          genders: ['male', 'female'],
          locations: ['US', 'CA', 'UK', 'AU'],
          languages: ['en', 'es', 'fr']
        },
        behaviors: [
          'small_business_owners',
          'frequent_travelers',
          'online_shoppers',
          'mobile_device_users'
        ]
      };

    } catch (error) {
      logger.error('Failed to get Meta targeting options', { 
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get audience insights
   */
  async getAudienceInsights(audienceId: string): Promise<any> {
    if (!this.api) {
      throw new Error('Meta API not configured');
    }

    try {
      const response = await this.api.get(`/${audienceId}/insights`, {
        params: {
          fields: [
            'audience_size',
            'reach',
            'frequency',
            'impressions',
            'clicks',
            'spend',
            'ctr',
            'cpc',
            'cpa'
          ].join(',')
        }
      });

      return response.data.data[0];

    } catch (error) {
      logger.error('Failed to get Meta audience insights', { 
        audienceId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Test campaign before launch
   */
  async testCampaign(campaignId: string): Promise<any> {
    if (!this.api) {
      throw new Error('Meta API not configured');
    }

    try {
      const response = await this.api.get(`/${campaignId}/previews`, {
        params: {
          ad_format: 'DESKTOP_FEED_STANDARD'
        }
      });

      return {
        success: true,
        previews: response.data.data,
        message: 'Campaign test completed successfully'
      };

    } catch (error) {
      logger.error('Meta campaign test failed', { 
        campaignId,
        error: error.message
      });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get platform recommendations
   */
  async getRecommendations(campaignId: string): Promise<any[]> {
    if (!this.api) {
      throw new Error('Meta API not configured');
    }

    try {
      const response = await this.api.get(`/${campaignId}/recommendations`);
      
      return response.data.data.map((rec: any) => ({
        type: rec.type,
        title: rec.title,
        description: rec.description,
        priority: rec.priority,
        action: rec.action
      }));

    } catch (error) {
      logger.error('Failed to get Meta recommendations', { 
        campaignId,
        error: error.message
      });
      return [];
    }
  }

  /**
   * Validate connection
   */
  async validateConnection(): Promise<boolean> {
    if (!this.api) {
      return false;
    }

    try {
      await this.api.get(`/act_${this.config!.accountId}`);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(): Promise<string> {
    // Meta doesn't provide refresh tokens, user needs to re-authenticate
    throw new Error('Meta API requires manual re-authentication');
  }

  /**
   * Get platform status
   */
  async getStatus(): Promise<any> {
    if (!this.api) {
      return { status: 'disconnected' };
    }

    try {
      const response = await this.api.get(`/act_${this.config!.accountId}`);
      return {
        status: 'connected',
        accountId: this.config!.accountId,
        accountName: response.data.name
      };
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }

  /**
   * Get all campaigns
   */
  async getCampaigns(): Promise<MetaCampaignData[]> {
    if (!this.api) {
      throw new Error('Meta API not configured');
    }

    try {
      const response = await this.api.get(`/act_${this.config!.accountId}/campaigns`, {
        params: {
          fields: 'id,name,status,objective,budget_remaining,daily_budget,start_time,stop_time'
        }
      });

      return response.data.data.map((campaign: any) => ({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        objective: this.mapObjectiveFromMeta(campaign.objective),
        budget: campaign.budget_remaining,
        dailyBudget: campaign.daily_budget,
        startDate: new Date(campaign.start_time * 1000),
        endDate: campaign.stop_time ? new Date(campaign.stop_time * 1000) : undefined,
        settings: {}
      }));

    } catch (error) {
      logger.error('Failed to get Meta campaigns', { 
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get campaign details
   */
  async getCampaignDetails(campaignId: string): Promise<MetaCampaignData> {
    if (!this.api) {
      throw new Error('Meta API not configured');
    }

    try {
      const response = await this.api.get(`/${campaignId}`, {
        params: {
          fields: 'id,name,status,objective,budget_remaining,daily_budget,start_time,stop_time'
        }
      });

      const campaign = response.data;
      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        objective: this.mapObjectiveFromMeta(campaign.objective),
        budget: campaign.budget_remaining,
        dailyBudget: campaign.daily_budget,
        startDate: new Date(campaign.start_time * 1000),
        endDate: campaign.stop_time ? new Date(campaign.stop_time * 1000) : undefined,
        settings: {}
      };

    } catch (error) {
      logger.error('Failed to get Meta campaign details', { 
        campaignId,
        error: error.message
      });
      throw error;
    }
  }

  // Helper methods for mapping between our format and Meta's format
  private mapObjectiveToMeta(objective: string): string {
    const mapping: { [key: string]: string } = {
      'AWARENESS': 'BRAND_AWARENESS',
      'TRAFFIC': 'LINK_CLICKS',
      'ENGAGEMENT': 'POST_ENGAGEMENT',
      'LEADS': 'LEAD_GENERATION',
      'SALES': 'CONVERSIONS',
      'APP_INSTALLS': 'APP_INSTALLS',
      'VIDEO_VIEWS': 'VIDEO_VIEWS'
    };
    return mapping[objective] || 'CONVERSIONS';
  }

  private mapObjectiveFromMeta(objective: string): string {
    const mapping: { [key: string]: string } = {
      'BRAND_AWARENESS': 'AWARENESS',
      'LINK_CLICKS': 'TRAFFIC',
      'POST_ENGAGEMENT': 'ENGAGEMENT',
      'LEAD_GENERATION': 'LEADS',
      'CONVERSIONS': 'SALES',
      'APP_INSTALLS': 'APP_INSTALLS',
      'VIDEO_VIEWS': 'VIDEO_VIEWS'
    };
    return mapping[objective] || 'SALES';
  }

  private mapBidStrategyToMeta(strategy: string): string {
    const mapping: { [key: string]: string } = {
      'MANUAL': 'BID_FIXED',
      'TARGET_CPA': 'BID_TARGET_COST_PER_ACTION',
      'TARGET_ROAS': 'BID_TARGET_ROAS',
      'MAXIMIZE_CONVERSIONS': 'BID_OPTIMIZE_FOR_CONVERSION',
      'MAXIMIZE_CLICKS': 'BID_OPTIMIZE_FOR_CLICKS',
      'LOWEST_COST': 'BID_OPTIMIZE_FOR_IMPRESSIONS'
    };
    return mapping[strategy] || 'BID_OPTIMIZE_FOR_CONVERSION';
  }

  private mapTargetingToMeta(targeting: any): any {
    return {
      age_min: targeting.ageMin || 18,
      age_max: targeting.ageMax || 65,
      genders: targeting.genders || ['male', 'female'],
      geo_locations: {
        countries: targeting.locations || ['US']
      },
      interests: targeting.interests?.map((interest: string) => ({ name: interest })) || [],
      behaviors: targeting.behaviors?.map((behavior: string) => ({ name: behavior })) || []
    };
  }

  private mapCreativeContentToMeta(content: any): any {
    return {
      page_id: content.pageId,
      link_data: {
        message: content.primaryText,
        name: content.headline,
        call_to_action: {
          type: content.cta
        }
      }
    };
  }
}



