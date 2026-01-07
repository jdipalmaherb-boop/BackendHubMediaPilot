# Meta Ads Backend Integration Guide

## Overview

This document describes the complete Meta (Facebook/Instagram) Ads backend integration, including creative uploads, campaign creation, optimization, and AI-powered suggestions. The system uses Meta's Graph API v18.0 and is optimized for the Andromeda engine.

## Architecture

### Components

1. **Meta Ads Service** (`apps/api/src/services/metaAds.ts`)
   - Handles all Meta API interactions
   - Supports creative uploads (images & videos)
   - Creates campaigns, ad sets, creatives, and ads
   - Fetches insights with retry logic
   - Batch operations support

2. **Multi-Creative Campaign Endpoint** (`POST /api/campaigns/create-multi`)
   - Accepts up to 10 creatives per campaign
   - Automatically uploads to Meta
   - Creates complete campaign structure
   - Returns diversity warnings

3. **Optimization Worker** (`apps/api/src/workers/videoAdOptimizerWorker.ts`)
   - Polls Meta API for insights every few hours
   - Automatically pauses underperforming ads
   - Updates metrics in database
   - Logs all optimization decisions

4. **Stats & Tips Endpoints**
   - `GET /api/campaigns/:id/stats` - Campaign performance by creative
   - `POST /api/campaigns/:id/tips` - AI-generated creative suggestions

## API Endpoints

### POST /api/campaigns/create-multi

Create a campaign with multiple creatives and automatically upload to Meta.

**Request Body:**
```json
{
  "campaignName": "Summer Sale Campaign",
  "budget": 100.0,
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-01-31T23:59:59Z",
  "targeting": {
    "age_min": 25,
    "age_max": 55,
    "genders": [1, 2],
    "geo_locations": {
      "countries": ["US"]
    },
    "interests": [
      {"id": "6003107902433", "name": "Marketing"}
    ]
  },
  "creatives": [
    {
      "url": "https://example.com/image1.jpg",
      "type": "image",
      "copy": "Get 50% off today!"
    },
    {
      "url": "https://example.com/video1.mp4",
      "type": "video",
      "copy": "See how it works"
    }
  ],
  "adCopy": ["Variation 1", "Variation 2"],
  "objective": "OUTCOME_CONVERSIONS"
}
```

**Response:**
```json
{
  "campaign": { /* Campaign object */ },
  "creatives": [
    {
      "creative": { /* AdCreative object */ },
      "metaCreativeId": "123456789",
      "metaAdId": "987654321"
    }
  ],
  "warnings": [
    "3 of your 5 creatives appear visually identical. Add variety for better performance."
  ],
  "metaConfigured": true,
  "message": "Campaign created and uploaded to Meta successfully"
}
```

**Features:**
- ✅ Automatic creative upload to Meta
- ✅ Campaign, Ad Set, Creative, and Ad creation
- ✅ Creative diversity checking
- ✅ Stub mode if Meta not configured (saves to DB only)

### GET /api/campaigns/:id/stats

Get campaign statistics grouped by creative.

**Response:**
```json
{
  "campaignId": "uuid",
  "campaignName": "Summer Sale",
  "status": "ACTIVE",
  "statsByCreative": [
    {
      "creativeId": "uuid",
      "creativeUrl": "https://...",
      "headline": "50% Off",
      "text": "Get 50% off today!",
      "cta": "Shop Now",
      "metrics": {
        "impressions": 10000,
        "clicks": 150,
        "spend": 75.50,
        "conversions": 12,
        "cpm": 7.55,
        "ctr": 1.5,
        "cpa": 6.29
      },
      "variants": [...]
    }
  ],
  "summary": {
    "totalCreatives": 5,
    "totalVariants": 5,
    "totalImpressions": 50000,
    "totalClicks": 750,
    "totalSpend": 377.50,
    "totalConversions": 60
  }
}
```

### POST /api/campaigns/:id/tips

Generate AI-powered creative suggestions.

**Request Body:**
```json
{
  "context": "Product launch campaign",
  "industry": "E-commerce"
}
```

**Response:**
```json
{
  "campaignId": "uuid",
  "creativeAngles": [
    {
      "name": "Testimonial Angle",
      "description": "Use customer testimonials to build trust",
      "headlineExample": "See what customers are saying",
      "visualStyle": "Customer photos with quotes",
      "whyItWorks": "Social proof increases conversion rates"
    },
    // ... 4 more angles
  ],
  "visualVariations": [
    {
      "type": "Background Changes",
      "description": "Test different background colors and styles",
      "whyItHelps": "Different backgrounds can improve CTR by 15-20%",
      "implementationTip": "A/B test bright vs. dark backgrounds"
    },
    // ... 4 more variations
  ],
  "note": "Meta's Andromeda engine performs best when you upload multiple diverse creatives per campaign."
}
```

## Creative Diversity Checking

The system automatically checks creative diversity and warns users if:

1. **Similar Filenames**: Multiple creatives have identical base filenames
2. **Same Type**: All creatives are images or all are videos
3. **Similar Copy**: Multiple creatives have identical or very similar copy

**Example Warning:**
```json
{
  "warnings": [
    "3 of your 5 creatives appear visually identical. Add variety for better performance.",
    "All creatives are images. Meta's Andromeda engine performs better with a mix of images and videos."
  ]
}
```

## Optimization Worker

The optimization worker (`videoAdOptimizerWorker`) automatically:

1. **Polls Meta API** every few hours for ad insights
2. **Updates Metrics** in the database (impressions, clicks, spend, CTR, CPM)
3. **Pauses Underperforming Ads**:
   - CTR < 0.5%
   - CPM > $15
   - Requires at least 1,000 impressions for decisions
4. **Logs Actions** to `OptimizationLog` table

**To Start Worker:**
```bash
pnpm --filter api worker:ads
```

**Configuration:**
- `AD_OPTIMIZER_CONCURRENCY` - Number of concurrent optimization jobs (default: 2)
- `REDIS_URL` - Required for BullMQ queue

## Database Schema

### New/Updated Models

**AdCreative:**
- `metaAdId` - Meta creative ID
- `metaImageHash` - Meta image hash (for images)
- `metaVideoId` - Meta video ID (for videos)

**AdMetric:**
- `cpm` - Cost per mille (1000 impressions)
- `ctr` - Click-through rate
- `cpc` - Cost per click

**OptimizationLog (NEW):**
- `campaignId` - Campaign ID
- `variantId` - Optional variant ID
- `reason` - Why optimization was triggered
- `action` - What action was taken (pause_ad, increase_budget, etc.)
- `details` - Additional context (JSON)

## Environment Configuration

**Required:**
```bash
META_ACCESS_TOKEN=EAAB...  # Long-lived access token
META_AD_ACCOUNT_ID=act_...  # Ad account ID
```

**Optional:**
```bash
META_WEBHOOK_SECRET=...     # For webhook signature verification
AD_OPTIMIZER_CONCURRENCY=2  # Optimization worker concurrency
```

## Error Handling

The system gracefully handles:

- **Missing Meta Credentials**: Falls back to stub mode (saves to DB only)
- **API Failures**: Retries with exponential backoff (3 attempts)
- **Rate Limits**: Automatically retries on 429 errors
- **Invalid Data**: Returns clear validation errors

## Best Practices

1. **Upload Diverse Creatives**
   - Mix of images and videos
   - Different angles (testimonial, benefit, curiosity)
   - Varied copy and CTAs
   - Different visual styles

2. **Monitor Performance**
   - Check stats endpoint regularly
   - Review optimization logs
   - Adjust thresholds if needed

3. **Use AI Tips**
   - Generate tips before creating campaigns
   - Test suggested angles
   - Implement visual variations

4. **Start Small**
   - Begin with 3-5 creatives
   - Test different approaches
   - Scale winners

## Testing

### Test Campaign Creation (Stub Mode)
```bash
curl -X POST http://localhost:4000/api/campaigns/create-multi \
  -H "Authorization: Bearer <firebase-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "campaignName": "Test Campaign",
    "budget": 50,
    "creatives": [
      {"url": "https://example.com/test.jpg", "type": "image"}
    ]
  }'
```

### Test with Meta API
1. Configure `META_ACCESS_TOKEN` and `META_AD_ACCOUNT_ID`
2. Use real creative URLs (must be publicly accessible)
3. Campaign will be created in Meta and database

## Troubleshooting

### "Meta API credentials not configured"
- Set `META_ACCESS_TOKEN` and `META_AD_ACCOUNT_ID` in `.env`
- Verify token has `ads_management` permission
- Check token hasn't expired

### "Creative upload failed"
- Ensure creative URLs are publicly accessible
- Check file size limits (Meta has limits)
- Verify file format is supported

### "Optimization worker not running"
- Check Redis is running: `redis-cli ping`
- Verify `REDIS_URL` is set
- Start worker: `pnpm --filter api worker:ads`

### "No metrics found"
- Wait for ads to accumulate impressions (at least 1,000)
- Check Meta ad account for active ads
- Verify `externalId` is set on variants

## Migration

After updating the Prisma schema, run:

```bash
pnpm --filter api prisma migrate dev --name add_meta_ads_fields
```

This will:
- Add `metaAdId`, `metaImageHash`, `metaVideoId` to `AdCreative`
- Add `cpm`, `ctr`, `cpc` to `AdMetric`
- Create `OptimizationLog` model

## Performance Considerations

- **Batch Uploads**: Use `batchUploadMetaCreatives` for multiple creatives
- **Retry Logic**: All API calls have exponential backoff
- **Rate Limiting**: Respects Meta API rate limits
- **Caching**: Consider caching insights for frequently accessed campaigns

## Security

- ✅ All endpoints require Firebase authentication
- ✅ User can only access their own campaigns
- ✅ Meta credentials stored in environment variables
- ✅ No sensitive data in logs
- ✅ Webhook signature verification (if configured)

## Future Enhancements

- [ ] Real-time webhook processing (instead of polling)
- [ ] Advanced optimization rules (budget reallocation)
- [ ] Creative performance scoring
- [ ] Automated A/B test winner selection
- [ ] Multi-platform support (TikTok, YouTube)


