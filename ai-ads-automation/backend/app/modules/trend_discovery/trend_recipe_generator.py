"""
Trend recipe generator for creating content strategies based on trending topics.
"""

import json
from typing import Dict, Any, List, Optional
from app.core.logging import logger
from app.modules.ad_copy.llm_client import get_llm_client, AbstractLLMClient


class TrendRecipeGenerator:
    """Generates creative content strategies based on trending topics."""

    def __init__(self, llm_client: Optional[AbstractLLMClient] = None):
        self.llm_client = llm_client if llm_client else get_llm_client()
        logger.info("TrendRecipeGenerator initialized")

    async def make_trend_recipe(
        self, 
        brand: str, 
        trend: Dict[str, Any],
        target_audience: Optional[str] = None,
        campaign_goal: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a comprehensive trend recipe for a brand.
        
        Args:
            brand: Brand name
            trend: Trending item with name, type, and metadata
            target_audience: Optional target audience description
            campaign_goal: Optional campaign goal (awareness, conversion, engagement)
            
        Returns:
            Dict containing trend recipe with hook, B-roll, caption, script, and image prompt
        """
        logger.info(f"Creating trend recipe for brand: {brand}, trend: {trend['name']}")
        
        try:
            # Create the prompt for trend recipe generation
            prompt = self._create_trend_recipe_prompt(
                brand, trend, target_audience, campaign_goal
            )
            
            # Generate trend recipe using LLM
            response = await self.llm_client.generate_text(
                system_prompt=self._get_system_prompt(),
                user_prompt=prompt,
                temperature=0.8,
                max_tokens=800
            )
            
            if not response:
                logger.error("LLM returned empty response for trend recipe")
                return self._create_fallback_recipe(brand, trend)
            
            # Parse the JSON response
            try:
                result = json.loads(response[0])
                return self._validate_and_enhance_recipe(result, brand, trend)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse LLM response as JSON: {e}")
                return self._create_fallback_recipe(brand, trend)
                
        except Exception as e:
            logger.error(f"Error creating trend recipe: {e}", exc_info=True)
            return self._create_fallback_recipe(brand, trend)

    def _get_system_prompt(self) -> str:
        """Get the system prompt for trend recipe generation."""
        return """You are an expert social media strategist and content creator. Your job is to create comprehensive trend recipes that help brands capitalize on trending topics.

Your expertise includes:
- Viral content creation and trend analysis
- Social media platform optimization
- Video production and storytelling
- Hashtag strategy and audience engagement
- Brand voice adaptation and messaging
- Creative brief development

When creating trend recipes, focus on:
1. Authentic brand integration that feels natural
2. Platform-specific optimization
3. Clear, actionable creative direction
4. Engagement-driving elements
5. Conversion-focused strategies

Always return valid JSON with the exact structure requested."""

    def _create_trend_recipe_prompt(
        self, 
        brand: str, 
        trend: Dict[str, Any], 
        target_audience: Optional[str] = None,
        campaign_goal: Optional[str] = None
    ) -> str:
        """Create the user prompt for trend recipe generation."""
        trend_name = trend.get('name', '')
        trend_type = trend.get('type', 'hashtag')
        trend_meta = trend.get('meta', {})
        
        # Extract relevant metadata
        video_count = trend_meta.get('video_count', 0)
        view_count = trend_meta.get('view_count', 0)
        trend_score = trend_meta.get('trend_score', 0)
        category = trend_meta.get('category', '')
        
        prompt = f"""Create a comprehensive trend recipe for the following:

BRAND: {brand}
TREND: {trend_name} (Type: {trend_type})
TREND METRICS: {video_count:,} videos, {view_count:,} views, Score: {trend_score}/100
CATEGORY: {category}
"""
        
        if target_audience:
            prompt += f"TARGET AUDIENCE: {target_audience}\n"
        
        if campaign_goal:
            prompt += f"CAMPAIGN GOAL: {campaign_goal}\n"
        
        prompt += """
Create a trend recipe with these components:

1. HOOK (3-second attention grabber)
2. B-ROLL LIST (3 specific shots to film)
3. CAPTION (with 2 strategic hashtags)
4. AD SCRIPT (15-second version)
5. IMAGE GENERATION PROMPT (for carousel post)

Requirements:
- Make it authentic to the brand voice
- Ensure it feels natural, not forced
- Focus on engagement and conversion
- Optimize for the trend's platform
- Include clear visual direction
- Make it actionable for content creators

Return as JSON with these exact keys:
- "hook": "3-second hook idea"
- "broll_list": ["Shot 1 description", "Shot 2 description", "Shot 3 description"]
- "caption": "Full caption with 2 hashtags"
- "ad_script": "15-second ad script"
- "image_prompt": "Detailed prompt for image generation"
- "platform_optimization": "Platform-specific tips"
- "engagement_strategy": "How to maximize engagement"
- "conversion_tactics": "How to drive conversions"
"""
        
        return prompt

    def _validate_and_enhance_recipe(
        self, 
        result: Dict[str, Any], 
        brand: str, 
        trend: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Validate and enhance the trend recipe."""
        # Ensure all required keys exist
        required_keys = [
            "hook", "broll_list", "caption", "ad_script", 
            "image_prompt", "platform_optimization", 
            "engagement_strategy", "conversion_tactics"
        ]
        
        for key in required_keys:
            if key not in result:
                logger.warning(f"Missing key '{key}' in trend recipe response")
                result[key] = self._get_default_value(key, brand, trend)
        
        # Validate B-roll list
        if not isinstance(result["broll_list"], list) or len(result["broll_list"]) < 3:
            result["broll_list"] = [
                "Wide establishing shot showing the product in context",
                "Close-up detail shot highlighting key features",
                "Action shot demonstrating the product in use"
            ]
        
        # Ensure we have exactly 3 B-roll shots
        result["broll_list"] = result["broll_list"][:3]
        
        # Add metadata
        result["brand"] = brand
        result["trend_name"] = trend.get('name', '')
        result["trend_type"] = trend.get('type', 'hashtag')
        result["created_at"] = trend.get('meta', {}).get('discovered_at', '')
        
        # Add trend metrics
        trend_meta = trend.get('meta', {})
        result["trend_metrics"] = {
            "video_count": trend_meta.get('video_count', 0),
            "view_count": trend_meta.get('view_count', 0),
            "trend_score": trend_meta.get('trend_score', 0),
            "category": trend_meta.get('category', '')
        }
        
        return result

    def _get_default_value(self, key: str, brand: str, trend: Dict[str, Any]) -> Any:
        """Get default value for missing keys."""
        trend_name = trend.get('name', 'trending topic')
        
        defaults = {
            "hook": f"Discover how {brand} is revolutionizing {trend_name}!",
            "broll_list": [
                "Wide establishing shot showing the product in context",
                "Close-up detail shot highlighting key features", 
                "Action shot demonstrating the product in use"
            ],
            "caption": f"Exciting news! {brand} is embracing {trend_name} and we're here for it! 🚀 #innovation #trending",
            "ad_script": f"In just 15 seconds, see how {brand} is changing the game with {trend_name}. Don't miss out!",
            "image_prompt": f"Professional product photography of {brand} products, modern lifestyle setting, trending {trend_name} theme, high quality, commercial style",
            "platform_optimization": "Optimize for the platform where this trend is most popular",
            "engagement_strategy": "Use the trend hashtag, engage with comments, and create user-generated content",
            "conversion_tactics": "Include clear call-to-action and link to product page"
        }
        
        return defaults.get(key, "")

    def _create_fallback_recipe(self, brand: str, trend: Dict[str, Any]) -> Dict[str, Any]:
        """Create a fallback recipe when generation fails."""
        logger.warning(f"Creating fallback recipe for brand: {brand}, trend: {trend['name']}")
        
        trend_name = trend.get('name', 'trending topic')
        
        return {
            "brand": brand,
            "trend_name": trend_name,
            "trend_type": trend.get('type', 'hashtag'),
            "created_at": trend.get('meta', {}).get('discovered_at', ''),
            "hook": f"Discover how {brand} is revolutionizing {trend_name}!",
            "broll_list": [
                "Wide establishing shot showing the product in context",
                "Close-up detail shot highlighting key features",
                "Action shot demonstrating the product in use"
            ],
            "caption": f"Exciting news! {brand} is embracing {trend_name} and we're here for it! 🚀 #innovation #trending",
            "ad_script": f"In just 15 seconds, see how {brand} is changing the game with {trend_name}. Don't miss out!",
            "image_prompt": f"Professional product photography of {brand} products, modern lifestyle setting, trending {trend_name} theme, high quality, commercial style",
            "platform_optimization": "Optimize for the platform where this trend is most popular",
            "engagement_strategy": "Use the trend hashtag, engage with comments, and create user-generated content",
            "conversion_tactics": "Include clear call-to-action and link to product page",
            "trend_metrics": trend.get('meta', {}),
            "is_fallback": True
        }

    async def generate_multiple_recipes(
        self,
        brand: str,
        trends: List[Dict[str, Any]],
        target_audience: Optional[str] = None,
        campaign_goal: Optional[str] = None,
        max_recipes: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Generate trend recipes for multiple trends.
        
        Args:
            brand: Brand name
            trends: List of trending items
            target_audience: Optional target audience description
            campaign_goal: Optional campaign goal
            max_recipes: Maximum number of recipes to generate
            
        Returns:
            List of trend recipes
        """
        logger.info(f"Generating {min(len(trends), max_recipes)} trend recipes for brand: {brand}")
        
        recipes = []
        
        for trend in trends[:max_recipes]:
            try:
                recipe = await self.make_trend_recipe(
                    brand, trend, target_audience, campaign_goal
                )
                recipes.append(recipe)
            except Exception as e:
                logger.error(f"Error generating recipe for trend {trend.get('name', 'unknown')}: {e}")
                # Add fallback recipe
                recipes.append(self._create_fallback_recipe(brand, trend))
        
        return recipes

    async def analyze_trend_potential(
        self,
        brand: str,
        trend: Dict[str, Any],
        brand_category: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze the potential of a trend for a specific brand.
        
        Args:
            brand: Brand name
            trend: Trending item
            brand_category: Brand's industry category
            
        Returns:
            Dict with trend analysis and recommendations
        """
        try:
            trend_meta = trend.get('meta', {})
            trend_score = trend_meta.get('trend_score', 0)
            video_count = trend_meta.get('video_count', 0)
            view_count = trend_meta.get('view_count', 0)
            category = trend_meta.get('category', '')
            
            # Calculate relevance score
            relevance_score = 0
            
            # Category match bonus
            if brand_category and category and brand_category.lower() in category.lower():
                relevance_score += 30
            
            # Trend score bonus
            relevance_score += min(trend_score, 50)
            
            # Engagement bonus
            if video_count > 10000:
                relevance_score += 10
            if view_count > 1000000:
                relevance_score += 10
            
            # Determine recommendation
            if relevance_score >= 70:
                recommendation = "high_priority"
                priority_color = "green"
            elif relevance_score >= 40:
                recommendation = "medium_priority"
                priority_color = "yellow"
            else:
                recommendation = "low_priority"
                priority_color = "red"
            
            return {
                "trend_name": trend.get('name', ''),
                "brand": brand,
                "relevance_score": min(relevance_score, 100),
                "recommendation": recommendation,
                "priority_color": priority_color,
                "trend_metrics": trend_meta,
                "analysis": {
                    "category_match": brand_category and category and brand_category.lower() in category.lower(),
                    "trend_strength": "high" if trend_score > 80 else "medium" if trend_score > 50 else "low",
                    "engagement_level": "high" if video_count > 10000 else "medium" if video_count > 1000 else "low",
                    "reach_potential": "high" if view_count > 1000000 else "medium" if view_count > 100000 else "low"
                },
                "recommendations": self._get_trend_recommendations(recommendation, trend_meta)
            }
            
        except Exception as e:
            logger.error(f"Error analyzing trend potential: {e}", exc_info=True)
            return {
                "trend_name": trend.get('name', ''),
                "brand": brand,
                "relevance_score": 0,
                "recommendation": "unknown",
                "priority_color": "gray",
                "error": str(e)
            }

    def _get_trend_recommendations(self, recommendation: str, trend_meta: Dict[str, Any]) -> List[str]:
        """Get specific recommendations based on trend analysis."""
        if recommendation == "high_priority":
            return [
                "Create content immediately to capitalize on this trend",
                "Consider running paid ads to boost visibility",
                "Engage with existing content using this trend",
                "Create multiple content pieces across platforms"
            ]
        elif recommendation == "medium_priority":
            return [
                "Monitor trend performance before committing resources",
                "Create one piece of content to test engagement",
                "Consider if trend aligns with brand values",
                "Prepare content but don't rush to publish"
            ]
        else:
            return [
                "Trend may not be suitable for this brand",
                "Focus on other trends with higher relevance",
                "Consider if trend fits brand voice and values",
                "Monitor for trend evolution or changes"
            ]



