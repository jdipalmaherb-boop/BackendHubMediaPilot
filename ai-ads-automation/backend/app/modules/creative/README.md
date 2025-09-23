# Creative Generator Module

This module handles the generation of creative assets (images, videos, carousels) for ad campaigns. It integrates with an external video app for high-quality creative generation and falls back to synthetic generation when the video app is unavailable.

## Features

- **Video App Integration**: Connects to an external creative/video app for professional asset generation
- **Synthetic Fallback**: Generates placeholder creatives when the video app is unavailable
- **Platform-Specific Optimization**: Tailored creative generation for Meta, Google Ads, and TikTok
- **Performance Tracking**: Monitors creative performance and provides optimization suggestions
- **AI-Powered Insights**: Uses AI to analyze and improve creative effectiveness

## Architecture

```
CreativeGenerator
├── VideoAppClient          # External video app integration
├── SyntheticGenerator      # Fallback creative generation
└── PerformanceAnalyzer    # Creative performance analysis
```

## Usage

### Generate Creatives

```python
from app.modules.creative import CreativeGenerator

generator = CreativeGenerator()

# Generate creatives for a campaign
creatives = await generator.generate_campaign_creatives(
    db=db,
    campaign_id="campaign_123",
    creative_brief={
        "product": "Fitness App",
        "target_audience": "Fitness enthusiasts",
        "style": "Modern, energetic",
        "brand_colors": ["#FF6B6B", "#4ECDC4"]
    },
    count=3
)
```

### Optimize Creative

```python
# Optimize an existing creative
optimized = await generator.optimize_creative(
    db=db,
    creative_id="creative_123",
    optimization_goals={
        "improve_engagement": True,
        "increase_conversions": True
    }
)
```

## Configuration

Set the following environment variables:

```bash
# Video app integration
CREATIVE_APP_API_URL=https://your-video-app.com/api
CREATIVE_APP_API_KEY=your_api_key

# Fallback settings
FALLBACK_TO_SYNTHETIC=true
```

## API Endpoints

- `POST /api/v1/creative/generate` - Generate creatives for a campaign
- `POST /api/v1/creative/optimize` - Optimize an existing creative
- `GET /api/v1/creative/performance/{campaign_id}` - Get performance insights

## Testing

Run the creative module tests:

```bash
pytest backend/tests/modules/test_creative.py -v
```

## Dependencies

- `httpx` - HTTP client for video app integration
- `sqlalchemy` - Database operations
- `pydantic` - Data validation



