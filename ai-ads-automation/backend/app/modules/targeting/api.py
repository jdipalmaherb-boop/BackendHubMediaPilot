"""
API endpoints for targeting and audience engine.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.logging import get_logger
from app.modules.targeting.engine import TargetingEngine
from app.schemas.targeting import (
    TargetingSuggestionRequest,
    TargetingSuggestionResponse,
    TargetingOptimizationRequest,
    TargetingOptimizationResponse,
    TargetingInsightsResponse
)

router = APIRouter(prefix="/targeting", tags=["targeting"])
logger = get_logger("targeting_api")


@router.post("/suggestions", response_model=TargetingSuggestionResponse)
async def generate_targeting_suggestions(
    request: TargetingSuggestionRequest,
    db: Session = Depends(get_db)
):
    """Generate targeting suggestions for a campaign."""
    
    try:
        engine = TargetingEngine()
        
        suggestions = await engine.generate_targeting_suggestions(
            db=db,
            campaign_id=request.campaign_id,
            targeting_brief=request.targeting_brief,
            count=request.count
        )
        
        return TargetingSuggestionResponse(
            success=True,
            suggestions=suggestions,
            count=len(suggestions)
        )
        
    except Exception as e:
        logger.error(f"Error generating targeting suggestions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate targeting suggestions: {str(e)}"
        )


@router.post("/optimize", response_model=TargetingOptimizationResponse)
async def optimize_targeting(
    request: TargetingOptimizationRequest,
    db: Session = Depends(get_db)
):
    """Optimize targeting for an ad group based on performance data."""
    
    try:
        engine = TargetingEngine()
        
        optimized_targeting = await engine.optimize_targeting(
            db=db,
            ad_group_id=request.ad_group_id,
            performance_data=request.performance_data
        )
        
        return TargetingOptimizationResponse(
            success=True,
            optimized_targeting=optimized_targeting
        )
        
    except Exception as e:
        logger.error(f"Error optimizing targeting: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to optimize targeting: {str(e)}"
        )


@router.get("/insights/{campaign_id}", response_model=TargetingInsightsResponse)
async def get_targeting_insights(
    campaign_id: str,
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """Get targeting insights for a campaign."""
    
    try:
        engine = TargetingEngine()
        
        insights = await engine.get_targeting_insights(
            db=db,
            campaign_id=campaign_id,
            limit=limit
        )
        
        return TargetingInsightsResponse(
            success=True,
            insights=insights,
            count=len(insights)
        )
        
    except Exception as e:
        logger.error(f"Error getting targeting insights: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get targeting insights: {str(e)}"
        )


@router.get("/health")
async def health_check():
    """Health check endpoint for the targeting module."""
    
    return {
        "status": "healthy",
        "module": "targeting",
        "version": "1.0.0"
    }



