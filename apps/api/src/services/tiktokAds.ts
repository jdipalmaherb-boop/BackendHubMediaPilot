import axios, { AxiosError } from 'axios';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { prisma } from '../lib/prisma';
import { log } from '../lib/logger';
import { env } from '../env';

const TIKTOK_API_BASE = 'https://open.tiktokapis.com';
const TIKTOK_OAUTH_BASE = 'https://open.tiktokapis.com/v2/oauth';

interface TikTokVideoInitRequest {
  post_info: {
    title: string;
    privacy_level: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIEND' | 'SELF_ONLY';
    disable_duet?: boolean;
    disable_comment?: boolean;
    disable_stitch?: boolean;
    video_cover_timestamp_ms?: number;
  };
  source_info: {
    source: 'FILE_UPLOAD' | 'PULL_FROM_URL';
    video_url?: string; // Required if source is PULL_FROM_URL
  };
}

interface TikTokVideoInitResponse {
  data: {
    upload_url: string;
    publish_id: string;
  };
  error: {
    code: string;
    message: string;
    log_id: string;
  };
}

interface TikTokPostStatusResponse {
  data: {
    status: 'PROCESSING' | 'PUBLISHED' | 'FAILED';
    publish_id: string;
    fail_reason?: string;
  };
  error: {
    code: string;
    message: string;
    log_id: string;
  };
}

interface TikTokTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  scope: string;
  token_type: string;
}

/**
 * Refresh TikTok access token
 */
export async function refreshTikTokToken(
  userId: string,
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

  if (!clientKey || !clientSecret) {
    throw new Error('TikTok credentials not configured');
  }

  try {
    const response = await axios.post<TikTokTokenResponse>(
      `${TIKTOK_OAUTH_BASE}/token/`,
      new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, refresh_token, expires_in } = response.data;
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Update stored token
    await prisma.oauthProvider.update({
      where: {
        userId_platform: {
          userId,
          platform: 'tiktok',
        },
      },
      data: {
        accessToken: access_token,
        refreshToken: refresh_token, // TikTok may rotate refresh token
        expiresAt,
        updatedAt: new Date(),
      },
    });

    return {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt,
    };
  } catch (error) {
    log.error('Failed to refresh TikTok token', error as Error, { userId });
    throw new Error(`TikTok token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get valid TikTok access token (refresh if needed)
 */
export async function getTikTokToken(userId: string): Promise<string> {
  const provider = await prisma.oauthProvider.findUnique({
    where: {
      userId_platform: {
        userId,
        platform: 'tiktok',
      },
    },
  });

  if (!provider) {
    throw new Error('TikTok account not connected');
  }

  if (!provider.refreshToken) {
    throw new Error('TikTok refresh token not available');
  }

  // Check if token is expired or will expire soon (within 5 minutes)
  const now = new Date();
  const expiresAt = provider.expiresAt || new Date(0);
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (!expiresAt || expiresAt < fiveMinutesFromNow) {
    // Token expired or expiring soon, refresh it
    const refreshed = await refreshTikTokToken(userId, provider.refreshToken);
    return refreshed.accessToken;
  }

  return provider.accessToken;
}

/**
 * Initialize TikTok video upload
 */
async function initTikTokUpload(
  accessToken: string,
  title: string,
  source: 'FILE_UPLOAD' | 'PULL_FROM_URL',
  videoUrl?: string
): Promise<{ uploadUrl: string; publishId: string }> {
  const requestBody: TikTokVideoInitRequest = {
    post_info: {
      title,
      privacy_level: 'PUBLIC_TO_EVERYONE',
    },
    source_info: {
      source,
      ...(source === 'PULL_FROM_URL' && videoUrl ? { video_url: videoUrl } : {}),
    },
  };

  try {
    const response = await axios.post<TikTokVideoInitResponse>(
      `${TIKTOK_API_BASE}/v2/post/publish/video/init/`,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.error) {
      throw new Error(`TikTok API error: ${response.data.error.message} (${response.data.error.code})`);
    }

    return {
      uploadUrl: response.data.data.upload_url,
      publishId: response.data.data.publish_id,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<TikTokVideoInitResponse>;
      if (axiosError.response?.status === 401) {
        throw new Error('TikTok token expired');
      }
      if (axiosError.response?.data?.error) {
        throw new Error(`TikTok API error: ${axiosError.response.data.error.message}`);
      }
    }
    throw error;
  }
}

/**
 * Upload video file to TikTok
 */
async function uploadTikTokVideo(
  uploadUrl: string,
  videoStream: Readable | ReadableStream
): Promise<void> {
  try {
    // Convert ReadableStream to Node Readable if needed
    let stream: Readable;
    if (videoStream instanceof Readable) {
      stream = videoStream;
    } else {
      // Handle browser ReadableStream if needed
      throw new Error('ReadableStream conversion not implemented');
    }

    await axios.put(uploadUrl, stream, {
      headers: {
        'Content-Type': 'video/mp4',
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 429) {
        throw new Error('TikTok rate limit exceeded. Please try again later.');
      }
    }
    throw new Error(`TikTok upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check TikTok post status
 */
async function checkTikTokPostStatus(
  accessToken: string,
  publishId: string
): Promise<'PROCESSING' | 'PUBLISHED' | 'FAILED'> {
  try {
    const response = await axios.get<TikTokPostStatusResponse>(
      `${TIKTOK_API_BASE}/v2/post/publish/status/fetch/`,
      {
        params: {
          publish_id: publishId,
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (response.data.error) {
      throw new Error(`TikTok API error: ${response.data.error.message}`);
    }

    return response.data.data.status;
  } catch (error) {
    log.error('Failed to check TikTok post status', error as Error, { publishId });
    throw error;
  }
}

/**
 * Poll TikTok post status until complete
 */
async function waitForTikTokPost(
  accessToken: string,
  publishId: string,
  maxWaitTime: number = 300000 // 5 minutes
): Promise<'PUBLISHED' | 'FAILED'> {
  const startTime = Date.now();
  const pollInterval = 5000; // 5 seconds

  while (Date.now() - startTime < maxWaitTime) {
    const status = await checkTikTokPostStatus(accessToken, publishId);

    if (status === 'PUBLISHED') {
      return 'PUBLISHED';
    }

    if (status === 'FAILED') {
      return 'FAILED';
    }

    // Still processing, wait and retry
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error('TikTok post status check timeout');
}

/**
 * Publish video to TikTok
 */
export async function publishTikTokVideo(
  userId: string,
  contentUrl: string,
  caption: string,
  options?: {
    privacyLevel?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIEND' | 'SELF_ONLY';
    disableDuet?: boolean;
    disableComment?: boolean;
    disableStitch?: boolean;
  }
): Promise<{ publishId: string; status: string }> {
  // Check configuration
  if (!process.env.TIKTOK_CLIENT_KEY || !process.env.TIKTOK_CLIENT_SECRET) {
    throw new Error('TikTok integration not configured');
  }

  // Get access token (refresh if needed)
  let accessToken: string;
  try {
    accessToken = await getTikTokToken(userId);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not connected')) {
      throw new Error('TikTok account not connected. Please connect your TikTok account first.');
    }
    throw error;
  }

  // Determine if contentUrl is a URL or file path
  const isUrl = contentUrl.startsWith('http://') || contentUrl.startsWith('https://');
  const source: 'FILE_UPLOAD' | 'PULL_FROM_URL' = isUrl ? 'PULL_FROM_URL' : 'FILE_UPLOAD';

  try {
    // Step 1: Initialize upload
    const { uploadUrl, publishId } = await initTikTokUpload(
      accessToken,
      caption,
      source,
      isUrl ? contentUrl : undefined
    );

    // Step 2: Upload file if using FILE_UPLOAD
    if (source === 'FILE_UPLOAD') {
      const videoStream = createReadStream(contentUrl);
      await uploadTikTokVideo(uploadUrl, videoStream);
    }

    // Step 3: Poll status until complete (only for FILE_UPLOAD, PULL_FROM_URL processes server-side)
    if (source === 'FILE_UPLOAD') {
      const finalStatus = await waitForTikTokPost(accessToken, publishId);
      return {
        publishId,
        status: finalStatus,
      };
    } else {
      // For PULL_FROM_URL, return immediately (processing happens server-side)
      return {
        publishId,
        status: 'PROCESSING',
      };
    }
  } catch (error) {
    // Handle token expiration
    if (error instanceof Error && error.message.includes('expired')) {
      // Retry once with refreshed token
      try {
        const provider = await prisma.oauthProvider.findUnique({
          where: {
            userId_platform: {
              userId,
              platform: 'tiktok',
            },
          },
        });

        if (provider?.refreshToken) {
          const refreshed = await refreshTikTokToken(userId, provider.refreshToken);
          // Retry the upload with new token
          return publishTikTokVideo(userId, contentUrl, caption, options);
        }
      } catch (retryError) {
        log.error('Failed to retry TikTok upload after token refresh', retryError as Error);
      }
    }

    // Handle rate limits with exponential backoff suggestion
    if (error instanceof Error && error.message.includes('rate limit')) {
      throw new Error('TikTok rate limit exceeded. Please try again in a few minutes.');
    }

    log.error('TikTok video publish failed', error as Error, {
      userId,
      contentUrl,
      publishId: 'unknown',
    });

    throw error;
  }
}

/**
 * Get TikTok user info
 */
export async function getTikTokUserInfo(userId: string): Promise<any> {
  const accessToken = await getTikTokToken(userId);

  try {
    const response = await axios.get(
      `${TIKTOK_API_BASE}/v2/user/info/`,
      {
        params: {
          fields: 'open_id,union_id,avatar_url,display_name',
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    return response.data.data;
  } catch (error) {
    log.error('Failed to get TikTok user info', error as Error, { userId });
    throw error;
  }
}


