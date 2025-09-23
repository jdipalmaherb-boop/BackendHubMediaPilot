# Trend Discovery Module

## Overview
The Trend Discovery module identifies trending content across social media platforms and generates creative strategies to help brands capitalize on viral opportunities. It integrates with multiple platform APIs to fetch real-time trending data and uses AI to create actionable content recipes.

## Features
- **Multi-Platform Support**: TikTok, Instagram, Twitter, YouTube trend fetching
- **AI-Powered Recipe Generation**: Creates comprehensive content strategies from trends
- **Trend Analysis**: Evaluates trend potential and relevance for specific brands
- **Creative Direction**: Provides hooks, B-roll lists, captions, scripts, and image prompts
- **Platform Optimization**: Tailors content for specific social media platforms
- **Batch Processing**: Generates multiple trend recipes simultaneously
- **Insights Generation**: Provides strategic recommendations and trend insights

## Architecture
- `trend_fetcher.py`: Fetches trending content from various platforms
- `trend_recipe_generator.py`: Generates creative strategies from trends
- `api.py`: FastAPI routes for trend discovery services
- `schemas/trend_discovery.py`: Pydantic models for request/response validation

## Key Components

### TrendFetcher
Service that fetches trending content from:
- **TikTok for Business API**: Trending hashtags and sounds
- **Instagram Basic Display API**: Hashtag trends (via third-party)
- **Twitter API v2**: Trending topics and hashtags
- **YouTube Data API**: Trending videos and extracted hashtags

### TrendRecipeGenerator
AI-powered service that:
- Analyzes trends and creates brand-specific strategies
- Generates creative content recipes with hooks, B-roll, captions
- Provides platform-specific optimization recommendations
- Evaluates trend potential and relevance scores

## API Endpoints

### `POST /api/v1/trend-discovery/fetch`
Fetch trending content from a specific platform.

- **Request Body (`TrendFetchRequest`):**
    ```json
    {
        "platform": "tiktok",
        "country": "US",
        "limit": 20,
        "category": "fashion",
        "api_key": "your_api_key"
    }
    ```

- **Response Body (`TrendFetchResponse`):**
    ```json
    {
        "success": true,
        "platform": "tiktok",
        "country": "US",
        "trends": [
            {
                "name": "#drivetransform",
                "type": "hashtag",
                "meta": {
                    "video_count": 15000,
                    "view_count": 2500000,
                    "trend_score": 85,
                    "category": "automotive",
                    "discovered_at": "2023-10-27T10:00:00Z"
                }
            }
        ],
        "total_count": 1
    }
    ```

### `POST /api/v1/trend-discovery/fetch-all`
Fetch trends from all available platforms.

- **Request Body (`AllPlatformTrendsRequest`):**
    ```json
    {
        "country": "US",
        "limit_per_platform": 10,
        "tiktok_api_key": "your_tiktok_key",
        "instagram_token": "your_instagram_token",
        "twitter_token": "your_twitter_token",
        "youtube_api_key": "your_youtube_key"
    }
    ```

- **Response Body (`AllPlatformTrendsResponse`):**
    ```json
    {
        "success": true,
        "country": "US",
        "platform_trends": {
            "tiktok": [
                {
                    "name": "#drivetransform",
                    "type": "hashtag",
                    "meta": {...}
                }
            ],
            "twitter": [
                {
                    "name": "#techinnovation",
                    "type": "hashtag",
                    "meta": {...}
                }
            ]
        },
        "total_platforms": 2,
        "total_trends": 2
    }
    ```

### `POST /api/v1/trend-discovery/recipe`
Generate a trend recipe for a specific brand and trend.

- **Request Body (`TrendRecipeRequest`):**
    ```json
    {
        "brand": "Nike",
        "trend": {
            "name": "#drivetransform",
            "type": "hashtag",
            "meta": {
                "video_count": 15000,
                "view_count": 2500000,
                "trend_score": 85,
                "category": "automotive"
            }
        },
        "target_audience": "Fitness enthusiasts and athletes",
        "campaign_goal": "brand_awareness"
    }
    ```

- **Response Body (`TrendRecipeResponse`):**
    ```json
    {
        "success": true,
        "brand": "Nike",
        "trend_name": "#drivetransform",
        "trend_type": "hashtag",
        "hook": "Transform your fitness journey in just 3 seconds!",
        "broll_list": [
            "Wide shot of athlete starting their workout",
            "Close-up of Nike shoes during intense training",
            "Action shot of athlete celebrating their achievement"
        ],
        "caption": "Ready to #drivetransform your fitness game? Our latest collection is designed for champions who never settle. Join the movement! 🏃‍♂️ #nike #fitness",
        "ad_script": "In just 15 seconds, see how Nike is revolutionizing fitness with our new Drive Transform collection. Don't just work out - transform!",
        "image_prompt": "Professional athletic photography, Nike products in action, dynamic movement, high energy, modern fitness setting, commercial quality",
        "platform_optimization": "Optimize for TikTok with vertical format, trending audio, and quick cuts",
        "engagement_strategy": "Use the #drivetransform hashtag, engage with user-generated content, create challenges",
        "conversion_tactics": "Include clear CTA to shop Nike.com, limited-time offer, social proof from athletes",
        "trend_metrics": {
            "video_count": 15000,
            "view_count": 2500000,
            "trend_score": 85,
            "category": "automotive"
        },
        "created_at": "2023-10-27T10:00:00Z"
    }
    ```

### `POST /api/v1/trend-discovery/recipes`
Generate trend recipes for multiple trends.

- **Request Body (`MultipleTrendRecipeRequest`):**
    ```json
    {
        "brand": "Nike",
        "trends": [
            {
                "name": "#drivetransform",
                "type": "hashtag",
                "meta": {...}
            },
            {
                "name": "#fitnessmotivation",
                "type": "hashtag",
                "meta": {...}
            }
        ],
        "target_audience": "Fitness enthusiasts",
        "campaign_goal": "brand_awareness",
        "max_recipes": 5
    }
    ```

- **Response Body (`MultipleTrendRecipeResponse`):**
    ```json
    {
        "success": true,
        "brand": "Nike",
        "recipes": [
            {
                "success": true,
                "brand": "Nike",
                "trend_name": "#drivetransform",
                "trend_type": "hashtag",
                "hook": "Transform your fitness journey in just 3 seconds!",
                "broll_list": [...],
                "caption": "...",
                "ad_script": "...",
                "image_prompt": "...",
                "platform_optimization": "...",
                "engagement_strategy": "...",
                "conversion_tactics": "...",
                "trend_metrics": {...},
                "created_at": "2023-10-27T10:00:00Z"
            }
        ],
        "total_recipes": 1
    }
    ```

### `POST /api/v1/trend-discovery/analyze`
Analyze the potential of a trend for a specific brand.

- **Request Body (`TrendAnalysisRequest`):**
    ```json
    {
        "brand": "Nike",
        "trend": {
            "name": "#drivetransform",
            "type": "hashtag",
            "meta": {
                "video_count": 15000,
                "view_count": 2500000,
                "trend_score": 85,
                "category": "automotive"
            }
        },
        "brand_category": "sports"
    }
    ```

- **Response Body (`TrendAnalysisResponse`):**
    ```json
    {
        "success": true,
        "trend_name": "#drivetransform",
        "brand": "Nike",
        "relevance_score": 75,
        "recommendation": "high_priority",
        "priority_color": "green",
        "trend_metrics": {
            "video_count": 15000,
            "view_count": 2500000,
            "trend_score": 85,
            "category": "automotive"
        },
        "analysis": {
            "category_match": false,
            "trend_strength": "high",
            "engagement_level": "high",
            "reach_potential": "high"
        },
        "recommendations": [
            "Create content immediately to capitalize on this trend",
            "Consider running paid ads to boost visibility",
            "Engage with existing content using this trend",
            "Create multiple content pieces across platforms"
        ]
    }
    ```

### `GET /api/v1/trend-discovery/stats`
Get trend discovery system statistics.

- **Response Body (`TrendDiscoveryStats`):**
    ```json
    {
        "total_trends_fetched": 1250,
        "platforms_active": ["tiktok", "twitter", "youtube"],
        "top_categories": ["fashion", "fitness", "technology"],
        "average_trend_score": 78.5,
        "recipes_generated": 450,
        "success_rate": 95.2
    }
    ```

### `POST /api/v1/trend-discovery/insights`
Generate insights and recommendations from trending data.

- **Request Body:**
    ```json
    {
        "trends": [
            {
                "name": "#drivetransform",
                "type": "hashtag",
                "meta": {...}
            }
        ],
        "brand": "Nike"
    }
    ```

- **Response Body (`TrendDiscoveryInsightsResponse`):**
    ```json
    {
        "success": true,
        "insights": [
            {
                "trend_name": "#drivetransform",
                "insight_type": "opportunity",
                "title": "High-Potential Trend: #drivetransform",
                "description": "This trend has high relevance (85/100) for your brand and could drive significant engagement.",
                "action_items": [
                    "Create content immediately",
                    "Consider paid promotion",
                    "Engage with existing content"
                ],
                "priority": "high",
                "confidence": 0.85
            }
        ],
        "total_insights": 1,
        "generated_at": "2023-10-27T10:00:00Z"
    }
    ```

## Usage Examples

### Fetching Trends
```python
from app.modules.trend_discovery.trend_fetcher import TrendFetcher

trend_fetcher = TrendFetcher()

# Fetch TikTok trends
tiktok_trends = await trend_fetcher.fetch_tiktok_trends(
    api_key="your_tiktok_api_key",
    country="US",
    limit=20,
    category="fashion"
)

# Fetch all platform trends
all_trends = await trend_fetcher.fetch_all_trends(
    tiktok_api_key="your_tiktok_key",
    twitter_token="your_twitter_token",
    youtube_api_key="your_youtube_key",
    country="US",
    limit_per_platform=10
)
```

### Generating Trend Recipes
```python
from app.modules.trend_discovery.trend_recipe_generator import TrendRecipeGenerator

recipe_generator = TrendRecipeGenerator()

# Generate single recipe
trend = {
    'name': '#drivetransform',
    'type': 'hashtag',
    'meta': {
        'video_count': 15000,
        'view_count': 2500000,
        'trend_score': 85,
        'category': 'automotive'
    }
}

recipe = await recipe_generator.make_trend_recipe(
    brand="Nike",
    trend=trend,
    target_audience="Fitness enthusiasts",
    campaign_goal="brand_awareness"
)

print(f"Hook: {recipe['hook']}")
print(f"B-roll: {recipe['broll_list']}")
print(f"Caption: {recipe['caption']}")
```

### Analyzing Trend Potential
```python
# Analyze trend potential
analysis = await recipe_generator.analyze_trend_potential(
    brand="Nike",
    trend=trend,
    brand_category="sports"
)

print(f"Relevance Score: {analysis['relevance_score']}/100")
print(f"Recommendation: {analysis['recommendation']}")
print(f"Priority: {analysis['priority_color']}")
```

## Platform-Specific Features

### TikTok
- Fetches trending hashtags and sounds
- Optimizes for vertical video format
- Focuses on quick, engaging content
- Emphasizes trending audio and effects

### Instagram
- Targets hashtag trends
- Optimizes for square/vertical formats
- Focuses on visual storytelling
- Emphasizes aesthetic and lifestyle content

### Twitter
- Fetches trending topics and hashtags
- Optimizes for text-based content
- Focuses on real-time engagement
- Emphasizes news and conversation

### YouTube
- Extracts hashtags from trending videos
- Optimizes for longer-form content
- Focuses on educational and entertainment
- Emphasizes SEO and discoverability

## Integration with Other Modules

### Brand Voice Assistant
- Uses trend recipes to inform caption generation
- Applies trending hashtags to brand content
- Adapts brand voice to trending topics

### Feedback Loop
- Learns from trending content performance
- Identifies which trends drive conversions
- Updates trend relevance based on results

### Creative Generator
- Uses trend recipes for video concepts
- Applies trending visual styles
- Incorporates trending audio and effects

## Best Practices

1. **Monitor Multiple Platforms**: Track trends across all relevant platforms
2. **Act Quickly**: Trends have short lifespans, so create content fast
3. **Stay Authentic**: Ensure trend integration feels natural to your brand
4. **Test and Iterate**: Use A/B testing to optimize trend-based content
5. **Monitor Performance**: Track how trend-based content performs
6. **Plan Ahead**: Use trend analysis to predict future opportunities

## Error Handling

The module includes comprehensive error handling:

- **API Failures**: Falls back to cached or mock data
- **Rate Limiting**: Implements exponential backoff
- **Invalid Responses**: Validates and cleans API responses
- **Network Issues**: Graceful degradation with fallback trends
- **LLM Failures**: Uses template-based recipe generation

## Future Enhancements

1. **Real-Time Monitoring**: Continuous trend monitoring and alerts
2. **Predictive Analytics**: Forecast trend performance and longevity
3. **Cross-Platform Analysis**: Identify trends that work across platforms
4. **Competitor Analysis**: Track competitor trend usage
5. **Automated Content Creation**: Generate content directly from trend recipes
6. **Trend Sentiment Analysis**: Understand trend sentiment and brand fit
7. **Geographic Trends**: Location-specific trend analysis
8. **Industry-Specific Trends**: Category-focused trend discovery



