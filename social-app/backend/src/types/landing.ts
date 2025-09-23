export interface CreateLandingRequest {
  orgId: string;
  headline: string;
  subtext: string;
  ctaText: string;
  ctaUrl: string;
}

export interface GoHighLevelResponse {
  success: boolean;
  landingPageId: string;
  slug: string;
  url: string;
  status: string;
  error?: string;
}

export interface CreateLandingResponse {
  success: boolean;
  landingPageId?: string;
  slug?: string;
  url?: string;
  status?: string;
  error?: string;
}

export interface LandingPage {
  id: string;
  orgId: string;
  slug: string;
  headline: string;
  subtext: string;
  ctaText: string;
  ctaUrl: string;
  url: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetLandingPagesResponse {
  success: boolean;
  landingPages: LandingPage[];
  error?: string;
}



