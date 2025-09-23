"""
Image prompt analyzer for understanding and optimizing creative prompts.
"""

import re
from typing import Dict, List, Any, Optional
from app.core.logging import logger


class ImagePromptAnalyzer:
    """Analyzes and optimizes image generation prompts for creative content."""

    def __init__(self):
        self.technical_terms = {
            'shot_types': ['wide', 'medium', 'close-up', 'extreme close-up', '3/4', 'profile', 'overhead', 'low angle', 'high angle'],
            'lighting': ['rim lighting', 'key light', 'fill light', 'backlight', 'soft light', 'hard light', 'dramatic lighting', 'natural light'],
            'camera_techniques': ['shallow depth of field', 'deep focus', 'rack focus', 'tilt shift', 'macro', 'telephoto', 'wide angle'],
            'color_grading': ['cinematic grading', 'color correction', 'saturation', 'contrast', 'brightness', 'hue', 'tone mapping'],
            'mood_keywords': ['dramatic', 'mysterious', 'elegant', 'powerful', 'sophisticated', 'dynamic', 'intense', 'serene'],
            'brand_elements': ['logo', 'branding', 'subtle', 'prominent', 'watermark', 'signature', 'trademark']
        }
        logger.info("ImagePromptAnalyzer initialized")

    def analyze_prompt(self, prompt: str) -> Dict[str, Any]:
        """
        Analyze an image generation prompt and extract key elements.
        
        Args:
            prompt: The image generation prompt to analyze
            
        Returns:
            Dict containing analysis results
        """
        logger.info(f"Analyzing image prompt: {prompt[:50]}...")
        
        try:
            analysis = {
                'original_prompt': prompt,
                'shot_type': self._extract_shot_type(prompt),
                'lighting_style': self._extract_lighting_style(prompt),
                'camera_techniques': self._extract_camera_techniques(prompt),
                'color_grading': self._extract_color_grading(prompt),
                'mood_tone': self._extract_mood_tone(prompt),
                'brand_elements': self._extract_brand_elements(prompt),
                'technical_complexity': self._calculate_technical_complexity(prompt),
                'optimization_suggestions': self._generate_optimization_suggestions(prompt),
                'platform_adaptations': self._suggest_platform_adaptations(prompt)
            }
            
            return analysis
        except Exception as e:
            logger.error(f"Error analyzing image prompt: {e}", exc_info=True)
            return self._create_fallback_analysis(prompt)

    def _extract_shot_type(self, prompt: str) -> Optional[str]:
        """Extract shot type from prompt."""
        prompt_lower = prompt.lower()
        for shot_type in self.technical_terms['shot_types']:
            if shot_type in prompt_lower:
                return shot_type
        return None

    def _extract_lighting_style(self, prompt: str) -> List[str]:
        """Extract lighting styles from prompt."""
        prompt_lower = prompt.lower()
        lighting_found = []
        for lighting in self.technical_terms['lighting']:
            if lighting in prompt_lower:
                lighting_found.append(lighting)
        return lighting_found

    def _extract_camera_techniques(self, prompt: str) -> List[str]:
        """Extract camera techniques from prompt."""
        prompt_lower = prompt.lower()
        techniques_found = []
        for technique in self.technical_terms['camera_techniques']:
            if technique in prompt_lower:
                techniques_found.append(technique)
        return techniques_found

    def _extract_color_grading(self, prompt: str) -> List[str]:
        """Extract color grading terms from prompt."""
        prompt_lower = prompt.lower()
        grading_found = []
        for grading in self.technical_terms['color_grading']:
            if grading in prompt_lower:
                grading_found.append(grading)
        return grading_found

    def _extract_mood_tone(self, prompt: str) -> List[str]:
        """Extract mood and tone keywords from prompt."""
        prompt_lower = prompt.lower()
        mood_found = []
        for mood in self.technical_terms['mood_keywords']:
            if mood in prompt_lower:
                mood_found.append(mood)
        return mood_found

    def _extract_brand_elements(self, prompt: str) -> List[str]:
        """Extract brand-related elements from prompt."""
        prompt_lower = prompt.lower()
        brand_found = []
        for element in self.technical_terms['brand_elements']:
            if element in prompt_lower:
                brand_found.append(element)
        return brand_found

    def _calculate_technical_complexity(self, prompt: str) -> str:
        """Calculate technical complexity of the prompt."""
        technical_elements = 0
        technical_elements += len(self._extract_lighting_style(prompt))
        technical_elements += len(self._extract_camera_techniques(prompt))
        technical_elements += len(self._extract_color_grading(prompt))
        
        if technical_elements >= 5:
            return "high"
        elif technical_elements >= 3:
            return "medium"
        else:
            return "low"

    def _generate_optimization_suggestions(self, prompt: str) -> List[str]:
        """Generate optimization suggestions for the prompt."""
        suggestions = []
        
        # Check for missing elements
        if not self._extract_shot_type(prompt):
            suggestions.append("Consider specifying shot type (wide, medium, close-up, etc.)")
        
        if not self._extract_lighting_style(prompt):
            suggestions.append("Add lighting direction for better visual impact")
        
        if not self._extract_color_grading(prompt):
            suggestions.append("Include color grading instructions for consistent style")
        
        # Check for brand elements
        if not self._extract_brand_elements(prompt):
            suggestions.append("Consider adding brand logo or branding elements")
        
        # Check for mood/tone
        if not self._extract_mood_tone(prompt):
            suggestions.append("Add mood keywords to enhance emotional impact")
        
        return suggestions

    def _suggest_platform_adaptations(self, prompt: str) -> Dict[str, str]:
        """Suggest platform-specific adaptations for the prompt."""
        adaptations = {}
        
        # Instagram adaptations
        adaptations['instagram'] = self._adapt_for_instagram(prompt)
        
        # TikTok adaptations
        adaptations['tiktok'] = self._adapt_for_tiktok(prompt)
        
        # Facebook adaptations
        adaptations['facebook'] = self._adapt_for_facebook(prompt)
        
        # YouTube adaptations
        adaptations['youtube'] = self._adapt_for_youtube(prompt)
        
        return adaptations

    def _adapt_for_instagram(self, prompt: str) -> str:
        """Adapt prompt for Instagram optimization."""
        # Instagram prefers square format and high contrast
        adapted = prompt
        if "square" not in prompt.lower():
            adapted += ", square format, Instagram-optimized"
        if "high contrast" not in prompt.lower():
            adapted += ", high contrast for mobile viewing"
        return adapted

    def _adapt_for_tiktok(self, prompt: str) -> str:
        """Adapt prompt for TikTok optimization."""
        # TikTok prefers vertical format and dynamic elements
        adapted = prompt
        if "vertical" not in prompt.lower():
            adapted += ", vertical format, TikTok-optimized"
        if "dynamic" not in prompt.lower():
            adapted += ", dynamic movement, trending style"
        return adapted

    def _adapt_for_facebook(self, prompt: str) -> str:
        """Adapt prompt for Facebook optimization."""
        # Facebook prefers horizontal format and clear branding
        adapted = prompt
        if "horizontal" not in prompt.lower():
            adapted += ", horizontal format, Facebook-optimized"
        if "clear branding" not in prompt.lower():
            adapted += ", clear branding, professional quality"
        return adapted

    def _adapt_for_youtube(self, prompt: str) -> str:
        """Adapt prompt for YouTube optimization."""
        # YouTube prefers 16:9 format and cinematic quality
        adapted = prompt
        if "16:9" not in prompt.lower():
            adapted += ", 16:9 aspect ratio, YouTube-optimized"
        if "cinematic" not in prompt.lower():
            adapted += ", cinematic quality, professional grade"
        return adapted

    def create_variations(self, prompt: str, count: int = 3) -> List[str]:
        """
        Create variations of the original prompt.
        
        Args:
            prompt: Original prompt
            count: Number of variations to create
            
        Returns:
            List of prompt variations
        """
        variations = []
        
        # Variation 1: Different time of day
        if "dusk" in prompt.lower():
            variations.append(prompt.replace("dusk", "dawn"))
        elif "dawn" in prompt.lower():
            variations.append(prompt.replace("dawn", "dusk"))
        else:
            variations.append(prompt.replace("at dusk", "at dawn"))
        
        # Variation 2: Different weather
        if "wet street" in prompt.lower():
            variations.append(prompt.replace("wet street", "dry street"))
        else:
            variations.append(prompt.replace("urban street", "urban wet street"))
        
        # Variation 3: Different angle
        if "3/4 shot" in prompt.lower():
            variations.append(prompt.replace("3/4 shot", "profile shot"))
        else:
            variations.append(prompt.replace("shot", "3/4 shot"))
        
        return variations[:count]

    def _create_fallback_analysis(self, prompt: str) -> Dict[str, Any]:
        """Create fallback analysis when parsing fails."""
        return {
            'original_prompt': prompt,
            'shot_type': None,
            'lighting_style': [],
            'camera_techniques': [],
            'color_grading': [],
            'mood_tone': [],
            'brand_elements': [],
            'technical_complexity': 'unknown',
            'optimization_suggestions': ['Unable to analyze prompt'],
            'platform_adaptations': {}
        }

    def extract_brand_from_prompt(self, prompt: str) -> Optional[str]:
        """Extract brand name from prompt."""
        # Look for common brand patterns
        brand_patterns = [
            r'\b(Audi|BMW|Mercedes|Tesla|Porsche|Ferrari|Lamborghini|Maserati)\b',
            r'\b(Nike|Adidas|Puma|Reebok|Under Armour)\b',
            r'\b(Apple|Samsung|Google|Microsoft|Amazon)\b'
        ]
        
        for pattern in brand_patterns:
            match = re.search(pattern, prompt, re.IGNORECASE)
            if match:
                return match.group(1)
        
        return None

    def suggest_hashtags(self, prompt: str) -> List[str]:
        """Suggest relevant hashtags based on prompt content."""
        hashtags = []
        
        # Extract brand
        brand = self.extract_brand_from_prompt(prompt)
        if brand:
            hashtags.append(f"#{brand.lower()}")
        
        # Add technical hashtags
        if "cinematic" in prompt.lower():
            hashtags.append("#cinematic")
        if "dramatic" in prompt.lower():
            hashtags.append("#dramatic")
        if "automotive" in prompt.lower() or any(car_brand in prompt.lower() for car_brand in ['audi', 'bmw', 'mercedes', 'tesla']):
            hashtags.append("#automotive")
        
        # Add mood hashtags
        if "midnight" in prompt.lower():
            hashtags.append("#midnight")
        if "urban" in prompt.lower():
            hashtags.append("#urban")
        
        return hashtags[:10]  # Limit to 10 hashtags



