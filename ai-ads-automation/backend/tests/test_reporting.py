"""
Tests for the reporting module.
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
from app.modules.reporting.report_generator import ReportGenerator


class TestReportGenerator:
    """Test cases for ReportGenerator."""

    @pytest.fixture
    def generator(self):
        """ReportGenerator instance for testing."""
        return ReportGenerator()

    @pytest.fixture
    def sample_metrics(self):
        """Sample metrics data for testing."""
        return {
            "posts": [
                {
                    "id": "post_1",
                    "content": "Amazing product launch! Check it out!",
                    "platform": "instagram",
                    "engagement_rate": 0.045,
                    "reach": 10000,
                    "likes": 450,
                    "comments": 25,
                    "shares": 15,
                    "created_at": "2023-10-20T10:00:00Z"
                },
                {
                    "id": "post_2",
                    "content": "Behind the scenes content",
                    "platform": "facebook",
                    "engagement_rate": 0.025,
                    "reach": 8000,
                    "likes": 200,
                    "comments": 15,
                    "shares": 10,
                    "created_at": "2023-10-19T14:00:00Z"
                }
            ],
            "engagement": {
                "total_posts": 2,
                "avg_engagement_rate": 0.035,
                "total_reach": 18000
            },
            "metrics": {
                "impressions": 25000,
                "clicks": 500,
                "conversions": 25,
                "revenue": 2500.00
            },
            "platforms": {
                "instagram": 1,
                "facebook": 1
            }
        }

    @pytest.mark.asyncio
    async def test_build_weekly_report_comprehensive(self, generator, sample_metrics):
        """Test building comprehensive weekly report."""
        report = await generator.build_weekly_report(
            brand_id="test_brand",
            metrics_json=sample_metrics,
            report_type="comprehensive",
            include_pdf=False
        )
        
        assert "brand_id" in report
        assert "report_type" in report
        assert "html" in report
        assert "generated_at" in report
        assert report["brand_id"] == "test_brand"
        assert report["report_type"] == "comprehensive"

    @pytest.mark.asyncio
    async def test_build_weekly_report_executive(self, generator, sample_metrics):
        """Test building executive report."""
        report = await generator.build_weekly_report(
            brand_id="test_brand",
            metrics_json=sample_metrics,
            report_type="executive",
            include_pdf=False
        )
        
        assert report["report_type"] == "executive"
        assert "html" in report

    @pytest.mark.asyncio
    async def test_build_weekly_report_tactical(self, generator, sample_metrics):
        """Test building tactical report."""
        report = await generator.build_weekly_report(
            brand_id="test_brand",
            metrics_json=sample_metrics,
            report_type="tactical",
            include_pdf=False
        )
        
        assert report["report_type"] == "tactical"
        assert "html" in report

    @pytest.mark.asyncio
    async def test_build_weekly_report_with_pdf(self, generator, sample_metrics):
        """Test building report with PDF generation."""
        with patch.object(generator, '_generate_pdf') as mock_pdf:
            mock_pdf.return_value = "/tmp/test.pdf"
            
            report = await generator.build_weekly_report(
                brand_id="test_brand",
                metrics_json=sample_metrics,
                report_type="comprehensive",
                include_pdf=True
            )
            
            assert "pdf" in report
            assert report["pdf"] == "/tmp/test.pdf"

    @pytest.mark.asyncio
    async def test_build_weekly_report_error_handling(self, generator):
        """Test error handling in report generation."""
        invalid_metrics = "invalid data"
        
        report = await generator.build_weekly_report(
            brand_id="test_brand",
            metrics_json=invalid_metrics,
            report_type="comprehensive",
            include_pdf=False
        )
        
        assert "error" in report
        assert report["report_type"] == "error"

    def test_format_metrics_for_prompt(self, generator, sample_metrics):
        """Test formatting metrics for LLM prompt."""
        formatted = generator._format_metrics_for_prompt(sample_metrics)
        
        assert "Posts:" in formatted
        assert "Average Engagement Rate:" in formatted
        assert "Total Reach:" in formatted
        assert "Total Impressions:" in formatted

    def test_format_metrics_for_prompt_empty_data(self, generator):
        """Test formatting empty metrics data."""
        empty_metrics = {}
        formatted = generator._format_metrics_for_prompt(empty_metrics)
        
        assert "Posts: 0 total" in formatted
        assert "Average Engagement Rate: 0.0%" in formatted

    def test_format_html_report(self, generator):
        """Test formatting HTML report."""
        report_content = {
            "content": "<h2>Test Report</h2><p>Test content</p>",
            "sections": {
                "executive_summary": True,
                "top_wins": True
            }
        }
        
        html = generator._format_html_report(report_content, "test_brand")
        
        assert "<!DOCTYPE html>" in html
        assert "test_brand" in html
        assert "Test Report" in html
        assert "Test content" in html

    def test_create_fallback_report(self, generator):
        """Test creating fallback report."""
        analysis = {
            "data_summary": {
                "total_posts": 5,
                "avg_engagement_rate": 0.03,
                "total_reach": 10000
            },
            "top_3_wins": [
                {
                    "title": "Test Win",
                    "description": "Test description",
                    "metric": "Engagement Rate",
                    "value": 0.05,
                    "improvement": 20.0
                }
            ],
            "bottom_2_problems": [
                {
                    "title": "Test Problem",
                    "description": "Test problem description",
                    "impact": "Medium",
                    "suggested_improvements": ["Improve content quality"]
                }
            ],
            "next_actions": [
                {
                    "title": "Test Action",
                    "description": "Test action description",
                    "priority": 1,
                    "timeline": "1 week",
                    "effort": "Medium",
                    "expected_impact": "High",
                    "specific_steps": ["Step 1", "Step 2"]
                }
            ],
            "optimal_posting_times": [
                {
                    "day": "Monday",
                    "time": "09:00",
                    "confidence": 0.8,
                    "expected_engagement": 0.04,
                    "reasoning": "Based on historical data"
                }
            ]
        }
        
        fallback = generator._create_fallback_report("test_brand", analysis)
        
        assert "content" in fallback
        assert "sections" in fallback
        assert "Test Win" in fallback["content"]
        assert "Test Problem" in fallback["content"]

    def test_create_error_report(self, generator):
        """Test creating error report."""
        error_report = generator._create_error_report("test_brand", "Test error message")
        
        assert error_report["brand_id"] == "test_brand"
        assert error_report["report_type"] == "error"
        assert "Test error message" in error_report["html"]

    def test_format_wins_html(self, generator):
        """Test formatting wins as HTML."""
        wins = [
            {
                "title": "Win 1",
                "description": "Description 1",
                "metric": "Engagement Rate",
                "value": 0.05,
                "improvement": 25.0
            },
            {
                "title": "Win 2",
                "description": "Description 2",
                "metric": "Reach",
                "value": 10000,
                "improvement": 15.0
            }
        ]
        
        html = generator._format_wins_html(wins)
        
        assert "Win 1" in html
        assert "Win 2" in html
        assert "Description 1" in html
        assert "Description 2" in html
        assert "25.0%" in html

    def test_format_wins_html_empty(self, generator):
        """Test formatting empty wins list."""
        html = generator._format_wins_html([])
        
        assert "No wins identified" in html

    def test_format_problems_html(self, generator):
        """Test formatting problems as HTML."""
        problems = [
            {
                "title": "Problem 1",
                "description": "Description 1",
                "impact": "High",
                "suggested_improvements": ["Improvement 1", "Improvement 2"]
            }
        ]
        
        html = generator._format_problems_html(problems)
        
        assert "Problem 1" in html
        assert "Description 1" in html
        assert "High" in html
        assert "Improvement 1" in html
        assert "Improvement 2" in html

    def test_format_actions_html(self, generator):
        """Test formatting actions as HTML."""
        actions = [
            {
                "title": "Action 1",
                "description": "Description 1",
                "priority": 1,
                "timeline": "1 week",
                "effort": "Medium",
                "expected_impact": "High",
                "specific_steps": ["Step 1", "Step 2"]
            }
        ]
        
        html = generator._format_actions_html(actions)
        
        assert "Action 1" in html
        assert "Description 1" in html
        assert "Priority 1" in html
        assert "1 week" in html
        assert "Step 1" in html

    def test_format_posting_times_html(self, generator):
        """Test formatting posting times as HTML."""
        posting_times = [
            {
                "day": "Monday",
                "time": "09:00",
                "confidence": 0.8,
                "expected_engagement": 0.04,
                "reasoning": "Based on data"
            }
        ]
        
        html = generator._format_posting_times_html(posting_times)
        
        assert "Monday" in html
        assert "09:00" in html
        assert "80%" in html
        assert "4.0%" in html
        assert "Based on data" in html

    @pytest.mark.asyncio
    async def test_generate_comprehensive_report(self, generator, sample_metrics):
        """Test generating comprehensive report content."""
        analysis = {
            "top_3_wins": [],
            "bottom_2_problems": [],
            "next_actions": [],
            "optimal_posting_times": []
        }
        
        with patch.object(generator.llm_client, 'generate_content') as mock_llm:
            mock_llm.return_value = "Test comprehensive report content"
            
            result = await generator._generate_comprehensive_report(
                "test_brand", sample_metrics, analysis
            )
            
            assert "content" in result
            assert "sections" in result
            assert result["content"] == "Test comprehensive report content"

    @pytest.mark.asyncio
    async def test_generate_executive_report(self, generator, sample_metrics):
        """Test generating executive report content."""
        analysis = {}
        
        with patch.object(generator.llm_client, 'generate_content') as mock_llm:
            mock_llm.return_value = "Test executive report content"
            
            result = await generator._generate_executive_report(
                "test_brand", sample_metrics, analysis
            )
            
            assert "content" in result
            assert "sections" in result
            assert result["content"] == "Test executive report content"

    @pytest.mark.asyncio
    async def test_generate_tactical_report(self, generator, sample_metrics):
        """Test generating tactical report content."""
        analysis = {}
        
        with patch.object(generator.llm_client, 'generate_content') as mock_llm:
            mock_llm.return_value = "Test tactical report content"
            
            result = await generator._generate_tactical_report(
                "test_brand", sample_metrics, analysis
            )
            
            assert "content" in result
            assert "sections" in result
            assert result["content"] == "Test tactical report content"

    @pytest.mark.asyncio
    async def test_generate_pdf_success(self, generator):
        """Test successful PDF generation."""
        html_content = "<html><body>Test content</body></html>"
        
        with patch('pdfkit.from_string') as mock_pdfkit:
            result = await generator._generate_pdf(html_content, "test_brand")
            
            assert result is not None
            mock_pdfkit.assert_called_once()

    @pytest.mark.asyncio
    async def test_generate_pdf_import_error(self, generator):
        """Test PDF generation when pdfkit is not available."""
        html_content = "<html><body>Test content</body></html>"
        
        with patch('pdfkit.from_string', side_effect=ImportError):
            result = await generator._generate_pdf(html_content, "test_brand")
            
            assert result is None

    @pytest.mark.asyncio
    async def test_generate_pdf_error(self, generator):
        """Test PDF generation error handling."""
        html_content = "<html><body>Test content</body></html>"
        
        with patch('pdfkit.from_string', side_effect=Exception("PDF error")):
            result = await generator._generate_pdf(html_content, "test_brand")
            
            assert result is None

    def test_create_sample_metrics(self, generator):
        """Test creating sample metrics."""
        sample = generator.analyst._create_sample_metrics()
        
        assert "posts" in sample
        assert "engagement" in sample
        assert "metrics" in sample
        assert len(sample["posts"]) == 1

    @pytest.mark.asyncio
    async def test_llm_client_integration(self, generator, sample_metrics):
        """Test integration with LLM client."""
        with patch.object(generator.llm_client, 'generate_content') as mock_llm:
            mock_llm.return_value = "Generated report content"
            
            # Test that LLM client is called during report generation
            await generator._generate_comprehensive_report(
                "test_brand", sample_metrics, {}
            )
            
            mock_llm.assert_called_once()

    def test_analyst_integration(self, generator, sample_metrics):
        """Test integration with MarketingAnalyst."""
        # Test that analyst is properly initialized
        assert generator.analyst is not None
        assert hasattr(generator.analyst, 'analyze_performance_data')

    @pytest.mark.asyncio
    async def test_report_generation_with_real_analysis(self, generator, sample_metrics):
        """Test report generation with real analysis data."""
        # This test would use the actual analyst to generate real analysis
        report = await generator.build_weekly_report(
            brand_id="test_brand",
            metrics_json=sample_metrics,
            report_type="comprehensive",
            include_pdf=False
        )
        
        # Verify that analysis data is included
        assert "analysis" in report
        assert report["analysis"] is not None



