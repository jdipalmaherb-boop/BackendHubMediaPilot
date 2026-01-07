/**
 * Minimal Meta Ads API wrapper (placeholder).
 * Keeps TypeScript builds green while Meta setup is in progress.
 */

type MetaConfig = {
  META_ACCESS_TOKEN: string;
  META_AD_ACCOUNT_ID: string;
};

function requireConfigured(env: NodeJS.ProcessEnv): MetaConfig {
  const token = env.META_ACCESS_TOKEN;
  const adAccountId = env.META_AD_ACCOUNT_ID;

  if (!token) throw new Error('Missing META_ACCESS_TOKEN');
  if (!adAccountId) throw new Error('Missing META_AD_ACCOUNT_ID');

  return { META_ACCESS_TOKEN: token, META_AD_ACCOUNT_ID: adAccountId };
}

export async function createMetaCreative(): Promise<{ id: string }> {
  requireConfigured(process.env);
  return { id: `meta-creative-${Date.now()}` };
}

export async function createMetaAdSet(): Promise<{ id: string }> {
  requireConfigured(process.env);
  return { id: `meta-adset-${Date.now()}` };
}

export async function createMetaAd(): Promise<{ id: string }> {
  requireConfigured(process.env);
  return { id: `meta-ad-${Date.now()}` };
}
