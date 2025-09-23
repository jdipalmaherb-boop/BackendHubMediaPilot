import { CreateLandingRequest, GoHighLevelResponse } from '../types/landing.js';

const GOHIGHLEVEL_API_BASE = process.env.GOHIGHLEVEL_API_BASE_URL || 'http://localhost:6000';

export async function createLandingPage(request: CreateLandingRequest): Promise<GoHighLevelResponse> {
  const response = await fetch(`${GOHIGHLEVEL_API_BASE}/api/landing-pages/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orgId: request.orgId,
      headline: request.headline,
      subtext: request.subtext,
      ctaText: request.ctaText,
      ctaUrl: request.ctaUrl,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GoHighLevel API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}



