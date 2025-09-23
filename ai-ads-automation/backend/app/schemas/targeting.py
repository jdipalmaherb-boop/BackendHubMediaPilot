"""
Pydantic schemas for targeting and audience engine.
"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class TargetingSuggestionRequest(BaseModel):
    """Request schema for targeting suggestions."""
    
    campaign_id: str = Field(..., description="ID of the campaign to generate targeting for")
    targeting_brief: Dict[str, Any] = Field(..., description="Targeting brief with requirements and constraints")
    count: int = Field(default=5, ge=1, le=20, description="Number of targeting suggestions to generate")


class TargetingSuggestionResponse(BaseModel):
    """Response schema for targeting suggestions."""
    
    success: bool = Field(..., description="Whether the request was successful")
    suggestions: List[Dict[str, Any]] = Field(..., description="Generated targeting suggestions")
    count: int = Field(..., description="Number of suggestions generated")


class TargetingOptimizationRequest(BaseModel):
    """Request schema for targeting optimization."""
    
    ad_group_id: str = Field(..., description="ID of the ad group to optimize")
    performance_data: Dict[str, Any] = Field(..., description="Performance data for optimization")


class TargetingOptimizationResponse(BaseModel):
    """Response schema for targeting optimization."""
    
    success: bool = Field(..., description="Whether the optimization was successful")
    optimized_targeting: Dict[str, Any] = Field(..., description="Optimized targeting parameters")


class TargetingInsightsResponse(BaseModel):
    """Response schema for targeting insights."""
    
    success: bool = Field(..., description="Whether the request was successful")
    insights: List[Dict[str, Any]] = Field(..., description="Targeting insights and recommendations")
    count: int = Field(..., description="Number of insights returned")



