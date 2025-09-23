# Targeting & Audience Engine Module

This module handles audience targeting, segmentation, and optimization for ad campaigns. It uses machine learning algorithms to analyze audience data and provide intelligent targeting recommendations.

## Features

- **Audience Analysis**: Analyzes audience segments and identifies high-value demographics
- **ML Optimization**: Uses Random Forest, Gradient Boosting, and Neural Networks for targeting optimization
- **Platform-Specific Targeting**: Tailored targeting strategies for Meta, Google Ads, and TikTok
- **Performance Prediction**: Predicts audience performance and CPA/ROAS
- **Segmentation**: Advanced audience segmentation based on demographics, behaviors, and interests

## Architecture

```
TargetingEngine
├── AudienceAnalyzer          # Audience segmentation and analysis
├── MLOptimizer              # ML-based targeting optimization
└── PerformancePredictor     # Performance prediction and insights
```

## Usage

### Generate Targeting Suggestions

```python
from app.modules.targeting import TargetingEngine

engine = TargetingEngine()

# Generate targeting suggestions for a campaign
suggestions = await engine.generate_targeting_suggestions(
    db=db,
    campaign_id="campaign_123",
    targeting_brief={
        "demographics": {
            "age_min": 25,
            "age_max": 45,
            "genders": ["female", "male"]
        },
        "interests": ["fitness", "health", "technology"],
        "behaviors": ["online_shopping", "mobile_usage"]
    },
    count=5
)
```

### Optimize Targeting

```python
# Optimize targeting based on performance data
optimized = await engine.optimize_targeting(
    db=db,
    ad_group_id="ad_group_123",
    performance_data={
        "cpa": 15.0,
        "roas": 3.2,
        "ctr": 0.025,
        "conversion_rate": 0.08
    }
)
```

### Analyze Audience Segments

```python
from app.modules.targeting import AudienceAnalyzer

analyzer = AudienceAnalyzer()

# Analyze audience segments
segments = await analyzer.analyze_audience_segments(
    audience_data={
        "demographics": {...},
        "behaviors": {...},
        "interests": {...}
    },
    segmentation_criteria={
        "demographics": {...},
        "behaviors": {...}
    }
)
```

## ML Algorithms

### Random Forest
- Good for feature importance analysis
- Handles non-linear relationships
- Provides interpretable results

### Gradient Boosting
- High predictive accuracy
- Handles complex feature interactions
- Good for performance optimization

### Neural Networks
- Captures complex patterns
- Good for large datasets
- Requires more data for training

## API Endpoints

- `POST /api/v1/targeting/suggestions` - Generate targeting suggestions
- `POST /api/v1/targeting/optimize` - Optimize targeting parameters
- `GET /api/v1/targeting/insights/{campaign_id}` - Get targeting insights

## Configuration

Set the following environment variables:

```bash
# ML model settings
ML_MODEL_PATH=/path/to/models
ML_TRAINING_DATA_PATH=/path/to/training/data

# Feature engineering
FEATURE_ENGINEERING_ENABLED=true
FEATURE_SELECTION_THRESHOLD=0.1
```

## Testing

Run the targeting module tests:

```bash
pytest backend/tests/modules/test_targeting.py -v
```

## Dependencies

- `scikit-learn` - Machine learning algorithms
- `numpy` - Numerical computations
- `pandas` - Data manipulation
- `sqlalchemy` - Database operations
- `pydantic` - Data validation



