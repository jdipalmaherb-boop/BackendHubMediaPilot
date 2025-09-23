"""
Tests for the Dashboard Service module.
"""

import pytest
from unittest.mock import Mock, patch
from app.modules.dashboard.service import DashboardService
from app.modules.dashboard.metrics import MetricsService
from app.modules.dashboard.insights import InsightsService
from app.modules.dashboard.alerts import AlertsService
from app.modules.dashboard.reports import ReportsService


class TestDashboardService:
    """Test cases for DashboardService."""

    @pytest.fixture
    def mock_metrics_service(self):
        """Mock metrics service for testing."""
        service = Mock(spec=MetricsService)
        service.get_campaign_metrics.return_value = {
            "roas": 2.5,
            "cpa": 15.0,
            "ctr": 0.05,
            "cpm": 10.0
        }
        service.get_dashboard_overview.return_value = {
            "total_campaigns": 5,
            "total_spend": 5000.0,
            "total_conversions": 500,
            "average_roas": 2.3,
            "average_cpa": 12.0
        }
        service.get_performance_trends.return_value = {
            "roas_trend": "increasing",
            "cpa_trend": "decreasing",
            "ctr_trend": "stable",
            "spend_trend": "increasing"
        }
        return service

    @pytest.fixture
    def mock_insights_service(self):
        """Mock insights service for testing."""
        service = Mock(spec=InsightsService)
        service.generate_insights.return_value = {
            "top_performing_creative": "Creative A",
            "best_audience_segment": "Audience B",
            "recommended_budget_adjustment": "Increase by 20%",
            "optimization_opportunities": [
                "Test new creative variations",
                "Expand successful audience segments",
                "Adjust bidding strategy"
            ]
        }
        return service

    @pytest.fixture
    def mock_alerts_service(self):
        """Mock alerts service for testing."""
        service = Mock(spec=AlertsService)
        service.check_alerts.return_value = {
            "high_cpa_alert": False,
            "low_roas_alert": False,
            "budget_exhaustion_alert": False,
            "performance_anomaly_alert": False
        }
        return service

    @pytest.fixture
    def mock_reports_service(self):
        """Mock reports service for testing."""
        service = Mock(spec=ReportsService)
        service.get_campaign_report.return_value = {
            "summary": "Campaign performing well with ROAS of 2.5",
            "metrics": {
                "roas": 2.5,
                "cpa": 15.0,
                "ctr": 0.05,
                "cpm": 10.0
            },
            "recommendations": [
                "Increase budget for top-performing ad groups",
                "Test new creative variations",
                "Expand successful audience segments"
            ]
        }
        service.get_portfolio_report.return_value = {
            "summary": "Portfolio performing well with average ROAS of 2.3",
            "metrics": {
                "total_campaigns": 5,
                "total_spend": 5000.0,
                "total_conversions": 500,
                "average_roas": 2.3,
                "average_cpa": 12.0
            },
            "recommendations": [
                "Scale successful campaigns",
                "Optimize underperforming campaigns",
                "Test new campaign strategies"
            ]
        }
        return service

    @pytest.fixture
    def dashboard_service(self, mock_metrics_service, mock_insights_service, mock_alerts_service, mock_reports_service):
        """DashboardService instance with mocked dependencies."""
        return DashboardService(
            metrics_service=mock_metrics_service,
            insights_service=mock_insights_service,
            alerts_service=mock_alerts_service,
            reports_service=mock_reports_service
        )

    @pytest.mark.asyncio
    async def test_get_campaign_metrics(self, dashboard_service):
        """Test getting campaign metrics."""
        result = await dashboard_service.get_campaign_metrics(
            campaign_id="test_campaign",
            date_range={"start": "2023-10-01", "end": "2023-10-31"}
        )

        assert result["roas"] == 2.5
        assert result["cpa"] == 15.0
        assert result["ctr"] == 0.05
        assert result["cpm"] == 10.0

    @pytest.mark.asyncio
    async def test_get_dashboard_overview(self, dashboard_service):
        """Test getting dashboard overview."""
        result = await dashboard_service.get_dashboard_overview(
            user_id="test_user",
            date_range={"start": "2023-10-01", "end": "2023-10-31"}
        )

        assert result["total_campaigns"] == 5
        assert result["total_spend"] == 5000.0
        assert result["total_conversions"] == 500
        assert result["average_roas"] == 2.3
        assert result["average_cpa"] == 12.0

    @pytest.mark.asyncio
    async def test_get_performance_trends(self, dashboard_service):
        """Test getting performance trends."""
        result = await dashboard_service.get_performance_trends(
            campaign_id="test_campaign",
            days=30
        )

        assert result["roas_trend"] == "increasing"
        assert result["cpa_trend"] == "decreasing"
        assert result["ctr_trend"] == "stable"
        assert result["spend_trend"] == "increasing"

    @pytest.mark.asyncio
    async def test_generate_insights(self, dashboard_service):
        """Test generating insights."""
        result = await dashboard_service.generate_insights(
            campaign_id="test_campaign",
            performance_data={"roas": 2.5, "cpa": 15.0}
        )

        assert result["top_performing_creative"] == "Creative A"
        assert result["best_audience_segment"] == "Audience B"
        assert result["recommended_budget_adjustment"] == "Increase by 20%"
        assert len(result["optimization_opportunities"]) > 0

    @pytest.mark.asyncio
    async def test_check_alerts(self, dashboard_service):
        """Test checking alerts."""
        result = await dashboard_service.check_alerts(
            campaign_id="test_campaign",
            performance_data={"roas": 2.5, "cpa": 15.0}
        )

        assert result["high_cpa_alert"] == False
        assert result["low_roas_alert"] == False
        assert result["budget_exhaustion_alert"] == False
        assert result["performance_anomaly_alert"] == False

    @pytest.mark.asyncio
    async def test_get_campaign_report(self, dashboard_service):
        """Test getting campaign report."""
        result = await dashboard_service.get_campaign_report(
            campaign_id="test_campaign",
            report_type="comprehensive",
            date_range={"start": "2023-10-01", "end": "2023-10-31"}
        )

        assert result["summary"] == "Campaign performing well with ROAS of 2.5"
        assert result["metrics"]["roas"] == 2.5
        assert result["metrics"]["cpa"] == 15.0
        assert len(result["recommendations"]) > 0

    @pytest.mark.asyncio
    async def test_get_portfolio_report(self, dashboard_service):
        """Test getting portfolio report."""
        result = await dashboard_service.get_portfolio_report(
            user_id="test_user",
            date_range={"start": "2023-10-01", "end": "2023-10-31"}
        )

        assert result["summary"] == "Portfolio performing well with average ROAS of 2.3"
        assert result["metrics"]["total_campaigns"] == 5
        assert result["metrics"]["total_spend"] == 5000.0
        assert len(result["recommendations"]) > 0

    @pytest.mark.asyncio
    async def test_get_campaign_metrics_exception(self, dashboard_service):
        """Test handling exception during getting campaign metrics."""
        dashboard_service.metrics_service.get_campaign_metrics.side_effect = Exception("Metrics error")

        with pytest.raises(Exception):
            await dashboard_service.get_campaign_metrics(
                campaign_id="test_campaign",
                date_range={"start": "2023-10-01", "end": "2023-10-31"}
            )

    @pytest.mark.asyncio
    async def test_generate_insights_exception(self, dashboard_service):
        """Test handling exception during generating insights."""
        dashboard_service.insights_service.generate_insights.side_effect = Exception("Insights error")

        with pytest.raises(Exception):
            await dashboard_service.generate_insights(
                campaign_id="test_campaign",
                performance_data={"roas": 2.5, "cpa": 15.0}
            )



