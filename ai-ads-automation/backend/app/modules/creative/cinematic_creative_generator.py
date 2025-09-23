"""
Cinematic creative generator for high-end automotive and luxury brand content.
"""

import json
from typing import Dict, List, Any, Optional
from app.core.logging import logger
from app.modules.ad_copy.llm_client import get_llm_client, AbstractLLMClient
from app.modules.creative.image_prompt_analyzer import ImagePromptAnalyzer


class CinematicCreativeGenerator:
    """Generates cinematic creative content for luxury and automotive brands."""

    def __init__(self, llm_client: Optional[AbstractLLMClient] = None):
        self.llm_client = llm_client if llm_client else get_llm_client()
        self.prompt_analyzer = ImagePromptAnalyzer()
        logger.info("CinematicCreativeGenerator initialized")

    async def generate_cinematic_campaign(
        self,
        brand: str,
        product: str,
        base_prompt: str,
        campaign_goal: str = "brand_awareness",
        target_audience: str = "luxury consumers",
        budget_tier: str = "premium"
    ) -> Dict[str, Any]:
        """
        Generate a complete cinematic campaign from a base image prompt.
        
        Args:
            brand: Brand name
            product: Product name
            base_prompt: Base image generation prompt
            campaign_goal: Campaign objective
            target_audience: Target audience description
            budget_tier: Budget tier (premium, mid, budget)
            
        Returns:
            Dict containing complete cinematic campaign
        """
        logger.info(f"Generating cinematic campaign for {brand} {product}")
        
        try:
            # Analyze the base prompt
            prompt_analysis = self.prompt_analyzer.analyze_prompt(base_prompt)
            
            # Generate campaign components
            campaign = {
                'brand': brand,
                'product': product,
                'base_prompt': base_prompt,
                'prompt_analysis': prompt_analysis,
                'image_variations': self._generate_image_variations(base_prompt),
                'video_concepts': await self._generate_video_concepts(brand, product, base_prompt),
                'copy_variations': await self._generate_copy_variations(brand, product, base_prompt),
                'platform_adaptations': self._generate_platform_adaptations(base_prompt),
                'shooting_guidelines': self._generate_shooting_guidelines(base_prompt),
                'post_production_notes': self._generate_post_production_notes(base_prompt),
                'budget_breakdown': self._generate_budget_breakdown(budget_tier),
                'timeline': self._generate_timeline(),
                'success_metrics': self._generate_success_metrics(campaign_goal)
            }
            
            return campaign
        except Exception as e:
            logger.error(f"Error generating cinematic campaign: {e}", exc_info=True)
            return self._create_fallback_campaign(brand, product, base_prompt)

    def _generate_image_variations(self, base_prompt: str) -> List[Dict[str, str]]:
        """Generate image prompt variations for different use cases."""
        variations = self.prompt_analyzer.create_variations(base_prompt, 5)
        
        image_variations = []
        for i, variation in enumerate(variations):
            image_variations.append({
                'name': f'Variation {i+1}',
                'prompt': variation,
                'use_case': self._get_variation_use_case(i),
                'platform': self._get_variation_platform(i)
            })
        
        return image_variations

    def _get_variation_use_case(self, index: int) -> str:
        """Get use case for variation based on index."""
        use_cases = [
            'Hero image for website',
            'Social media post',
            'Print advertisement',
            'Email marketing',
            'Digital billboard'
        ]
        return use_cases[index % len(use_cases)]

    def _get_variation_platform(self, index: int) -> str:
        """Get platform for variation based on index."""
        platforms = ['Instagram', 'Facebook', 'TikTok', 'YouTube', 'LinkedIn']
        return platforms[index % len(platforms)]

    async def _generate_video_concepts(self, brand: str, product: str, base_prompt: str) -> List[Dict[str, Any]]:
        """Generate video concepts based on the image prompt."""
        try:
            prompt = f"""
Create 3 cinematic video concepts for {brand} {product} based on this image prompt:
"{base_prompt}"

For each concept, provide:
1. Concept title
2. Duration (15s, 30s, 60s)
3. Key visual moments (3-5 shots)
4. Camera movements
5. Music style
6. Target emotion
7. Call-to-action

Return as JSON with keys: concept1, concept2, concept3
"""
            
            response = await self.llm_client.generate_text(
                system_prompt="You are a creative director specializing in luxury automotive advertising.",
                user_prompt=prompt,
                temperature=0.8,
                max_tokens=1000
            )
            
            if response:
                try:
                    return json.loads(response[0])
                except json.JSONDecodeError:
                    pass
            
            # Fallback concepts
            return self._get_fallback_video_concepts(brand, product)
            
        except Exception as e:
            logger.error(f"Error generating video concepts: {e}")
            return self._get_fallback_video_concepts(brand, product)

    def _get_fallback_video_concepts(self, brand: str, product: str) -> List[Dict[str, Any]]:
        """Get fallback video concepts."""
        return [
            {
                'concept1': {
                    'title': f'{brand} {product} - The Journey',
                    'duration': '30s',
                    'key_moments': ['Opening wide shot', 'Close-up of details', 'Dynamic driving sequence'],
                    'camera_movements': ['Slow push-in', 'Smooth tracking', 'Dynamic follow'],
                    'music_style': 'Cinematic orchestral',
                    'target_emotion': 'Aspiration and desire',
                    'cta': 'Discover more at brand.com'
                }
            }
        ]

    async def _generate_copy_variations(self, brand: str, product: str, base_prompt: str) -> List[Dict[str, str]]:
        """Generate copy variations for the campaign."""
        try:
            prompt = f"""
Create 5 different copy variations for {brand} {product} based on this cinematic image:
"{base_prompt}"

Create variations for:
1. Social media caption (Instagram)
2. Video voiceover script (30s)
3. Print headline
4. Email subject line
5. Website hero text

Each should capture the luxury, drama, and sophistication of the image.
Return as JSON with keys: social_caption, voiceover_script, print_headline, email_subject, hero_text
"""
            
            response = await self.llm_client.generate_text(
                system_prompt="You are a copywriter specializing in luxury automotive and premium brands.",
                user_prompt=prompt,
                temperature=0.8,
                max_tokens=800
            )
            
            if response:
                try:
                    return json.loads(response[0])
                except json.JSONDecodeError:
                    pass
            
            # Fallback copy
            return self._get_fallback_copy_variations(brand, product)
            
        except Exception as e:
            logger.error(f"Error generating copy variations: {e}")
            return self._get_fallback_copy_variations(brand, product)

    def _get_fallback_copy_variations(self, brand: str, product: str) -> List[Dict[str, str]]:
        """Get fallback copy variations."""
        return {
            'social_caption': f'Experience the power of {brand} {product}. Where performance meets perfection. #Luxury #Automotive',
            'voiceover_script': f'In the heart of the city, {brand} {product} commands attention. Precision. Power. Perfection.',
            'print_headline': f'{brand} {product}: Redefining Luxury',
            'email_subject': f'Introducing the new {brand} {product}',
            'hero_text': f'Discover the {brand} {product}. Where every detail tells a story of excellence.'
        }

    def _generate_platform_adaptations(self, base_prompt: str) -> Dict[str, str]:
        """Generate platform-specific adaptations of the base prompt."""
        return self.prompt_analyzer._suggest_platform_adaptations(base_prompt)

    def _generate_shooting_guidelines(self, base_prompt: str) -> Dict[str, Any]:
        """Generate shooting guidelines based on the prompt."""
        analysis = self.prompt_analyzer.analyze_prompt(base_prompt)
        
        guidelines = {
            'camera_settings': {
                'aperture': 'f/2.8 or wider for shallow depth of field',
                'shutter_speed': '1/60s for motion blur',
                'iso': '100-400 for clean image',
                'focal_length': '85mm or 135mm for compression'
            },
            'lighting_setup': {
                'key_light': 'Soft box or large diffuser',
                'rim_light': 'Hard light source for edge definition',
                'fill_light': 'Subtle fill to avoid harsh shadows',
                'background_light': 'Separate background from subject'
            },
            'camera_movements': [
                'Slow push-in on logo',
                'Smooth tracking shot',
                'Static shot with subtle camera shake'
            ],
            'weather_conditions': 'Wet street for reflections',
            'time_of_day': 'Golden hour or blue hour',
            'location_requirements': 'Urban setting with good lighting'
        }
        
        return guidelines

    def _generate_post_production_notes(self, base_prompt: str) -> Dict[str, Any]:
        """Generate post-production notes based on the prompt."""
        analysis = self.prompt_analyzer.analyze_prompt(base_prompt)
        
        notes = {
            'color_grading': {
                'style': 'Cinematic with cool tones',
                'contrast': 'High contrast for dramatic effect',
                'saturation': 'Slightly desaturated for sophistication',
                'highlights': 'Preserve highlight detail',
                'shadows': 'Crush blacks slightly for depth'
            },
            'vfx_requirements': [
                'Logo integration',
                'Reflection enhancement',
                'Atmospheric effects',
                'Color correction'
            ],
            'audio_requirements': {
                'music_style': 'Cinematic orchestral',
                'sound_effects': 'Engine rev, tire squeal, ambient city',
                'voiceover': 'Deep, authoritative male voice'
            },
            'delivery_formats': [
                '4K for cinema',
                '1080p for digital',
                'Square for Instagram',
                'Vertical for TikTok'
            ]
        }
        
        return notes

    def _generate_budget_breakdown(self, budget_tier: str) -> Dict[str, Any]:
        """Generate budget breakdown based on tier."""
        if budget_tier == "premium":
            return {
                'total_budget': 50000,
                'breakdown': {
                    'pre_production': 10000,
                    'production': 25000,
                    'post_production': 10000,
                    'talent': 3000,
                    'equipment': 2000
                }
            }
        elif budget_tier == "mid":
            return {
                'total_budget': 25000,
                'breakdown': {
                    'pre_production': 5000,
                    'production': 12000,
                    'post_production': 5000,
                    'talent': 2000,
                    'equipment': 1000
                }
            }
        else:  # budget
            return {
                'total_budget': 10000,
                'breakdown': {
                    'pre_production': 2000,
                    'production': 5000,
                    'post_production': 2000,
                    'talent': 500,
                    'equipment': 500
                }
            }

    def _generate_timeline(self) -> Dict[str, str]:
        """Generate production timeline."""
        return {
            'pre_production': '2 weeks',
            'production': '3 days',
            'post_production': '2 weeks',
            'total_duration': '5 weeks'
        }

    def _generate_success_metrics(self, campaign_goal: str) -> Dict[str, Any]:
        """Generate success metrics based on campaign goal."""
        if campaign_goal == "brand_awareness":
            return {
                'primary_metrics': ['Impressions', 'Reach', 'Brand recall'],
                'secondary_metrics': ['Engagement rate', 'Video completion rate'],
                'targets': {
                    'impressions': 1000000,
                    'reach': 500000,
                    'engagement_rate': 0.05
                }
            }
        elif campaign_goal == "conversion":
            return {
                'primary_metrics': ['Click-through rate', 'Conversion rate', 'Cost per acquisition'],
                'secondary_metrics': ['Engagement rate', 'Video completion rate'],
                'targets': {
                    'ctr': 0.03,
                    'conversion_rate': 0.02,
                    'cpa': 100
                }
            }
        else:
            return {
                'primary_metrics': ['Engagement rate', 'Video completion rate', 'Shares'],
                'secondary_metrics': ['Impressions', 'Reach'],
                'targets': {
                    'engagement_rate': 0.08,
                    'completion_rate': 0.7,
                    'shares': 1000
                }
            }

    def _create_fallback_campaign(self, brand: str, product: str, base_prompt: str) -> Dict[str, Any]:
        """Create fallback campaign when generation fails."""
        return {
            'brand': brand,
            'product': product,
            'base_prompt': base_prompt,
            'prompt_analysis': self.prompt_analyzer.analyze_prompt(base_prompt),
            'image_variations': [{'name': 'Base', 'prompt': base_prompt, 'use_case': 'General', 'platform': 'All'}],
            'video_concepts': self._get_fallback_video_concepts(brand, product),
            'copy_variations': self._get_fallback_copy_variations(brand, product),
            'platform_adaptations': {},
            'shooting_guidelines': {},
            'post_production_notes': {},
            'budget_breakdown': self._generate_budget_breakdown('mid'),
            'timeline': self._generate_timeline(),
            'success_metrics': self._generate_success_metrics('brand_awareness'),
            'is_fallback': True
        }

    async def generate_creative_brief(
        self,
        brand: str,
        product: str,
        base_prompt: str,
        campaign_objectives: List[str]
    ) -> Dict[str, Any]:
        """
        Generate a comprehensive creative brief from the image prompt.
        
        Args:
            brand: Brand name
            product: Product name
            base_prompt: Base image generation prompt
            campaign_objectives: List of campaign objectives
            
        Returns:
            Dict containing creative brief
        """
        logger.info(f"Generating creative brief for {brand} {product}")
        
        try:
            prompt = f"""
Create a comprehensive creative brief for {brand} {product} based on this cinematic image prompt:
"{base_prompt}"

Campaign objectives: {', '.join(campaign_objectives)}

Include:
1. Creative concept and theme
2. Visual style guide
3. Tone of voice
4. Key messages
5. Target audience insights
6. Competitive positioning
7. Brand guidelines
8. Success metrics
9. Creative requirements
10. Production considerations

Return as JSON with detailed sections.
"""
            
            response = await self.llm_client.generate_text(
                system_prompt="You are a creative director with expertise in luxury automotive and premium brand campaigns.",
                user_prompt=prompt,
                temperature=0.7,
                max_tokens=1500
            )
            
            if response:
                try:
                    brief = json.loads(response[0])
                    brief['brand'] = brand
                    brief['product'] = product
                    brief['base_prompt'] = base_prompt
                    return brief
                except json.JSONDecodeError:
                    pass
            
            # Fallback brief
            return self._create_fallback_brief(brand, product, base_prompt, campaign_objectives)
            
        except Exception as e:
            logger.error(f"Error generating creative brief: {e}", exc_info=True)
            return self._create_fallback_brief(brand, product, base_prompt, campaign_objectives)

    def _create_fallback_brief(self, brand: str, product: str, base_prompt: str, objectives: List[str]) -> Dict[str, Any]:
        """Create fallback creative brief."""
        return {
            'brand': brand,
            'product': product,
            'base_prompt': base_prompt,
            'objectives': objectives,
            'creative_concept': f'Cinematic showcase of {brand} {product} in urban luxury setting',
            'visual_style': 'High-contrast, dramatic lighting, cinematic grading',
            'tone_of_voice': 'Sophisticated, aspirational, powerful',
            'key_messages': [f'{brand} {product} represents luxury and performance'],
            'target_audience': 'Luxury consumers, automotive enthusiasts',
            'success_metrics': ['Brand awareness', 'Engagement', 'Consideration'],
            'is_fallback': True
        }



