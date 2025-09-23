"""
Google Ads API integration client.
"""

import asyncio
from typing import Any, Dict, List, Optional

import httpx
from app.core.config import settings
from app.core.logging import get_logger
from app.modules.platform_integrations.base_client import BasePlatformClient


class GoogleAdsClient(BasePlatformClient):
    """Google Ads API client implementation."""
    
    def __init__(self):
        super().__init__("google")
        self.base_url = "https://googleads.googleapis.com/v14"
        self.api_version = "v14"
        self.access_token = None
        selfcustomer_id = None
        self.developer_token = None
    
    def _get_required_credentials(self) -> List[str]:
        """Get required credentials for Google Ads."""
        return ["access_token", "customer_id", "developer_token"]
    
    async def authenticate(self, credentials: Dict[str, Any]) -> bool:
        """Authenticate with Google Ads API."""
        try:
            if not self._validate_credentials(credentials):
                return False
            
            self.access_token = credentials["access_token"]
            self.customer_id = credentials["customer_id"]
            self.developer_token = credentials["developer_token"]
            
            # Test the connection
            test_url = f"{self.base_url}/customers/{self.customer_id}/campaigns"
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "developer-token": self.developer_token
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(test_url, headers=headers)
                response.raise_for_status()
            
            self.is_authenticated = True
            self.logger.info("Successfully authenticated with Google Ads API")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to authenticate with Google Ads API: {e}")
            return False
    
    async def create_campaign(self, campaign_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new Google Ads campaign."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "create_campaign")
            
            url = f"{self.base_url}/customers/{self.customer_id}/campaigns:mutate"
            
            # Prepare campaign data for Google Ads API
            campaign = {
                "name": campaign_data["name"],
                "advertising_channel_type": self._map_channel_type(campaign_data.get("channel_type", "SEARCH")),
                "status": "PAUSED",  # Start paused for safety
                "campaign_budget": f"customers/{self.customer_id}/campaignBudgets/{campaign_data.get('budget_id', '1')}",
                "start_date": campaign_data.get("start_date", "2024-01-01"),
                "end_date": campaign_data.get("end_date", "2030-12-31"),
                "bidding_strategy": self._build_bidding_strategy(campaign_data.get("bidding_strategy", {})),
                "targeting_setting": self._build_targeting_setting(campaign_data.get("targeting", {}))
            }
            
            mutate_operation = {
                "create": campaign
            }
            
            payload = {
                "operations": [mutate_operation]
            }
            
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "developer-token": self.developer_token,
                "Content-Type": "application/json"
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                
                result = response.json()
                self._update_rate_limit(response.headers)
                
                return {
                    "success": True,
                    "campaign_id": result["results"][0]["resource_name"].split("/")[-1],
                    "platform": "google",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "create_campaign")
    
    async def update_campaign(self, campaign_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing Google Ads campaign."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "update_campaign")
            
            url = f"{self.base_url}/customers/{self.customer_id}/campaigns:mutate"
            
            # Prepare update data
            campaign = {
                "resource_name": f"customers/{self.customer_id}/campaigns/{campaign_id}",
                "id": campaign_id
            }
            
            if "status" in updates:
                campaign["status"] = updates["status"].upper()
            if "name" in updates:
                campaign["name"] = updates["name"]
            if "budget_daily" in updates:
                campaign["campaign_budget"] = f"customers/{self.customer_id}/campaignBudgets/{updates['budget_id']}"
            
            mutate_operation = {
                "update": campaign
            }
            
            payload = {
                "operations": [mutate_operation]
            }
            
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "developer-token": self.developer_token,
                "Content-Type": "application/json"
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                
                result = response.json()
                self._update_rate_limit(response.headers)
                
                return {
                    "success": True,
                    "campaign_id": campaign_id,
                    "platform": "google",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "update_campaign")
    
    async def get_campaign(self, campaign_id: str) -> Dict[str, Any]:
        """Get Google Ads campaign details."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "get_campaign")
            
            url = f"{self.base_url}/customers/{self.customer_id}/campaigns/{campaign_id}"
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "developer-token": self.developer_token
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers)
                response.raise_for_status()
                
                result = response.json()
                self._update_rate_limit(response.headers)
                
                return {
                    "success": True,
                    "campaign_id": campaign_id,
                    "platform": "google",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "get_campaign")
    
    async def create_ad_group(self, ad_group_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new Google Ads ad group."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "create_ad_group")
            
            url = f"{self.base_url}/customers/{self.customer_id}/adGroups:mutate"
            
            # Prepare ad group data for Google Ads API
            ad_group = {
                "name": ad_group_data["name"],
                "campaign": f"customers/{self.customer_id}/campaigns/{ad_group_data['campaign_id']}",
                "status": "PAUSED",  # Start paused for safety
                "type": "SEARCH_STANDARD",
                "cpc_bid_micros": int(ad_group_data.get("cpc_bid", 1.0) * 1000000),  # Convert to micros
                "targeting_setting": self._build_ad_group_targeting(ad_group_data.get("targeting", {}))
            }
            
            mutate_operation = {
                "create": ad_group
            }
            
            payload = {
                "operations": [mutate_operation]
            }
            
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "developer-token": self.developer_token,
                "Content-Type": "application/json"
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                
                result = response.json()
                self._update_rate_limit(response.headers)
                
                return {
                    "success": True,
                    "ad_group_id": result["results"][0]["resource_name"].split("/")[-1],
                    "platform": "google",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "create_ad_group")
    
    async def update_ad_group(self, ad_group_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing Google Ads ad group."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "update_ad_group")
            
            url = f"{self.base_url}/customers/{self.customer_id}/adGroups:mutate"
            
            # Prepare update data
            ad_group = {
                "resource_name": f"customers/{self.customer_id}/adGroups/{ad_group_id}",
                "id": ad_group_id
            }
            
            if "status" in updates:
                ad_group["status"] = updates["status"].upper()
            if "name" in updates:
                ad_group["name"] = updates["name"]
            if "cpc_bid" in updates:
                ad_group["cpc_bid_micros"] = int(updates["cpc_bid"] * 1000000)
            
            mutate_operation = {
                "update": ad_group
            }
            
            payload = {
                "operations": [mutate_operation]
            }
            
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "developer-token": self.developer_token,
                "Content-Type": "application/json"
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                
                result = response.json()
                self._update_rate_limit(response.headers)
                
                return {
                    "success": True,
                    "ad_group_id": ad_group_id,
                    "platform": "google",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "update_ad_group")
    
    async def get_ad_group(self, ad_group_id: str) -> Dict[str, Any]:
        """Get Google Ads ad group details."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "get_ad_group")
            
            url = f"{self.base_url}/customers/{self.customer_id}/adGroups/{ad_group_id}"
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "developer-token": self.developer_token
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers)
                response.raise_for_status()
                
                result = response.json()
                self._update_rate_limit(response.headers)
                
                return {
                    "success": True,
                    "ad_group_id": ad_group_id,
                    "platform": "google",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "get_ad_group")
    
    async def create_ad_creative(self, creative_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new Google Ads ad creative."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "create_ad_creative")
            
            url = f"{self.base_url}/customers/{self.customer_id}/adGroupAds:mutate"
            
            # Prepare creative data for Google Ads API
            ad_group_ad = {
                "ad_group": f"customers/{self.customer_id}/adGroups/{creative_data['ad_group_id']}",
                "status": "PAUSED",  # Start paused for safety
                "ad": {
                    "type": "RESPONSIVE_SEARCH_AD",
                    "responsive_search_ad": {
                        "headlines": [
                            {"text": creative_data.get("headline1", "")},
                            {"text": creative_data.get("headline2", "")},
                            {"text": creative_data.get("headline3", "")}
                        ],
                        "descriptions": [
                            {"text": creative_data.get("description1", "")},
                            {"text": creative_data.get("description2", "")}
                        ],
                        "path1": creative_data.get("path1", ""),
                        "path2": creative_data.get("path2", "")
                    }
                }
            }
            
            mutate_operation = {
                "create": ad_group_ad
            }
            
            payload = {
                "operations": [mutate_operation]
            }
            
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "developer-token": self.developer_token,
                "Content-Type": "application/json"
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                
                result = response.json()
                self._update_rate_limit(response.headers)
                
                return {
                    "success": True,
                    "creative_id": result["results"][0]["resource_name"].split("/")[-1],
                    "platform": "google",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "create_ad_creative")
    
    async def update_ad_creative(self, creative_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing Google Ads ad creative."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "update_ad_creative")
            
            url = f"{self.base_url}/customers/{self.customer_id}/adGroupAds:mutate"
            
            # Prepare update data
            ad_group_ad = {
                "resource_name": f"customers/{self.customer_id}/adGroupAds/{creative_id}",
                "id": creative_id
            }
            
            if "status" in updates:
                ad_group_ad["status"] = updates["status"].upper()
            if "headline1" in updates:
                ad_group_ad["ad"]["responsive_search_ad"]["headlines"][0]["text"] = updates["headline1"]
            
            mutate_operation = {
                "update": ad_group_ad
            }
            
            payload = {
                "operations": [mutate_operation]
            }
            
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "developer-token": self.developer_token,
                "Content-Type": "application/json"
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                
                result = response.json()
                self._update_rate_limit(response.headers)
                
                return {
                    "success": True,
                    "creative_id": creative_id,
                    "platform": "google",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "update_ad_creative")
    
    async def get_ad_creative(self, creative_id: str) -> Dict[str, Any]:
        """Get Google Ads ad creative details."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "get_ad_creative")
            
            url = f"{self.base_url}/customers/{self.customer_id}/adGroupAds/{creative_id}"
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "developer-token": self.developer_token
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers)
                response.raise_for_status()
                
                result = response.json()
                self._update_rate_limit(response.headers)
                
                return {
                    "success": True,
                    "creative_id": creative_id,
                    "platform": "google",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "get_ad_creative")
    
    async def get_campaign_performance(self, campaign_id: str, date_range: Dict[str, str]) -> Dict[str, Any]:
        """Get Google Ads campaign performance data."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "get_campaign_performance")
            
            url = f"{self.base_url}/customers/{self.customer_id}/googleAds:search"
            
            query = f"""
                SELECT 
                    campaign.id,
                    campaign.name,
                    metrics.impressions,
                    metrics.clicks,
                    metrics.cost_micros,
                    metrics.conversions,
                    metrics.conversions_value,
                    metrics.cost_per_conversion,
                    metrics.cost_per_conversion_value,
                    metrics.ctr,
                    metrics.average_cpc
                FROM campaign
                WHERE campaign.id = {campaign_id}
                AND segments.date BETWEEN '{date_range['start_date']}' AND '{date_range['end_date']}'
            """
            
            payload = {"query": query}
            
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "developer-token": self.developer_token,
                "Content-Type": "application/json"
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                
                result = response.json()
                self._update_rate_limit(response.headers)
                
                return {
                    "success": True,
                    "campaign_id": campaign_id,
                    "platform": "google",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "get_campaign_performance")
    
    async def get_ad_group_performance(self, ad_group_id: str, date_range: Dict[str, str]) -> Dict[str, Any]:
        """Get Google Ads ad group performance data."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "get_ad_group_performance")
            
            url = f"{self.base_url}/customers/{self.customer_id}/googleAds:search"
            
            query = f"""
                SELECT 
                    ad_group.id,
                    ad_group.name,
                    metrics.impressions,
                    metrics.clicks,
                    metrics.cost_micros,
                    metrics.conversions,
                    metrics.conversions_value,
                    metrics.cost_per_conversion,
                    metrics.cost_per_conversion_value,
                    metrics.ctr,
                    metrics.average_cpc
                FROM ad_group
                WHERE ad_group.id = {ad_group_id}
                AND segments.date BETWEEN '{date_range['start_date']}' AND '{date_range['end_date']}'
            """
            
            payload = {"query": query}
            
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "developer-token": self.developer_token,
                "Content-Type": "application/json"
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                
                result = response.json()
                self._update_rate_limit(response.headers)
                
                return {
                    "success": True,
                    "ad_group_id": ad_group_id,
                    "platform": "google",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "get_ad_group_performance")
    
    async def get_creative_performance(self, creative_id: str, date_range: Dict[str, str]) -> Dict[str, Any]:
        """Get Google Ads ad creative performance data."""
        try:
            if not self._check_rate_limit():
                return self._handle_error(Exception("Rate limit exceeded"), "get_creative_performance")
            
            url = f"{self.base_url}/customers/{self.customer_id}/googleAds:search"
            
            query = f"""
                SELECT 
                    ad_group_ad.ad.id,
                    ad_group_ad.ad.responsive_search_ad.headlines,
                    ad_group_ad.ad.responsive_search_ad.descriptions,
                    metrics.impressions,
                    metrics.clicks,
                    metrics.cost_micros,
                    metrics.conversions,
                    metrics.conversions_value,
                    metrics.cost_per_conversion,
                    metrics.cost_per_conversion_value,
                    metrics.ctr,
                    metrics.average_cpc
                FROM ad_group_ad
                WHERE ad_group_ad.ad.id = {creative_id}
                AND segments.date BETWEEN '{date_range['start_date']}' AND '{date_range['end_date']}'
            """
            
            payload = {"query": query}
            
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "developer-token": self.developer_token,
                "Content-Type": "application/json"
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                
                result = response.json()
                self._update_rate_limit(response.headers)
                
                return {
                    "success": True,
                    "creative_id": creative_id,
                    "platform": "google",
                    "data": result
                }
                
        except Exception as e:
            return self._handle_error(e, "get_creative_performance")
    
    def _map_channel_type(self, channel_type: str) -> str:
        """Map channel type to Google Ads channel type."""
        channel_mapping = {
            "search": "SEARCH",
            "display": "DISPLAY",
            "video": "VIDEO",
            "shopping": "SHOPPING",
            "app": "MULTI_CHANNEL"
        }
        return channel_mapping.get(channel_type, "SEARCH")
    
    def _build_bidding_strategy(self, bidding_strategy: Dict[str, Any]) -> Dict[str, Any]:
        """Build Google Ads bidding strategy."""
        strategy_type = bidding_strategy.get("type", "TARGET_CPA")
        
        if strategy_type == "TARGET_CPA":
            return {
                "target_cpa": {
                    "target_cpa_micros": int(bidding_strategy.get("target_cpa", 10.0) * 1000000)
                }
            }
        elif strategy_type == "TARGET_ROAS":
            return {
                "target_roas": {
                    "target_roas": bidding_strategy.get("target_roas", 3.0)
                }
            }
        else:
            return {
                "target_cpa": {
                    "target_cpa_micros": int(10.0 * 1000000)
                }
            }
    
    def _build_targeting_setting(self, targeting: Dict[str, Any]) -> Dict[str, Any]:
        """Build Google Ads targeting setting."""
        return {
            "target_restrictions": {
                "targeting_dimension": "AUDIENCE",
                "bid_only": targeting.get("bid_only", False)
            }
        }
    
    def _build_ad_group_targeting(self, targeting: Dict[str, Any]) -> Dict[str, Any]:
        """Build Google Ads ad group targeting."""
        return {
            "target_restrictions": {
                "targeting_dimension": "AUDIENCE",
                "bid_only": targeting.get("bid_only", False)
            }
        }



