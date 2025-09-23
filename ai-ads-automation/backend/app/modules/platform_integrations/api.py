"""
API endpoints for platform integrations.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.logging import get_logger
from app.modules.platform_integrations.meta_ads import MetaAdsClient
from app.modules.platform_integrations.google_ads import GoogleAdsClient
from app.modules.platform_integrations.tiktok_ads import TikTokAdsClient
from app.schemas.platform import (
    PlatformAuthRequest,
    PlatformAuthResponse,
    CampaignCreateRequest,
    CampaignCreateResponse,
    CampaignUpdateRequest,
    CampaignUpdateResponse,
    CampaignGetResponse,
    AdGroupCreateRequest,
    AdGroupCreateResponse,
    AdGroupUpdateRequest,
    AdGroupUpdateResponse,
    AdGroupGetResponse,
    CreativeCreateRequest,
    CreativeCreateResponse,
    CreativeUpdateRequest,
    CreativeUpdateResponse,
    CreativeGetResponse,
    PerformanceRequest,
    PerformanceResponse
)

router = APIRouter(prefix="/platform", tags=["platform"])
logger = get_logger("platform_api")


@router.post("/auth/{platform}", response_model=PlatformAuthResponse)
async def authenticate_platform(
    platform: str,
    request: PlatformAuthRequest,
    db: Session = Depends(get_db)
):
    """Authenticate with a platform."""
    
    try:
        # Get platform client
        client = _get_platform_client(platform)
        if not client:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported platform: {platform}"
            )
        
        # Authenticate
        success = await client.authenticate(request.credentials)
        
        if success:
            # Store credentials in database (in production, encrypt these)
            # This is a simplified implementation
            return PlatformAuthResponse(
                success=True,
                platform=platform,
                message="Successfully authenticated"
            )
        else:
            return PlatformAuthResponse(
                success=False,
                platform=platform,
                message="Authentication failed"
            )
        
    except Exception as e:
        logger.error(f"Error authenticating with {platform}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to authenticate with {platform}: {str(e)}"
        )


@router.post("/campaign/create/{platform}", response_model=CampaignCreateResponse)
async def create_campaign(
    platform: str,
    request: CampaignCreateRequest,
    db: Session = Depends(get_db)
):
    """Create a campaign on a platform."""
    
    try:
        # Get platform client
        client = _get_platform_client(platform)
        if not client:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported platform: {platform}"
            )
        
        # Create campaign
        result = await client.create_campaign(request.campaign_data)
        
        return CampaignCreateResponse(
            success=result["success"],
            platform=platform,
            campaign_id=result.get("campaign_id"),
            data=result.get("data", {})
        )
        
    except Exception as e:
        logger.error(f"Error creating campaign on {platform}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create campaign on {platform}: {str(e)}"
        )


@router.put("/campaign/update/{platform}/{campaign_id}", response_model=CampaignUpdateResponse)
async def update_campaign(
    platform: str,
    campaign_id: str,
    request: CampaignUpdateRequest,
    db: Session = Depends(get_db)
):
    """Update a campaign on a platform."""
    
    try:
        # Get platform client
        client = _get_platform_client(platform)
        if not client:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported platform: {platform}"
            )
        
        # Update campaign
        result = await client.update_campaign(campaign_id, request.updates)
        
        return CampaignUpdateResponse(
            success=result["success"],
            platform=platform,
            campaign_id=campaign_id,
            data=result.get("data", {})
        )
        
    except Exception as e:
        logger.error(f"Error updating campaign {campaign_id} on {platform}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update campaign on {platform}: {str(e)}"
        )


@router.get("/campaign/get/{platform}/{campaign_id}", response_model=CampaignGetResponse)
async def get_campaign(
    platform: str,
    campaign_id: str,
    db: Session = Depends(get_db)
):
    """Get campaign details from a platform."""
    
    try:
        # Get platform client
        client = _get_platform_client(platform)
        if not client:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported platform: {platform}"
            )
        
        # Get campaign
        result = await client.get_campaign(campaign_id)
        
        return CampaignGetResponse(
            success=result["success"],
            platform=platform,
            campaign_id=campaign_id,
            data=result.get("data", {})
        )
        
    except Exception as e:
        logger.error(f"Error getting campaign {campaign_id} from {platform}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get campaign from {platform}: {str(e)}"
        )


@router.post("/adgroup/create/{platform}", response_model=AdGroupCreateResponse)
async def create_ad_group(
    platform: str,
    request: AdGroupCreateRequest,
    db: Session = Depends(get_db)
):
    """Create an ad group on a platform."""
    
    try:
        # Get platform client
        client = _get_platform_client(platform)
        if not client:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported platform: {platform}"
            )
        
        # Create ad group
        result = await client.create_ad_group(request.ad_group_data)
        
        return AdGroupCreateResponse(
            success=result["success"],
            platform=platform,
            ad_group_id=result.get("ad_group_id"),
            data=result.get("data", {})
        )
        
    except Exception as e:
        logger.error(f"Error creating ad group on {platform}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create ad group on {platform}: {str(e)}"
        )


@router.put("/adgroup/update/{platform}/{ad_group_id}", response_model=AdGroupUpdateResponse)
async def update_ad_group(
    platform: str,
    ad_group_id: str,
    request: AdGroupUpdateRequest,
    db: Session = Depends(get_db)
):
    """Update an ad group on a platform."""
    
    try:
        # Get platform client
        client = _get_platform_client(platform)
        if not client:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported platform: {platform}"
            )
        
        # Update ad group
        result = await client.update_ad_group(ad_group_id, request.updates)
        
        return AdGroupUpdateResponse(
            success=result["success"],
            platform=platform,
            ad_group_id=ad_group_id,
            data=result.get("data", {})
        )
        
    except Exception as e:
        logger.error(f"Error updating ad group {ad_group_id} on {platform}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update ad group on {platform}: {str(e)}"
        )


@router.get("/adgroup/get/{platform}/{ad_group_id}", response_model=AdGroupGetResponse)
async def get_ad_group(
    platform: str,
    ad_group_id: str,
    db: Session = Depends(get_db)
):
    """Get ad group details from a platform."""
    
    try:
        # Get platform client
        client = _get_platform_client(platform)
        if not client:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported platform: {platform}"
            )
        
        # Get ad group
        result = await client.get_ad_group(ad_group_id)
        
        return AdGroupGetResponse(
            success=result["success"],
            platform=platform,
            ad_group_id=ad_group_id,
            data=result.get("data", {})
        )
        
    except Exception as e:
        logger.error(f"Error getting ad group {ad_group_id} from {platform}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get ad group from {platform}: {str(e)}"
        )


@router.post("/creative/create/{platform}", response_model=CreativeCreateResponse)
async def create_creative(
    platform: str,
    request: CreativeCreateRequest,
    db: Session = Depends(get_db)
):
    """Create an ad creative on a platform."""
    
    try:
        # Get platform client
        client = _get_platform_client(platform)
        if not client:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported platform: {platform}"
            )
        
        # Create creative
        result = await client.create_ad_creative(request.creative_data)
        
        return CreativeCreateResponse(
            success=result["success"],
            platform=platform,
            creative_id=result.get("creative_id"),
            data=result.get("data", {})
        )
        
    except Exception as e:
        logger.error(f"Error creating creative on {platform}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create creative on {platform}: {str(e)}"
        )


@router.put("/creative/update/{platform}/{creative_id}", response_model=CreativeUpdateResponse)
async def update_creative(
    platform: str,
    creative_id: str,
    request: CreativeUpdateRequest,
    db: Session = Depends(get_db)
):
    """Update an ad creative on a platform."""
    
    try:
        # Get platform client
        client = _get_platform_client(platform)
        if not client:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported platform: {platform}"
            )
        
        # Update creative
        result = await client.update_ad_creative(creative_id, request.updates)
        
        return CreativeUpdateResponse(
            success=result["success"],
            platform=platform,
            creative_id=creative_id,
            data=result.get("data", {})
        )
        
    except Exception as e:
        logger.error(f"Error updating creative {creative_id} on {platform}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update creative on {platform}: {str(e)}"
        )


@router.get("/creative/get/{platform}/{creative_id}", response_model=CreativeGetResponse)
async def get_creative(
    platform: str,
    creative_id: str,
    db: Session = Depends(get_db)
):
    """Get ad creative details from a platform."""
    
    try:
        # Get platform client
        client = _get_platform_client(platform)
        if not client:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported platform: {platform}"
            )
        
        # Get creative
        result = await client.get_ad_creative(creative_id)
        
        return CreativeGetResponse(
            success=result["success"],
            platform=platform,
            creative_id=creative_id,
            data=result.get("data", {})
        )
        
    except Exception as e:
        logger.error(f"Error getting creative {creative_id} from {platform}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get creative from {platform}: {str(e)}"
        )


@router.get("/performance/{platform}/{entity_type}/{entity_id}", response_model=PerformanceResponse)
async def get_performance(
    platform: str,
    entity_type: str,
    entity_id: str,
    request: PerformanceRequest,
    db: Session = Depends(get_db)
):
    """Get performance data from a platform."""
    
    try:
        # Get platform client
        client = _get_platform_client(platform)
        if not client:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported platform: {platform}"
            )
        
        # Get performance data
        if entity_type == "campaign":
            result = await client.get_campaign_performance(entity_id, request.date_range)
        elif entity_type == "adgroup":
            result = await client.get_ad_group_performance(entity_id, request.date_range)
        elif entity_type == "creative":
            result = await client.get_creative_performance(entity_id, request.date_range)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported entity type: {entity_type}"
            )
        
        return PerformanceResponse(
            success=result["success"],
            platform=platform,
            entity_type=entity_type,
            entity_id=entity_id,
            data=result.get("data", {})
        )
        
    except Exception as e:
        logger.error(f"Error getting performance data from {platform}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get performance data from {platform}: {str(e)}"
        )


@router.get("/health/{platform}")
async def health_check(platform: str):
    """Health check for a platform."""
    
    try:
        # Get platform client
        client = _get_platform_client(platform)
        if not client:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported platform: {platform}"
            )
        
        # Check health
        health = await client.health_check()
        
        return health
        
    except Exception as e:
        logger.error(f"Error checking health for {platform}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check health for {platform}: {str(e)}"
        )


def _get_platform_client(platform: str):
    """Get platform client based on platform name."""
    
    if platform.lower() == "meta":
        return MetaAdsClient()
    elif platform.lower() == "google":
        return GoogleAdsClient()
    elif platform.lower() == "tiktok":
        return TikTokAdsClient()
    else:
        return None



