"""
Metrics service for real-time dashboard data.
"""

import asyncio
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.campaign import Campaign, AdGroup, AdCreative, AdPerformance
from app.models.ai import AIInsight, OptimizationLog


class MetricsService:
    """Service for providing real-time metrics and analytics."""
    
    def __init__(self):
        self.logger = get_logger("metrics_service")
    
    async def get_campaign_metrics(
        self,
        db: Session,
        campaign_id: str,
        date_range: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Get comprehensive metrics for a campaign."""
        
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
            
            # Get ad group metrics
            ad_group_metrics = await self._get_ad_group_metrics(
                db, campaign_id, date_range
            )
            
            # Get creative metrics
            creative_metrics = await self._get_creative_metrics(
                db, campaign_id, date_range
            )
            
            # Calculate summary metrics
            summary_metrics = self._calculate_summary_metrics(performance_data)
            
            # Get AI insights
            ai_insights = await self._get_ai_insights(db, campaign_id)
            
            return {
                "campaign_id": campaign_id,
                "campaign_name": campaign.name,
                "platform": campaign.platform.value,
                "status": campaign.status.value,
                "date_range": date_range,
                "summary_metrics": summary_metrics,
                "ad_group_metrics": ad_group_metrics,
                "creative_metrics": creative_metrics,
                "ai_insights": ai_insights,
                "last_updated": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            self.logger.error(f"Error getting campaign metrics: {e}")
            raise
    
    async def get_dashboard_overview(
        self,
        db: Session,
        user_id: str,
        date_range: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Get overview metrics for the dashboard."""
        
        try:
            # Set default date range if not provided
            if not date_range:
                end_date = datetime.utcnow()
                start_date = end_date - timedelta(days=7)
                date_range = {
                    "start_date": start_date.strftime("%Y-%m-%d"),
                    "end_date": end_date.strftime("%Y-%m-%d")
                }
            
            # Get all campaigns for user
            campaigns = db.query(Campaign).filter(Campaign.user_id == user_id).all()
            
            # Calculate total metrics
            total_metrics = {
                "total_campaigns": len(campaigns),
                "active_campaigns": len([c for c in campaigns if c.status.value == "active"]),
                "total_spend": 0.0,
                "total_impressions": 0,
                "total_clicks": 0,
                "total_conversions": 0,
                "total_conversion_value": 0.0,
                "average_cpa": 0.0,
                "average_roas": 0.0,
                "average_ctr": 0.0,
                "average_conversion_rate": 0.0
            }
            
            # Get performance data for all campaigns
            for campaign in campaigns:
                performance_data = await self._get_performance_data(
                    db, campaign.id, date_range
                )
                
                total_metrics["total_spend"] += performance_data.get("total_spend", 0)
                total_metrics["total_impressions"] += performance_data.get("total_impressions", 0)
                total_metrics["total_clicks"] += performance_data.get("total_clicks", 0)
                total_metrics["total_conversions"] += performance_data.get("total_conversions", 0)
                total_metrics["total_conversion_value"] += performance_data.get("total_conversion_value", 0)
            
            # Calculate averages
            if total_metrics["total_conversions"] > 0:
                total_metrics["average_cpa"] = total_metrics["total_spend"] / total_metrics["total_conversions"]
            
            if total_metrics["total_spend"] > 0:
                total_metrics["average_roas"] = total_metrics["total_conversion_value"] / total_metrics["total_spend"]
            
            if total_metrics["total_impressions"] > 0:
                total_metrics["average_ctr"] = total_metrics["total_clicks"] / total_metrics["total_impressions"]
            
            if total_metrics["total_clicks"] > 0:
                total_metrics["average_conversion_rate"] = total_metrics["total_conversions"] / total_metrics["total_clicks"]
            
            # Get platform breakdown
            platform_breakdown = self._get_platform_breakdown(campaigns)
            
            # Get recent AI insights
            recent_insights = await self._get_recent_insights(db, user_id, limit=10)
            
            # Get performance trends
            performance_trends = await self._get_performance_trends(db, user_id, date_range)
            
            return {
                "user_id": user_id,
                "date_range": date_range,
                "total_metrics": total_metrics,
                "platform_breakdown": platform_breakdown,
                "recent_insights": recent_insights,
                "performance_trends": performance_trends,
                "last_updated": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            self.logger.error(f"Error getting dashboard overview: {e}")
            raise
    
    async def get_performance_trends(
        self,
        db: Session,
        campaign_id: str,
        days: int = 30
    ) -> Dict[str, Any]:
        """Get performance trends for a campaign."""
        
        try:
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=days)
            
            # Get daily performance data
            daily_performance = []
            for i in range(days):
                date = start_date + timedelta(days=i)
                date_str = date.strftime("%Y-%m-%d")
                
                # Get performance for this date
                performance = await self._get_daily_performance(
                    db, campaign_id, date_str
                )
                
                daily_performance.append({
                    "date": date_str,
                    "spend": performance.get("spend", 0),
                    "impressions": performance.get("impressions", 0),
                    "clicks": performance.get("clicks", 0),
                    "conversions": performance.get("conversions", 0),
                    "conversion_value": performance.get("conversion_value", 0),
                    "cpa": performance.get("cpa", 0),
                    "roas": performance.get("roas", 0),
                    "ctr": performance.get("ctr", 0),
                    "conversion_rate": performance.get("conversion_rate", 0)
                })
            
            # Calculate trends
            trends = self._calculate_trends(daily_performance)
            
            return {
                "campaign_id": campaign_id,
                "days": days,
                "daily_performance": daily_performance,
                "trends": trends
            }
            
        except Exception as e:
            self.logger.error(f"Error getting performance trends: {e}")
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
    
    async def _get_ad_group_metrics(
        self,
        db: Session,
        campaign_id: str,
        date_range: Dict[str, str]
    ) -> List[Dict[str, Any]]:
        """Get metrics for all ad groups in a campaign."""
        
        ad_groups = db.query(AdGroup).filter(AdGroup.campaign_id == campaign_id).all()
        ad_group_metrics = []
        
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
            
            ad_group_metrics.append({
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
        
        return ad_group_metrics
    
    async def _get_creative_metrics(
        self,
        db: Session,
        campaign_id: str,
        date_range: Dict[str, str]
    ) -> List[Dict[str, Any]]:
        """Get metrics for all creatives in a campaign."""
        
        # Get creatives through ad groups
        ad_groups = db.query(AdGroup).filter(AdGroup.campaign_id == campaign_id).all()
        creative_metrics = []
        
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
                
                creative_metrics.append({
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
        
        return creative_metrics
    
    def _calculate_summary_metrics(self, performance_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate summary metrics from performance data."""
        
        return {
            "spend": performance_data.get("total_spend", 0),
            "impressions": performance_data.get("total_impressions", 0),
            "clicks": performance_data.get("total_clicks", 0),
            "conversions": performance_data.get("total_conversions", 0),
            "conversion_value": performance_data.get("total_conversion_value", 0),
            "cpa": performance_data.get("cpa", 0),
            "roas": performance_data.get("roas", 0),
            "ctr": performance_data.get("ctr", 0),
            "conversion_rate": performance_data.get("conversion_rate", 0)
        }
    
    async def _get_ai_insights(self, db: Session, campaign_id: str) -> List[Dict[str, Any]]:
        """Get AI insights for a campaign."""
        
        insights = db.query(AIInsight).filter(
            AIInsight.campaign_id == campaign_id
        ).order_by(AIInsight.generated_at.desc()).limit(10).all()
        
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
    
    def _get_platform_breakdown(self, campaigns: List[Campaign]) -> Dict[str, Any]:
        """Get platform breakdown for campaigns."""
        
        platform_counts = {}
        platform_spend = {}
        
        for campaign in campaigns:
            platform = campaign.platform.value
            platform_counts[platform] = platform_counts.get(platform, 0) + 1
            platform_spend[platform] = platform_spend.get(platform, 0) + campaign.budget_daily
        
        return {
            "platform_counts": platform_counts,
            "platform_spend": platform_spend,
            "total_platforms": len(platform_counts)
        }
    
    async def _get_recent_insights(
        self,
        db: Session,
        user_id: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get recent AI insights for a user."""
        
        # Get campaigns for user
        campaigns = db.query(Campaign).filter(Campaign.user_id == user_id).all()
        campaign_ids = [c.id for c in campaigns]
        
        if not campaign_ids:
            return []
        
        # Get recent insights
        insights = db.query(AIInsight).filter(
            AIInsight.campaign_id.in_(campaign_ids)
        ).order_by(AIInsight.generated_at.desc()).limit(limit).all()
        
        return [
            {
                "id": insight.id,
                "campaign_id": insight.campaign_id,
                "type": insight.insight_type,
                "message": insight.message,
                "recommendation": insight.recommendation,
                "severity": insight.severity,
                "generated_at": insight.generated_at.isoformat(),
                "is_actionable": insight.is_actionable
            }
            for insight in insights
        ]
    
    async def _get_performance_trends(
        self,
        db: Session,
        user_id: str,
        date_range: Dict[str, str]
    ) -> Dict[str, Any]:
        """Get performance trends for a user."""
        
        # Get campaigns for user
        campaigns = db.query(Campaign).filter(Campaign.user_id == user_id).all()
        
        # Calculate daily trends
        daily_trends = []
        start_date = datetime.strptime(date_range["start_date"], "%Y-%m-%d")
        end_date = datetime.strptime(date_range["end_date"], "%Y-%m-%d")
        
        current_date = start_date
        while current_date <= end_date:
            date_str = current_date.strftime("%Y-%m-%d")
            
            daily_spend = 0
            daily_conversions = 0
            daily_conversion_value = 0
            
            for campaign in campaigns:
                performance = await self._get_daily_performance(
                    db, campaign.id, date_str
                )
                daily_spend += performance.get("spend", 0)
                daily_conversions += performance.get("conversions", 0)
                daily_conversion_value += performance.get("conversion_value", 0)
            
            daily_trends.append({
                "date": date_str,
                "spend": daily_spend,
                "conversions": daily_conversions,
                "conversion_value": daily_conversion_value,
                "roas": daily_conversion_value / daily_spend if daily_spend > 0 else 0
            })
            
            current_date += timedelta(days=1)
        
        return {
            "daily_trends": daily_trends,
            "trend_direction": self._calculate_trend_direction(daily_trends)
        }
    
    async def _get_daily_performance(
        self,
        db: Session,
        campaign_id: str,
        date: str
    ) -> Dict[str, Any]:
        """Get performance data for a specific date."""
        
        # Get ad groups for campaign
        ad_groups = db.query(AdGroup).filter(AdGroup.campaign_id == campaign_id).all()
        
        total_spend = 0
        total_impressions = 0
        total_clicks = 0
        total_conversions = 0
        total_conversion_value = 0
        
        for ad_group in ad_groups:
            performance = db.query(AdPerformance).filter(
                AdPerformance.ad_group_id == ad_group.id,
                AdPerformance.date == date
            ).all()
            
            for perf in performance:
                total_spend += perf.spend
                total_impressions += perf.impressions
                total_clicks += perf.clicks
                total_conversions += perf.conversions
                total_conversion_value += perf.conversion_value
        
        return {
            "spend": total_spend,
            "impressions": total_impressions,
            "clicks": total_clicks,
            "conversions": total_conversions,
            "conversion_value": total_conversion_value
        }
    
    def _calculate_trends(self, daily_performance: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate trends from daily performance data."""
        
        if len(daily_performance) < 2:
            return {"direction": "stable", "change_percent": 0}
        
        # Calculate trend for key metrics
        recent_days = daily_performance[-7:]  # Last 7 days
        previous_days = daily_performance[-14:-7] if len(daily_performance) >= 14 else daily_performance[:-7]
        
        if not previous_days:
            return {"direction": "stable", "change_percent": 0}
        
        # Calculate average for recent and previous periods
        recent_avg_spend = sum(d["spend"] for d in recent_days) / len(recent_days)
        previous_avg_spend = sum(d["spend"] for d in previous_days) / len(previous_days)
        
        recent_avg_roas = sum(d["roas"] for d in recent_days) / len(recent_days)
        previous_avg_roas = sum(d["roas"] for d in previous_days) / len(previous_days)
        
        # Calculate change percentages
        spend_change = ((recent_avg_spend - previous_avg_spend) / previous_avg_spend * 100) if previous_avg_spend > 0 else 0
        roas_change = ((recent_avg_roas - previous_avg_roas) / previous_avg_roas * 100) if previous_avg_roas > 0 else 0
        
        # Determine overall trend direction
        if abs(spend_change) < 5 and abs(roas_change) < 5:
            direction = "stable"
        elif roas_change > 5:
            direction = "improving"
        elif roas_change < -5:
            direction = "declining"
        else:
            direction = "stable"
        
        return {
            "direction": direction,
            "spend_change_percent": spend_change,
            "roas_change_percent": roas_change,
            "overall_change_percent": (spend_change + roas_change) / 2
        }
    
    def _calculate_trend_direction(self, daily_trends: List[Dict[str, Any]]) -> str:
        """Calculate overall trend direction."""
        
        if len(daily_trends) < 2:
            return "stable"
        
        # Calculate trend for ROAS
        recent_roas = [d["roas"] for d in daily_trends[-7:]]
        previous_roas = [d["roas"] for d in daily_trends[-14:-7]] if len(daily_trends) >= 14 else [d["roas"] for d in daily_trends[:-7]]
        
        if not previous_roas:
            return "stable"
        
        recent_avg_roas = sum(recent_roas) / len(recent_roas)
        previous_avg_roas = sum(previous_roas) / len(previous_roas)
        
        roas_change = ((recent_avg_roas - previous_avg_roas) / previous_avg_roas * 100) if previous_avg_roas > 0 else 0
        
        if roas_change > 5:
            return "improving"
        elif roas_change < -5:
            return "declining"
        else:
            return "stable"



