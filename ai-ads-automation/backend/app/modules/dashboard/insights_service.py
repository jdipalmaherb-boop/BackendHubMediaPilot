"""
Insights service for AI-powered campaign insights.
"""

import asyncio
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.campaign import Campaign, AdGroup, AdCreative, AdPerformance
from app.models.ai import AIInsight, OptimizationLog


class InsightsService:
    """Service for generating AI-powered insights and recommendations."""
    
    def __init__(self):
        self.logger = get_logger("insights_service")
    
    async def generate_campaign_insights(
        self,
        db: Session,
        campaign_id: str,
        performance_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate AI insights for a campaign."""
        
        try:
            insights = []
            
            # Performance analysis insights
            performance_insights = await self._analyze_performance(
                campaign_id, performance_data
            )
            insights.extend(performance_insights)
            
            # Budget optimization insights
            budget_insights = await self._analyze_budget_optimization(
                campaign_id, performance_data
            )
            insights.extend(budget_insights)
            
            # Creative performance insights
            creative_insights = await self._analyze_creative_performance(
                db, campaign_id, performance_data
            )
            insights.extend(creative_insights)
            
            # Targeting insights
            targeting_insights = await self._analyze_targeting(
                db, campaign_id, performance_data
            )
            insights.extend(targeting_insights)
            
            # Save insights to database
            await self._save_insights(db, campaign_id, insights)
            
            return insights
            
        except Exception as e:
            self.logger.error(f"Error generating campaign insights: {e}")
            raise
    
    async def get_insights_summary(
        self,
        db: Session,
        user_id: str,
        limit: int = 20
    ) -> Dict[str, Any]:
        """Get insights summary for a user."""
        
        try:
            # Get campaigns for user
            campaigns = db.query(Campaign).filter(Campaign.user_id == user_id).all()
            campaign_ids = [c.id for c in campaigns]
            
            if not campaign_ids:
                return {"insights": [], "summary": {}}
            
            # Get recent insights
            recent_insights = db.query(AIInsight).filter(
                AIInsight.campaign_id.in_(campaign_ids)
            ).order_by(AIInsight.generated_at.desc()).limit(limit).all()
            
            # Categorize insights
            insight_categories = {
                "performance": [],
                "budget": [],
                "creative": [],
                "targeting": [],
                "optimization": []
            }
            
            for insight in recent_insights:
                category = self._categorize_insight(insight.insight_type)
                insight_categories[category].append({
                    "id": insight.id,
                    "campaign_id": insight.campaign_id,
                    "type": insight.insight_type,
                    "message": insight.message,
                    "recommendation": insight.recommendation,
                    "severity": insight.severity,
                    "generated_at": insight.generated_at.isoformat(),
                    "is_actionable": insight.is_actionable,
                    "action_taken": insight.action_taken
                })
            
            # Calculate summary statistics
            summary = {
                "total_insights": len(recent_insights),
                "actionable_insights": len([i for i in recent_insights if i.is_actionable]),
                "high_severity": len([i for i in recent_insights if i.severity == "high"]),
                "insights_by_category": {k: len(v) for k, v in insight_categories.items()},
                "recent_actions": await self._get_recent_actions(db, campaign_ids)
            }
            
            return {
                "insights": insight_categories,
                "summary": summary,
                "last_updated": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            self.logger.error(f"Error getting insights summary: {e}")
            raise
    
    async def _analyze_performance(
        self,
        campaign_id: str,
        performance_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Analyze campaign performance and generate insights."""
        
        insights = []
        
        # ROAS analysis
        roas = performance_data.get("roas", 0)
        if roas > 4.0:
            insights.append({
                "type": "performance_anomaly",
                "message": f"Exceptional ROAS of {roas:.2f} detected",
                "recommendation": "Consider scaling budget to capitalize on high performance",
                "severity": "low",
                "is_actionable": True
            })
        elif roas < 1.5:
            insights.append({
                "type": "performance_anomaly",
                "message": f"Low ROAS of {roas:.2f} detected",
                "recommendation": "Review targeting and creative strategy to improve performance",
                "severity": "high",
                "is_actionable": True
            })
        
        # CPA analysis
        cpa = performance_data.get("cpa", 0)
        if cpa > 50:
            insights.append({
                "type": "performance_anomaly",
                "message": f"High CPA of ${cpa:.2f} detected",
                "recommendation": "Optimize targeting and bidding strategy to reduce costs",
                "severity": "high",
                "is_actionable": True
            })
        elif cpa < 10:
            insights.append({
                "type": "performance_anomaly",
                "message": f"Low CPA of ${cpa:.2f} detected",
                "recommendation": "Consider increasing budget to scale successful campaigns",
                "severity": "low",
                "is_actionable": True
            })
        
        # CTR analysis
        ctr = performance_data.get("ctr", 0)
        if ctr < 0.01:
            insights.append({
                "type": "performance_anomaly",
                "message": f"Low CTR of {ctr:.3f} detected",
                "recommendation": "Improve ad creative and targeting relevance",
                "severity": "medium",
                "is_actionable": True
            })
        elif ctr > 0.05:
            insights.append({
                "type": "performance_anomaly",
                "message": f"High CTR of {ctr:.3f} detected",
                "recommendation": "High engagement detected, consider scaling",
                "severity": "low",
                "is_actionable": True
            })
        
        # Conversion rate analysis
        conversion_rate = performance_data.get("conversion_rate", 0)
        if conversion_rate < 0.02:
            insights.append({
                "type": "performance_anomaly",
                "message": f"Low conversion rate of {conversion_rate:.3f} detected",
                "recommendation": "Improve landing page experience and targeting quality",
                "severity": "high",
                "is_actionable": True
            })
        elif conversion_rate > 0.1:
            insights.append({
                "type": "performance_anomaly",
                "message": f"High conversion rate of {conversion_rate:.3f} detected",
                "recommendation": "Excellent conversion performance, consider scaling",
                "severity": "low",
                "is_actionable": True
            })
        
        return insights
    
    async def _analyze_budget_optimization(
        self,
        campaign_id: str,
        performance_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Analyze budget optimization opportunities."""
        
        insights = []
        
        # Budget utilization analysis
        spend = performance_data.get("total_spend", 0)
        impressions = performance_data.get("total_impressions", 0)
        
        if impressions > 0:
            cpm = spend / impressions * 1000
            if cpm > 20:
                insights.append({
                    "type": "budget_optimization",
                    "message": f"High CPM of ${cpm:.2f} detected",
                    "recommendation": "Consider adjusting targeting or creative strategy to reduce costs",
                    "severity": "medium",
                    "is_actionable": True
                })
            elif cpm < 5:
                insights.append({
                    "type": "budget_optimization",
                    "message": f"Low CPM of ${cpm:.2f} detected",
                    "recommendation": "Good cost efficiency, consider increasing budget",
                    "severity": "low",
                    "is_actionable": True
                })
        
        # Budget pacing analysis
        daily_spend = spend / 30  # Assuming 30-day period
        if daily_spend > 100:
            insights.append({
                "type": "budget_optimization",
                "message": f"High daily spend of ${daily_spend:.2f} detected",
                "recommendation": "Monitor budget pacing to avoid overspending",
                "severity": "medium",
                "is_actionable": True
            })
        elif daily_spend < 10:
            insights.append({
                "type": "budget_optimization",
                "message": f"Low daily spend of ${daily_spend:.2f} detected",
                "recommendation": "Consider increasing budget to improve reach",
                "severity": "low",
                "is_actionable": True
            })
        
        return insights
    
    async def _analyze_creative_performance(
        self,
        db: Session,
        campaign_id: str,
        performance_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Analyze creative performance and generate insights."""
        
        insights = []
        
        # Get creative performance data
        ad_groups = db.query(AdGroup).filter(AdGroup.campaign_id == campaign_id).all()
        
        for ad_group in ad_groups:
            creatives = db.query(AdCreative).filter(AdCreative.ad_group_id == ad_group.id).all()
            
            if len(creatives) > 1:
                # Compare creative performance
                creative_performance = []
                for creative in creatives:
                    performance = db.query(AdPerformance).filter(
                        AdPerformance.ad_creative_id == creative.id
                    ).all()
                    
                    total_spend = sum(p.spend for p in performance)
                    total_conversions = sum(p.conversions for p in performance)
                    total_clicks = sum(p.clicks for p in performance)
                    
                    cpa = total_spend / total_conversions if total_conversions > 0 else 0
                    ctr = total_clicks / sum(p.impressions for p in performance) if performance else 0
                    
                    creative_performance.append({
                        "creative_id": creative.id,
                        "name": creative.name,
                        "cpa": cpa,
                        "ctr": ctr,
                        "conversions": total_conversions
                    })
                
                # Find best and worst performing creatives
                creative_performance.sort(key=lambda x: x["cpa"])
                best_creative = creative_performance[0]
                worst_creative = creative_performance[-1]
                
                if best_creative["cpa"] > 0 and worst_creative["cpa"] > 0:
                    cpa_difference = (worst_creative["cpa"] - best_creative["cpa"]) / best_creative["cpa"]
                    
                    if cpa_difference > 0.5:  # 50% difference
                        insights.append({
                            "type": "creative_optimization",
                            "message": f"Significant creative performance difference detected",
                            "recommendation": f"Pause underperforming creative '{worst_creative['name']}' and scale '{best_creative['name']}'",
                            "severity": "medium",
                            "is_actionable": True
                        })
        
        return insights
    
    async def _analyze_targeting(
        self,
        db: Session,
        campaign_id: str,
        performance_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Analyze targeting performance and generate insights."""
        
        insights = []
        
        # Get ad group targeting data
        ad_groups = db.query(AdGroup).filter(AdGroup.campaign_id == campaign_id).all()
        
        for ad_group in ad_groups:
            targeting_criteria = ad_group.targeting_criteria or {}
            
            # Analyze age targeting
            age_min = targeting_criteria.get("age_min", 18)
            age_max = targeting_criteria.get("age_max", 65)
            age_range = age_max - age_min
            
            if age_range > 40:
                insights.append({
                    "type": "targeting_optimization",
                    "message": f"Wide age range of {age_range} years detected",
                    "recommendation": "Consider narrowing age range for better targeting precision",
                    "severity": "low",
                    "is_actionable": True
                })
            elif age_range < 10:
                insights.append({
                    "type": "targeting_optimization",
                    "message": f"Narrow age range of {age_range} years detected",
                    "recommendation": "Consider expanding age range to increase reach",
                    "severity": "low",
                    "is_actionable": True
                })
            
            # Analyze interest targeting
            interests = targeting_criteria.get("interests", [])
            if len(interests) > 10:
                insights.append({
                    "type": "targeting_optimization",
                    "message": f"Many interests ({len(interests)}) targeted",
                    "recommendation": "Reduce number of interests to focus on most relevant audiences",
                    "severity": "low",
                    "is_actionable": True
                })
            elif len(interests) < 3:
                insights.append({
                    "type": "targeting_optimization",
                    "message": f"Few interests ({len(interests)}) targeted",
                    "recommendation": "Add more relevant interests to expand audience reach",
                    "severity": "low",
                    "is_actionable": True
                })
        
        return insights
    
    async def _save_insights(
        self,
        db: Session,
        campaign_id: str,
        insights: List[Dict[str, Any]]
    ):
        """Save insights to database."""
        
        for insight_data in insights:
            insight = AIInsight(
                id=str(uuid.uuid4()),
                campaign_id=campaign_id,
                insight_type=insight_data["type"],
                message=insight_data["message"],
                recommendation=insight_data["recommendation"],
                severity=insight_data["severity"],
                generated_at=datetime.utcnow(),
                is_actionable=insight_data["is_actionable"]
            )
            
            db.add(insight)
        
        db.commit()
    
    def _categorize_insight(self, insight_type: str) -> str:
        """Categorize insight by type."""
        
        if "performance" in insight_type:
            return "performance"
        elif "budget" in insight_type:
            return "budget"
        elif "creative" in insight_type:
            return "creative"
        elif "targeting" in insight_type:
            return "targeting"
        elif "optimization" in insight_type:
            return "optimization"
        else:
            return "performance"
    
    async def _get_recent_actions(
        self,
        db: Session,
        campaign_ids: List[str]
    ) -> List[Dict[str, Any]]:
        """Get recent optimization actions."""
        
        actions = db.query(OptimizationLog).filter(
            OptimizationLog.campaign_id.in_(campaign_ids)
        ).order_by(OptimizationLog.timestamp.desc()).limit(10).all()
        
        return [
            {
                "id": action.id,
                "campaign_id": action.campaign_id,
                "action_type": action.action_type,
                "reason": action.reason,
                "timestamp": action.timestamp.isoformat(),
                "is_revertible": action.is_revertible
            }
            for action in actions
        ]
    
    async def mark_insight_action_taken(
        self,
        db: Session,
        insight_id: str,
        action_taken: str
    ) -> bool:
        """Mark an insight as having action taken."""
        
        try:
            insight = db.query(AIInsight).filter(AIInsight.id == insight_id).first()
            if not insight:
                return False
            
            insight.action_taken = action_taken
            db.commit()
            
            return True
            
        except Exception as e:
            self.logger.error(f"Error marking insight action taken: {e}")
            return False
    
    async def get_insight_recommendations(
        self,
        db: Session,
        campaign_id: str,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """Get actionable insight recommendations for a campaign."""
        
        try:
            insights = db.query(AIInsight).filter(
                AIInsight.campaign_id == campaign_id,
                AIInsight.is_actionable == True,
                AIInsight.action_taken.is_(None)
            ).order_by(AIInsight.generated_at.desc()).limit(limit).all()
            
            return [
                {
                    "id": insight.id,
                    "type": insight.insight_type,
                    "message": insight.message,
                    "recommendation": insight.recommendation,
                    "severity": insight.severity,
                    "generated_at": insight.generated_at.isoformat()
                }
                for insight in insights
            ]
            
        except Exception as e:
            self.logger.error(f"Error getting insight recommendations: {e}")
            return []



