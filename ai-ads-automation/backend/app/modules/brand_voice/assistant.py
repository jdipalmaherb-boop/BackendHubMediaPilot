"""
Brand Voice Assistant for generating high-converting captions based on winning examples.
"""

import json
import re
from typing import List, Dict, Any, Optional
from app.core.logging import logger
from app.modules.ad_copy.llm_client import get_llm_client, AbstractLLMClient
from app.modules.feedback_loop.feedback_service import FeedbackService


class BrandVoiceAssistant:
    """AI assistant that generates high-converting captions using winning content patterns."""

    def __init__(self, llm_client: Optional[AbstractLLMClient] = None, feedback_service: Optional[FeedbackService] = None):
        self.llm_client = llm_client if llm_client else get_llm_client()
        self.feedback_service = feedback_service if feedback_service else FeedbackService()
        logger.info("BrandVoiceAssistant initialized")

    async def generate_caption(
        self,
        brand: str,
        platform: str,
        tone: str,
        top_winning_examples: List[str],
        product_description: Optional[str] = None,
        target_audience: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate high-converting caption variants based on winning examples.
        
        Args:
            brand: Brand name
            platform: Social media platform
            tone: Desired tone (e.g., "professional", "casual", "urgent")
            top_winning_examples: List of top 3 winning content examples
            product_description: Optional product description
            target_audience: Optional target audience description
            
        Returns:
            Dict with primary caption, alternatives, hashtags, and CTA
        """
        logger.info(f"Generating caption for brand: {brand}, platform: {platform}, tone: {tone}")
        
        try:
            # Create the system prompt
            system_prompt = self._create_system_prompt(brand, platform, tone)
            
            # Create the user prompt with examples
            user_prompt = self._create_user_prompt(
                brand, platform, tone, top_winning_examples, 
                product_description, target_audience
            )
            
            # Generate caption using LLM
            response = await self.llm_client.generate_text(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.8,
                max_tokens=1000
            )
            
            if not response:
                logger.error("LLM returned empty response")
                return self._create_fallback_response(brand, platform)
            
            # Parse the JSON response
            try:
                result = json.loads(response[0])
                return self._validate_and_clean_response(result, brand, platform)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse LLM response as JSON: {e}")
                return self._create_fallback_response(brand, platform)
                
        except Exception as e:
            logger.error(f"Error generating caption: {e}", exc_info=True)
            return self._create_fallback_response(brand, platform)

    def _create_system_prompt(self, brand: str, platform: str, tone: str) -> str:
        """Create the system prompt for the brand voice assistant."""
        return f"""You are a brand voice assistant for {brand}. Your job is to write HIGH-CONVERTING captions that drive engagement and sales.

BRAND: {brand}
PLATFORM: {platform}
TONE: {tone}

RULES:
1. Study the winning examples provided to understand what works for this brand
2. Match the tone and style of successful content
3. Use proven psychological triggers: urgency, scarcity, social proof, FOMO
4. Include emotional hooks and pain points
5. Make it conversational and relatable
6. Keep captions under 2200 characters
7. Use platform-appropriate formatting
8. Include clear value propositions

OUTPUT FORMAT:
Return a JSON object with these exact keys:
- "primary": The best caption variant (main recommendation)
- "alts": Array of 2 alternative caption variants
- "hashtags": Array of 10 relevant hashtags
- "cta": A compelling call-to-action (1-2 sentences)

CAPTION STRUCTURE:
- Hook: Grab attention in first 3 words
- Problem: Identify pain point or desire
- Solution: Present your product/service as the answer
- Proof: Add credibility or social proof
- Urgency: Create time-sensitive reason to act
- CTA: Clear next step

Remember: Your goal is to convert viewers into customers by following proven patterns from winning content."""

    def _create_user_prompt(
        self, 
        brand: str, 
        platform: str, 
        tone: str, 
        top_winning_examples: List[str],
        product_description: Optional[str] = None,
        target_audience: Optional[str] = None
    ) -> str:
        """Create the user prompt with winning examples."""
        examples_text = "\n".join([f"Example {i+1}: {example}" for i, example in enumerate(top_winning_examples)])
        
        prompt = f"""Generate 3 caption variants for {brand} on {platform} with a {tone} tone.

WINNING EXAMPLES TO LEARN FROM:
{examples_text}

"""
        
        if product_description:
            prompt += f"PRODUCT/SERVICE: {product_description}\n"
        
        if target_audience:
            prompt += f"TARGET AUDIENCE: {target_audience}\n"
        
        prompt += """
TASK: Create 3 caption variants, 10 hashtags, and a CTA that follow the successful patterns from the examples above.

Return as JSON with keys: primary, alts, hashtags, cta"""
        
        return prompt

    def _validate_and_clean_response(self, result: Dict[str, Any], brand: str, platform: str) -> Dict[str, Any]:
        """Validate and clean the LLM response."""
        # Ensure all required keys exist
        required_keys = ["primary", "alts", "hashtags", "cta"]
        for key in required_keys:
            if key not in result:
                logger.warning(f"Missing key '{key}' in LLM response")
                result[key] = self._get_default_value(key, brand, platform)
        
        # Validate primary caption
        if not isinstance(result["primary"], str) or len(result["primary"]) == 0:
            result["primary"] = f"Discover {brand}'s amazing products! 🚀"
        
        # Validate alternatives
        if not isinstance(result["alts"], list) or len(result["alts"]) < 2:
            result["alts"] = [
                f"Transform your life with {brand}! ✨",
                f"Join thousands who love {brand}! 💪"
            ]
        
        # Ensure we have exactly 2 alternatives
        result["alts"] = result["alts"][:2]
        
        # Validate hashtags
        if not isinstance(result["hashtags"], list) or len(result["hashtags"]) < 10:
            result["hashtags"] = self._generate_default_hashtags(brand, platform)
        
        # Ensure we have exactly 10 hashtags
        result["hashtags"] = result["hashtags"][:10]
        
        # Clean hashtags (remove # if present, add it back)
        result["hashtags"] = [f"#{tag.replace('#', '')}" for tag in result["hashtags"]]
        
        # Validate CTA
        if not isinstance(result["cta"], str) or len(result["cta"]) == 0:
            result["cta"] = f"Shop now at {brand}.com and transform your life today!"
        
        # Ensure captions are under 2200 characters
        result["primary"] = self._truncate_text(result["primary"], 2200)
        result["alts"] = [self._truncate_text(alt, 2200) for alt in result["alts"]]
        
        return result

    def _get_default_value(self, key: str, brand: str, platform: str) -> Any:
        """Get default value for missing keys."""
        defaults = {
            "primary": f"Discover {brand}'s amazing products! 🚀",
            "alts": [
                f"Transform your life with {brand}! ✨",
                f"Join thousands who love {brand}! 💪"
            ],
            "hashtags": self._generate_default_hashtags(brand, platform),
            "cta": f"Shop now at {brand}.com and transform your life today!"
        }
        return defaults.get(key, "")

    def _generate_default_hashtags(self, brand: str, platform: str) -> List[str]:
        """Generate default hashtags based on brand and platform."""
        base_hashtags = [
            f"#{brand.lower().replace(' ', '')}",
            "#shopnow",
            "#quality",
            "#lifestyle",
            "#trending",
            "#instagood",
            "#love",
            "#fashion" if platform.lower() in ["instagram", "tiktok"] else "#business",
            "#success",
            "#motivation"
        ]
        return base_hashtags[:10]

    def _truncate_text(self, text: str, max_length: int) -> str:
        """Truncate text to maximum length while preserving words."""
        if len(text) <= max_length:
            return text
        
        truncated = text[:max_length]
        last_space = truncated.rfind(' ')
        if last_space > max_length * 0.8:  # Only truncate at word boundary if it's not too short
            truncated = truncated[:last_space]
        
        return truncated + "..."

    def _create_fallback_response(self, brand: str, platform: str) -> Dict[str, Any]:
        """Create a fallback response when generation fails."""
        logger.warning(f"Using fallback response for brand: {brand}")
        
        return {
            "primary": f"🚀 Discover {brand}'s amazing products that are changing lives! Join thousands of satisfied customers who trust our quality and innovation. Don't miss out on this incredible opportunity!",
            "alts": [
                f"✨ Transform your life with {brand}! Our premium products deliver results you can see and feel. Experience the difference quality makes.",
                f"💪 Join the {brand} family today! Thousands of happy customers can't be wrong. See why everyone's talking about us!"
            ],
            "hashtags": self._generate_default_hashtags(brand, platform),
            "cta": f"Shop now at {brand}.com and transform your life today! Limited time offer - don't wait!"
        }

    async def get_winning_examples_for_brand(
        self, 
        brand_id: str, 
        limit: int = 3
    ) -> List[str]:
        """
        Get winning content examples for a brand from the feedback loop.
        
        Args:
            brand_id: Brand ID to get examples for
            limit: Maximum number of examples to return
            
        Returns:
            List of winning content text
        """
        try:
            winners = self.feedback_service.get_winning_content_for_brand(brand_id)
            
            # Extract just the content text
            examples = [winner["content"] for winner in winners[:limit]]
            
            # If we don't have enough examples, pad with generic ones
            while len(examples) < 3:
                examples.append(f"Amazing {brand_id} product that everyone loves! 🚀")
            
            return examples[:3]
            
        except Exception as e:
            logger.error(f"Error getting winning examples for brand {brand_id}: {e}")
            return [
                f"Discover {brand_id}'s incredible products! ✨",
                f"Join thousands who love {brand_id}! 💪",
                f"Transform your life with {brand_id}! 🚀"
            ]

    async def search_similar_content(
        self, 
        query_text: str, 
        limit: int = 3
    ) -> List[str]:
        """
        Search for similar winning content to use as examples.
        
        Args:
            query_text: Text to search for similar content
            limit: Maximum number of results
            
        Returns:
            List of similar content text
        """
        try:
            results = self.feedback_service.search_similar_content(query_text, limit)
            return [result["content"] for result in results]
        except Exception as e:
            logger.error(f"Error searching similar content: {e}")
        return [
            "Amazing product that everyone loves! 🚀",
            "Join thousands of satisfied customers! ✨",
            "Transform your life today! 💪"
        ]

    async def analyze_caption(self, caption: str) -> CaptionAnalysis:
        """
        Analyze a caption for conversion potential and optimization suggestions.
        
        Args:
            caption: Caption to analyze
            
        Returns:
            CaptionAnalysis object with analysis results
        """
        try:
            # Basic text analysis
            character_count = len(caption)
            word_count = len(caption.split())
            hashtag_count = len(re.findall(r'#\w+', caption))
            emoji_count = len(re.findall(r'[^\w\s]', caption))  # Simple emoji detection
            
            # Check for conversion elements
            urgency_indicators = ['now', 'today', 'limited', 'urgent', 'hurry', 'expires', 'deadline']
            has_urgency = any(indicator in caption.lower() for indicator in urgency_indicators)
            
            social_proof_indicators = ['thousands', 'millions', 'everyone', 'customers', 'reviews', 'testimonials']
            has_social_proof = any(indicator in caption.lower() for indicator in social_proof_indicators)
            
            cta_indicators = ['shop', 'buy', 'order', 'get', 'download', 'sign up', 'click', 'learn more']
            has_clear_cta = any(indicator in caption.lower() for indicator in cta_indicators)
            
            # Simple readability score (Flesch-like)
            avg_words_per_sentence = word_count / max(1, caption.count('.') + caption.count('!') + caption.count('?'))
            readability_score = max(0, min(100, 100 - (avg_words_per_sentence * 1.5)))
            
            # Conversion potential based on elements present
            conversion_elements = sum([has_urgency, has_social_proof, has_clear_cta, hashtag_count > 0, emoji_count > 0])
            if conversion_elements >= 4:
                conversion_potential = "high"
            elif conversion_elements >= 2:
                conversion_potential = "medium"
            else:
                conversion_potential = "low"
            
            return CaptionAnalysis(
                caption=caption,
                character_count=character_count,
                word_count=word_count,
                hashtag_count=hashtag_count,
                emoji_count=emoji_count,
                has_urgency=has_urgency,
                has_social_proof=has_social_proof,
                has_clear_cta=has_clear_cta,
                readability_score=readability_score,
                conversion_potential=conversion_potential
            )
            
        except Exception as e:
            logger.error(f"Error analyzing caption: {e}", exc_info=True)
            # Return basic analysis on error
            return CaptionAnalysis(
                caption=caption,
                character_count=len(caption),
                word_count=len(caption.split()),
                hashtag_count=0,
                emoji_count=0,
                has_urgency=False,
                has_social_proof=False,
                has_clear_cta=False,
                readability_score=50.0,
                conversion_potential="low"
            )

    async def get_stats(self) -> dict:
        """
        Get statistics about the brand voice assistant.
        
        Returns:
            Dict containing usage statistics
        """
        try:
            # This would typically come from a database or analytics service
            # For now, return mock stats
            return {
                "total_generations": 0,
                "brands_served": 0,
                "platforms_used": [],
                "average_character_count": 0.0,
                "success_rate": 100.0
            }
        except Exception as e:
            logger.error(f"Error getting stats: {e}", exc_info=True)
            return {
                "total_generations": 0,
                "brands_served": 0,
                "platforms_used": [],
                "average_character_count": 0.0,
                "success_rate": 0.0
            }
