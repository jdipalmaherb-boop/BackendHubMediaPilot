import { 
  AdPlatform, 
  CampaignSpec, 
  CampaignUpdateSpec, 
  CampaignStatus, 
  AdCallMetrics,
  AdPlatformConfig,
  AdPlatformError,
  CampaignNotFoundError,
  InsufficientBudgetError,
  CreativeNotFoundError,
  MetaTargeting
} from './adapter';
import { prisma } from '../lib/prisma';

interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  created_time: string;
  updated_time: string;
  daily_budget?: number;
  lifetime_budget?: number;
  objective: string;
  special_ad_categories?: string[];
}

interface MetaAdSet {
  id: string;
  name: string;
  campaign_id: string;
  status: string;
  daily_budget?: number;
  lifetime_budget?: number;
  targeting: any;
  optimization_goal: string;
  billing_event: string;
  bid_amount?: number;
}

interface MetaAd {
  id: string;
  name: string;
  adset_id: string;
  status: string;
  creative: {
    id: string;
    name: string;
    title?: string;
    body?: string;
    call_to_action_type?: string;
    object_story_spec?: any;
  };
}

interface MetaInsights {
  campaign_id: string;
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversions?: number;
  date_start: string;
  date_stop: string;
}

export class MetaAdapter implements AdPlatform {
  private config: AdPlatformConfig;
  private baseUrl = 'https://graph.facebook.com/v18.0';

  constructor(config: AdPlatformConfig) {
    this.config = config;
  }

  private async makeRequest(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', data?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const params = new URLSearchParams({
      access_token: this.config.credentials.accessToken!,
    });

    const requestOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      requestOptions.body = JSON.stringify(data);
    }

    const fullUrl = method === 'GET' ? `${url}?${params}` : url;
    
    try {
      const response = await fetch(fullUrl, requestOptions);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new AdPlatformError(
          `Meta API error: ${response.status} ${response.statusText}`,
          'meta',
          method.toLowerCase(),
          errorData.error?.code || 'API_ERROR',
          errorData
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof AdPlatformError) {
        throw error;
      }
      throw new AdPlatformError(
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'meta',
        method.toLowerCase(),
        'NETWORK_ERROR'
      );
    }
  }

  private async logMetrics(metrics: AdCallMetrics): Promise<void> {
    try {
      await prisma.adCall.create({
        data: {
          platform: metrics.platform,
          operation: metrics.operation,
          campaignId: metrics.campaignId,
          requestTime: metrics.requestTime,
          responseTime: metrics.responseTime,
          success: metrics.success,
          errorMessage: metrics.errorMessage,
          costCents: metrics.costCents,
          meta: metrics.metadata,
        },
      });
    } catch (error) {
      console.error('Failed to log ad metrics:', error);
    }
  }

  private validateTargeting(targeting: any): MetaTargeting {
    // Basic validation for Meta targeting
    if (!targeting || typeof targeting !== 'object') {
      throw new AdPlatformError('Invalid targeting configuration', 'meta', 'createCampaign', 'INVALID_TARGETING');
    }

    // Validate age range
    if (targeting.age_min && (targeting.age_min < 13 || targeting.age_min > 65)) {
      throw new AdPlatformError('Age minimum must be between 13 and 65', 'meta', 'createCampaign', 'INVALID_TARGETING');
    }

    if (targeting.age_max && (targeting.age_max < 13 || targeting.age_max > 65)) {
      throw new AdPlatformError('Age maximum must be between 13 and 65', 'meta', 'createCampaign', 'INVALID_TARGETING');
    }

    if (targeting.age_min && targeting.age_max && targeting.age_min > targeting.age_max) {
      throw new AdPlatformError('Age minimum cannot be greater than age maximum', 'meta', 'createCampaign', 'INVALID_TARGETING');
    }

    return targeting as MetaTargeting;
  }

  async createCampaign(spec: CampaignSpec): Promise<{ id: string }> {
    const startTime = Date.now();
    
    try {
      // Validate budget
      const minBudgetCents = this.config.settings?.defaultBudgetCents || 1000;
      if (spec.budgetCents < minBudgetCents) {
        throw new InsufficientBudgetError('meta', spec.budgetCents, minBudgetCents);
      }

      // Validate creative exists
      if (!spec.creativeKey || spec.creativeKey.length < 3) {
        throw new CreativeNotFoundError('meta', spec.creativeKey);
      }

      // Validate targeting
      const validatedTargeting = this.validateTargeting(spec.targeting);

      const accountId = this.config.credentials.accountId!;
      const dailyBudgetCents = Math.floor(spec.budgetCents / 30); // Convert to daily budget

      // Create campaign
      const campaignData = {
        name: spec.title,
        objective: 'OUTCOME_TRAFFIC', // Default objective, can be made configurable
        status: 'PAUSED', // Start paused for review
        daily_budget: dailyBudgetCents,
        special_ad_categories: ['NONE'], // Default, can be made configurable
      };

      const campaignResponse = await this.makeRequest(`/${accountId}/campaigns`, 'POST', campaignData);
      const campaignId = campaignResponse.id;

      // Create ad set
      const adSetData = {
        name: `${spec.title} - Ad Set`,
        campaign_id: campaignId,
        status: 'PAUSED',
        daily_budget: dailyBudgetCents,
        targeting: validatedTargeting,
        optimization_goal: 'LINK_CLICKS',
        billing_event: 'IMPRESSIONS',
        bid_amount: Math.floor(dailyBudgetCents * 0.1), // 10% of daily budget as bid
      };

      const adSetResponse = await this.makeRequest(`/${accountId}/adsets`, 'POST', adSetData);
      const adSetId = adSetResponse.id;

      // Create ad
      const adData = {
        name: `${spec.title} - Ad`,
        adset_id: adSetId,
        status: 'PAUSED',
        creative: {
          name: `${spec.title} - Creative`,
          title: spec.metadata?.headline || spec.title,
          body: spec.metadata?.description || 'Check out our amazing offer!',
          call_to_action_type: 'LEARN_MORE',
          object_story_spec: {
            page_id: this.config.credentials.pageId,
            link_data: {
              link: spec.metadata?.landingPageUrl || 'https://example.com',
              message: spec.metadata?.description || 'Check out our amazing offer!',
            },
          },
        },
      };

      const adResponse = await this.makeRequest(`/${accountId}/ads`, 'POST', adData);

      const responseTime = Date.now() - startTime;

      // Log metrics
      await this.logMetrics({
        platform: 'meta',
        operation: 'create',
        campaignId,
        requestTime: startTime,
        responseTime,
        success: true,
        costCents: 0, // No immediate cost for creation
        metadata: { 
          spec, 
          campaignId, 
          adSetId, 
          adId: adResponse.id,
          dailyBudgetCents 
        },
      });

      return { id: campaignId };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      await this.logMetrics({
        platform: 'meta',
        operation: 'create',
        requestTime: startTime,
        responseTime,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: { spec },
      });

      throw error;
    }
  }

  async updateCampaign(id: string, spec: CampaignUpdateSpec): Promise<void> {
    const startTime = Date.now();
    
    try {
      const updateData: any = {};

      if (spec.title !== undefined) {
        updateData.name = spec.title;
      }

      if (spec.budgetCents !== undefined) {
        const minBudgetCents = this.config.settings?.defaultBudgetCents || 1000;
        if (spec.budgetCents < minBudgetCents) {
          throw new InsufficientBudgetError('meta', spec.budgetCents, minBudgetCents);
        }
        updateData.daily_budget = Math.floor(spec.budgetCents / 30);
      }

      if (spec.targeting !== undefined) {
        updateData.targeting = this.validateTargeting(spec.targeting);
      }

      if (Object.keys(updateData).length > 0) {
        await this.makeRequest(`/${id}`, 'POST', updateData);
      }

      const responseTime = Date.now() - startTime;

      await this.logMetrics({
        platform: 'meta',
        operation: 'update',
        campaignId: id,
        requestTime: startTime,
        responseTime,
        success: true,
        costCents: 0,
        metadata: { spec },
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      await this.logMetrics({
        platform: 'meta',
        operation: 'update',
        campaignId: id,
        requestTime: startTime,
        responseTime,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: { spec },
      });

      throw error;
    }
  }

  async pauseCampaign(id: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      await this.makeRequest(`/${id}`, 'POST', { status: 'PAUSED' });

      const responseTime = Date.now() - startTime;

      await this.logMetrics({
        platform: 'meta',
        operation: 'pause',
        campaignId: id,
        requestTime: startTime,
        responseTime,
        success: true,
        costCents: 0,
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      await this.logMetrics({
        platform: 'meta',
        operation: 'pause',
        campaignId: id,
        requestTime: startTime,
        responseTime,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  async resumeCampaign(id: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      await this.makeRequest(`/${id}`, 'POST', { status: 'ACTIVE' });

      const responseTime = Date.now() - startTime;

      await this.logMetrics({
        platform: 'meta',
        operation: 'resume',
        campaignId: id,
        requestTime: startTime,
        responseTime,
        success: true,
        costCents: 0,
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      await this.logMetrics({
        platform: 'meta',
        operation: 'resume',
        campaignId: id,
        requestTime: startTime,
        responseTime,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  async getCampaignStatus(id: string): Promise<CampaignStatus> {
    const startTime = Date.now();
    
    try {
      // Get campaign details
      const campaign = await this.makeRequest(`/${id}`, 'GET');
      
      if (!campaign) {
        throw new CampaignNotFoundError('meta', id);
      }

      // Get insights
      const insights = await this.makeRequest(`/${id}/insights`, 'GET');
      const campaignInsights = insights.data?.[0] || {};

      const status: CampaignStatus = {
        id: campaign.id,
        status: this.mapMetaStatus(campaign.status),
        budgetSpentCents: Math.floor((parseFloat(campaignInsights.spend) || 0) * 100),
        impressions: parseInt(campaignInsights.impressions) || 0,
        clicks: parseInt(campaignInsights.clicks) || 0,
        conversions: parseInt(campaignInsights.conversions) || 0,
        ctr: parseFloat(campaignInsights.ctr) || 0,
        cpc: parseFloat(campaignInsights.cpc) || 0,
        cpm: parseFloat(campaignInsights.cpm) || 0,
        createdAt: campaign.created_time,
        updatedAt: campaign.updated_time,
        metadata: {
          objective: campaign.objective,
          dailyBudget: campaign.daily_budget,
          lifetimeBudget: campaign.lifetime_budget,
        },
      };

      const responseTime = Date.now() - startTime;

      await this.logMetrics({
        platform: 'meta',
        operation: 'status',
        campaignId: id,
        requestTime: startTime,
        responseTime,
        success: true,
        costCents: 0,
        metadata: { status: campaign.status },
      });

      return status;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      await this.logMetrics({
        platform: 'meta',
        operation: 'status',
        campaignId: id,
        requestTime: startTime,
        responseTime,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  async deleteCampaign(id: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      await this.makeRequest(`/${id}`, 'DELETE');

      const responseTime = Date.now() - startTime;

      await this.logMetrics({
        platform: 'meta',
        operation: 'delete',
        campaignId: id,
        requestTime: startTime,
        responseTime,
        success: true,
        costCents: 0,
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      await this.logMetrics({
        platform: 'meta',
        operation: 'delete',
        campaignId: id,
        requestTime: startTime,
        responseTime,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  private mapMetaStatus(metaStatus: string): CampaignStatus['status'] {
    switch (metaStatus.toUpperCase()) {
      case 'ACTIVE':
        return 'active';
      case 'PAUSED':
        return 'paused';
      case 'PENDING_REVIEW':
      case 'PENDING_BILLING_INFO':
        return 'pending';
      case 'DISAPPROVED':
      case 'PREAPPROVED':
        return 'rejected';
      case 'ARCHIVED':
        return 'completed';
      case 'DELETED':
        return 'failed';
      default:
        return 'pending';
    }
  }
}
