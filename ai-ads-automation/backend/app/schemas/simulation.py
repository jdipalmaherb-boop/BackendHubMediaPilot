"""
Pydantic schemas for simulation services.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime

from pydantic import BaseModel, Field


class CampaignSimulationRequest(BaseModel):
    """Request schema for campaign simulation."""
    
    campaign_config: Dict[str, Any] = Field(..., description="Configuration for the campaign simulation")
    optimization_config: Dict[str, Any] = Field(..., description="Configuration for the optimization simulation")


class CampaignSimulationResponse(BaseModel):
    """Response schema for campaign simulation."""
    
    success: bool = Field(..., description="Whether the request was successful")
    campaign_id: str = Field(..., description="ID of the campaign simulated")
    result: Dict[str, Any] = Field(..., description="Result of the simulation")


class AudienceSimulationRequest(BaseModel):
    """Request schema for audience simulation."""
    
    audience_config: Dict[str, Any] = Field(..., description="Configuration for the audience simulation")


class AudienceSimulationResponse(BaseModel):
    """Response schema for audience simulation."""
    
    success: bool = Field(..., description="Whether the request was successful")
    audience_id: str = Field(..., description="ID of the audience simulated")
    result: Dict[str, Any] = Field(..., description="Result of the simulation")


class CreativeSimulationRequest(BaseModel):
    """Request schema for creative simulation."""
    
    creative_config: Dict[str, Any] = Field(..., description="Configuration for the creative simulation")


class CreativeSimulationResponse(BaseModel):
    """Response schema for creative simulation."""
    
    success: bool = Field(..., description="Whether the request was successful")
    creative_id: str = Field(..., description="ID of the creative simulated")
    result: Dict[str, Any] = Field(..., description="Result of the simulation")



