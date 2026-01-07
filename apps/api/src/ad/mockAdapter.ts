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
  CreativeNotFoundError
} from './adapter';
import { prisma } from '../lib/prisma';
import crypto from 'crypto';

interface MockCampaign {
  id: string;
  spec: CampaignSpec;
  status: CampaignStatus['status'];
  createdAt: string;
  updatedAt: string;
  budgetSpentCents: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

export class MockAdapter implements AdPlatform {
  private campaigns: Map<string, MockCampaign> = new Map();
  private config: AdPlatformConfig;

  constructor(config: AdPlatformConfig) {
    this.config = config;
  }

  // Generate deterministic campaign ID based on spec
  private generateCampaignId(spec: CampaignSpec): string {
    const hash = crypto
      .createHash('md5')
      .update(JSON.stringify({ title: spec.title, creativeKey: spec.creativeKey, budgetCents: spec.budgetCents }))
      .digest('hex');
    return `mock_${hash.substring(0, 12)}`;
  }

  // Simulate network latency
  private async simulateLatency(minMs: number = 100, maxMs: number = 500): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // Generate realistic campaign metrics based on budget and time
  private generateMetrics(campaign: MockCampaign): Partial<CampaignStatus> {
    const daysSinceCreation = Math.max(1, (Date.now() - new Date(campaign.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    const dailyBudgetCents = campaign.spec.budgetCents / 30; // Assume 30-day campaign
    
    // Simulate realistic metrics
    const budgetSpentCents = Math.min(
      campaign.spec.budgetCents,
      Math.floor(dailyBudgetCents * daysSinceCreation * (0.8 + Math.random() * 0.4))
    );
    
    const cpm = 500 + Math.random() * 1000; // $5-15 CPM
    const impressions = Math.floor((budgetSpentCents / 100) / (cpm / 1000));
    const ctr = 0.01 + Math.random() * 0.05; // 1-6% CTR
    const clicks = Math.floor(impressions * ctr);
    const conversionRate = 0.02 + Math.random() * 0.08; // 2-10% conversion rate
    const conversions = Math.floor(clicks * conversionRate);
    const cpc = budgetSpentCents / Math.max(1, clicks);

    return {
      budgetSpentCents,
      impressions,
      clicks,
      conversions,
      ctr: ctr * 100, // Convert to percentage
      cpc: cpc / 100, // Convert to dollars
      cpm: cpm / 100, // Convert to dollars
    };
  }

  // Log metrics to database
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

  async createCampaign(spec: CampaignSpec): Promise<{ id: string }> {
    const startTime = Date.now();
    
    try {
      await this.simulateLatency();

      // Validate budget
      const minBudgetCents = this.config.settings?.defaultBudgetCents || 1000;
      if (spec.budgetCents < minBudgetCents) {
        throw new InsufficientBudgetError('mock', spec.budgetCents, minBudgetCents);
      }

      // Validate creative exists (mock validation)
      if (!spec.creativeKey || spec.creativeKey.length < 3) {
        throw new CreativeNotFoundError('mock', spec.creativeKey);
      }

      // Generate deterministic campaign ID
      const campaignId = this.generateCampaignId(spec);
      
      // Check if campaign already exists
      if (this.campaigns.has(campaignId)) {
        return { id: campaignId };
      }

      // Create new campaign
      const now = new Date().toISOString();
      const campaign: MockCampaign = {
        id: campaignId,
        spec,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        budgetSpentCents: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
      };

      this.campaigns.set(campaignId, campaign);

      // Simulate campaign approval after a short delay
      setTimeout(() => {
        if (this.campaigns.has(campaignId)) {
          const campaign = this.campaigns.get(campaignId)!;
          campaign.status = 'active';
          campaign.updatedAt = new Date().toISOString();
        }
      }, 2000);

      const responseTime = Date.now() - startTime;

      // Log metrics
      await this.logMetrics({
        platform: 'mock',
        operation: 'create',
        campaignId,
        requestTime: startTime,
        responseTime,
        success: true,
        costCents: 0,
        metadata: { spec },
      });

      return { id: campaignId };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      await this.logMetrics({
        platform: 'mock',
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
      await this.simulateLatency();

      const campaign = this.campaigns.get(id);
      if (!campaign) {
        throw new CampaignNotFoundError('mock', id);
      }

      // Update campaign spec
      if (spec.title !== undefined) campaign.spec.title = spec.title;
      if (spec.creativeKey !== undefined) campaign.spec.creativeKey = spec.creativeKey;
      if (spec.budgetCents !== undefined) {
        const minBudgetCents = this.config.settings?.defaultBudgetCents || 1000;
        if (spec.budgetCents < minBudgetCents) {
          throw new InsufficientBudgetError('mock', spec.budgetCents, minBudgetCents);
        }
        campaign.spec.budgetCents = spec.budgetCents;
      }
      if (spec.targeting !== undefined) campaign.spec.targeting = spec.targeting;
      if (spec.metadata !== undefined) campaign.spec.metadata = spec.metadata;

      campaign.updatedAt = new Date().toISOString();

      const responseTime = Date.now() - startTime;

      await this.logMetrics({
        platform: 'mock',
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
        platform: 'mock',
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
      await this.simulateLatency();

      const campaign = this.campaigns.get(id);
      if (!campaign) {
        throw new CampaignNotFoundError('mock', id);
      }

      campaign.status = 'paused';
      campaign.updatedAt = new Date().toISOString();

      const responseTime = Date.now() - startTime;

      await this.logMetrics({
        platform: 'mock',
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
        platform: 'mock',
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
      await this.simulateLatency();

      const campaign = this.campaigns.get(id);
      if (!campaign) {
        throw new CampaignNotFoundError('mock', id);
      }

      campaign.status = 'active';
      campaign.updatedAt = new Date().toISOString();

      const responseTime = Date.now() - startTime;

      await this.logMetrics({
        platform: 'mock',
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
        platform: 'mock',
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
      await this.simulateLatency();

      const campaign = this.campaigns.get(id);
      if (!campaign) {
        throw new CampaignNotFoundError('mock', id);
      }

      const metrics = this.generateMetrics(campaign);
      
      const status: CampaignStatus = {
        id: campaign.id,
        status: campaign.status,
        budgetSpentCents: metrics.budgetSpentCents || 0,
        impressions: metrics.impressions || 0,
        clicks: metrics.clicks || 0,
        conversions: metrics.conversions || 0,
        ctr: metrics.ctr || 0,
        cpc: metrics.cpc || 0,
        cpm: metrics.cpm || 0,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
        metadata: campaign.spec.metadata,
      };

      const responseTime = Date.now() - startTime;

      await this.logMetrics({
        platform: 'mock',
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
        platform: 'mock',
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
      await this.simulateLatency();

      const campaign = this.campaigns.get(id);
      if (!campaign) {
        throw new CampaignNotFoundError('mock', id);
      }

      this.campaigns.delete(id);

      const responseTime = Date.now() - startTime;

      await this.logMetrics({
        platform: 'mock',
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
        platform: 'mock',
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

  // Utility methods for testing
  getCampaignCount(): number {
    return this.campaigns.size;
  }

  getAllCampaigns(): MockCampaign[] {
    return Array.from(this.campaigns.values());
  }

  clearCampaigns(): void {
    this.campaigns.clear();
  }
}
