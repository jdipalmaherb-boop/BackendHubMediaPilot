"""
Audience analysis and segmentation module.
"""

import asyncio
from typing import Any, Dict, List, Optional, Tuple

from app.core.logging import get_logger


class AudienceAnalyzer:
    """Analyzes audience data and provides segmentation insights."""
    
    def __init__(self):
        self.logger = get_logger("audience_analyzer")
    
    async def analyze_audience_segments(
        self,
        audience_data: Dict[str, Any],
        segmentation_criteria: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Analyze audience data and identify high-value segments."""
        
        segments = []
        
        # Demographics segmentation
        if "demographics" in audience_data:
            demo_segments = await self._analyze_demographic_segments(
                audience_data["demographics"],
                segmentation_criteria.get("demographics", {})
            )
            segments.extend(demo_segments)
        
        # Behavioral segmentation
        if "behaviors" in audience_data:
            behavior_segments = await self._analyze_behavioral_segments(
                audience_data["behaviors"],
                segmentation_criteria.get("behaviors", {})
            )
            segments.extend(behavior_segments)
        
        # Interest segmentation
        if "interests" in audience_data:
            interest_segments = await self._analyze_interest_segments(
                audience_data["interests"],
                segmentation_criteria.get("interests", {})
            )
            segments.extend(interest_segments)
        
        # Purchase behavior segmentation
        if "purchase_history" in audience_data:
            purchase_segments = await self._analyze_purchase_segments(
                audience_data["purchase_history"],
                segmentation_criteria.get("purchase_behavior", {})
            )
            segments.extend(purchase_segments)
        
        # Sort segments by value score
        segments.sort(key=lambda x: x["value_score"], reverse=True)
        
        return segments
    
    async def _analyze_demographic_segments(
        self,
        demographics: Dict[str, Any],
        criteria: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Analyze demographic segments for high-value audiences."""
        
        segments = []
        
        # Age-based segmentation
        age_ranges = criteria.get("age_ranges", [
            {"min": 18, "max": 24, "name": "Gen Z"},
            {"min": 25, "max": 34, "name": "Millennials"},
            {"min": 35, "max": 44, "name": "Gen X"},
            {"min": 45, "max": 54, "name": "Boomers"},
            {"min": 55, "max": 65, "name": "Seniors"}
        ])
        
        for age_range in age_ranges:
            segment = {
                "type": "demographic",
                "name": f"{age_range['name']} ({age_range['min']}-{age_range['max']})",
                "criteria": {
                    "age_min": age_range["min"],
                    "age_max": age_range["max"],
                    "genders": demographics.get("genders", ["all"])
                },
                "value_score": self._calculate_demographic_value_score(age_range, demographics),
                "predicted_reach": self._estimate_demographic_reach(age_range),
                "predicted_cpa": self._estimate_demographic_cpa(age_range),
                "confidence": 0.8
            }
            segments.append(segment)
        
        # Gender-based segmentation
        genders = criteria.get("genders", ["male", "female", "other"])
        for gender in genders:
            segment = {
                "type": "demographic",
                "name": f"{gender.title()} Audience",
                "criteria": {
                    "genders": [gender],
                    "age_min": demographics.get("age_min", 18),
                    "age_max": demographics.get("age_max", 65)
                },
                "value_score": self._calculate_gender_value_score(gender, demographics),
                "predicted_reach": self._estimate_gender_reach(gender),
                "predicted_cpa": self._estimate_gender_cpa(gender),
                "confidence": 0.75
            }
            segments.append(segment)
        
        return segments
    
    async def _analyze_behavioral_segments(
        self,
        behaviors: Dict[str, Any],
        criteria: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Analyze behavioral segments for high-value audiences."""
        
        segments = []
        
        # Device usage patterns
        device_patterns = behaviors.get("device_usage", {})
        for device, usage_data in device_patterns.items():
            if usage_data.get("frequency", 0) > 0.5:  # High usage
                segment = {
                    "type": "behavioral",
                    "name": f"High {device.title()} Users",
                    "criteria": {
                        "device_usage": {device: {"frequency": "high"}},
                        "behaviors": ["device_engagement"]
                    },
                    "value_score": self._calculate_device_value_score(device, usage_data),
                    "predicted_reach": self._estimate_device_reach(device),
                    "predicted_cpa": self._estimate_device_cpa(device),
                    "confidence": 0.7
                }
                segments.append(segment)
        
        # Content consumption patterns
        content_patterns = behaviors.get("content_consumption", {})
        for content_type, consumption_data in content_patterns.items():
            if consumption_data.get("engagement_rate", 0) > 0.3:  # High engagement
                segment = {
                    "type": "behavioral",
                    "name": f"High {content_type.title()} Engagers",
                    "criteria": {
                        "content_preferences": {content_type: {"engagement": "high"}},
                        "behaviors": ["content_engagement"]
                    },
                    "value_score": self._calculate_content_value_score(content_type, consumption_data),
                    "predicted_reach": self._estimate_content_reach(content_type),
                    "predicted_cpa": self._estimate_content_cpa(content_type),
                    "confidence": 0.75
                }
                segments.append(segment)
        
        # Purchase behavior patterns
        purchase_patterns = behaviors.get("purchase_behavior", {})
        for purchase_type, purchase_data in purchase_patterns.items():
            if purchase_data.get("frequency", 0) > 0.2:  # Regular purchasers
                segment = {
                    "type": "behavioral",
                    "name": f"Regular {purchase_type.title()} Buyers",
                    "criteria": {
                        "purchase_behavior": {purchase_type: {"frequency": "regular"}},
                        "behaviors": ["purchase_engagement"]
                    },
                    "value_score": self._calculate_purchase_value_score(purchase_type, purchase_data),
                    "predicted_reach": self._estimate_purchase_reach(purchase_type),
                    "predicted_cpa": self._estimate_purchase_cpa(purchase_type),
                    "confidence": 0.9
                }
                segments.append(segment)
        
        return segments
    
    async def _analyze_interest_segments(
        self,
        interests: Dict[str, Any],
        criteria: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Analyze interest-based segments for high-value audiences."""
        
        segments = []
        
        # High-value interests
        high_value_interests = criteria.get("high_value_interests", [])
        for interest in high_value_interests:
            if interest in interests:
                segment = {
                    "type": "interest",
                    "name": f"{interest.title()} Enthusiasts",
                    "criteria": {
                        "interests": [interest],
                        "interest_strength": "high"
                    },
                    "value_score": self._calculate_interest_value_score(interest, interests[interest]),
                    "predicted_reach": self._estimate_interest_reach(interest),
                    "predicted_cpa": self._estimate_interest_cpa(interest),
                    "confidence": 0.85
                }
                segments.append(segment)
        
        # Interest combinations
        interest_combinations = criteria.get("interest_combinations", [])
        for combination in interest_combinations:
            if all(interest in interests for interest in combination["interests"]):
                segment = {
                    "type": "interest",
                    "name": f"{' + '.join(combination['interests'])} Fans",
                    "criteria": {
                        "interests": combination["interests"],
                        "interest_strength": "high"
                    },
                    "value_score": self._calculate_combination_value_score(combination, interests),
                    "predicted_reach": self._estimate_combination_reach(combination),
                    "predicted_cpa": self._estimate_combination_cpa(combination),
                    "confidence": 0.9
                }
                segments.append(segment)
        
        return segments
    
    async def _analyze_purchase_segments(
        self,
        purchase_history: Dict[str, Any],
        criteria: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Analyze purchase behavior segments for high-value audiences."""
        
        segments = []
        
        # High-value customers
        high_value_threshold = criteria.get("high_value_threshold", 1000)
        if purchase_history.get("total_spent", 0) > high_value_threshold:
            segment = {
                "type": "purchase",
                "name": "High-Value Customers",
                "criteria": {
                    "purchase_history": {"total_spent": f">{high_value_threshold}"},
                    "customer_tier": "high_value"
                },
                "value_score": 0.95,
                "predicted_reach": self._estimate_high_value_reach(),
                "predicted_cpa": self._estimate_high_value_cpa(),
                "confidence": 0.98
            }
            segments.append(segment)
        
        # Frequent buyers
        frequent_threshold = criteria.get("frequent_threshold", 5)
        if purchase_history.get("purchase_count", 0) > frequent_threshold:
            segment = {
                "type": "purchase",
                "name": "Frequent Buyers",
                "criteria": {
                    "purchase_history": {"purchase_count": f">{frequent_threshold}"},
                    "customer_tier": "frequent"
                },
                "value_score": 0.85,
                "predicted_reach": self._estimate_frequent_reach(),
                "predicted_cpa": self._estimate_frequent_cpa(),
                "confidence": 0.9
            }
            segments.append(segment)
        
        # Recent buyers
        recent_threshold = criteria.get("recent_threshold", 30)  # days
        if purchase_history.get("days_since_last_purchase", 0) < recent_threshold:
            segment = {
                "type": "purchase",
                "name": "Recent Buyers",
                "criteria": {
                    "purchase_history": {"days_since_last_purchase": f"<{recent_threshold}"},
                    "customer_tier": "recent"
                },
                "value_score": 0.8,
                "predicted_reach": self._estimate_recent_reach(),
                "predicted_cpa": self._estimate_recent_cpa(),
                "confidence": 0.85
            }
            segments.append(segment)
        
        return segments
    
    def _calculate_demographic_value_score(self, age_range: Dict[str, Any], demographics: Dict[str, Any]) -> float:
        """Calculate value score for demographic segments."""
        # Simplified scoring - in production, use ML models
        base_score = 0.5
        
        # Age-based adjustments
        if 25 <= age_range["min"] <= 35:
            base_score += 0.2  # Prime demographic
        elif 35 <= age_range["min"] <= 45:
            base_score += 0.15  # High purchasing power
        
        # Gender-based adjustments
        if demographics.get("genders") == ["female"]:
            base_score += 0.1  # Often higher engagement
        
        return min(base_score, 1.0)
    
    def _calculate_gender_value_score(self, gender: str, demographics: Dict[str, Any]) -> float:
        """Calculate value score for gender segments."""
        # Simplified scoring - in production, use ML models
        base_score = 0.5
        
        if gender == "female":
            base_score += 0.1
        elif gender == "male":
            base_score += 0.05
        
        return min(base_score, 1.0)
    
    def _calculate_device_value_score(self, device: str, usage_data: Dict[str, Any]) -> float:
        """Calculate value score for device segments."""
        base_score = 0.5
        
        if device == "mobile":
            base_score += 0.2  # Mobile-first audience
        elif device == "desktop":
            base_score += 0.1  # Desktop users often have higher intent
        
        return min(base_score, 1.0)
    
    def _calculate_content_value_score(self, content_type: str, consumption_data: Dict[str, Any]) -> float:
        """Calculate value score for content segments."""
        base_score = 0.5
        
        if content_type == "video":
            base_score += 0.2  # Video content often has higher engagement
        elif content_type == "articles":
            base_score += 0.1  # Article readers often have higher intent
        
        return min(base_score, 1.0)
    
    def _calculate_purchase_value_score(self, purchase_type: str, purchase_data: Dict[str, Any]) -> float:
        """Calculate value score for purchase segments."""
        base_score = 0.7  # Purchase behavior is high value
        
        if purchase_type == "premium":
            base_score += 0.2
        elif purchase_type == "subscription":
            base_score += 0.15
        
        return min(base_score, 1.0)
    
    def _calculate_interest_value_score(self, interest: str, interest_data: Dict[str, Any]) -> float:
        """Calculate value score for interest segments."""
        base_score = 0.6
        
        # High-value interests
        high_value_interests = ["technology", "business", "finance", "health", "fitness"]
        if interest.lower() in high_value_interests:
            base_score += 0.2
        
        return min(base_score, 1.0)
    
    def _calculate_combination_value_score(self, combination: Dict[str, Any], interests: Dict[str, Any]) -> float:
        """Calculate value score for interest combinations."""
        base_score = 0.7  # Combinations are often higher value
        
        # Add bonus for multiple high-value interests
        high_value_count = sum(1 for interest in combination["interests"] 
                             if interest.lower() in ["technology", "business", "finance"])
        base_score += high_value_count * 0.1
        
        return min(base_score, 1.0)
    
    # Reach estimation methods (simplified)
    def _estimate_demographic_reach(self, age_range: Dict[str, Any]) -> int:
        """Estimate reach for demographic segments."""
        age_span = age_range["max"] - age_range["min"] + 1
        return age_span * 100000  # Simplified estimation
    
    def _estimate_gender_reach(self, gender: str) -> int:
        """Estimate reach for gender segments."""
        return 500000  # Simplified estimation
    
    def _estimate_device_reach(self, device: str) -> int:
        """Estimate reach for device segments."""
        return 300000  # Simplified estimation
    
    def _estimate_content_reach(self, content_type: str) -> int:
        """Estimate reach for content segments."""
        return 200000  # Simplified estimation
    
    def _estimate_purchase_reach(self, purchase_type: str) -> int:
        """Estimate reach for purchase segments."""
        return 100000  # Simplified estimation
    
    def _estimate_interest_reach(self, interest: str) -> int:
        """Estimate reach for interest segments."""
        return 150000  # Simplified estimation
    
    def _estimate_combination_reach(self, combination: Dict[str, Any]) -> int:
        """Estimate reach for interest combinations."""
        return 75000  # Simplified estimation
    
    def _estimate_high_value_reach(self) -> int:
        """Estimate reach for high-value customers."""
        return 25000  # Simplified estimation
    
    def _estimate_frequent_reach(self) -> int:
        """Estimate reach for frequent buyers."""
        return 50000  # Simplified estimation
    
    def _estimate_recent_reach(self) -> int:
        """Estimate reach for recent buyers."""
        return 75000  # Simplified estimation
    
    # CPA estimation methods (simplified)
    def _estimate_demographic_cpa(self, age_range: Dict[str, Any]) -> float:
        """Estimate CPA for demographic segments."""
        if 25 <= age_range["min"] <= 35:
            return 15.0  # Prime demographic
        elif 35 <= age_range["min"] <= 45:
            return 18.0  # High purchasing power
        else:
            return 20.0  # Other demographics
    
    def _estimate_gender_cpa(self, gender: str) -> float:
        """Estimate CPA for gender segments."""
        if gender == "female":
            return 16.0
        elif gender == "male":
            return 18.0
        else:
            return 20.0
    
    def _estimate_device_cpa(self, device: str) -> float:
        """Estimate CPA for device segments."""
        if device == "mobile":
            return 14.0
        elif device == "desktop":
            return 16.0
        else:
            return 18.0
    
    def _estimate_content_cpa(self, content_type: str) -> float:
        """Estimate CPA for content segments."""
        if content_type == "video":
            return 12.0
        elif content_type == "articles":
            return 15.0
        else:
            return 18.0
    
    def _estimate_purchase_cpa(self, purchase_type: str) -> float:
        """Estimate CPA for purchase segments."""
        if purchase_type == "premium":
            return 8.0
        elif purchase_type == "subscription":
            return 10.0
        else:
            return 12.0
    
    def _estimate_interest_cpa(self, interest: str) -> float:
        """Estimate CPA for interest segments."""
        high_value_interests = ["technology", "business", "finance", "health", "fitness"]
        if interest.lower() in high_value_interests:
            return 12.0
        else:
            return 16.0
    
    def _estimate_combination_cpa(self, combination: Dict[str, Any]) -> float:
        """Estimate CPA for interest combinations."""
        return 10.0  # Combinations are often more targeted
    
    def _estimate_high_value_cpa(self) -> float:
        """Estimate CPA for high-value customers."""
        return 5.0  # Existing customers are cheaper to acquire
    
    def _estimate_frequent_cpa(self) -> float:
        """Estimate CPA for frequent buyers."""
        return 8.0  # Regular customers are cheaper to acquire
    
    def _estimate_recent_cpa(self) -> float:
        """Estimate CPA for recent buyers."""
        return 10.0  # Recent customers are cheaper to acquire



