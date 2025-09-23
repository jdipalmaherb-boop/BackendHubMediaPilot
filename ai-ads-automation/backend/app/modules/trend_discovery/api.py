"""
FastAPI routes for trend discovery services.
"""

from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.logging import logger
from app.modules.trend_discovery.trend_fetcher import TrendFetcher
from app.modules.trend_discovery.trend_recipe_generator import TrendRecipeGenerator
from app.schemas.trend_discovery import (
    TrendFetchRequest, TrendFetchResponse,
    TrendRecipeRequest, TrendRecipeResponse,
    MultipleTrendRecipeRequest, MultipleTrendRecipeResponse,
    TrendAnalysisRequest, TrendAnalysisResponse,
    AllPlatformTrendsRequest, AllPlatformTrendsResponse,
    TrendDiscoveryStats, TrendInsight, TrendDiscoveryInsightsResponse
)

router = APIRouter()


@router.post("/fetch", response_model=TrendFetchResponse)
async def fetch_trends(
    request: TrendFetchRequest,
    trend_fetcher: TrendFetcher = Depends(TrendFetcher)
):
    """Fetch trending content from a specific platform."""
    logger.info(f"Fetching trends from {request.platform} for {request.country}")
    
    try:
        if request.platform.lower() == "tiktok":
            trends = await trend_fetcher.fetch_tiktok_trends(
                api_key=request.api_key or "",
                country=request.country,
                limit=request.limit,
                category=request.category
            )
        elif request.platform.lower() == "instagram":
            trends = await trend_fetcher.fetch_instagram_trends(
                access_token=request.api_key or "",
                limit=request.limit
            )
        elif request.platform.lower() == "twitter":
            trends = await trend_fetcher.fetch_twitter_trends(
                bearer_token=request.api_key or "",
                country=request.country,
                limit=request.limit
            )
        elif request.platform.lower() == "youtube":
            trends = await trend_fetcher.fetch_youtube_trends(
                api_key=request.api_key or "",
                country=request.country,
                limit=request.limit
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported platform: {request.platform}"
            )
        
        return TrendFetchResponse(
            success=True,
            platform=request.platform,
            country=request.country,
            trends=trends,
            total_count=len(trends)
        )
    except Exception as e:
        logger.error(f"Error fetching trends from {request.platform}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch trends: {e}"
        )


@router.post("/fetch-all", response_model=AllPlatformTrendsResponse)
async def fetch_all_platform_trends(
    request: AllPlatformTrendsRequest,
    trend_fetcher: TrendFetcher = Depends(TrendFetcher)
):
    """Fetch trending content from all available platforms."""
    logger.info(f"Fetching trends from all platforms for {request.country}")
    
    try:
        all_trends = await trend_fetcher.fetch_all_trends(
            tiktok_api_key=request.tiktok_api_key,
            instagram_token=request.instagram_token,
            twitter_token=request.twitter_token,
            youtube_api_key=request.youtube_api_key,
            country=request.country,
            limit_per_platform=request.limit_per_platform
        )
        
        total_trends = sum(len(trends) for trends in all_trends.values())
        
        return AllPlatformTrendsResponse(
            success=True,
            country=request.country,
            platform_trends=all_trends,
            total_platforms=len(all_trends),
            total_trends=total_trends
        )
    except Exception as e:
        logger.error(f"Error fetching all platform trends: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch all platform trends: {e}"
        )


@router.post("/recipe", response_model=TrendRecipeResponse)
async def generate_trend_recipe(
    request: TrendRecipeRequest,
    recipe_generator: TrendRecipeGenerator = Depends(TrendRecipeGenerator)
):
    """Generate a trend recipe for a specific brand and trend."""
    logger.info(f"Generating trend recipe for {request.brand} and {request.trend.name}")
    
    try:
        recipe = await recipe_generator.make_trend_recipe(
            brand=request.brand,
            trend=request.trend.dict(),
            target_audience=request.target_audience,
            campaign_goal=request.campaign_goal
        )
        
        return TrendRecipeResponse(
            success=True,
            brand=recipe["brand"],
            trend_name=recipe["trend_name"],
            trend_type=recipe["trend_type"],
            hook=recipe["hook"],
            broll_list=recipe["broll_list"],
            caption=recipe["caption"],
            ad_script=recipe["ad_script"],
            image_prompt=recipe["image_prompt"],
            platform_optimization=recipe["platform_optimization"],
            engagement_strategy=recipe["engagement_strategy"],
            conversion_tactics=recipe["conversion_tactics"],
            trend_metrics=recipe["trend_metrics"],
            created_at=recipe["created_at"]
        )
    except Exception as e:
        logger.error(f"Error generating trend recipe: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate trend recipe: {e}"
        )


@router.post("/recipes", response_model=MultipleTrendRecipeResponse)
async def generate_multiple_trend_recipes(
    request: MultipleTrendRecipeRequest,
    recipe_generator: TrendRecipeGenerator = Depends(TrendRecipeGenerator)
):
    """Generate trend recipes for multiple trends."""
    logger.info(f"Generating {len(request.trends)} trend recipes for {request.brand}")
    
    try:
        recipes = await recipe_generator.generate_multiple_recipes(
            brand=request.brand,
            trends=[trend.dict() for trend in request.trends],
            target_audience=request.target_audience,
            campaign_goal=request.campaign_goal,
            max_recipes=request.max_recipes
        )
        
        # Convert to response format
        recipe_responses = []
        for recipe in recipes:
            recipe_responses.append(TrendRecipeResponse(
                success=True,
                brand=recipe["brand"],
                trend_name=recipe["trend_name"],
                trend_type=recipe["trend_type"],
                hook=recipe["hook"],
                broll_list=recipe["broll_list"],
                caption=recipe["caption"],
                ad_script=recipe["ad_script"],
                image_prompt=recipe["image_prompt"],
                platform_optimization=recipe["platform_optimization"],
                engagement_strategy=recipe["engagement_strategy"],
                conversion_tactics=recipe["conversion_tactics"],
                trend_metrics=recipe["trend_metrics"],
                created_at=recipe["created_at"]
            ))
        
        return MultipleTrendRecipeResponse(
            success=True,
            brand=request.brand,
            recipes=recipe_responses,
            total_recipes=len(recipe_responses)
        )
    except Exception as e:
        logger.error(f"Error generating multiple trend recipes: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate multiple trend recipes: {e}"
        )


@router.post("/analyze", response_model=TrendAnalysisResponse)
async def analyze_trend_potential(
    request: TrendAnalysisRequest,
    recipe_generator: TrendRecipeGenerator = Depends(TrendRecipeGenerator)
):
    """Analyze the potential of a trend for a specific brand."""
    logger.info(f"Analyzing trend potential for {request.brand} and {request.trend.name}")
    
    try:
        analysis = await recipe_generator.analyze_trend_potential(
            brand=request.brand,
            trend=request.trend.dict(),
            brand_category=request.brand_category
        )
        
        return TrendAnalysisResponse(
            success=True,
            trend_name=analysis["trend_name"],
            brand=analysis["brand"],
            relevance_score=analysis["relevance_score"],
            recommendation=analysis["recommendation"],
            priority_color=analysis["priority_color"],
            trend_metrics=analysis["trend_metrics"],
            analysis=analysis["analysis"],
            recommendations=analysis["recommendations"]
        )
    except Exception as e:
        logger.error(f"Error analyzing trend potential: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze trend potential: {e}"
        )


@router.get("/stats", response_model=TrendDiscoveryStats)
async def get_trend_discovery_stats(
    trend_fetcher: TrendFetcher = Depends(TrendFetcher),
    recipe_generator: TrendRecipeGenerator = Depends(TrendRecipeGenerator)
):
    """Get trend discovery system statistics."""
    logger.info("Getting trend discovery stats")
    
    try:
        # This would typically come from a database or analytics service
        # For now, return mock stats
        stats = {
            "total_trends_fetched": 0,
            "platforms_active": [],
            "top_categories": [],
            "average_trend_score": 0.0,
            "recipes_generated": 0,
            "success_rate": 100.0
        }
        
        return TrendDiscoveryStats(**stats)
    except Exception as e:
        logger.error(f"Error getting trend discovery stats: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get trend discovery stats: {e}"
        )


@router.post("/insights", response_model=TrendDiscoveryInsightsResponse)
async def generate_trend_insights(
    trends: List[Dict[str, Any]],
    brand: str,
    trend_fetcher: TrendFetcher = Depends(TrendFetcher),
    recipe_generator: TrendRecipeGenerator = Depends(TrendRecipeGenerator)
):
    """Generate insights and recommendations from trending data."""
    logger.info(f"Generating trend insights for {brand}")
    
    try:
        # Analyze trends and generate insights
        insights = []
        
        # This would typically involve more sophisticated analysis
        # For now, generate basic insights
        for trend in trends[:5]:  # Limit to top 5 trends
            analysis = await recipe_generator.analyze_trend_potential(
                brand=brand,
                trend=trend,
                brand_category=None
            )
            
            if analysis["relevance_score"] > 70:
                insight = TrendInsight(
                    trend_name=trend.get("name", ""),
                    insight_type="opportunity",
                    title=f"High-Potential Trend: {trend.get('name', '')}",
                    description=f"This trend has high relevance ({analysis['relevance_score']}/100) for your brand and could drive significant engagement.",
                    action_items=[
                        "Create content immediately",
                        "Consider paid promotion",
                        "Engage with existing content"
                    ],
                    priority="high",
                    confidence=analysis["relevance_score"] / 100
                )
                insights.append(insight)
        
        return TrendDiscoveryInsightsResponse(
            success=True,
            insights=insights,
            total_insights=len(insights),
            generated_at="2023-10-27T10:00:00Z"
        )
    except Exception as e:
        logger.error(f"Error generating trend insights: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate trend insights: {e}"
        )



