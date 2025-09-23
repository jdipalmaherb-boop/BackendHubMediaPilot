# Dashboard Module

## Overview
The Dashboard module provides backend services for metrics, insights, and reporting. It is designed to support a React frontend with real-time data and controls.

## Features
- **Metrics Calculation**: Calculate and retrieve campaign and portfolio metrics.
- **Insights Generation**: Generate actionable insights and recommendations.
- **Alerts Checking**: Check for performance anomalies and threshold breaches.
- **Report Generation**: Generate comprehensive reports for campaigns and portfolios.

## Architecture
- `service.py`: Main service orchestrating all dashboard functionality.
- `metrics.py`: Service for metrics calculation and retrieval.
- `insights.py`: Service for generating insights and recommendations.
- `alerts.py`: Service for checking alerts and notifications.
- `reports.py`: Service for generating reports.
- `api.py`: FastAPI routes for dashboard services.
- `schemas/dashboard.py`: Pydantic models for request and response validation.

## Setup and Configuration
This module primarily relies on the database for data retrieval and calculation. No specific environment variables are unique to this module beyond the general database configuration.

## API Endpoints

### `POST /api/v1/dashboard/campaign_metrics`
Get metrics for a specific campaign.

- **Request Body (`CampaignMetricsRequest`):**
    ```json
    {
        "campaign_id": "uuid",
        "date_range": {
            "start": "2023-10-01",
            "end": "2023-10-31"
        }
    }
    ```
- **Response Body (`CampaignMetricsResponse`):**
    ```json
    {
        "success": true,
        "campaign_id": "uuid",
        "metrics": {
            "roas": 2.5,
            "cpa": 15.0,
            "ctr": 0.05,
            "cpm": 10.0,
            "spend": 1000.0,
            "conversions": 100
        }
    }
    ```

### `POST /api/v1/dashboard/overview`
Get dashboard overview for a user.

- **Request Body (`DashboardOverviewRequest`):**
    ```json
    {
        "user_id": "uuid",
        "date_range": {
            "start": "2023-10-01",
            "end": "2023-10-31"
        }
    }
    ```
- **Response Body (`DashboardOverviewResponse`):**
    ```json
    {
        "success": true,
        "user_id": "uuid",
        "overview": {
            "total_campaigns": 5,
            "total_spend": 5000.0,
            "total_conversions": 500,
            "average_roas": 2.3,
            "average_cpa": 12.0
        }
    }
    ```

### `POST /api/v1/dashboard/performance_trends`
Get performance trends for a campaign.

- **Request Body (`PerformanceTrendsRequest`):**
    ```json
    {
        "campaign_id": "uuid",
        "days": 30
    }
    ```
- **Response Body (`PerformanceTrendsResponse`):**
    ```json
    {
        "success": true,
        "campaign_id": "uuid",
        "trends": {
            "roas_trend": "increasing",
            "cpa_trend": "decreasing",
            "ctr_trend": "stable",
            "spend_trend": "increasing"
        }
    }
    ```

### `POST /api/v1/dashboard/insights`
Generate insights for a campaign.

- **Request Body (`InsightsRequest`):**
    ```json
    {
        "campaign_id": "uuid",
        "performance_data": {
            "roas": 2.5,
            "cpa": 15.0,
            "ctr": 0.05,
            "cpm": 10.0
        }
    }
    ```
- **Response Body (`InsightsResponse`):**
    ```json
    {
        "success": true,
        "campaign_id": "uuid",
        "insights": {
            "top_performing_creative": "Creative A",
            "best_audience_segment": "Audience B",
            "recommended_budget_adjustment": "Increase by 20%",
            "optimization_opportunities": [
                "Test new creative variations",
                "Expand successful audience segments",
                "Adjust bidding strategy"
            ]
        }
    }
    ```

### `POST /api/v1/dashboard/alerts`
Check for alerts for a campaign.

- **Request Body (`AlertsRequest`):**
    ```json
    {
        "campaign_id": "uuid",
        "performance_data": {
            "roas": 2.5,
            "cpa": 15.0,
            "ctr": 0.05,
            "cpm": 10.0
        }
    }
    ```
- **Response Body (`AlertsResponse`):**
    ```json
    {
        "success": true,
        "campaign_id": "uuid",
        "alerts": {
            "high_cpa_alert": false,
            "low_roas_alert": false,
            "budget_exhaustion_alert": false,
            "performance_anomaly_alert": false
        }
    }
    ```

### `POST /api/v1/dashboard/campaign_report`
Get a comprehensive report for a campaign.

- **Request Body (`CampaignReportRequest`):**
    ```json
    {
        "campaign_id": "uuid",
        "report_type": "comprehensive",
        "date_range": {
            "start": "2023-10-01",
            "end": "2023-10-31"
        }
    }
    ```
- **Response Body (`CampaignReportResponse`):**
    ```json
    {
        "success": true,
        "campaign_id": "uuid",
        "report": {
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
    }
    ```

### `POST /api/v1/dashboard/portfolio_report`
Get a comprehensive report for a user's portfolio.

- **Request Body (`PortfolioReportRequest`):**
    ```json
    {
        "user_id": "uuid",
        "date_range": {
            "start": "2023-10-01",
            "end": "2023-10-31"
        }
    }
    ```
- **Response Body (`PortfolioReportResponse`):**
    ```json
    {
        "success": true,
        "user_id": "uuid",
        "report": {
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
    }
    ```

## How to Extend / Integrate
- **Enhance Metrics Calculation**: Improve `metrics.py` by integrating with more sophisticated data sources and calculation methods.
- **Implement Real Insights Generation**: Improve `insights.py` by integrating with AI/ML models for generating actionable insights.
- **Add More Alert Types**: Extend `alerts.py` to include more types of alerts and notifications.
- **Enhance Report Generation**: Improve `reports.py` by adding more report types and customization options.



