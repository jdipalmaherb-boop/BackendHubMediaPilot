"""
Pydantic schemas for social media posts and metrics.
"""

from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, validator


class PostBase(BaseModel):
    """Base schema for post data."""
    
    brand_id: UUID = Field(..., description="ID of the brand this post belongs to")
    variant: str = Field(..., description="Post variant: primary, A, or B")
    content: str = Field(..., description="The actual post content")

    @validator('variant')
    def validate_variant(cls, v):
        if v not in ['primary', 'A', 'B']:
            raise ValueError('variant must be one of: primary, A, B')
        return v


class PostCreate(PostBase):
    """Schema for creating a new post."""
    pass


class PostUpdate(BaseModel):
    """Schema for updating a post."""
    
    variant: Optional[str] = Field(None, description="Post variant: primary, A, or B")
    content: Optional[str] = Field(None, description="The actual post content")

    @validator('variant')
    def validate_variant(cls, v):
        if v is not None and v not in ['primary', 'A', 'B']:
            raise ValueError('variant must be one of: primary, A, B')
        return v


class PostResponse(PostBase):
    """Schema for post response."""
    
    id: UUID = Field(..., description="Unique identifier for the post")
    created_at: datetime = Field(..., description="When the post was created")

    class Config:
        from_attributes = True


class PostMetricBase(BaseModel):
    """Base schema for post metric data."""
    
    post_id: UUID = Field(..., description="ID of the post this metric belongs to")
    platform: str = Field(..., description="Social media platform")
    impressions: int = Field(0, ge=0, description="Number of impressions")
    clicks: int = Field(0, ge=0, description="Number of clicks")
    ctr: float = Field(0.0, ge=0.0, le=1.0, description="Click-through rate")
    conversions: int = Field(0, ge=0, description="Number of conversions")
    revenue: Decimal = Field(0.0, ge=0, description="Revenue generated")


class PostMetricCreate(PostMetricBase):
    """Schema for creating new post metrics."""
    pass


class PostMetricUpdate(BaseModel):
    """Schema for updating post metrics."""
    
    platform: Optional[str] = Field(None, description="Social media platform")
    impressions: Optional[int] = Field(None, ge=0, description="Number of impressions")
    clicks: Optional[int] = Field(None, ge=0, description="Number of clicks")
    ctr: Optional[float] = Field(None, ge=0.0, le=1.0, description="Click-through rate")
    conversions: Optional[int] = Field(None, ge=0, description="Number of conversions")
    revenue: Optional[Decimal] = Field(None, ge=0, description="Revenue generated")


class PostMetricResponse(PostMetricBase):
    """Schema for post metric response."""
    
    id: UUID = Field(..., description="Unique identifier for the metric")
    collected_at: datetime = Field(..., description="When the metric was collected")
    calculated_ctr: float = Field(..., description="Calculated CTR (clicks/impressions)")
    conversion_rate: float = Field(..., description="Conversion rate (conversions/clicks)")
    revenue_per_conversion: float = Field(..., description="Revenue per conversion")

    class Config:
        from_attributes = True


class PostWithMetrics(PostResponse):
    """Schema for post with its metrics."""
    
    metrics: List[PostMetricResponse] = Field(default=[], description="Post performance metrics")


class PostAnalytics(BaseModel):
    """Schema for post analytics summary."""
    
    post_id: UUID = Field(..., description="Post ID")
    total_impressions: int = Field(..., description="Total impressions across all platforms")
    total_clicks: int = Field(..., description="Total clicks across all platforms")
    total_conversions: int = Field(..., description="Total conversions across all platforms")
    total_revenue: Decimal = Field(..., description="Total revenue across all platforms")
    average_ctr: float = Field(..., description="Average CTR across all platforms")
    average_conversion_rate: float = Field(..., description="Average conversion rate")
    platform_breakdown: List[PostMetricResponse] = Field(..., description="Metrics by platform")


class BrandAnalytics(BaseModel):
    """Schema for brand-level analytics."""
    
    brand_id: UUID = Field(..., description="Brand ID")
    total_posts: int = Field(..., description="Total number of posts")
    posts_by_variant: dict = Field(..., description="Post count by variant")
    total_impressions: int = Field(..., description="Total impressions")
    total_clicks: int = Field(..., description="Total clicks")
    total_conversions: int = Field(..., description="Total conversions")
    total_revenue: Decimal = Field(..., description="Total revenue")
    best_performing_variant: str = Field(..., description="Best performing variant")
    best_performing_platform: str = Field(..., description="Best performing platform")



