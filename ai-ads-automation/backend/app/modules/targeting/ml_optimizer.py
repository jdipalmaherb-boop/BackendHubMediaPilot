"""
ML-based targeting optimization module.
"""

import asyncio
import numpy as np
from typing import Any, Dict, List, Optional, Tuple

from app.core.logging import get_logger


class MLOptimizer:
    """ML-based targeting optimization using various algorithms."""
    
    def __init__(self):
        self.logger = get_logger("ml_optimizer")
        self.models = {}
        self.feature_importance = {}
    
    async def optimize_targeting_parameters(
        self,
        historical_data: List[Dict[str, Any]],
        optimization_goals: Dict[str, Any],
        algorithm: str = "random_forest"
    ) -> Dict[str, Any]:
        """Optimize targeting parameters using ML algorithms."""
        
        if algorithm == "random_forest":
            return await self._optimize_with_random_forest(historical_data, optimization_goals)
        elif algorithm == "gradient_boosting":
            return await self._optimize_with_gradient_boosting(historical_data, optimization_goals)
        elif algorithm == "neural_network":
            return await self._optimize_with_neural_network(historical_data, optimization_goals)
        else:
            raise ValueError(f"Unsupported algorithm: {algorithm}")
    
    async def _optimize_with_random_forest(
        self,
        historical_data: List[Dict[str, Any]],
        optimization_goals: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Optimize targeting using Random Forest algorithm."""
        
        # Prepare features and targets
        X, y = self._prepare_training_data(historical_data, optimization_goals)
        
        # Train Random Forest model
        from sklearn.ensemble import RandomForestRegressor
        from sklearn.model_selection import train_test_split
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        model = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            random_state=42
        )
        
        model.fit(X_train, y_train)
        
        # Get feature importance
        feature_names = self._get_feature_names()
        feature_importance = dict(zip(feature_names, model.feature_importances_))
        
        # Make predictions
        predictions = model.predict(X_test)
        
        # Calculate optimization recommendations
        recommendations = self._generate_ml_recommendations(
            model, feature_importance, optimization_goals
        )
        
        return {
            "algorithm": "random_forest",
            "model_performance": {
                "r2_score": model.score(X_test, y_test),
                "feature_importance": feature_importance
            },
            "recommendations": recommendations,
            "optimized_parameters": self._extract_optimized_parameters(recommendations)
        }
    
    async def _optimize_with_gradient_boosting(
        self,
        historical_data: List[Dict[str, Any]],
        optimization_goals: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Optimize targeting using Gradient Boosting algorithm."""
        
        # Prepare features and targets
        X, y = self._prepare_training_data(historical_data, optimization_goals)
        
        # Train Gradient Boosting model
        from sklearn.ensemble import GradientBoostingRegressor
        from sklearn.model_selection import train_test_split
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        model = GradientBoostingRegressor(
            n_estimators=100,
            learning_rate=0.1,
            max_depth=6,
            random_state=42
        )
        
        model.fit(X_train, y_train)
        
        # Get feature importance
        feature_names = self._get_feature_names()
        feature_importance = dict(zip(feature_names, model.feature_importances_))
        
        # Make predictions
        predictions = model.predict(X_test)
        
        # Calculate optimization recommendations
        recommendations = self._generate_ml_recommendations(
            model, feature_importance, optimization_goals
        )
        
        return {
            "algorithm": "gradient_boosting",
            "model_performance": {
                "r2_score": model.score(X_test, y_test),
                "feature_importance": feature_importance
            },
            "recommendations": recommendations,
            "optimized_parameters": self._extract_optimized_parameters(recommendations)
        }
    
    async def _optimize_with_neural_network(
        self,
        historical_data: List[Dict[str, Any]],
        optimization_goals: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Optimize targeting using Neural Network algorithm."""
        
        # Prepare features and targets
        X, y = self._prepare_training_data(historical_data, optimization_goals)
        
        # Train Neural Network model
        from sklearn.neural_network import MLPRegressor
        from sklearn.model_selection import train_test_split
        from sklearn.preprocessing import StandardScaler
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Scale features
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        model = MLPRegressor(
            hidden_layer_sizes=(100, 50),
            activation='relu',
            solver='adam',
            alpha=0.001,
            learning_rate='adaptive',
            max_iter=1000,
            random_state=42
        )
        
        model.fit(X_train_scaled, y_train)
        
        # Get feature importance (approximated)
        feature_names = self._get_feature_names()
        feature_importance = self._calculate_neural_network_importance(
            model, X_test_scaled, y_test
        )
        
        # Make predictions
        predictions = model.predict(X_test_scaled)
        
        # Calculate optimization recommendations
        recommendations = self._generate_ml_recommendations(
            model, feature_importance, optimization_goals
        )
        
        return {
            "algorithm": "neural_network",
            "model_performance": {
                "r2_score": model.score(X_test_scaled, y_test),
                "feature_importance": feature_importance
            },
            "recommendations": recommendations,
            "optimized_parameters": self._extract_optimized_parameters(recommendations)
        }
    
    def _prepare_training_data(
        self,
        historical_data: List[Dict[str, Any]],
        optimization_goals: Dict[str, Any]
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Prepare training data for ML models."""
        
        features = []
        targets = []
        
        for data_point in historical_data:
            # Extract features
            feature_vector = self._extract_features(data_point)
            features.append(feature_vector)
            
            # Extract target (based on optimization goals)
            target_value = self._extract_target(data_point, optimization_goals)
            targets.append(target_value)
        
        return np.array(features), np.array(targets)
    
    def _extract_features(self, data_point: Dict[str, Any]) -> List[float]:
        """Extract features from a data point."""
        
        features = []
        
        # Demographics
        features.append(data_point.get("age_min", 18))
        features.append(data_point.get("age_max", 65))
        features.append(1 if data_point.get("gender") == "female" else 0)
        features.append(1 if data_point.get("gender") == "male" else 0)
        
        # Interests (one-hot encoded)
        interests = data_point.get("interests", [])
        interest_features = [0] * 10  # Top 10 interests
        for i, interest in enumerate(interests[:10]):
            interest_features[i] = 1
        features.extend(interest_features)
        
        # Behaviors
        features.append(data_point.get("device_mobile", 0))
        features.append(data_point.get("device_desktop", 0))
        features.append(data_point.get("content_video", 0))
        features.append(data_point.get("content_articles", 0))
        
        # Purchase behavior
        features.append(data_point.get("purchase_frequency", 0))
        features.append(data_point.get("purchase_value", 0))
        
        # Campaign settings
        features.append(data_point.get("budget_daily", 0))
        features.append(data_point.get("bid_strategy", 0))
        
        return features
    
    def _extract_target(self, data_point: Dict[str, Any], optimization_goals: Dict[str, Any]) -> float:
        """Extract target value based on optimization goals."""
        
        if optimization_goals.get("maximize_roas"):
            return data_point.get("roas", 0)
        elif optimization_goals.get("minimize_cpa"):
            return 1 / max(data_point.get("cpa", 1), 0.01)  # Inverse CPA
        elif optimization_goals.get("maximize_conversions"):
            return data_point.get("conversions", 0)
        else:
            # Default: maximize ROAS
            return data_point.get("roas", 0)
    
    def _get_feature_names(self) -> List[str]:
        """Get feature names for the model."""
        
        return [
            "age_min", "age_max", "gender_female", "gender_male",
            "interest_0", "interest_1", "interest_2", "interest_3", "interest_4",
            "interest_5", "interest_6", "interest_7", "interest_8", "interest_9",
            "device_mobile", "device_desktop", "content_video", "content_articles",
            "purchase_frequency", "purchase_value", "budget_daily", "bid_strategy"
        ]
    
    def _generate_ml_recommendations(
        self,
        model: Any,
        feature_importance: Dict[str, float],
        optimization_goals: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate ML-based optimization recommendations."""
        
        recommendations = []
        
        # Sort features by importance
        sorted_features = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)
        
        # Top 5 most important features
        top_features = sorted_features[:5]
        
        for feature, importance in top_features:
            if importance > 0.1:  # Only consider significant features
                recommendation = {
                    "feature": feature,
                    "importance": importance,
                    "action": self._get_feature_action(feature, importance),
                    "priority": "high" if importance > 0.2 else "medium"
                }
                recommendations.append(recommendation)
        
        # Generate specific targeting recommendations
        targeting_recommendations = self._generate_targeting_recommendations(
            feature_importance, optimization_goals
        )
        recommendations.extend(targeting_recommendations)
        
        return recommendations
    
    def _get_feature_action(self, feature: str, importance: float) -> str:
        """Get action recommendation for a feature."""
        
        if feature.startswith("interest_"):
            return "Focus on high-performing interests"
        elif feature.startswith("device_"):
            return "Optimize device targeting"
        elif feature.startswith("content_"):
            return "Adjust content preferences"
        elif feature.startswith("purchase_"):
            return "Target high-value purchase behaviors"
        elif feature in ["age_min", "age_max"]:
            return "Refine age targeting"
        elif feature in ["budget_daily", "bid_strategy"]:
            return "Adjust budget and bidding strategy"
        else:
            return "Optimize this targeting parameter"
    
    def _generate_targeting_recommendations(
        self,
        feature_importance: Dict[str, float],
        optimization_goals: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate specific targeting recommendations."""
        
        recommendations = []
        
        # Interest-based recommendations
        interest_importance = sum(
            importance for feature, importance in feature_importance.items()
            if feature.startswith("interest_")
        )
        
        if interest_importance > 0.3:
            recommendations.append({
                "type": "interest_optimization",
                "description": "Interests are highly predictive. Focus on top-performing interest categories.",
                "priority": "high",
                "actions": [
                    "Analyze top-performing interests",
                    "Remove low-performing interests",
                    "Test new interest combinations"
                ]
            })
        
        # Device-based recommendations
        device_importance = sum(
            importance for feature, importance in feature_importance.items()
            if feature.startswith("device_")
        )
        
        if device_importance > 0.2:
            recommendations.append({
                "type": "device_optimization",
                "description": "Device usage is predictive. Optimize for high-performing devices.",
                "priority": "medium",
                "actions": [
                    "Adjust bids by device",
                    "Create device-specific creatives",
                    "Optimize landing pages for mobile"
                ]
            })
        
        # Age-based recommendations
        age_importance = feature_importance.get("age_min", 0) + feature_importance.get("age_max", 0)
        
        if age_importance > 0.15:
            recommendations.append({
                "type": "age_optimization",
                "description": "Age targeting is important. Refine age ranges for better performance.",
                "priority": "medium",
                "actions": [
                    "Narrow age ranges",
                    "Test different age segments",
                    "Exclude low-performing age groups"
                ]
            })
        
        return recommendations
    
    def _extract_optimized_parameters(self, recommendations: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Extract optimized parameters from recommendations."""
        
        optimized_params = {}
        
        for rec in recommendations:
            if rec["type"] == "interest_optimization":
                optimized_params["focus_interests"] = True
                optimized_params["interest_threshold"] = 0.1
            elif rec["type"] == "device_optimization":
                optimized_params["device_bidding"] = True
                optimized_params["mobile_optimization"] = True
            elif rec["type"] == "age_optimization":
                optimized_params["age_refinement"] = True
                optimized_params["age_segmentation"] = True
        
        return optimized_params
    
    def _calculate_neural_network_importance(
        self,
        model: Any,
        X_test: np.ndarray,
        y_test: np.ndarray
    ) -> Dict[str, float]:
        """Calculate feature importance for neural network (approximated)."""
        
        # Use permutation importance as approximation
        from sklearn.inspection import permutation_importance
        
        perm_importance = permutation_importance(model, X_test, y_test, random_state=42)
        
        feature_names = self._get_feature_names()
        importance_dict = dict(zip(feature_names, perm_importance.importances_mean))
        
        return importance_dict
    
    async def predict_performance(
        self,
        targeting_parameters: Dict[str, Any],
        model: Any = None
    ) -> Dict[str, Any]:
        """Predict performance for given targeting parameters."""
        
        if model is None:
            # Use a simple linear model for prediction
            from sklearn.linear_model import LinearRegression
            model = LinearRegression()
        
        # Extract features from targeting parameters
        features = self._extract_features(targeting_parameters)
        features_array = np.array(features).reshape(1, -1)
        
        # Make prediction
        prediction = model.predict(features_array)[0]
        
        return {
            "predicted_performance": prediction,
            "confidence": 0.8,  # Simplified confidence score
            "parameters": targeting_parameters
        }
    
    async def get_feature_importance_analysis(
        self,
        historical_data: List[Dict[str, Any]],
        optimization_goals: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get detailed feature importance analysis."""
        
        # Prepare data
        X, y = self._prepare_training_data(historical_data, optimization_goals)
        
        # Train multiple models for comparison
        from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
        from sklearn.linear_model import LinearRegression
        
        models = {
            "random_forest": RandomForestRegressor(n_estimators=100, random_state=42),
            "gradient_boosting": GradientBoostingRegressor(n_estimators=100, random_state=42),
            "linear_regression": LinearRegression()
        }
        
        feature_names = self._get_feature_names()
        importance_analysis = {}
        
        for name, model in models.items():
            model.fit(X, y)
            
            if hasattr(model, 'feature_importances_'):
                importance = dict(zip(feature_names, model.feature_importances_))
            else:
                # For linear regression, use coefficients
                importance = dict(zip(feature_names, abs(model.coef_)))
            
            importance_analysis[name] = {
                "model_score": model.score(X, y),
                "feature_importance": importance
            }
        
        # Calculate consensus importance
        consensus_importance = {}
        for feature in feature_names:
            scores = [analysis["feature_importance"][feature] for analysis in importance_analysis.values()]
            consensus_importance[feature] = np.mean(scores)
        
        return {
            "model_analysis": importance_analysis,
            "consensus_importance": consensus_importance,
            "top_features": sorted(consensus_importance.items(), key=lambda x: x[1], reverse=True)[:10]
        }



