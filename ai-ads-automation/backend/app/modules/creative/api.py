"""
API endpoints for creative generation.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.logging import get_logger
from app.modules.creative.generator import CreativeGenerator
from app.modules.creative.cinematic_creative_generator import CinematicCreativeGenerator
from app.modules.creative.image_prompt_analyzer import ImagePromptAnalyzer
from app.schemas.creative import (
    CreativeGenerationRequest,
    CreativeGenerationResponse,
    CreativeOptimizationRequest,
    CreativeOptimizationResponse,
    CreativePerformanceInsightsResponse
)
from app.schemas.cinematic_creative import (
    CinematicCampaignRequest, CinematicCampaignResponse,
    CreativeBriefRequest, CreativeBriefResponse,
    ImagePromptOptimizationRequest, ImagePromptOptimizationResponse,
    CinematicCreativeStats
)

router = APIRouter(prefix="/creative", tags=["creative"])
logger = get_logger("creative_api")


@router.post("/generate", response_model=CreativeGenerationResponse)
async def generate_creatives(
    request: CreativeGenerationRequest,
    db: Session = Depends(get_db)
):
    """Generate creative assets for a campaign."""
    
    try:
        generator = CreativeGenerator()
        
        creatives = await generator.generate_campaign_creatives(
            db=db,
            campaign_id=request.campaign_id,
            creative_brief=request.creative_brief,
            count=request.count
        )
        
        return CreativeGenerationResponse(
            success=True,
            creatives=creatives,
            count=len(creatives)
        )
        
    except Exception as e:
        logger.error(f"Error generating creatives: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate creatives: {str(e)}"
        )


@router.post("/optimize", response_model=CreativeOptimizationResponse)
async def optimize_creative(
    request: CreativeOptimizationRequest,
    db: Session = Depends(get_db)
):
    """Optimize an existing creative based on performance data."""
    
    try:
        generator = CreativeGenerator()
        
        optimized_creative = await generator.optimize_creative(
            db=db,
            creative_id=request.creative_id,
            optimization_goals=request.optimization_goals
        )
        
        return CreativeOptimizationResponse(
            success=True,
            creative=optimized_creative
        )
        
    except Exception as e:
        logger.error(f"Error optimizing creative: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to optimize creative: {str(e)}"
        )


@router.get("/performance/{campaign_id}", response_model=CreativePerformanceInsightsResponse)
async def get_creative_performance_insights(
    campaign_id: str,
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """Get performance insights for creatives in a campaign."""
    
    try:
        generator = CreativeGenerator()
        
        insights = await generator.get_creative_performance_insights(
            db=db,
            campaign_id=campaign_id,
            limit=limit
        )
        
        return CreativePerformanceInsightsResponse(
            success=True,
            insights=insights,
            count=len(insights)
        )
        
    except Exception as e:
        logger.error(f"Error getting creative performance insights: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get creative performance insights: {str(e)}"
        )


# New Cinematic Creative Endpoints

@router.post("/cinematic/campaign", response_model=CinematicCampaignResponse, status_code=status.HTTP_200_OK)
async def generate_cinematic_campaign(
    request: CinematicCampaignRequest
):
    """Generate a complete cinematic campaign from an image prompt."""
    logger.info(f"Generating cinematic campaign for {request.brand} {request.product}")
    
    try:
        cinematic_generator = CinematicCreativeGenerator()
        campaign = await cinematic_generator.generate_cinematic_campaign(
            brand=request.brand,
            product=request.product,
            base_prompt=request.base_prompt,
            campaign_goal=request.campaign_goal,
            target_audience=request.target_audience,
            budget_tier=request.budget_tier
        )
        
        return CinematicCampaignResponse(
            success=True,
            brand=campaign["brand"],
            product=campaign["product"],
            base_prompt=campaign["base_prompt"],
            prompt_analysis=campaign["prompt_analysis"],
            image_variations=campaign["image_variations"],
            video_concepts=campaign["video_concepts"],
            copy_variations=campaign["copy_variations"],
            platform_adaptations=campaign["platform_adaptations"],
            shooting_guidelines=campaign["shooting_guidelines"],
            post_production_notes=campaign["post_production_notes"],
            budget_breakdown=campaign["budget_breakdown"],
            timeline=campaign["timeline"],
            success_metrics=campaign["success_metrics"]
        )
    except Exception as e:
        logger.error(f"Error generating cinematic campaign: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate cinematic campaign: {e}"
        )


@router.post("/cinematic/brief", response_model=CreativeBriefResponse, status_code=status.HTTP_200_OK)
async def generate_creative_brief(
    request: CreativeBriefRequest
):
    """Generate a comprehensive creative brief from an image prompt."""
    logger.info(f"Generating creative brief for {request.brand} {request.product}")
    
    try:
        cinematic_generator = CinematicCreativeGenerator()
        brief = await cinematic_generator.generate_creative_brief(
            brand=request.brand,
            product=request.product,
            base_prompt=request.base_prompt,
            campaign_objectives=request.campaign_objectives
        )
        
        return CreativeBriefResponse(
            success=True,
            brand=brief["brand"],
            product=brief["product"],
            base_prompt=brief["base_prompt"],
            objectives=brief["objectives"],
            creative_concept=brief["creative_concept"],
            visual_style=brief["visual_style"],
            tone_of_voice=brief["tone_of_voice"],
            key_messages=brief["key_messages"],
            target_audience=brief["target_audience"],
            competitive_positioning=brief.get("competitive_positioning", ""),
            brand_guidelines=brief.get("brand_guidelines", ""),
            success_metrics=brief.get("success_metrics", []),
            creative_requirements=brief.get("creative_requirements", []),
            production_considerations=brief.get("production_considerations", [])
        )
    except Exception as e:
        logger.error(f"Error generating creative brief: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate creative brief: {e}"
        )


@router.post("/cinematic/optimize-prompt", response_model=ImagePromptOptimizationResponse, status_code=status.HTTP_200_OK)
async def optimize_image_prompt(
    request: ImagePromptOptimizationRequest
):
    """Optimize an image generation prompt for better results."""
    logger.info(f"Optimizing image prompt: {request.prompt[:50]}...")
    
    try:
        prompt_analyzer = ImagePromptAnalyzer()
        
        # Analyze the original prompt
        analysis = prompt_analyzer.analyze_prompt(request.prompt)
        
        # Generate optimized prompt
        optimized_prompt = request.prompt
        
        # Apply platform-specific optimizations
        if request.target_platform:
            platform_adaptations = prompt_analyzer._suggest_platform_adaptations(request.prompt)
            if request.target_platform in platform_adaptations:
                optimized_prompt = platform_adaptations[request.target_platform]
        
        # Apply brand guidelines if provided
        if request.brand_guidelines:
            optimized_prompt += f", {request.brand_guidelines}"
        
        # Apply technical requirements if provided
        if request.technical_requirements:
            optimized_prompt += f", {request.technical_requirements}"
        
        # Generate suggested hashtags
        suggested_hashtags = prompt_analyzer.suggest_hashtags(optimized_prompt)
        
        # Track optimizations applied
        optimizations_applied = []
        if request.target_platform:
            optimizations_applied.append(f"Platform optimization for {request.target_platform}")
        if request.brand_guidelines:
            optimizations_applied.append("Brand guidelines integration")
        if request.technical_requirements:
            optimizations_applied.append("Technical requirements integration")
        
        return ImagePromptOptimizationResponse(
            success=True,
            original_prompt=request.prompt,
            optimized_prompt=optimized_prompt,
            analysis=analysis,
            optimizations_applied=optimizations_applied,
            platform_adaptations=prompt_analyzer._suggest_platform_adaptations(optimized_prompt),
            suggested_hashtags=suggested_hashtags
        )
    except Exception as e:
        logger.error(f"Error optimizing image prompt: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to optimize image prompt: {e}"
        )


@router.get("/cinematic/stats", response_model=CinematicCreativeStats)
async def get_cinematic_creative_stats():
    """Get statistics about cinematic creative generation."""
    logger.info("Getting cinematic creative stats")
    
    try:
        # This would typically come from a database or analytics service
        # For now, return mock stats
        stats = {
            "total_campaigns_generated": 0,
            "brands_served": 0,
            "average_budget": 0.0,
            "most_common_shot_type": "unknown",
            "most_common_lighting": "unknown",
            "success_rate": 100.0
        }
        
        return CinematicCreativeStats(**stats)
    except Exception as e:
        logger.error(f"Error getting cinematic creative stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get cinematic creative stats: {e}"
        )


@router.get("/health")
async def health_check():
    """Health check endpoint for the creative module."""
    
    return {
        "status": "healthy",
        "module": "creative",
        "version": "1.0.0"
    }
