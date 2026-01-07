export interface CampaignSpec {
  title: string;
  creativeKey: string;
  budgetCents: number;
  targeting: any;
  metadata?: any;
}

export interface CampaignUpdateSpec {
  title?: string;
  creativeKey?: string;
  budgetCents?: number;
  targeting?: any;
  metadata?: any;
}

export interface CampaignStatus {
  id: string;
  status: 'active' | 'paused' | 'pending' | 'rejected' | 'completed' | 'failed';
  budgetSpentCents: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number; // Click-through rate
  cpc: number; // Cost per click
  cpm: number; // Cost per mille (1000 impressions)
  createdAt: string;
  updatedAt: string;
  metadata?: any;
}

export interface AdPlatform {
  createCampaign(spec: CampaignSpec): Promise<{ id: string }>;
  updateCampaign(id: string, spec: CampaignUpdateSpec): Promise<void>;
  pauseCampaign(id: string): Promise<void>;
  resumeCampaign(id: string): Promise<void>;
  getCampaignStatus(id: string): Promise<CampaignStatus>;
  deleteCampaign(id: string): Promise<void>;
}

export interface AdCallMetrics {
  platform: string;
  operation: 'create' | 'update' | 'pause' | 'resume' | 'status' | 'delete';
  campaignId?: string;
  requestTime: number; // milliseconds
  responseTime: number; // milliseconds
  success: boolean;
  errorMessage?: string;
  costCents?: number;
  metadata?: any;
}

export interface AdPlatformConfig {
  platform: string;
  enabled: boolean;
  sandboxMode: boolean;
  credentials: {
    accessToken?: string;
    refreshToken?: string;
    clientId?: string;
    clientSecret?: string;
    accountId?: string;
    [key: string]: any;
  };
  settings: {
    defaultBudgetCents?: number;
    maxBudgetCents?: number;
    targetingOptions?: any;
    creativeFormats?: string[];
    [key: string]: any;
  };
}

// Platform-specific targeting interfaces
export interface MetaTargeting {
  ageMin?: number;
  ageMax?: number;
  genders?: number[];
  locations?: Array<{
    country?: string;
    region?: string;
    city?: string;
  }>;
  interests?: string[];
  behaviors?: string[];
  customAudiences?: string[];
  lookalikeAudiences?: string[];
  languages?: string[];
  devicePlatforms?: string[];
  placements?: string[];
}

export interface TikTokTargeting {
  ageMin?: number;
  ageMax?: number;
  genders?: string[];
  locations?: Array<{
    country?: string;
    region?: string;
    city?: string;
  }>;
  interests?: string[];
  behaviors?: string[];
  customAudiences?: string[];
  languages?: string[];
  deviceTypes?: string[];
  osTypes?: string[];
}

export interface YouTubeTargeting {
  ageMin?: number;
  ageMax?: number;
  genders?: string[];
  locations?: Array<{
    country?: string;
    region?: string;
    city?: string;
  }>;
  interests?: string[];
  keywords?: string[];
  customAudiences?: string[];
  languages?: string[];
  deviceTypes?: string[];
  placements?: string[];
  topics?: string[];
}

// Creative asset interfaces
export interface CreativeAsset {
  id: string;
  type: 'image' | 'video' | 'carousel' | 'collection';
  url: string;
  thumbnailUrl?: string;
  duration?: number; // for video
  dimensions?: {
    width: number;
    height: number;
  };
  metadata?: any;
}

export interface CreativeSpec {
  assets: CreativeAsset[];
  headline?: string;
  description?: string;
  callToAction?: string;
  landingPageUrl?: string;
  metadata?: any;
}

// Error types
export class AdPlatformError extends Error {
  constructor(
    message: string,
    public platform: string,
    public operation: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AdPlatformError';
  }
}

export class CampaignNotFoundError extends AdPlatformError {
  constructor(platform: string, campaignId: string) {
    super(`Campaign ${campaignId} not found`, platform, 'getCampaignStatus', 'CAMPAIGN_NOT_FOUND');
  }
}

export class InsufficientBudgetError extends AdPlatformError {
  constructor(platform: string, budgetCents: number, minBudgetCents: number) {
    super(
      `Budget ${budgetCents} cents is below minimum ${minBudgetCents} cents`,
      platform,
      'createCampaign',
      'INSUFFICIENT_BUDGET'
    );
  }
}

export class InvalidTargetingError extends AdPlatformError {
  constructor(platform: string, details: any) {
    super('Invalid targeting configuration', platform, 'createCampaign', 'INVALID_TARGETING', details);
  }
}

export class CreativeNotFoundError extends AdPlatformError {
  constructor(platform: string, creativeKey: string) {
    super(`Creative ${creativeKey} not found`, platform, 'createCampaign', 'CREATIVE_NOT_FOUND');
  }
}

// Utility types
export type PlatformName = 'mock' | 'meta' | 'tiktok' | 'youtube';

export interface AdPlatformFactory {
  createPlatform(config: AdPlatformConfig): AdPlatform;
  getSupportedPlatforms(): PlatformName[];
  validateConfig(platform: PlatformName, config: AdPlatformConfig): boolean;
}
