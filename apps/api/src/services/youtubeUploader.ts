import { google } from 'googleapis';
import axios, { AxiosError } from 'axios';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { prisma } from '../lib/prisma';
import { log } from '../lib/logger';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

interface YouTubeVideoMetadata {
  title: string;
  description?: string;
  tags?: string[];
  categoryId?: string;
  privacyStatus?: 'private' | 'unlisted' | 'public';
  defaultLanguage?: string;
  defaultAudioLanguage?: string;
}

interface YouTubeUploadOptions {
  metadata: YouTubeVideoMetadata;
  notifySubscribers?: boolean;
}

/**
 * Refresh YouTube/Google access token
 */
export async function refreshYouTubeToken(
  userId: string,
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('YouTube credentials not configured');
  }

  try {
    const response = await axios.post(
      GOOGLE_TOKEN_URL,
      new URLSearchParams({
        client_id: clientId,
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

    const { access_token, expires_in } = response.data;
    const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000);

    // Update stored token
    await prisma.oauthProvider.update({
      where: {
        userId_platform: {
          userId,
          platform: 'youtube',
        },
      },
      data: {
        accessToken: access_token,
        expiresAt,
        updatedAt: new Date(),
      },
    });

    return {
      accessToken: access_token,
      expiresAt,
    };
  } catch (error) {
    log.error('Failed to refresh YouTube token', error as Error, { userId });
    throw new Error(`YouTube token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get valid YouTube access token (refresh if needed)
 */
export async function getYouTubeToken(userId: string): Promise<string> {
  const provider = await prisma.oauthProvider.findUnique({
    where: {
      userId_platform: {
        userId,
        platform: 'youtube',
      },
    },
  });

  if (!provider) {
    throw new Error('YouTube account not connected');
  }

  if (!provider.refreshToken) {
    throw new Error('YouTube refresh token not available');
  }

  // Check if token is expired or will expire soon (within 5 minutes)
  const now = new Date();
  const expiresAt = provider.expiresAt || new Date(0);
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (!expiresAt || expiresAt < fiveMinutesFromNow) {
    // Token expired or expiring soon, refresh it
    const refreshed = await refreshYouTubeToken(userId, provider.refreshToken);
    return refreshed.accessToken;
  }

  return provider.accessToken;
}

/**
 * Create YouTube OAuth2 client
 */
function createYouTubeClient(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  return google.youtube({
    version: 'v3',
    auth: oauth2Client,
  });
}

/**
 * Upload video to YouTube
 */
export async function uploadYouTubeVideo(
  userId: string,
  contentUrl: string,
  caption: string,
  options?: Partial<YouTubeUploadOptions>
): Promise<{ videoId: string; status: string }> {
  // Check configuration
  if (!process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_CLIENT_SECRET) {
    throw new Error('YouTube integration not configured');
  }

  // Get access token (refresh if needed)
  let accessToken: string;
  try {
    accessToken = await getYouTubeToken(userId);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not connected')) {
      throw new Error('YouTube account not connected. Please connect your YouTube account first.');
    }
    throw error;
  }

  const youtube = createYouTubeClient(accessToken);

  // Prepare video metadata
  const metadata: YouTubeVideoMetadata = {
    title: caption || 'Untitled Video',
    description: options?.metadata?.description || caption,
    tags: options?.metadata?.tags || [],
    privacyStatus: options?.metadata?.privacyStatus || 'public',
    ...options?.metadata,
  };

  try {
    // Determine if contentUrl is a URL or file path
    const isUrl = contentUrl.startsWith('http://') || contentUrl.startsWith('https://');
    let videoStream: Readable;

    if (isUrl) {
      // Download from URL
      const response = await axios.get(contentUrl, { responseType: 'stream' });
      videoStream = response.data;
    } else {
      // Read from file system
      videoStream = createReadStream(contentUrl);
    }

    // Upload video using YouTube Data API
    const response = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: metadata.title,
          description: metadata.description,
          tags: metadata.tags,
          defaultLanguage: metadata.defaultLanguage,
          defaultAudioLanguage: metadata.defaultAudioLanguage,
        },
        status: {
          privacyStatus: metadata.privacyStatus || 'public',
          selfDeclaredMadeForKids: false,
        },
      },
      media: {
        body: videoStream,
      },
      notifySubscribers: options?.notifySubscribers ?? false,
    });

    const videoId = response.data.id;
    if (!videoId) {
      throw new Error('YouTube upload succeeded but no video ID returned');
    }

    return {
      videoId,
      status: 'uploaded',
    };
  } catch (error) {
    // Handle token expiration
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 401) {
        // Token expired, refresh and retry once
        try {
          const provider = await prisma.oauthProvider.findUnique({
            where: {
              userId_platform: {
                userId,
                platform: 'youtube',
              },
            },
          });

          if (provider?.refreshToken) {
            const refreshed = await refreshYouTubeToken(userId, provider.refreshToken);
            // Retry the upload with new token
            return uploadYouTubeVideo(userId, contentUrl, caption, options);
          }
        } catch (retryError) {
          log.error('Failed to retry YouTube upload after token refresh', retryError as Error);
        }
      }

      // Handle quota errors
      if (axiosError.response?.status === 403) {
        const errorData = axiosError.response.data as any;
        if (errorData?.error?.message?.includes('quota') || errorData?.error?.message?.includes('quotaExceeded')) {
          throw new Error('YouTube API quota exceeded. Daily upload limit reached.');
        }
      }

      // Handle other API errors
      if (axiosError.response?.data) {
        const errorData = axiosError.response.data as any;
        const errorMessage = errorData?.error?.message || 'YouTube API error';
        throw new Error(`YouTube upload failed: ${errorMessage}`);
      }
    }

    // Handle Google API client errors
    if (error instanceof Error) {
      if (error.message.includes('quota')) {
        throw new Error('YouTube API quota exceeded. Please try again tomorrow.');
      }
      if (error.message.includes('duplicate')) {
        throw new Error('This video has already been uploaded to YouTube.');
      }
      if (error.message.includes('file size')) {
        throw new Error('Video file exceeds YouTube size limits.');
      }
    }

    log.error('YouTube video upload failed', error as Error, {
      userId,
      contentUrl,
    });

    throw error;
  }
}

/**
 * Get YouTube channel info
 */
export async function getYouTubeChannelInfo(userId: string): Promise<any> {
  const accessToken = await getYouTubeToken(userId);
  const youtube = createYouTubeClient(accessToken);

  try {
    const response = await youtube.channels.list({
      part: ['snippet', 'contentDetails', 'statistics'],
      mine: true,
    });

    return response.data.items?.[0];
  } catch (error) {
    log.error('Failed to get YouTube channel info', error as Error, { userId });
    throw error;
  }
}


