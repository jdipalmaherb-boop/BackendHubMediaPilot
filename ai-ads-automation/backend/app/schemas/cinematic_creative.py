"""
Pydantic schemas for cinematic creative generation.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class ImagePromptAnalysis(BaseModel):
    """Schema for image prompt analysis results."""
    
    original_prompt: str = Field(..., description="Original image generation prompt")
    shot_type: Optional[str] = Field(None, description="Detected shot type")
    lighting_style: List[str] = Field(..., description="Detected lighting styles")
    camera_techniques: List[str] = Field(..., description="Detected camera techniques")
    color_grading: List[str] = Field(..., description="Detected color grading terms")
    mood_tone: List[str] = Field(..., description="Detected mood and tone keywords")
    brand_elements: List[str] = Field(..., description="Detected brand elements")
    technical_complexity: str = Field(..., description="Technical complexity level")
    optimization_suggestions: List[str] = Field(..., description="Optimization suggestions")
    platform_adaptations: Dict[str, str] = Field(..., description="Platform-specific adaptations")


class ImageVariation(BaseModel):
    """Schema for image prompt variations."""
    
    name: str = Field(..., description="Variation name")
    prompt: str = Field(..., description="Image generation prompt")
    use_case: str = Field(..., description="Intended use case")
    platform: str = Field(..., description="Target platform")


class VideoConcept(BaseModel):
    """Schema for video concept."""
    
    title: str = Field(..., description="Concept title")
    duration: str = Field(..., description="Video duration")
    key_moments: List[str] = Field(..., description="Key visual moments")
    camera_movements: List[str] = Field(..., description="Camera movement descriptions")
    music_style: str = Field(..., description="Music style recommendation")
    target_emotion: str = Field(..., description="Target emotional response")
    cta: str = Field(..., description="Call-to-action")


class CopyVariations(BaseModel):
    """Schema for copy variations."""
    
    social_caption: str = Field(..., description="Social media caption")
    voiceover_script: str = Field(..., description="Video voiceover script")
    print_headline: str = Field(..., description="Print advertisement headline")
    email_subject: str = Field(..., description="Email subject line")
    hero_text: str = Field(..., description="Website hero text")


class CameraSettings(BaseModel):
    """Schema for camera settings."""
    
    aperture: str = Field(..., description="Recommended aperture")
    shutter_speed: str = Field(..., description="Recommended shutter speed")
    iso: str = Field(..., description="Recommended ISO range")
    focal_length: str = Field(..., description="Recommended focal length")


class LightingSetup(BaseModel):
    """Schema for lighting setup."""
    
    key_light: str = Field(..., description="Key light setup")
    rim_light: str = Field(..., description="Rim light setup")
    fill_light: str = Field(..., description="Fill light setup")
    background_light: str = Field(..., description="Background light setup")


class ShootingGuidelines(BaseModel):
    """Schema for shooting guidelines."""
    
    camera_settings: CameraSettings = Field(..., description="Camera settings")
    lighting_setup: LightingSetup = Field(..., description="Lighting setup")
    camera_movements: List[str] = Field(..., description="Recommended camera movements")
    weather_conditions: str = Field(..., description="Required weather conditions")
    time_of_day: str = Field(..., description="Optimal time of day")
    location_requirements: str = Field(..., description="Location requirements")


class ColorGrading(BaseModel):
    """Schema for color grading instructions."""
    
    style: str = Field(..., description="Color grading style")
    contrast: str = Field(..., description="Contrast settings")
    saturation: str = Field(..., description="Saturation settings")
    highlights: str = Field(..., description="Highlight treatment")
    shadows: str = Field(..., description="Shadow treatment")


class PostProductionNotes(BaseModel):
    """Schema for post-production notes."""
    
    color_grading: ColorGrading = Field(..., description="Color grading instructions")
    vfx_requirements: List[str] = Field(..., description="VFX requirements")
    audio_requirements: Dict[str, str] = Field(..., description="Audio requirements")
    delivery_formats: List[str] = Field(..., description="Required delivery formats")


class BudgetBreakdown(BaseModel):
    """Schema for budget breakdown."""
    
    total_budget: int = Field(..., description="Total budget in USD")
    breakdown: Dict[str, int] = Field(..., description="Budget breakdown by category")


class Timeline(BaseModel):
    """Schema for production timeline."""
    
    pre_production: str = Field(..., description="Pre-production duration")
    production: str = Field(..., description="Production duration")
    post_production: str = Field(..., description="Post-production duration")
    total_duration: str = Field(..., description="Total project duration")


class SuccessMetrics(BaseModel):
    """Schema for success metrics."""
    
    primary_metrics: List[str] = Field(..., description="Primary success metrics")
    secondary_metrics: List[str] = Field(..., description="Secondary success metrics")
    targets: Dict[str, Any] = Field(..., description="Target values for metrics")


class CinematicCampaignRequest(BaseModel):
    """Request schema for generating cinematic campaign."""
    
    brand: str = Field(..., description="Brand name")
    product: str = Field(..., description="Product name")
    base_prompt: str = Field(..., description="Base image generation prompt")
    campaign_goal: str = Field("brand_awareness", description="Campaign objective")
    target_audience: str = Field("luxury consumers", description="Target audience")
    budget_tier: str = Field("premium", description="Budget tier (premium, mid, budget)")


class CinematicCampaignResponse(BaseModel):
    """Response schema for cinematic campaign generation."""
    
    success: bool = Field(..., description="Whether the request was successful")
    brand: str = Field(..., description="Brand name")
    product: str = Field(..., description="Product name")
    base_prompt: str = Field(..., description="Base image generation prompt")
    prompt_analysis: ImagePromptAnalysis = Field(..., description="Prompt analysis results")
    image_variations: List[ImageVariation] = Field(..., description="Image prompt variations")
    video_concepts: List[Dict[str, VideoConcept]] = Field(..., description="Video concepts")
    copy_variations: CopyVariations = Field(..., description="Copy variations")
    platform_adaptations: Dict[str, str] = Field(..., description="Platform adaptations")
    shooting_guidelines: ShootingGuidelines = Field(..., description="Shooting guidelines")
    post_production_notes: PostProductionNotes = Field(..., description="Post-production notes")
    budget_breakdown: BudgetBreakdown = Field(..., description="Budget breakdown")
    timeline: Timeline = Field(..., description="Production timeline")
    success_metrics: SuccessMetrics = Field(..., description="Success metrics")


class CreativeBriefRequest(BaseModel):
    """Request schema for generating creative brief."""
    
    brand: str = Field(..., description="Brand name")
    product: str = Field(..., description="Product name")
    base_prompt: str = Field(..., description="Base image generation prompt")
    campaign_objectives: List[str] = Field(..., description="Campaign objectives")


class CreativeBriefResponse(BaseModel):
    """Response schema for creative brief generation."""
    
    success: bool = Field(..., description="Whether the request was successful")
    brand: str = Field(..., description="Brand name")
    product: str = Field(..., description="Product name")
    base_prompt: str = Field(..., description="Base image generation prompt")
    objectives: List[str] = Field(..., description="Campaign objectives")
    creative_concept: str = Field(..., description="Creative concept")
    visual_style: str = Field(..., description="Visual style guide")
    tone_of_voice: str = Field(..., description="Tone of voice")
    key_messages: List[str] = Field(..., description="Key messages")
    target_audience: str = Field(..., description="Target audience")
    competitive_positioning: str = Field(..., description="Competitive positioning")
    brand_guidelines: str = Field(..., description="Brand guidelines")
    success_metrics: List[str] = Field(..., description="Success metrics")
    creative_requirements: List[str] = Field(..., description="Creative requirements")
    production_considerations: List[str] = Field(..., description="Production considerations")


class ImagePromptOptimizationRequest(BaseModel):
    """Request schema for optimizing image prompts."""
    
    prompt: str = Field(..., description="Image generation prompt to optimize")
    target_platform: Optional[str] = Field(None, description="Target platform for optimization")
    brand_guidelines: Optional[str] = Field(None, description="Brand guidelines to follow")
    technical_requirements: Optional[str] = Field(None, description="Technical requirements")


class ImagePromptOptimizationResponse(BaseModel):
    """Response schema for image prompt optimization."""
    
    success: bool = Field(..., description="Whether the request was successful")
    original_prompt: str = Field(..., description="Original prompt")
    optimized_prompt: str = Field(..., description="Optimized prompt")
    analysis: ImagePromptAnalysis = Field(..., description="Prompt analysis")
    optimizations_applied: List[str] = Field(..., description="Optimizations applied")
    platform_adaptations: Dict[str, str] = Field(..., description="Platform adaptations")
    suggested_hashtags: List[str] = Field(..., description="Suggested hashtags")


class CinematicCreativeStats(BaseModel):
    """Schema for cinematic creative statistics."""
    
    total_campaigns_generated: int = Field(..., description="Total campaigns generated")
    brands_served: int = Field(..., description="Number of brands served")
    average_budget: float = Field(..., description="Average campaign budget")
    most_common_shot_type: str = Field(..., description="Most common shot type")
    most_common_lighting: str = Field(..., description="Most common lighting style")
    success_rate: float = Field(..., description="Success rate of generation")



