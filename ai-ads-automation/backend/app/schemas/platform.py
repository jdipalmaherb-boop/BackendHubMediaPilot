"""
Pydantic schemas for platform integrations.
"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class PlatformAuthRequest(BaseModel):
    """Request schema for platform authentication."""
    
    credentials: Dict[str, Any] = Field(..., description="Platform-specific credentials")


class PlatformAuthResponse(BaseModel):
    """Response schema for platform authentication."""
    
    success: bool = Field(..., description="Whether authentication was successful")
    platform: str = Field(..., description="Platform name")
    message: str = Field(..., description="Authentication message")


class CampaignCreateRequest(BaseModel):
    """Request schema for creating a campaign."""
    
    campaign_data: Dict[str, Any] = Field(..., description="Campaign data")


class CampaignCreateResponse(BaseModel):
    """Response schema for creating a campaign."""
    
    success: bool = Field(..., description="Whether campaign creation was successful")
    platform: str = Field(..., description="Platform name")
    campaign_id: Optional[str] = Field(None, description="Created campaign ID")
    data: Dict[str, Any] = Field(default={}, description="Platform response data")


class CampaignUpdateRequest(BaseModel):
    """Request schema for updating a campaign."""
    
    updates: Dict[str, Any] = Field(..., description="Campaign updates")


class CampaignUpdateResponse(BaseModel):
    """Response schema for updating a campaign."""
    
    success: bool = Field(..., description="Whether campaign update was successful")
    platform: str = Field(..., description="Platform name")
    campaign_id: str = Field(..., description="Updated campaign ID")
    data: Dict[str, Any] = Field(default={}, description="Platform response data")


class CampaignGetResponse(BaseModel):
    """Response schema for getting a campaign."""
    
    success: bool = Field(..., description="Whether campaign retrieval was successful")
    platform: str = Field(..., description="Platform name")
    campaign_id: str = Field(..., description="Campaign ID")
    data: Dict[str, Any] = Field(default={}, description="Campaign data")


class AdGroupCreateRequest(BaseModel):
    """Request schema for creating an ad group."""
    
    ad_group_data: Dict[str, Any] = Field(..., description="Ad group data")


class AdGroupCreateResponse(BaseModel):
    """Response schema for creating an ad group."""
    
    success: bool = Field(..., description="Whether ad group creation was successful")
    platform: str = Field(..., description="Platform name")
    ad_group_id: Optional[str] = Field(None, description="Created ad group ID")
    data: Dict[str, Any] = Field(default={}, description="Platform response data")


class AdGroupUpdateRequest(BaseModel):
    """Request schema for updating an ad group."""
    
    updates: Dict[str, Any] = Field(..., description="Ad group updates")


class AdGroupUpdateResponse(BaseModel):
    """Response schema for updating an ad group."""
    
    success: bool = Field(..., description="Whether ad group update was successful")
    platform: str = Field(..., description="Platform name")
    ad_group_id: str = Field(..., description="Updated ad group ID")
    data: Dict[str, Any] = Field(default={}, description="Platform response data")


class AdGroupGetResponse(BaseModel):
    """Response schema for getting an ad group."""
    
    success: bool = Field(..., description="Whether ad group retrieval was successful")
    platform: str = Field(..., description="Platform name")
    ad_group_id: str = Field(..., description="Ad group ID")
    data: Dict[str, Any] = Field(default={}, description="Ad group data")


class CreativeCreateRequest(BaseModel):
    """Request schema for creating an ad creative."""
    
    creative_data: Dict[str, Any] = Field(..., description="Creative data")


class CreativeCreateResponse(BaseModel):
    """Response schema for creating an ad creative."""
    
    success: bool = Field(..., description="Whether creative creation was successful")
    platform: str = Field(..., description="Platform name")
    creative_id: Optional[str] = Field(None, description="Created creative ID")
    data: Dict[str, Any] = Field(default={}, description="Platform response data")


class CreativeUpdateRequest(BaseModel):
    """Request schema for updating an ad creative."""
    
    updates: Dict[str, Any] = Field(..., description="Creative updates")


class CreativeUpdateResponse(BaseModel):
    """Response schema for updating an ad creative."""
    
    success: bool = Field(..., description="Whether creative update was successful")
    platform: str = Field(..., description="Platform name")
    creative_id: str = Field(..., description="Updated creative ID")
    data: Dict[str, Any] = Field(default={}, description="Platform response data")


class CreativeGetResponse(BaseModel):
    """Response schema for getting an ad creative."""
    
    success: bool = Field(..., description="Whether creative retrieval was successful")
    platform: str = Field(..., description="Platform name")
    creative_id: str = Field(..., description="Creative ID")
    data: Dict[str, Any] = Field(default={}, description="Creative data")


class PerformanceRequest(BaseModel):
    """Request schema for getting performance data."""
    
    date_range: Dict[str, str] = Field(..., description="Date range for performance data")


class PerformanceResponse(BaseModel):
    """Response schema for getting performance data."""
    
    success: bool = Field(..., description="Whether performance data retrieval was successful")
    platform: str = Field(..., description="Platform name")
    entity_type: str = Field(..., description="Entity type (campaign, adgroup, creative)")
    entity_id: str = Field(..., description="Entity ID")
    data: Dict[str, Any] = Field(default={}, description="Performance data")



