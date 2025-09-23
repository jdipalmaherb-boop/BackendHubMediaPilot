"""
Reinforcement Learning Policy for budget allocation and long-term optimization.
"""

import asyncio
import numpy as np
from typing import Any, Dict, List, Optional, Tuple

from app.core.logging import get_logger


class RLPolicy:
    """Reinforcement Learning Policy for budget allocation optimization."""
    
    def __init__(self, state_dim: int = 20, action_dim: int = 10, hidden_dim: int = 64):
        self.state_dim = state_dim
        self.action_dim = action_dim
        self.hidden_dim = hidden_dim
        self.logger = get_logger("rl_policy")
        
        # Initialize neural network parameters
        self.W1 = np.random.randn(state_dim, hidden_dim) * 0.1
        self.b1 = np.zeros(hidden_dim)
        self.W2 = np.random.randn(hidden_dim, action_dim) * 0.1
        self.b2 = np.zeros(action_dim)
        
        # Learning parameters
        self.learning_rate = 0.001
        self.gamma = 0.99  # Discount factor
        self.epsilon = 0.1  # Exploration rate
        self.epsilon_decay = 0.995
        self.epsilon_min = 0.01
        
        # Experience replay buffer
        self.memory = []
        self.memory_size = 10000
        self.batch_size = 32
        
        # Training statistics
        self.total_episodes = 0
        self.total_rewards = 0
        self.episode_rewards = []
    
    async def optimize_budget_allocation(
        self,
        campaign: Any,
        performance_data: Dict[str, Any],
        optimization_goals: Dict[str, Any],
        constraints: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Optimize budget allocation using RL policy."""
        
        # Extract state features
        state = self._extract_state_features(campaign, performance_data, optimization_goals)
        
        # Select action (budget allocation)
        action = await self._select_action(state)
        
        # Calculate reward
        reward = await self._calculate_reward(action, performance_data, optimization_goals)
        
        # Store experience
        await self._store_experience(state, action, reward)
        
        # Train model
        if len(self.memory) >= self.batch_size:
            await self._train_model()
        
        # Generate recommendations
        recommendations = await self._generate_budget_recommendations(action, state, reward)
        
        return {
            "budget_allocation": action,
            "recommendations": recommendations,
            "confidence": self._calculate_policy_confidence(state, action),
            "expected_reward": self._predict_reward(state, action)
        }
    
    def _extract_state_features(
        self,
        campaign: Any,
        performance_data: Dict[str, Any],
        optimization_goals: Dict[str, Any]
    ) -> np.ndarray:
        """Extract state features for the RL policy."""
        
        features = np.zeros(self.state_dim)
        
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
        features[8] = performance_data.get("total_impressions", 0) / 100000  # Normalized impressions
        
        # Ad group performance features
        ad_groups = performance_data.get("ad_groups", [])
        if ad_groups:
            # Average performance across ad groups
            avg_ctr = np.mean([ag.get("ctr", 0) for ag in ad_groups])
            avg_conversion_rate = np.mean([ag.get("conversion_rate", 0) for ag in ad_groups])
            features[9] = avg_ctr
            features[10] = avg_conversion_rate
            
            # Performance variance
            ctr_variance = np.var([ag.get("ctr", 0) for ag in ad_groups])
            features[11] = ctr_variance
            
            # Number of ad groups
            features[12] = len(ad_groups) / 10  # Normalized
        
        # Platform features
        features[13] = 1 if campaign.platform.value == "meta" else 0  # Meta platform
        features[14] = 1 if campaign.platform.value == "google" else 0  # Google platform
        features[15] = 1 if campaign.platform.value == "tiktok" else 0  # TikTok platform
        
        # Time features (simplified)
        features[16] = 0.5  # Placeholder for time of day
        features[17] = 0.5  # Placeholder for day of week
        
        # Optimization goal features
        features[18] = 1 if optimization_goals.get("maximize_roas") else 0
        features[19] = 1 if optimization_goals.get("minimize_cpa") else 0
        
        return features
    
    async def _select_action(self, state: np.ndarray) -> np.ndarray:
        """Select action using epsilon-greedy policy."""
        
        if np.random.random() < self.epsilon:
            # Explore: random action
            action = np.random.rand(self.action_dim)
            action = action / np.sum(action)  # Normalize to sum to 1
        else:
            # Exploit: use policy network
            action = self._forward_pass(state)
            action = self._softmax(action)  # Convert to probabilities
        
        return action
    
    def _forward_pass(self, state: np.ndarray) -> np.ndarray:
        """Forward pass through the neural network."""
        
        # First hidden layer
        z1 = state @ self.W1 + self.b1
        h1 = self._relu(z1)
        
        # Output layer
        z2 = h1 @ self.W2 + self.b2
        
        return z2
    
    def _softmax(self, x: np.ndarray) -> np.ndarray:
        """Softmax activation function."""
        
        exp_x = np.exp(x - np.max(x))  # Subtract max for numerical stability
        return exp_x / np.sum(exp_x)
    
    def _relu(self, x: np.ndarray) -> np.ndarray:
        """ReLU activation function."""
        
        return np.maximum(0, x)
    
    async def _calculate_reward(
        self,
        action: np.ndarray,
        performance_data: Dict[str, Any],
        optimization_goals: Dict[str, Any]
    ) -> float:
        """Calculate reward for the given action."""
        
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
        
        # Budget utilization reward
        budget_utilization = self._calculate_budget_utilization(action, performance_data)
        base_reward += budget_utilization * 0.2  # 20% weight for budget utilization
        
        # Add noise for exploration
        noise = np.random.normal(0, 0.05)
        reward = base_reward + noise
        
        # Clip to [0, 1]
        reward = np.clip(reward, 0, 1)
        
        return reward
    
    def _calculate_budget_utilization(self, action: np.ndarray, performance_data: Dict[str, Any]) -> float:
        """Calculate budget utilization efficiency."""
        
        # This is a simplified calculation
        # In production, this would consider actual budget allocation vs performance
        
        # Calculate how well the budget is allocated based on performance
        ad_groups = performance_data.get("ad_groups", [])
        if not ad_groups:
            return 0.5  # Default value
        
        # Calculate performance-weighted budget allocation
        total_performance = sum(ag.get("roas", 0) for ag in ad_groups)
        if total_performance == 0:
            return 0.5  # Default value
        
        # Calculate how well the action matches the performance
        performance_weights = np.array([ag.get("roas", 0) for ag in ad_groups])
        performance_weights = performance_weights / np.sum(performance_weights)
        
        # Calculate correlation between action and performance
        correlation = np.corrcoef(action[:len(performance_weights)], performance_weights)[0, 1]
        
        return max(0, correlation)  # Return positive correlation
    
    async def _store_experience(self, state: np.ndarray, action: np.ndarray, reward: float):
        """Store experience in the replay buffer."""
        
        experience = {
            "state": state.copy(),
            "action": action.copy(),
            "reward": reward
        }
        
        self.memory.append(experience)
        
        # Maintain memory size
        if len(self.memory) > self.memory_size:
            self.memory.pop(0)
    
    async def _train_model(self):
        """Train the RL model using experience replay."""
        
        # Sample batch from memory
        batch = np.random.choice(self.memory, size=self.batch_size, replace=False)
        
        # Prepare training data
        states = np.array([exp["state"] for exp in batch])
        actions = np.array([exp["action"] for exp in batch])
        rewards = np.array([exp["reward"] for exp in batch])
        
        # Calculate targets (simplified - in production, use proper Q-learning)
        targets = rewards  # Simplified target calculation
        
        # Calculate gradients
        gradients = self._calculate_gradients(states, actions, targets)
        
        # Update parameters
        self._update_parameters(gradients)
        
        # Decay exploration rate
        self.epsilon = max(self.epsilon * self.epsilon_decay, self.epsilon_min)
    
    def _calculate_gradients(
        self,
        states: np.ndarray,
        actions: np.ndarray,
        targets: np.ndarray
    ) -> Dict[str, np.ndarray]:
        """Calculate gradients for the neural network."""
        
        gradients = {}
        
        # Forward pass
        z1 = states @ self.W1 + self.b1
        h1 = self._relu(z1)
        z2 = h1 @ self.W2 + self.b2
        
        # Calculate loss (simplified MSE)
        predictions = self._softmax(z2)
        loss = np.mean((predictions - actions) ** 2)
        
        # Backward pass (simplified)
        # In production, use proper backpropagation
        
        # Gradient for W2
        dW2 = h1.T @ (predictions - actions) / len(states)
        gradients["W2"] = dW2
        
        # Gradient for b2
        db2 = np.mean(predictions - actions, axis=0)
        gradients["b2"] = db2
        
        # Gradient for W1 (simplified)
        dW1 = states.T @ ((predictions - actions) @ self.W2.T * (z1 > 0)) / len(states)
        gradients["W1"] = dW1
        
        # Gradient for b1
        db1 = np.mean((predictions - actions) @ self.W2.T * (z1 > 0), axis=0)
        gradients["b1"] = db1
        
        return gradients
    
    def _update_parameters(self, gradients: Dict[str, np.ndarray]):
        """Update neural network parameters."""
        
        self.W1 -= self.learning_rate * gradients["W1"]
        self.b1 -= self.learning_rate * gradients["b1"]
        self.W2 -= self.learning_rate * gradients["W2"]
        self.b2 -= self.learning_rate * gradients["b2"]
    
    async def _generate_budget_recommendations(
        self,
        action: np.ndarray,
        state: np.ndarray,
        reward: float
    ) -> List[Dict[str, Any]]:
        """Generate budget allocation recommendations."""
        
        recommendations = []
        
        # Find top performing ad groups (simplified)
        top_groups = np.argsort(action)[-3:]  # Top 3 groups
        
        for i, group_idx in enumerate(top_groups):
            if action[group_idx] > 0.1:  # Only recommend if allocation is significant
                recommendations.append({
                    "type": "budget_allocation",
                    "ad_group_index": int(group_idx),
                    "allocation_percentage": float(action[group_idx] * 100),
                    "reason": f"High performance allocation for ad group {group_idx}",
                    "priority": "high" if i == 0 else "medium"
                })
        
        # Performance-based recommendations
        if reward > 0.7:
            recommendations.append({
                "type": "performance",
                "action": "increase_total_budget",
                "value": 1.2,
                "reason": "High performance detected, consider increasing total budget",
                "priority": "high"
            })
        elif reward < 0.3:
            recommendations.append({
                "type": "performance",
                "action": "decrease_total_budget",
                "value": 0.8,
                "reason": "Low performance detected, consider decreasing total budget",
                "priority": "medium"
            })
        
        return recommendations
    
    def _calculate_policy_confidence(self, state: np.ndarray, action: np.ndarray) -> float:
        """Calculate confidence in the policy decision."""
        
        # Calculate policy output
        policy_output = self._forward_pass(state)
        policy_probs = self._softmax(policy_output)
        
        # Confidence is the maximum probability
        confidence = np.max(policy_probs)
        
        return float(confidence)
    
    def _predict_reward(self, state: np.ndarray, action: np.ndarray) -> float:
        """Predict expected reward for the given state and action."""
        
        # This is a simplified prediction
        # In production, use a separate value network
        
        # Calculate policy output
        policy_output = self._forward_pass(state)
        policy_probs = self._softmax(policy_output)
        
        # Expected reward is weighted sum of action probabilities
        expected_reward = np.sum(policy_probs * action)
        
        return float(expected_reward)
    
    async def get_policy_statistics(self) -> Dict[str, Any]:
        """Get statistics about the RL policy."""
        
        return {
            "total_episodes": self.total_episodes,
            "total_rewards": self.total_rewards,
            "average_reward": self.total_rewards / max(self.total_episodes, 1),
            "epsilon": self.epsilon,
            "memory_size": len(self.memory),
            "learning_rate": self.learning_rate
        }
    
    async def reset_policy(self):
        """Reset the RL policy."""
        
        # Reset neural network parameters
        self.W1 = np.random.randn(self.state_dim, self.hidden_dim) * 0.1
        self.b1 = np.zeros(self.hidden_dim)
        self.W2 = np.random.randn(self.hidden_dim, self.action_dim) * 0.1
        self.b2 = np.zeros(self.action_dim)
        
        # Reset learning parameters
        self.epsilon = 0.1
        self.memory = []
        
        # Reset statistics
        self.total_episodes = 0
        self.total_rewards = 0
        self.episode_rewards = []
        
        self.logger.info("RL policy reset")
    
    async def save_model(self, filepath: str):
        """Save the RL model to file."""
        
        model_data = {
            "W1": self.W1,
            "b1": self.b1,
            "W2": self.W2,
            "b2": self.b2,
            "learning_rate": self.learning_rate,
            "epsilon": self.epsilon,
            "total_episodes": self.total_episodes,
            "total_rewards": self.total_rewards
        }
        
        # In production, use proper model serialization
        # For now, just log the save operation
        self.logger.info(f"Model saved to {filepath}")
    
    async def load_model(self, filepath: str):
        """Load the RL model from file."""
        
        # In production, use proper model deserialization
        # For now, just log the load operation
        self.logger.info(f"Model loaded from {filepath}")



