"""
Budget allocation module for ad campaigns.
"""

import asyncio
import numpy as np
from typing import Any, Dict, List, Optional, Tuple

from app.core.logging import get_logger


class BudgetAllocator:
    """Budget allocation optimizer for ad campaigns."""
    
    def __init__(self):
        self.logger = get_logger("budget_allocator")
    
    async def allocate_budget(
        self,
        total_budget: float,
        ad_groups: List[Dict[str, Any]],
        allocation_strategy: str = "performance_based",
        constraints: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Allocate budget across ad groups."""
        
        if allocation_strategy == "performance_based":
            return await self._allocate_performance_based(total_budget, ad_groups, constraints)
        elif allocation_strategy == "equal":
            return await self._allocate_equal(total_budget, ad_groups, constraints)
        elif allocation_strategy == "roas_optimized":
            return await self._allocate_roas_optimized(total_budget, ad_groups, constraints)
        elif allocation_strategy == "cpa_optimized":
            return await self._allocate_cpa_optimized(total_budget, ad_groups, constraints)
        else:
            raise ValueError(f"Unsupported allocation strategy: {allocation_strategy}")
    
    async def _allocate_performance_based(
        self,
        total_budget: float,
        ad_groups: List[Dict[str, Any]],
        constraints: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Allocate budget based on ad group performance."""
        
        if not ad_groups:
            return {"allocations": {}, "total_allocated": 0.0}
        
        # Calculate performance scores for each ad group
        performance_scores = []
        for ad_group in ad_groups:
            score = self._calculate_performance_score(ad_group)
            performance_scores.append(score)
        
        # Normalize scores to probabilities
        total_score = sum(performance_scores)
        if total_score == 0:
            # If no performance data, allocate equally
            allocations = {ag["id"]: total_budget / len(ad_groups) for ag in ad_groups}
        else:
            # Allocate based on performance scores
            allocations = {}
            for i, ad_group in enumerate(ad_groups):
                allocation = (performance_scores[i] / total_score) * total_budget
                allocations[ad_group["id"]] = allocation
        
        # Apply constraints
        allocations = self._apply_constraints(allocations, total_budget, constraints)
        
        return {
            "allocations": allocations,
            "total_allocated": sum(allocations.values()),
            "strategy": "performance_based",
            "performance_scores": dict(zip([ag["id"] for ag in ad_groups], performance_scores))
        }
    
    async def _allocate_equal(
        self,
        total_budget: float,
        ad_groups: List[Dict[str, Any]],
        constraints: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Allocate budget equally across ad groups."""
        
        if not ad_groups:
            return {"allocations": {}, "total_allocated": 0.0}
        
        # Equal allocation
        equal_allocation = total_budget / len(ad_groups)
        allocations = {ad_group["id"]: equal_allocation for ad_group in ad_groups}
        
        # Apply constraints
        allocations = self._apply_constraints(allocations, total_budget, constraints)
        
        return {
            "allocations": allocations,
            "total_allocated": sum(allocations.values()),
            "strategy": "equal"
        }
    
    async def _allocate_roas_optimized(
        self,
        total_budget: float,
        ad_groups: List[Dict[str, Any]],
        constraints: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Allocate budget to maximize ROAS."""
        
        if not ad_groups:
            return {"allocations": {}, "total_allocated": 0.0}
        
        # Calculate ROAS for each ad group
        roas_scores = []
        for ad_group in ad_groups:
            roas = ad_group.get("roas", 0)
            roas_scores.append(max(roas, 0.1))  # Minimum ROAS of 0.1
        
        # Use ROAS as allocation weights
        total_roas = sum(roas_scores)
        allocations = {}
        
        for i, ad_group in enumerate(ad_groups):
            allocation = (roas_scores[i] / total_roas) * total_budget
            allocations[ad_group["id"]] = allocation
        
        # Apply constraints
        allocations = self._apply_constraints(allocations, total_budget, constraints)
        
        return {
            "allocations": allocations,
            "total_allocated": sum(allocations.values()),
            "strategy": "roas_optimized",
            "roas_scores": dict(zip([ag["id"] for ag in ad_groups], roas_scores))
        }
    
    async def _allocate_cpa_optimized(
        self,
        total_budget: float,
        ad_groups: List[Dict[str, Any]],
        constraints: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Allocate budget to minimize CPA."""
        
        if not ad_groups:
            return {"allocations": {}, "total_allocated": 0.0}
        
        # Calculate CPA scores (inverse of CPA for allocation)
        cpa_scores = []
        for ad_group in ad_groups:
            cpa = ad_group.get("cpa", 0)
            if cpa > 0:
                cpa_scores.append(1 / cpa)  # Inverse CPA
            else:
                cpa_scores.append(0.01)  # Default score for zero CPA
        
        # Use inverse CPA as allocation weights
        total_cpa_score = sum(cpa_scores)
        allocations = {}
        
        for i, ad_group in enumerate(ad_groups):
            allocation = (cpa_scores[i] / total_cpa_score) * total_budget
            allocations[ad_group["id"]] = allocation
        
        # Apply constraints
        allocations = self._apply_constraints(allocations, total_budget, constraints)
        
        return {
            "allocations": allocations,
            "total_allocated": sum(allocations.values()),
            "strategy": "cpa_optimized",
            "cpa_scores": dict(zip([ag["id"] for ag in ad_groups], cpa_scores))
        }
    
    def _calculate_performance_score(self, ad_group: Dict[str, Any]) -> float:
        """Calculate performance score for an ad group."""
        
        # Weighted combination of key metrics
        roas_weight = 0.4
        ctr_weight = 0.3
        conversion_rate_weight = 0.3
        
        roas = ad_group.get("roas", 0)
        ctr = ad_group.get("ctr", 0)
        conversion_rate = ad_group.get("conversion_rate", 0)
        
        # Normalize metrics
        normalized_roas = min(roas / 5.0, 1.0)  # Cap at 5x ROAS
        normalized_ctr = min(ctr / 0.05, 1.0)  # Cap at 5% CTR
        normalized_conversion_rate = min(conversion_rate / 0.1, 1.0)  # Cap at 10% conversion rate
        
        # Calculate weighted score
        score = (
            normalized_roas * roas_weight +
            normalized_ctr * ctr_weight +
            normalized_conversion_rate * conversion_rate_weight
        )
        
        return score
    
    def _apply_constraints(
        self,
        allocations: Dict[str, float],
        total_budget: float,
        constraints: Optional[Dict[str, Any]]
    ) -> Dict[str, float]:
        """Apply constraints to budget allocations."""
        
        if not constraints:
            return allocations
        
        # Minimum allocation constraint
        min_allocation = constraints.get("min_allocation", 0)
        for ad_group_id in allocations:
            if allocations[ad_group_id] < min_allocation:
                allocations[ad_group_id] = min_allocation
        
        # Maximum allocation constraint
        max_allocation = constraints.get("max_allocation", total_budget)
        for ad_group_id in allocations:
            if allocations[ad_group_id] > max_allocation:
                allocations[ad_group_id] = max_allocation
        
        # Ensure total doesn't exceed budget
        total_allocated = sum(allocations.values())
        if total_allocated > total_budget:
            # Scale down proportionally
            scale_factor = total_budget / total_allocated
            for ad_group_id in allocations:
                allocations[ad_group_id] *= scale_factor
        
        return allocations
    
    async def optimize_budget_over_time(
        self,
        total_budget: float,
        ad_groups: List[Dict[str, Any]],
        time_horizon: int = 7,
        allocation_strategy: str = "performance_based"
    ) -> Dict[str, Any]:
        """Optimize budget allocation over time."""
        
        # This is a simplified implementation
        # In production, this would use more sophisticated time-series optimization
        
        daily_budget = total_budget / time_horizon
        daily_allocations = []
        
        for day in range(time_horizon):
            # Simulate performance changes over time
            modified_ad_groups = self._simulate_performance_changes(ad_groups, day)
            
            # Allocate budget for this day
            daily_allocation = await self.allocate_budget(
                daily_budget,
                modified_ad_groups,
                allocation_strategy
            )
            
            daily_allocations.append({
                "day": day + 1,
                "allocations": daily_allocation["allocations"],
                "total_allocated": daily_allocation["total_allocated"]
            })
        
        return {
            "daily_allocations": daily_allocations,
            "total_budget": total_budget,
            "time_horizon": time_horizon,
            "strategy": allocation_strategy
        }
    
    def _simulate_performance_changes(
        self,
        ad_groups: List[Dict[str, Any]],
        day: int
    ) -> List[Dict[str, Any]]:
        """Simulate performance changes over time."""
        
        modified_groups = []
        
        for ad_group in ad_groups:
            modified_group = ad_group.copy()
            
            # Simulate performance changes
            # In production, this would use actual historical data and trends
            
            # Add some random variation
            roas_variation = np.random.normal(1.0, 0.1)
            ctr_variation = np.random.normal(1.0, 0.05)
            conversion_rate_variation = np.random.normal(1.0, 0.05)
            
            modified_group["roas"] = max(0, modified_group.get("roas", 0) * roas_variation)
            modified_group["ctr"] = max(0, modified_group.get("ctr", 0) * ctr_variation)
            modified_group["conversion_rate"] = max(0, modified_group.get("conversion_rate", 0) * conversion_rate_variation)
            
            modified_groups.append(modified_group)
        
        return modified_groups
    
    async def get_allocation_recommendations(
        self,
        allocations: Dict[str, float],
        ad_groups: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Get recommendations for budget allocation."""
        
        recommendations = []
        
        # Find ad groups with high allocation but low performance
        for ad_group in ad_groups:
            ad_group_id = ad_group["id"]
            allocation = allocations.get(ad_group_id, 0)
            performance_score = self._calculate_performance_score(ad_group)
            
            if allocation > 0 and performance_score < 0.3:
                recommendations.append({
                    "type": "reduce_allocation",
                    "ad_group_id": ad_group_id,
                    "current_allocation": allocation,
                    "recommended_allocation": allocation * 0.5,
                    "reason": "Low performance score detected",
                    "priority": "high"
                })
        
        # Find ad groups with low allocation but high performance
        for ad_group in ad_groups:
            ad_group_id = ad_group["id"]
            allocation = allocations.get(ad_group_id, 0)
            performance_score = self._calculate_performance_score(ad_group)
            
            if allocation > 0 and performance_score > 0.7:
                recommendations.append({
                    "type": "increase_allocation",
                    "ad_group_id": ad_group_id,
                    "current_allocation": allocation,
                    "recommended_allocation": allocation * 1.5,
                    "reason": "High performance score detected",
                    "priority": "high"
                })
        
        return recommendations
    
    async def calculate_allocation_efficiency(
        self,
        allocations: Dict[str, float],
        ad_groups: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Calculate efficiency of budget allocation."""
        
        if not ad_groups:
            return {"efficiency_score": 0.0, "recommendations": []}
        
        # Calculate weighted performance score
        total_allocation = sum(allocations.values())
        if total_allocation == 0:
            return {"efficiency_score": 0.0, "recommendations": []}
        
        weighted_performance = 0.0
        for ad_group in ad_groups:
            ad_group_id = ad_group["id"]
            allocation = allocations.get(ad_group_id, 0)
            performance_score = self._calculate_performance_score(ad_group)
            
            weight = allocation / total_allocation
            weighted_performance += performance_score * weight
        
        # Calculate efficiency score
        efficiency_score = weighted_performance
        
        # Generate recommendations
        recommendations = await self.get_allocation_recommendations(allocations, ad_groups)
        
        return {
            "efficiency_score": efficiency_score,
            "weighted_performance": weighted_performance,
            "recommendations": recommendations
        }



