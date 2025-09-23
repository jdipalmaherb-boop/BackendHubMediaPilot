"""
Pydantic schemas for reporting functionality.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class WeeklyReportRequest(BaseModel):
    """Request schema for weekly report generation."""
    
    brand_id: str = Field(..., description="Brand identifier")
    metrics_json: Dict[str, Any] = Field(..., description="Performance metrics data")
    report_type: str = Field("comprehensive", description="Type of report (comprehensive, executive, tactical)")
    include_pdf: bool = Field(True, description="Whether to include PDF generation")
    custom_sections: Optional[List[str]] = Field(None, description="Custom sections to include")


class WeeklyReportResponse(BaseModel):
    """Response schema for weekly report generation."""
    
    success: bool = Field(..., description="Whether report generation was successful")
    brand_id: str = Field(..., description="Brand identifier")
    report_type: str = Field(..., description="Type of report generated")
    html: str = Field(..., description="HTML content of the report")
    pdf: Optional[str] = Field(None, description="Path to generated PDF file")
    generated_at: str = Field(..., description="When the report was generated")
    analysis: Optional[Dict[str, Any]] = Field(None, description="Underlying analysis data")
    error: Optional[str] = Field(None, description="Error message if generation failed")


class ExecutiveReportRequest(BaseModel):
    """Request schema for executive report generation."""
    
    brand_id: str = Field(..., description="Brand identifier")
    metrics_json: Dict[str, Any] = Field(..., description="Performance metrics data")
    include_roi_analysis: bool = Field(True, description="Include ROI analysis")
    include_competitive_analysis: bool = Field(False, description="Include competitive analysis")


class ExecutiveReportResponse(BaseModel):
    """Response schema for executive report generation."""
    
    success: bool = Field(..., description="Whether report generation was successful")
    brand_id: str = Field(..., description="Brand identifier")
    executive_summary: str = Field(..., description="Executive summary content")
    key_metrics: Dict[str, Any] = Field(..., description="Key performance metrics")
    strategic_recommendations: List[str] = Field(..., description="Strategic recommendations")
    roi_analysis: Optional[Dict[str, Any]] = Field(None, description="ROI analysis if requested")
    competitive_analysis: Optional[Dict[str, Any]] = Field(None, description="Competitive analysis if requested")
    generated_at: str = Field(..., description="When the report was generated")


class TacticalReportRequest(BaseModel):
    """Request schema for tactical report generation."""
    
    brand_id: str = Field(..., description="Brand identifier")
    metrics_json: Dict[str, Any] = Field(..., description="Performance metrics data")
    focus_areas: Optional[List[str]] = Field(None, description="Specific areas to focus on")
    include_content_calendar: bool = Field(True, description="Include content calendar")
    include_optimization_tips: bool = Field(True, description="Include optimization tips")


class TacticalReportResponse(BaseModel):
    """Response schema for tactical report generation."""
    
    success: bool = Field(..., description="Whether report generation was successful")
    brand_id: str = Field(..., description="Brand identifier")
    tactical_analysis: str = Field(..., description="Tactical analysis content")
    immediate_actions: List[Dict[str, Any]] = Field(..., description="Immediate action items")
    content_calendar: Optional[List[Dict[str, Any]]] = Field(None, description="Content calendar if requested")
    optimization_tips: Optional[List[str]] = Field(None, description="Optimization tips if requested")
    generated_at: str = Field(..., description="When the report was generated")


class ReportTemplate(BaseModel):
    """Schema for report templates."""
    
    template_id: str = Field(..., description="Template identifier")
    name: str = Field(..., description="Template name")
    description: str = Field(..., description="Template description")
    sections: List[str] = Field(..., description="Template sections")
    report_type: str = Field(..., description="Type of report this template is for")
    is_default: bool = Field(False, description="Whether this is a default template")


class CustomReportRequest(BaseModel):
    """Request schema for custom report generation."""
    
    brand_id: str = Field(..., description="Brand identifier")
    metrics_json: Dict[str, Any] = Field(..., description="Performance metrics data")
    template_id: Optional[str] = Field(None, description="Template to use")
    custom_sections: List[str] = Field(..., description="Custom sections to include")
    custom_questions: List[str] = Field(..., description="Custom questions to answer")
    output_format: str = Field("html", description="Output format (html, pdf, json)")
    include_visualizations: bool = Field(True, description="Include data visualizations")


class CustomReportResponse(BaseModel):
    """Response schema for custom report generation."""
    
    success: bool = Field(..., description="Whether report generation was successful")
    brand_id: str = Field(..., description="Brand identifier")
    content: str = Field(..., description="Report content")
    sections: List[str] = Field(..., description="Sections included in the report")
    custom_answers: List[Dict[str, str]] = Field(..., description="Answers to custom questions")
    visualizations: Optional[List[Dict[str, Any]]] = Field(None, description="Data visualizations if requested")
    generated_at: str = Field(..., description="When the report was generated")


class ReportSchedule(BaseModel):
    """Schema for report scheduling."""
    
    schedule_id: str = Field(..., description="Schedule identifier")
    brand_id: str = Field(..., description="Brand identifier")
    report_type: str = Field(..., description="Type of report to generate")
    frequency: str = Field(..., description="Frequency (daily, weekly, monthly)")
    day_of_week: Optional[int] = Field(None, description="Day of week (0-6, Sunday=0)")
    day_of_month: Optional[int] = Field(None, description="Day of month (1-31)")
    time: str = Field(..., description="Time to generate report (HH:MM)")
    recipients: List[str] = Field(..., description="Email recipients")
    is_active: bool = Field(True, description="Whether schedule is active")


class ReportHistory(BaseModel):
    """Schema for report history."""
    
    report_id: str = Field(..., description="Report identifier")
    brand_id: str = Field(..., description="Brand identifier")
    report_type: str = Field(..., description="Type of report")
    generated_at: datetime = Field(..., description="When the report was generated")
    file_path: Optional[str] = Field(None, description="Path to report file")
    file_size: Optional[int] = Field(None, description="File size in bytes")
    generation_time: float = Field(..., description="Time taken to generate report in seconds")
    status: str = Field(..., description="Report status (success, failed, partial)")


class ReportStats(BaseModel):
    """Schema for report statistics."""
    
    total_reports: int = Field(..., description="Total number of reports generated")
    reports_by_type: Dict[str, int] = Field(..., description="Reports by type")
    avg_generation_time: float = Field(..., description="Average generation time in seconds")
    success_rate: float = Field(..., description="Success rate percentage")
    most_active_brands: List[Dict[str, Any]] = Field(..., description="Most active brands")
    popular_templates: List[str] = Field(..., description="Most popular report templates")


class ReportExportRequest(BaseModel):
    """Request schema for report export."""
    
    report_id: str = Field(..., description="Report identifier")
    export_format: str = Field(..., description="Export format (pdf, html, json, csv)")
    include_data: bool = Field(True, description="Include underlying data")
    include_visualizations: bool = Field(True, description="Include visualizations")


class ReportExportResponse(BaseModel):
    """Response schema for report export."""
    
    success: bool = Field(..., description="Whether export was successful")
    report_id: str = Field(..., description="Report identifier")
    export_format: str = Field(..., description="Export format")
    file_path: str = Field(..., description="Path to exported file")
    file_size: int = Field(..., description="File size in bytes")
    download_url: Optional[str] = Field(None, description="Download URL if available")
    expires_at: Optional[datetime] = Field(None, description="When the download URL expires")


class ReportComparisonRequest(BaseModel):
    """Request schema for report comparison."""
    
    brand_id: str = Field(..., description="Brand identifier")
    report_ids: List[str] = Field(..., description="Report IDs to compare")
    comparison_type: str = Field("period", description="Type of comparison (period, brand, campaign)")
    metrics_to_compare: List[str] = Field(..., description="Metrics to compare")


class ReportComparisonResponse(BaseModel):
    """Response schema for report comparison."""
    
    success: bool = Field(..., description="Whether comparison was successful")
    brand_id: str = Field(..., description="Brand identifier")
    comparison_type: str = Field(..., description="Type of comparison")
    comparison_data: Dict[str, Any] = Field(..., description="Comparison data")
    insights: List[str] = Field(..., description="Comparison insights")
    recommendations: List[str] = Field(..., description="Recommendations based on comparison")
    generated_at: str = Field(..., description="When the comparison was generated")


class ReportValidationRequest(BaseModel):
    """Request schema for report validation."""
    
    brand_id: str = Field(..., description="Brand identifier")
    metrics_json: Dict[str, Any] = Field(..., description="Performance metrics data")
    validation_rules: List[str] = Field(..., description="Validation rules to apply")
    data_quality_checks: bool = Field(True, description="Perform data quality checks")


class ReportValidationResponse(BaseModel):
    """Response schema for report validation."""
    
    success: bool = Field(..., description="Whether validation was successful")
    brand_id: str = Field(..., description="Brand identifier")
    is_valid: bool = Field(..., description="Whether the data is valid")
    validation_results: Dict[str, Any] = Field(..., description="Validation results")
    data_quality_score: float = Field(..., description="Data quality score (0-100)")
    issues: List[str] = Field(..., description="Issues found during validation")
    recommendations: List[str] = Field(..., description="Recommendations for improvement")
    validated_at: str = Field(..., description="When the validation was performed")



