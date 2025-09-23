"""
Base client for platform integrations.
"""

import asyncio
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from app.core.logging import get_logger


class BasePlatformClient(ABC):
    """Abstract base class for platform integration clients."""
    
    def __init__(self, platform_name: str):
        self.platform_name = platform_name
        self.logger = get_logger(f"{platform_name}_client")
        self.is_authenticated = False
        self.rate_limit_remaining = 1000
        self.rate_limit_reset = None
    
    @abstractmethod
    async def authenticate(self, credentials: Dict[str, Any]) -> bool:
        """Authenticate with the platform."""
        pass
    
    @abstractmethod
    async def create_campaign(self, campaign_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new campaign."""
        pass
    
    @abstractmethod
    async def update_campaign(self, campaign_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing campaign."""
        pass
    
    @abstractmethod
    async def get_campaign(self, campaign_id: str) -> Dict[str, Any]:
        """Get campaign details."""
        pass
    
    @abstractmethod
    async def create_ad_group(self, ad_group_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new ad group."""
        pass
    
    @abstractmethod
    async def update_ad_group(self, ad_group_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing ad group."""
        pass
    
    @abstractmethod
    async def get_ad_group(self, ad_group_id: str) -> Dict[str, Any]:
        """Get ad group details."""
        pass
    
    @abstractmethod
    async def create_ad_creative(self, creative_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new ad creative."""
        pass
    
    @abstractmethod
    async def update_ad_creative(self, creative_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing ad creative."""
        pass
    
    @abstractmethod
    async def get_ad_creative(self, creative_id: str) -> Dict[str, Any]:
        """Get ad creative details."""
        pass
    
    @abstractmethod
    async def get_campaign_performance(self, campaign_id: str, date_range: Dict[str, str]) -> Dict[str, Any]:
        """Get campaign performance data."""
        pass
    
    @abstractmethod
    async def get_ad_group_performance(self, ad_group_id: str, date_range: Dict[str, str]) -> Dict[str, Any]:
        """Get ad group performance data."""
        pass
    
    @abstractmethod
    async def get_creative_performance(self, creative_id: str, date_range: Dict[str, str]) -> Dict[str, Any]:
        """Get creative performance data."""
        pass
    
    async def pause_campaign(self, campaign_id: str) -> bool:
        """Pause a campaign."""
        try:
            result = await self.update_campaign(campaign_id, {"status": "paused"})
            return result.get("success", False)
        except Exception as e:
            self.logger.error(f"Error pausing campaign {campaign_id}: {e}")
            return False
    
    async def resume_campaign(self, campaign_id: str) -> bool:
        """Resume a campaign."""
        try:
            result = await self.update_campaign(campaign_id, {"status": "active"})
            return result.get("success", False)
        except Exception as e:
            self.logger.error(f"Error resuming campaign {campaign_id}: {e}")
            return False
    
    async def delete_campaign(self, campaign_id: str) -> bool:
        """Delete a campaign."""
        try:
            result = await self.update_campaign(campaign_id, {"status": "deleted"})
            return result.get("success", False)
        except Exception as e:
            self.logger.error(f"Error deleting campaign {campaign_id}: {e}")
            return False
    
    async def pause_ad_group(self, ad_group_id: str) -> bool:
        """Pause an ad group."""
        try:
            result = await self.update_ad_group(ad_group_id, {"status": "paused"})
            return result.get("success", False)
        except Exception as e:
            self.logger.error(f"Error pausing ad group {ad_group_id}: {e}")
            return False
    
    async def resume_ad_group(self, ad_group_id: str) -> bool:
        """Resume an ad group."""
        try:
            result = await self.update_ad_group(ad_group_id, {"status": "active"})
            return result.get("success", False)
        except Exception as e:
            self.logger.error(f"Error resuming ad group {ad_group_id}: {e}")
            return False
    
    async def delete_ad_group(self, ad_group_id: str) -> bool:
        """Delete an ad group."""
        try:
            result = await self.update_ad_group(ad_group_id, {"status": "deleted"})
            return result.get("success", False)
        except Exception as e:
            self.logger.error(f"Error deleting ad group {ad_group_id}: {e}")
            return False
    
    async def pause_ad_creative(self, creative_id: str) -> bool:
        """Pause an ad creative."""
        try:
            result = await self.update_ad_creative(creative_id, {"status": "paused"})
            return result.get("success", False)
        except Exception as e:
            self.logger.error(f"Error pausing ad creative {creative_id}: {e}")
            return False
    
    async def resume_ad_creative(self, creative_id: str) -> bool:
        """Resume an ad creative."""
        try:
            result = await self.update_ad_creative(creative_id, {"status": "active"})
            return result.get("success", False)
        except Exception as e:
            self.logger.error(f"Error resuming ad creative {creative_id}: {e}")
            return False
    
    async def delete_ad_creative(self, creative_id: str) -> bool:
        """Delete an ad creative."""
        try:
            result = await self.update_ad_creative(creative_id, {"status": "deleted"})
            return result.get("success", False)
        except Exception as e:
            self.logger.error(f"Error deleting ad creative {creative_id}: {e}")
            return False
    
    def _check_rate_limit(self) -> bool:
        """Check if we're within rate limits."""
        if self.rate_limit_remaining <= 0:
            self.logger.warning("Rate limit exceeded")
            return False
        return True
    
    def _update_rate_limit(self, headers: Dict[str, Any]):
        """Update rate limit information from response headers."""
        if "X-RateLimit-Remaining" in headers:
            self.rate_limit_remaining = int(headers["X-RateLimit-Remaining"])
        if "X-RateLimit-Reset" in headers:
            self.rate_limit_reset = int(headers["X-RateLimit-Reset"])
    
    def _handle_error(self, error: Exception, operation: str) -> Dict[str, Any]:
        """Handle API errors consistently."""
        error_message = str(error)
        self.logger.error(f"Error in {operation}: {error_message}")
        
        return {
            "success": False,
            "error": error_message,
            "operation": operation,
            "platform": self.platform_name
        }
    
    def _validate_credentials(self, credentials: Dict[str, Any]) -> bool:
        """Validate required credentials."""
        required_fields = self._get_required_credentials()
        for field in required_fields:
            if field not in credentials or not credentials[field]:
                self.logger.error(f"Missing required credential: {field}")
                return False
        return True
    
    @abstractmethod
    def _get_required_credentials(self) -> List[str]:
        """Get list of required credentials for this platform."""
        pass
    
    async def health_check(self) -> Dict[str, Any]:
        """Check the health of the platform connection."""
        try:
            # Try to make a simple API call to check connectivity
            if not self.is_authenticated:
                return {
                    "status": "unauthenticated",
                    "platform": self.platform_name,
                    "message": "Not authenticated with platform"
                }
            
            # In production, this would make an actual API call
            return {
                "status": "healthy",
                "platform": self.platform_name,
                "rate_limit_remaining": self.rate_limit_remaining,
                "rate_limit_reset": self.rate_limit_reset
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "platform": self.platform_name,
                "error": str(e)
            }



