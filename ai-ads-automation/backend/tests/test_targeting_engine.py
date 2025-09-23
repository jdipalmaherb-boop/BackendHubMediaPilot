"""
Tests for the Targeting & Audience Engine module.
"""

import pytest
from unittest.mock import Mock, patch
from app.modules.targeting.engine import TargetingEngine
from app.modules.targeting.audience_analyzer import AudienceAnalyzer
from app.modules.targeting.ml_optimizer import MLTargetingOptimizer
from app.schemas.targeting import TargetingSuggestRequest, AudienceOptimizeRequest


class TestTargetingEngine:
    """Test cases for TargetingEngine."""

    @pytest.fixture
    def mock_audience_analyzer(self):
        """Mock audience analyzer for testing."""
        analyzer = Mock(spec=AudienceAnalyzer)
        analyzer.analyze_audience_data.return_value = {
            "initial_criteria": {"demographics": {"age_min": 25, "age_max": 45}},
            "platform": "meta",
            "campaign_goal": "lead_generation",
            "llm_analysis": {
                "key_demographics": ["Age 25-45", "Tech Enthusiasts"],
                "pain_points": ["Lack of time", "Ineffective marketing"],
                "segmentation_suggestions": ["Lookalike audiences", "Retargeting segments"],
                "estimated_size": "medium"
            },
            "estimated_reach": 250000,
            "predicted_cpa_range": (10.0, 20.0)
        }
        return analyzer

    @pytest.fixture
    def mock_ml_optimizer(self):
        """Mock ML optimizer for testing."""
        optimizer = Mock(spec=MLTargetingOptimizer)
        optimizer.optimize_targeting_suggestions.return_value = []
        optimizer.refine_audience_criteria.return_value = (
            {"demographics": {"age_min": 25, "age_max": 45}},
            {"predicted_reach": 950000, "predicted_cpa": 18.5}
        )
        return optimizer

    @pytest.fixture
    def targeting_engine(self, mock_audience_analyzer, mock_ml_optimizer):
        """TargetingEngine instance with mocked dependencies."""
        return TargetingEngine(
            audience_analyzer=mock_audience_analyzer,
            ml_optimizer=mock_ml_optimizer
        )

    @pytest.mark.asyncio
    async def test_suggest_targeting(self, targeting_engine):
        """Test suggesting targeting."""
        request = TargetingSuggestRequest(
            campaign_id="test_campaign",
            platform="meta",
            campaign_goal="lead_generation",
            initial_audience_criteria={
                "demographics": {"age_min": 25, "age_max": 45},
                "interests": ["technology", "marketing"]
            },
            num_suggestions=3
        )

        result = await targeting_engine.suggest_targeting(request)

        assert isinstance(result, list)
        targeting_engine.audience_analyzer.analyze_audience_data.assert_called_once()
        targeting_engine.ml_optimizer.optimize_targeting_suggestions.assert_called_once()

    @pytest.mark.asyncio
    async def test_optimize_audience(self, targeting_engine):
        """Test optimizing audience."""
        request = AudienceOptimizeRequest(
            audience_id="test_audience",
            platform="meta",
            current_criteria={
                "demographics": {"age_min": 25, "age_max": 45},
                "interests": ["technology", "marketing"]
            },
            recent_performance_data=[
                {"date": "2023-10-26", "spend": 100.0, "clicks": 500, "conversions": 10, "cpa": 10.0},
                {"date": "2023-10-25", "spend": 120.0, "clicks": 600, "conversions": 8, "cpa": 15.0}
            ],
            campaign_goal="lead_generation"
        )

        result = await targeting_engine.optimize_audience(request)

        assert result.audience_id == "test_audience"
        assert result.optimized_criteria == {"demographics": {"age_min": 25, "age_max": 45}}
        assert result.predicted_reach == 950000
        assert result.predicted_cpa == 18.5

    @pytest.mark.asyncio
    async def test_suggest_targeting_exception(self, targeting_engine):
        """Test handling exception during targeting suggestion."""
        targeting_engine.audience_analyzer.analyze_audience_data.side_effect = Exception("Analysis error")

        request = TargetingSuggestRequest(
            campaign_id="test_campaign",
            platform="meta",
            campaign_goal="lead_generation",
            initial_audience_criteria={"demographics": {"age_min": 25, "age_max": 45}},
            num_suggestions=3
        )

        with pytest.raises(Exception):
            await targeting_engine.suggest_targeting(request)

    @pytest.mark.asyncio
    async def test_optimize_audience_exception(self, targeting_engine):
        """Test handling exception during audience optimization."""
        targeting_engine.ml_optimizer.refine_audience_criteria.side_effect = Exception("Optimization error")

        request = AudienceOptimizeRequest(
            audience_id="test_audience",
            platform="meta",
            current_criteria={"demographics": {"age_min": 25, "age_max": 45}},
            recent_performance_data=[],
            campaign_goal="lead_generation"
        )

        with pytest.raises(Exception):
            await targeting_engine.optimize_audience(request)



