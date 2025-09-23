"""
Contextual Bandit implementation for bid optimization.
"""

import asyncio
import numpy as np
from typing import Any, Dict, List, Optional, Tuple

from app.core.logging import get_logger


class ContextualBandit:
    """Contextual Bandit for bid strategy optimization."""
    
    def __init__(self, n_arms: int = 5, context_dim: int = 10):
        self.n_arms = n_arms  # Number of bid strategies
        self.context_dim = context_dim  # Context dimension
        self.logger = get_logger("contextual_bandit")
        
        # Initialize parameters
        self.alpha = 1.0  # Prior parameter for reward
        self.beta = 1.0   # Prior parameter for reward
        self.theta = np.random.normal(0, 1, (context_dim, n_arms))  # Context weights
        self.A = np.eye(context_dim)  # Precision matrix
        self.b = np.zeros((context_dim, n_arms))  # Precision-weighted sum
        
        # Track performance
        self.total_rewards = 0
        self.total_pulls = 0
        self.arm_counts = np.zeros(n_arms)
        self.arm_rewards = np.zeros(n_arms)
    
    async def optimize_bid_strategy(
        self,
        campaign: Any,
        performance_data: Dict[str, Any],
        optimization_goals: Dict[str, Any],
        constraints: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Optimize bid strategy using contextual bandit."""
        
        # Extract context features
        context = self._extract_context_features(campaign, performance_data, optimization_goals)
        
        # Select arm (bid strategy)
        arm = await self._select_arm(context)
        
        # Get reward for selected arm
        reward = await self._calculate_reward(arm, performance_data, optimization_goals)
        
        # Update model
        await self._update_model(context, arm, reward)
        
        # Generate recommendations
        recommendations = await self._generate_recommendations(arm, context, reward)
        
        return {
            "selected_strategy": arm,
            "strategy_name": self._get_strategy_name(arm),
            "confidence": self._calculate_confidence(context, arm),
            "expected_reward": self._predict_reward(context, arm),
            "recommendations": recommendations
        }
    
    def _extract_context_features(
        self,
        campaign: Any,
        performance_data: Dict[str, Any],
        optimization_goals: Dict[str, Any]
    ) -> np.ndarray:
        """Extract context features for the bandit."""
        
        features = np.zeros(self.context_dim)
        
        # Campaign features
        features[0] = campaign.budget_daily / 1000  # Normalized daily budget
        features[1] = 1 if campaign.goal.value == "sales" else 0  # Sales goal
        features[2] = 1 if campaign.goal.value == "lead_generation" else 0  # Lead gen goal
        features[3] = campaign.roas_target or 0  # ROAS target
        
        # Performance features
        features[4] = performance_data.get("average_roas", 0)  # Current ROAS
        features[5] = performance_data.get("average_cpa", 0) / 100  # Normalized CPA
        features[6] = performance_data.get("total_conversions", 0) / 1000  # Normalized conversions
        features[7] = performance_data.get("total_clicks", 0) / 10000  # Normalized clicks
        
        # Platform features
        features[8] = 1 if campaign.platform.value == "meta" else 0  # Meta platform
        features[9] = 1 if campaign.platform.value == "google" else 0  # Google platform
        
        return features
    
    async def _select_arm(self, context: np.ndarray) -> int:
        """Select arm using Thompson sampling."""
        
        # Calculate posterior parameters
        A_inv = np.linalg.inv(self.A)
        theta_hat = A_inv @ self.b
        
        # Sample from posterior
        theta_samples = np.random.multivariate_normal(
            theta_hat.flatten(),
            np.kron(A_inv, np.eye(self.n_arms))
        ).reshape(self.context_dim, self.n_arms)
        
        # Calculate expected rewards
        expected_rewards = context @ theta_samples
        
        # Select arm with highest expected reward
        arm = np.argmax(expected_rewards)
        
        return arm
    
    async def _calculate_reward(
        self,
        arm: int,
        performance_data: Dict[str, Any],
        optimization_goals: Dict[str, Any]
    ) -> float:
        """Calculate reward for the selected arm."""
        
        # Base reward calculation
        base_reward = 0.0
        
        # ROAS-based reward
        if optimization_goals.get("maximize_roas"):
            roas = performance_data.get("average_roas", 0)
            base_reward += min(roas / 5.0, 1.0)  # Normalize to [0, 1]
        
        # CPA-based reward
        if optimization_goals.get("minimize_cpa"):
            cpa = performance_data.get("average_cpa", 0)
            base_reward += max(0, 1 - cpa / 50.0)  # Normalize to [0, 1]
        
        # Conversion-based reward
        if optimization_goals.get("maximize_conversions"):
            conversions = performance_data.get("total_conversions", 0)
            base_reward += min(conversions / 100.0, 1.0)  # Normalize to [0, 1]
        
        # Add noise for exploration
        noise = np.random.normal(0, 0.1)
        reward = base_reward + noise
        
        # Clip to [0, 1]
        reward = np.clip(reward, 0, 1)
        
        return reward
    
    async def _update_model(self, context: np.ndarray, arm: int, reward: float):
        """Update the bandit model with new observation."""
        
        # Update precision matrix
        self.A += np.outer(context, context)
        
        # Update precision-weighted sum
        self.b[:, arm] += context * reward
        
        # Update tracking variables
        self.total_rewards += reward
        self.total_pulls += 1
        self.arm_counts[arm] += 1
        self.arm_rewards[arm] += reward
    
    async def _generate_recommendations(
        self,
        arm: int,
        context: np.ndarray,
        reward: float
    ) -> List[Dict[str, Any]]:
        """Generate recommendations based on the selected arm."""
        
        recommendations = []
        
        # Strategy-specific recommendations
        if arm == 0:  # Target CPA
            recommendations.append({
                "type": "bid_strategy",
                "action": "set_target_cpa",
                "value": 15.0,
                "reason": "Target CPA strategy for cost control"
            })
        elif arm == 1:  # Target ROAS
            recommendations.append({
                "type": "bid_strategy",
                "action": "set_target_roas",
                "value": 3.0,
                "reason": "Target ROAS strategy for revenue optimization"
            })
        elif arm == 2:  # Maximize conversions
            recommendations.append({
                "type": "bid_strategy",
                "action": "maximize_conversions",
                "value": None,
                "reason": "Maximize conversions strategy for volume"
            })
        elif arm == 3:  # Maximize clicks
            recommendations.append({
                "type": "bid_strategy",
                "action": "maximize_clicks",
                "value": None,
                "reason": "Maximize clicks strategy for reach"
            })
        elif arm == 4:  # Manual CPC
            recommendations.append({
                "type": "bid_strategy",
                "action": "set_manual_cpc",
                "value": 2.0,
                "reason": "Manual CPC strategy for direct control"
            })
        
        # Performance-based recommendations
        if reward > 0.7:
            recommendations.append({
                "type": "performance",
                "action": "scale_budget",
                "value": 1.2,
                "reason": "High performance detected, consider scaling"
            })
        elif reward < 0.3:
            recommendations.append({
                "type": "performance",
                "action": "reduce_budget",
                "value": 0.8,
                "reason": "Low performance detected, consider reducing budget"
            })
        
        return recommendations
    
    def _get_strategy_name(self, arm: int) -> str:
        """Get human-readable strategy name."""
        
        strategy_names = {
            0: "Target CPA",
            1: "Target ROAS",
            2: "Maximize Conversions",
            3: "Maximize Clicks",
            4: "Manual CPC"
        }
        
        return strategy_names.get(arm, f"Strategy {arm}")
    
    def _calculate_confidence(self, context: np.ndarray, arm: int) -> float:
        """Calculate confidence in the selected arm."""
        
        # Calculate posterior variance
        A_inv = np.linalg.inv(self.A)
        theta_hat = A_inv @ self.b
        
        # Variance for the selected arm
        arm_variance = A_inv[arm, arm] if arm < self.context_dim else 0.1
        
        # Confidence is inverse of variance
        confidence = 1 / (1 + arm_variance)
        
        return min(confidence, 1.0)
    
    def _predict_reward(self, context: np.ndarray, arm: int) -> float:
        """Predict expected reward for the given context and arm."""
        
        # Calculate posterior mean
        A_inv = np.linalg.inv(self.A)
        theta_hat = A_inv @ self.b
        
        # Expected reward
        expected_reward = context @ theta_hat[:, arm]
        
        return float(expected_reward)
    
    async def get_arm_statistics(self) -> Dict[str, Any]:
        """Get statistics for all arms."""
        
        statistics = {}
        
        for arm in range(self.n_arms):
            if self.arm_counts[arm] > 0:
                statistics[arm] = {
                    "name": self._get_strategy_name(arm),
                    "pulls": int(self.arm_counts[arm]),
                    "total_reward": float(self.arm_rewards[arm]),
                    "average_reward": float(self.arm_rewards[arm] / self.arm_counts[arm]),
                    "pull_rate": float(self.arm_counts[arm] / max(self.total_pulls, 1))
                }
            else:
                statistics[arm] = {
                    "name": self._get_strategy_name(arm),
                    "pulls": 0,
                    "total_reward": 0.0,
                    "average_reward": 0.0,
                    "pull_rate": 0.0
                }
        
        return statistics
    
    async def reset_model(self):
        """Reset the bandit model."""
        
        self.theta = np.random.normal(0, 1, (self.context_dim, self.n_arms))
        self.A = np.eye(self.context_dim)
        self.b = np.zeros((self.context_dim, self.n_arms))
        self.total_rewards = 0
        self.total_pulls = 0
        self.arm_counts = np.zeros(self.n_arms)
        self.arm_rewards = np.zeros(self.n_arms)
        
        self.logger.info("Contextual bandit model reset")
    
    async def get_exploration_rate(self) -> float:
        """Get current exploration rate."""
        
        if self.total_pulls == 0:
            return 1.0
        
        # Calculate exploration rate based on uncertainty
        A_inv = np.linalg.inv(self.A)
        total_variance = np.trace(A_inv)
        
        # Higher variance means more exploration needed
        exploration_rate = min(total_variance / self.context_dim, 1.0)
        
        return exploration_rate



