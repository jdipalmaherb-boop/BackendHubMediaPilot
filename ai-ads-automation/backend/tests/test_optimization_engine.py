"""
Tests for the Optimization Engine module.
"""

import pytest
from unittest.mock import Mock, patch
from app.modules.optimization.engine import OptimizationEngine
from app.modules.optimization.contextual_bandit import ContextualBanditOptimizer
from app.modules.optimization.rl_policy import RLBudgetPolicy
from app.modules.optimization.budget_allocator import BudgetAllocator
from app.schemas.optimization import CampaignOptimizeRequest, AdGroupOptimizeRequest


class TestOptimizationEngine:
    """Test cases for OptimizationEngine."""

    @pytest.fixture
    def mock_contextual_bandit(self):
        """Mock contextual bandit for testing."""
        bandit = Mock(spec=ContextualBanditOptimizer)
        bandit.select_best_action.return_value = {
            "action_taken": {"type": "budget_adjust", "old_value": 100, "new_value": 120},
            "new_bidding_strategy": {"strategy": "target_cpa", "target_cpa": 15.0},
            "creatives_to_pause": [],
            "creatives_to_scale": ["creative_1"],
            "audiences_to_pause": [],
            "audiences_to_scale": ["audience_1"],
            "predicted_impact": {"roas_improvement": 0.1, "cpa_reduction": 2.0}
        }
        return bandit

    @pytest.fixture
    def mock_rl_policy(self):
        """Mock RL policy for testing."""
        policy = Mock(spec=RLBudgetPolicy)
        policy.allocate_campaign_budget.return_value = {
            "ad_group_1": 120.0,
            "ad_group_2": 80.0
        }
        return policy

    @pytest.fixture
    def mock_budget_allocator(self):
        """Mock budget allocator for testing."""
        allocator = Mock(spec=BudgetAllocator)
        return allocator

    @pytest.fixture
    def optimization_engine(self, mock_contextual_bandit, mock_rl_policy, mock_budget_allocator):
        """OptimizationEngine instance with mocked dependencies."""
        return OptimizationEngine(
            contextual_bandit=mock_contextual_bandit,
            rl_policy=mock_rl_policy,
            budget_allocator=mock_budget_allocator
        )

    @pytest.mark.asyncio
    async def test_optimize_campaign(self, optimization_engine):
        """Test optimizing campaign."""
        request = CampaignOptimizeRequest(
            campaign_id="test_campaign",
            campaign_goal="lead_generation",
            current_ad_groups_performance=[
                {"ad_group_id": "ad_group_1", "budget_daily": 100.0, "roas": 2.0, "cpa": 15.0},
                {"ad_group_id": "ad_group_2", "budget_daily": 100.0, "roas": 1.8, "cpa": 18.0}
            ],
            total_campaign_budget=200.0,
            user_rules=[]
        )

        result = await optimization_engine.optimize_campaign(request)

        assert result.campaign_id == "test_campaign"
        assert "ad_group_1" in result.new_ad_group_budgets
        assert "ad_group_2" in result.new_ad_group_budgets
        assert len(result.optimization_logs) > 0
        assert len(result.recommendations) > 0

    @pytest.mark.asyncio
    async def test_optimize_ad_group(self, optimization_engine):
        """Test optimizing ad group."""
        request = AdGroupOptimizeRequest(
            campaign_id="test_campaign",
            ad_group_id="test_ad_group",
            platform="meta",
            campaign_goal="lead_generation",
            current_creatives_performance=[
                {"creative_id": "creative_1", "ctr": 0.05, "cpa": 15.0},
                {"creative_id": "creative_2", "ctr": 0.03, "cpa": 20.0}
            ],
            current_audiences_performance=[
                {"audience_id": "audience_1", "roas": 2.0, "cpa": 15.0},
                {"audience_id": "audience_2", "roas": 1.5, "cpa": 25.0}
            ],
            current_bidding_strategy={"strategy": "target_cpa", "target_cpa": 15.0},
            user_rules=[]
        )

        result = await optimization_engine.optimize_ad_group(request)

        assert result.ad_group_id == "test_ad_group"
        assert result.new_bidding_strategy == {"strategy": "target_cpa", "target_cpa": 15.0}
        assert "creative_1" in result.creatives_to_scale
        assert len(result.optimization_logs) > 0
        assert result.predicted_performance_impact is not None

    @pytest.mark.asyncio
    async def test_optimize_campaign_exception(self, optimization_engine):
        """Test handling exception during campaign optimization."""
        optimization_engine.rl_policy.allocate_campaign_budget.side_effect = Exception("RL policy error")

        request = CampaignOptimizeRequest(
            campaign_id="test_campaign",
            campaign_goal="lead_generation",
            current_ad_groups_performance=[],
            total_campaign_budget=200.0,
            user_rules=[]
        )

        with pytest.raises(Exception):
            await optimization_engine.optimize_campaign(request)

    @pytest.mark.asyncio
    async def test_optimize_ad_group_exception(self, optimization_engine):
        """Test handling exception during ad group optimization."""
        optimization_engine.contextual_bandit.select_best_action.side_effect = Exception("Bandit error")

        request = AdGroupOptimizeRequest(
            campaign_id="test_campaign",
            ad_group_id="test_ad_group",
            platform="meta",
            campaign_goal="lead_generation",
            current_creatives_performance=[],
            current_audiences_performance=[],
            current_bidding_strategy={},
            user_rules=[]
        )

        with pytest.raises(Exception):
            await optimization_engine.optimize_ad_group(request)



