# Platform Integrations Module

This module handles integration with various ad platforms including Meta Ads, Google Ads, and TikTok Ads. It provides a unified interface for managing campaigns, ad groups, and creatives across different platforms.

## Features

- **Multi-Platform Support**: Meta Ads, Google Ads, and TikTok Ads
- **Unified API**: Consistent interface across all platforms
- **Authentication**: OAuth and API key management
- **Campaign Management**: Create, update, and manage campaigns
- **Ad Group Management**: Create and manage ad groups
- **Creative Management**: Create and manage ad creatives
- **Performance Tracking**: Get performance data from all platforms
- **Rate Limiting**: Built-in rate limit handling
- **Error Handling**: Consistent error handling across platforms

## Architecture

```
Platform Integrations
├── BasePlatformClient     # Abstract base class
├── MetaAdsClient         # Meta Ads API integration
├── GoogleAdsClient       # Google Ads API integration
├── TikTokAdsClient       # TikTok Ads API integration
└── API Router            # FastAPI endpoints
```

## Usage

### Authenticate with Platform

```python
from app.modules.platform_integrations import MetaAdsClient

client = MetaAdsClient()

# Authenticate with Meta Ads
success = await client.authenticate({
    "access_token": "your_access_token",
    "ad_account_id": "act_123456789"
})
```

### Create Campaign

```python
# Create a campaign
campaign_data = {
    "name": "My Campaign",
    "goal": "conversions",
    "budget_daily": 100.0,
    "start_date": "2024-01-01",
    "end_date": "2024-01-31"
}

result = await client.create_campaign(campaign_data)
```

### Create Ad Group

```python
# Create an ad group
ad_group_data = {
    "name": "My Ad Group",
    "campaign_id": "campaign_123",
    "budget_daily": 50.0,
    "targeting": {
        "age_min": 25,
        "age_max": 45,
        "genders": ["female", "male"],
        "interests": ["fitness", "health"]
    }
}

result = await client.create_ad_group(ad_group_data)
```

### Create Ad Creative

```python
# Create an ad creative
creative_data = {
    "name": "My Creative",
    "ad_group_id": "adgroup_123",
    "headline": "Get Fit Today!",
    "description": "Transform your body with our fitness program",
    "image_url": "https://example.com/image.jpg",
    "cta": "LEARN_MORE"
}

result = await client.create_ad_creative(creative_data)
```

### Get Performance Data

```python
# Get campaign performance
performance = await client.get_campaign_performance(
    campaign_id="campaign_123",
    date_range={
        "start_date": "2024-01-01",
        "end_date": "2024-01-31"
    }
)
```

## API Endpoints

### Authentication
- `POST /api/v1/platform/auth/{platform}` - Authenticate with platform

### Campaign Management
- `POST /api/v1/platform/campaign/create/{platform}` - Create campaign
- `PUT /api/v1/platform/campaign/update/{platform}/{campaign_id}` - Update campaign
- `GET /api/v1/platform/campaign/get/{platform}/{campaign_id}` - Get campaign

### Ad Group Management
- `POST /api/v1/platform/adgroup/create/{platform}` - Create ad group
- `PUT /api/v1/platform/adgroup/update/{platform}/{ad_group_id}` - Update ad group
- `GET /api/v1/platform/adgroup/get/{platform}/{ad_group_id}` - Get ad group

### Creative Management
- `POST /api/v1/platform/creative/create/{platform}` - Create creative
- `PUT /api/v1/platform/creative/update/{platform}/{creative_id}` - Update creative
- `GET /api/v1/platform/creative/get/{platform}/{creative_id}` - Get creative

### Performance Data
- `GET /api/v1/platform/performance/{platform}/{entity_type}/{entity_id}` - Get performance data

### Health Check
- `GET /api/v1/platform/health/{platform}` - Check platform health

## Configuration

Set the following environment variables:

```bash
# Meta Ads
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
META_ACCESS_TOKEN=your_meta_access_token
META_AD_ACCOUNT_ID=act_your_meta_ad_account_id

# Google Ads
GOOGLE_ADS_CLIENT_ID=your_google_ads_client_id
GOOGLE_ADS_CLIENT_SECRET=your_google_ads_client_secret
GOOGLE_ADS_DEVELOPER_TOKEN=your_google_ads_developer_token
GOOGLE_ADS_REFRESH_TOKEN=your_google_ads_refresh_token
GOOGLE_ADS_LOGIN_CUSTOMER_ID=your_google_ads_login_customer_id
GOOGLE_ADS_CUSTOMER_ID=your_google_ads_customer_id

# TikTok Ads
TIKTOK_ADS_APP_ID=your_tiktok_ads_app_id
TIKTOK_ADS_SECRET=your_tiktok_ads_secret
TIKTOK_ADS_ACCESS_TOKEN=your_tiktok_ads_access_token
TIKTOK_ADS_ADVERTISER_ID=your_tiktok_ads_advertiser_id
```

## Platform-Specific Notes

### Meta Ads
- Uses Graph API v18.0
- Requires access token and ad account ID
- Supports campaigns, ad sets, and ads
- Rate limit: 200 calls per hour per user

### Google Ads
- Uses Google Ads API v14
- Requires OAuth2 credentials and developer token
- Supports campaigns, ad groups, and ads
- Rate limit: 10,000 operations per day

### TikTok Ads
- Uses TikTok Business API v1.3
- Requires access token and advertiser ID
- Supports campaigns, ad groups, and ads
- Rate limit: 1000 calls per hour

## Testing

Run the platform integrations tests:

```bash
pytest backend/tests/modules/test_platform_integrations.py -v
```

## Dependencies

- `httpx` - HTTP client for API calls
- `sqlalchemy` - Database operations
- `pydantic` - Data validation
- `fastapi` - API framework



