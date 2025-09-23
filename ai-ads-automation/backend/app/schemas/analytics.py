"""
Pydantic schemas for marketing analytics.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class PerformanceWin(BaseModel):
    """Schema for a performance win."""
    
    title: str = Field(..., description="Title of the win")
    description: str = Field(..., description="Description of the win")
    metric: str = Field(..., description="Metric that indicates the win")
    value: float = Field(..., description="Value of the metric")
    improvement: float = Field(..., description="Improvement percentage")
    post_id: Optional[str] = Field(None, description="ID of the post")
    platform: Optional[str] = Field(None, description="Platform where the win occurred")
    content_preview: Optional[str] = Field(None, description="Preview of the content")


class PerformanceProblem(BaseModel):
    """Schema for a performance problem."""
    
    title: str = Field(..., description="Title of the problem")
    description: str = Field(..., description="Description of the problem")
    metric: str = Field(..., description="Metric that indicates the problem")
    value: float = Field(..., description="Value of the metric")
    impact: str = Field(..., description="Impact level (Critical, High, Medium, Low)")
    post_id: Optional[str] = Field(None, description="ID of the post")
    platform: Optional[str] = Field(None, description="Platform where the problem occurred")
    content_preview: Optional[str] = Field(None, description="Preview of the content")
    suggested_improvements: List[str] = Field(..., description="Suggested improvements")


class NextAction(BaseModel):
    """Schema for a next action item."""
    
    priority: int = Field(..., description="Priority level (1-5)")
    title: str = Field(..., description="Title of the action")
    description: str = Field(..., description="Description of the action")
    timeline: str = Field(..., description="Expected timeline")
    effort: str = Field(..., description="Effort level (Low, Medium, High)")
    expected_impact: str = Field(..., description="Expected impact (Low, Medium, High)")
    specific_steps: List[str] = Field(..., description="Specific steps to take")


class OptimalPostingTime(BaseModel):
    """Schema for optimal posting time prediction."""
    
    time: str = Field(..., description="Optimal posting time")
    day: str = Field(..., description="Optimal posting day")
    confidence: float = Field(..., ge=0, le=1, description="Confidence level (0-1)")
    expected_engagement: float = Field(..., description="Expected engagement rate")
    reasoning: str = Field(..., description="Reasoning for the prediction")


class DataSummary(BaseModel):
    """Schema for data summary."""
    
    total_posts: int = Field(..., description="Total number of posts")
    total_reach: int = Field(..., description="Total reach across all posts")
    avg_engagement_rate: float = Field(..., description="Average engagement rate")
    total_impressions: int = Field(..., description="Total impressions")
    total_clicks: int = Field(..., description="Total clicks")
    total_conversions: int = Field(..., description="Total conversions")
    total_revenue: float = Field(..., description="Total revenue")
    platforms_used: List[str] = Field(..., description="List of platforms used")
    analysis_date: str = Field(..., description="Date of analysis")


class PerformanceTrends(BaseModel):
    """Schema for performance trends."""
    
    engagement_trend: str = Field(..., description="Engagement trend (increasing, decreasing, stable)")
    reach_trend: str = Field(..., description="Reach trend (increasing, decreasing, stable)")
    content_performance: Dict[str, Any] = Field(..., description="Content performance analysis")
    platform_performance: Dict[str, Any] = Field(..., description="Platform performance analysis")


class MarketingAnalysisRequest(BaseModel):
    """Request schema for marketing analysis."""
    
    json_metrics: Dict[str, Any] = Field(..., description="JSON metrics data")
    analysis_period: str = Field("6_weeks", description="Analysis period")
    include_predictions: bool = Field(True, description="Include predictions")
    include_recommendations: bool = Field(True, description="Include recommendations")


class MarketingAnalysisResponse(BaseModel):
    """Response schema for marketing analysis."""
    
    success: bool = Field(..., description="Whether the analysis was successful")
    analysis_period: str = Field(..., description="Analysis period")
    data_summary: DataSummary = Field(..., description="Summary of the data")
    top_3_wins: List[PerformanceWin] = Field(..., description="Top 3 performance wins")
    bottom_2_problems: List[PerformanceProblem] = Field(..., description="Bottom 2 performance problems")
    next_actions: List[NextAction] = Field(..., description="5 prioritized next actions")
    optimal_posting_times: List[OptimalPostingTime] = Field(..., description="Optimal posting time predictions")
    performance_trends: PerformanceTrends = Field(..., description="Performance trends analysis")
    recommendations: List[str] = Field(..., description="Strategic recommendations")
    generated_at: str = Field(..., description="When the analysis was generated")


class QuickAnalysisRequest(BaseModel):
    """Request schema for quick analysis."""
    
    json_metrics: Dict[str, Any] = Field(..., description="JSON metrics data")
    focus_area: Optional[str] = Field(None, description="Specific area to focus on")


class QuickAnalysisResponse(BaseModel):
    """Response schema for quick analysis."""
    
    success: bool = Field(..., description="Whether the analysis was successful")
    summary: str = Field(..., description="Plain English summary")
    key_insights: List[str] = Field(..., description="Key insights")
    immediate_actions: List[str] = Field(..., description="Immediate actions to take")
    generated_at: str = Field(..., description="When the analysis was generated")


class TrendAnalysisRequest(BaseModel):
    """Request schema for trend analysis."""
    
    json_metrics: Dict[str, Any] = Field(..., description="JSON metrics data")
    trend_type: str = Field("engagement", description="Type of trend to analyze")
    time_period: str = Field("6_weeks", description="Time period for analysis")


class TrendAnalysisResponse(BaseModel):
    """Response schema for trend analysis."""
    
    success: bool = Field(..., description="Whether the analysis was successful")
    trend_type: str = Field(..., description="Type of trend analyzed")
    time_period: str = Field(..., description="Time period analyzed")
    trend_direction: str = Field(..., description="Direction of the trend")
    trend_strength: str = Field(..., description="Strength of the trend")
    data_points: List[Dict[str, Any]] = Field(..., description="Data points used in analysis")
    predictions: List[Dict[str, Any]] = Field(..., description="Future predictions")
    recommendations: List[str] = Field(..., description="Trend-based recommendations")


class PerformanceInsightsRequest(BaseModel):
    """Request schema for performance insights."""
    
    json_metrics: Dict[str, Any] = Field(..., description="JSON metrics data")
    insight_type: str = Field("comprehensive", description="Type of insights to generate")
    include_benchmarks: bool = Field(True, description="Include industry benchmarks")


class PerformanceInsightsResponse(BaseModel):
    """Response schema for performance insights."""
    
    success: bool = Field(..., description="Whether the analysis was successful")
    insight_type: str = Field(..., description="Type of insights generated")
    performance_score: float = Field(..., ge=0, le=100, description="Overall performance score")
    strengths: List[str] = Field(..., description="Performance strengths")
    weaknesses: List[str] = Field(..., description="Performance weaknesses")
    opportunities: List[str] = Field(..., description="Growth opportunities")
    threats: List[str] = Field(..., description="Potential threats")
    benchmarks: Dict[str, Any] = Field(..., description="Industry benchmarks")
    action_plan: List[Dict[str, Any]] = Field(..., description="Action plan based on insights")


class AnalyticsStats(BaseModel):
    """Schema for analytics statistics."""
    
    total_analyses: int = Field(..., description="Total number of analyses performed")
    avg_analysis_time: float = Field(..., description="Average analysis time in seconds")
    most_common_insights: List[str] = Field(..., description="Most common insights")
    success_rate: float = Field(..., description="Success rate of analyses")
    platforms_analyzed: List[str] = Field(..., description="Platforms analyzed")
    avg_performance_score: float = Field(..., description="Average performance score")


class CustomAnalysisRequest(BaseModel):
    """Request schema for custom analysis."""
    
    json_metrics: Dict[str, Any] = Field(..., description="JSON metrics data")
    analysis_goals: List[str] = Field(..., description="Specific analysis goals")
    custom_questions: List[str] = Field(..., description="Custom questions to answer")
    output_format: str = Field("detailed", description="Output format (summary, detailed, executive)")


class CustomAnalysisResponse(BaseModel):
    """Response schema for custom analysis."""
    
    success: bool = Field(..., description="Whether the analysis was successful")
    analysis_goals: List[str] = Field(..., description="Analysis goals addressed")
    custom_questions: List[Dict[str, str]] = Field(..., description="Custom questions and answers")
    findings: List[Dict[str, Any]] = Field(..., description="Key findings")
    conclusions: List[str] = Field(..., description="Main conclusions")
    next_steps: List[str] = Field(..., description="Recommended next steps")
    generated_at: str = Field(..., description="When the analysis was generated")



