"""
Pydantic schemas for creative generation.
"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class CreativeGenerationRequest(BaseModel):
    """Request schema for creative generation."""
    
    campaign_id: str = Field(..., description="ID of the campaign to generate creatives for")
    creative_brief: Dict[str, Any] = Field(..., description="Creative brief with requirements and constraints")
    count: int = Field(default=3, ge=1, le=10, description="Number of creatives to generate")


class CreativeGenerationResponse(BaseModel):
    """Response schema for creative generation."""
    
    success: bool = Field(..., description="Whether the generation was successful")
    creatives: List[Dict[str, Any]] = Field(..., description="Generated creative assets")
    count: int = Field(..., description="Number of creatives generated")


class CreativeOptimizationRequest(BaseModel):
    """Request schema for creative optimization."""
    
    creative_id: str = Field(..., description="ID of the creative to optimize")
    optimization_goals: Dict[str, Any] = Field(..., description="Goals for optimization")


class CreativeOptimizationResponse(BaseModel):
    """Response schema for creative optimization."""
    
    success: bool = Field(..., description="Whether the optimization was successful")
    creative: Dict[str, Any] = Field(..., description="Optimized creative asset")


class CreativePerformanceInsightsResponse(BaseModel):
    """Response schema for creative performance insights."""
    
    success: bool = Field(..., description="Whether the request was successful")
    insights: List[Dict[str, Any]] = Field(..., description="Performance insights for creatives")
    count: int = Field(..., description="Number of insights returned")



