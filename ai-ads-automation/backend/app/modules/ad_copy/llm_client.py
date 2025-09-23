"""
LLM client for ad copy generation with provider-agnostic interface.
"""

import json
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Union

import openai
from pydantic import BaseModel

from app.core.config import settings
from app.core.logging import get_logger, log_ai_operation


class LLMResponse(BaseModel):
    """LLM response model."""
    content: str
    usage: Optional[Dict[str, int]] = None
    model: str
    provider: str


class LLMClient(ABC):
    """Abstract base class for LLM clients."""
    
    @abstractmethod
    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 1000,
        **kwargs: Any
    ) -> LLMResponse:
        """Generate text using the LLM."""
        pass


class OpenAIClient(LLMClient):
    """OpenAI client implementation."""
    
    def __init__(self, api_key: str, base_url: str = "https://api.openai.com/v1"):
        self.client = openai.AsyncOpenAI(
            api_key=api_key,
            base_url=base_url
        )
        self.logger = get_logger("openai_client")
    
    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 1000,
        **kwargs: Any
    ) -> LLMResponse:
        """Generate text using OpenAI API."""
        
        model = model or settings.LLM_MODEL
        
        try:
            log_ai_operation(
                module="ad_copy",
                operation="generate",
                model=model,
                temperature=temperature,
                max_tokens=max_tokens
            )
            
            response = await self.client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature,
                max_tokens=max_tokens,
                **kwargs
            )
            
            return LLMResponse(
                content=response.choices[0].message.content,
                usage=response.usage.dict() if response.usage else None,
                model=model,
                provider="openai"
            )
            
        except Exception as e:
            self.logger.error("OpenAI generation failed", error=str(e))
            raise


class MockLLMClient(LLMClient):
    """Mock LLM client for testing and development."""
    
    def __init__(self):
        self.logger = get_logger("mock_llm_client")
    
    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 1000,
        **kwargs: Any
    ) -> LLMResponse:
        """Generate mock text for testing."""
        
        self.logger.info("Using mock LLM client", prompt_length=len(prompt))
        
        # Generate mock response based on prompt
        mock_content = self._generate_mock_content(prompt)
        
        return LLMResponse(
            content=mock_content,
            usage={"prompt_tokens": len(prompt.split()), "completion_tokens": 50},
            model=model or "mock-model",
            provider="mock"
        )
    
    def _generate_mock_content(self, prompt: str) -> str:
        """Generate mock content based on prompt."""
        
        if "ad copy" in prompt.lower() or "headline" in prompt.lower():
            return json.dumps({
                "headline": "Transform Your Business Today!",
                "primary_text": "Stop struggling with outdated methods. Our proven solution has helped thousands achieve 300% growth in just 30 days. Limited time offer - act now!",
                "cta": "Get Started Now",
                "style": "sabri_suby",
                "confidence": 0.85
            })
        
        return "Mock LLM response for testing purposes."


def get_llm_client() -> LLMClient:
    """Get the configured LLM client."""
    
    if settings.OPENAI_API_KEY:
        return OpenAIClient(
            api_key=settings.OPENAI_API_KEY,
            base_url=settings.LLM_BASE_URL
        )
    else:
        return MockLLMClient()


class LLMManager:
    """Manager for LLM operations with caching and retry logic."""
    
    def __init__(self):
        self.client = get_llm_client()
        self.logger = get_logger("llm_manager")
    
    async def generate_ad_copy(
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
        """Generate ad copy variations using LLM."""
        
        prompt = self._build_ad_copy_prompt(
            product=product,
            target_audience=target_audience,
            pain_points=pain_points,
            benefits=benefits,
            platform=platform,
            objective=objective,
            style=style,
            variations=variations
        )
        
        try:
            response = await self.client.generate(
                prompt=prompt,
                temperature=0.8,  # Higher temperature for creativity
                max_tokens=1500
            )
            
            # Parse the response
            variations = self._parse_ad_copy_response(response.content)
            
            self.logger.info(
                "Generated ad copy variations",
                count=len(variations),
                product=product,
                platform=platform
            )
            
            return variations
            
        except Exception as e:
            self.logger.error("Ad copy generation failed", error=str(e))
            raise
    
    def _build_ad_copy_prompt(
        self,
        product: str,
        target_audience: str,
        pain_points: List[str],
        benefits: List[str],
        platform: str,
        objective: str,
        style: str,
        variations: int
    ) -> str:
        """Build the prompt for ad copy generation."""
        
        if style == "sabri_suby":
            return self._build_sabri_suby_prompt(
                product, target_audience, pain_points, benefits, platform, objective, variations
            )
        else:
            return self._build_generic_prompt(
                product, target_audience, pain_points, benefits, platform, objective, variations
            )
    
    def _build_sabri_suby_prompt(
        self,
        product: str,
        target_audience: str,
        pain_points: List[str],
        benefits: List[str],
        platform: str,
        objective: str,
        variations: int
    ) -> str:
        """Build Sabri Suby style prompt."""
        
        return f"""
You are a world-class direct-response copywriter specializing in {platform} ads. 
Generate {variations} high-converting ad copy variations following the Sabri Suby formula: 
Pain → Solution → Clear Offer → Urgency.

Product: {product}
Target Audience: {target_audience}
Pain Points: {', '.join(pain_points)}
Benefits: {', '.join(benefits)}
Platform: {platform}
Objective: {objective}

Generate each variation in JSON format with these fields:
- headline: Compelling headline (max 40 characters)
- primary_text: Main ad text following pain-solution-offer-urgency formula
- cta: Clear call-to-action button text
- style: "sabri_suby"
- confidence: AI confidence score (0-1)
- emotional_triggers: List of emotional triggers used
- urgency_factors: List of urgency factors included

Guidelines:
- Hook viewers in first 3 words
- Use emotional triggers and power words
- Create urgency without being pushy
- Include specific numbers and results
- Make the offer irresistible
- Use platform-appropriate language and length
- Follow the direct-response formula religiously

Return as a JSON array of {variations} variations.
"""
    
    def _build_generic_prompt(
        self,
        product: str,
        target_audience: str,
        pain_points: List[str],
        benefits: List[str],
        platform: str,
        objective: str,
        variations: int
    ) -> str:
        """Build generic prompt for other styles."""
        
        return f"""
Generate {variations} ad copy variations for {product} targeting {target_audience} on {platform}.

Pain Points: {', '.join(pain_points)}
Benefits: {', '.join(benefits)}
Objective: {objective}

Return as JSON array with headline, primary_text, cta, style, and confidence fields.
"""
    
    def _parse_ad_copy_response(self, content: str) -> List[Dict[str, Any]]:
        """Parse the LLM response into ad copy variations."""
        
        try:
            # Try to parse as JSON
            variations = json.loads(content)
            
            if not isinstance(variations, list):
                variations = [variations]
            
            # Validate and clean up each variation
            cleaned_variations = []
            for i, variation in enumerate(variations):
                if isinstance(variation, dict):
                    cleaned_variation = {
                        "headline": variation.get("headline", ""),
                        "primary_text": variation.get("primary_text", ""),
                        "cta": variation.get("cta", "Learn More"),
                        "style": variation.get("style", "generic"),
                        "confidence": float(variation.get("confidence", 0.5)),
                        "emotional_triggers": variation.get("emotional_triggers", []),
                        "urgency_factors": variation.get("urgency_factors", []),
                        "variation_id": f"variation_{i+1}"
                    }
                    cleaned_variations.append(cleaned_variation)
            
            return cleaned_variations
            
        except json.JSONDecodeError as e:
            self.logger.error("Failed to parse LLM response as JSON", error=str(e))
            
            # Fallback: create a single variation from the raw content
            return [{
                "headline": "Generated Ad Copy",
                "primary_text": content[:500],
                "cta": "Learn More",
                "style": "generic",
                "confidence": 0.5,
                "emotional_triggers": [],
                "urgency_factors": [],
                "variation_id": "variation_1"
            }]
    
    async def generate_creative_brief(
        self,
        product: str,
        target_audience: str,
        platform: str,
        objective: str
    ) -> Dict[str, Any]:
        """Generate a creative brief for the creative generator."""
        
        prompt = f"""
Generate a creative brief for {product} targeting {target_audience} on {platform}.

Objective: {objective}

Return JSON with:
- visual_style: Description of visual style
- color_palette: List of colors
- mood: Overall mood/tone
- key_messages: List of key messages
- visual_elements: List of visual elements to include
- platform_specs: Platform-specific requirements
"""
        
        try:
            response = await self.client.generate(
                prompt=prompt,
                temperature=0.6,
                max_tokens=800
            )
            
            return json.loads(response.content)
            
        except Exception as e:
            self.logger.error("Creative brief generation failed", error=str(e))
            raise



