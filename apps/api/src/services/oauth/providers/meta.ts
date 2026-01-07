import type { OAuthCallbackParams, OAuthConnectParams, OAuthProvider, OAuthTokenResponse } from '../types.js';

const META_AUTH_URL = 'https://www.facebook.com/v19.0/dialog/oauth';
const META_TOKEN_URL = 'https://graph.facebook.com/v19.0/oauth/access_token';

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

export function createMetaProvider(): OAuthProvider {
  const clientId = required('META_CLIENT_ID', process.env.META_CLIENT_ID);
  const clientSecret = required('META_CLIENT_SECRET', process.env.META_CLIENT_SECRET);
  const redirectUri = required('META_REDIRECT_URI', process.env.META_REDIRECT_URI);

  const scope = [
    'pages_show_list',
    'instagram_basic',
    'instagram_content_publish',
  ].join(',');

  return {
    name: 'meta',
    getAuthorizationUrl: ({ orgId, state }: OAuthConnectParams) => {
      const url = new URL(META_AUTH_URL);
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', scope);
      url.searchParams.set('state', JSON.stringify({ orgId, state }));
      return url.toString();
    },
    exchangeCode: async ({ code, orgId }: OAuthCallbackParams): Promise<OAuthTokenResponse> => {
      const url = new URL(META_TOKEN_URL);
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('client_secret', clientSecret);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('code', code);

      const res = await fetch(url.toString(), { method: 'GET' });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Meta token exchange failed: ${res.status} ${text}`);
      }
      const data = await res.json() as { access_token: string; token_type: string; expires_in?: number };

      const expiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;

      // For Meta, providerAccountId is not returned at this stage; call debug_token? For simplicity, store placeholder.
      return {
        accessToken: data.access_token,
        refreshToken: null,
        expiresAt,
        providerAccountId: `org:${orgId}`,
      };
    },
  };
}





