# Feedback Loop Module

## Overview
The Feedback Loop module implements a learning system that identifies winning content and uses it to improve future ad copy generation. It analyzes post performance metrics, identifies the best-performing content, and stores it in a vector database for future reference.

## Features
- **Metrics Ingestion**: Collect and store post performance metrics
- **Winner Identification**: Automatically identify the best-performing content
- **Vector Storage**: Store winning content in an embedding store for similarity search
- **Performance Analysis**: Analyze performance trends by brand and variant
- **Scheduled Jobs**: Automated nightly winner identification
- **Content Search**: Find similar winning content for inspiration

## Architecture
- `feedback_service.py`: Core service for managing the feedback loop
- `embedding_store.py`: Vector storage for winning content
- `scheduler.py`: Job scheduler for automated tasks
- `api.py`: FastAPI routes for feedback services
- `schemas/feedback_loop.py`: Pydantic models for request/response validation

## Key Components

### FeedbackService
The main service that handles:
- Metrics ingestion and CTR calculation
- Winner identification based on composite scoring
- Performance trend analysis
- Content similarity search

### EmbeddingStore
A simple vector store that:
- Stores winning content with embeddings
- Performs similarity search
- Manages brand-specific content collections
- Provides statistics and analytics

### Scheduler
Automated job runner that:
- Runs nightly winner identification at 2 AM
- Can be triggered manually for immediate execution
- Provides status monitoring

## API Endpoints

### `POST /api/v1/feedback-loop/metrics/ingest`
Ingest new metrics for a post.

- **Request Body (`MetricsIngestRequest`):**
    ```json
    {
        "post_id": "uuid",
        "platform": "facebook",
        "impressions": 1000,
        "clicks": 50,
        "conversions": 5,
        "revenue": 100.50
    }
    ```
- **Response Body (`MetricsIngestResponse`):**
    ```json
    {
        "success": true,
        "message": "Metrics successfully ingested"
    }
    ```

### `POST /api/v1/feedback-loop/winners/search`
Search for winning content similar to a query.

- **Request Body (`WinnerSearchRequest`):**
    ```json
    {
        "query_text": "Check out our amazing new product!",
        "limit": 10
    }
    ```
- **Response Body (`WinnerSearchResponse`):**
    ```json
    {
        "success": true,
        "query_text": "Check out our amazing new product!",
        "results": [
            {
                "key": "brand:123:winner:456",
                "similarity_score": 0.85,
                "content": "Amazing new product launch! Limited time offer!",
                "metadata": {
                    "brand_id": "123",
                    "post_id": "456",
                    "variant": "A",
                    "created_at": "2023-10-27T10:00:00Z"
                }
            }
        ]
    }
    ```

### `GET /api/v1/feedback-loop/winners/brand/{brand_id}`
Get all winning content for a specific brand.

- **Response Body (`WinnerSearchResponse`):**
    ```json
    {
        "success": true,
        "query_text": "brand:123",
        "results": [
            {
                "key": "brand:123:winner:456",
                "similarity_score": 1.0,
                "content": "Winning content text",
                "metadata": {...}
            }
        ]
    }
    ```

### `POST /api/v1/feedback-loop/analysis/performance`
Analyze performance trends for a brand.

- **Request Body (`PerformanceAnalysisRequest`):**
    ```json
    {
        "brand_id": "uuid",
        "days": 30
    }
    ```
- **Response Body (`PerformanceAnalysisResponse`):**
    ```json
    {
        "success": true,
        "brand_id": "uuid",
        "analysis": {
            "brand_id": "uuid",
            "analysis_period_days": 30,
            "total_posts": 15,
            "variant_performance": {
                "primary": {
                    "posts": 5,
                    "total_impressions": 5000,
                    "total_clicks": 250,
                    "total_conversions": 25,
                    "total_revenue": 500.0,
                    "avg_ctr": 0.05,
                    "avg_conversion_rate": 0.1,
                    "avg_revenue_per_post": 100.0
                },
                "A": {
                    "posts": 5,
                    "total_impressions": 6000,
                    "total_clicks": 300,
                    "total_conversions": 30,
                    "total_revenue": 600.0,
                    "avg_ctr": 0.05,
                    "avg_conversion_rate": 0.1,
                    "avg_revenue_per_post": 120.0
                },
                "B": {
                    "posts": 5,
                    "total_impressions": 4000,
                    "total_clicks": 200,
                    "total_conversions": 20,
                    "total_revenue": 400.0,
                    "avg_ctr": 0.05,
                    "avg_conversion_rate": 0.1,
                    "avg_revenue_per_post": 80.0
                }
            },
            "best_performing_variant": "A"
        }
    }
    ```

### `POST /api/v1/feedback-loop/jobs/nightly-winner`
Run the nightly winner identification job manually.

- **Response Body (`FeedbackStatsResponse`):**
    ```json
    {
        "success": true,
        "message": "Nightly winner job completed",
        "stats": {
            "brands_processed": 5,
            "winners_identified": 5,
            "errors": 0
        }
    }
    ```

### `GET /api/v1/feedback-loop/stats`
Get feedback system statistics.

- **Response Body (`FeedbackStatsResponse`):**
    ```json
    {
        "success": true,
        "message": "Feedback stats retrieved",
        "stats": {
            "total_items": 25,
            "brands_with_winners": 5,
            "brand_counts": {
                "brand_1": 5,
                "brand_2": 3,
                "brand_3": 7
            }
        }
    }
    ```

## Usage Examples

### Ingesting Metrics
```python
from app.modules.feedback_loop.feedback_service import FeedbackService
from decimal import Decimal

feedback_service = FeedbackService()

# Ingest metrics for a post
success = feedback_service.ingest_metrics(
    db=db_session,
    post_id="post_123",
    platform="facebook",
    impressions=1000,
    clicks=50,
    conversions=5,
    revenue=Decimal("100.50")
)
```

### Running Nightly Winner Job
```python
from app.modules.feedback_loop.feedback_service import FeedbackService

feedback_service = FeedbackService()

# Run the nightly winner job
stats = feedback_service.nightly_winner_job(db_session)
print(f"Processed {stats['brands_processed']} brands, identified {stats['winners_identified']} winners")
```

### Searching for Similar Content
```python
# Search for similar winning content
results = feedback_service.search_similar_content(
    query_text="Amazing new product launch!",
    limit=5
)

for result in results:
    print(f"Similarity: {result['similarity_score']:.2f}")
    print(f"Content: {result['content']}")
    print(f"Brand: {result['metadata']['brand_id']}")
```

### Analyzing Performance
```python
# Analyze performance trends for a brand
analysis = feedback_service.analyze_performance_trends(
    db=db_session,
    brand_id="brand_123",
    days=30
)

print(f"Best performing variant: {analysis['best_performing_variant']}")
print(f"Total posts: {analysis['total_posts']}")
```

## Integration with Ad Copy Generator

The feedback loop can be integrated with the Ad Copy Generator to improve future content:

```python
from app.modules.ad_copy.generator import AdCopyGenerator
from app.modules.feedback_loop.feedback_service import FeedbackService

# Get similar winning content for inspiration
feedback_service = FeedbackService()
winning_content = feedback_service.search_similar_content(
    query_text=product_description,
    limit=3
)

# Use winning content as inspiration for new ad copy
ad_generator = AdCopyGenerator()
new_copy = await ad_generator.generate_ad_copy_variations(
    product_description=product_description,
    target_audience=target_audience,
    campaign_goal=campaign_goal,
    existing_copy=winning_content[0]["content"] if winning_content else None
)
```

## How to Extend

1. **Enhanced Embeddings**: Replace the dummy embedding generation with a real embedding model (e.g., OpenAI embeddings, sentence-transformers).

2. **Advanced Scoring**: Implement more sophisticated scoring algorithms that consider additional factors like engagement rate, time decay, and seasonal trends.

3. **Real-time Learning**: Add real-time learning capabilities that update the embedding store as new metrics come in.

4. **A/B Testing Integration**: Integrate with the existing A/B testing framework to automatically identify winning variants.

5. **Content Generation**: Use the winning content patterns to generate new content variations automatically.



