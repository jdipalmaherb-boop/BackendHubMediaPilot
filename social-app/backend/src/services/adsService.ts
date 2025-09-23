import { PostData } from '../types.js';

const ADS_API_BASE = process.env.ADS_API_BASE_URL || 'http://localhost:4000';

export interface AdCampaignResponse {
  id: string;
  status: string;
  name: string;
  budget: number;
}

export async function createAdCampaign(
  postData: PostData, 
  budget: number, 
  duration: number
): Promise<AdCampaignResponse> {
  // Use AI-enhanced content for ad
  const adContent = postData.finalCaption || postData.content;
  const campaignName = `Boost: ${adContent.slice(0, 50)}...`;
  
  const response = await fetch(`${ADS_API_BASE}/api/ads/meta/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orgId: postData.orgId,
      name: campaignName,
      budget: budget,
      // Pass AI data for ad optimization
      aiData: {
        score: postData.aiScore,
        tips: postData.aiTips,
        enhancedContent: adContent,
        mediaUrl: postData.editedAssetUrl,
      }
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create ad campaign: ${response.status}`);
  }

  return response.json();
}

export async function testAdCampaign(campaignId: string): Promise<AdCampaignResponse> {
  const response = await fetch(`${ADS_API_BASE}/api/ads/meta/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      campaignId,
      variants: [
        { name: 'A', content: 'Original content' },
        { name: 'B', content: 'AI-enhanced content' },
      ]
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to test ad campaign: ${response.status}`);
  }

  return response.json();
}



