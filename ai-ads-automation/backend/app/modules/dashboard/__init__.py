"""
Dashboard module for real-time metrics and AI insights.
"""

from .metrics_service import MetricsService
from .insights_service import InsightsService
from .alerts_service import AlertsService
from .reports_service import ReportsService

__all__ = [
    "MetricsService",
    "InsightsService",
    "AlertsService",
    "ReportsService"
]



