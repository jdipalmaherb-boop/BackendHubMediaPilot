"""
Tests for the marketing analyst module.
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
from app.modules.analytics.marketing_analyst import MarketingAnalyst


class TestMarketingAnalyst:
    """Test cases for MarketingAnalyst."""

    @pytest.fixture
    def analyst(self):
        """MarketingAnalyst instance for testing."""
        return MarketingAnalyst()

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
                },
                {
                    "id": "post_3",
                    "content": "Low engagement post",
                    "platform": "twitter",
                    "engagement_rate": 0.015,
                    "reach": 5000,
                    "likes": 75,
                    "comments": 5,
                    "shares": 3,
                    "created_at": "2023-10-18T09:00:00Z"
                }
            ],
            "engagement": {
                "total_posts": 3,
                "avg_engagement_rate": 0.028,
                "total_reach": 23000
            },
            "metrics": {
                "impressions": 35000,
                "clicks": 700,
                "conversions": 35,
                "revenue": 3500.00
            },
            "platforms": {
                "instagram": 1,
                "facebook": 1,
                "twitter": 1
            }
        }

    @pytest.mark.asyncio
    async def test_analyze_performance_data_success(self, analyst, sample_metrics):
        """Test successful performance data analysis."""
        analysis = await analyst.analyze_performance_data(sample_metrics)
        
        assert "analysis_period" in analysis
        assert "data_summary" in analysis
        assert "top_3_wins" in analysis
        assert "bottom_2_problems" in analysis
        assert "next_actions" in analysis
        assert "optimal_posting_times" in analysis
        assert "performance_trends" in analysis
        assert "recommendations" in analysis

    @pytest.mark.asyncio
    async def test_analyze_performance_data_empty_metrics(self, analyst):
        """Test analysis with empty metrics."""
        empty_metrics = {"posts": [], "engagement": {}, "metrics": {}}
        analysis = await analyst.analyze_performance_data(empty_metrics)
        
        assert analysis["data_summary"]["total_posts"] == 0
        assert len(analysis["top_3_wins"]) > 0  # Should have fallback wins
        assert len(analysis["bottom_2_problems"]) > 0  # Should have fallback problems

    @pytest.mark.asyncio
    async def test_analyze_performance_data_invalid_json(self, analyst):
        """Test analysis with invalid JSON data."""
        invalid_metrics = "invalid json"
        analysis = await analyst.analyze_performance_data(invalid_metrics)
        
        # Should return fallback analysis
        assert "analysis_period" in analysis
        assert analysis["top_3_wins"][0]["title"] == "Analysis Error"

    def test_parse_metrics_data_valid(self, analyst):
        """Test parsing valid metrics data."""
        metrics = {
            "posts": [{"id": "1", "engagement_rate": 0.05}],
            "engagement": {"avg_engagement_rate": 0.05},
            "metrics": {"impressions": 1000}
        }
        
        parsed = analyst._parse_metrics_data(metrics)
        
        assert "posts" in parsed
        assert "engagement" in parsed
        assert "metrics" in parsed
        assert len(parsed["posts"]) == 1

    def test_parse_metrics_data_string(self, analyst):
        """Test parsing string JSON data."""
        metrics_str = '{"posts": [{"id": "1"}], "engagement": {}}'
        
        parsed = analyst._parse_metrics_data(metrics_str)
        
        assert "posts" in parsed
        assert "engagement" in parsed

    def test_identify_top_wins(self, analyst, sample_metrics):
        """Test identifying top wins."""
        wins = analyst._identify_top_wins(sample_metrics)
        
        assert len(wins) == 3
        assert wins[0]["title"] == "Top Performing Post #1"
        assert wins[0]["value"] == 0.045  # Highest engagement rate
        assert wins[0]["improvement"] > 0  # Should be positive improvement

    def test_identify_bottom_problems(self, analyst, sample_metrics):
        """Test identifying bottom problems."""
        problems = analyst._identify_bottom_problems(sample_metrics)
        
        assert len(problems) == 2
        assert problems[0]["title"] == "Underperforming Post #1"
        assert problems[0]["value"] == 0.015  # Lowest engagement rate
        assert "suggested_improvements" in problems[0]

    def test_generate_next_actions(self, analyst, sample_metrics):
        """Test generating next actions."""
        actions = analyst._generate_next_actions(sample_metrics)
        
        assert len(actions) == 5
        assert all(action["priority"] in [1, 2, 3, 4, 5] for action in actions)
        assert all("title" in action for action in actions)
        assert all("description" in action for action in actions)
        assert all("timeline" in action for action in actions)

    def test_predict_optimal_posting_times(self, analyst, sample_metrics):
        """Test predicting optimal posting times."""
        posting_times = analyst._predict_optimal_posting_times(sample_metrics)
        
        assert len(posting_times) > 0
        assert all("time" in time for time in posting_times)
        assert all("day" in time for time in posting_times)
        assert all("confidence" in time for time in posting_times)
        assert all("expected_engagement" in time for time in posting_times)

    def test_analyze_trends(self, analyst, sample_metrics):
        """Test analyzing performance trends."""
        trends = analyst._analyze_trends(sample_metrics)
        
        assert "engagement_trend" in trends
        assert "reach_trend" in trends
        assert "content_performance" in trends
        assert "platform_performance" in trends

    def test_calculate_improvement(self, analyst):
        """Test calculating improvement percentage."""
        posts = [
            {"engagement_rate": 0.05},
            {"engagement_rate": 0.03},
            {"engagement_rate": 0.04}
        ]
        
        improvement = analyst._calculate_improvement(posts[0], posts)
        assert improvement > 0  # Should be positive for highest engagement

    def test_calculate_impact(self, analyst):
        """Test calculating impact level."""
        posts = [
            {"engagement_rate": 0.01},  # Low engagement
            {"engagement_rate": 0.03},
            {"engagement_rate": 0.04}
        ]
        
        impact = analyst._calculate_impact(posts[0], posts)
        assert impact in ["Critical", "High", "Medium", "Low"]

    def test_suggest_improvements(self, analyst):
        """Test suggesting improvements for underperforming posts."""
        post = {"engagement_rate": 0.01, "reach": 500}
        
        improvements = analyst._suggest_improvements(post)
        
        assert len(improvements) > 0
        assert all(isinstance(improvement, str) for improvement in improvements)

    def test_calculate_trend(self, analyst):
        """Test calculating trend direction."""
        # Increasing trend
        increasing_values = [0.01, 0.02, 0.03, 0.04, 0.05]
        trend = analyst._calculate_trend(increasing_values)
        assert trend == "increasing"
        
        # Decreasing trend
        decreasing_values = [0.05, 0.04, 0.03, 0.02, 0.01]
        trend = analyst._calculate_trend(decreasing_values)
        assert trend == "decreasing"
        
        # Stable trend
        stable_values = [0.03, 0.03, 0.03, 0.03, 0.03]
        trend = analyst._calculate_trend(stable_values)
        assert trend == "stable"

    def test_analyze_content_performance(self, analyst):
        """Test analyzing content performance."""
        posts = [
            {"content": "Check out this video!", "engagement_rate": 0.05},
            {"content": "Amazing photo", "engagement_rate": 0.03},
            {"content": "Text post", "engagement_rate": 0.02}
        ]
        
        performance = analyst._analyze_content_performance(posts)
        
        assert "best_performing_type" in performance
        assert "type_performance" in performance
        assert "recommendations" in performance

    def test_create_fallback_analysis(self, analyst):
        """Test creating fallback analysis."""
        fallback = analyst._create_fallback_analysis()
        
        assert "analysis_period" in fallback
        assert "data_summary" in fallback
        assert "top_3_wins" in fallback
        assert "bottom_2_problems" in fallback
        assert "next_actions" in fallback
        assert "optimal_posting_times" in fallback

    def test_create_sample_metrics(self, analyst):
        """Test creating sample metrics."""
        sample = analyst._create_sample_metrics()
        
        assert "posts" in sample
        assert "engagement" in sample
        assert "metrics" in sample
        assert len(sample["posts"]) == 1

    def test_summarize_data(self, analyst, sample_metrics):
        """Test summarizing data."""
        summary = analyst._summarize_data(sample_metrics)
        
        assert "total_posts" in summary
        assert "total_reach" in summary
        assert "avg_engagement_rate" in summary
        assert "analysis_date" in summary

    def test_generate_recommendations(self, analyst, sample_metrics):
        """Test generating recommendations."""
        recommendations = analyst._generate_recommendations(sample_metrics)
        
        assert len(recommendations) > 0
        assert all(isinstance(rec, str) for rec in recommendations)

    @pytest.mark.asyncio
    async def test_analyze_performance_data_with_llm_error(self, analyst, sample_metrics):
        """Test analysis when LLM client fails."""
        with patch.object(analyst, '_parse_metrics_data') as mock_parse:
            mock_parse.side_effect = Exception("LLM Error")
            
            analysis = await analyst.analyze_performance_data(sample_metrics)
            
            # Should return fallback analysis
            assert analysis["top_3_wins"][0]["title"] == "Analysis Error"

    def test_extract_brand_from_prompt(self, analyst):
        """Test extracting brand from prompt."""
        prompt = "High-contrast cinematic 3/4 shot of a midnight-blue Audi RS5"
        brand = analyst.extract_brand_from_prompt(prompt)
        assert brand == "Audi"

    def test_suggest_hashtags(self, analyst):
        """Test suggesting hashtags."""
        prompt = "High-contrast cinematic 3/4 shot of a midnight-blue Audi RS5 on an urban wet street at dusk, shallow depth of field, dramatic rim lighting, brand logo subtly on hood, cinematic grading"
        hashtags = analyst.suggest_hashtags(prompt)
        
        assert len(hashtags) > 0
        assert all(hashtag.startswith("#") for hashtag in hashtags)
        assert "#audi" in hashtags
        assert "#cinematic" in hashtags



