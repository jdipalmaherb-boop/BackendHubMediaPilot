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
  YouTubeTargeting
} from './adapter';
import { prisma } from '../lib/prisma';

interface YouTubeCampaign {
  id: string;
  name: string;
  status: string;
  budget: number;
  budget_type: string;
  objective: string;
  created_time: string;
  updated_time: string;
}

interface YouTubeAdGroup {
  id: string;
  name: string;
  campaign_id: string;
  status: string;
  budget: number;
  bid_strategy: string;
  targeting: any;
  placement_type: string;
}

interface YouTubeAd {
  id: string;
  name: string;
  adgroup_id: string;
  status: string;
  creative: {
    id: string;
    name: string;
    final_url: string;
    call_to_action: string;
  };
}

export class YouTubeAdapter implements AdPlatform {
  private config: AdPlatformConfig;
  private baseUrl = 'https://googleads.googleapis.com/v14';
  private sandboxMode: boolean;

  constructor(config: AdPlatformConfig) {
    this.config = config;
    this.sandboxMode = config.sandboxMode;
  }

  private async makeRequest(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', data?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.credentials.accessToken!}`,
      'developer-token': this.config.credentials.developerToken!,
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
          `YouTube API error: ${response.status} ${response.statusText}`,
          'youtube',
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
        'youtube',
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
            platform: 'youtube',
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

  private validateTargeting(targeting: any): YouTubeTargeting {
    if (!targeting || typeof targeting !== 'object') {
      throw new AdPlatformError('Invalid targeting configuration', 'youtube', 'createCampaign', 'INVALID_TARGETING');
    }

    // Validate age range
    if (targeting.age_min && (targeting.age_min < 13 || targeting.age_min > 65)) {
      throw new AdPlatformError('Age minimum must be between 13 and 65', 'youtube', 'createCampaign', 'INVALID_TARGETING');
    }

    if (targeting.age_max && (targeting.age_max < 13 || targeting.age_max > 65)) {
      throw new AdPlatformError('Age maximum must be between 13 and 65', 'youtube', 'createCampaign', 'INVALID_TARGETING');
    }

    return targeting as YouTubeTargeting;
  }

  async createCampaign(spec: CampaignSpec): Promise<{ id: string }> {
    const startTime = Date.now();
    
    try {
      // Validate budget
      const minBudgetCents = this.config.settings?.defaultBudgetCents || 1000;
      if (spec.budgetCents < minBudgetCents) {
        throw new InsufficientBudgetError('youtube', spec.budgetCents, minBudgetCents);
      }

      // Validate creative exists
      if (!spec.creativeKey || spec.creativeKey.length < 3) {
        throw new CreativeNotFoundError('youtube', spec.creativeKey);
      }

      // Validate targeting
      const validatedTargeting = this.validateTargeting(spec.targeting);

      const customerId = this.config.credentials.customerId!;
      const dailyBudgetCents = Math.floor(spec.budgetCents / 30);

      // Create campaign
      const campaignData = {
        operations: [{
          create: {
            name: spec.title,
            status: 'PAUSED', // Start paused for review
            campaign_budget: {
              name: `${spec.title} - Budget`,
              amount_micros: dailyBudgetCents * 1000000, // Convert to micros
              delivery_method: 'STANDARD',
            },
            advertising_channel_type: 'VIDEO',
            advertising_channel_sub_type: 'VIDEO_RESPONSIVE',
            bidding_strategy: {
              type: 'TARGET_CPA',
              target_cpa: {
                target_cpa_micros: Math.floor(dailyBudgetCents * 0.1 * 1000000), // 10% of daily budget as target CPA
              },
            },
          },
        }],
      };

      const campaignResponse = await this.makeRequest(`/customers/${customerId}/campaigns:mutate`, 'POST', campaignData);
      const campaignId = campaignResponse.results?.[0]?.resource_name?.split('/')?.[3];

      if (!campaignId) {
        throw new AdPlatformError('Failed to create campaign', 'youtube', 'createCampaign', 'CREATE_FAILED');
      }

      // Create ad group
      const adGroupData = {
        operations: [{
          create: {
            name: `${spec.title} - Ad Group`,
            status: 'PAUSED',
            campaign: `customers/${customerId}/campaigns/${campaignId}`,
            type: 'VIDEO_RESPONSIVE',
            cpc_bid_micros: Math.floor(dailyBudgetCents * 0.1 * 1000000),
            targeting_setting: {
              target_restrictions: validatedTargeting,
            },
          },
        }],
      };

      const adGroupResponse = await this.makeRequest(`/customers/${customerId}/adGroups:mutate`, 'POST', adGroupData);
      const adGroupId = adGroupResponse.results?.[0]?.resource_name?.split('/')?.[3];

      // Create ad
      const adData = {
        operations: [{
          create: {
            name: `${spec.title} - Ad`,
            status: 'PAUSED',
            ad_group: `customers/${customerId}/adGroups/${adGroupId}`,
            type: 'VIDEO_RESPONSIVE_AD',
            final_urls: [spec.metadata?.landingPageUrl || 'https://example.com'],
            call_to_action: 'LEARN_MORE',
            video_responsive_ad: {
              headlines: [{
                text: spec.metadata?.headline || spec.title,
              }],
              descriptions: [{
                text: spec.metadata?.description || 'Check out our amazing offer!',
              }],
              videos: [{
                asset: spec.creativeKey, // This would be the uploaded video asset
              }],
            },
          },
        }],
      };

      const adResponse = await this.makeRequest(`/customers/${customerId}/ads:mutate`, 'POST', adData);

      const responseTime = Date.now() - startTime;

      // Persist request for manual review in sandbox mode
      await this.persistCampaignRequest('create', campaignId, {
        spec,
        campaignId,
        adGroupId,
        adId: adResponse.results?.[0]?.resource_name?.split('/')?.[3],
      });

      // Log metrics
      await this.logMetrics({
        platform: 'youtube',
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
          adId: adResponse.results?.[0]?.resource_name?.split('/')?.[3],
          sandboxMode: this.sandboxMode 
        },
      });

      return { id: campaignId };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      await this.logMetrics({
        platform: 'youtube',
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
      const customerId = this.config.credentials.customerId!;
      const updateData: any = {
        operations: [{
          update: {
            resource_name: `customers/${customerId}/campaigns/${id}`,
            status: 'PAUSED', // Keep paused during update
          },
        }],
      };

      if (spec.title !== undefined) {
        updateData.operations[0].update.name = spec.title;
      }

      if (spec.budgetCents !== undefined) {
        const minBudgetCents = this.config.settings?.defaultBudgetCents || 1000;
        if (spec.budgetCents < minBudgetCents) {
          throw new InsufficientBudgetError('youtube', spec.budgetCents, minBudgetCents);
        }
        updateData.operations[0].update.campaign_budget = {
          amount_micros: Math.floor(spec.budgetCents / 30) * 1000000,
        };
      }

      await this.makeRequest(`/customers/${customerId}/campaigns:mutate`, 'POST', updateData);

      const responseTime = Date.now() - startTime;

      // Persist request for manual review in sandbox mode
      await this.persistCampaignRequest('update', id, { spec });

      await this.logMetrics({
        platform: 'youtube',
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
        platform: 'youtube',
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
      const customerId = this.config.credentials.customerId!;
      const updateData = {
        operations: [{
          update: {
            resource_name: `customers/${customerId}/campaigns/${id}`,
            status: 'PAUSED',
          },
        }],
      };

      await this.makeRequest(`/customers/${customerId}/campaigns:mutate`, 'POST', updateData);

      const responseTime = Date.now() - startTime;

      // Persist request for manual review in sandbox mode
      await this.persistCampaignRequest('pause', id, {});

      await this.logMetrics({
        platform: 'youtube',
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
        platform: 'youtube',
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
      const customerId = this.config.credentials.customerId!;
      const updateData = {
        operations: [{
          update: {
            resource_name: `customers/${customerId}/campaigns/${id}`,
            status: 'ENABLED',
          },
        }],
      };

      await this.makeRequest(`/customers/${customerId}/campaigns:mutate`, 'POST', updateData);

      const responseTime = Date.now() - startTime;

      // Persist request for manual review in sandbox mode
      await this.persistCampaignRequest('resume', id, {});

      await this.logMetrics({
        platform: 'youtube',
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
        platform: 'youtube',
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
      const customerId = this.config.credentials.customerId!;
      const campaign = await this.makeRequest(`/customers/${customerId}/campaigns/${id}`);
      
      if (!campaign) {
        throw new CampaignNotFoundError('youtube', id);
      }

      // Get insights
      const insights = await this.makeRequest(`/customers/${customerId}/campaigns/${id}/metrics`);
      const campaignInsights = insights.results?.[0] || {};

      const status: CampaignStatus = {
        id: campaign.resource_name?.split('/')?.[3] || id,
        status: this.mapYouTubeStatus(campaign.status),
        budgetSpentCents: Math.floor((parseFloat(campaignInsights.cost_micros) || 0) / 10000),
        impressions: parseInt(campaignInsights.impressions) || 0,
        clicks: parseInt(campaignInsights.clicks) || 0,
        conversions: parseInt(campaignInsights.conversions) || 0,
        ctr: parseFloat(campaignInsights.ctr) || 0,
        cpc: parseFloat(campaignInsights.average_cpc) || 0,
        cpm: parseFloat(campaignInsights.average_cpm) || 0,
        createdAt: campaign.created_time,
        updatedAt: campaign.updated_time,
        metadata: {
          budget: campaign.campaign_budget?.amount_micros,
          budgetType: campaign.campaign_budget?.delivery_method,
          advertisingChannelType: campaign.advertising_channel_type,
        },
      };

      const responseTime = Date.now() - startTime;

      await this.logMetrics({
        platform: 'youtube',
        operation: 'status',
        campaignId: id,
        requestTime: startTime,
        responseTime,
        success: true,
        costCents: 0,
        metadata: { status: campaign.status, sandboxMode: this.sandboxMode },
      });

      return status;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      await this.logMetrics({
        platform: 'youtube',
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
      const customerId = this.config.credentials.customerId!;
      const deleteData = {
        operations: [{
          remove: `customers/${customerId}/campaigns/${id}`,
        }],
      };

      await this.makeRequest(`/customers/${customerId}/campaigns:mutate`, 'POST', deleteData);

      const responseTime = Date.now() - startTime;

      // Persist request for manual review in sandbox mode
      await this.persistCampaignRequest('delete', id, {});

      await this.logMetrics({
        platform: 'youtube',
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
        platform: 'youtube',
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

  private mapYouTubeStatus(youtubeStatus: string): CampaignStatus['status'] {
    switch (youtubeStatus.toUpperCase()) {
      case 'ENABLED':
        return 'active';
      case 'PAUSED':
        return 'paused';
      case 'PENDING':
        return 'pending';
      case 'REJECTED':
        return 'rejected';
      case 'REMOVED':
        return 'failed';
      default:
        return 'pending';
    }
  }
}
