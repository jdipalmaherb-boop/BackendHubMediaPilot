"""
Main Optimization Engine for ad campaign optimization.
"""

import asyncio
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import get_logger, log_ai_operation
from app.models.ai import OptimizationLog, AIInsight
from app.models.campaign import Campaign, AdGroup, AdCreative
from app.modules.optimization.contextual_bandit import ContextualBandit
from app.modules.optimization.rl_policy import RLPolicy
from app.modules.optimization.budget_allocator import BudgetAllocator


class OptimizationEngine:
    """Main optimization engine for ad campaigns."""
    
    def __init__(self):
        self.contextual_bandit = ContextualBandit()
        self.rl_policy = RLPolicy()
        self.budget_allocator = BudgetAllocator()
        self.logger = get_logger("optimization_engine")
    
    async def optimize_campaign(
        self,
        db: Session,
        campaign_id: str,
        optimization_goals: Dict[str, Any],
        constraints: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Optimize a campaign using multiple optimization strategies."""
        
        # Get campaign details
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            raise ValueError(f"Campaign {campaign_id} not found")
        
        log_ai_operation(
            module="optimization",
            operation="optimize_campaign",
            campaign_id=campaign_id,
            goals=optimization_goals
        )
        
        # Get campaign performance data
        performance_data = await self._get_campaign_performance(db, campaign_id)
        
        # Run optimization strategies
        optimizations = []
        
        # 1. Budget allocation optimization
        budget_optimization = await self._optimize_budget_allocation(
            campaign, performance_data, optimization_goals, constraints
        )
        optimizations.append(budget_optimization)
        
        # 2. Bid strategy optimization
        bid_optimization = await self._optimize_bid_strategy(
            campaign, performance_data, optimization_goals, constraints
        )
        optimizations.append(bid_optimization)
        
        # 3. Creative optimization
        creative_optimization = await self._optimize_creatives(
            campaign, performance_data, optimization_goals, constraints
        )
        optimizations.append(creative_optimization)
        
        # 4. Targeting optimization
        targeting_optimization = await self._optimize_targeting(
            campaign, performance_data, optimization_goals, constraints
        )
        optimizations.append(targeting_optimization)
        
        # 5. Schedule optimization
        schedule_optimization = await self._optimize_schedule(
            campaign, performance_data, optimization_goals, constraints
        )
        optimizations.append(schedule_optimization)
        
        # Apply optimizations
        applied_optimizations = await self._apply_optimizations(
            db, campaign, optimizations
        )
        
        # Generate insights
        insights = await self._generate_optimization_insights(
            campaign, performance_data, applied_optimizations
        )
        
        return {
            "campaign_id": campaign_id,
            "optimizations": applied_optimizations,
            "insights": insights,
            "performance_improvement": self._calculate_performance_improvement(
                performance_data, applied_optimizations
            )
        }
    
    async def _get_campaign_performance(self, db: Session, campaign_id: str) -> Dict[str, Any]:
        """Get current campaign performance data."""
        
        # Get ad groups for the campaign
        ad_groups = db.query(AdGroup).filter(AdGroup.campaign_id == campaign_id).all()
        
        performance_data = {
            "campaign_id": campaign_id,
            "ad_groups": [],
            "total_spend": 0,
            "total_impressions": 0,
            "total_clicks": 0,
            "total_conversions": 0,
            "total_conversion_value": 0,
            "average_cpa": 0,
            "average_roas": 0
        }
        
        for ad_group in ad_groups:
            # Get ad group performance (simplified - in production, use actual performance data)
            ad_group_performance = {
                "ad_group_id": ad_group.id,
                "platform": ad_group.platform.value,
                "spend": ad_group.metadata.get("spend", 0),
                "impressions": ad_group.metadata.get("impressions", 0),
                "clicks": ad_group.metadata.get("clicks", 0),
                "conversions": ad_group.metadata.get("conversions", 0),
                "conversion_value": ad_group.metadata.get("conversion_value", 0),
                "cpa": ad_group.metadata.get("cpa", 0),
                "roas": ad_group.metadata.get("roas", 0),
                "ctr": ad_group.metadata.get("ctr", 0),
                "conversion_rate": ad_group.metadata.get("conversion_rate", 0)
            }
            
            performance_data["ad_groups"].append(ad_group_performance)
            performance_data["total_spend"] += ad_group_performance["spend"]
            performance_data["total_impressions"] += ad_group_performance["impressions"]
            performance_data["total_clicks"] += ad_group_performance["clicks"]
            performance_data["total_conversions"] += ad_group_performance["conversions"]
            performance_data["total_conversion_value"] += ad_group_performance["conversion_value"]
        
        # Calculate averages
        if performance_data["total_conversions"] > 0:
            performance_data["average_cpa"] = performance_data["total_spend"] / performance_data["total_conversions"]
        
        if performance_data["total_spend"] > 0:
            performance_data["average_roas"] = performance_data["total_conversion_value"] / performance_data["total_spend"]
        
        return performance_data
    
    async def _optimize_budget_allocation(
        self,
        campaign: Campaign,
        performance_data: Dict[str, Any],
        optimization_goals: Dict[str, Any],
        constraints: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Optimize budget allocation across ad groups."""
        
        # Use RL policy for budget allocation
        budget_allocation = await self.rl_policy.optimize_budget_allocation(
            campaign=campaign,
            performance_data=performance_data,
            optimization_goals=optimization_goals,
            constraints=constraints
        )
        
        return {
            "type": "budget_allocation",
            "strategy": "rl_policy",
            "recommendations": budget_allocation,
            "confidence": 0.85
        }
    
    async def _optimize_bid_strategy(
        self,
        campaign: Campaign,
        performance_data: Dict[str, Any],
        optimization_goals: Dict[str, Any],
        constraints: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Optimize bid strategy for ad groups."""
        
        # Use contextual bandit for bid optimization
        bid_strategy = await self.contextual_bandit.optimize_bid_strategy(
            campaign=campaign,
            performance_data=performance_data,
            optimization_goals=optimization_goals,
            constraints=constraints
        )
        
        return {
            "type": "bid_strategy",
            "strategy": "contextual_bandit",
            "recommendations": bid_strategy,
            "confidence": 0.8
        }
    
    async def _optimize_creatives(
        self,
        campaign: Campaign,
        performance_data: Dict[str, Any],
        optimization_goals: Dict[str, Any],
        constraints: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Optimize creative performance."""
        
        # Analyze creative performance
        creative_performance = self._analyze_creative_performance(performance_data)
        
        # Generate creative optimization recommendations
        recommendations = []
        
        for ad_group_perf in performance_data["ad_groups"]:
            if ad_group_perf["ctr"] < 0.01:  # Low CTR
                recommendations.append({
                    "ad_group_id": ad_group_perf["ad_group_id"],
                    "action": "pause_low_performing_creatives",
                    "reason": "Low CTR detected",
                    "priority": "high"
                })
            elif ad_group_perf["conversion_rate"] < 0.02:  # Low conversion rate
                recommendations.append({
                    "ad_group_id": ad_group_perf["ad_group_id"],
                    "action": "test_new_creatives",
                    "reason": "Low conversion rate detected",
                    "priority": "medium"
                })
            elif ad_group_perf["roas"] > 3.0:  # High ROAS
                recommendations.append({
                    "ad_group_id": ad_group_perf["ad_group_id"],
                    "action": "scale_high_performing_creatives",
                    "reason": "High ROAS detected",
                    "priority": "high"
                })
        
        return {
            "type": "creative_optimization",
            "strategy": "performance_based",
            "recommendations": recommendations,
            "confidence": 0.75
        }
    
    async def _optimize_targeting(
        self,
        campaign: Campaign,
        performance_data: Dict[str, Any],
        optimization_goals: Dict[str, Any],
        constraints: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Optimize targeting parameters."""
        
        # Analyze targeting performance
        targeting_performance = self._analyze_targeting_performance(performance_data)
        
        # Generate targeting optimization recommendations
        recommendations = []
        
        for ad_group_perf in performance_data["ad_groups"]:
            if ad_group_perf["cpa"] > 20:  # High CPA
                recommendations.append({
                    "ad_group_id": ad_group_perf["ad_group_id"],
                    "action": "narrow_targeting",
                    "reason": "High CPA detected",
                    "priority": "high"
                })
            elif ad_group_perf["impressions"] < 1000:  # Low reach
                recommendations.append({
                    "ad_group_id": ad_group_perf["ad_group_id"],
                    "action": "expand_targeting",
                    "reason": "Low reach detected",
                    "priority": "medium"
                })
        
        return {
            "type": "targeting_optimization",
            "strategy": "performance_based",
            "recommendations": recommendations,
            "confidence": 0.8
        }
    
    async def _optimize_schedule(
        self,
        campaign: Campaign,
        performance_data: Dict[str, Any],
        optimization_goals: Dict[str, Any],
        constraints: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Optimize ad scheduling."""
        
        # Analyze time-based performance
        time_performance = self._analyze_time_performance(performance_data)
        
        # Generate schedule optimization recommendations
        recommendations = []
        
        # Find best performing hours
        best_hours = self._find_best_performing_hours(time_performance)
        worst_hours = self._find_worst_performing_hours(time_performance)
        
        if best_hours:
            recommendations.append({
                "action": "increase_budget_during_hours",
                "hours": best_hours,
                "reason": "High performance during these hours",
                "priority": "high"
            })
        
        if worst_hours:
            recommendations.append({
                "action": "decrease_budget_during_hours",
                "hours": worst_hours,
                "reason": "Low performance during these hours",
                "priority": "medium"
            })
        
        return {
            "type": "schedule_optimization",
            "strategy": "time_based",
            "recommendations": recommendations,
            "confidence": 0.7
        }
    
    def _analyze_creative_performance(self, performance_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze creative performance across ad groups."""
        
        creative_metrics = {
            "average_ctr": 0,
            "average_conversion_rate": 0,
            "high_performers": [],
            "low_performers": []
        }
        
        total_ctr = 0
        total_conversion_rate = 0
        ad_group_count = len(performance_data["ad_groups"])
        
        for ad_group_perf in performance_data["ad_groups"]:
            ctr = ad_group_perf["ctr"]
            conversion_rate = ad_group_perf["conversion_rate"]
            
            total_ctr += ctr
            total_conversion_rate += conversion_rate
            
            if ctr > 0.02:  # High CTR
                creative_metrics["high_performers"].append(ad_group_perf["ad_group_id"])
            elif ctr < 0.005:  # Low CTR
                creative_metrics["low_performers"].append(ad_group_perf["ad_group_id"])
        
        if ad_group_count > 0:
            creative_metrics["average_ctr"] = total_ctr / ad_group_count
            creative_metrics["average_conversion_rate"] = total_conversion_rate / ad_group_count
        
        return creative_metrics
    
    def _analyze_targeting_performance(self, performance_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze targeting performance across ad groups."""
        
        targeting_metrics = {
            "average_cpa": 0,
            "average_roas": 0,
            "high_cpa_groups": [],
            "low_roas_groups": []
        }
        
        total_cpa = 0
        total_roas = 0
        ad_group_count = len(performance_data["ad_groups"])
        
        for ad_group_perf in performance_data["ad_groups"]:
            cpa = ad_group_perf["cpa"]
            roas = ad_group_perf["roas"]
            
            total_cpa += cpa
            total_roas += roas
            
            if cpa > 25:  # High CPA
                targeting_metrics["high_cpa_groups"].append(ad_group_perf["ad_group_id"])
            elif roas < 2.0:  # Low ROAS
                targeting_metrics["low_roas_groups"].append(ad_group_perf["ad_group_id"])
        
        if ad_group_count > 0:
            targeting_metrics["average_cpa"] = total_cpa / ad_group_count
            targeting_metrics["average_roas"] = total_roas / ad_group_count
        
        return targeting_metrics
    
    def _analyze_time_performance(self, performance_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze time-based performance (simplified)."""
        
        # In production, this would analyze actual time-based performance data
        # For now, return mock data
        return {
            "hourly_performance": {
                "0": {"ctr": 0.01, "cpa": 20, "conversions": 5},
                "1": {"ctr": 0.008, "cpa": 25, "conversions": 3},
                "2": {"ctr": 0.005, "cpa": 30, "conversions": 1},
                "3": {"ctr": 0.003, "cpa": 35, "conversions": 0},
                "4": {"ctr": 0.002, "cpa": 40, "conversions": 0},
                "5": {"ctr": 0.004, "cpa": 32, "conversions": 1},
                "6": {"ctr": 0.008, "cpa": 22, "conversions": 4},
                "7": {"ctr": 0.012, "cpa": 18, "conversions": 8},
                "8": {"ctr": 0.015, "cpa": 15, "conversions": 12},
                "9": {"ctr": 0.018, "cpa": 12, "conversions": 15},
                "10": {"ctr": 0.020, "cpa": 10, "conversions": 18},
                "11": {"ctr": 0.022, "cpa": 8, "conversions": 20},
                "12": {"ctr": 0.025, "cpa": 7, "conversions": 25},
                "13": {"ctr": 0.028, "cpa": 6, "conversions": 30},
                "14": {"ctr": 0.030, "cpa": 5, "conversions": 35},
                "15": {"ctr": 0.032, "cpa": 4, "conversions": 40},
                "16": {"ctr": 0.030, "cpa": 5, "conversions": 35},
                "17": {"ctr": 0.028, "cpa": 6, "conversions": 30},
                "18": {"ctr": 0.025, "cpa": 7, "conversions": 25},
                "19": {"ctr": 0.022, "cpa": 8, "conversions": 20},
                "20": {"ctr": 0.020, "cpa": 10, "conversions": 18},
                "21": {"ctr": 0.018, "cpa": 12, "conversions": 15},
                "22": {"ctr": 0.015, "cpa": 15, "conversions": 12},
                "23": {"ctr": 0.012, "cpa": 18, "conversions": 8}
            }
        }
    
    def _find_best_performing_hours(self, time_performance: Dict[str, Any]) -> List[int]:
        """Find the best performing hours."""
        
        hourly_perf = time_performance["hourly_performance"]
        best_hours = []
        
        # Find hours with high CTR and low CPA
        for hour, metrics in hourly_perf.items():
            if metrics["ctr"] > 0.02 and metrics["cpa"] < 10:
                best_hours.append(int(hour))
        
        return sorted(best_hours)
    
    def _find_worst_performing_hours(self, time_performance: Dict[str, Any]) -> List[int]:
        """Find the worst performing hours."""
        
        hourly_perf = time_performance["hourly_performance"]
        worst_hours = []
        
        # Find hours with low CTR and high CPA
        for hour, metrics in hourly_perf.items():
            if metrics["ctr"] < 0.01 or metrics["cpa"] > 25:
                worst_hours.append(int(hour))
        
        return sorted(worst_hours)
    
    async def _apply_optimizations(
        self,
        db: Session,
        campaign: Campaign,
        optimizations: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Apply optimization recommendations to the campaign."""
        
        applied_optimizations = []
        
        for optimization in optimizations:
            # Log the optimization
            optimization_log = OptimizationLog(
                id=str(uuid.uuid4()),
                campaign_id=campaign.id,
                action_type=optimization["type"],
                old_value={},
                new_value=optimization["recommendations"],
                reason=f"AI optimization: {optimization['strategy']}",
                timestamp=datetime.utcnow(),
                is_revertible=True
            )
            
            db.add(optimization_log)
            
            applied_optimizations.append({
                "type": optimization["type"],
                "strategy": optimization["strategy"],
                "recommendations": optimization["recommendations"],
                "confidence": optimization["confidence"],
                "applied_at": datetime.utcnow().isoformat()
            })
        
        db.commit()
        
        return applied_optimizations
    
    async def _generate_optimization_insights(
        self,
        campaign: Campaign,
        performance_data: Dict[str, Any],
        applied_optimizations: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Generate insights from the optimization process."""
        
        insights = []
        
        # Performance insights
        if performance_data["average_roas"] > 3.0:
            insights.append({
                "type": "performance_anomaly",
                "message": "Campaign is performing exceptionally well with ROAS > 3.0",
                "recommendation": "Consider scaling budget to capitalize on high performance",
                "severity": "low"
            })
        elif performance_data["average_roas"] < 1.5:
            insights.append({
                "type": "performance_anomaly",
                "message": "Campaign ROAS is below target threshold",
                "recommendation": "Review targeting and creative strategy",
                "severity": "high"
            })
        
        # Budget insights
        if performance_data["total_spend"] > campaign.budget_daily * 0.9:
            insights.append({
                "type": "budget_alert",
                "message": "Campaign is approaching daily budget limit",
                "recommendation": "Monitor performance and consider budget adjustment",
                "severity": "medium"
            })
        
        # Creative insights
        high_performers = [ag for ag in performance_data["ad_groups"] if ag["roas"] > 2.5]
        if len(high_performers) > 0:
            insights.append({
                "type": "creative_opportunity",
                "message": f"Found {len(high_performers)} high-performing ad groups",
                "recommendation": "Scale budget for high-performing creatives",
                "severity": "low"
            })
        
        return insights
    
    def _calculate_performance_improvement(
        self,
        performance_data: Dict[str, Any],
        applied_optimizations: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Calculate expected performance improvement from optimizations."""
        
        # Simplified calculation - in production, use more sophisticated models
        improvement = {
            "expected_roas_increase": 0.0,
            "expected_cpa_reduction": 0.0,
            "expected_conversion_increase": 0.0
        }
        
        for optimization in applied_optimizations:
            if optimization["type"] == "budget_allocation":
                improvement["expected_roas_increase"] += 0.15
            elif optimization["type"] == "bid_strategy":
                improvement["expected_cpa_reduction"] += 0.10
            elif optimization["type"] == "creative_optimization":
                improvement["expected_conversion_increase"] += 0.20
            elif optimization["type"] == "targeting_optimization":
                improvement["expected_cpa_reduction"] += 0.15
            elif optimization["type"] == "schedule_optimization":
                improvement["expected_roas_increase"] += 0.10
        
        return improvement



