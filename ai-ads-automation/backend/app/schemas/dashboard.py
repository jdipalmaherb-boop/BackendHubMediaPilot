"""
Pydantic schemas for dashboard services.
"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class CampaignMetricsRequest(BaseModel):
    """Request schema for campaign metrics."""
    
    campaign_id: str = Field(..., description="ID of the campaign to get metrics for")
    date_range: Optional[Dict[str, str]] = Field(None, description="Date range for metrics")


class CampaignMetricsResponse(BaseModel):
    """Response schema for campaign metrics."""
    
    success: bool = Field(..., description="Whether the request was successful")
    campaign_id: str = Field(..., description="ID of the campaign")
    metrics: Dict[str, Any] = Field(..., description="Campaign metrics data")


class DashboardOverviewRequest(BaseModel):
    """Request schema for dashboard overview."""
    
    user_id: str = Field(..., description="ID of the user")
    date_range: Optional[Dict[str, str]] = Field(None, description="Date range for overview")


class DashboardOverviewResponse(BaseModel):
    """Response schema for dashboard overview."""
    
    success: bool = Field(..., description="Whether the request was successful")
    user_id: str = Field(..., description="ID of the user")
    overview: Dict[str, Any] = Field(..., description="Dashboard overview data")


class PerformanceTrendsRequest(BaseModel):
    """Request schema for performance trends."""
    
    campaign_id: str = Field(..., description="ID of the campaign")
    days: int = Field(default=30, description="Number of days for trends")


class PerformanceTrendsResponse(BaseModel):
    """Response schema for performance trends."""
    
    success: bool = Field(..., description="Whether the request was successful")
    campaign_id: str = Field(..., description="ID of the campaign")
    trends: Dict[str, Any] = Field(..., description="Performance trends data")


class InsightsRequest(BaseModel):
    """Request schema for generating insights."""
    
    campaign_id: str = Field(..., description="ID of the campaign")
    performance_data: Dict[str, Any] = Field(..., description="Performance data for analysis")


class InsightsResponse(BaseModel):
    """Response schema for insights."""
    
    success: bool = Field(..., description="Whether the request was successful")
    campaign_id: Optional[str] = Field(None, description="ID of the campaign")
    user_id: Optional[str] = Field(None, description="ID of the user")
    insights: Dict[str, Any] = Field(..., description="Insights data")


class AlertsRequest(BaseModel):
    """Request schema for checking alerts."""
    
    campaign_id: str = Field(..., description="ID of the campaign")
    performance_data: Dict[str, Any] = Field(..., description="Performance data for analysis")


class AlertsResponse(BaseModel):
    """Response schema for alerts."""
    
    success: bool = Field(..., description="Whether the request was successful")
    campaign_id: Optional[str] = Field(None, description="ID of the campaign")
    user_id: Optional[str] = Field(None, description="ID of the user")
    alerts: Dict[str, Any] = Field(..., description="Alerts data")


class CampaignReportRequest(BaseModel):
    """Request schema for campaign report."""
    
    campaign_id: str = Field(..., description="ID of the campaign")
    report_type: str = Field(default="comprehensive", description="Type of report")
    date_range: Optional[Dict[str, str]] = Field(None, description="Date range for report")


class CampaignReportResponse(BaseModel):
    """Response schema for campaign report."""
    
    success: bool = Field(..., description="Whether the request was successful")
    campaign_id: str = Field(..., description="ID of the campaign")
    report: Dict[str, Any] = Field(..., description="Campaign report data")


class PortfolioReportRequest(BaseModel):
    """Request schema for portfolio report."""
    
    user_id: str = Field(..., description="ID of the user")
    date_range: Optional[Dict[str, str]] = Field(None, description="Date range for report")


class PortfolioReportResponse(BaseModel):
    """Response schema for portfolio report."""
    
    success: bool = Field(..., description="Whether the request was successful")
    user_id: str = Field(..., description="ID of the user")
    report: Dict[str, Any] = Field(..., description="Portfolio report data")



