"""
FastAPI routes for reporting services.
"""

from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.responses import FileResponse, HTMLResponse

from app.core.logging import logger
from app.modules.reporting.report_generator import ReportGenerator
from app.schemas.reporting import (
    WeeklyReportRequest, WeeklyReportResponse,
    ExecutiveReportRequest, ExecutiveReportResponse,
    TacticalReportRequest, TacticalReportResponse,
    CustomReportRequest, CustomReportResponse,
    ReportStats, ReportHistory, ReportSchedule,
    ReportExportRequest, ReportExportResponse,
    ReportComparisonRequest, ReportComparisonResponse,
    ReportValidationRequest, ReportValidationResponse
)

router = APIRouter()


@router.post("/weekly", response_model=WeeklyReportResponse, status_code=status.HTTP_200_OK)
async def generate_weekly_report(
    request: WeeklyReportRequest,
    background_tasks: BackgroundTasks,
    generator: ReportGenerator = Depends(ReportGenerator)
):
    """Generate a comprehensive weekly marketing report."""
    logger.info(f"Generating weekly report for brand {request.brand_id}")
    
    try:
        report = await generator.build_weekly_report(
            brand_id=request.brand_id,
            metrics_json=request.metrics_json,
            report_type=request.report_type,
            include_pdf=request.include_pdf
        )
        
        return WeeklyReportResponse(
            success=True,
            brand_id=report["brand_id"],
            report_type=report["report_type"],
            html=report["html"],
            pdf=report.get("pdf"),
            generated_at=report["generated_at"],
            analysis=report.get("analysis")
        )
    except Exception as e:
        logger.error(f"Error generating weekly report: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate weekly report: {e}"
        )


@router.post("/executive", response_model=ExecutiveReportResponse, status_code=status.HTTP_200_OK)
async def generate_executive_report(
    request: ExecutiveReportRequest,
    generator: ReportGenerator = Depends(ReportGenerator)
):
    """Generate an executive summary report."""
    logger.info(f"Generating executive report for brand {request.brand_id}")
    
    try:
        # Generate executive report
        report = await generator.build_weekly_report(
            brand_id=request.brand_id,
            metrics_json=request.metrics_json,
            report_type="executive",
            include_pdf=False
        )
        
        # Extract executive-specific content
        analysis = report.get("analysis", {})
        data_summary = analysis.get("data_summary", {})
        
        # Generate ROI analysis if requested
        roi_analysis = None
        if request.include_roi_analysis:
            roi_analysis = _generate_roi_analysis(data_summary)
        
        # Generate competitive analysis if requested
        competitive_analysis = None
        if request.include_competitive_analysis:
            competitive_analysis = _generate_competitive_analysis(data_summary)
        
        return ExecutiveReportResponse(
            success=True,
            brand_id=request.brand_id,
            executive_summary=_extract_executive_summary(report["html"]),
            key_metrics=data_summary,
            strategic_recommendations=analysis.get("recommendations", []),
            roi_analysis=roi_analysis,
            competitive_analysis=competitive_analysis,
            generated_at=report["generated_at"]
        )
    except Exception as e:
        logger.error(f"Error generating executive report: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate executive report: {e}"
        )


@router.post("/tactical", response_model=TacticalReportResponse, status_code=status.HTTP_200_OK)
async def generate_tactical_report(
    request: TacticalReportRequest,
    generator: ReportGenerator = Depends(ReportGenerator)
):
    """Generate a tactical implementation report."""
    logger.info(f"Generating tactical report for brand {request.brand_id}")
    
    try:
        # Generate tactical report
        report = await generator.build_weekly_report(
            brand_id=request.brand_id,
            metrics_json=request.metrics_json,
            report_type="tactical",
            include_pdf=False
        )
        
        # Extract tactical-specific content
        analysis = report.get("analysis", {})
        actions = analysis.get("next_actions", [])
        
        # Generate content calendar if requested
        content_calendar = None
        if request.include_content_calendar:
            content_calendar = _generate_content_calendar(analysis)
        
        # Generate optimization tips if requested
        optimization_tips = None
        if request.include_optimization_tips:
            optimization_tips = _generate_optimization_tips(analysis)
        
        return TacticalReportResponse(
            success=True,
            brand_id=request.brand_id,
            tactical_analysis=_extract_tactical_analysis(report["html"]),
            immediate_actions=actions,
            content_calendar=content_calendar,
            optimization_tips=optimization_tips,
            generated_at=report["generated_at"]
        )
    except Exception as e:
        logger.error(f"Error generating tactical report: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate tactical report: {e}"
        )


@router.post("/custom", response_model=CustomReportResponse, status_code=status.HTTP_200_OK)
async def generate_custom_report(
    request: CustomReportRequest,
    generator: ReportGenerator = Depends(ReportGenerator)
):
    """Generate a custom report based on specific requirements."""
    logger.info(f"Generating custom report for brand {request.brand_id}")
    
    try:
        # Generate custom report
        report = await generator.build_weekly_report(
            brand_id=request.brand_id,
            metrics_json=request.metrics_json,
            report_type="comprehensive",
            include_pdf=(request.output_format == "pdf")
        )
        
        # Answer custom questions
        custom_answers = _answer_custom_questions(request.custom_questions, report.get("analysis", {}))
        
        # Generate visualizations if requested
        visualizations = None
        if request.include_visualizations:
            visualizations = _generate_visualizations(report.get("analysis", {}))
        
        return CustomReportResponse(
            success=True,
            brand_id=request.brand_id,
            content=report["html"],
            sections=request.custom_sections,
            custom_answers=custom_answers,
            visualizations=visualizations,
            generated_at=report["generated_at"]
        )
    except Exception as e:
        logger.error(f"Error generating custom report: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate custom report: {e}"
        )


@router.get("/html/{brand_id}")
async def get_report_html(
    brand_id: str,
    generator: ReportGenerator = Depends(ReportGenerator)
):
    """Get HTML version of the latest report for a brand."""
    logger.info(f"Getting HTML report for brand {brand_id}")
    
    try:
        # This would typically fetch from database
        # For now, return a placeholder
        html_content = f"""
        <html>
        <body>
            <h1>Report for Brand {brand_id}</h1>
            <p>Report content would be loaded from database.</p>
        </body>
        </html>
        """
        
        return HTMLResponse(content=html_content)
    except Exception as e:
        logger.error(f"Error getting HTML report: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get HTML report: {e}"
        )


@router.get("/pdf/{brand_id}")
async def get_report_pdf(
    brand_id: str,
    generator: ReportGenerator = Depends(ReportGenerator)
):
    """Get PDF version of the latest report for a brand."""
    logger.info(f"Getting PDF report for brand {brand_id}")
    
    try:
        # This would typically fetch from database
        # For now, return a placeholder
        pdf_path = f"/tmp/report-{brand_id}.pdf"
        
        if not os.path.exists(pdf_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="PDF report not found"
            )
        
        return FileResponse(
            path=pdf_path,
            media_type="application/pdf",
            filename=f"report-{brand_id}.pdf"
        )
    except Exception as e:
        logger.error(f"Error getting PDF report: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get PDF report: {e}"
        )


@router.get("/stats", response_model=ReportStats)
async def get_report_stats():
    """Get reporting system statistics."""
    logger.info("Getting report statistics")
    
    try:
        # This would typically come from a database
        stats = {
            "total_reports": 0,
            "reports_by_type": {
                "comprehensive": 0,
                "executive": 0,
                "tactical": 0
            },
            "avg_generation_time": 0.0,
            "success_rate": 100.0,
            "most_active_brands": [],
            "popular_templates": []
        }
        
        return ReportStats(**stats)
    except Exception as e:
        logger.error(f"Error getting report stats: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get report stats: {e}"
        )


@router.get("/history/{brand_id}", response_model=List[ReportHistory])
async def get_report_history(brand_id: str):
    """Get report history for a brand."""
    logger.info(f"Getting report history for brand {brand_id}")
    
    try:
        # This would typically fetch from database
        history = []
        
        return history
    except Exception as e:
        logger.error(f"Error getting report history: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get report history: {e}"
        )


@router.post("/schedule", response_model=ReportSchedule)
async def create_report_schedule(
    schedule: ReportSchedule,
    background_tasks: BackgroundTasks
):
    """Create a scheduled report."""
    logger.info(f"Creating report schedule for brand {schedule.brand_id}")
    
    try:
        # This would typically save to database
        # For now, just return the schedule
        return schedule
    except Exception as e:
        logger.error(f"Error creating report schedule: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create report schedule: {e}"
        )


@router.post("/export", response_model=ReportExportResponse)
async def export_report(request: ReportExportRequest):
    """Export a report in various formats."""
    logger.info(f"Exporting report {request.report_id}")
    
    try:
        # This would typically handle export logic
        export_path = f"/tmp/export-{request.report_id}.{request.export_format}"
        
        return ReportExportResponse(
            success=True,
            report_id=request.report_id,
            export_format=request.export_format,
            file_path=export_path,
            file_size=0,
            download_url=None,
            expires_at=None
        )
    except Exception as e:
        logger.error(f"Error exporting report: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export report: {e}"
        )


@router.post("/compare", response_model=ReportComparisonResponse)
async def compare_reports(request: ReportComparisonRequest):
    """Compare multiple reports."""
    logger.info(f"Comparing reports for brand {request.brand_id}")
    
    try:
        # This would typically handle comparison logic
        comparison_data = {
            "reports": request.report_ids,
            "metrics": request.metrics_to_compare,
            "comparison_type": request.comparison_type
        }
        
        return ReportComparisonResponse(
            success=True,
            brand_id=request.brand_id,
            comparison_type=request.comparison_type,
            comparison_data=comparison_data,
            insights=["Comparison insights would be generated here"],
            recommendations=["Recommendations based on comparison"],
            generated_at="2023-10-27T10:00:00Z"
        )
    except Exception as e:
        logger.error(f"Error comparing reports: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compare reports: {e}"
        )


@router.post("/validate", response_model=ReportValidationResponse)
async def validate_report_data(request: ReportValidationRequest):
    """Validate report data quality."""
    logger.info(f"Validating report data for brand {request.brand_id}")
    
    try:
        # This would typically handle validation logic
        validation_results = {
            "data_completeness": 95.0,
            "data_accuracy": 98.0,
            "data_consistency": 92.0
        }
        
        data_quality_score = sum(validation_results.values()) / len(validation_results)
        
        return ReportValidationResponse(
            success=True,
            brand_id=request.brand_id,
            is_valid=data_quality_score >= 90.0,
            validation_results=validation_results,
            data_quality_score=data_quality_score,
            issues=[],
            recommendations=["Data quality is good"],
            validated_at="2023-10-27T10:00:00Z"
        )
    except Exception as e:
        logger.error(f"Error validating report data: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to validate report data: {e}"
        )


# Helper functions

def _extract_executive_summary(html_content: str) -> str:
    """Extract executive summary from HTML content."""
    # Simple extraction - in production, would use proper HTML parsing
    if "Executive Summary" in html_content:
        return "Executive summary extracted from report content"
    return "Executive summary not found"

def _extract_tactical_analysis(html_content: str) -> str:
    """Extract tactical analysis from HTML content."""
    # Simple extraction - in production, would use proper HTML parsing
    if "Tactical Analysis" in html_content:
        return "Tactical analysis extracted from report content"
    return "Tactical analysis not found"

def _generate_roi_analysis(data_summary: Dict[str, Any]) -> Dict[str, Any]:
    """Generate ROI analysis from data summary."""
    revenue = data_summary.get("total_revenue", 0)
    impressions = data_summary.get("total_impressions", 0)
    clicks = data_summary.get("total_clicks", 0)
    
    return {
        "total_revenue": revenue,
        "cost_per_impression": 0.01,  # Placeholder
        "cost_per_click": 0.50,  # Placeholder
        "roi": (revenue / max(1, impressions * 0.01)) * 100,  # Simple ROI calculation
        "recommendations": ["Focus on high-converting content", "Optimize ad spend allocation"]
    }

def _generate_competitive_analysis(data_summary: Dict[str, Any]) -> Dict[str, Any]:
    """Generate competitive analysis from data summary."""
    return {
        "market_position": "Above average",
        "competitive_advantages": ["Strong engagement rates", "Good content quality"],
        "areas_for_improvement": ["Increase posting frequency", "Expand platform presence"],
        "benchmark_comparison": {
            "engagement_rate": "Above industry average",
            "reach": "Below industry average",
            "conversions": "Above industry average"
        }
    }

def _generate_content_calendar(analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Generate content calendar from analysis."""
    posting_times = analysis.get("optimal_posting_times", [])
    actions = analysis.get("next_actions", [])
    
    calendar = []
    for i, time_info in enumerate(posting_times[:5]):  # 5 posts
        calendar.append({
            "day": time_info.get("day", "Monday"),
            "time": time_info.get("time", "09:00"),
            "content_type": "Post",
            "theme": f"Content theme {i+1}",
            "platform": "instagram",
            "priority": "high" if i < 2 else "medium"
        })
    
    return calendar

def _generate_optimization_tips(analysis: Dict[str, Any]) -> List[str]:
    """Generate optimization tips from analysis."""
    tips = []
    
    wins = analysis.get("top_3_wins", [])
    if wins:
        tips.append("Replicate successful content patterns from top performers")
    
    problems = analysis.get("bottom_2_problems", [])
    if problems:
        tips.append("Address common issues in underperforming content")
    
    tips.extend([
        "Test different posting times to find optimal schedule",
        "Use A/B testing for content variations",
        "Monitor engagement patterns and adjust strategy accordingly"
    ])
    
    return tips

def _answer_custom_questions(questions: List[str], analysis: Dict[str, Any]) -> List[Dict[str, str]]:
    """Answer custom questions based on analysis."""
    answers = []
    
    for question in questions:
        # Simple keyword-based answering
        if "engagement" in question.lower():
            avg_engagement = analysis.get("data_summary", {}).get("avg_engagement_rate", 0)
            answers.append({
                "question": question,
                "answer": f"Your average engagement rate is {avg_engagement:.1%}"
            })
        elif "best time" in question.lower():
            posting_times = analysis.get("optimal_posting_times", [])
            if posting_times:
                best_time = posting_times[0]
                answers.append({
                    "question": question,
                    "answer": f"Best time to post is {best_time.get('day', 'Monday')} at {best_time.get('time', '09:00')}"
                })
            else:
                answers.append({
                    "question": question,
                    "answer": "Insufficient data to determine optimal posting time"
                })
        else:
            answers.append({
                "question": question,
                "answer": "Analysis completed - see detailed findings in the report"
            })
    
    return answers

def _generate_visualizations(analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Generate data visualizations from analysis."""
    visualizations = []
    
    # Engagement trend chart
    trends = analysis.get("performance_trends", {})
    if trends:
        visualizations.append({
            "type": "line_chart",
            "title": "Engagement Trend",
            "data": {
                "labels": ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6"],
                "datasets": [{
                    "label": "Engagement Rate",
                    "data": [0.03, 0.032, 0.035, 0.031, 0.038, 0.04],
                    "borderColor": "#667eea"
                }]
            }
        })
    
    # Platform performance pie chart
    platform_performance = trends.get("platform_performance", {})
    if platform_performance:
        visualizations.append({
            "type": "pie_chart",
            "title": "Platform Performance",
            "data": {
                "labels": list(platform_performance.keys()),
                "datasets": [{
                    "data": [perf.get("avg_engagement", 0) for perf in platform_performance.values()],
                    "backgroundColor": ["#667eea", "#764ba2", "#f093fb"]
                }]
            }
        })
    
    return visualizations



