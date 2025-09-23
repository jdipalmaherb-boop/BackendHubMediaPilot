"""
Pydantic schemas for trend discovery services.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, validator


class TrendItem(BaseModel):
    """Schema for a single trending item."""
    
    name: str = Field(..., description="Name of the trend (e.g., hashtag, topic)")
    type: str = Field(..., description="Type of trend (hashtag, sound, topic, etc.)")
    meta: Dict[str, Any] = Field(..., description="Metadata about the trend")


class TrendFetchRequest(BaseModel):
    """Request schema for fetching trends."""
    
    platform: str = Field(..., description="Platform to fetch trends from")
    country: str = Field("US", description="Country code for trend location")
    limit: int = Field(20, ge=1, le=100, description="Maximum number of trends to return")
    category: Optional[str] = Field(None, description="Optional category filter")
    api_key: Optional[str] = Field(None, description="API key for the platform")


class TrendFetchResponse(BaseModel):
    """Response schema for trend fetching."""
    
    success: bool = Field(..., description="Whether the request was successful")
    platform: str = Field(..., description="Platform trends were fetched from")
    country: str = Field(..., description="Country code")
    trends: List[TrendItem] = Field(..., description="List of trending items")
    total_count: int = Field(..., description="Total number of trends returned")


class TrendRecipeRequest(BaseModel):
    """Request schema for generating trend recipes."""
    
    brand: str = Field(..., description="Brand name")
    trend: TrendItem = Field(..., description="Trending item to create recipe for")
    target_audience: Optional[str] = Field(None, description="Target audience description")
    campaign_goal: Optional[str] = Field(None, description="Campaign goal (awareness, conversion, engagement)")


class TrendRecipeResponse(BaseModel):
    """Response schema for trend recipe generation."""
    
    success: bool = Field(..., description="Whether the request was successful")
    brand: str = Field(..., description="Brand name")
    trend_name: str = Field(..., description="Name of the trend")
    trend_type: str = Field(..., description="Type of the trend")
    hook: str = Field(..., description="3-second hook idea")
    broll_list: List[str] = Field(..., min_items=3, max_items=3, description="3 B-roll shot descriptions")
    caption: str = Field(..., description="Suggested caption with hashtags")
    ad_script: str = Field(..., description="15-second ad script")
    image_prompt: str = Field(..., description="Image generation prompt for carousel")
    platform_optimization: str = Field(..., description="Platform-specific optimization tips")
    engagement_strategy: str = Field(..., description="Engagement maximization strategy")
    conversion_tactics: str = Field(..., description="Conversion driving tactics")
    trend_metrics: Dict[str, Any] = Field(..., description="Trend performance metrics")
    created_at: str = Field(..., description="When the recipe was created")


class MultipleTrendRecipeRequest(BaseModel):
    """Request schema for generating multiple trend recipes."""
    
    brand: str = Field(..., description="Brand name")
    trends: List[TrendItem] = Field(..., min_items=1, max_items=10, description="List of trends to create recipes for")
    target_audience: Optional[str] = Field(None, description="Target audience description")
    campaign_goal: Optional[str] = Field(None, description="Campaign goal")
    max_recipes: int = Field(5, ge=1, le=10, description="Maximum number of recipes to generate")


class MultipleTrendRecipeResponse(BaseModel):
    """Response schema for multiple trend recipe generation."""
    
    success: bool = Field(..., description="Whether the request was successful")
    brand: str = Field(..., description="Brand name")
    recipes: List[TrendRecipeResponse] = Field(..., description="List of generated trend recipes")
    total_recipes: int = Field(..., description="Total number of recipes generated")


class TrendAnalysisRequest(BaseModel):
    """Request schema for trend analysis."""
    
    brand: str = Field(..., description="Brand name")
    trend: TrendItem = Field(..., description="Trend to analyze")
    brand_category: Optional[str] = Field(None, description="Brand's industry category")


class TrendAnalysisResponse(BaseModel):
    """Response schema for trend analysis."""
    
    success: bool = Field(..., description="Whether the request was successful")
    trend_name: str = Field(..., description="Name of the trend")
    brand: str = Field(..., description="Brand name")
    relevance_score: int = Field(..., ge=0, le=100, description="Relevance score (0-100)")
    recommendation: str = Field(..., description="Priority recommendation (high/medium/low)")
    priority_color: str = Field(..., description="Priority color indicator")
    trend_metrics: Dict[str, Any] = Field(..., description="Trend performance metrics")
    analysis: Dict[str, Any] = Field(..., description="Detailed analysis breakdown")
    recommendations: List[str] = Field(..., description="Specific action recommendations")


class AllPlatformTrendsRequest(BaseModel):
    """Request schema for fetching trends from all platforms."""
    
    country: str = Field("US", description="Country code for trend location")
    limit_per_platform: int = Field(10, ge=1, le=50, description="Maximum trends per platform")
    tiktok_api_key: Optional[str] = Field(None, description="TikTok API key")
    instagram_token: Optional[str] = Field(None, description="Instagram access token")
    twitter_token: Optional[str] = Field(None, description="Twitter Bearer token")
    youtube_api_key: Optional[str] = Field(None, description="YouTube Data API key")


class AllPlatformTrendsResponse(BaseModel):
    """Response schema for all platform trends."""
    
    success: bool = Field(..., description="Whether the request was successful")
    country: str = Field(..., description="Country code")
    platform_trends: Dict[str, List[TrendItem]] = Field(..., description="Trends by platform")
    total_platforms: int = Field(..., description="Number of platforms with trends")
    total_trends: int = Field(..., description="Total number of trends across all platforms")


class TrendDiscoveryStats(BaseModel):
    """Schema for trend discovery statistics."""
    
    total_trends_fetched: int = Field(..., description="Total trends fetched")
    platforms_active: List[str] = Field(..., description="List of active platforms")
    top_categories: List[str] = Field(..., description="Top trending categories")
    average_trend_score: float = Field(..., description="Average trend score")
    recipes_generated: int = Field(..., description="Number of recipes generated")
    success_rate: float = Field(..., description="Success rate of trend fetching")


class TrendRecipe(BaseModel):
    """Schema for a complete trend recipe."""
    
    brand: str = Field(..., description="Brand name")
    trend_name: str = Field(..., description="Trend name")
    trend_type: str = Field(..., description="Trend type")
    hook: str = Field(..., description="3-second hook")
    broll_list: List[str] = Field(..., description="B-roll shot list")
    caption: str = Field(..., description="Caption with hashtags")
    ad_script: str = Field(..., description="Ad script")
    image_prompt: str = Field(..., description="Image generation prompt")
    platform_optimization: str = Field(..., description="Platform optimization tips")
    engagement_strategy: str = Field(..., description="Engagement strategy")
    conversion_tactics: str = Field(..., description="Conversion tactics")
    trend_metrics: Dict[str, Any] = Field(..., description="Trend metrics")
    created_at: str = Field(..., description="Creation timestamp")
    is_fallback: bool = Field(False, description="Whether this is a fallback recipe")


class TrendInsight(BaseModel):
    """Schema for trend insights and recommendations."""
    
    trend_name: str = Field(..., description="Trend name")
    insight_type: str = Field(..., description="Type of insight (opportunity, warning, tip)")
    title: str = Field(..., description="Insight title")
    description: str = Field(..., description="Detailed insight description")
    action_items: List[str] = Field(..., description="Recommended actions")
    priority: str = Field(..., description="Priority level (high, medium, low)")
    confidence: float = Field(..., ge=0, le=1, description="Confidence score (0-1)")


class TrendDiscoveryInsightsResponse(BaseModel):
    """Response schema for trend discovery insights."""
    
    success: bool = Field(..., description="Whether the request was successful")
    insights: List[TrendInsight] = Field(..., description="List of trend insights")
    total_insights: int = Field(..., description="Total number of insights")
    generated_at: str = Field(..., description="When insights were generated")



