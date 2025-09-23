export interface LeadCaptureRequest {
  name: string;
  email: string;
  phone?: string;
  landingPageId: string; // Changed from landingPageSlug to landingPageId
  source?: string; // e.g., 'social_post', 'ad_campaign', 'organic'
  metadata?: Record<string, any>; // Additional tracking data
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

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  landingPageId: string;
  source: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoHighLevelLeadResponse {
  id: string;
  status: string;
  contactId: string;
}
