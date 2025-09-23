"""
Weekly report generator for marketing performance analysis.
"""

import os
import tempfile
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from pathlib import Path

from app.core.logging import logger
from app.modules.ad_copy.llm_client import get_llm_client, AbstractLLMClient
from app.modules.analytics.marketing_analyst import MarketingAnalyst


class ReportGenerator:
    """Generates comprehensive weekly marketing reports."""

    def __init__(self, llm_client: Optional[AbstractLLMClient] = None):
        self.llm_client = llm_client if llm_client else get_llm_client()
        self.analyst = MarketingAnalyst(llm_client)
        logger.info("ReportGenerator initialized")

    async def build_weekly_report(
        self,
        brand_id: str,
        metrics_json: Dict[str, Any],
        report_type: str = "comprehensive",
        include_pdf: bool = True
    ) -> Dict[str, Any]:
        """
        Build a comprehensive weekly report for a brand.
        
        Args:
            brand_id: Brand identifier
            metrics_json: Performance metrics data
            report_type: Type of report (comprehensive, executive, tactical)
            include_pdf: Whether to generate PDF version
            
        Returns:
            Dict containing HTML content and PDF path
        """
        logger.info(f"Building weekly report for brand {brand_id}")
        
        try:
            # First, get detailed analytics
            analysis = await self.analyst.analyze_performance_data(
                json_metrics=metrics_json,
                analysis_period="1_week"
            )
            
            # Generate report content based on type
            if report_type == "comprehensive":
                report_content = await self._generate_comprehensive_report(
                    brand_id, metrics_json, analysis
                )
            elif report_type == "executive":
                report_content = await self._generate_executive_report(
                    brand_id, metrics_json, analysis
                )
            elif report_type == "tactical":
                report_content = await self._generate_tactical_report(
                    brand_id, metrics_json, analysis
                )
            else:
                report_content = await self._generate_comprehensive_report(
                    brand_id, metrics_json, analysis
                )
            
            # Generate HTML report
            html_content = self._format_html_report(report_content, brand_id)
            
            result = {
                "brand_id": brand_id,
                "report_type": report_type,
                "html": html_content,
                "generated_at": datetime.utcnow().isoformat(),
                "analysis": analysis
            }
            
            # Generate PDF if requested
            if include_pdf:
                pdf_path = await self._generate_pdf(html_content, brand_id)
                result["pdf"] = pdf_path
            
            return result
            
        except Exception as e:
            logger.error(f"Error building weekly report: {e}", exc_info=True)
            return self._create_error_report(brand_id, str(e))

    async def _generate_comprehensive_report(
        self,
        brand_id: str,
        metrics_json: Dict[str, Any],
        analysis: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate comprehensive report content."""
        
        # Build the prompt for comprehensive analysis
        prompt = f"""
        Brand {brand_id} Weekly Marketing Report
        
        Performance Data:
        {self._format_metrics_for_prompt(metrics_json)}
        
        Analysis Results:
        - Top 3 Wins: {analysis.get('top_3_wins', [])}
        - Bottom 2 Problems: {analysis.get('bottom_2_problems', [])}
        - Next Actions: {analysis.get('next_actions', [])}
        - Optimal Posting Times: {analysis.get('optimal_posting_times', [])}
        
        Please generate a comprehensive weekly report with:
        
        1) EXECUTIVE SUMMARY
        - Key performance highlights
        - Overall brand performance score
        - Week-over-week changes
        - Strategic insights
        
        2) TOP 3 WINS WITH EXAMPLES
        - Detailed analysis of best performing content
        - Specific examples and metrics
        - What made them successful
        - Replication strategies
        
        3) 3 TACTICAL SUGGESTIONS
        - Immediate actionable improvements
        - Content optimization strategies
        - Platform-specific recommendations
        - Quick wins for next week
        
        4) SUGGESTED CALENDAR (5 POSTS) WITH TIMES
        - 5 post ideas for next week
        - Optimal posting times for each
        - Content themes and formats
        - Platform distribution strategy
        
        5) PERFORMANCE METRICS DASHBOARD
        - Key metrics summary
        - Trend analysis
        - Platform breakdown
        - Audience insights
        
        6) RECOMMENDATIONS FOR NEXT WEEK
        - Strategic priorities
        - Content focus areas
        - Engagement tactics
        - Growth opportunities
        
        Format the response as structured HTML with clear sections and professional styling.
        """
        
        try:
            response = await self.llm_client.generate_content(
                prompt=prompt,
                max_tokens=2000,
                temperature=0.7
            )
            
            return {
                "content": response,
                "sections": {
                    "executive_summary": True,
                    "top_wins": True,
                    "tactical_suggestions": True,
                    "posting_calendar": True,
                    "metrics_dashboard": True,
                    "recommendations": True
                }
            }
        except Exception as e:
            logger.error(f"Error generating comprehensive report: {e}")
            return self._create_fallback_report(brand_id, analysis)

    async def _generate_executive_report(
        self,
        brand_id: str,
        metrics_json: Dict[str, Any],
        analysis: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate executive summary report."""
        
        prompt = f"""
        Brand {brand_id} Executive Summary
        
        Performance Data: {self._format_metrics_for_prompt(metrics_json)}
        
        Generate a concise executive summary report with:
        
        1) EXECUTIVE SUMMARY
        - High-level performance overview
        - Key achievements and challenges
        - ROI and business impact
        - Strategic recommendations
        
        2) KEY METRICS
        - Top 3 performance indicators
        - Week-over-week comparison
        - Platform performance summary
        
        3) STRATEGIC RECOMMENDATIONS
        - 3 high-level strategic actions
        - Resource allocation suggestions
        - Long-term growth opportunities
        
        Keep it concise and business-focused for executive audience.
        """
        
        try:
            response = await self.llm_client.generate_content(
                prompt=prompt,
                max_tokens=1000,
                temperature=0.5
            )
            
            return {
                "content": response,
                "sections": {
                    "executive_summary": True,
                    "key_metrics": True,
                    "strategic_recommendations": True
                }
            }
        except Exception as e:
            logger.error(f"Error generating executive report: {e}")
            return self._create_fallback_report(brand_id, analysis)

    async def _generate_tactical_report(
        self,
        brand_id: str,
        metrics_json: Dict[str, Any],
        analysis: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate tactical implementation report."""
        
        prompt = f"""
        Brand {brand_id} Tactical Report
        
        Performance Data: {self._format_metrics_for_prompt(metrics_json)}
        
        Generate a tactical implementation report with:
        
        1) TACTICAL ANALYSIS
        - Content performance breakdown
        - Platform-specific insights
        - Engagement pattern analysis
        - Optimization opportunities
        
        2) IMMEDIATE ACTIONS (5 ITEMS)
        - Specific tasks for this week
        - Content creation guidelines
        - Posting schedule optimization
        - Engagement tactics
        
        3) CONTENT CALENDAR (7 DAYS)
        - Daily post suggestions
        - Optimal timing for each post
        - Content themes and formats
        - Platform distribution
        
        4) PERFORMANCE OPTIMIZATION
        - A/B testing suggestions
        - Hashtag strategies
        - Caption optimization tips
        - Visual content guidelines
        
        Focus on actionable, implementable tactics.
        """
        
        try:
            response = await self.llm_client.generate_content(
                prompt=prompt,
                max_tokens=1500,
                temperature=0.6
            )
            
            return {
                "content": response,
                "sections": {
                    "tactical_analysis": True,
                    "immediate_actions": True,
                    "content_calendar": True,
                    "performance_optimization": True
                }
            }
        except Exception as e:
            logger.error(f"Error generating tactical report: {e}")
            return self._create_fallback_report(brand_id, analysis)

    def _format_metrics_for_prompt(self, metrics_json: Dict[str, Any]) -> str:
        """Format metrics data for LLM prompt."""
        try:
            # Extract key metrics
            posts = metrics_json.get("posts", [])
            engagement = metrics_json.get("engagement", {})
            metrics = metrics_json.get("metrics", {})
            
            formatted = f"""
            Posts: {len(posts)} total
            Average Engagement Rate: {engagement.get('avg_engagement_rate', 0):.1%}
            Total Reach: {engagement.get('total_reach', 0):,}
            Total Impressions: {metrics.get('impressions', 0):,}
            Total Clicks: {metrics.get('clicks', 0):,}
            Total Conversions: {metrics.get('conversions', 0):,}
            Total Revenue: ${metrics.get('revenue', 0):,.2f}
            """
            
            # Add top performing posts
            if posts:
                top_posts = sorted(posts, key=lambda x: x.get('engagement_rate', 0), reverse=True)[:3]
                formatted += "\n\nTop Performing Posts:\n"
                for i, post in enumerate(top_posts, 1):
                    formatted += f"{i}. {post.get('content', '')[:100]}... (Engagement: {post.get('engagement_rate', 0):.1%})\n"
            
            return formatted
        except Exception as e:
            logger.error(f"Error formatting metrics: {e}")
            return "Metrics data unavailable"

    def _format_html_report(self, report_content: Dict[str, Any], brand_id: str) -> str:
        """Format the report content as HTML."""
        
        content = report_content.get("content", "Report content unavailable")
        generated_at = datetime.utcnow().strftime("%B %d, %Y at %I:%M %p")
        
        html_template = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Weekly Marketing Report - Brand {brand_id}</title>
            <style>
                body {{
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #f8f9fa;
                }}
                .header {{
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 30px;
                    border-radius: 10px;
                    margin-bottom: 30px;
                    text-align: center;
                }}
                .header h1 {{
                    margin: 0;
                    font-size: 2.5em;
                    font-weight: 300;
                }}
                .header p {{
                    margin: 10px 0 0 0;
                    font-size: 1.2em;
                    opacity: 0.9;
                }}
                .content {{
                    background: white;
                    padding: 40px;
                    border-radius: 10px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    margin-bottom: 20px;
                }}
                .section {{
                    margin-bottom: 40px;
                    padding-bottom: 30px;
                    border-bottom: 2px solid #f0f0f0;
                }}
                .section:last-child {{
                    border-bottom: none;
                }}
                .section h2 {{
                    color: #667eea;
                    font-size: 1.8em;
                    margin-bottom: 20px;
                    padding-bottom: 10px;
                    border-bottom: 3px solid #667eea;
                }}
                .section h3 {{
                    color: #555;
                    font-size: 1.4em;
                    margin: 25px 0 15px 0;
                }}
                .metric-card {{
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 8px;
                    margin: 15px 0;
                    border-left: 4px solid #667eea;
                }}
                .win-item {{
                    background: #d4edda;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 10px 0;
                    border-left: 4px solid #28a745;
                }}
                .problem-item {{
                    background: #f8d7da;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 10px 0;
                    border-left: 4px solid #dc3545;
                }}
                .action-item {{
                    background: #fff3cd;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 10px 0;
                    border-left: 4px solid #ffc107;
                }}
                .calendar-item {{
                    background: #e2e3e5;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 10px 0;
                    border-left: 4px solid #6c757d;
                }}
                .footer {{
                    text-align: center;
                    color: #666;
                    font-size: 0.9em;
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid #ddd;
                }}
                ul, ol {{
                    padding-left: 25px;
                }}
                li {{
                    margin-bottom: 8px;
                }}
                .highlight {{
                    background: #fff3cd;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-weight: bold;
                }}
                .success {{
                    color: #28a745;
                    font-weight: bold;
                }}
                .warning {{
                    color: #ffc107;
                    font-weight: bold;
                }}
                .danger {{
                    color: #dc3545;
                    font-weight: bold;
                }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Weekly Marketing Report</h1>
                <p>Brand {brand_id} • Generated on {generated_at}</p>
            </div>
            
            <div class="content">
                {content}
            </div>
            
            <div class="footer">
                <p>Generated by AI Ads Automation Platform • {generated_at}</p>
            </div>
        </body>
        </html>
        """
        
        return html_template

    async def _generate_pdf(self, html_content: str, brand_id: str) -> str:
        """Generate PDF from HTML content."""
        try:
            # Create temporary file for PDF
            temp_dir = tempfile.gettempdir()
            pdf_filename = f"report-{brand_id}-{datetime.now().strftime('%Y%m%d-%H%M%S')}.pdf"
            pdf_path = os.path.join(temp_dir, pdf_filename)
            
            # Try to use pdfkit if available
            try:
                import pdfkit
                pdfkit.from_string(html_content, pdf_path)
                logger.info(f"PDF generated successfully: {pdf_path}")
                return pdf_path
            except ImportError:
                logger.warning("pdfkit not available, returning HTML only")
                return None
            except Exception as e:
                logger.error(f"Error generating PDF with pdfkit: {e}")
                return None
                
        except Exception as e:
            logger.error(f"Error generating PDF: {e}")
            return None

    def _create_fallback_report(self, brand_id: str, analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Create fallback report when LLM generation fails."""
        
        data_summary = analysis.get("data_summary", {})
        wins = analysis.get("top_3_wins", [])
        problems = analysis.get("bottom_2_problems", [])
        actions = analysis.get("next_actions", [])
        posting_times = analysis.get("optimal_posting_times", [])
        
        content = f"""
        <div class="section">
            <h2>Executive Summary</h2>
            <p>Weekly performance analysis for Brand {brand_id}</p>
            <div class="metric-card">
                <strong>Total Posts:</strong> {data_summary.get('total_posts', 0)}<br>
                <strong>Average Engagement:</strong> {data_summary.get('avg_engagement_rate', 0):.1%}<br>
                <strong>Total Reach:</strong> {data_summary.get('total_reach', 0):,}
            </div>
        </div>
        
        <div class="section">
            <h2>Top 3 Wins</h2>
            {self._format_wins_html(wins)}
        </div>
        
        <div class="section">
            <h2>Areas for Improvement</h2>
            {self._format_problems_html(problems)}
        </div>
        
        <div class="section">
            <h2>Next Actions</h2>
            {self._format_actions_html(actions)}
        </div>
        
        <div class="section">
            <h2>Optimal Posting Times</h2>
            {self._format_posting_times_html(posting_times)}
        </div>
        """
        
        return {
            "content": content,
            "sections": {
                "executive_summary": True,
                "top_wins": True,
                "problems": True,
                "actions": True,
                "posting_times": True
            }
        }

    def _format_wins_html(self, wins: List[Dict[str, Any]]) -> str:
        """Format wins as HTML."""
        if not wins:
            return "<p>No wins identified in the data.</p>"
        
        html = ""
        for i, win in enumerate(wins, 1):
            html += f"""
            <div class="win-item">
                <h3>Win #{i}: {win.get('title', 'Unknown')}</h3>
                <p><strong>Description:</strong> {win.get('description', 'N/A')}</p>
                <p><strong>Metric:</strong> {win.get('metric', 'N/A')} - {win.get('value', 0):.1%}</p>
                <p><strong>Improvement:</strong> {win.get('improvement', 0):.1f}%</p>
            </div>
            """
        return html

    def _format_problems_html(self, problems: List[Dict[str, Any]]) -> str:
        """Format problems as HTML."""
        if not problems:
            return "<p>No significant problems identified.</p>"
        
        html = ""
        for i, problem in enumerate(problems, 1):
            html += f"""
            <div class="problem-item">
                <h3>Problem #{i}: {problem.get('title', 'Unknown')}</h3>
                <p><strong>Description:</strong> {problem.get('description', 'N/A')}</p>
                <p><strong>Impact:</strong> {problem.get('impact', 'Unknown')}</p>
                <p><strong>Suggested Improvements:</strong></p>
                <ul>
                    {''.join([f'<li>{improvement}</li>' for improvement in problem.get('suggested_improvements', [])])}
                </ul>
            </div>
            """
        return html

    def _format_actions_html(self, actions: List[Dict[str, Any]]) -> str:
        """Format actions as HTML."""
        if not actions:
            return "<p>No actions identified.</p>"
        
        html = ""
        for action in actions:
            html += f"""
            <div class="action-item">
                <h3>Priority {action.get('priority', 'N/A')}: {action.get('title', 'Unknown')}</h3>
                <p><strong>Description:</strong> {action.get('description', 'N/A')}</p>
                <p><strong>Timeline:</strong> {action.get('timeline', 'N/A')} | 
                   <strong>Effort:</strong> {action.get('effort', 'N/A')} | 
                   <strong>Impact:</strong> {action.get('expected_impact', 'N/A')}</p>
                <p><strong>Specific Steps:</strong></p>
                <ul>
                    {''.join([f'<li>{step}</li>' for step in action.get('specific_steps', [])])}
                </ul>
            </div>
            """
        return html

    def _format_posting_times_html(self, posting_times: List[Dict[str, Any]]) -> str:
        """Format posting times as HTML."""
        if not posting_times:
            return "<p>No optimal posting times identified.</p>"
        
        html = ""
        for time_info in posting_times:
            html += f"""
            <div class="calendar-item">
                <h3>{time_info.get('day', 'Unknown')} at {time_info.get('time', 'Unknown')}</h3>
                <p><strong>Confidence:</strong> {time_info.get('confidence', 0):.0%}</p>
                <p><strong>Expected Engagement:</strong> {time_info.get('expected_engagement', 0):.1%}</p>
                <p><strong>Reasoning:</strong> {time_info.get('reasoning', 'N/A')}</p>
            </div>
            """
        return html

    def _create_error_report(self, brand_id: str, error_message: str) -> Dict[str, Any]:
        """Create error report when generation fails."""
        return {
            "brand_id": brand_id,
            "report_type": "error",
            "html": f"""
            <div class="content">
                <h2>Report Generation Error</h2>
                <p>Unable to generate report for Brand {brand_id}</p>
                <p><strong>Error:</strong> {error_message}</p>
                <p>Please try again or contact support.</p>
            </div>
            """,
            "generated_at": datetime.utcnow().isoformat(),
            "error": error_message
        }



