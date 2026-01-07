import axios, { AxiosError } from 'axios';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { prisma } from '../lib/prisma';
import { log } from '../lib/logger';

const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2';
const LINKEDIN_OAUTH_BASE = 'https://www.linkedin.com/oauth/v2';

interface LinkedInUGCPost {
  author: string; // URN: "urn:li:person:{id}" or "urn:li:organization:{id}"
  lifecycleState: 'PUBLISHED' | 'DRAFT';
  specificContent: {
    'com.linkedin.ugc.ShareContent': {
      shareCommentary: {
        text: string;
      };
      shareMediaCategory: 'NONE' | 'ARTICLE' | 'IMAGE';
      media?: Array<{
        status: 'READY';
        media: string; // URN: "urn:li:digitalmediaAsset:{id}"
        title?: {
          text: string;
        };
      }>;
      originalUrl?: string;
      title?: {
        text: string;
      };
      description?: {
        text: string;
      };
    };
  };
  visibility: {
    'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' | 'CONNECTIONS';
  };
}

interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope: string;
}

interface LinkedInAssetUploadResponse {
  value: {
    uploadUrl: string;
    asset: string; // URN: "urn:li:digitalmediaAsset:{id}"
  };
}

/**
 * Refresh LinkedIn access token
 */
export async function refreshLinkedInToken(
  userId: string,
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: Date; refreshToken?: string }> {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('LinkedIn credentials not configured');
  }

  try {
    const response = await axios.post<LinkedInTokenResponse>(
      `${LINKEDIN_OAUTH_BASE}/accessToken`,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, expires_in, refresh_token } = response.data;
    const expiresAt = new Date(Date.now() + (expires_in || 5184000) * 1000); // Default 60 days

    // Update stored token
    await prisma.oauthProvider.update({
      where: {
        userId_platform: {
          userId,
          platform: 'linkedin',
        },
      },
      data: {
        accessToken: access_token,
        refreshToken: refresh_token || refreshToken, // LinkedIn may rotate refresh token
        expiresAt,
        updatedAt: new Date(),
      },
    });

    return {
      accessToken: access_token,
      expiresAt,
      refreshToken: refresh_token,
    };
  } catch (error) {
    log.error('Failed to refresh LinkedIn token', error as Error, { userId });
    throw new Error(`LinkedIn token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get valid LinkedIn access token (refresh if needed)
 */
export async function getLinkedInToken(userId: string): Promise<string> {
  const provider = await prisma.oauthProvider.findUnique({
    where: {
      userId_platform: {
        userId,
        platform: 'linkedin',
      },
    },
  });

  if (!provider) {
    throw new Error('LinkedIn account not connected');
  }

  // Check if token is expired or will expire soon (within 7 days)
  const now = new Date();
  const expiresAt = provider.expiresAt || new Date(0);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  if (!expiresAt || expiresAt < sevenDaysFromNow) {
    // Token expired or expiring soon, try to refresh if refresh token available
    if (provider.refreshToken) {
      const refreshed = await refreshLinkedInToken(userId, provider.refreshToken);
      return refreshed.accessToken;
    } else {
      throw new Error('LinkedIn token expired and no refresh token available. Please reconnect your account.');
    }
  }

  return provider.accessToken;
}

/**
 * Get LinkedIn user URN
 */
export async function getLinkedInUserURN(userId: string): Promise<string> {
  const provider = await prisma.oauthProvider.findUnique({
    where: {
      userId_platform: {
        userId,
        platform: 'linkedin',
      },
    },
  });

  // Check if URN is stored in metadata
  if (provider?.metadata && typeof provider.metadata === 'object' && 'personURN' in provider.metadata) {
    return provider.metadata.personURN as string;
  }

  // Fetch from LinkedIn API
  const accessToken = await getLinkedInToken(userId);
  try {
    const response = await axios.get(
      `${LINKEDIN_API_BASE}/me`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      }
    );

    const personId = response.data.id;
    const personURN = `urn:li:person:${personId}`;

    // Store in metadata
    await prisma.oauthProvider.update({
      where: {
        userId_platform: {
          userId,
          platform: 'linkedin',
        },
      },
      data: {
        metadata: {
          ...(provider?.metadata as object || {}),
          personURN,
        },
      },
    });

    return personURN;
  } catch (error) {
    log.error('Failed to get LinkedIn user URN', error as Error, { userId });
    throw error;
  }
}

/**
 * Upload image asset to LinkedIn
 */
async function uploadLinkedInImage(
  accessToken: string,
  imageUrl: string,
  userId: string
): Promise<string> {
  try {
    // Step 1: Register upload
    const registerResponse = await axios.post<LinkedInAssetUploadResponse>(
      `${LINKEDIN_API_BASE}/assets?action=registerUpload`,
      {
        registerUploadRequest: {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
          owner: await getLinkedInUserURN(userId),
          serviceRelationships: [
            {
              relationshipType: 'OWNER',
              identifier: 'urn:li:userGeneratedContent',
            },
          ],
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
      }
    );

    const { uploadUrl, asset } = registerResponse.data.value;

    // Step 2: Upload image
    const isUrl = imageUrl.startsWith('http://') || imageUrl.startsWith('https://');
    let imageStream: Readable;

    if (isUrl) {
      const response = await axios.get(imageUrl, { responseType: 'stream' });
      imageStream = response.data;
    } else {
      imageStream = createReadStream(imageUrl);
    }

    await axios.put(uploadUrl, imageStream, {
      headers: {
        'Content-Type': 'image/jpeg',
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    return asset; // Return asset URN
  } catch (error) {
    log.error('Failed to upload LinkedIn image', error as Error, { userId });
    throw new Error(`LinkedIn image upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create LinkedIn post
 */
export async function createLinkedInPost(
  userId: string,
  caption: string,
  options?: {
    imageUrl?: string;
    linkUrl?: string;
    linkTitle?: string;
    linkDescription?: string;
    visibility?: 'PUBLIC' | 'CONNECTIONS';
    organizationURN?: string; // For posting as organization
  }
): Promise<{ postId: string; status: string }> {
  // Check configuration
  if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
    throw new Error('LinkedIn integration not configured');
  }

  // Get access token
  let accessToken: string;
  try {
    accessToken = await getLinkedInToken(userId);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not connected')) {
      throw new Error('LinkedIn account not connected. Please connect your LinkedIn account first.');
    }
    throw error;
  }

  try {
    // Determine author URN
    const authorURN = options?.organizationURN || await getLinkedInUserURN(userId);

    // Determine share media category
    let shareMediaCategory: 'NONE' | 'ARTICLE' | 'IMAGE' = 'NONE';
    let media: Array<{ status: 'READY'; media: string }> | undefined;
    let originalUrl: string | undefined;
    let title: { text: string } | undefined;
    let description: { text: string } | undefined;

    if (options?.imageUrl) {
      shareMediaCategory = 'IMAGE';
      const assetURN = await uploadLinkedInImage(accessToken, options.imageUrl, userId);
      media = [
        {
          status: 'READY',
          media: assetURN,
        },
      ];
    } else if (options?.linkUrl) {
      shareMediaCategory = 'ARTICLE';
      originalUrl = options.linkUrl;
      if (options.linkTitle) {
        title = { text: options.linkTitle };
      }
      if (options.linkDescription) {
        description = { text: options.linkDescription };
      }
    }

    // Build post payload
    const postPayload: LinkedInUGCPost = {
      author: authorURN,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: caption,
          },
          shareMediaCategory,
          ...(media && { media }),
          ...(originalUrl && { originalUrl }),
          ...(title && { title }),
          ...(description && { description }),
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': options?.visibility || 'PUBLIC',
      },
    };

    // Create post
    const response = await axios.post(
      `${LINKEDIN_API_BASE}/ugcPosts`,
      postPayload,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
      }
    );

    // Extract post ID from response
    const postId = response.headers['x-linkedin-id'] || response.data.id || 'unknown';

    return {
      postId,
      status: 'published',
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
                platform: 'linkedin',
              },
            },
          });

          if (provider?.refreshToken) {
            const refreshed = await refreshLinkedInToken(userId, provider.refreshToken);
            // Retry the post with new token
            return createLinkedInPost(userId, caption, options);
          }
        } catch (retryError) {
          log.error('Failed to retry LinkedIn post after token refresh', retryError as Error);
        }
      }

      // Handle permission errors
      if (axiosError.response?.status === 403) {
        const errorData = axiosError.response.data as any;
        const errorMessage = errorData?.message || 'LinkedIn API permission denied';
        throw new Error(`LinkedIn post failed: ${errorMessage}. Please check your permissions.`);
      }

      // Handle other API errors
      if (axiosError.response?.data) {
        const errorData = axiosError.response.data as any;
        const errorMessage = errorData?.message || errorData?.serviceErrorCode || 'LinkedIn API error';
        throw new Error(`LinkedIn post failed: ${errorMessage}`);
      }
    }

    log.error('LinkedIn post creation failed', error as Error, {
      userId,
      caption: caption.substring(0, 50),
    });

    throw error;
  }
}


