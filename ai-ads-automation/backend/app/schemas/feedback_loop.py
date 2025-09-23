"""
Pydantic schemas for feedback loop services.
"""

from typing import List, Dict, Any, Optional
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class MetricsIngestRequest(BaseModel):
    """Request schema for ingesting metrics."""
    
    post_id: UUID = Field(..., description="ID of the post")
    platform: str = Field(..., description="Social media platform")
    impressions: int = Field(..., ge=0, description="Number of impressions")
    clicks: int = Field(..., ge=0, description="Number of clicks")
    conversions: int = Field(..., ge=0, description="Number of conversions")
    revenue: Decimal = Field(..., ge=0, description="Revenue generated")


class MetricsIngestResponse(BaseModel):
    """Response schema for metrics ingestion."""
    
    success: bool = Field(..., description="Whether the request was successful")
    message: str = Field(..., description="Response message")


class WinnerSearchRequest(BaseModel):
    """Request schema for searching winning content."""
    
    query_text: str = Field(..., description="Text to search for similar content")
    limit: int = Field(10, ge=1, le=100, description="Maximum number of results to return")


class WinnerContent(BaseModel):
    """Schema for winning content result."""
    
    key: str = Field(..., description="Unique key for the content")
    similarity_score: float = Field(..., ge=0, le=1, description="Similarity score (0-1)")
    content: str = Field(..., description="The winning content text")
    metadata: Dict[str, Any] = Field(..., description="Metadata about the content")


class WinnerSearchResponse(BaseModel):
    """Response schema for winning content search."""
    
    success: bool = Field(..., description="Whether the request was successful")
    query_text: str = Field(..., description="The original query text")
    results: List[WinnerContent] = Field(..., description="List of similar winning content")


class PerformanceAnalysisRequest(BaseModel):
    """Request schema for performance analysis."""
    
    brand_id: UUID = Field(..., description="Brand ID to analyze")
    days: int = Field(30, ge=1, le=365, description="Number of days to analyze")


class PerformanceAnalysisResponse(BaseModel):
    """Response schema for performance analysis."""
    
    success: bool = Field(..., description="Whether the request was successful")
    brand_id: UUID = Field(..., description="Brand ID that was analyzed")
    analysis: Dict[str, Any] = Field(..., description="Performance analysis results")


class FeedbackStatsResponse(BaseModel):
    """Response schema for feedback system statistics."""
    
    success: bool = Field(..., description="Whether the request was successful")
    message: str = Field(..., description="Response message")
    stats: Dict[str, Any] = Field(..., description="Feedback system statistics")



