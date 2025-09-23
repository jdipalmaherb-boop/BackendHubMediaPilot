"""
Alerts service for monitoring and notifications.
"""

import asyncio
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.campaign import Campaign, AdGroup, AdCreative, AdPerformance
from app.models.ai import AIInsight


class AlertsService:
    """Service for managing alerts and notifications."""
    
    def __init__(self):
        self.logger = get_logger("alerts_service")
        self.alert_thresholds = {
            "high_cpa": 50.0,
            "low_roas": 1.5,
            "low_ctr": 0.01,
            "low_conversion_rate": 0.02,
            "high_spend": 1000.0,
            "low_impressions": 1000
        }
    
    async def check_campaign_alerts(
        self,
        db: Session,
        campaign_id: str,
        performance_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Check for alerts on a campaign."""
        
        try:
            alerts = []
            
            # Performance alerts
            performance_alerts = await self._check_performance_alerts(
                campaign_id, performance_data
            )
            alerts.extend(performance_alerts)
            
            # Budget alerts
            budget_alerts = await self._check_budget_alerts(
                campaign_id, performance_data
            )
            alerts.extend(budget_alerts)
            
            # Creative alerts
            creative_alerts = await self._check_creative_alerts(
                db, campaign_id, performance_data
            )
            alerts.extend(creative_alerts)
            
            # Targeting alerts
            targeting_alerts = await self._check_targeting_alerts(
                db, campaign_id, performance_data
            )
            alerts.extend(targeting_alerts)
            
            return alerts
            
        except Exception as e:
            self.logger.error(f"Error checking campaign alerts: {e}")
            raise
    
    async def get_user_alerts(
        self,
        db: Session,
        user_id: str,
        limit: int = 50
    ) -> Dict[str, Any]:
        """Get all alerts for a user."""
        
        try:
            # Get campaigns for user
            campaigns = db.query(Campaign).filter(Campaign.user_id == user_id).all()
            campaign_ids = [c.id for c in campaigns]
            
            if not campaign_ids:
                return {"alerts": [], "summary": {}}
            
            # Get recent insights (used as alerts)
            recent_insights = db.query(AIInsight).filter(
                AIInsight.campaign_id.in_(campaign_ids),
                AIInsight.severity.in_(["high", "critical"])
            ).order_by(AIInsight.generated_at.desc()).limit(limit).all()
            
            # Convert insights to alerts
            alerts = []
            for insight in recent_insights:
                alert = {
                    "id": insight.id,
                    "campaign_id": insight.campaign_id,
                    "type": insight.insight_type,
                    "message": insight.message,
                    "recommendation": insight.recommendation,
                    "severity": insight.severity,
                    "generated_at": insight.generated_at.isoformat(),
                    "is_actionable": insight.is_actionable,
                    "action_taken": insight.action_taken
                }
                alerts.append(alert)
            
            # Categorize alerts
            alert_categories = {
                "critical": [],
                "high": [],
                "medium": [],
                "low": []
            }
            
            for alert in alerts:
                severity = alert["severity"]
                if severity in alert_categories:
                    alert_categories[severity].append(alert)
            
            # Calculate summary
            summary = {
                "total_alerts": len(alerts),
                "critical_alerts": len(alert_categories["critical"]),
                "high_alerts": len(alert_categories["high"]),
                "medium_alerts": len(alert_categories["medium"]),
                "low_alerts": len(alert_categories["low"]),
                "actionable_alerts": len([a for a in alerts if a["is_actionable"]]),
                "unresolved_alerts": len([a for a in alerts if not a["action_taken"]])
            }
            
            return {
                "alerts": alert_categories,
                "summary": summary,
                "last_updated": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            self.logger.error(f"Error getting user alerts: {e}")
            raise
    
    async def _check_performance_alerts(
        self,
        campaign_id: str,
        performance_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Check for performance-related alerts."""
        
        alerts = []
        
        # CPA alert
        cpa = performance_data.get("cpa", 0)
        if cpa > self.alert_thresholds["high_cpa"]:
            alerts.append({
                "type": "performance_alert",
                "message": f"High CPA of ${cpa:.2f} detected",
                "recommendation": "Optimize targeting and bidding strategy to reduce costs",
                "severity": "high",
                "is_actionable": True
            })
        
        # ROAS alert
        roas = performance_data.get("roas", 0)
        if roas < self.alert_thresholds["low_roas"]:
            alerts.append({
                "type": "performance_alert",
                "message": f"Low ROAS of {roas:.2f} detected",
                "recommendation": "Review targeting and creative strategy to improve performance",
                "severity": "high",
                "is_actionable": True
            })
        
        # CTR alert
        ctr = performance_data.get("ctr", 0)
        if ctr < self.alert_thresholds["low_ctr"]:
            alerts.append({
                "type": "performance_alert",
                "message": f"Low CTR of {ctr:.3f} detected",
                "recommendation": "Improve ad creative and targeting relevance",
                "severity": "medium",
                "is_actionable": True
            })
        
        # Conversion rate alert
        conversion_rate = performance_data.get("conversion_rate", 0)
        if conversion_rate < self.alert_thresholds["low_conversion_rate"]:
            alerts.append({
                "type": "performance_alert",
                "message": f"Low conversion rate of {conversion_rate:.3f} detected",
                "recommendation": "Improve landing page experience and targeting quality",
                "severity": "high",
                "is_actionable": True
            })
        
        return alerts
    
    async def _check_budget_alerts(
        self,
        campaign_id: str,
        performance_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Check for budget-related alerts."""
        
        alerts = []
        
        # High spend alert
        spend = performance_data.get("total_spend", 0)
        if spend > self.alert_thresholds["high_spend"]:
            alerts.append({
                "type": "budget_alert",
                "message": f"High spend of ${spend:.2f} detected",
                "recommendation": "Monitor budget pacing to avoid overspending",
                "severity": "medium",
                "is_actionable": True
            })
        
        # Low impressions alert
        impressions = performance_data.get("total_impressions", 0)
        if impressions < self.alert_thresholds["low_impressions"]:
            alerts.append({
                "type": "budget_alert",
                "message": f"Low impressions of {impressions} detected",
                "recommendation": "Consider increasing budget or expanding targeting",
                "severity": "medium",
                "is_actionable": True
            })
        
        return alerts
    
    async def _check_creative_alerts(
        self,
        db: Session,
        campaign_id: str,
        performance_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Check for creative-related alerts."""
        
        alerts = []
        
        # Get creative performance data
        ad_groups = db.query(AdGroup).filter(AdGroup.campaign_id == campaign_id).all()
        
        for ad_group in ad_groups:
            creatives = db.query(AdCreative).filter(AdCreative.ad_group_id == ad_group.id).all()
            
            if len(creatives) > 1:
                # Check for creative performance differences
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
                
                # Find underperforming creatives
                for creative in creative_performance:
                    if creative["cpa"] > 100:  # Very high CPA
                        alerts.append({
                            "type": "creative_alert",
                            "message": f"Creative '{creative['name']}' has very high CPA of ${creative['cpa']:.2f}",
                            "recommendation": "Consider pausing this creative",
                            "severity": "high",
                            "is_actionable": True
                        })
                    elif creative["ctr"] < 0.005:  # Very low CTR
                        alerts.append({
                            "type": "creative_alert",
                            "message": f"Creative '{creative['name']}' has very low CTR of {creative['ctr']:.3f}",
                            "recommendation": "Consider updating this creative",
                            "severity": "medium",
                            "is_actionable": True
                        })
        
        return alerts
    
    async def _check_targeting_alerts(
        self,
        db: Session,
        campaign_id: str,
        performance_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Check for targeting-related alerts."""
        
        alerts = []
        
        # Get ad group targeting data
        ad_groups = db.query(AdGroup).filter(AdGroup.campaign_id == campaign_id).all()
        
        for ad_group in ad_groups:
            targeting_criteria = ad_group.targeting_criteria or {}
            
            # Check for overly broad targeting
            age_min = targeting_criteria.get("age_min", 18)
            age_max = targeting_criteria.get("age_max", 65)
            age_range = age_max - age_min
            
            if age_range > 50:
                alerts.append({
                    "type": "targeting_alert",
                    "message": f"Very wide age range of {age_range} years detected",
                    "recommendation": "Consider narrowing age range for better targeting precision",
                    "severity": "low",
                    "is_actionable": True
                })
            
            # Check for too many interests
            interests = targeting_criteria.get("interests", [])
            if len(interests) > 20:
                alerts.append({
                    "type": "targeting_alert",
                    "message": f"Too many interests ({len(interests)}) targeted",
                    "recommendation": "Reduce number of interests to focus on most relevant audiences",
                    "severity": "low",
                    "is_actionable": True
                })
            
            # Check for missing exclusions
            if not targeting_criteria.get("exclusions"):
                alerts.append({
                    "type": "targeting_alert",
                    "message": "No exclusions set for targeting",
                    "recommendation": "Consider adding exclusions to filter out irrelevant audiences",
                    "severity": "low",
                    "is_actionable": True
                })
        
        return alerts
    
    async def create_alert(
        self,
        db: Session,
        campaign_id: str,
        alert_type: str,
        message: str,
        recommendation: str,
        severity: str = "medium",
        is_actionable: bool = True
    ) -> bool:
        """Create a new alert."""
        
        try:
            # Create insight as alert
            insight = AIInsight(
                id=str(uuid.uuid4()),
                campaign_id=campaign_id,
                insight_type=alert_type,
                message=message,
                recommendation=recommendation,
                severity=severity,
                generated_at=datetime.utcnow(),
                is_actionable=is_actionable
            )
            
            db.add(insight)
            db.commit()
            
            return True
            
        except Exception as e:
            self.logger.error(f"Error creating alert: {e}")
            return False
    
    async def resolve_alert(
        self,
        db: Session,
        alert_id: str,
        resolution: str
    ) -> bool:
        """Resolve an alert."""
        
        try:
            insight = db.query(AIInsight).filter(AIInsight.id == alert_id).first()
            if not insight:
                return False
            
            insight.action_taken = resolution
            db.commit()
            
            return True
            
        except Exception as e:
            self.logger.error(f"Error resolving alert: {e}")
            return False
    
    async def get_alert_statistics(
        self,
        db: Session,
        user_id: str,
        days: int = 30
    ) -> Dict[str, Any]:
        """Get alert statistics for a user."""
        
        try:
            # Get campaigns for user
            campaigns = db.query(Campaign).filter(Campaign.user_id == user_id).all()
            campaign_ids = [c.id for c in campaigns]
            
            if not campaign_ids:
                return {"statistics": {}}
            
            # Get date range
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=days)
            
            # Get insights in date range
            insights = db.query(AIInsight).filter(
                AIInsight.campaign_id.in_(campaign_ids),
                AIInsight.generated_at >= start_date,
                AIInsight.generated_at <= end_date
            ).all()
            
            # Calculate statistics
            total_alerts = len(insights)
            critical_alerts = len([i for i in insights if i.severity == "critical"])
            high_alerts = len([i for i in insights if i.severity == "high"])
            medium_alerts = len([i for i in insights if i.severity == "medium"])
            low_alerts = len([i for i in insights if i.severity == "low"])
            
            actionable_alerts = len([i for i in insights if i.is_actionable])
            resolved_alerts = len([i for i in insights if i.action_taken])
            unresolved_alerts = total_alerts - resolved_alerts
            
            # Calculate resolution rate
            resolution_rate = (resolved_alerts / total_alerts * 100) if total_alerts > 0 else 0
            
            return {
                "statistics": {
                    "total_alerts": total_alerts,
                    "critical_alerts": critical_alerts,
                    "high_alerts": high_alerts,
                    "medium_alerts": medium_alerts,
                    "low_alerts": low_alerts,
                    "actionable_alerts": actionable_alerts,
                    "resolved_alerts": resolved_alerts,
                    "unresolved_alerts": unresolved_alerts,
                    "resolution_rate": resolution_rate,
                    "days": days
                }
            }
            
        except Exception as e:
            self.logger.error(f"Error getting alert statistics: {e}")
            return {"statistics": {}}
    
    def update_alert_thresholds(self, new_thresholds: Dict[str, float]):
        """Update alert thresholds."""
        
        self.alert_thresholds.update(new_thresholds)
        self.logger.info(f"Updated alert thresholds: {new_thresholds}")
    
    def get_alert_thresholds(self) -> Dict[str, float]:
        """Get current alert thresholds."""
        
        return self.alert_thresholds.copy()



