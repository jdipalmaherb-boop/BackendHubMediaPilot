"""
Pydantic schemas for integrations functionality.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class OAuthConnectionRequest(BaseModel):
    """Request schema for OAuth connection."""
    
    state: Optional[str] = Field(None, description="State parameter for CSRF protection")
    scopes: Optional[List[str]] = Field(None, description="Requested OAuth scopes")


class OAuthConnectionResponse(BaseModel):
    """Response schema for OAuth connection."""
    
    success: bool = Field(..., description="Whether connection was successful")
    url: str = Field(..., description="OAuth authorization URL")
    state: str = Field(..., description="State parameter for CSRF protection")
    scopes: List[str] = Field(..., description="Requested OAuth scopes")
    expires_in: int = Field(3600, description="Authorization URL expiration time in seconds")


class OAuthCallbackRequest(BaseModel):
    """Request schema for OAuth callback."""
    
    code: str = Field(..., description="Authorization code from OAuth provider")
    state: str = Field(..., description="State parameter from OAuth provider")
    stored_state: Optional[str] = Field(None, description="Previously stored state for validation")


class OAuthCallbackResponse(BaseModel):
    """Response schema for OAuth callback."""
    
    success: bool = Field(..., description="Whether callback was successful")
    status: str = Field(..., description="Connection status")
    access_token: str = Field(..., description="Access token")
    refresh_token: Optional[str] = Field(None, description="Refresh token")
    expires_at: str = Field(..., description="Token expiration time")
    scopes: List[str] = Field(..., description="Granted OAuth scopes")
    connected_at: str = Field(..., description="When the connection was established")


class TokenRefreshRequest(BaseModel):
    """Request schema for token refresh."""
    
    refresh_token: str = Field(..., description="Refresh token")


class TokenRefreshResponse(BaseModel):
    """Response schema for token refresh."""
    
    success: bool = Field(..., description="Whether refresh was successful")
    access_token: str = Field(..., description="New access token")
    refresh_token: Optional[str] = Field(None, description="New refresh token")
    expires_at: str = Field(..., description="New token expiration time")
    refreshed_at: str = Field(..., description="When the token was refreshed")


class TokenValidationRequest(BaseModel):
    """Request schema for token validation."""
    
    access_token: str = Field(..., description="Access token to validate")


class TokenValidationResponse(BaseModel):
    """Response schema for token validation."""
    
    success: bool = Field(..., description="Whether validation was successful")
    valid: bool = Field(..., description="Whether token is valid")
    user: Optional[Dict[str, Any]] = Field(None, description="User information if token is valid")
    message: str = Field(..., description="Validation message")


class TokenRevocationRequest(BaseModel):
    """Request schema for token revocation."""
    
    access_token: str = Field(..., description="Access token to revoke")


class TokenRevocationResponse(BaseModel):
    """Response schema for token revocation."""
    
    success: bool = Field(..., description="Whether revocation was successful")
    status: str = Field(..., description="Revocation status")
    message: str = Field(..., description="Revocation message")


# GoHighLevel specific schemas

class GHLContact(BaseModel):
    """Schema for GoHighLevel contact."""
    
    id: Optional[str] = Field(None, description="Contact ID")
    firstName: str = Field(..., description="First name")
    lastName: str = Field(..., description="Last name")
    email: str = Field(..., description="Email address")
    phone: Optional[str] = Field(None, description="Phone number")
    locationId: Optional[str] = Field(None, description="Location ID")
    tags: Optional[List[str]] = Field(None, description="Contact tags")
    customFields: Optional[Dict[str, Any]] = Field(None, description="Custom fields")
    source: Optional[str] = Field(None, description="Contact source")
    assignedTo: Optional[str] = Field(None, description="Assigned user ID")
    createdAt: Optional[str] = Field(None, description="Creation timestamp")
    updatedAt: Optional[str] = Field(None, description="Last update timestamp")


class GHLContactCreateRequest(BaseModel):
    """Request schema for creating GoHighLevel contact."""
    
    firstName: str = Field(..., description="First name")
    lastName: str = Field(..., description="Last name")
    email: str = Field(..., description="Email address")
    phone: Optional[str] = Field(None, description="Phone number")
    tags: Optional[List[str]] = Field(None, description="Contact tags")
    customFields: Optional[Dict[str, Any]] = Field(None, description="Custom fields")
    source: Optional[str] = Field(None, description="Contact source")
    assignedTo: Optional[str] = Field(None, description="Assigned user ID")


class GHLContactUpdateRequest(BaseModel):
    """Request schema for updating GoHighLevel contact."""
    
    firstName: Optional[str] = Field(None, description="First name")
    lastName: Optional[str] = Field(None, description="Last name")
    email: Optional[str] = Field(None, description="Email address")
    phone: Optional[str] = Field(None, description="Phone number")
    tags: Optional[List[str]] = Field(None, description="Contact tags")
    customFields: Optional[Dict[str, Any]] = Field(None, description="Custom fields")
    assignedTo: Optional[str] = Field(None, description="Assigned user ID")


class GHLAppointment(BaseModel):
    """Schema for GoHighLevel appointment."""
    
    id: Optional[str] = Field(None, description="Appointment ID")
    title: str = Field(..., description="Appointment title")
    description: Optional[str] = Field(None, description="Appointment description")
    startTime: str = Field(..., description="Start time")
    endTime: str = Field(..., description="End time")
    contactId: str = Field(..., description="Contact ID")
    calendarId: Optional[str] = Field(None, description="Calendar ID")
    locationId: Optional[str] = Field(None, description="Location ID")
    status: Optional[str] = Field("scheduled", description="Appointment status")
    notes: Optional[str] = Field(None, description="Appointment notes")
    createdAt: Optional[str] = Field(None, description="Creation timestamp")
    updatedAt: Optional[str] = Field(None, description="Last update timestamp")


class GHLAppointmentCreateRequest(BaseModel):
    """Request schema for creating GoHighLevel appointment."""
    
    title: str = Field(..., description="Appointment title")
    description: Optional[str] = Field(None, description="Appointment description")
    startTime: str = Field(..., description="Start time")
    endTime: str = Field(..., description="End time")
    contactId: str = Field(..., description="Contact ID")
    calendarId: Optional[str] = Field(None, description="Calendar ID")
    status: Optional[str] = Field("scheduled", description="Appointment status")
    notes: Optional[str] = Field(None, description="Appointment notes")


class GHLAppointmentUpdateRequest(BaseModel):
    """Request schema for updating GoHighLevel appointment."""
    
    title: Optional[str] = Field(None, description="Appointment title")
    description: Optional[str] = Field(None, description="Appointment description")
    startTime: Optional[str] = Field(None, description="Start time")
    endTime: Optional[str] = Field(None, description="End time")
    status: Optional[str] = Field(None, description="Appointment status")
    notes: Optional[str] = Field(None, description="Appointment notes")


class GHLCampaign(BaseModel):
    """Schema for GoHighLevel campaign."""
    
    id: Optional[str] = Field(None, description="Campaign ID")
    name: str = Field(..., description="Campaign name")
    description: Optional[str] = Field(None, description="Campaign description")
    type: str = Field(..., description="Campaign type")
    status: Optional[str] = Field("draft", description="Campaign status")
    locationId: Optional[str] = Field(None, description="Location ID")
    createdAt: Optional[str] = Field(None, description="Creation timestamp")
    updatedAt: Optional[str] = Field(None, description="Last update timestamp")


class GHLCampaignCreateRequest(BaseModel):
    """Request schema for creating GoHighLevel campaign."""
    
    name: str = Field(..., description="Campaign name")
    description: Optional[str] = Field(None, description="Campaign description")
    type: str = Field(..., description="Campaign type")
    status: Optional[str] = Field("draft", description="Campaign status")


class GHLOpportunity(BaseModel):
    """Schema for GoHighLevel opportunity."""
    
    id: Optional[str] = Field(None, description="Opportunity ID")
    name: str = Field(..., description="Opportunity name")
    contactId: str = Field(..., description="Contact ID")
    pipelineId: Optional[str] = Field(None, description="Pipeline ID")
    stageId: Optional[str] = Field(None, description="Stage ID")
    value: Optional[float] = Field(None, description="Opportunity value")
    status: Optional[str] = Field("open", description="Opportunity status")
    locationId: Optional[str] = Field(None, description="Location ID")
    createdAt: Optional[str] = Field(None, description="Creation timestamp")
    updatedAt: Optional[str] = Field(None, description="Last update timestamp")


class GHLOpportunityCreateRequest(BaseModel):
    """Request schema for creating GoHighLevel opportunity."""
    
    name: str = Field(..., description="Opportunity name")
    contactId: str = Field(..., description="Contact ID")
    pipelineId: Optional[str] = Field(None, description="Pipeline ID")
    stageId: Optional[str] = Field(None, description="Stage ID")
    value: Optional[float] = Field(None, description="Opportunity value")
    status: Optional[str] = Field("open", description="Opportunity status")


class GHLTask(BaseModel):
    """Schema for GoHighLevel task."""
    
    id: Optional[str] = Field(None, description="Task ID")
    title: str = Field(..., description="Task title")
    description: Optional[str] = Field(None, description="Task description")
    contactId: Optional[str] = Field(None, description="Contact ID")
    assignedTo: Optional[str] = Field(None, description="Assigned user ID")
    dueDate: Optional[str] = Field(None, description="Due date")
    status: Optional[str] = Field("pending", description="Task status")
    priority: Optional[str] = Field("medium", description="Task priority")
    locationId: Optional[str] = Field(None, description="Location ID")
    createdAt: Optional[str] = Field(None, description="Creation timestamp")
    updatedAt: Optional[str] = Field(None, description="Last update timestamp")


class GHLTaskCreateRequest(BaseModel):
    """Request schema for creating GoHighLevel task."""
    
    title: str = Field(..., description="Task title")
    description: Optional[str] = Field(None, description="Task description")
    contactId: Optional[str] = Field(None, description="Contact ID")
    assignedTo: Optional[str] = Field(None, description="Assigned user ID")
    dueDate: Optional[str] = Field(None, description="Due date")
    priority: Optional[str] = Field("medium", description="Task priority")


class GHLProduct(BaseModel):
    """Schema for GoHighLevel product."""
    
    id: Optional[str] = Field(None, description="Product ID")
    name: str = Field(..., description="Product name")
    description: Optional[str] = Field(None, description="Product description")
    price: Optional[float] = Field(None, description="Product price")
    category: Optional[str] = Field(None, description="Product category")
    status: Optional[str] = Field("active", description="Product status")
    locationId: Optional[str] = Field(None, description="Location ID")
    createdAt: Optional[str] = Field(None, description="Creation timestamp")
    updatedAt: Optional[str] = Field(None, description="Last update timestamp")


class GHLProductCreateRequest(BaseModel):
    """Request schema for creating GoHighLevel product."""
    
    name: str = Field(..., description="Product name")
    description: Optional[str] = Field(None, description="Product description")
    price: Optional[float] = Field(None, description="Product price")
    category: Optional[str] = Field(None, description="Product category")
    status: Optional[str] = Field("active", description="Product status")


class GHLConversation(BaseModel):
    """Schema for GoHighLevel conversation."""
    
    id: Optional[str] = Field(None, description="Conversation ID")
    contactId: str = Field(..., description="Contact ID")
    type: str = Field(..., description="Conversation type")
    status: Optional[str] = Field("active", description="Conversation status")
    locationId: Optional[str] = Field(None, description="Location ID")
    createdAt: Optional[str] = Field(None, description="Creation timestamp")
    updatedAt: Optional[str] = Field(None, description="Last update timestamp")


class GHLMessage(BaseModel):
    """Schema for GoHighLevel message."""
    
    id: Optional[str] = Field(None, description="Message ID")
    conversationId: str = Field(..., description="Conversation ID")
    content: str = Field(..., description="Message content")
    type: str = Field(..., description="Message type")
    direction: str = Field(..., description="Message direction")
    createdAt: Optional[str] = Field(None, description="Creation timestamp")


class GHLMessageCreateRequest(BaseModel):
    """Request schema for creating GoHighLevel message."""
    
    content: str = Field(..., description="Message content")
    type: Optional[str] = Field("text", description="Message type")


class GHLIntegrationStatus(BaseModel):
    """Schema for integration status."""
    
    provider: str = Field(..., description="Integration provider")
    connected: bool = Field(..., description="Whether integration is connected")
    connected_at: Optional[str] = Field(None, description="When integration was connected")
    last_sync: Optional[str] = Field(None, description="Last sync timestamp")
    scopes: List[str] = Field(..., description="Granted OAuth scopes")
    status: str = Field(..., description="Integration status")
    error: Optional[str] = Field(None, description="Error message if any")


class GHLSyncRequest(BaseModel):
    """Request schema for data synchronization."""
    
    data_type: str = Field(..., description="Type of data to sync")
    start_date: Optional[str] = Field(None, description="Start date for sync")
    end_date: Optional[str] = Field(None, description="End date for sync")
    force: bool = Field(False, description="Force full sync")


class GHLSyncResponse(BaseModel):
    """Response schema for data synchronization."""
    
    success: bool = Field(..., description="Whether sync was successful")
    data_type: str = Field(..., description="Type of data synced")
    records_synced: int = Field(..., description="Number of records synced")
    sync_duration: float = Field(..., description="Sync duration in seconds")
    errors: List[str] = Field(..., description="Sync errors if any")
    synced_at: str = Field(..., description="When sync was completed")


class GHLWebhookRequest(BaseModel):
    """Request schema for GoHighLevel webhook."""
    
    event: str = Field(..., description="Webhook event type")
    data: Dict[str, Any] = Field(..., description="Webhook data")
    timestamp: str = Field(..., description="Webhook timestamp")
    signature: Optional[str] = Field(None, description="Webhook signature for verification")


class GHLWebhookResponse(BaseModel):
    """Response schema for GoHighLevel webhook."""
    
    success: bool = Field(..., description="Whether webhook was processed successfully")
    message: str = Field(..., description="Processing message")
    processed_at: str = Field(..., description="When webhook was processed")



