"""
FastAPI routes for feedback loop services.
"""

from typing import List, Optional
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.logging import logger
from app.modules.feedback_loop.feedback_service import FeedbackService
from app.schemas.feedback_loop import (
    MetricsIngestRequest, MetricsIngestResponse,
    WinnerSearchRequest, WinnerSearchResponse,
    PerformanceAnalysisRequest, PerformanceAnalysisResponse,
    FeedbackStatsResponse
)

router = APIRouter()


@router.post("/metrics/ingest", response_model=MetricsIngestResponse, status_code=status.HTTP_201_CREATED)
async def ingest_metrics(
    request: MetricsIngestRequest,
    db: Session = Depends(get_db),
    feedback_service: FeedbackService = Depends(FeedbackService)
):
    """Ingest new metrics for a post."""
    logger.info(f"Ingesting metrics for post {request.post_id}")
    
    try:
        success = feedback_service.ingest_metrics(
            db=db,
            post_id=str(request.post_id),
            platform=request.platform,
            impressions=request.impressions,
            clicks=request.clicks,
            conversions=request.conversions,
            revenue=request.revenue
        )
        
        if success:
            return MetricsIngestResponse(
                success=True,
                message="Metrics successfully ingested"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to ingest metrics"
            )
    except Exception as e:
        logger.error(f"Error ingesting metrics: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to ingest metrics: {e}"
        )


@router.post("/winners/search", response_model=WinnerSearchResponse)
async def search_winning_content(
    request: WinnerSearchRequest,
    feedback_service: FeedbackService = Depends(FeedbackService)
):
    """Search for winning content similar to the query."""
    logger.info(f"Searching for winning content similar to: {request.query_text[:50]}...")
    
    try:
        results = feedback_service.search_similar_content(
            query_text=request.query_text,
            limit=request.limit
        )
        
        return WinnerSearchResponse(
            success=True,
            query_text=request.query_text,
            results=results
        )
    except Exception as e:
        logger.error(f"Error searching winning content: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to search winning content: {e}"
        )


@router.get("/winners/brand/{brand_id}", response_model=WinnerSearchResponse)
async def get_brand_winners(
    brand_id: UUID,
    feedback_service: FeedbackService = Depends(FeedbackService)
):
    """Get all winning content for a specific brand."""
    logger.info(f"Getting winning content for brand {brand_id}")
    
    try:
        winners = feedback_service.get_winning_content_for_brand(str(brand_id))
        
        # Convert to the expected format
        results = [
            {
                "key": winner["key"],
                "similarity_score": 1.0,  # All winners for a brand have max similarity
                "content": winner["content"],
                "metadata": winner["metadata"]
            }
            for winner in winners
        ]
        
        return WinnerSearchResponse(
            success=True,
            query_text=f"brand:{brand_id}",
            results=results
        )
    except Exception as e:
        logger.error(f"Error getting brand winners: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get brand winners: {e}"
        )


@router.post("/analysis/performance", response_model=PerformanceAnalysisResponse)
async def analyze_performance(
    request: PerformanceAnalysisRequest,
    db: Session = Depends(get_db),
    feedback_service: FeedbackService = Depends(FeedbackService)
):
    """Analyze performance trends for a brand."""
    logger.info(f"Analyzing performance for brand {request.brand_id}")
    
    try:
        analysis = feedback_service.analyze_performance_trends(
            db=db,
            brand_id=str(request.brand_id),
            days=request.days
        )
        
        return PerformanceAnalysisResponse(
            success=True,
            brand_id=request.brand_id,
            analysis=analysis
        )
    except Exception as e:
        logger.error(f"Error analyzing performance: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze performance: {e}"
        )


@router.post("/jobs/nightly-winner", response_model=FeedbackStatsResponse)
async def run_nightly_winner_job(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    feedback_service: FeedbackService = Depends(FeedbackService)
):
    """Run the nightly winner identification job."""
    logger.info("Running nightly winner job")
    
    try:
        # Run the job in the background
        def run_job():
            return feedback_service.nightly_winner_job(db)
        
        # For now, run synchronously. In production, you'd use a proper task queue
        stats = run_job()
        
        return FeedbackStatsResponse(
            success=True,
            message="Nightly winner job completed",
            stats=stats
        )
    except Exception as e:
        logger.error(f"Error running nightly winner job: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to run nightly winner job: {e}"
        )


@router.get("/stats", response_model=FeedbackStatsResponse)
async def get_feedback_stats(
    feedback_service: FeedbackService = Depends(FeedbackService)
):
    """Get feedback system statistics."""
    logger.info("Getting feedback system stats")
    
    try:
        stats = feedback_service.get_feedback_stats()
        
        return FeedbackStatsResponse(
            success=True,
            message="Feedback stats retrieved",
            stats=stats
        )
    except Exception as e:
        logger.error(f"Error getting feedback stats: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get feedback stats: {e}"
        )



