export interface OAuthConnectParams {
  orgId: string;
  state?: string;
}

export interface OAuthCallbackParams {
  code: string;
  orgId: string;
}

export interface OAuthTokenResponse {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  providerAccountId: string;
}

export interface OAuthProvider {
  name: string;
  getAuthorizationUrl(params: OAuthConnectParams): string;
  exchangeCode(params: OAuthCallbackParams): Promise<OAuthTokenResponse>;
}





