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
  TikTokTargeting
} from './adapter';
import { prisma } from '../lib/prisma';

interface TikTokCampaign {
  id: string;
  name: string;
  status: string;
  budget_mode: string;
  budget: number;
  objective_type: string;
  created_time: string;
  updated_time: string;
}

interface TikTokAdGroup {
  id: string;
  name: string;
  campaign_id: string;
  status: string;
  budget: number;
  bid_type: string;
  bid_price: number;
  targeting: any;
  placement_type: string;
}

interface TikTokAd {
  id: string;
  name: string;
  adgroup_id: string;
  status: string;
  creative: {
    id: string;
    name: string;
    landing_page_url: string;
    call_to_action: string;
  };
}

export class TikTokAdapter implements AdPlatform {
  private config: AdPlatformConfig;
  private baseUrl = 'https://business-api.tiktok.com/open_api/v1.3';
  private sandboxMode: boolean;

  constructor(config: AdPlatformConfig) {
    this.config = config;
    this.sandboxMode = config.sandboxMode;
  }

  private async makeRequest(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', data?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Access-Token': this.config.credentials.accessToken!,
    };

    if (this.sandboxMode) {
      headers['X-Test-Mode'] = 'true';
    }

    const requestOptions: RequestInit = {
      method,
      headers,
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      requestOptions.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, requestOptions);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new AdPlatformError(
          `TikTok API error: ${response.status} ${response.statusText}`,
          'tiktok',
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
        'tiktok',
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

  private async persistCampaignRequest(operation: string, campaignId: string, data: any): Promise<void> {
    // In sandbox mode, persist campaign requests to DB for manual review
    if (this.sandboxMode) {
      try {
        await prisma.adCampaignRequest.create({
          data: {
            platform: 'tiktok',
            operation,
            campaignId,
            requestData: data,
            status: 'pending_review',
            createdAt: new Date(),
          },
        });
      } catch (error) {
        console.error('Failed to persist campaign request:', error);
      }
    }
  }

  private validateTargeting(targeting: any): TikTokTargeting {
    if (!targeting || typeof targeting !== 'object') {
      throw new AdPlatformError('Invalid targeting configuration', 'tiktok', 'createCampaign', 'INVALID_TARGETING');
    }

    // Validate age range
    if (targeting.age_min && (targeting.age_min < 13 || targeting.age_min > 65)) {
      throw new AdPlatformError('Age minimum must be between 13 and 65', 'tiktok', 'createCampaign', 'INVALID_TARGETING');
    }

    if (targeting.age_max && (targeting.age_max < 13 || targeting.age_max > 65)) {
      throw new AdPlatformError('Age maximum must be between 13 and 65', 'tiktok', 'createCampaign', 'INVALID_TARGETING');
    }

    return targeting as TikTokTargeting;
  }

  async createCampaign(spec: CampaignSpec): Promise<{ id: string }> {
    const startTime = Date.now();
    
    try {
      // Validate budget
      const minBudgetCents = this.config.settings?.defaultBudgetCents || 2000; // TikTok minimum is usually higher
      if (spec.budgetCents < minBudgetCents) {
        throw new InsufficientBudgetError('tiktok', spec.budgetCents, minBudgetCents);
      }

      // Validate creative exists
      if (!spec.creativeKey || spec.creativeKey.length < 3) {
        throw new CreativeNotFoundError('tiktok', spec.creativeKey);
      }

      // Validate targeting
      const validatedTargeting = this.validateTargeting(spec.targeting);

      const advertiserId = this.config.credentials.advertiserId!;
      const dailyBudgetCents = Math.floor(spec.budgetCents / 30);

      // Create campaign
      const campaignData = {
        advertiser_id: advertiserId,
        name: spec.title,
        budget_mode: 'BUDGET_MODE_DAY',
        budget: dailyBudgetCents,
        objective_type: 'TRAFFIC', // Default objective
        status: 'ENABLE',
      };

      const campaignResponse = await this.makeRequest('/campaign/create/', 'POST', campaignData);
      const campaignId = campaignResponse.data?.campaign_id;

      if (!campaignId) {
        throw new AdPlatformError('Failed to create campaign', 'tiktok', 'createCampaign', 'CREATE_FAILED');
      }

      // Create ad group
      const adGroupData = {
        advertiser_id: advertiserId,
        campaign_id: campaignId,
        name: `${spec.title} - Ad Group`,
        budget: dailyBudgetCents,
        bid_type: 'BID_TYPE_NO_BID',
        placement_type: 'PLACEMENT_TYPE_AUTOMATIC',
        targeting: validatedTargeting,
        status: 'ENABLE',
      };

      const adGroupResponse = await this.makeRequest('/adgroup/create/', 'POST', adGroupData);
      const adGroupId = adGroupResponse.data?.adgroup_id;

      // Create ad
      const adData = {
        advertiser_id: advertiserId,
        adgroup_id: adGroupId,
        name: `${spec.title} - Ad`,
        landing_page_url: spec.metadata?.landingPageUrl || 'https://example.com',
        call_to_action: 'LEARN_MORE',
        creative: {
          creative_name: `${spec.title} - Creative`,
          creative_type: 'IMAGE',
          // TikTok creative upload would go here
        },
        status: 'ENABLE',
      };

      const adResponse = await this.makeRequest('/ad/create/', 'POST', adData);

      const responseTime = Date.now() - startTime;

      // Persist request for manual review in sandbox mode
      await this.persistCampaignRequest('create', campaignId, {
        spec,
        campaignId,
        adGroupId,
        adId: adResponse.data?.ad_id,
      });

      // Log metrics
      await this.logMetrics({
        platform: 'tiktok',
        operation: 'create',
        campaignId,
        requestTime: startTime,
        responseTime,
        success: true,
        costCents: 0,
        metadata: { 
          spec, 
          campaignId, 
          adGroupId, 
          adId: adResponse.data?.ad_id,
          sandboxMode: this.sandboxMode 
        },
      });

      return { id: campaignId };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      await this.logMetrics({
        platform: 'tiktok',
        operation: 'create',
        requestTime: startTime,
        responseTime,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: { spec, sandboxMode: this.sandboxMode },
      });

      throw error;
    }
  }

  async updateCampaign(id: string, spec: CampaignUpdateSpec): Promise<void> {
    const startTime = Date.now();
    
    try {
      const updateData: any = {
        advertiser_id: this.config.credentials.advertiserId!,
        campaign_id: id,
      };

      if (spec.title !== undefined) {
        updateData.name = spec.title;
      }

      if (spec.budgetCents !== undefined) {
        const minBudgetCents = this.config.settings?.defaultBudgetCents || 2000;
        if (spec.budgetCents < minBudgetCents) {
          throw new InsufficientBudgetError('tiktok', spec.budgetCents, minBudgetCents);
        }
        updateData.budget = Math.floor(spec.budgetCents / 30);
      }

      if (spec.targeting !== undefined) {
        updateData.targeting = this.validateTargeting(spec.targeting);
      }

      await this.makeRequest('/campaign/update/', 'POST', updateData);

      const responseTime = Date.now() - startTime;

      // Persist request for manual review in sandbox mode
      await this.persistCampaignRequest('update', id, { spec });

      await this.logMetrics({
        platform: 'tiktok',
        operation: 'update',
        campaignId: id,
        requestTime: startTime,
        responseTime,
        success: true,
        costCents: 0,
        metadata: { spec, sandboxMode: this.sandboxMode },
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      await this.logMetrics({
        platform: 'tiktok',
        operation: 'update',
        campaignId: id,
        requestTime: startTime,
        responseTime,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: { spec, sandboxMode: this.sandboxMode },
      });

      throw error;
    }
  }

  async pauseCampaign(id: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      const updateData = {
        advertiser_id: this.config.credentials.advertiserId!,
        campaign_id: id,
        status: 'DISABLE',
      };

      await this.makeRequest('/campaign/update/', 'POST', updateData);

      const responseTime = Date.now() - startTime;

      // Persist request for manual review in sandbox mode
      await this.persistCampaignRequest('pause', id, {});

      await this.logMetrics({
        platform: 'tiktok',
        operation: 'pause',
        campaignId: id,
        requestTime: startTime,
        responseTime,
        success: true,
        costCents: 0,
        metadata: { sandboxMode: this.sandboxMode },
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      await this.logMetrics({
        platform: 'tiktok',
        operation: 'pause',
        campaignId: id,
        requestTime: startTime,
        responseTime,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: { sandboxMode: this.sandboxMode },
      });

      throw error;
    }
  }

  async resumeCampaign(id: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      const updateData = {
        advertiser_id: this.config.credentials.advertiserId!,
        campaign_id: id,
        status: 'ENABLE',
      };

      await this.makeRequest('/campaign/update/', 'POST', updateData);

      const responseTime = Date.now() - startTime;

      // Persist request for manual review in sandbox mode
      await this.persistCampaignRequest('resume', id, {});

      await this.logMetrics({
        platform: 'tiktok',
        operation: 'resume',
        campaignId: id,
        requestTime: startTime,
        responseTime,
        success: true,
        costCents: 0,
        metadata: { sandboxMode: this.sandboxMode },
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      await this.logMetrics({
        platform: 'tiktok',
        operation: 'resume',
        campaignId: id,
        requestTime: startTime,
        responseTime,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: { sandboxMode: this.sandboxMode },
      });

      throw error;
    }
  }

  async getCampaignStatus(id: string): Promise<CampaignStatus> {
    const startTime = Date.now();
    
    try {
      const campaign = await this.makeRequest(`/campaign/get/?advertiser_id=${this.config.credentials.advertiserId}&campaign_ids=["${id}"]`);
      
      if (!campaign.data?.list?.[0]) {
        throw new CampaignNotFoundError('tiktok', id);
      }

      const campaignData = campaign.data.list[0];

      // Get insights
      const insights = await this.makeRequest(`/report/integrated/get/?advertiser_id=${this.config.credentials.advertiserId}&campaign_ids=["${id}"]`);
      const campaignInsights = insights.data?.list?.[0] || {};

      const status: CampaignStatus = {
        id: campaignData.campaign_id,
        status: this.mapTikTokStatus(campaignData.status),
        budgetSpentCents: Math.floor((parseFloat(campaignInsights.spend) || 0) * 100),
        impressions: parseInt(campaignInsights.impressions) || 0,
        clicks: parseInt(campaignInsights.clicks) || 0,
        conversions: parseInt(campaignInsights.conversions) || 0,
        ctr: parseFloat(campaignInsights.ctr) || 0,
        cpc: parseFloat(campaignInsights.cpc) || 0,
        cpm: parseFloat(campaignInsights.cpm) || 0,
        createdAt: campaignData.create_time,
        updatedAt: campaignData.modify_time,
        metadata: {
          budgetMode: campaignData.budget_mode,
          budget: campaignData.budget,
          objectiveType: campaignData.objective_type,
        },
      };

      const responseTime = Date.now() - startTime;

      await this.logMetrics({
        platform: 'tiktok',
        operation: 'status',
        campaignId: id,
        requestTime: startTime,
        responseTime,
        success: true,
        costCents: 0,
        metadata: { status: campaignData.status, sandboxMode: this.sandboxMode },
      });

      return status;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      await this.logMetrics({
        platform: 'tiktok',
        operation: 'status',
        campaignId: id,
        requestTime: startTime,
        responseTime,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: { sandboxMode: this.sandboxMode },
      });

      throw error;
    }
  }

  async deleteCampaign(id: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      const deleteData = {
        advertiser_id: this.config.credentials.advertiserId!,
        campaign_ids: [id],
      };

      await this.makeRequest('/campaign/delete/', 'POST', deleteData);

      const responseTime = Date.now() - startTime;

      // Persist request for manual review in sandbox mode
      await this.persistCampaignRequest('delete', id, {});

      await this.logMetrics({
        platform: 'tiktok',
        operation: 'delete',
        campaignId: id,
        requestTime: startTime,
        responseTime,
        success: true,
        costCents: 0,
        metadata: { sandboxMode: this.sandboxMode },
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      await this.logMetrics({
        platform: 'tiktok',
        operation: 'delete',
        campaignId: id,
        requestTime: startTime,
        responseTime,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: { sandboxMode: this.sandboxMode },
      });

      throw error;
    }
  }

  private mapTikTokStatus(tiktokStatus: string): CampaignStatus['status'] {
    switch (tiktokStatus.toUpperCase()) {
      case 'ENABLE':
        return 'active';
      case 'DISABLE':
        return 'paused';
      case 'PENDING':
        return 'pending';
      case 'REJECTED':
        return 'rejected';
      case 'DELETED':
        return 'failed';
      default:
        return 'pending';
    }
  }
}
