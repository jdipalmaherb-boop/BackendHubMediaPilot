"""
Ad Copy Generator module with Sabri Suby direct-response optimization.
"""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.core.logging import get_logger, log_ai_operation
from app.models.ai import AdCopy
from app.models.campaign import Campaign
from app.modules.ad_copy.llm_client import LLMManager
from app.modules.ad_copy.prompts import SabriSubyPrompts


class AdCopyGenerator:
    """Ad Copy Generator with Sabri Suby direct-response optimization."""
    
    def __init__(self):
        self.llm_manager = LLMManager()
        self.prompts = SabriSubyPrompts()
        self.logger = get_logger("ad_copy_generator")
    
    async def generate_campaign_copy(
        self,
        db: Session,
        campaign_id: str,
        variations: int = 5,
        style: str = "sabri_suby"
    ) -> List[Dict[str, Any]]:
        """Generate ad copy variations for a campaign."""
        
        # Get campaign details
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            raise ValueError(f"Campaign {campaign_id} not found")
        
        log_ai_operation(
            module="ad_copy",
            operation="generate_campaign_copy",
            campaign_id=campaign_id,
            variations=variations,
            style=style
        )
        
        # Extract campaign context
        context = self._extract_campaign_context(campaign)
        
        # Generate copy variations
        copy_variations = await self.llm_manager.generate_ad_copy(
            product=context["product"],
            target_audience=context["target_audience"],
            pain_points=context["pain_points"],
            benefits=context["benefits"],
            platform=campaign.platform.value,
            objective=campaign.objective.value,
            style=style,
            variations=variations
        )
        
        # Save variations to database
        saved_variations = []
        for variation in copy_variations:
            ad_copy = AdCopy(
                id=str(uuid.uuid4()),
                campaign_id=campaign_id,
                headline=variation["headline"],
                primary_text=variation["primary_text"],
                cta_text=variation["cta"],
                style=variation["style"],
                length=len(variation["primary_text"]),
                ai_generated=True,
                ai_confidence=variation["confidence"],
                ai_model_version="1.0.0",
                metadata={
                    "emotional_triggers": variation.get("emotional_triggers", []),
                    "urgency_factors": variation.get("urgency_factors", []),
                    "variation_id": variation.get("variation_id"),
                    "generated_at": datetime.utcnow().isoformat()
                }
            )
            
            db.add(ad_copy)
            saved_variations.append({
                "id": ad_copy.id,
                "headline": ad_copy.headline,
                "primary_text": ad_copy.primary_text,
                "cta_text": ad_copy.cta_text,
                "style": ad_copy.style,
                "confidence": ad_copy.ai_confidence,
                "metadata": ad_copy.metadata
            })
        
        db.commit()
        
        self.logger.info(
            "Generated ad copy variations",
            campaign_id=campaign_id,
            count=len(saved_variations)
        )
        
        return saved_variations
    
    async def generate_copy_for_context(
        self,
        product: str,
        target_audience: str,
        pain_points: List[str],
        benefits: List[str],
        platform: str,
        objective: str,
        style: str = "sabri_suby",
        variations: int = 3
    ) -> List[Dict[str, Any]]:
        """Generate ad copy for a specific context without saving to database."""
        
        log_ai_operation(
            module="ad_copy",
            operation="generate_copy_for_context",
            product=product,
            platform=platform,
            style=style,
            variations=variations
        )
        
        return await self.llm_manager.generate_ad_copy(
            product=product,
            target_audience=target_audience,
            pain_points=pain_points,
            benefits=benefits,
            platform=platform,
            objective=objective,
            style=style,
            variations=variations
        )
    
    async def analyze_copy_performance(
        self,
        db: Session,
        ad_copy_id: str,
        performance_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Analyze the performance of a specific ad copy."""
        
        ad_copy = db.query(AdCopy).filter(AdCopy.id == ad_copy_id).first()
        if not ad_copy:
            raise ValueError(f"Ad copy {ad_copy_id} not found")
        
        # Update performance metrics
        ad_copy.impressions = performance_data.get("impressions", 0)
        ad_copy.clicks = performance_data.get("clicks", 0)
        ad_copy.conversions = performance_data.get("conversions", 0)
        ad_copy.ctr = performance_data.get("ctr", 0.0)
        ad_copy.engagement_rate = performance_data.get("engagement_rate", 0.0)
        
        # Calculate performance score
        performance_score = self._calculate_performance_score(performance_data)
        
        # Update metadata with performance analysis
        analysis = {
            "performance_score": performance_score,
            "ctr_percentile": self._calculate_ctr_percentile(ad_copy.ctr),
            "conversion_rate": ad_copy.conversions / max(ad_copy.clicks, 1),
            "analyzed_at": datetime.utcnow().isoformat()
        }
        
        ad_copy.metadata = {**ad_copy.metadata, "performance_analysis": analysis}
        
        db.commit()
        
        self.logger.info(
            "Analyzed copy performance",
            ad_copy_id=ad_copy_id,
            performance_score=performance_score
        )
        
        return analysis
    
    async def get_copy_recommendations(
        self,
        db: Session,
        campaign_id: str,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """Get copy recommendations based on performance data."""
        
        # Get top performing copies for the campaign
        top_copies = db.query(AdCopy).filter(
            AdCopy.campaign_id == campaign_id,
            AdCopy.impressions > 0
        ).order_by(AdCopy.ctr.desc()).limit(limit).all()
        
        recommendations = []
        for copy in top_copies:
            recommendations.append({
                "id": copy.id,
                "headline": copy.headline,
                "primary_text": copy.primary_text,
                "cta_text": copy.cta_text,
                "performance_score": copy.metadata.get("performance_analysis", {}).get("performance_score", 0),
                "ctr": float(copy.ctr),
                "conversions": copy.conversions,
                "recommendations": self._generate_copy_recommendations(copy)
            })
        
        return recommendations
    
    def _extract_campaign_context(self, campaign: Campaign) -> Dict[str, Any]:
        """Extract context from campaign for copy generation."""
        
        # This would typically come from campaign metadata or external data
        # For now, we'll use placeholder data
        return {
            "product": campaign.name,
            "target_audience": "Digital marketers and business owners",
            "pain_points": [
                "Manual campaign management is time-consuming",
                "Low ROI on advertising spend",
                "Difficulty scaling campaigns effectively"
            ],
            "benefits": [
                "Automated optimization saves time",
                "Higher ROI through AI-driven decisions",
                "Easy scaling across multiple platforms"
            ]
        }
    
    def _calculate_performance_score(self, performance_data: Dict[str, Any]) -> float:
        """Calculate overall performance score for ad copy."""
        
        ctr = performance_data.get("ctr", 0.0)
        conversion_rate = performance_data.get("conversion_rate", 0.0)
        engagement_rate = performance_data.get("engagement_rate", 0.0)
        
        # Weighted performance score
        score = (
            ctr * 0.4 +
            conversion_rate * 0.4 +
            engagement_rate * 0.2
        )
        
        return min(score, 1.0)  # Cap at 1.0
    
    def _calculate_ctr_percentile(self, ctr: float) -> float:
        """Calculate CTR percentile based on industry benchmarks."""
        
        # Industry CTR benchmarks (simplified)
        benchmarks = {
            "meta": {"p50": 0.02, "p75": 0.03, "p90": 0.05},
            "google": {"p50": 0.03, "p75": 0.05, "p90": 0.08},
            "tiktok": {"p50": 0.01, "p75": 0.02, "p90": 0.04}
        }
        
        # This would be more sophisticated in production
        if ctr >= 0.05:
            return 0.9
        elif ctr >= 0.03:
            return 0.75
        elif ctr >= 0.02:
            return 0.5
        else:
            return 0.25
    
    def _generate_copy_recommendations(self, ad_copy: AdCopy) -> List[str]:
        """Generate specific recommendations for improving ad copy."""
        
        recommendations = []
        
        if ad_copy.ctr < 0.02:
            recommendations.append("Consider making the headline more compelling")
        
        if ad_copy.conversions / max(ad_copy.clicks, 1) < 0.05:
            recommendations.append("Improve the call-to-action clarity")
        
        if len(ad_copy.primary_text) > 200:
            recommendations.append("Consider shortening the primary text")
        
        if ad_copy.engagement_rate < 0.03:
            recommendations.append("Add more emotional triggers to increase engagement")
        
        return recommendations


class SabriSubyPrompts:
    """Sabri Suby style prompts and templates."""
    
    def __init__(self):
        self.logger = get_logger("sabri_suby_prompts")
    
    def get_pain_point_prompts(self) -> List[str]:
        """Get common pain point prompts for different industries."""
        
        return [
            "Struggling with [PROBLEM] that's costing you [COST]?",
            "Tired of [PROBLEM] holding back your success?",
            "Frustrated with [PROBLEM] that never seems to get better?",
            "Worried that [PROBLEM] is destroying your [GOAL]?",
            "Sick of [PROBLEM] that's been plaguing you for [TIME]?"
        ]
    
    def get_solution_prompts(self) -> List[str]:
        """Get solution-focused prompts."""
        
        return [
            "Finally, a proven solution that [BENEFIT]",
            "What if I told you there's a way to [BENEFIT]?",
            "Here's the breakthrough method that [BENEFIT]",
            "The secret that [BENEFIT] is finally revealed",
            "This revolutionary approach [BENEFIT]"
        ]
    
    def get_offer_prompts(self) -> List[str]:
        """Get clear offer prompts."""
        
        return [
            "Get [PRODUCT] for just [PRICE] (normally [REGULAR_PRICE])",
            "Limited time: [PRODUCT] at [DISCOUNT]% off",
            "Exclusive offer: [PRODUCT] with [BONUS]",
            "Special deal: [PRODUCT] + [BONUS] for [PRICE]",
            "Today only: [PRODUCT] for [PRICE] (save [SAVINGS])"
        ]
    
    def get_urgency_prompts(self) -> List[str]:
        """Get urgency-creating prompts."""
        
        return [
            "But hurry - this offer expires in [TIME]",
            "Only [NUMBER] spots left at this price",
            "This deal won't last long",
            "Don't wait - [CONSEQUENCE]",
            "Act now before it's too late"
        ]
    
    def get_social_proof_prompts(self) -> List[str]:
        """Get social proof prompts."""
        
        return [
            "Join [NUMBER]+ satisfied customers",
            "Trusted by [COMPANIES]",
            "Over [NUMBER] people have already [BENEFIT]",
            "Rated [RATING] stars by [NUMBER] users",
            "Featured in [PUBLICATIONS]"
        ]
    
    def get_guarantee_prompts(self) -> List[str]:
        """Get risk reversal prompts."""
        
        return [
            "100% money-back guarantee",
            "30-day risk-free trial",
            "If you're not satisfied, we'll refund every penny",
            "No questions asked refund policy",
            "Try it risk-free for [TIME]"
        ]



