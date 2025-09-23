"""
Tests for the Simulation module.
"""

import pytest
from unittest.mock import Mock, patch
from app.simulation.simulator import AdPlatformSimulator, OptimizationSimulator, SimulationRunner


class TestAdPlatformSimulator:
    """Test cases for AdPlatformSimulator."""

    @pytest.fixture
    def simulator(self):
        """AdPlatformSimulator instance for testing."""
        return AdPlatformSimulator(seed=42)

    def test_generate_campaign_data(self, simulator):
        """Test generating campaign data."""
        from datetime import datetime, timedelta
        
        start_date = datetime(2023, 10, 1)
        end_date = datetime(2023, 10, 31)
        budget_daily = 100.0
        targeting_criteria = {
            "demographics": {"age_min": 25, "age_max": 45},
            "interests": ["technology", "marketing"]
        }
        creative_variations = [
            {"type": "image", "headline": "Test Headline 1"},
            {"type": "video", "headline": "Test Headline 2"}
        ]

        result = simulator.generate_campaign_data(
            campaign_id="test_campaign",
            start_date=start_date,
            end_date=end_date,
            budget_daily=budget_daily,
            targeting_criteria=targeting_criteria,
            creative_variations=creative_variations
        )

        assert len(result) == 31  # 31 days in October
        assert all("date" in row for row in result)
        assert all("campaign_id" in row for row in result)
        assert all("spend" in row for row in result)
        assert all("impressions" in row for row in result)
        assert all("clicks" in row for row in result)
        assert all("conversions" in row for row in result)
        assert all("roas" in row for row in result)
        assert all("cpa" in row for row in result)
        assert all("ctr" in row for row in result)
        assert all("cpm" in row for row in result)

    def test_simulate_audience_performance(self, simulator):
        """Test simulating audience performance."""
        demographics = {"age_min": 25, "age_max": 45, "gender": "any"}
        interests = ["technology", "marketing", "AI"]
        days = 30

        result = simulator.simulate_audience_performance(
            audience_id="test_audience",
            demographics=demographics,
            interests=interests,
            days=days
        )

        assert len(result) == days
        assert all("date" in row for row in result)
        assert all("audience_id" in row for row in result)
        assert all("roas" in row for row in result)
        assert all("cpa" in row for row in result)
        assert all("reach" in row for row in result)

    def test_simulate_creative_performance(self, simulator):
        """Test simulating creative performance."""
        creative_type = "video"
        ad_copy = {
            "headline": "Amazing Product Offer",
            "primary_text": "Limited time offer! Get 50% off today!",
            "cta_text": "Buy Now"
        }
        days = 30

        result = simulator.simulate_creative_performance(
            creative_id="test_creative",
            creative_type=creative_type,
            ad_copy=ad_copy,
            days=days
        )

        assert len(result) == days
        assert all("date" in row for row in result)
        assert all("creative_id" in row for row in result)
        assert all("ctr" in row for row in result)
        assert all("cpm" in row for row in result)
        assert all("engagement_score" in row for row in result)


class TestOptimizationSimulator:
    """Test cases for OptimizationSimulator."""

    @pytest.fixture
    def simulator(self):
        """OptimizationSimulator instance for testing."""
        return OptimizationSimulator(seed=42)

    def test_simulate_contextual_bandit(self, simulator):
        """Test simulating contextual bandit optimization."""
        arms = ["creative_1", "creative_2", "audience_1", "audience_2"]
        contexts = [
            {"time_of_day": "morning", "day_of_week": "weekday"},
            {"time_of_day": "evening", "day_of_week": "weekend"}
        ]
        num_rounds = 100

        result = simulator.simulate_contextual_bandit(
            arms=arms,
            contexts=contexts,
            num_rounds=num_rounds
        )

        assert "selections" in result
        assert "rewards" in result
        assert "arm_params" in result
        assert "total_reward" in result
        assert len(result["selections"]) == num_rounds
        assert all(arm in result["rewards"] for arm in arms)
        assert all(arm in result["arm_params"] for arm in arms)

    def test_simulate_rl_policy(self, simulator):
        """Test simulating RL policy optimization."""
        state_space = [
            {"budget": 100, "performance": "good"},
            {"budget": 200, "performance": "poor"}
        ]
        action_space = ["increase_budget", "decrease_budget", "pause_creative"]
        num_episodes = 100

        result = simulator.simulate_rl_policy(
            state_space=state_space,
            action_space=action_space,
            num_episodes=num_episodes
        )

        assert "q_table" in result
        assert "episode_rewards" in result
        assert "average_reward" in result
        assert len(result["episode_rewards"]) == num_episodes
        assert all(state in result["q_table"] for state in state_space)
        assert all(action in result["q_table"][state] for state in state_space for action in action_space)


class TestSimulationRunner:
    """Test cases for SimulationRunner."""

    @pytest.fixture
    def runner(self):
        """SimulationRunner instance for testing."""
        return SimulationRunner(seed=42)

    def test_run_campaign_simulation(self, runner):
        """Test running campaign simulation."""
        from datetime import datetime
        
        campaign_config = {
            "campaign_id": "test_campaign",
            "start_date": datetime(2023, 10, 1),
            "end_date": datetime(2023, 10, 31),
            "budget_daily": 100.0,
            "targeting_criteria": {
                "demographics": {"age_min": 25, "age_max": 45},
                "interests": ["technology", "marketing"]
            },
            "creative_variations": [
                {"type": "image", "headline": "Test Headline"}
            ]
        }
        
        optimization_config = {
            "arms": ["creative_1", "creative_2"],
            "contexts": [{"time_of_day": "morning"}],
            "num_rounds": 100
        }

        result = runner.run_campaign_simulation(campaign_config, optimization_config)

        assert "campaign_data" in result
        assert "optimization_results" in result
        assert "simulation_summary" in result
        assert len(result["campaign_data"]) == 31  # 31 days in October
        assert result["simulation_summary"]["total_days"] == 31

    def test_run_audience_simulation(self, runner):
        """Test running audience simulation."""
        audience_config = {
            "audience_id": "test_audience",
            "demographics": {"age_min": 25, "age_max": 45, "gender": "any"},
            "interests": ["technology", "marketing", "AI"],
            "days": 30
        }

        result = runner.run_audience_simulation(audience_config)

        assert "audience_data" in result
        assert "simulation_summary" in result
        assert len(result["audience_data"]) == 30
        assert result["simulation_summary"]["total_days"] == 30

    def test_run_creative_simulation(self, runner):
        """Test running creative simulation."""
        creative_config = {
            "creative_id": "test_creative",
            "creative_type": "video",
            "ad_copy": {
                "headline": "Amazing Product Offer",
                "primary_text": "Limited time offer! Get 50% off today!",
                "cta_text": "Buy Now"
            },
            "days": 30
        }

        result = runner.run_creative_simulation(creative_config)

        assert "creative_data" in result
        assert "simulation_summary" in result
        assert len(result["creative_data"]) == 30
        assert result["simulation_summary"]["total_days"] == 30



