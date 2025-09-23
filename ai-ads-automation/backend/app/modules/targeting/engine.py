"""
Targeting & Audience Engine for ad campaign optimization.
"""

import asyncio
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import get_logger, log_ai_operation
from app.models.ai import AudienceSuggestion, TargetingSuggestion
from app.models.campaign import Campaign, AdGroup, Audience
from app.modules.targeting.audience_analyzer import AudienceAnalyzer
from app.modules.targeting.ml_optimizer import MLOptimizer


class TargetingEngine:
    """Main targeting and audience engine for ad campaigns."""
    
    def __init__(self):
        self.audience_analyzer = AudienceAnalyzer()
        self.ml_optimizer = MLOptimizer()
        self.logger = get_logger("targeting_engine")
    
    async def generate_targeting_suggestions(
        self,
        db: Session,
        campaign_id: str,
        targeting_brief: Dict[str, Any],
        count: int = 5
    ) -> List[Dict[str, Any]]:
        """Generate targeting suggestions for a campaign."""
        
        # Get campaign details
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            raise ValueError(f"Campaign {campaign_id} not found")
        
        log_ai_operation(
            module="targeting",
            operation="generate_targeting_suggestions",
            campaign_id=campaign_id,
            count=count,
            platform=campaign.platform.value
        )
        
        # Generate targeting suggestions based on platform
        suggestions = []
        
        if campaign.platform.value == "meta":
            suggestions = await self._generate_meta_targeting(campaign, targeting_brief, count)
        elif campaign.platform.value == "google":
            suggestions = await self._generate_google_targeting(campaign, targeting_brief, count)
        elif campaign.platform.value == "tiktok":
            suggestions = await self._generate_tiktok_targeting(campaign, targeting_brief, count)
        else:
            suggestions = await self._generate_generic_targeting(campaign, targeting_brief, count)
        
        # Save suggestions to database
        saved_suggestions = []
        for suggestion in suggestions:
            targeting_suggestion = TargetingSuggestion(
                id=str(uuid.uuid4()),
                campaign_id=campaign_id,
                platform=campaign.platform.value,
                suggested_criteria=suggestion["criteria"],
                predicted_reach=suggestion.get("predicted_reach"),
                predicted_cpa=suggestion.get("predicted_cpa"),
                confidence_score=suggestion.get("confidence_score", 0.8),
                ai_model_version="1.0.0",
                metadata={
                    "generated_at": datetime.utcnow().isoformat(),
                    "targeting_brief": targeting_brief,
                    "suggestion_type": suggestion.get("type", "audience"),
                    "optimization_goals": suggestion.get("optimization_goals", {})
                }
            )
            
            db.add(targeting_suggestion)
            saved_suggestions.append({
                "id": targeting_suggestion.id,
                "platform": targeting_suggestion.platform,
                "criteria": targeting_suggestion.suggested_criteria,
                "predicted_reach": targeting_suggestion.predicted_reach,
                "predicted_cpa": targeting_suggestion.predicted_cpa,
                "confidence_score": targeting_suggestion.confidence_score,
                "metadata": targeting_suggestion.metadata
            })
        
        db.commit()
        
        self.logger.info(
            "Generated targeting suggestions",
            campaign_id=campaign_id,
            count=len(saved_suggestions)
        )
        
        return saved_suggestions
    
    async def _generate_meta_targeting(
        self,
        campaign: Campaign,
        targeting_brief: Dict[str, Any],
        count: int
    ) -> List[Dict[str, Any]]:
        """Generate Meta-specific targeting suggestions."""
        
        suggestions = []
        
        # Demographics targeting
        demographics = targeting_brief.get("demographics", {})
        if demographics:
            suggestions.append({
                "type": "demographics",
                "criteria": {
                    "age_min": demographics.get("age_min", 18),
                    "age_max": demographics.get("age_max", 65),
                    "genders": demographics.get("genders", ["all"]),
                    "locations": demographics.get("locations", ["United States"]),
                    "languages": demographics.get("languages", ["en"])
                },
                "predicted_reach": 1000000,
                "predicted_cpa": 15.0,
                "confidence_score": 0.9
            })
        
        # Interest targeting
        interests = targeting_brief.get("interests", [])
        if interests:
            suggestions.append({
                "type": "interests",
                "criteria": {
                    "interests": interests[:10],  # Limit to 10 interests
                    "behaviors": targeting_brief.get("behaviors", []),
                    "life_events": targeting_brief.get("life_events", [])
                },
                "predicted_reach": 500000,
                "predicted_cpa": 12.0,
                "confidence_score": 0.85
            })
        
        # Lookalike audiences
        if targeting_brief.get("lookalike_seed"):
            suggestions.append({
                "type": "lookalike",
                "criteria": {
                    "lookalike_seed": targeting_brief["lookalike_seed"],
                    "similarity": 0.02,  # 2% lookalike
                    "country": targeting_brief.get("country", "US")
                },
                "predicted_reach": 2000000,
                "predicted_cpa": 8.0,
                "confidence_score": 0.95
            })
        
        # Custom audiences
        if targeting_brief.get("custom_audiences"):
            suggestions.append({
                "type": "custom",
                "criteria": {
                    "custom_audiences": targeting_brief["custom_audiences"],
                    "exclusions": targeting_brief.get("exclusions", [])
                },
                "predicted_reach": 100000,
                "predicted_cpa": 5.0,
                "confidence_score": 0.98
            })
        
        # Behavioral targeting
        behaviors = targeting_brief.get("behaviors", [])
        if behaviors:
            suggestions.append({
                "type": "behavioral",
                "criteria": {
                    "behaviors": behaviors,
                    "purchase_behaviors": targeting_brief.get("purchase_behaviors", []),
                    "device_usage": targeting_brief.get("device_usage", [])
                },
                "predicted_reach": 300000,
                "predicted_cpa": 10.0,
                "confidence_score": 0.8
            })
        
        return suggestions[:count]
    
    async def _generate_google_targeting(
        self,
        campaign: Campaign,
        targeting_brief: Dict[str, Any],
        count: int
    ) -> List[Dict[str, Any]]:
        """Generate Google Ads-specific targeting suggestions."""
        
        suggestions = []
        
        # Keyword targeting
        keywords = targeting_brief.get("keywords", [])
        if keywords:
            suggestions.append({
                "type": "keywords",
                "criteria": {
                    "keywords": keywords,
                    "match_types": ["exact", "phrase", "broad"],
                    "negative_keywords": targeting_brief.get("negative_keywords", []),
                    "keyword_plans": targeting_brief.get("keyword_plans", [])
                },
                "predicted_reach": 500000,
                "predicted_cpa": 20.0,
                "confidence_score": 0.85
            })
        
        # Audience targeting
        audiences = targeting_brief.get("audiences", [])
        if audiences:
            suggestions.append({
                "type": "audiences",
                "criteria": {
                    "audiences": audiences,
                    "affinity_audiences": targeting_brief.get("affinity_audiences", []),
                    "in_market_audiences": targeting_brief.get("in_market_audiences", []),
                    "custom_audiences": targeting_brief.get("custom_audiences", [])
                },
                "predicted_reach": 800000,
                "predicted_cpa": 18.0,
                "confidence_score": 0.9
            })
        
        # Demographic targeting
        demographics = targeting_brief.get("demographics", {})
        if demographics:
            suggestions.append({
                "type": "demographics",
                "criteria": {
                    "age_ranges": demographics.get("age_ranges", ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"]),
                    "genders": demographics.get("genders", ["all"]),
                    "parental_status": demographics.get("parental_status", ["all"]),
                    "household_income": demographics.get("household_income", ["all"])
                },
                "predicted_reach": 1000000,
                "predicted_cpa": 15.0,
                "confidence_score": 0.8
            })
        
        # Placement targeting
        placements = targeting_brief.get("placements", [])
        if placements:
            suggestions.append({
                "type": "placements",
                "criteria": {
                    "placements": placements,
                    "excluded_placements": targeting_brief.get("excluded_placements", []),
                    "topics": targeting_brief.get("topics", []),
                    "content_categories": targeting_brief.get("content_categories", [])
                },
                "predicted_reach": 200000,
                "predicted_cpa": 12.0,
                "confidence_score": 0.75
            })
        
        # Location targeting
        locations = targeting_brief.get("locations", [])
        if locations:
            suggestions.append({
                "type": "locations",
                "criteria": {
                    "locations": locations,
                    "location_types": targeting_brief.get("location_types", ["all"]),
                    "radius_targeting": targeting_brief.get("radius_targeting", {}),
                    "excluded_locations": targeting_brief.get("excluded_locations", [])
                },
                "predicted_reach": 600000,
                "predicted_cpa": 16.0,
                "confidence_score": 0.9
            })
        
        return suggestions[:count]
    
    async def _generate_tiktok_targeting(
        self,
        campaign: Campaign,
        targeting_brief: Dict[str, Any],
        count: int
    ) -> List[Dict[str, Any]]:
        """Generate TikTok-specific targeting suggestions."""
        
        suggestions = []
        
        # Demographics targeting
        demographics = targeting_brief.get("demographics", {})
        if demographics:
            suggestions.append({
                "type": "demographics",
                "criteria": {
                    "age_ranges": demographics.get("age_ranges", ["18-24", "25-34", "35-44"]),
                    "genders": demographics.get("genders", ["all"]),
                    "languages": demographics.get("languages", ["en"]),
                    "countries": demographics.get("countries", ["US"])
                },
                "predicted_reach": 2000000,
                "predicted_cpa": 8.0,
                "confidence_score": 0.9
            })
        
        # Interest targeting
        interests = targeting_brief.get("interests", [])
        if interests:
            suggestions.append({
                "type": "interests",
                "criteria": {
                    "interests": interests,
                    "categories": targeting_brief.get("categories", []),
                    "subcategories": targeting_brief.get("subcategories", [])
                },
                "predicted_reach": 1000000,
                "predicted_cpa": 10.0,
                "confidence_score": 0.85
            })
        
        # Behavioral targeting
        behaviors = targeting_brief.get("behaviors", [])
        if behaviors:
            suggestions.append({
                "type": "behavioral",
                "criteria": {
                    "behaviors": behaviors,
                    "purchase_behaviors": targeting_brief.get("purchase_behaviors", []),
                    "app_usage": targeting_brief.get("app_usage", []),
                    "content_interactions": targeting_brief.get("content_interactions", [])
                },
                "predicted_reach": 800000,
                "predicted_cpa": 12.0,
                "confidence_score": 0.8
            })
        
        # Lookalike audiences
        if targeting_brief.get("lookalike_seed"):
            suggestions.append({
                "type": "lookalike",
                "criteria": {
                    "lookalike_seed": targeting_brief["lookalike_seed"],
                    "similarity": 0.01,  # 1% lookalike for TikTok
                    "country": targeting_brief.get("country", "US")
                },
                "predicted_reach": 3000000,
                "predicted_cpa": 6.0,
                "confidence_score": 0.95
            })
        
        # Custom audiences
        if targeting_brief.get("custom_audiences"):
            suggestions.append({
                "type": "custom",
                "criteria": {
                    "custom_audiences": targeting_brief["custom_audiences"],
                    "exclusions": targeting_brief.get("exclusions", [])
                },
                "predicted_reach": 150000,
                "predicted_cpa": 4.0,
                "confidence_score": 0.98
            })
        
        return suggestions[:count]
    
    async def _generate_generic_targeting(
        self,
        campaign: Campaign,
        targeting_brief: Dict[str, Any],
        count: int
    ) -> List[Dict[str, Any]]:
        """Generate generic targeting suggestions for any platform."""
        
        suggestions = []
        
        # Basic demographics
        demographics = targeting_brief.get("demographics", {})
        if demographics:
            suggestions.append({
                "type": "demographics",
                "criteria": {
                    "age_min": demographics.get("age_min", 18),
                    "age_max": demographics.get("age_max", 65),
                    "genders": demographics.get("genders", ["all"]),
                    "locations": demographics.get("locations", ["United States"])
                },
                "predicted_reach": 1000000,
                "predicted_cpa": 15.0,
                "confidence_score": 0.8
            })
        
        # Interest targeting
        interests = targeting_brief.get("interests", [])
        if interests:
            suggestions.append({
                "type": "interests",
                "criteria": {
                    "interests": interests,
                    "behaviors": targeting_brief.get("behaviors", [])
                },
                "predicted_reach": 500000,
                "predicted_cpa": 12.0,
                "confidence_score": 0.75
            })
        
        # Custom audiences
        if targeting_brief.get("custom_audiences"):
            suggestions.append({
                "type": "custom",
                "criteria": {
                    "custom_audiences": targeting_brief["custom_audiences"]
                },
                "predicted_reach": 100000,
                "predicted_cpa": 8.0,
                "confidence_score": 0.9
            })
        
        return suggestions[:count]
    
    async def optimize_targeting(
        self,
        db: Session,
        ad_group_id: str,
        performance_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Optimize targeting for an ad group based on performance data."""
        
        ad_group = db.query(AdGroup).filter(AdGroup.id == ad_group_id).first()
        if not ad_group:
            raise ValueError(f"Ad group {ad_group_id} not found")
        
        log_ai_operation(
            module="targeting",
            operation="optimize_targeting",
            ad_group_id=ad_group_id,
            platform=ad_group.platform.value
        )
        
        # Analyze current performance
        current_metrics = self._analyze_performance_metrics(performance_data)
        
        # Get optimization suggestions
        suggestions = await self._get_optimization_suggestions(ad_group, current_metrics)
        
        # Apply optimizations
        optimized_targeting = await self._apply_optimizations(ad_group, suggestions)
        
        # Update ad group targeting
        ad_group.targeting_criteria = optimized_targeting["criteria"]
        ad_group.metadata = {
            **ad_group.metadata,
            "optimizations": suggestions,
            "optimized_at": datetime.utcnow().isoformat()
        }
        
        db.commit()
        
        return optimized_targeting
    
    def _analyze_performance_metrics(self, performance_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze performance metrics to identify optimization opportunities."""
        
        metrics = {
            "cpa": performance_data.get("cpa", 0),
            "roas": performance_data.get("roas", 0),
            "ctr": performance_data.get("ctr", 0),
            "conversion_rate": performance_data.get("conversion_rate", 0),
            "impressions": performance_data.get("impressions", 0),
            "clicks": performance_data.get("clicks", 0),
            "conversions": performance_data.get("conversions", 0)
        }
        
        # Calculate performance score
        performance_score = self._calculate_performance_score(metrics)
        
        return {
            **metrics,
            "performance_score": performance_score,
            "needs_optimization": performance_score < 0.6
        }
    
    def _calculate_performance_score(self, metrics: Dict[str, Any]) -> float:
        """Calculate overall performance score for targeting."""
        
        # Weighted scoring based on key metrics
        cpa_weight = 0.3
        roas_weight = 0.3
        ctr_weight = 0.2
        conversion_rate_weight = 0.2
        
        # Normalize metrics (this is simplified - in production, use proper normalization)
        cpa_score = max(0, 1 - (metrics["cpa"] / 50))  # Lower CPA is better
        roas_score = min(1, metrics["roas"] / 4)  # Higher ROAS is better
        ctr_score = min(1, metrics["ctr"] / 0.05)  # Higher CTR is better
        conversion_rate_score = min(1, metrics["conversion_rate"] / 0.1)  # Higher conversion rate is better
        
        score = (
            cpa_score * cpa_weight +
            roas_score * roas_weight +
            ctr_score * ctr_weight +
            conversion_rate_score * conversion_rate_weight
        )
        
        return min(score, 1.0)
    
    async def _get_optimization_suggestions(
        self,
        ad_group: AdGroup,
        metrics: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Get optimization suggestions for an ad group."""
        
        suggestions = []
        
        # CPA optimization
        if metrics["cpa"] > 20:
            suggestions.append({
                "type": "cpa_optimization",
                "description": "High CPA detected. Consider narrowing targeting or adjusting bid strategy.",
                "priority": "high",
                "actions": [
                    "Narrow age range",
                    "Add more specific interests",
                    "Exclude low-performing placements"
                ]
            })
        
        # CTR optimization
        if metrics["ctr"] < 0.01:
            suggestions.append({
                "type": "ctr_optimization",
                "description": "Low CTR detected. Consider improving ad creative or targeting relevance.",
                "priority": "high",
                "actions": [
                    "Test different ad creatives",
                    "Refine interest targeting",
                    "Adjust ad copy messaging"
                ]
            })
        
        # Conversion rate optimization
        if metrics["conversion_rate"] < 0.02:
            suggestions.append({
                "type": "conversion_optimization",
                "description": "Low conversion rate detected. Consider improving landing page or targeting quality.",
                "priority": "medium",
                "actions": [
                    "Improve landing page experience",
                    "Target more qualified audiences",
                    "Add retargeting campaigns"
                ]
            })
        
        # Reach optimization
        if metrics["impressions"] < 1000:
            suggestions.append({
                "type": "reach_optimization",
                "description": "Low reach detected. Consider expanding targeting or increasing budget.",
                "priority": "medium",
                "actions": [
                    "Expand age range",
                    "Add more interests",
                    "Increase daily budget"
                ]
            })
        
        return suggestions
    
    async def _apply_optimizations(
        self,
        ad_group: AdGroup,
        suggestions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Apply optimization suggestions to an ad group."""
        
        current_criteria = ad_group.targeting_criteria or {}
        optimized_criteria = current_criteria.copy()
        
        for suggestion in suggestions:
            if suggestion["type"] == "cpa_optimization":
                # Narrow targeting
                if "age_min" in optimized_criteria:
                    optimized_criteria["age_min"] = min(optimized_criteria["age_min"] + 2, 65)
                if "age_max" in optimized_criteria:
                    optimized_criteria["age_max"] = max(optimized_criteria["age_max"] - 2, 18)
            
            elif suggestion["type"] == "ctr_optimization":
                # Add more specific interests
                if "interests" in optimized_criteria:
                    optimized_criteria["interests"] = optimized_criteria["interests"][:5]  # Keep only top 5
            
            elif suggestion["type"] == "conversion_optimization":
                # Add retargeting criteria
                optimized_criteria["retargeting"] = True
                optimized_criteria["lookalike_similarity"] = 0.01  # More similar lookalike
        
        return {
            "criteria": optimized_criteria,
            "optimizations_applied": len(suggestions),
            "suggestions": suggestions
        }
    
    async def get_targeting_insights(
        self,
        db: Session,
        campaign_id: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get targeting insights for a campaign."""
        
        # Get ad groups for the campaign
        ad_groups = db.query(AdGroup).filter(AdGroup.campaign_id == campaign_id).all()
        
        insights = []
        for ad_group in ad_groups:
            # Calculate performance metrics
            performance_score = self._calculate_performance_score({
                "cpa": ad_group.metadata.get("cpa", 0),
                "roas": ad_group.metadata.get("roas", 0),
                "ctr": ad_group.metadata.get("ctr", 0),
                "conversion_rate": ad_group.metadata.get("conversion_rate", 0)
            })
            
            insights.append({
                "ad_group_id": ad_group.id,
                "platform": ad_group.platform.value,
                "targeting_criteria": ad_group.targeting_criteria,
                "performance_score": performance_score,
                "recommendations": self._get_targeting_recommendations(ad_group)
            })
        
        # Sort by performance score
        insights.sort(key=lambda x: x["performance_score"], reverse=True)
        
        return insights[:limit]
    
    def _get_targeting_recommendations(self, ad_group: AdGroup) -> List[str]:
        """Get specific recommendations for improving targeting."""
        
        recommendations = []
        
        criteria = ad_group.targeting_criteria or {}
        
        # Check for overly broad targeting
        if criteria.get("age_min", 18) < 25 and criteria.get("age_max", 65) > 55:
            recommendations.append("Consider narrowing age range for better targeting precision")
        
        # Check for too many interests
        if len(criteria.get("interests", [])) > 10:
            recommendations.append("Reduce number of interests to focus on most relevant audiences")
        
        # Check for missing exclusions
        if not criteria.get("exclusions"):
            recommendations.append("Add exclusions to filter out irrelevant audiences")
        
        # Check for lookalike settings
        if criteria.get("lookalike_similarity", 0.02) > 0.05:
            recommendations.append("Consider using more similar lookalike audiences (1-2%)")
        
        return recommendations



