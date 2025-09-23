export interface Post {
  id: string;
  content: string;
  finalCaption?: string;
  platforms: string[];
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED' | 'CANCELED';
  scheduledAt?: string;
  createdAt: string;
  aiScore?: number;
  aiTips?: any;
  editedAssetUrl?: string;
  editedFormat?: string;
  asset?: {
    id: string;
    url: string;
    type: string;
  };
}

export interface AdCampaign {
  id: string;
  name: string;
  status: string;
  budget: number;
  results: {
    clicks?: number;
    impressions?: number;
    spend?: number;
    conversions?: number;
    ctr?: number;
    cpc?: number;
  };
  createdAt: string;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  landingPageSlug: string;
  source: string;
  status: string;
  createdAt: string;
}

export interface LandingPage {
  id: string;
  slug: string;
  headline: string;
  url: string;
  status: string;
  createdAt: string;
}

export interface AnalyticsFilters {
  orgId: string;
  platform?: string;
  dateFrom?: string;
  dateTo?: string;
}



