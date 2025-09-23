"""
FastAPI routes for dashboard services.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.logging import logger
from app.modules.dashboard.service import DashboardService
from app.schemas.dashboard import (
    CampaignMetricsRequest, CampaignMetricsResponse,
    DashboardOverviewRequest, DashboardOverviewResponse,
    PerformanceTrendsRequest, PerformanceTrendsResponse,
    InsightsRequest, InsightsResponse,
    AlertsRequest, AlertsResponse,
    CampaignReportRequest, CampaignReportResponse,
    PortfolioReportRequest, PortfolioReportResponse
)

router = APIRouter()


@router.post("/campaign_metrics", response_model=CampaignMetricsResponse, status_code=status.HTTP_200_OK)
async def get_campaign_metrics(
    request: CampaignMetricsRequest,
    db: Session = Depends(get_db),
    dashboard_service: DashboardService = Depends(DashboardService)
):
    """Get metrics for a specific campaign."""
    logger.info(f"Received request for campaign metrics: {request.campaign_id}")
    try:
        metrics = await dashboard_service.get_campaign_metrics(
            campaign_id=request.campaign_id,
            date_range=request.date_range
        )
        return CampaignMetricsResponse(
            success=True,
            campaign_id=request.campaign_id,
            metrics=metrics
        )
    except Exception as e:
        logger.error(f"Error getting campaign metrics: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get campaign metrics: {e}"
        )


@router.post("/overview", response_model=DashboardOverviewResponse, status_code=status.HTTP_200_OK)
async def get_dashboard_overview(
    request: DashboardOverviewRequest,
    db: Session = Depends(get_db),
    dashboard_service: DashboardService = Depends(DashboardService)
):
    """Get dashboard overview for a user."""
    logger.info(f"Received request for dashboard overview: {request.user_id}")
    try:
        overview = await dashboard_service.get_dashboard_overview(
            user_id=request.user_id,
            date_range=request.date_range
        )
        return DashboardOverviewResponse(
            success=True,
            user_id=request.user_id,
            overview=overview
        )
    except Exception as e:
        logger.error(f"Error getting dashboard overview: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get dashboard overview: {e}"
        )


@router.post("/performance_trends", response_model=PerformanceTrendsResponse, status_code=status.HTTP_200_OK)
async def get_performance_trends(
    request: PerformanceTrendsRequest,
    db: Session = Depends(get_db),
    dashboard_service: DashboardService = Depends(DashboardService)
):
    """Get performance trends for a campaign."""
    logger.info(f"Received request for performance trends: {request.campaign_id}")
    try:
        trends = await dashboard_service.get_performance_trends(
            campaign_id=request.campaign_id,
            days=request.days
        )
        return PerformanceTrendsResponse(
            success=True,
            campaign_id=request.campaign_id,
            trends=trends
        )
    except Exception as e:
        logger.error(f"Error getting performance trends: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get performance trends: {e}"
        )


@router.post("/insights", response_model=InsightsResponse, status_code=status.HTTP_200_OK)
async def generate_insights(
    request: InsightsRequest,
    db: Session = Depends(get_db),
    dashboard_service: DashboardService = Depends(DashboardService)
):
    """Generate insights for a campaign."""
    logger.info(f"Received request for insights: {request.campaign_id}")
    try:
        insights = await dashboard_service.generate_insights(
            campaign_id=request.campaign_id,
            performance_data=request.performance_data
        )
        return InsightsResponse(
            success=True,
            campaign_id=request.campaign_id,
            insights=insights
        )
    except Exception as e:
        logger.error(f"Error generating insights: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate insights: {e}"
        )


@router.post("/alerts", response_model=AlertsResponse, status_code=status.HTTP_200_OK)
async def check_alerts(
    request: AlertsRequest,
    db: Session = Depends(get_db),
    dashboard_service: DashboardService = Depends(DashboardService)
):
    """Check for alerts for a campaign."""
    logger.info(f"Received request for alerts: {request.campaign_id}")
    try:
        alerts = await dashboard_service.check_alerts(
            campaign_id=request.campaign_id,
            performance_data=request.performance_data
        )
        return AlertsResponse(
            success=True,
            campaign_id=request.campaign_id,
            alerts=alerts
        )
    except Exception as e:
        logger.error(f"Error checking alerts: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check alerts: {e}"
        )


@router.post("/campaign_report", response_model=CampaignReportResponse, status_code=status.HTTP_200_OK)
async def get_campaign_report(
    request: CampaignReportRequest,
    db: Session = Depends(get_db),
    dashboard_service: DashboardService = Depends(DashboardService)
):
    """Get a comprehensive report for a campaign."""
    logger.info(f"Received request for campaign report: {request.campaign_id}")
    try:
        report = await dashboard_service.get_campaign_report(
            campaign_id=request.campaign_id,
            report_type=request.report_type,
            date_range=request.date_range
        )
        return CampaignReportResponse(
            success=True,
            campaign_id=request.campaign_id,
            report=report
        )
    except Exception as e:
        logger.error(f"Error getting campaign report: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get campaign report: {e}"
        )


@router.post("/portfolio_report", response_model=PortfolioReportResponse, status_code=status.HTTP_200_OK)
async def get_portfolio_report(
    request: PortfolioReportRequest,
    db: Session = Depends(get_db),
    dashboard_service: DashboardService = Depends(DashboardService)
):
    """Get a comprehensive report for a user's portfolio."""
    logger.info(f"Received request for portfolio report: {request.user_id}")
    try:
        report = await dashboard_service.get_portfolio_report(
            user_id=request.user_id,
            date_range=request.date_range
        )
        return PortfolioReportResponse(
            success=True,
            user_id=request.user_id,
            report=report
        )
    except Exception as e:
        logger.error(f"Error getting portfolio report: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get portfolio report: {e}"
        )