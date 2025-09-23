"""
Pydantic schemas for optimization engine.
"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class OptimizationRequest(BaseModel):
    """Request schema for campaign optimization."""
    
    campaign_id: str = Field(..., description="ID of the campaign to optimize")
    optimization_goals: Dict[str, Any] = Field(..., description="Goals for optimization")
    constraints: Dict[str, Any] = Field(default={}, description="Constraints for optimization")


class OptimizationResponse(BaseModel):
    """Response schema for campaign optimization."""
    
    success: bool = Field(..., description="Whether the optimization was successful")
    campaign_id: str = Field(..., description="ID of the optimized campaign")
    optimizations: List[Dict[str, Any]] = Field(..., description="Applied optimizations")
    insights: List[Dict[str, Any]] = Field(..., description="Optimization insights")
    performance_improvement: Dict[str, Any] = Field(..., description="Expected performance improvement")


class BudgetAllocationRequest(BaseModel):
    """Request schema for budget allocation."""
    
    total_budget: float = Field(..., description="Total budget to allocate")
    ad_groups: List[Dict[str, Any]] = Field(..., description="Ad groups to allocate budget to")
    allocation_strategy: str = Field(default="performance_based", description="Allocation strategy")
    constraints: Optional[Dict[str, Any]] = Field(default=None, description="Allocation constraints")


class BudgetAllocationResponse(BaseModel):
    """Response schema for budget allocation."""
    
    success: bool = Field(..., description="Whether the allocation was successful")
    allocations: Dict[str, float] = Field(..., description="Budget allocations per ad group")
    total_allocated: float = Field(..., description="Total allocated budget")
    strategy: str = Field(..., description="Allocation strategy used")
    performance_scores: Dict[str, float] = Field(default={}, description="Performance scores per ad group")
    roas_scores: Dict[str, float] = Field(default={}, description="ROAS scores per ad group")
    cpa_scores: Dict[str, float] = Field(default={}, description="CPA scores per ad group")



