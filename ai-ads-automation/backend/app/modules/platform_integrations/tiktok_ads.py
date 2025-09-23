"""
TikTok Ads API integration client.
"""

import asyncio
from typing import Any, Dict, List, Optional

import httpx
from app.core.config import settings
from app.core.logging import get_logger
from app.modules.platform_integrations.base_client import BasePlatformClient


class TikTokAdsClient(BasePlatformClient):
    """TikTok Ads API client implementation."""
    
    def __init__(self):
        super().__init__("tiktok")
        self.base_url = "https://business-api.tiktok.com/open_api/v1.3"
        self.api_version = "v1.3"
        self.access_token = None
        self.advertiser_id = None
    
    def _get_required_credentials(self) -> List[str]:
        """Get required credentials for TikTok Ads."""
        return ["access_token", "advertiser_id"]
    
    async def authenticate(self, credentials: Dict[str, Any]) -> bool:
        """Authenticate with TikTok Ads API."""
        try:
            if not self._validate_credentials(credentials):
                return False
            
            self.access_token = credentials["access_token"]
            self.advertiser_id = credentials["advertiser_id"]
            
            # Test the connection
            test_url = f"{self.base_url}/advertiser/info/"
            params = {
                "advertiser_id": self.advertiser_id,
                "access_token": self.access_token
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(test_url, params=params)
                response.raise_for_status()
            
            self.is_authenticated = True
            self.logger.info("Successfully authenticated with TikTok Ads API")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to authenticate with TikTok Ads API: {e}")
            return False
    
    async def create_campaign(self, campaign_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new TikTok Ads campaign."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "create_campaign")
            
            url = f"{self.base_url}/campaign/create/"
            
            # Prepare campaign data for TikTok Ads API
            tiktok_campaign_data = {
                "advertiser_id": self.advertiser_id,
                "campaign_name": campaign_data["name"],
                "budget_mode": "BUDGET_MODE_DAY",
                "budget": int(campaign_data.get("budget_daily", 100) * 100),  # Convert to cents
                "landing_page_url": campaign_data.get("landing_page_url", ""),
                "objective_type": self._map_objective_type(campaign_data.get("goal", "TRAFFIC")),
                "status": "ENABLE",  # Start enabled
                "access_token": self.access_token
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=tiktok_campaign_data)
                response.raise_for_status()
                
                result = response.json()
                self._update_rate_limit(response.headers)
                
                return {
                    "success": True,
                    "campaign_id": result["data"]["campaign_id"],
                    "platform": "tiktok",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "create_campaign")
    
    async def update_campaign(self, campaign_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing TikTok Ads campaign."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "update_campaign")
            
            url = f"{self.base_url}/campaign/update/"
            
            # Prepare update data
            tiktok_updates = {
                "advertiser_id": self.advertiser_id,
                "campaign_id": campaign_id,
                "access_token": self.access_token
            }
            
            if "status" in updates:
                tiktok_updates["status"] = updates["status"].upper()
            if "name" in updates:
                tiktok_updates["campaign_name"] = updates["name"]
            if "budget_daily" in updates:
                tiktok_updates["budget"] = int(updates["budget_daily"] * 100)
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=tiktok_updates)
                response.raise_for_status()
                
                result = response.json()
                self._update_rate_limit(response.headers)
                
                return {
                    "success": True,
                    "campaign_id": campaign_id,
                    "platform": "tiktok",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "update_campaign")
    
    async def get_campaign(self, campaign_id: str) -> Dict[str, Any]:
        """Get TikTok Ads campaign details."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "get_campaign")
            
            url = f"{self.base_url}/campaign/get/"
            params = {
                "advertiser_id": self.advertiser_id,
                "campaign_ids": [campaign_id],
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
                    "platform": "tiktok",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "get_campaign")
    
    async def create_ad_group(self, ad_group_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new TikTok Ads ad group."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "create_ad_group")
            
            url = f"{self.base_url}/adgroup/create/"
            
            # Prepare ad group data for TikTok Ads API
            tiktok_adgroup_data = {
                "advertiser_id": self.advertiser_id,
                "campaign_id": ad_group_data["campaign_id"],
                "adgroup_name": ad_group_data["name"],
                "budget_mode": "BUDGET_MODE_DAY",
                "budget": int(ad_group_data.get("budget_daily", 50) * 100),  # Convert to cents
                "bid_type": self._map_bid_type(ad_group_data.get("bid_type", "BID_TYPE_NO_BID")),
                "bid_price": int(ad_group_data.get("bid_price", 1.0) * 100),  # Convert to cents
                "optimization_goal": self._map_optimization_goal(ad_group_data.get("optimization_goal", "REACH")),
                "pacing": "PACING_MODE_STANDARD",
                "status": "ENABLE",  # Start enabled
                "targeting": self._build_targeting_spec(ad_group_data.get("targeting", {})),
                "access_token": self.access_token
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=tiktok_adgroup_data)
                response.raise_for_status()
                
                result = response.json()
                self._update_rate_limit(response.headers)
                
                return {
                    "success": True,
                    "ad_group_id": result["data"]["adgroup_id"],
                    "platform": "tiktok",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "create_ad_group")
    
    async def update_ad_group(self, ad_group_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing TikTok Ads ad group."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "update_ad_group")
            
            url = f"{self.base_url}/adgroup/update/"
            
            # Prepare update data
            tiktok_updates = {
                "advertiser_id": self.advertiser_id,
                "adgroup_id": ad_group_id,
                "access_token": self.access_token
            }
            
            if "status" in updates:
                tiktok_updates["status"] = updates["status"].upper()
            if "name" in updates:
                tiktok_updates["adgroup_name"] = updates["name"]
            if "budget_daily" in updates:
                tiktok_updates["budget"] = int(updates["budget_daily"] * 100)
            if "bid_price" in updates:
                tiktok_updates["bid_price"] = int(updates["bid_price"] * 100)
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=tiktok_updates)
                response.raise_for_status()
                
                result = response.json()
                self._update_rate_limit(response.headers)
                
                return {
                    "success": True,
                    "ad_group_id": ad_group_id,
                    "platform": "tiktok",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "update_ad_group")
    
    async def get_ad_group(self, ad_group_id: str) -> Dict[str, Any]:
        """Get TikTok Ads ad group details."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "get_ad_group")
            
            url = f"{self.base_url}/adgroup/get/"
            params = {
                "advertiser_id": self.advertiser_id,
                "adgroup_ids": [ad_group_id],
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
                    "platform": "tiktok",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "get_ad_group")
    
    async def create_ad_creative(self, creative_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new TikTok Ads ad creative."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "create_ad_creative")
            
            url = f"{self.base_url}/ad/create/"
            
            # Prepare creative data for TikTok Ads API
            tiktok_creative_data = {
                "advertiser_id": self.advertiser_id,
                "adgroup_id": creative_data["ad_group_id"],
                "ad_name": creative_data["name"],
                "ad_format": self._map_ad_format(creative_data.get("format", "SINGLE_IMAGE")),
                "call_to_action": self._map_cta(creative_data.get("cta", "LEARN_MORE")),
                "landing_page_url": creative_data.get("landing_page_url", ""),
                "status": "ENABLE",  # Start enabled
                "creative": self._build_creative_spec(creative_data),
                "access_token": self.access_token
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=tiktok_creative_data)
                response.raise_for_status()
                
                result = response.json()
                self._update_rate_limit(response.headers)
                
                return {
                    "success": True,
                    "creative_id": result["data"]["ad_id"],
                    "platform": "tiktok",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "create_ad_creative")
    
    async def update_ad_creative(self, creative_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing TikTok Ads ad creative."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "update_ad_creative")
            
            url = f"{self.base_url}/ad/update/"
            
            # Prepare update data
            tiktok_updates = {
                "advertiser_id": self.advertiser_id,
                "ad_id": creative_id,
                "access_token": self.access_token
            }
            
            if "status" in updates:
                tiktok_updates["status"] = updates["status"].upper()
            if "name" in updates:
                tiktok_updates["ad_name"] = updates["name"]
            if "landing_page_url" in updates:
                tiktok_updates["landing_page_url"] = updates["landing_page_url"]
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=tiktok_updates)
                response.raise_for_status()
                
                result = response.json()
                self._update_rate_limit(response.headers)
                
                return {
                    "success": True,
                    "creative_id": creative_id,
                    "platform": "tiktok",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "update_ad_creative")
    
    async def get_ad_creative(self, creative_id: str) -> Dict[str, Any]:
        """Get TikTok Ads ad creative details."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "get_ad_creative")
            
            url = f"{self.base_url}/ad/get/"
            params = {
                "advertiser_id": self.advertiser_id,
                "ad_ids": [creative_id],
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
                    "platform": "tiktok",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "get_ad_creative")
    
    async def get_campaign_performance(self, campaign_id: str, date_range: Dict[str, str]) -> Dict[str, Any]:
        """Get TikTok Ads campaign performance data."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "get_campaign_performance")
            
            url = f"{self.base_url}/report/integrated/get/"
            
            # Prepare report data
            report_data = {
                "advertiser_id": self.advertiser_id,
                "service_type": "AUCTION",
                "report_type": "BASIC",
                "data_level": "AUCTION_CAMPAIGN",
                "dimensions": ["campaign_id"],
                "metrics": [
                    "impressions",
                    "clicks",
                    "cost",
                    "conversions",
                    "conversion_value",
                    "ctr",
                    "cpc",
                    "cpm",
                    "cpa",
                    "roas"
                ],
                "start_date": date_range["start_date"],
                "end_date": date_range["end_date"],
                "filters": [
                    {
                        "field": "campaign_id",
                        "operator": "IN",
                        "values": [campaign_id]
                    }
                ],
                "access_token": self.access_token
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=report_data)
                response.raise_for_status()
                
                result = response.json()
                self._update_rate_limit(response.headers)
                
                return {
                    "success": True,
                    "campaign_id": campaign_id,
                    "platform": "tiktok",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "get_campaign_performance")
    
    async def get_ad_group_performance(self, ad_group_id: str, date_range: Dict[str, str]) -> Dict[str, Any]:
        """Get TikTok Ads ad group performance data."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "get_ad_group_performance")
            
            url = f"{self.base_url}/report/integrated/get/"
            
            # Prepare report data
            report_data = {
                "advertiser_id": self.advertiser_id,
                "service_type": "AUCTION",
                "report_type": "BASIC",
                "data_level": "AUCTION_ADGROUP",
                "dimensions": ["adgroup_id"],
                "metrics": [
                    "impressions",
                    "clicks",
                    "cost",
                    "conversions",
                    "conversion_value",
                    "ctr",
                    "cpc",
                    "cpm",
                    "cpa",
                    "roas"
                ],
                "start_date": date_range["start_date"],
                "end_date": date_range["end_date"],
                "filters": [
                    {
                        "field": "adgroup_id",
                        "operator": "IN",
                        "values": [ad_group_id]
                    }
                ],
                "access_token": self.access_token
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=report_data)
                response.raise_for_status()
                
                result = response.json()
                self._update_rate_limit(response.headers)
                
                return {
                    "success": True,
                    "ad_group_id": ad_group_id,
                    "platform": "tiktok",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "get_ad_group_performance")
    
    async def get_creative_performance(self, creative_id: str, date_range: Dict[str, str]) -> Dict[str, Any]:
        """Get TikTok Ads ad creative performance data."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "get_creative_performance")
            
            url = f"{self.base_url}/report/integrated/get/"
            
            # Prepare report data
            report_data = {
                "advertiser_id": self.advertiser_id,
                "service_type": "AUCTION",
                "report_type": "BASIC",
                "data_level": "AUCTION_AD",
                "dimensions": ["ad_id"],
                "metrics": [
                    "impressions",
                    "clicks",
                    "cost",
                    "conversions",
                    "conversion_value",
                    "ctr",
                    "cpc",
                    "cpm",
                    "cpa",
                    "roas"
                ],
                "start_date": date_range["start_date"],
                "end_date": date_range["end_date"],
                "filters": [
                    {
                        "field": "ad_id",
                        "operator": "IN",
                        "values": [creative_id]
                    }
                ],
                "access_token": self.access_token
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=report_data)
                response.raise_for_status()
                
                result = response.json()
                self._update_rate_limit(response.headers)
                
                return {
                    "success": True,
                    "creative_id": creative_id,
                    "platform": "tiktok",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "get_creative_performance")
    
    def _map_objective_type(self, goal: str) -> str:
        """Map campaign goal to TikTok Ads objective type."""
        objective_mapping = {
            "traffic": "TRAFFIC",
            "conversions": "CONVERSIONS",
            "lead_generation": "LEAD_GENERATION",
            "sales": "CONVERSIONS",
            "brand_awareness": "REACH",
            "reach": "REACH",
            "engagement": "ENGAGEMENT"
        }
        return objective_mapping.get(goal, "TRAFFIC")
    
    def _map_bid_type(self, bid_type: str) -> str:
        """Map bid type to TikTok Ads bid type."""
        bid_type_mapping = {
            "no_bid": "BID_TYPE_NO_BID",
            "cpc": "BID_TYPE_CPC",
            "cpm": "BID_TYPE_CPM",
            "cpa": "BID_TYPE_CPA",
            "roas": "BID_TYPE_ROAS"
        }
        return bid_type_mapping.get(bid_type, "BID_TYPE_NO_BID")
    
    def _map_optimization_goal(self, goal: str) -> str:
        """Map optimization goal to TikTok Ads optimization goal."""
        goal_mapping = {
            "reach": "REACH",
            "impressions": "REACH",
            "clicks": "CLICK",
            "conversions": "CONVERSION",
            "conversion_value": "VALUE",
            "landing_page_views": "LINK_CLICK"
        }
        return goal_mapping.get(goal, "REACH")
    
    def _map_ad_format(self, format_type: str) -> str:
        """Map ad format to TikTok Ads ad format."""
        format_mapping = {
            "image": "SINGLE_IMAGE",
            "video": "SINGLE_VIDEO",
            "carousel": "CAROUSEL",
            "spark": "SPARK_ADS"
        }
        return format_mapping.get(format_type, "SINGLE_IMAGE")
    
    def _map_cta(self, cta: str) -> str:
        """Map call-to-action to TikTok Ads CTA."""
        cta_mapping = {
            "learn_more": "LEARN_MORE",
            "shop_now": "SHOP_NOW",
            "download": "DOWNLOAD",
            "sign_up": "SIGN_UP",
            "book_now": "BOOK_NOW",
            "contact_us": "CONTACT_US"
        }
        return cta_mapping.get(cta, "LEARN_MORE")
    
    def _build_targeting_spec(self, targeting: Dict[str, Any]) -> Dict[str, Any]:
        """Build TikTok Ads targeting specification."""
        return {
            "age": {
                "include": targeting.get("age_range", [18, 65])
            },
            "gender": {
                "include": targeting.get("genders", ["MALE", "FEMALE"])
            },
            "geo": {
                "include": {
                    "country": targeting.get("countries", ["US"]),
                    "region": targeting.get("regions", []),
                    "city": targeting.get("cities", [])
                }
            },
            "interests": targeting.get("interests", []),
            "behaviors": targeting.get("behaviors", []),
            "custom_audiences": targeting.get("custom_audiences", []),
            "excluded_custom_audiences": targeting.get("excluded_custom_audiences", [])
        }
    
    def _build_creative_spec(self, creative_data: Dict[str, Any]) -> Dict[str, Any]:
        """Build TikTok Ads creative specification."""
        return {
            "image_ids": creative_data.get("image_ids", []),
            "video_ids": creative_data.get("video_ids", []),
            "title": creative_data.get("title", ""),
            "description": creative_data.get("description", ""),
            "call_to_action": self._map_cta(creative_data.get("cta", "LEARN_MORE")),
            "landing_page_url": creative_data.get("landing_page_url", "")
        }



