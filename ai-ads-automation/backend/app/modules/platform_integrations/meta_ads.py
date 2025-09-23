"""
Meta Ads API integration client.
"""

import asyncio
from typing import Any, Dict, List, Optional

import httpx
from app.core.config import settings
from app.core.logging import get_logger
from app.modules.platform_integrations.base_client import BasePlatformClient


class MetaAdsClient(BasePlatformClient):
    """Meta Ads API client implementation."""
    
    def __init__(self):
        super().__init__("meta")
        self.base_url = "https://graph.facebook.com/v18.0"
        self.api_version = "v18.0"
        self.access_token = None
        self.ad_account_id = None
    
    def _get_required_credentials(self) -> List[str]:
        """Get required credentials for Meta Ads."""
        return ["access_token", "ad_account_id"]
    
    async def authenticate(self, credentials: Dict[str, Any]) -> bool:
        """Authenticate with Meta Ads API."""
        try:
            if not self._validate_credentials(credentials):
                return False
            
            self.access_token = credentials["access_token"]
            self.ad_account_id = credentials["ad_account_id"]
            
            # Test the connection
            test_url = f"{self.base_url}/me"
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    test_url,
                    params={"access_token": self.access_token}
                )
                response.raise_for_status()
            
            self.is_authenticated = True
            self.logger.info("Successfully authenticated with Meta Ads API")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to authenticate with Meta Ads API: {e}")
            return False
    
    async def create_campaign(self, campaign_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new Meta Ads campaign."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "create_campaign")
            
            url = f"{self.base_url}/{self.ad_account_id}/campaigns"
            
            # Prepare campaign data for Meta API
            meta_campaign_data = {
                "name": campaign_data["name"],
                "objective": self._map_campaign_objective(campaign_data.get("goal", "traffic")),
                "status": "PAUSED",  # Start paused for safety
                "daily_budget": int(campaign_data.get("budget_daily", 100) * 100),  # Convert to cents
                "special_ad_categories": campaign_data.get("special_ad_categories", []),
                "access_token": self.access_token
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, data=meta_campaign_data)
                response.raise_for_status()
                
                result = response.json()
                self._update_rate_limit(response.headers)
                
                return {
                    "success": True,
                    "campaign_id": result["id"],
                    "platform": "meta",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "create_campaign")
    
    async def update_campaign(self, campaign_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing Meta Ads campaign."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "update_campaign")
            
            url = f"{self.base_url}/{campaign_id}"
            
            # Map updates to Meta API format
            meta_updates = {}
            if "status" in updates:
                meta_updates["status"] = updates["status"].upper()
            if "name" in updates:
                meta_updates["name"] = updates["name"]
            if "budget_daily" in updates:
                meta_updates["daily_budget"] = int(updates["budget_daily"] * 100)
            
            meta_updates["access_token"] = self.access_token
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, data=meta_updates)
                response.raise_for_status()
                
                result = response.json()
                self._update_rate_limit(response.headers)
                
                return {
                    "success": True,
                    "campaign_id": campaign_id,
                    "platform": "meta",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "update_campaign")
    
    async def get_campaign(self, campaign_id: str) -> Dict[str, Any]:
        """Get Meta Ads campaign details."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "get_campaign")
            
            url = f"{self.base_url}/{campaign_id}"
            params = {
                "fields": "id,name,objective,status,daily_budget,created_time,updated_time",
                "access_token": self.access_token
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                
                result = response.json()
                self._update_rate_limit(response.headers)
                
                return {
                    "success": True,
                    "campaign_id": campaign_id,
                    "platform": "meta",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "get_campaign")
    
    async def create_ad_group(self, ad_group_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new Meta Ads ad set (ad group)."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "create_ad_group")
            
            url = f"{self.base_url}/{self.ad_account_id}/adsets"
            
            # Prepare ad set data for Meta API
            meta_adset_data = {
                "name": ad_group_data["name"],
                "campaign_id": ad_group_data["campaign_id"],
                "status": "PAUSED",  # Start paused for safety
                "daily_budget": int(ad_group_data.get("budget_daily", 50) * 100),  # Convert to cents
                "billing_event": "IMPRESSIONS",
                "optimization_goal": self._map_optimization_goal(ad_group_data.get("optimization_goal", "REACH")),
                "targeting": self._build_targeting_spec(ad_group_data.get("targeting", {})),
                "access_token": self.access_token
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, data=meta_adset_data)
                response.raise_for_status()
                
                result = response.json()
                self._update_rate_limit(response.headers)
                
                return {
                    "success": True,
                    "ad_group_id": result["id"],
                    "platform": "meta",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "create_ad_group")
    
    async def update_ad_group(self, ad_group_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing Meta Ads ad set."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "update_ad_group")
            
            url = f"{self.base_url}/{ad_group_id}"
            
            # Map updates to Meta API format
            meta_updates = {}
            if "status" in updates:
                meta_updates["status"] = updates["status"].upper()
            if "name" in updates:
                meta_updates["name"] = updates["name"]
            if "budget_daily" in updates:
                meta_updates["daily_budget"] = int(updates["budget_daily"] * 100)
            if "targeting" in updates:
                meta_updates["targeting"] = self._build_targeting_spec(updates["targeting"])
            
            meta_updates["access_token"] = self.access_token
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, data=meta_updates)
                response.raise_for_status()
                
                result = response.json()
                self._update_rate_limit(response.headers)
                
                return {
                    "success": True,
                    "ad_group_id": ad_group_id,
                    "platform": "meta",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "update_ad_group")
    
    async def get_ad_group(self, ad_group_id: str) -> Dict[str, Any]:
        """Get Meta Ads ad set details."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "get_ad_group")
            
            url = f"{self.base_url}/{ad_group_id}"
            params = {
                "fields": "id,name,campaign_id,status,daily_budget,targeting,created_time,updated_time",
                "access_token": self.access_token
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                
                result = response.json()
                self._update_rate_limit(response.headers)
                
                return {
                    "success": True,
                    "ad_group_id": ad_group_id,
                    "platform": "meta",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "get_ad_group")
    
    async def create_ad_creative(self, creative_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new Meta Ads ad creative."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "create_ad_creative")
            
            url = f"{self.base_url}/{self.ad_account_id}/adcreatives"
            
            # Prepare creative data for Meta API
            meta_creative_data = {
                "name": creative_data["name"],
                "object_story_spec": self._build_creative_spec(creative_data),
                "access_token": self.access_token
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, data=meta_creative_data)
                response.raise_for_status()
                
                result = response.json()
                self._update_rate_limit(response.headers)
                
                return {
                    "success": True,
                    "creative_id": result["id"],
                    "platform": "meta",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "create_ad_creative")
    
    async def update_ad_creative(self, creative_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing Meta Ads ad creative."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "update_ad_creative")
            
            url = f"{self.base_url}/{creative_id}"
            
            # Map updates to Meta API format
            meta_updates = {}
            if "name" in updates:
                meta_updates["name"] = updates["name"]
            if "object_story_spec" in updates:
                meta_updates["object_story_spec"] = self._build_creative_spec(updates)
            
            meta_updates["access_token"] = self.access_token
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, data=meta_updates)
                response.raise_for_status()
                
                result = response.json()
                self._update_rate_limit(response.headers)
                
                return {
                    "success": True,
                    "creative_id": creative_id,
                    "platform": "meta",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "update_ad_creative")
    
    async def get_ad_creative(self, creative_id: str) -> Dict[str, Any]:
        """Get Meta Ads ad creative details."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "get_ad_creative")
            
            url = f"{self.base_url}/{creative_id}"
            params = {
                "fields": "id,name,object_story_spec,created_time,updated_time",
                "access_token": self.access_token
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                
                result = response.json()
                self._update_rate_limit(response.headers)
                
                return {
                    "success": True,
                    "creative_id": creative_id,
                    "platform": "meta",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "get_ad_creative")
    
    async def get_campaign_performance(self, campaign_id: str, date_range: Dict[str, str]) -> Dict[str, Any]:
        """Get Meta Ads campaign performance data."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "get_campaign_performance")
            
            url = f"{self.base_url}/{campaign_id}/insights"
            params = {
                "fields": "impressions,clicks,spend,conversions,conversion_values,cpc,cpm,ctr,cpa,roas",
                "time_range": f"{{'since':'{date_range['start_date']}','until':'{date_range['end_date']}'}}",
                "access_token": self.access_token
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                
                result = response.json()
                self._update_rate_limit(response.headers)
                
                return {
                    "success": True,
                    "campaign_id": campaign_id,
                    "platform": "meta",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "get_campaign_performance")
    
    async def get_ad_group_performance(self, ad_group_id: str, date_range: Dict[str, str]) -> Dict[str, Any]:
        """Get Meta Ads ad set performance data."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "get_ad_group_performance")
            
            url = f"{self.base_url}/{ad_group_id}/insights"
            params = {
                "fields": "impressions,clicks,spend,conversions,conversion_values,cpc,cpm,ctr,cpa,roas",
                "time_range": f"{{'since':'{date_range['start_date']}','until':'{date_range['end_date']}'}}",
                "access_token": self.access_token
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                
                result = response.json()
                self._update_rate_limit(response.headers)
                
                return {
                    "success": True,
                    "ad_group_id": ad_group_id,
                    "platform": "meta",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "get_ad_group_performance")
    
    async def get_creative_performance(self, creative_id: str, date_range: Dict[str, str]) -> Dict[str, Any]:
        """Get Meta Ads ad creative performance data."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "get_creative_performance")
            
            url = f"{self.base_url}/{creative_id}/insights"
            params = {
                "fields": "impressions,clicks,spend,conversions,conversion_values,cpc,cpm,ctr,cpa,roas",
                "time_range": f"{{'since':'{date_range['start_date']}','until':'{date_range['end_date']}'}}",
                "access_token": self.access_token
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                
                result = response.json()
                self._update_rate_limit(response.headers)
                
                return {
                    "success": True,
                    "creative_id": creative_id,
                    "platform": "meta",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "get_creative_performance")
    
    def _map_campaign_objective(self, goal: str) -> str:
        """Map campaign goal to Meta Ads objective."""
        objective_mapping = {
            "traffic": "LINK_CLICKS",
            "conversions": "CONVERSIONS",
            "lead_generation": "LEAD_GENERATION",
            "sales": "CONVERSIONS",
            "brand_awareness": "BRAND_AWARENESS",
            "reach": "REACH",
            "engagement": "POST_ENGAGEMENT"
        }
        return objective_mapping.get(goal, "LINK_CLICKS")
    
    def _map_optimization_goal(self, goal: str) -> str:
        """Map optimization goal to Meta Ads optimization goal."""
        goal_mapping = {
            "reach": "REACH",
            "impressions": "IMPRESSIONS",
            "clicks": "LINK_CLICKS",
            "conversions": "CONVERSIONS",
            "conversion_value": "VALUE",
            "landing_page_views": "LANDING_PAGE_VIEWS"
        }
        return goal_mapping.get(goal, "REACH")
    
    def _build_targeting_spec(self, targeting: Dict[str, Any]) -> str:
        """Build Meta Ads targeting specification."""
        import json
        
        targeting_spec = {
            "geo_locations": {
                "countries": targeting.get("countries", ["US"]),
                "regions": targeting.get("regions", []),
                "cities": targeting.get("cities", [])
            },
            "age_min": targeting.get("age_min", 18),
            "age_max": targeting.get("age_max", 65),
            "genders": targeting.get("genders", [1, 2]),  # 1 = male, 2 = female
            "interests": targeting.get("interests", []),
            "behaviors": targeting.get("behaviors", []),
            "custom_audiences": targeting.get("custom_audiences", []),
            "excluded_custom_audiences": targeting.get("excluded_custom_audiences", [])
        }
        
        return json.dumps(targeting_spec)
    
    def _build_creative_spec(self, creative_data: Dict[str, Any]) -> str:
        """Build Meta Ads creative specification."""
        import json
        
        creative_spec = {
            "page_id": creative_data.get("page_id", ""),
            "link_data": {
                "message": creative_data.get("message", ""),
                "link": creative_data.get("link", ""),
                "name": creative_data.get("name", ""),
                "description": creative_data.get("description", ""),
                "picture": creative_data.get("picture", ""),
                "call_to_action": {
                    "type": creative_data.get("cta_type", "LEARN_MORE"),
                    "value": {
                        "link": creative_data.get("cta_link", "")
                    }
                }
            }
        }
        
        return json.dumps(creative_spec)



