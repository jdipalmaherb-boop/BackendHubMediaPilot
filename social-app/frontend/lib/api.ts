const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const SOCIAL_API_BASE = process.env.NEXT_PUBLIC_SOCIAL_API_URL || 'http://localhost:5000';

export async function api<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts?.headers || {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function socialApi<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${SOCIAL_API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts?.headers || {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Social API error ${res.status}`);
  return res.json();
}

// Boost Post API
export interface BoostPostRequest {
  postId: string;
  budget: number;
  duration: number;
  platforms: string[];
}

export interface BoostPostResponse {
  success: boolean;
  campaignId?: string;
  status?: string;
  error?: string;
  logs?: any[];
}

export async function boostPost(request: BoostPostRequest): Promise<BoostPostResponse> {
  return socialApi<BoostPostResponse>('/api/ads/boost-post', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

// Landing Page API
export interface CreateLandingPageRequest {
  orgId: string;
  headline: string;
  subtext: string;
  ctaText: string;
  ctaUrl: string;
}

export interface CreateLandingPageResponse {
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

export async function createLandingPage(request: CreateLandingPageRequest): Promise<CreateLandingPageResponse> {
  return socialApi<CreateLandingPageResponse>('/api/landing/create', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function getLandingPages(orgId: string): Promise<GetLandingPagesResponse> {
  return socialApi<GetLandingPagesResponse>(`/api/landing?orgId=${orgId}`);
}

// Lead Capture API
export interface LeadCaptureRequest {
  name: string;
  email: string;
  phone?: string;
  landingPageId: string;
  source?: string;
  metadata?: Record<string, any>;
}

export interface LeadCaptureResponse {
  success: boolean;
  leadId?: string;
  status?: string;
  error?: string;
  timestamp: string;
  landingPageId?: string;
  message?: string;
}

export async function captureLead(request: LeadCaptureRequest): Promise<LeadCaptureResponse> {
  return socialApi<LeadCaptureResponse>('/api/lead/capture', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

// Analytics API
export interface AdCampaignStatus {
  id: string;
  name: string;
  status: string;
  budget: number;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  ctr: number;
  cpc: number;
  createdAt: string;
}

export interface LeadData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  landingPageId: string;
  source: string;
  status: string;
  createdAt: string;
}

export interface AdCampaignStatusResponse {
  success: boolean;
  campaigns: AdCampaignStatus[];
  error?: string;
}

export interface LeadListResponse {
  success: boolean;
  leads: LeadData[];
  error?: string;
}

export async function getAdCampaignStatus(orgId: string): Promise<AdCampaignStatusResponse> {
  return socialApi<AdCampaignStatusResponse>(`/api/ads/status?orgId=${orgId}`);
}

export async function getLeadList(orgId: string): Promise<LeadListResponse> {
  return socialApi<LeadListResponse>(`/api/lead/list?orgId=${orgId}`);
}

// Notifications API
export interface Notification {
  id: string;
  orgId: string;
  type: string;
  message: string;
  timestamp: string;
  read: boolean;
  metadata?: Record<string, any>;
}

export interface GetNotificationsResponse {
  success: boolean;
  notifications: Notification[];
  unreadCount: number;
  error?: string;
}

export interface MarkReadRequest {
  notificationIds: string[];
}

export interface MarkReadResponse {
  success: boolean;
  updatedCount: number;
  message?: string;
  error?: string;
}

export async function getNotifications(orgId: string, limit = 50): Promise<GetNotificationsResponse> {
  return api<GetNotificationsResponse>(`/api/notifications?orgId=${orgId}&limit=${limit}`);
}

export async function markNotificationsAsRead(notificationIds: string[]): Promise<MarkReadResponse> {
  return api<MarkReadResponse>('/api/notifications/mark-read', {
    method: 'POST',
    body: JSON.stringify({ notificationIds }),
  });
}
