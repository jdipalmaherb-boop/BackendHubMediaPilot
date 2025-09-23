import { LeadCaptureRequest } from '../types/lead.js';

const SCHEDULER_API_BASE = process.env.SCHEDULER_API_BASE_URL || 'http://localhost:4000';

export interface LeadLog {
  timestamp: string;
  landingPageSlug: string;
  leadId?: string;
  contactId?: string;
  status: 'success' | 'error';
  error?: string;
  metadata?: Record<string, any>;
}

export async function logLeadCapture(
  request: LeadCaptureRequest,
  goHighLevelResponse?: { id: string; contactId: string; status: string },
  error?: string
): Promise<void> {
  const logData: LeadLog = {
    timestamp: new Date().toISOString(),
    landingPageSlug: request.landingPageSlug,
    leadId: goHighLevelResponse?.id,
    contactId: goHighLevelResponse?.contactId,
    status: error ? 'error' : 'success',
    error,
    metadata: {
      source: request.source,
      ...request.metadata,
    },
  };

  try {
    // Log to scheduler DB for tracking
    await fetch(`${SCHEDULER_API_BASE}/api/leads/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logData),
    });
  } catch (logError) {
    // Don't fail the main request if logging fails
    console.error('Failed to log lead capture:', logError);
  }

  // Also log to console for debugging
  console.log('Lead captured:', {
    timestamp: logData.timestamp,
    landingPage: request.landingPageSlug,
    leadId: goHighLevelResponse?.id,
    status: logData.status,
  });
}



