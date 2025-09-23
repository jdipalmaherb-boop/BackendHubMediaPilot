"""
Reports service for generating campaign reports.
"""

import asyncio
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.campaign import Campaign, AdGroup, AdCreative, AdPerformance
from app.models.ai import AIInsight, OptimizationLog


class ReportsService:
    """Service for generating campaign reports and analytics."""
    
    def __init__(self):
        self.logger = get_logger("reports_service")
    
    async def generate_campaign_report(
        self,
        db: Session,
        campaign_id: str,
        report_type: str = "comprehensive",
        date_range: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Generate a comprehensive campaign report."""
        
        try:
            # Get campaign details
            campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
            if not campaign:
                raise ValueError(f"Campaign {campaign_id} not found")
            
            # Set default date range if not provided
            if not date_range:
                end_date = datetime.utcnow()
                start_date = end_date - timedelta(days=30)
                date_range = {
                    "start_date": start_date.strftime("%Y-%m-%d"),
                    "end_date": end_date.strftime("%Y-%m-%d")
                }
            
            # Get performance data
            performance_data = await self._get_performance_data(
                db, campaign_id, date_range
            )
            
            # Get ad group performance
            ad_group_performance = await self._get_ad_group_performance(
                db, campaign_id, date_range
            )
            
            # Get creative performance
            creative_performance = await self._get_creative_performance(
                db, campaign_id, date_range
            )
            
            # Get AI insights
            ai_insights = await self._get_ai_insights(db, campaign_id)
            
            # Get optimization history
            optimization_history = await self._get_optimization_history(
                db, campaign_id
            )
            
            # Generate report sections
            report_sections = {
                "executive_summary": await self._generate_executive_summary(
                    campaign, performance_data
                ),
                "performance_analysis": await self._generate_performance_analysis(
                    performance_data, ad_group_performance, creative_performance
                ),
                "ai_insights": await self._generate_ai_insights_section(ai_insights),
                "optimization_history": await self._generate_optimization_history_section(
                    optimization_history
                ),
                "recommendations": await self._generate_recommendations(
                    performance_data, ai_insights
                )
            }
            
            return {
                "campaign_id": campaign_id,
                "campaign_name": campaign.name,
                "platform": campaign.platform.value,
                "status": campaign.status.value,
                "report_type": report_type,
                "date_range": date_range,
                "generated_at": datetime.utcnow().isoformat(),
                "sections": report_sections
            }
            
        except Exception as e:
            self.logger.error(f"Error generating campaign report: {e}")
            raise
    
    async def generate_portfolio_report(
        self,
        db: Session,
        user_id: str,
        date_range: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Generate a portfolio-wide report."""
        
        try:
            # Set default date range if not provided
            if not date_range:
                end_date = datetime.utcnow()
                start_date = end_date - timedelta(days=30)
                date_range = {
                    "start_date": start_date.strftime("%Y-%m-%d"),
                    "end_date": end_date.strftime("%Y-%m-%d")
                }
            
            # Get all campaigns for user
            campaigns = db.query(Campaign).filter(Campaign.user_id == user_id).all()
            
            # Calculate portfolio metrics
            portfolio_metrics = await self._calculate_portfolio_metrics(
                db, campaigns, date_range
            )
            
            # Get platform breakdown
            platform_breakdown = await self._get_platform_breakdown(
                db, campaigns, date_range
            )
            
            # Get performance trends
            performance_trends = await self._get_performance_trends(
                db, campaigns, date_range
            )
            
            # Get top performing campaigns
            top_campaigns = await self._get_top_performing_campaigns(
                db, campaigns, date_range
            )
            
            # Get AI insights summary
            ai_insights_summary = await self._get_ai_insights_summary(
                db, campaigns, date_range
            )
            
            return {
                "user_id": user_id,
                "date_range": date_range,
                "generated_at": datetime.utcnow().isoformat(),
                "portfolio_metrics": portfolio_metrics,
                "platform_breakdown": platform_breakdown,
                "performance_trends": performance_trends,
                "top_campaigns": top_campaigns,
                "ai_insights_summary": ai_insights_summary
            }
            
        except Exception as e:
            self.logger.error(f"Error generating portfolio report: {e}")
            raise
    
    async def _get_performance_data(
        self,
        db: Session,
        campaign_id: str,
        date_range: Dict[str, str]
    ) -> Dict[str, Any]:
        """Get performance data for a campaign."""
        
        # Get ad groups for the campaign
        ad_groups = db.query(AdGroup).filter(AdGroup.campaign_id == campaign_id).all()
        
        total_spend = 0
        total_impressions = 0
        total_clicks = 0
        total_conversions = 0
        total_conversion_value = 0
        
        for ad_group in ad_groups:
            # Get performance data for ad group
            performance = db.query(AdPerformance).filter(
                AdPerformance.ad_group_id == ad_group.id,
                AdPerformance.date >= date_range["start_date"],
                AdPerformance.date <= date_range["end_date"]
            ).all()
            
            for perf in performance:
                total_spend += perf.spend
                total_impressions += perf.impressions
                total_clicks += perf.clicks
                total_conversions += perf.conversions
                total_conversion_value += perf.conversion_value
        
        # Calculate derived metrics
        cpa = total_spend / total_conversions if total_conversions > 0 else 0
        roas = total_conversion_value / total_spend if total_spend > 0 else 0
        ctr = total_clicks / total_impressions if total_impressions > 0 else 0
        conversion_rate = total_conversions / total_clicks if total_clicks > 0 else 0
        
        return {
            "total_spend": total_spend,
            "total_impressions": total_impressions,
            "total_clicks": total_clicks,
            "total_conversions": total_conversions,
            "total_conversion_value": total_conversion_value,
            "cpa": cpa,
            "roas": roas,
            "ctr": ctr,
            "conversion_rate": conversion_rate
        }
    
    async def _get_ad_group_performance(
        self,
        db: Session,
        campaign_id: str,
        date_range: Dict[str, str]
    ) -> List[Dict[str, Any]]:
        """Get performance data for all ad groups in a campaign."""
        
        ad_groups = db.query(AdGroup).filter(AdGroup.campaign_id == campaign_id).all()
        ad_group_performance = []
        
        for ad_group in ad_groups:
            # Get performance data
            performance = db.query(AdPerformance).filter(
                AdPerformance.ad_group_id == ad_group.id,
                AdPerformance.date >= date_range["start_date"],
                AdPerformance.date <= date_range["end_date"]
            ).all()
            
            # Calculate metrics
            total_spend = sum(p.spend for p in performance)
            total_impressions = sum(p.impressions for p in performance)
            total_clicks = sum(p.clicks for p in performance)
            total_conversions = sum(p.conversions for p in performance)
            total_conversion_value = sum(p.conversion_value for p in performance)
            
            cpa = total_spend / total_conversions if total_conversions > 0 else 0
            roas = total_conversion_value / total_spend if total_spend > 0 else 0
            ctr = total_clicks / total_impressions if total_impressions > 0 else 0
            conversion_rate = total_conversions / total_clicks if total_clicks > 0 else 0
            
            ad_group_performance.append({
                "ad_group_id": ad_group.id,
                "name": ad_group.name,
                "platform": ad_group.platform.value,
                "status": ad_group.status.value,
                "spend": total_spend,
                "impressions": total_impressions,
                "clicks": total_clicks,
                "conversions": total_conversions,
                "conversion_value": total_conversion_value,
                "cpa": cpa,
                "roas": roas,
                "ctr": ctr,
                "conversion_rate": conversion_rate
            })
        
        return ad_group_performance
    
    async def _get_creative_performance(
        self,
        db: Session,
        campaign_id: str,
        date_range: Dict[str, str]
    ) -> List[Dict[str, Any]]:
        """Get performance data for all creatives in a campaign."""
        
        # Get creatives through ad groups
        ad_groups = db.query(AdGroup).filter(AdGroup.campaign_id == campaign_id).all()
        creative_performance = []
        
        for ad_group in ad_groups:
            creatives = db.query(AdCreative).filter(AdCreative.ad_group_id == ad_group.id).all()
            
            for creative in creatives:
                # Get performance data
                performance = db.query(AdPerformance).filter(
                    AdPerformance.ad_creative_id == creative.id,
                    AdPerformance.date >= date_range["start_date"],
                    AdPerformance.date <= date_range["end_date"]
                ).all()
                
                # Calculate metrics
                total_spend = sum(p.spend for p in performance)
                total_impressions = sum(p.impressions for p in performance)
                total_clicks = sum(p.clicks for p in performance)
                total_conversions = sum(p.conversions for p in performance)
                total_conversion_value = sum(p.conversion_value for p in performance)
                
                cpa = total_spend / total_conversions if total_conversions > 0 else 0
                roas = total_conversion_value / total_spend if total_spend > 0 else 0
                ctr = total_clicks / total_impressions if total_impressions > 0 else 0
                conversion_rate = total_conversions / total_clicks if total_clicks > 0 else 0
                
                creative_performance.append({
                    "creative_id": creative.id,
                    "name": creative.name,
                    "ad_group_id": creative.ad_group_id,
                    "platform": creative.platform.value,
                    "status": creative.status.value,
                    "spend": total_spend,
                    "impressions": total_impressions,
                    "clicks": total_clicks,
                    "conversions": total_conversions,
                    "conversion_value": total_conversion_value,
                    "cpa": cpa,
                    "roas": roas,
                    "ctr": ctr,
                    "conversion_rate": conversion_rate,
                    "ai_confidence_score": creative.ai_confidence_score
                })
        
        return creative_performance
    
    async def _get_ai_insights(
        self,
        db: Session,
        campaign_id: str
    ) -> List[Dict[str, Any]]:
        """Get AI insights for a campaign."""
        
        insights = db.query(AIInsight).filter(
            AIInsight.campaign_id == campaign_id
        ).order_by(AIInsight.generated_at.desc()).all()
        
        return [
            {
                "id": insight.id,
                "type": insight.insight_type,
                "message": insight.message,
                "recommendation": insight.recommendation,
                "severity": insight.severity,
                "generated_at": insight.generated_at.isoformat(),
                "is_actionable": insight.is_actionable,
                "action_taken": insight.action_taken
            }
            for insight in insights
        ]
    
    async def _get_optimization_history(
        self,
        db: Session,
        campaign_id: str
    ) -> List[Dict[str, Any]]:
        """Get optimization history for a campaign."""
        
        optimizations = db.query(OptimizationLog).filter(
            OptimizationLog.campaign_id == campaign_id
        ).order_by(OptimizationLog.timestamp.desc()).all()
        
        return [
            {
                "id": optimization.id,
                "action_type": optimization.action_type,
                "old_value": optimization.old_value,
                "new_value": optimization.new_value,
                "reason": optimization.reason,
                "timestamp": optimization.timestamp.isoformat(),
                "is_revertible": optimization.is_revertible,
                "reverted_at": optimization.reverted_at.isoformat() if optimization.reverted_at else None
            }
            for optimization in optimizations
        ]
    
    async def _generate_executive_summary(
        self,
        campaign: Campaign,
        performance_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate executive summary for a campaign."""
        
        # Calculate key metrics
        spend = performance_data.get("total_spend", 0)
        conversions = performance_data.get("total_conversions", 0)
        conversion_value = performance_data.get("total_conversion_value", 0)
        roas = performance_data.get("roas", 0)
        cpa = performance_data.get("cpa", 0)
        
        # Determine performance status
        if roas > 3.0:
            status = "excellent"
        elif roas > 2.0:
            status = "good"
        elif roas > 1.5:
            status = "average"
        else:
            status = "needs_improvement"
        
        # Generate summary
        summary = {
            "campaign_name": campaign.name,
            "platform": campaign.platform.value,
            "status": status,
            "key_metrics": {
                "total_spend": spend,
                "conversions": conversions,
                "conversion_value": conversion_value,
                "roas": roas,
                "cpa": cpa
            },
            "performance_highlights": self._get_performance_highlights(performance_data),
            "recommendations": self._get_high_level_recommendations(performance_data)
        }
        
        return summary
    
    async def _generate_performance_analysis(
        self,
        performance_data: Dict[str, Any],
        ad_group_performance: List[Dict[str, Any]],
        creative_performance: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Generate performance analysis section."""
        
        # Analyze ad group performance
        ad_group_analysis = self._analyze_ad_group_performance(ad_group_performance)
        
        # Analyze creative performance
        creative_analysis = self._analyze_creative_performance(creative_performance)
        
        # Calculate performance trends
        trends = self._calculate_performance_trends(performance_data)
        
        return {
            "overall_performance": performance_data,
            "ad_group_analysis": ad_group_analysis,
            "creative_analysis": creative_analysis,
            "trends": trends
        }
    
    async def _generate_ai_insights_section(
        self,
        ai_insights: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Generate AI insights section."""
        
        # Categorize insights
        insight_categories = {
            "performance": [],
            "budget": [],
            "creative": [],
            "targeting": [],
            "optimization": []
        }
        
        for insight in ai_insights:
            category = self._categorize_insight(insight["type"])
            insight_categories[category].append(insight)
        
        # Calculate summary
        total_insights = len(ai_insights)
        actionable_insights = len([i for i in ai_insights if i["is_actionable"]])
        high_severity = len([i for i in ai_insights if i["severity"] == "high"])
        
        return {
            "total_insights": total_insights,
            "actionable_insights": actionable_insights,
            "high_severity": high_severity,
            "insights_by_category": insight_categories,
            "summary": {
                "actionable_rate": (actionable_insights / total_insights * 100) if total_insights > 0 else 0,
                "high_severity_rate": (high_severity / total_insights * 100) if total_insights > 0 else 0
            }
        }
    
    async def _generate_optimization_history_section(
        self,
        optimization_history: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Generate optimization history section."""
        
        # Categorize optimizations
        optimization_categories = {
            "budget_adjustment": [],
            "bid_strategy": [],
            "targeting_update": [],
            "creative_change": [],
            "schedule_optimization": []
        }
        
        for optimization in optimization_history:
            category = optimization["action_type"]
            if category in optimization_categories:
                optimization_categories[category].append(optimization)
        
        # Calculate summary
        total_optimizations = len(optimization_history)
        revertible_optimizations = len([o for o in optimization_history if o["is_revertible"]])
        reverted_optimizations = len([o for o in optimization_history if o["reverted_at"]])
        
        return {
            "total_optimizations": total_optimizations,
            "revertible_optimizations": revertible_optimizations,
            "reverted_optimizations": reverted_optimizations,
            "optimizations_by_category": optimization_categories,
            "summary": {
                "revertible_rate": (revertible_optimizations / total_optimizations * 100) if total_optimizations > 0 else 0,
                "reversion_rate": (reverted_optimizations / total_optimizations * 100) if total_optimizations > 0 else 0
            }
        }
    
    async def _generate_recommendations(
        self,
        performance_data: Dict[str, Any],
        ai_insights: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Generate recommendations based on performance and insights."""
        
        recommendations = []
        
        # Performance-based recommendations
        roas = performance_data.get("roas", 0)
        if roas < 2.0:
            recommendations.append({
                "type": "performance",
                "priority": "high",
                "title": "Improve ROAS",
                "description": "Current ROAS is below target. Focus on optimizing targeting and creative strategy.",
                "actions": [
                    "Review and refine targeting criteria",
                    "Test new ad creatives",
                    "Optimize bidding strategy"
                ]
            })
        
        cpa = performance_data.get("cpa", 0)
        if cpa > 30:
            recommendations.append({
                "type": "performance",
                "priority": "high",
                "title": "Reduce CPA",
                "description": "Current CPA is high. Focus on improving conversion rates and targeting precision.",
                "actions": [
                    "Improve landing page experience",
                    "Refine audience targeting",
                    "Test different ad formats"
                ]
            })
        
        # AI insights-based recommendations
        high_severity_insights = [i for i in ai_insights if i["severity"] == "high"]
        for insight in high_severity_insights:
            recommendations.append({
                "type": "ai_insight",
                "priority": "high",
                "title": f"Address {insight['type']}",
                "description": insight["message"],
                "actions": [insight["recommendation"]]
            })
        
        return recommendations
    
    def _get_performance_highlights(self, performance_data: Dict[str, Any]) -> List[str]:
        """Get performance highlights."""
        
        highlights = []
        
        roas = performance_data.get("roas", 0)
        if roas > 3.0:
            highlights.append(f"Excellent ROAS of {roas:.2f}")
        elif roas > 2.0:
            highlights.append(f"Good ROAS of {roas:.2f}")
        
        cpa = performance_data.get("cpa", 0)
        if cpa < 15:
            highlights.append(f"Low CPA of ${cpa:.2f}")
        
        ctr = performance_data.get("ctr", 0)
        if ctr > 0.03:
            highlights.append(f"High CTR of {ctr:.3f}")
        
        conversion_rate = performance_data.get("conversion_rate", 0)
        if conversion_rate > 0.05:
            highlights.append(f"High conversion rate of {conversion_rate:.3f}")
        
        return highlights
    
    def _get_high_level_recommendations(self, performance_data: Dict[str, Any]) -> List[str]:
        """Get high-level recommendations."""
        
        recommendations = []
        
        roas = performance_data.get("roas", 0)
        if roas < 2.0:
            recommendations.append("Focus on improving ROAS through better targeting and creative optimization")
        
        cpa = performance_data.get("cpa", 0)
        if cpa > 30:
            recommendations.append("Work on reducing CPA by improving conversion rates and targeting precision")
        
        ctr = performance_data.get("ctr", 0)
        if ctr < 0.01:
            recommendations.append("Improve CTR by creating more engaging ad creatives")
        
        conversion_rate = performance_data.get("conversion_rate", 0)
        if conversion_rate < 0.02:
            recommendations.append("Improve conversion rate by optimizing landing page experience")
        
        return recommendations
    
    def _analyze_ad_group_performance(self, ad_group_performance: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze ad group performance."""
        
        if not ad_group_performance:
            return {"analysis": "No ad group performance data available"}
        
        # Find best and worst performing ad groups
        ad_group_performance.sort(key=lambda x: x["roas"], reverse=True)
        best_ad_group = ad_group_performance[0]
        worst_ad_group = ad_group_performance[-1]
        
        # Calculate average metrics
        avg_roas = sum(ag["roas"] for ag in ad_group_performance) / len(ad_group_performance)
        avg_cpa = sum(ag["cpa"] for ag in ad_group_performance) / len(ad_group_performance)
        
        return {
            "total_ad_groups": len(ad_group_performance),
            "best_performing": best_ad_group,
            "worst_performing": worst_ad_group,
            "average_roas": avg_roas,
            "average_cpa": avg_cpa,
            "performance_variance": self._calculate_variance(ad_group_performance, "roas")
        }
    
    def _analyze_creative_performance(self, creative_performance: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze creative performance."""
        
        if not creative_performance:
            return {"analysis": "No creative performance data available"}
        
        # Find best and worst performing creatives
        creative_performance.sort(key=lambda x: x["roas"], reverse=True)
        best_creative = creative_performance[0]
        worst_creative = creative_performance[-1]
        
        # Calculate average metrics
        avg_roas = sum(c["roas"] for c in creative_performance) / len(creative_performance)
        avg_cpa = sum(c["cpa"] for c in creative_performance) / len(creative_performance)
        
        return {
            "total_creatives": len(creative_performance),
            "best_performing": best_creative,
            "worst_performing": worst_creative,
            "average_roas": avg_roas,
            "average_cpa": avg_cpa,
            "performance_variance": self._calculate_variance(creative_performance, "roas")
        }
    
    def _calculate_performance_trends(self, performance_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate performance trends."""
        
        # This is a simplified implementation
        # In production, this would analyze historical data
        
        roas = performance_data.get("roas", 0)
        cpa = performance_data.get("cpa", 0)
        
        # Determine trend direction based on current performance
        if roas > 2.5:
            roas_trend = "improving"
        elif roas < 1.5:
            roas_trend = "declining"
        else:
            roas_trend = "stable"
        
        if cpa < 20:
            cpa_trend = "improving"
        elif cpa > 40:
            cpa_trend = "declining"
        else:
            cpa_trend = "stable"
        
        return {
            "roas_trend": roas_trend,
            "cpa_trend": cpa_trend,
            "overall_trend": "improving" if roas_trend == "improving" and cpa_trend == "improving" else "stable"
        }
    
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
    
    def _calculate_variance(self, data: List[Dict[str, Any]], metric: str) -> float:
        """Calculate variance for a metric."""
        
        if len(data) < 2:
            return 0.0
        
        values = [item[metric] for item in data if metric in item]
        if not values:
            return 0.0
        
        mean = sum(values) / len(values)
        variance = sum((x - mean) ** 2 for x in values) / len(values)
        
        return variance
    
    async def _calculate_portfolio_metrics(
        self,
        db: Session,
        campaigns: List[Campaign],
        date_range: Dict[str, str]
    ) -> Dict[str, Any]:
        """Calculate portfolio-wide metrics."""
        
        total_campaigns = len(campaigns)
        active_campaigns = len([c for c in campaigns if c.status.value == "active"])
        
        total_spend = 0
        total_conversions = 0
        total_conversion_value = 0
        
        for campaign in campaigns:
            performance_data = await self._get_performance_data(
                db, campaign.id, date_range
            )
            
            total_spend += performance_data.get("total_spend", 0)
            total_conversions += performance_data.get("total_conversions", 0)
            total_conversion_value += performance_data.get("total_conversion_value", 0)
        
        # Calculate derived metrics
        cpa = total_spend / total_conversions if total_conversions > 0 else 0
        roas = total_conversion_value / total_spend if total_spend > 0 else 0
        
        return {
            "total_campaigns": total_campaigns,
            "active_campaigns": active_campaigns,
            "total_spend": total_spend,
            "total_conversions": total_conversions,
            "total_conversion_value": total_conversion_value,
            "cpa": cpa,
            "roas": roas
        }
    
    async def _get_platform_breakdown(
        self,
        db: Session,
        campaigns: List[Campaign],
        date_range: Dict[str, str]
    ) -> Dict[str, Any]:
        """Get platform breakdown for campaigns."""
        
        platform_metrics = {}
        
        for campaign in campaigns:
            platform = campaign.platform.value
            if platform not in platform_metrics:
                platform_metrics[platform] = {
                    "campaigns": 0,
                    "spend": 0,
                    "conversions": 0,
                    "conversion_value": 0
                }
            
            platform_metrics[platform]["campaigns"] += 1
            
            performance_data = await self._get_performance_data(
                db, campaign.id, date_range
            )
            
            platform_metrics[platform]["spend"] += performance_data.get("total_spend", 0)
            platform_metrics[platform]["conversions"] += performance_data.get("total_conversions", 0)
            platform_metrics[platform]["conversion_value"] += performance_data.get("total_conversion_value", 0)
        
        # Calculate derived metrics for each platform
        for platform in platform_metrics:
            metrics = platform_metrics[platform]
            if metrics["conversions"] > 0:
                metrics["cpa"] = metrics["spend"] / metrics["conversions"]
            else:
                metrics["cpa"] = 0
            
            if metrics["spend"] > 0:
                metrics["roas"] = metrics["conversion_value"] / metrics["spend"]
            else:
                metrics["roas"] = 0
        
        return platform_metrics
    
    async def _get_performance_trends(
        self,
        db: Session,
        campaigns: List[Campaign],
        date_range: Dict[str, str]
    ) -> Dict[str, Any]:
        """Get performance trends for campaigns."""
        
        # This is a simplified implementation
        # In production, this would analyze historical data
        
        trends = {
            "spend_trend": "stable",
            "conversions_trend": "stable",
            "roas_trend": "stable"
        }
        
        return trends
    
    async def _get_top_performing_campaigns(
        self,
        db: Session,
        campaigns: List[Campaign],
        date_range: Dict[str, str]
    ) -> List[Dict[str, Any]]:
        """Get top performing campaigns."""
        
        campaign_performance = []
        
        for campaign in campaigns:
            performance_data = await self._get_performance_data(
                db, campaign.id, date_range
            )
            
            campaign_performance.append({
                "campaign_id": campaign.id,
                "name": campaign.name,
                "platform": campaign.platform.value,
                "roas": performance_data.get("roas", 0),
                "cpa": performance_data.get("cpa", 0),
                "conversions": performance_data.get("total_conversions", 0),
                "spend": performance_data.get("total_spend", 0)
            })
        
        # Sort by ROAS
        campaign_performance.sort(key=lambda x: x["roas"], reverse=True)
        
        return campaign_performance[:10]  # Top 10
    
    async def _get_ai_insights_summary(
        self,
        db: Session,
        campaigns: List[Campaign],
        date_range: Dict[str, str]
    ) -> Dict[str, Any]:
        """Get AI insights summary for campaigns."""
        
        campaign_ids = [c.id for c in campaigns]
        
        # Get insights in date range
        start_date = datetime.strptime(date_range["start_date"], "%Y-%m-%d")
        end_date = datetime.strptime(date_range["end_date"], "%Y-%m-%d")
        
        insights = db.query(AIInsight).filter(
            AIInsight.campaign_id.in_(campaign_ids),
            AIInsight.generated_at >= start_date,
            AIInsight.generated_at <= end_date
        ).all()
        
        # Categorize insights
        insight_categories = {
            "performance": [],
            "budget": [],
            "creative": [],
            "targeting": [],
            "optimization": []
        }
        
        for insight in insights:
            category = self._categorize_insight(insight.insight_type)
            insight_categories[category].append(insight)
        
        return {
            "total_insights": len(insights),
            "insights_by_category": {k: len(v) for k, v in insight_categories.items()},
            "actionable_insights": len([i for i in insights if i.is_actionable]),
            "high_severity": len([i for i in insights if i.severity == "high"])
        }



