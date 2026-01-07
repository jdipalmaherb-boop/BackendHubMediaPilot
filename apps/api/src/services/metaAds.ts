/**
 * Meta Ads API Integration Service
 * 
 * Handles all interactions with Meta Marketing API (Graph API v18.0)
 * Supports creative uploads, ad creation, insights fetching, and optimization
 * 
 * @see https://developers.facebook.com/docs/marketing-apis
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { env } from '../env.js';
import { log } from '../lib/logger.js';
import FormData from 'form-data';
import fs from 'fs/promises';
import path from 'path';

const META_API_VERSION = 'v18.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

interface MetaCredentials {
  accessToken?: string;
  adAccountId?: string;
}

interface MetaAdImageResponse {
  hash: string;
  url?: string;
}

interface MetaAdVideoResponse {
  video_id: string;
  success: boolean;
}

interface MetaAdCreativeResponse {
  id: string;
}

interface MetaAdResponse {
  id: string;
  name?: string;
  status?: string;
}

interface MetaAdInsights {
  impressions: string;
  clicks: string;
  spend: string;
  cpm: string;
  ctr: string;
  cpc: string;
  conversions?: string;
  date_start: string;
  date_stop: string;
}

interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  retryableStatuses?: number[];
}

/**
 * Check if Meta API is properly configured
 */
export function isMetaConfigured(credentials?: MetaCredentials): boolean {
  const token = credentials?.accessToken || env.META_ACCESS_TOKEN;
  const accountId = credentials?.adAccountId || env.META_AD_ACCOUNT_ID;
  return Boolean(token && accountId);
}

/**
 * Create axios instance with default config for Meta API
 */
function createMetaClient(accessToken: string): AxiosInstance {
  return axios.create({
    baseURL: META_API_BASE,
    timeout: 30000,
    params: {
      access_token: accessToken,
    },
  });
}

/**
 * Retry logic for API calls
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    retryableStatuses = [429, 500, 502, 503, 504],
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const axiosError = error as AxiosError;
        const status = axiosError.response?.status;

        if (status && retryableStatuses.includes(status)) {
          const delay = retryDelay * Math.pow(2, attempt); // Exponential backoff
          log.warn({
            type: 'meta_api_retry',
            attempt: attempt + 1,
            maxRetries,
            status,
            delay,
          }, `Meta API call failed, retrying in ${delay}ms...`);

          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      throw lastError;
    }
  }

  throw lastError || new Error('Retry failed');
}

/**
 * Upload an image creative to Meta
 * 
 * @param imageUrl - Public URL of the image (Meta will download it)
 * @param credentials - Optional override credentials
 * @returns Meta image hash
 */
export async function uploadMetaAdImage(
  imageUrl: string,
  credentials?: MetaCredentials
): Promise<MetaAdImageResponse> {
  const accessToken = credentials?.accessToken || env.META_ACCESS_TOKEN;
  const adAccountId = credentials?.adAccountId || env.META_AD_ACCOUNT_ID;

  if (!accessToken || !adAccountId) {
    throw new Error('Meta API credentials not configured. Set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID.');
  }

  const client = createMetaClient(accessToken);

  try {
    const response = await withRetry(async () => {
      return await client.post<MetaAdImageResponse>(
        `/act_${adAccountId}/adimages`,
        {
          url: imageUrl,
        }
      );
    });

    log.info({
      type: 'meta_image_uploaded',
      hash: response.data.hash,
      imageUrl,
    }, 'Meta ad image uploaded successfully');

    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    log.error({
      type: 'meta_image_upload_failed',
      error: axiosError.message,
      status: axiosError.response?.status,
      data: axiosError.response?.data,
      imageUrl,
    }, 'Failed to upload image to Meta');

    throw new Error(`Meta image upload failed: ${axiosError.response?.data?.error?.message || axiosError.message}`);
  }
}

/**
 * Upload a video creative to Meta
 * 
 * @param videoUrl - Public URL of the video (Meta will download it)
 * @param credentials - Optional override credentials
 * @returns Meta video ID
 */
export async function uploadMetaAdVideo(
  videoUrl: string,
  credentials?: MetaCredentials
): Promise<MetaAdVideoResponse> {
  const accessToken = credentials?.accessToken || env.META_ACCESS_TOKEN;
  const adAccountId = credentials?.adAccountId || env.META_AD_ACCOUNT_ID;

  if (!accessToken || !adAccountId) {
    throw new Error('Meta API credentials not configured. Set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID.');
  }

  const client = createMetaClient(accessToken);

  try {
    const response = await withRetry(async () => {
      return await client.post<MetaAdVideoResponse>(
        `/act_${adAccountId}/advideos`,
        {
          file_url: videoUrl,
        }
      );
    });

    log.info({
      type: 'meta_video_uploaded',
      videoId: response.data.video_id,
      videoUrl,
    }, 'Meta ad video uploaded successfully');

    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    log.error({
      type: 'meta_video_upload_failed',
      error: axiosError.message,
      status: axiosError.response?.status,
      data: axiosError.response?.data,
      videoUrl,
    }, 'Failed to upload video to Meta');

    throw new Error(`Meta video upload failed: ${axiosError.response?.data?.error?.message || axiosError.message}`);
  }
}

/**
 * Create an ad creative in Meta
 * 
 * @param creativeData - Creative configuration
 * @param credentials - Optional override credentials
 * @returns Meta creative ID
 */
export async function createMetaAdCreative(
  creativeData: {
    name: string;
    object_story_spec?: {
      page_id: string;
      link_data?: {
        image_hash?: string;
        video_id?: string;
        link: string;
        message: string;
        call_to_action?: {
          type: string;
          value: {
            link: string;
          };
        };
      };
    };
    image_hash?: string;
    video_id?: string;
    body?: string;
    title?: string;
    call_to_action_type?: string;
  },
  credentials?: MetaCredentials
): Promise<MetaAdCreativeResponse> {
  const accessToken = credentials?.accessToken || env.META_ACCESS_TOKEN;
  const adAccountId = credentials?.adAccountId || env.META_AD_ACCOUNT_ID;

  if (!accessToken || !adAccountId) {
    throw new Error('Meta API credentials not configured. Set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID.');
  }

  const client = createMetaClient(accessToken);

  try {
    const response = await withRetry(async () => {
      return await client.post<MetaAdCreativeResponse>(
        `/act_${adAccountId}/adcreatives`,
        creativeData
      );
    });

    log.info({
      type: 'meta_creative_created',
      creativeId: response.data.id,
      name: creativeData.name,
    }, 'Meta ad creative created successfully');

    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    log.error({
      type: 'meta_creative_create_failed',
      error: axiosError.message,
      status: axiosError.response?.status,
      data: axiosError.response?.data,
      creativeData,
    }, 'Failed to create Meta ad creative');

    throw new Error(`Meta creative creation failed: ${axiosError.response?.data?.error?.message || axiosError.message}`);
  }
}

/**
 * Create an ad set in Meta
 * 
 * @param adSetData - Ad set configuration
 * @param credentials - Optional override credentials
 * @returns Meta ad set ID
 */
export async function createMetaAdSet(
  adSetData: {
    name: string;
    campaign_id: string;
    daily_budget?: number;
    lifetime_budget?: number;
    billing_event: string;
    optimization_goal: string;
    targeting: Record<string, unknown>;
    start_time?: string;
    end_time?: string;
    status?: string;
  },
  credentials?: MetaCredentials
): Promise<{ id: string }> {
  const accessToken = credentials?.accessToken || env.META_ACCESS_TOKEN;
  const adAccountId = credentials?.adAccountId || env.META_AD_ACCOUNT_ID;

  if (!accessToken || !adAccountId) {
    throw new Error('Meta API credentials not configured. Set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID.');
  }

  const client = createMetaClient(accessToken);

  try {
    const response = await withRetry(async () => {
      return await client.post<{ id: string }>(
        `/act_${adAccountId}/adsets`,
        adSetData
      );
    });

    log.info({
      type: 'meta_adset_created',
      adSetId: response.data.id,
      name: adSetData.name,
    }, 'Meta ad set created successfully');

    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    log.error({
      type: 'meta_adset_create_failed',
      error: axiosError.message,
      status: axiosError.response?.status,
      data: axiosError.response?.data,
    }, 'Failed to create Meta ad set');

    throw new Error(`Meta ad set creation failed: ${axiosError.response?.data?.error?.message || axiosError.message}`);
  }
}

/**
 * Create an ad in Meta
 * 
 * @param adData - Ad configuration
 * @param credentials - Optional override credentials
 * @returns Meta ad ID
 */
export async function createMetaAd(
  adData: {
    name: string;
    adset_id: string;
    creative: { creative_id: string };
    status: string;
  },
  credentials?: MetaCredentials
): Promise<MetaAdResponse> {
  const accessToken = credentials?.accessToken || env.META_ACCESS_TOKEN;
  const adAccountId = credentials?.adAccountId || env.META_AD_ACCOUNT_ID;

  if (!accessToken || !adAccountId) {
    throw new Error('Meta API credentials not configured. Set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID.');
  }

  const client = createMetaClient(accessToken);

  try {
    const response = await withRetry(async () => {
      return await client.post<MetaAdResponse>(
        `/act_${adAccountId}/ads`,
        adData
      );
    });

    log.info({
      type: 'meta_ad_created',
      adId: response.data.id,
      name: adData.name,
    }, 'Meta ad created successfully');

    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    log.error({
      type: 'meta_ad_create_failed',
      error: axiosError.message,
      status: axiosError.response?.status,
      data: axiosError.response?.data,
    }, 'Failed to create Meta ad');

    throw new Error(`Meta ad creation failed: ${axiosError.response?.data?.error?.message || axiosError.message}`);
  }
}

/**
 * Create a campaign in Meta
 * 
 * @param campaignData - Campaign configuration
 * @param credentials - Optional override credentials
 * @returns Meta campaign ID
 */
export async function createMetaCampaign(
  campaignData: {
    name: string;
    objective: string;
    status: string;
    special_ad_categories?: string[];
  },
  credentials?: MetaCredentials
): Promise<{ id: string }> {
  const accessToken = credentials?.accessToken || env.META_ACCESS_TOKEN;
  const adAccountId = credentials?.adAccountId || env.META_AD_ACCOUNT_ID;

  if (!accessToken || !adAccountId) {
    throw new Error('Meta API credentials not configured. Set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID.');
  }

  const client = createMetaClient(accessToken);

  try {
    const response = await withRetry(async () => {
      return await client.post<{ id: string }>(
        `/act_${adAccountId}/campaigns`,
        campaignData
      );
    });

    log.info({
      type: 'meta_campaign_created',
      campaignId: response.data.id,
      name: campaignData.name,
    }, 'Meta campaign created successfully');

    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    log.error({
      type: 'meta_campaign_create_failed',
      error: axiosError.message,
      status: axiosError.response?.status,
      data: axiosError.response?.data,
    }, 'Failed to create Meta campaign');

    throw new Error(`Meta campaign creation failed: ${axiosError.response?.data?.error?.message || axiosError.message}`);
  }
}

/**
 * Pause an ad in Meta
 * 
 * @param adId - Meta ad ID
 * @param credentials - Optional override credentials
 */
export async function pauseMetaAd(
  adId: string,
  credentials?: MetaCredentials
): Promise<{ success: boolean }> {
  const accessToken = credentials?.accessToken || env.META_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error('Meta API credentials not configured. Set META_ACCESS_TOKEN.');
  }

  const client = createMetaClient(accessToken);

  try {
    await withRetry(async () => {
      return await client.post(`/${adId}`, {
        status: 'PAUSED',
      });
    });

    log.info({
      type: 'meta_ad_paused',
      adId,
    }, 'Meta ad paused successfully');

    return { success: true };
  } catch (error) {
    const axiosError = error as AxiosError;
    log.error({
      type: 'meta_ad_pause_failed',
      error: axiosError.message,
      status: axiosError.response?.status,
      adId,
    }, 'Failed to pause Meta ad');

    throw new Error(`Meta ad pause failed: ${axiosError.response?.data?.error?.message || axiosError.message}`);
  }
}

/**
 * Fetch ad insights from Meta
 * 
 * @param adId - Meta ad ID
 * @param dateRange - Date range for insights
 * @param credentials - Optional override credentials
 * @returns Ad insights data
 */
export async function fetchMetaAdInsights(
  adId: string,
  dateRange: { start: string; end: string },
  credentials?: MetaCredentials
): Promise<MetaAdInsights[]> {
  const accessToken = credentials?.accessToken || env.META_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error('Meta API credentials not configured. Set META_ACCESS_TOKEN.');
  }

  const client = createMetaClient(accessToken);

  try {
    const response = await withRetry(async () => {
      return await client.get<{ data: MetaAdInsights[] }>(
        `/${adId}/insights`,
        {
          params: {
            time_range: JSON.stringify({
              since: dateRange.start,
              until: dateRange.end,
            }),
            fields: 'impressions,clicks,spend,cpm,ctr,cpc,conversions,date_start,date_stop',
            level: 'ad',
          },
        }
      );
    });

    log.info({
      type: 'meta_insights_fetched',
      adId,
      dateRange,
      count: response.data.data.length,
    }, 'Meta ad insights fetched successfully');

    return response.data.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    log.error({
      type: 'meta_insights_fetch_failed',
      error: axiosError.message,
      status: axiosError.response?.status,
      adId,
    }, 'Failed to fetch Meta ad insights');

    throw new Error(`Meta insights fetch failed: ${axiosError.response?.data?.error?.message || axiosError.message}`);
  }
}

/**
 * Batch upload multiple creatives to Meta
 * 
 * @param creatives - Array of creative URLs with metadata
 * @param credentials - Optional override credentials
 * @returns Array of uploaded creative hashes/IDs
 */
export async function batchUploadMetaCreatives(
  creatives: Array<{
    url: string;
    type: 'image' | 'video';
    name?: string;
  }>,
  credentials?: MetaCredentials
): Promise<Array<{ url: string; type: string; hash?: string; videoId?: string; error?: string }>> {
  const results = await Promise.allSettled(
    creatives.map(async (creative) => {
      try {
        if (creative.type === 'image') {
          const result = await uploadMetaAdImage(creative.url, credentials);
          return {
            url: creative.url,
            type: 'image',
            hash: result.hash,
          };
        } else {
          const result = await uploadMetaAdVideo(creative.url, credentials);
          return {
            url: creative.url,
            type: 'video',
            videoId: result.video_id,
          };
        }
      } catch (error) {
        return {
          url: creative.url,
          type: creative.type,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    })
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        url: creatives[index].url,
        type: creatives[index].type,
        error: result.reason?.message || 'Upload failed',
      };
    }
  });
}


