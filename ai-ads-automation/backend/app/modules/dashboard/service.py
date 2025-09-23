"""
Dashboard service for metrics, insights, and reporting.
"""

from typing import Any, Dict, List, Optional
from app.core.logging import logger
from app.modules.dashboard.metrics import MetricsService
from app.modules.dashboard.insights import InsightsService
from app.modules.dashboard.alerts import AlertsService
from app.modules.dashboard.reports import ReportsService


class DashboardService:
    """Service for dashboard functionality."""

    def __init__(
        self,
        metrics_service: Optional[MetricsService] = None,
        insights_service: Optional[InsightsService] = None,
        alerts_service: Optional[AlertsService] = None,
        reports_service: Optional[ReportsService] = None
    ):
        self.metrics_service = metrics_service if metrics_service else MetricsService()
        self.insights_service = insights_service if insights_service else InsightsService()
        self.alerts_service = alerts_service if alerts_service else AlertsService()
        self.reports_service = reports_service if reports_service else ReportsService()
        logger.info("DashboardService initialized.")

    async def get_campaign_metrics(
        self,
        campaign_id: str,
        date_range: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Get metrics for a specific campaign."""
        logger.info(f"Getting metrics for campaign {campaign_id}")
        try:
            metrics = await self.metrics_service.get_campaign_metrics(
                campaign_id=campaign_id,
                date_range=date_range
            )
            return metrics
        except Exception as e:
            logger.error(f"Error getting campaign metrics: {e}", exc_info=True)
            raise

    async def get_dashboard_overview(
        self,
        user_id: str,
        date_range: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Get dashboard overview for a user."""
        logger.info(f"Getting dashboard overview for user {user_id}")
        try:
            overview = await self.metrics_service.get_dashboard_overview(
                user_id=user_id,
                date_range=date_range
            )
            return overview
        except Exception as e:
            logger.error(f"Error getting dashboard overview: {e}", exc_info=True)
            raise

    async def get_performance_trends(
        self,
        campaign_id: str,
        days: int = 30
    ) -> Dict[str, Any]:
        """Get performance trends for a campaign."""
        logger.info(f"Getting performance trends for campaign {campaign_id}")
        try:
            trends = await self.metrics_service.get_performance_trends(
                campaign_id=campaign_id,
                days=days
            )
            return trends
        except Exception as e:
            logger.error(f"Error getting performance trends: {e}", exc_info=True)
            raise

    async def generate_insights(
        self,
        campaign_id: str,
        performance_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate insights for a campaign."""
        logger.info(f"Generating insights for campaign {campaign_id}")
        try:
            insights = await self.insights_service.generate_insights(
                campaign_id=campaign_id,
                performance_data=performance_data
            )
            return insights
        except Exception as e:
            logger.error(f"Error generating insights: {e}", exc_info=True)
            raise

    async def check_alerts(
        self,
        campaign_id: str,
        performance_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Check for alerts for a campaign."""
        logger.info(f"Checking alerts for campaign {campaign_id}")
        try:
            alerts = await self.alerts_service.check_alerts(
                campaign_id=campaign_id,
                performance_data=performance_data
            )
            return alerts
        except Exception as e:
            logger.error(f"Error checking alerts: {e}", exc_info=True)
            raise

    async def get_campaign_report(
        self,
        campaign_id: str,
        report_type: str = "comprehensive",
        date_range: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Get a comprehensive report for a campaign."""
        logger.info(f"Getting campaign report for campaign {campaign_id}")
        try:
            report = await self.reports_service.get_campaign_report(
                campaign_id=campaign_id,
                report_type=report_type,
                date_range=date_range
            )
            return report
        except Exception as e:
            logger.error(f"Error getting campaign report: {e}", exc_info=True)
            raise

    async def get_portfolio_report(
        self,
        user_id: str,
        date_range: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Get a comprehensive report for a user's portfolio."""
        logger.info(f"Getting portfolio report for user {user_id}")
        try:
            report = await self.reports_service.get_portfolio_report(
                user_id=user_id,
                date_range=date_range
            )
            return report
        except Exception as e:
            logger.error(f"Error getting portfolio report: {e}", exc_info=True)
            raise



