"""
Creative Generator module with video app integration and synthetic fallback.
"""

import asyncio
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import get_logger, log_ai_operation
from app.models.ai import CreativeGeneration
from app.models.campaign import Campaign
from app.modules.creative.synthetic_generator import SyntheticCreativeGenerator
from app.modules.creative.video_app_client import VideoAppClient


class CreativeGenerator:
    """Creative Generator with video app integration and synthetic fallback."""
    
    def __init__(self):
        self.video_app_client = VideoAppClient()
        self.synthetic_generator = SyntheticCreativeGenerator()
        self.logger = get_logger("creative_generator")
    
    async def generate_campaign_creatives(
        self,
        db: Session,
        campaign_id: str,
        creative_brief: Dict[str, Any],
        count: int = 3
    ) -> List[Dict[str, Any]]:
        """Generate creative assets for a campaign."""
        
        # Get campaign details
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            raise ValueError(f"Campaign {campaign_id} not found")
        
        log_ai_operation(
            module="creative",
            operation="generate_campaign_creatives",
            campaign_id=campaign_id,
            count=count,
            platform=campaign.platform.value
        )
        
        # Generate creatives based on platform
        creatives = []
        
        if campaign.platform.value == "meta":
            creatives = await self._generate_meta_creatives(campaign, creative_brief, count)
        elif campaign.platform.value == "google":
            creatives = await self._generate_google_creatives(campaign, creative_brief, count)
        elif campaign.platform.value == "tiktok":
            creatives = await self._generate_tiktok_creatives(campaign, creative_brief, count)
        else:
            creatives = await self._generate_generic_creatives(campaign, creative_brief, count)
        
        # Save creatives to database
        saved_creatives = []
        for creative in creatives:
            creative_gen = CreativeGeneration(
                id=str(uuid.uuid4()),
                campaign_id=campaign_id,
                type=creative["type"],
                format=creative["format"],
                platform=campaign.platform.value,
                image_url=creative.get("image_url"),
                video_url=creative.get("video_url"),
                thumbnail_url=creative.get("thumbnail_url"),
                ai_generated=True,
                ai_score=creative.get("ai_score", 0.8),
                ai_feedback=creative.get("ai_feedback"),
                ai_model_version="1.0.0",
                prompt=creative.get("prompt"),
                style_guide=creative.get("style_guide"),
                brand_guidelines=creative.get("brand_guidelines"),
                metadata={
                    "generated_at": datetime.utcnow().isoformat(),
                    "generation_method": creative.get("generation_method", "ai"),
                    "platform_specs": creative.get("platform_specs", {}),
                    "variations": creative.get("variations", [])
                }
            )
            
            db.add(creative_gen)
            saved_creatives.append({
                "id": creative_gen.id,
                "type": creative_gen.type,
                "format": creative_gen.format,
                "image_url": creative_gen.image_url,
                "video_url": creative_gen.video_url,
                "thumbnail_url": creative_gen.thumbnail_url,
                "ai_score": creative_gen.ai_score,
                "ai_feedback": creative_gen.ai_feedback,
                "metadata": creative_gen.metadata
            })
        
        db.commit()
        
        self.logger.info(
            "Generated campaign creatives",
            campaign_id=campaign_id,
            count=len(saved_creatives)
        )
        
        return saved_creatives
    
    async def _generate_meta_creatives(
        self,
        campaign: Campaign,
        creative_brief: Dict[str, Any],
        count: int
    ) -> List[Dict[str, Any]]:
        """Generate Meta-specific creatives."""
        
        creatives = []
        
        # Try video app first
        if settings.CREATIVE_APP_API_URL and settings.CREATIVE_APP_API_KEY:
            try:
                video_creatives = await self.video_app_client.generate_meta_creatives(
                    creative_brief=creative_brief,
                    count=count
                )
                creatives.extend(video_creatives)
            except Exception as e:
                self.logger.warning("Video app failed, falling back to synthetic", error=str(e))
        
        # Fallback to synthetic if needed
        if len(creatives) < count and settings.FALLBACK_TO_SYNTHETIC:
            synthetic_creatives = await self.synthetic_generator.generate_meta_creatives(
                creative_brief=creative_brief,
                count=count - len(creatives)
            )
            creatives.extend(synthetic_creatives)
        
        return creatives[:count]
    
    async def _generate_google_creatives(
        self,
        campaign: Campaign,
        creative_brief: Dict[str, Any],
        count: int
    ) -> List[Dict[str, Any]]:
        """Generate Google Ads-specific creatives."""
        
        creatives = []
        
        # Try video app first
        if settings.CREATIVE_APP_API_URL and settings.CREATIVE_APP_API_KEY:
            try:
                video_creatives = await self.video_app_client.generate_google_creatives(
                    creative_brief=creative_brief,
                    count=count
                )
                creatives.extend(video_creatives)
            except Exception as e:
                self.logger.warning("Video app failed, falling back to synthetic", error=str(e))
        
        # Fallback to synthetic if needed
        if len(creatives) < count and settings.FALLBACK_TO_SYNTHETIC:
            synthetic_creatives = await self.synthetic_generator.generate_google_creatives(
                creative_brief=creative_brief,
                count=count - len(creatives)
            )
            creatives.extend(synthetic_creatives)
        
        return creatives[:count]
    
    async def _generate_tiktok_creatives(
        self,
        campaign: Campaign,
        creative_brief: Dict[str, Any],
        count: int
    ) -> List[Dict[str, Any]]:
        """Generate TikTok-specific creatives."""
        
        creatives = []
        
        # Try video app first
        if settings.CREATIVE_APP_API_URL and settings.CREATIVE_APP_API_KEY:
            try:
                video_creatives = await self.video_app_client.generate_tiktok_creatives(
                    creative_brief=creative_brief,
                    count=count
                )
                creatives.extend(video_creatives)
            except Exception as e:
                self.logger.warning("Video app failed, falling back to synthetic", error=str(e))
        
        # Fallback to synthetic if needed
        if len(creatives) < count and settings.FALLBACK_TO_SYNTHETIC:
            synthetic_creatives = await self.synthetic_generator.generate_tiktok_creatives(
                creative_brief=creative_brief,
                count=count - len(creatives)
            )
            creatives.extend(synthetic_creatives)
        
        return creatives[:count]
    
    async def _generate_generic_creatives(
        self,
        campaign: Campaign,
        creative_brief: Dict[str, Any],
        count: int
    ) -> List[Dict[str, Any]]:
        """Generate generic creatives for any platform."""
        
        creatives = []
        
        # Try video app first
        if settings.CREATIVE_APP_API_URL and settings.CREATIVE_APP_API_KEY:
            try:
                video_creatives = await self.video_app_client.generate_generic_creatives(
                    creative_brief=creative_brief,
                    count=count
                )
                creatives.extend(video_creatives)
            except Exception as e:
                self.logger.warning("Video app failed, falling back to synthetic", error=str(e))
        
        # Fallback to synthetic if needed
        if len(creatives) < count and settings.FALLBACK_TO_SYNTHETIC:
            synthetic_creatives = await self.synthetic_generator.generate_generic_creatives(
                creative_brief=creative_brief,
                count=count - len(creatives)
            )
            creatives.extend(synthetic_creatives)
        
        return creatives[:count]
    
    async def optimize_creative(
        self,
        db: Session,
        creative_id: str,
        optimization_goals: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Optimize an existing creative based on performance data."""
        
        creative = db.query(CreativeGeneration).filter(CreativeGeneration.id == creative_id).first()
        if not creative:
            raise ValueError(f"Creative {creative_id} not found")
        
        log_ai_operation(
            module="creative",
            operation="optimize_creative",
            creative_id=creative_id,
            platform=creative.platform
        )
        
        # Get optimization suggestions
        suggestions = await self._get_optimization_suggestions(creative, optimization_goals)
        
        # Apply optimizations
        optimized_creative = await self._apply_optimizations(creative, suggestions)
        
        # Update creative in database
        creative.metadata = {
            **creative.metadata,
            "optimizations": suggestions,
            "optimized_at": datetime.utcnow().isoformat()
        }
        
        db.commit()
        
        return optimized_creative
    
    async def _get_optimization_suggestions(
        self,
        creative: CreativeGeneration,
        goals: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Get optimization suggestions for a creative."""
        
        suggestions = []
        
        # Analyze current performance
        if creative.engagement_rate < 0.03:
            suggestions.append({
                "type": "visual_enhancement",
                "description": "Add more vibrant colors and dynamic elements",
                "priority": "high"
            })
        
        if creative.impressions > 1000 and creative.clicks < 50:
            suggestions.append({
                "type": "headline_optimization",
                "description": "Make the headline more compelling and action-oriented",
                "priority": "high"
            })
        
        if creative.conversions < 5 and creative.clicks > 100:
            suggestions.append({
                "type": "cta_improvement",
                "description": "Improve the call-to-action button design and text",
                "priority": "medium"
            })
        
        return suggestions
    
    async def _apply_optimizations(
        self,
        creative: CreativeGeneration,
        suggestions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Apply optimization suggestions to a creative."""
        
        # This would integrate with the video app or synthetic generator
        # to actually apply the optimizations
        
        optimized_creative = {
            "id": creative.id,
            "type": creative.type,
            "format": creative.format,
            "image_url": creative.image_url,
            "video_url": creative.video_url,
            "thumbnail_url": creative.thumbnail_url,
            "optimizations_applied": len(suggestions),
            "suggestions": suggestions
        }
        
        return optimized_creative
    
    async def get_creative_performance_insights(
        self,
        db: Session,
        campaign_id: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get performance insights for creatives in a campaign."""
        
        # Get top performing creatives
        top_creatives = db.query(CreativeGeneration).filter(
            CreativeGeneration.campaign_id == campaign_id,
            CreativeGeneration.impressions > 0
        ).order_by(CreativeGeneration.engagement_rate.desc()).limit(limit).all()
        
        insights = []
        for creative in top_creatives:
            insights.append({
                "id": creative.id,
                "type": creative.type,
                "format": creative.format,
                "performance_score": self._calculate_performance_score(creative),
                "engagement_rate": float(creative.engagement_rate),
                "impressions": creative.impressions,
                "clicks": creative.clicks,
                "conversions": creative.conversions,
                "ai_score": creative.ai_score,
                "recommendations": self._get_creative_recommendations(creative)
            })
        
        return insights
    
    def _calculate_performance_score(self, creative: CreativeGeneration) -> float:
        """Calculate overall performance score for a creative."""
        
        engagement_weight = 0.4
        conversion_weight = 0.4
        ai_score_weight = 0.2
        
        conversion_rate = creative.conversions / max(creative.clicks, 1)
        
        score = (
            creative.engagement_rate * engagement_weight +
            conversion_rate * conversion_weight +
            (creative.ai_score or 0.5) * ai_score_weight
        )
        
        return min(score, 1.0)
    
    def _get_creative_recommendations(self, creative: CreativeGeneration) -> List[str]:
        """Get specific recommendations for improving a creative."""
        
        recommendations = []
        
        if creative.engagement_rate < 0.02:
            recommendations.append("Consider adding more dynamic visual elements")
        
        if creative.conversions / max(creative.clicks, 1) < 0.05:
            recommendations.append("Improve the call-to-action design and placement")
        
        if creative.impressions > 5000 and creative.clicks < 100:
            recommendations.append("Test different headlines and visual hooks")
        
        if creative.ai_score and creative.ai_score < 0.6:
            recommendations.append("Consider regenerating with different style parameters")
        
        return recommendations



