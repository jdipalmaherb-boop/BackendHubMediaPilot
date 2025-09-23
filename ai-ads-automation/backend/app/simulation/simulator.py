"""
Simulation environment for offline testing of optimization algorithms.
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from app.core.logging import logger


class AdPlatformSimulator:
    """Simulates ad platform behavior for offline testing."""

    def __init__(self, seed: int = 42):
        np.random.seed(seed)
        logger.info("AdPlatformSimulator initialized with seed {seed}")

    def generate_campaign_data(
        self,
        campaign_id: str,
        start_date: datetime,
        end_date: datetime,
        budget_daily: float,
        targeting_criteria: Dict[str, Any],
        creative_variations: List[Dict[str, Any]]
    ) -> pd.DataFrame:
        """Generate synthetic campaign performance data."""
        logger.info(f"Generating campaign data for {campaign_id}")
        
        # Generate date range
        dates = pd.date_range(start=start_date, end=end_date, freq='D')
        
        # Simulate performance metrics
        data = []
        for date in dates:
            # Base performance metrics with some randomness
            base_roas = 2.0 + np.random.normal(0, 0.3)
            base_cpa = 15.0 + np.random.normal(0, 3.0)
            base_ctr = 0.05 + np.random.normal(0, 0.01)
            
            # Adjust based on targeting criteria
            if targeting_criteria.get('interests', []):
                base_roas += 0.2  # Better targeting improves ROAS
                base_cpa -= 2.0   # Better targeting reduces CPA
            
            # Adjust based on creative variations
            if creative_variations:
                base_ctr += 0.01  # More creatives can improve CTR
            
            # Calculate derived metrics
            spend = budget_daily * (0.8 + np.random.normal(0, 0.1))  # Some daily variation
            impressions = int(spend * 1000 / (base_ctr * 100))  # Rough calculation
            clicks = int(impressions * base_ctr)
            conversions = int(clicks * (base_roas / base_cpa))  # Rough calculation
            
            data.append({
                'date': date,
                'campaign_id': campaign_id,
                'spend': spend,
                'impressions': impressions,
                'clicks': clicks,
                'conversions': conversions,
                'roas': base_roas,
                'cpa': base_cpa,
                'ctr': base_ctr,
                'cpm': spend / impressions * 1000 if impressions > 0 else 0
            })
        
        return pd.DataFrame(data)

    def simulate_audience_performance(
        self,
        audience_id: str,
        demographics: Dict[str, Any],
        interests: List[str],
        days: int = 30
    ) -> pd.DataFrame:
        """Simulate audience performance over time."""
        logger.info(f"Simulating audience performance for {audience_id}")
        
        # Generate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        dates = pd.date_range(start=start_date, end=end_date, freq='D')
        
        # Simulate audience-specific performance
        data = []
        for date in dates:
            # Base performance varies by audience characteristics
            base_roas = 1.5 + np.random.normal(0, 0.2)
            base_cpa = 20.0 + np.random.normal(0, 4.0)
            
            # Adjust based on demographics
            if demographics.get('age_min', 0) > 30:
                base_roas += 0.3  # Older audiences often have higher ROAS
                base_cpa -= 3.0
            
            # Adjust based on interests
            if 'technology' in interests:
                base_roas += 0.2
                base_cpa -= 2.0
            
            data.append({
                'date': date,
                'audience_id': audience_id,
                'roas': base_roas,
                'cpa': base_cpa,
                'reach': int(1000000 * (0.8 + np.random.normal(0, 0.1)))
            })
        
        return pd.DataFrame(data)

    def simulate_creative_performance(
        self,
        creative_id: str,
        creative_type: str,
        ad_copy: Dict[str, str],
        days: int = 30
    ) -> pd.DataFrame:
        """Simulate creative performance over time."""
        logger.info(f"Simulating creative performance for {creative_id}")
        
        # Generate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        dates = pd.date_range(start=start_date, end=end_date, freq='D')
        
        # Simulate creative-specific performance
        data = []
        for date in dates:
            # Base performance varies by creative type
            if creative_type == 'video':
                base_ctr = 0.06 + np.random.normal(0, 0.01)
                base_cpm = 12.0 + np.random.normal(0, 2.0)
            else:  # image
                base_ctr = 0.04 + np.random.normal(0, 0.01)
                base_cpm = 8.0 + np.random.normal(0, 1.5)
            
            # Adjust based on ad copy quality
            if 'buy now' in ad_copy.get('cta_text', '').lower():
                base_ctr += 0.01  # Strong CTA improves CTR
            
            if 'limited time' in ad_copy.get('primary_text', '').lower():
                base_ctr += 0.005  # Urgency improves CTR
            
            data.append({
                'date': date,
                'creative_id': creative_id,
                'ctr': base_ctr,
                'cpm': base_cpm,
                'engagement_score': 0.7 + np.random.normal(0, 0.1)
            })
        
        return pd.DataFrame(data)


class OptimizationSimulator:
    """Simulates optimization algorithms for offline testing."""

    def __init__(self, seed: int = 42):
        np.random.seed(seed)
        logger.info("OptimizationSimulator initialized with seed {seed}")

    def simulate_contextual_bandit(
        self,
        arms: List[str],
        contexts: List[Dict[str, Any]],
        num_rounds: int = 100
    ) -> Dict[str, Any]:
        """Simulate contextual bandit optimization."""
        logger.info(f"Simulating contextual bandit with {len(arms)} arms for {num_rounds} rounds")
        
        # Initialize arm parameters
        arm_params = {arm: {'alpha': 1, 'beta': 1} for arm in arms}
        rewards = {arm: [] for arm in arms}
        selections = []
        
        for round_num in range(num_rounds):
            # Select arm using Thompson sampling
            arm_scores = {}
            for arm in arms:
                alpha, beta = arm_params[arm]['alpha'], arm_params[arm]['beta']
                arm_scores[arm] = np.random.beta(alpha, beta)
            
            selected_arm = max(arm_scores, key=arm_scores.get)
            selections.append(selected_arm)
            
            # Simulate reward (in real scenario, this would come from actual performance)
            reward = self._simulate_reward(selected_arm, contexts[round_num % len(contexts)])
            rewards[selected_arm].append(reward)
            
            # Update arm parameters
            if reward > 0:
                arm_params[selected_arm]['alpha'] += 1
            else:
                arm_params[selected_arm]['beta'] += 1
        
        return {
            'selections': selections,
            'rewards': rewards,
            'arm_params': arm_params,
            'total_reward': sum(sum(rewards[arm]) for arm in arms)
        }

    def simulate_rl_policy(
        self,
        state_space: List[Dict[str, Any]],
        action_space: List[str],
        num_episodes: int = 100
    ) -> Dict[str, Any]:
        """Simulate reinforcement learning policy optimization."""
        logger.info(f"Simulating RL policy with {len(state_space)} states and {len(action_space)} actions for {num_episodes} episodes")
        
        # Initialize Q-table
        q_table = {state: {action: 0.0 for action in action_space} for state in state_space}
        
        # Simulate episodes
        episode_rewards = []
        for episode in range(num_episodes):
            state = state_space[episode % len(state_space)]
            action = self._select_action(q_table[state], action_space)
            reward = self._simulate_reward(action, state)
            
            # Update Q-table (simplified Q-learning)
            q_table[state][action] += 0.1 * (reward - q_table[state][action])
            
            episode_rewards.append(reward)
        
        return {
            'q_table': q_table,
            'episode_rewards': episode_rewards,
            'average_reward': np.mean(episode_rewards)
        }

    def _simulate_reward(self, action: str, context: Dict[str, Any]) -> float:
        """Simulate reward for a given action and context."""
        # Base reward varies by action
        base_reward = {
            'increase_budget': 0.1,
            'decrease_budget': -0.05,
            'pause_creative': -0.1,
            'scale_creative': 0.15,
            'adjust_bid': 0.05
        }.get(action, 0.0)
        
        # Add some randomness
        noise = np.random.normal(0, 0.1)
        return base_reward + noise

    def _select_action(self, q_values: Dict[str, float], action_space: List[str]) -> str:
        """Select action using epsilon-greedy strategy."""
        epsilon = 0.1
        if np.random.random() < epsilon:
            return np.random.choice(action_space)
        else:
            return max(action_space, key=lambda a: q_values[a])


class SimulationRunner:
    """Runs comprehensive simulations for testing optimization algorithms."""

    def __init__(self, seed: int = 42):
        self.platform_simulator = AdPlatformSimulator(seed)
        self.optimization_simulator = OptimizationSimulator(seed)
        logger.info("SimulationRunner initialized")

    def run_campaign_simulation(
        self,
        campaign_config: Dict[str, Any],
        optimization_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Run a complete campaign simulation."""
        logger.info("Running campaign simulation")
        
        # Generate campaign data
        campaign_data = self.platform_simulator.generate_campaign_data(
            campaign_id=campaign_config['campaign_id'],
            start_date=campaign_config['start_date'],
            end_date=campaign_config['end_date'],
            budget_daily=campaign_config['budget_daily'],
            targeting_criteria=campaign_config['targeting_criteria'],
            creative_variations=campaign_config['creative_variations']
        )
        
        # Run optimization simulation
        optimization_results = self.optimization_simulator.simulate_contextual_bandit(
            arms=optimization_config['arms'],
            contexts=optimization_config['contexts'],
            num_rounds=optimization_config['num_rounds']
        )
        
        return {
            'campaign_data': campaign_data.to_dict('records'),
            'optimization_results': optimization_results,
            'simulation_summary': {
                'total_days': len(campaign_data),
                'total_spend': campaign_data['spend'].sum(),
                'total_conversions': campaign_data['conversions'].sum(),
                'average_roas': campaign_data['roas'].mean(),
                'average_cpa': campaign_data['cpa'].mean()
            }
        }

    def run_audience_simulation(
        self,
        audience_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Run audience performance simulation."""
        logger.info("Running audience simulation")
        
        # Generate audience data
        audience_data = self.platform_simulator.simulate_audience_performance(
            audience_id=audience_config['audience_id'],
            demographics=audience_config['demographics'],
            interests=audience_config['interests'],
            days=audience_config.get('days', 30)
        )
        
        return {
            'audience_data': audience_data.to_dict('records'),
            'simulation_summary': {
                'total_days': len(audience_data),
                'average_roas': audience_data['roas'].mean(),
                'average_cpa': audience_data['cpa'].mean(),
                'average_reach': audience_data['reach'].mean()
            }
        }

    def run_creative_simulation(
        self,
        creative_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Run creative performance simulation."""
        logger.info("Running creative simulation")
        
        # Generate creative data
        creative_data = self.platform_simulator.simulate_creative_performance(
            creative_id=creative_config['creative_id'],
            creative_type=creative_config['creative_type'],
            ad_copy=creative_config['ad_copy'],
            days=creative_config.get('days', 30)
        )
        
        return {
            'creative_data': creative_data.to_dict('records'),
            'simulation_summary': {
                'total_days': len(creative_data),
                'average_ctr': creative_data['ctr'].mean(),
                'average_cpm': creative_data['cpm'].mean(),
                'average_engagement': creative_data['engagement_score'].mean()
            }
        }



