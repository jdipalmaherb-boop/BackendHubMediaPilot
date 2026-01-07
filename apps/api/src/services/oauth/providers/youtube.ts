import { OAuthCallbackParams, OAuthConnectParams, OAuthProvider, OAuthTokenResponse } from '../types';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

export function createYouTubeProvider(): OAuthProvider {
  const clientId = required('YOUTUBE_CLIENT_ID', process.env.YOUTUBE_CLIENT_ID);
  const clientSecret = required('YOUTUBE_CLIENT_SECRET', process.env.YOUTUBE_CLIENT_SECRET);
  const redirectUri = required('YOUTUBE_REDIRECT_URI', process.env.YOUTUBE_REDIRECT_URI);

  // Recommended scopes for your app:
  // - upload videos/shorts
  // - read basic account/video info
  // - read analytics (metrics)
  const scopes = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/yt-analytics.readonly',
    // Add this if you later need more "manage" style YouTube operations:
    // 'https://www.googleapis.com/auth/youtube.force-ssl',
  ];

  return {
    name: 'youtube',

    getAuthorizationUrl: ({ orgId, state }: OAuthConnectParams) => {
      const url = new URL(GOOGLE_AUTH_URL);
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');

      // Google expects scopes space-separated
      url.searchParams.set('scope', scopes.join(' '));

      // ✅ critical for scheduling: get refresh token
      url.searchParams.set('access_type', 'offline');

      // ✅ helps ensure refresh token is issued
      url.searchParams.set('prompt', 'consent');

      // Optional but helpful: if a user already granted some scopes, don’t drop them
      url.searchParams.set('include_granted_scopes', 'true');

      // Same idea as your Meta provider: store orgId + a random state
      url.searchParams.set('state', JSON.stringify({ orgId, state }));

      return url.toString();
    },

    exchangeCode: async ({ code, orgId }: OAuthCallbackParams): Promise<OAuthTokenResponse> => {
      // Google token exchange is POST x-www-form-urlencoded
      const body = new URLSearchParams();
      body.set('client_id', clientId);
      body.set('client_secret', clientSecret);
      body.set('redirect_uri', redirectUri);
      body.set('grant_type', 'authorization_code');
      body.set('code', code);

      const res = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`YouTube token exchange failed: ${res.status} ${text}`);
      }

      const data = await res.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        token_type?: string;
        scope?: string;
      };

      const expiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;

      // We'll store a placeholder providerAccountId for now.
      // Later, after you have an access token, you can call YouTube Data API "channels?mine=true"
      // and store the actual channelId as providerAccountId.
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? null,
        expiresAt,
        providerAccountId: `org:${orgId}`,
      };
    },
  };
}

