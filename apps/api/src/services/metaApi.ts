interface MetaCredentials {
  accessToken?: string;
  accountId?: string;
}

type StubResult<T extends string> = {
  mode: 'stub';
  action: T;
  message: string;
};

type Result<T extends string, P> = StubResult<T> | P;

function isConfigured() {
  return Boolean(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID);
}

function requireConfigured(): asserts process.env is NodeJS.ProcessEnv & {
  META_ACCESS_TOKEN: string;
  META_AD_ACCOUNT_ID: string;
} {
  if (!isConfigured()) {
    throw new Error('Meta API is not configured. Please set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID.');
  }
}

export async function createMetaCreative(
  payload: { name: string; body: string; imageUrl: string; callToAction: string },
  credentials: MetaCredentials = {}
): Promise<Result<'create-creative', { id: string }>> {
  if (!isConfigured()) {
    return {
      mode: 'stub',
      action: 'create-creative',
      message: 'Meta API running in stub mode (no credentials).',
    };
  }

  requireConfigured();

  // TODO: Implement real API call to Meta when credentials available.
  return { id: meta-creative- };
}

export async function createMetaAdSet(
  payload: { name: string; budget: number; audience: Record<string, unknown>; schedule?: Record<string, unknown> },
  credentials: MetaCredentials = {}
): Promise<Result<'create-adset', { id: string }>> {
  if (!isConfigured()) {
    return {
      mode: 'stub',
      action: 'create-adset',
      message: 'Meta API running in stub mode (no credentials).',
    };
  }
  requireConfigured();
  return { id: meta-adset- };
}

export async function createMetaAd(
  payload: { creativeId: string; adSetId: string; name: string },
  credentials: MetaCredentials = {}
): Promise<Result<'create-ad', { id: string }>> {
  if (!isConfigured()) {
    return {
      mode: 'stub',
      action: 'create-ad',
      message: 'Meta API running in stub mode (no credentials).',
    };
  }
  requireConfigured();
  return { id: meta-ad- };
}

export async function pauseMetaAd(id: string): Promise<Result<'pause-ad', { id: string; status: string }>> {
  if (!isConfigured()) {
    return { mode: 'stub', action: 'pause-ad', message: 'Meta API running in stub mode (no credentials).' };
  }
  requireConfigured();
  return { id, status: 'PAUSED' };
}

export async function fetchMetaInsights(
  id: string,
  range: { start: string; end: string }
): Promise<Result<'fetch-insights', { impressions: number; clicks: number; spend: number }>> {
  if (!isConfigured()) {
    return {
      mode: 'stub',
      action: 'fetch-insights',
      message: 'Meta API running in stub mode (no credentials).',
    };
  }
  requireConfigured();
  return {
    impressions: Math.floor(Math.random() * 1000),
    clicks: Math.floor(Math.random() * 200),
    spend: Number((Math.random() * 100).toFixed(2)),
  };
}
