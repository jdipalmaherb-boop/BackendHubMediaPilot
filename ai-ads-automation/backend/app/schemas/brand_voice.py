"""
Pydantic schemas for brand voice assistant.
"""

from typing import List, Optional
from pydantic import BaseModel, Field, validator


class CaptionGenerateRequest(BaseModel):
    """Request schema for generating captions."""
    
    brand: str = Field(..., description="Brand name")
    platform: str = Field(..., description="Social media platform")
    tone: str = Field(..., description="Desired tone (e.g., 'professional', 'casual', 'urgent')")
    top_winning_examples: List[str] = Field(..., min_items=1, max_items=10, description="Top 3 winning content examples")
    product_description: Optional[str] = Field(None, description="Optional product description")
    target_audience: Optional[str] = Field(None, description="Optional target audience description")

    @validator('top_winning_examples')
    def validate_examples(cls, v):
        if len(v) < 1:
            raise ValueError('At least one winning example is required')
        return v


class CaptionResponse(BaseModel):
    """Response schema for generated captions."""
    
    success: bool = Field(..., description="Whether the request was successful")
    brand: str = Field(..., description="Brand name")
    platform: str = Field(..., description="Social media platform")
    tone: str = Field(..., description="Desired tone")
    primary: str = Field(..., description="Primary caption variant")
    alts: List[str] = Field(..., min_items=2, max_items=2, description="Alternative caption variants")
    hashtags: List[str] = Field(..., min_items=10, max_items=10, description="10 relevant hashtags")
    cta: str = Field(..., description="Call-to-action")
    character_count: int = Field(..., description="Character count of primary caption")
    examples_used: int = Field(..., description="Number of winning examples used")


class WinningExamplesRequest(BaseModel):
    """Request schema for getting winning examples."""
    
    brand_id: str = Field(..., description="Brand ID to get examples for")
    limit: int = Field(3, ge=1, le=10, description="Maximum number of examples to return")


class WinningExamplesResponse(BaseModel):
    """Response schema for winning examples."""
    
    success: bool = Field(..., description="Whether the request was successful")
    brand_id: str = Field(..., description="Brand ID")
    examples: List[str] = Field(..., description="List of winning content examples")


class SimilarContentRequest(BaseModel):
    """Request schema for searching similar content."""
    
    query_text: str = Field(..., description="Text to search for similar content")
    limit: int = Field(3, ge=1, le=10, description="Maximum number of results to return")


class SimilarContentResponse(BaseModel):
    """Response schema for similar content search."""
    
    success: bool = Field(..., description="Whether the request was successful")
    query_text: str = Field(..., description="Original query text")
    results: List[str] = Field(..., description="List of similar content")


class BrandVoiceStats(BaseModel):
    """Schema for brand voice assistant statistics."""
    
    total_generations: int = Field(..., description="Total number of caption generations")
    brands_served: int = Field(..., description="Number of unique brands served")
    platforms_used: List[str] = Field(..., description="List of platforms used")
    average_character_count: float = Field(..., description="Average character count of generated captions")
    success_rate: float = Field(..., description="Success rate of caption generation")


class CaptionAnalysis(BaseModel):
    """Schema for caption analysis."""
    
    caption: str = Field(..., description="Caption to analyze")
    character_count: int = Field(..., description="Character count")
    word_count: int = Field(..., description="Word count")
    hashtag_count: int = Field(..., description="Number of hashtags")
    emoji_count: int = Field(..., description="Number of emojis")
    has_urgency: bool = Field(..., description="Whether caption contains urgency indicators")
    has_social_proof: bool = Field(..., description="Whether caption contains social proof")
    has_clear_cta: bool = Field(..., description="Whether caption has clear call-to-action")
    readability_score: float = Field(..., description="Readability score (0-100)")
    conversion_potential: str = Field(..., description="Estimated conversion potential (low/medium/high)")


class CaptionAnalyzeRequest(BaseModel):
    """Request schema for analyzing captions."""
    
    caption: str = Field(..., description="Caption to analyze")


class CaptionAnalyzeResponse(BaseModel):
    """Response schema for caption analysis."""
    
    success: bool = Field(..., description="Whether the request was successful")
    analysis: CaptionAnalysis = Field(..., description="Caption analysis results")



