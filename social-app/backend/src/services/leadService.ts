import { LeadCaptureRequest, GoHighLevelLeadResponse } from '../types/lead.js';

const GOHIGHLEVEL_API_BASE = process.env.GOHIGHLEVEL_API_BASE_URL || 'http://localhost:6000';

export async function captureLead(request: LeadCaptureRequest): Promise<GoHighLevelLeadResponse> {
  const leadData = {
    name: request.name,
    email: request.email,
    phone: request.phone,
    landingPageId: request.landingPageId, // Changed from landingPageSlug to landingPageId
    source: request.source || 'social_post',
    metadata: {
      ...request.metadata,
      capturedAt: new Date().toISOString(),
      userAgent: 'social-app-backend',
    },
  };

  const response = await fetch(`${GOHIGHLEVEL_API_BASE}/api/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(leadData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GoHighLevel leads API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}
