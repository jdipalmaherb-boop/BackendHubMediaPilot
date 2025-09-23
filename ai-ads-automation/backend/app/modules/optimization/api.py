"""
API endpoints for optimization engine.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.logging import get_logger
from app.modules.optimization.engine import OptimizationEngine
from app.schemas.optimization import (
    OptimizationRequest,
    OptimizationResponse,
    BudgetAllocationRequest,
    BudgetAllocationResponse
)

router = APIRouter(prefix="/optimization", tags=["optimization"])
logger = get_logger("optimization_api")


@router.post("/optimize", response_model=OptimizationResponse)
async def optimize_campaign(
    request: OptimizationRequest,
    db: Session = Depends(get_db)
):
    """Optimize a campaign using multiple optimization strategies."""
    
    try:
        engine = OptimizationEngine()
        
        result = await engine.optimize_campaign(
            db=db,
            campaign_id=request.campaign_id,
            optimization_goals=request.optimization_goals,
            constraints=request.constraints
        )
        
        return OptimizationResponse(
            success=True,
            campaign_id=request.campaign_id,
            optimizations=result["optimizations"],
            insights=result["insights"],
            performance_improvement=result["performance_improvement"]
        )
        
    except Exception as e:
        logger.error(f"Error optimizing campaign: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to optimize campaign: {str(e)}"
        )


@router.post("/budget/allocate", response_model=BudgetAllocationResponse)
async def allocate_budget(
    request: BudgetAllocationRequest,
    db: Session = Depends(get_db)
):
    """Allocate budget across ad groups."""
    
    try:
        from app.modules.optimization.budget_allocator import BudgetAllocator
        
        allocator = BudgetAllocator()
        
        result = await allocator.allocate_budget(
            total_budget=request.total_budget,
            ad_groups=request.ad_groups,
            allocation_strategy=request.allocation_strategy,
            constraints=request.constraints
        )
        
        return BudgetAllocationResponse(
            success=True,
            allocations=result["allocations"],
            total_allocated=result["total_allocated"],
            strategy=result["strategy"],
            performance_scores=result.get("performance_scores", {}),
            roas_scores=result.get("roas_scores", {}),
            cpa_scores=result.get("cpa_scores", {})
        )
        
    except Exception as e:
        logger.error(f"Error allocating budget: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to allocate budget: {str(e)}"
        )


@router.get("/health")
async def health_check():
    """Health check endpoint for the optimization module."""
    
    return {
        "status": "healthy",
        "module": "optimization",
        "version": "1.0.0"
    }



