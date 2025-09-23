"""
Video app client for creative generation.
"""

import asyncio
from typing import Any, Dict, List, Optional

import httpx
from app.core.config import settings
from app.core.logging import get_logger


class VideoAppClient:
    """Client for integrating with the video app for creative generation."""
    
    def __init__(self):
        self.base_url = settings.CREATIVE_APP_API_URL
        self.api_key = settings.CREATIVE_APP_API_KEY
        self.timeout = 30.0
        self.logger = get_logger("video_app_client")
    
    async def generate_meta_creatives(
        self,
        creative_brief: Dict[str, Any],
        count: int = 3
    ) -> List[Dict[str, Any]]:
        """Generate Meta-specific creatives using the video app."""
        
        if not self.base_url or not self.api_key:
            raise ValueError("Video app not configured")
        
        payload = {
            "platform": "meta",
            "creative_brief": creative_brief,
            "count": count,
            "formats": ["image", "video", "carousel"],
            "specs": {
                "image": {
                    "width": 1200,
                    "height": 628,
                    "aspect_ratio": "1.91:1"
                },
                "video": {
                    "width": 1280,
                    "height": 720,
                    "aspect_ratio": "16:9",
                    "duration": 30
                },
                "carousel": {
                    "width": 1080,
                    "height": 1080,
                    "aspect_ratio": "1:1",
                    "max_cards": 10
                }
            }
        }
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/api/v1/creatives/generate",
                json=payload,
                headers={"Authorization": f"Bearer {self.api_key}"}
            )
            response.raise_for_status()
            
            data = response.json()
            return data.get("creatives", [])
    
    async def generate_google_creatives(
        self,
        creative_brief: Dict[str, Any],
        count: int = 3
    ) -> List[Dict[str, Any]]:
        """Generate Google Ads-specific creatives using the video app."""
        
        if not self.base_url or not self.api_key:
            raise ValueError("Video app not configured")
        
        payload = {
            "platform": "google",
            "creative_brief": creative_brief,
            "count": count,
            "formats": ["image", "video", "responsive_display"],
            "specs": {
                "image": {
                    "width": 1200,
                    "height": 628,
                    "aspect_ratio": "1.91:1"
                },
                "video": {
                    "width": 1280,
                    "height": 720,
                    "aspect_ratio": "16:9",
                    "duration": 30
                },
                "responsive_display": {
                    "width": 300,
                    "height": 250,
                    "aspect_ratio": "1.2:1"
                }
            }
        }
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/api/v1/creatives/generate",
                json=payload,
                headers={"Authorization": f"Bearer {self.api_key}"}
            )
            response.raise_for_status()
            
            data = response.json()
            return data.get("creatives", [])
    
    async def generate_tiktok_creatives(
        self,
        creative_brief: Dict[str, Any],
        count: int = 3
    ) -> List[Dict[str, Any]]:
        """Generate TikTok-specific creatives using the video app."""
        
        if not self.base_url or not self.api_key:
            raise ValueError("Video app not configured")
        
        payload = {
            "platform": "tiktok",
            "creative_brief": creative_brief,
            "count": count,
            "formats": ["video", "image"],
            "specs": {
                "video": {
                    "width": 1080,
                    "height": 1920,
                    "aspect_ratio": "9:16",
                    "duration": 15
                },
                "image": {
                    "width": 1080,
                    "height": 1920,
                    "aspect_ratio": "9:16"
                }
            }
        }
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/api/v1/creatives/generate",
                json=payload,
                headers={"Authorization": f"Bearer {self.api_key}"}
            )
            response.raise_for_status()
            
            data = response.json()
            return data.get("creatives", [])
    
    async def generate_generic_creatives(
        self,
        creative_brief: Dict[str, Any],
        count: int = 3
    ) -> List[Dict[str, Any]]:
        """Generate generic creatives using the video app."""
        
        if not self.base_url or not self.api_key:
            raise ValueError("Video app not configured")
        
        payload = {
            "platform": "generic",
            "creative_brief": creative_brief,
            "count": count,
            "formats": ["image", "video"],
            "specs": {
                "image": {
                    "width": 1200,
                    "height": 628,
                    "aspect_ratio": "1.91:1"
                },
                "video": {
                    "width": 1280,
                    "height": 720,
                    "aspect_ratio": "16:9",
                    "duration": 30
                }
            }
        }
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/api/v1/creatives/generate",
                json=payload,
                headers={"Authorization": f"Bearer {self.api_key}"}
            )
            response.raise_for_status()
            
            data = response.json()
            return data.get("creatives", [])
    
    async def optimize_creative(
        self,
        creative_id: str,
        optimization_goals: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Optimize an existing creative using the video app."""
        
        if not self.base_url or not self.api_key:
            raise ValueError("Video app not configured")
        
        payload = {
            "creative_id": creative_id,
            "optimization_goals": optimization_goals
        }
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/api/v1/creatives/optimize",
                json=payload,
                headers={"Authorization": f"Bearer {self.api_key}"}
            )
            response.raise_for_status()
            
            return response.json()
    
    async def get_creative_status(self, creative_id: str) -> Dict[str, Any]:
        """Get the status of a creative generation job."""
        
        if not self.base_url or not self.api_key:
            raise ValueError("Video app not configured")
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(
                f"{self.base_url}/api/v1/creatives/{creative_id}/status",
                headers={"Authorization": f"Bearer {self.api_key}"}
            )
            response.raise_for_status()
            
            return response.json()
    
    async def download_creative(self, creative_id: str, format: str = "original") -> bytes:
        """Download a generated creative asset."""
        
        if not self.base_url or not self.api_key:
            raise ValueError("Video app not configured")
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(
                f"{self.base_url}/api/v1/creatives/{creative_id}/download",
                params={"format": format},
                headers={"Authorization": f"Bearer {self.api_key}"}
            )
            response.raise_for_status()
            
            return response.content



