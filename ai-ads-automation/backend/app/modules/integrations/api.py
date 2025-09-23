"""
FastAPI routes for integrations services.
"""

from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from fastapi.responses import RedirectResponse

from app.core.logging import logger
from app.modules.integrations.gohighlevel_oauth import get_ghl_oauth, GoHighLevelOAuth
from app.modules.integrations.gohighlevel_client import GoHighLevelClient
from app.schemas.integrations import (
    OAuthConnectionRequest, OAuthConnectionResponse,
    OAuthCallbackRequest, OAuthCallbackResponse,
    TokenRefreshRequest, TokenRefreshResponse,
    TokenValidationRequest, TokenValidationResponse,
    TokenRevocationRequest, TokenRevocationResponse,
    GHLContact, GHLContactCreateRequest, GHLContactUpdateRequest,
    GHLAppointment, GHLAppointmentCreateRequest, GHLAppointmentUpdateRequest,
    GHLTask, GHLTaskCreateRequest,
    GHLProduct, GHLProductCreateRequest,
    GHLConversation, GHLMessage, GHLMessageCreateRequest,
    GHLIntegrationStatus, GHLSyncRequest, GHLSyncResponse,
    GHLWebhookRequest, GHLWebhookResponse
)

router = APIRouter()


# OAuth Endpoints

@router.get("/gohighlevel/connect", response_model=OAuthConnectionResponse)
async def ghl_connect(
    state: Optional[str] = Query(None, description="State parameter for CSRF protection"),
    oauth: GoHighLevelOAuth = Depends(get_ghl_oauth)
):
    """Connect to GoHighLevel OAuth."""
    logger.info("Initiating GoHighLevel OAuth connection")
    
    try:
        auth_data = oauth.generate_auth_url(state)
        
        return OAuthConnectionResponse(
            success=True,
            url=auth_data["url"],
            state=auth_data["state"],
            scopes=auth_data["scopes"],
            expires_in=3600
        )
    except Exception as e:
        logger.error(f"Error generating GoHighLevel auth URL: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate auth URL: {e}"
        )


@router.get("/gohighlevel/callback", response_model=OAuthCallbackResponse)
async def ghl_callback(
    code: str = Query(..., description="Authorization code"),
    state: str = Query(..., description="State parameter"),
    stored_state: Optional[str] = Query(None, description="Stored state for validation"),
    oauth: GoHighLevelOAuth = Depends(get_ghl_oauth)
):
    """Handle GoHighLevel OAuth callback."""
    logger.info("Processing GoHighLevel OAuth callback")
    
    try:
        token_data = oauth.exchange_code_for_token(code, state, stored_state)
        
        return OAuthCallbackResponse(
            success=True,
            status=token_data["status"],
            access_token=token_data["data"]["access_token"],
            refresh_token=token_data["data"].get("refresh_token"),
            expires_at=token_data["expires_at"],
            scopes=token_data["scopes"],
            connected_at=token_data["data"]["connected_at"]
        )
    except Exception as e:
        logger.error(f"Error processing GoHighLevel callback: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to process callback: {e}"
        )


@router.post("/gohighlevel/refresh", response_model=TokenRefreshResponse)
async def ghl_refresh_token(
    request: TokenRefreshRequest,
    oauth: GoHighLevelOAuth = Depends(get_ghl_oauth)
):
    """Refresh GoHighLevel access token."""
    logger.info("Refreshing GoHighLevel access token")
    
    try:
        token_data = oauth.refresh_access_token(request.refresh_token)
        
        return TokenRefreshResponse(
            success=True,
            access_token=token_data["data"]["access_token"],
            refresh_token=token_data["data"].get("refresh_token"),
            expires_at=token_data["expires_at"],
            refreshed_at=token_data["data"]["refreshed_at"]
        )
    except Exception as e:
        logger.error(f"Error refreshing GoHighLevel token: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to refresh token: {e}"
        )


@router.post("/gohighlevel/validate", response_model=TokenValidationResponse)
async def ghl_validate_token(
    request: TokenValidationRequest,
    oauth: GoHighLevelOAuth = Depends(get_ghl_oauth)
):
    """Validate GoHighLevel access token."""
    logger.info("Validating GoHighLevel access token")
    
    try:
        validation_result = oauth.validate_token(request.access_token)
        
        return TokenValidationResponse(
            success=True,
            valid=validation_result["valid"],
            user=validation_result.get("user"),
            message=validation_result["message"]
        )
    except Exception as e:
        logger.error(f"Error validating GoHighLevel token: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to validate token: {e}"
        )


@router.post("/gohighlevel/revoke", response_model=TokenRevocationResponse)
async def ghl_revoke_token(
    request: TokenRevocationRequest,
    oauth: GoHighLevelOAuth = Depends(get_ghl_oauth)
):
    """Revoke GoHighLevel access token."""
    logger.info("Revoking GoHighLevel access token")
    
    try:
        revocation_result = oauth.revoke_token(request.access_token)
        
        return TokenRevocationResponse(
            success=True,
            status=revocation_result["status"],
            message=revocation_result["message"]
        )
    except Exception as e:
        logger.error(f"Error revoking GoHighLevel token: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to revoke token: {e}"
        )


# GoHighLevel API Endpoints

def get_ghl_client(access_token: str = Query(..., description="GoHighLevel access token")) -> GoHighLevelClient:
    """Dependency to get GoHighLevel API client."""
    return GoHighLevelClient(access_token)


# Contact Management

@router.get("/gohighlevel/contacts", response_model=Dict[str, Any])
async def get_ghl_contacts(
    limit: int = Query(100, description="Number of contacts to return"),
    offset: int = Query(0, description="Number of contacts to skip"),
    query: Optional[str] = Query(None, description="Search query"),
    tags: Optional[str] = Query(None, description="Comma-separated tags"),
    client: GoHighLevelClient = Depends(get_ghl_client)
):
    """Get contacts from GoHighLevel."""
    logger.info("Fetching GoHighLevel contacts")
    
    try:
        tag_list = tags.split(",") if tags else None
        contacts = client.get_contacts(limit=limit, offset=offset, query=query, tags=tag_list)
        return contacts
    except Exception as e:
        logger.error(f"Error fetching GoHighLevel contacts: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch contacts: {e}"
        )


@router.post("/gohighlevel/contacts/ai-create", response_model=Dict[str, Any])
async def create_ghl_contact_ai(
    contact_payload: Dict[str, Any],
    access_token: str = Query(..., description="GoHighLevel access token"),
    auto_score: bool = Query(True, description="Automatically score the lead"),
    trigger_workflows: bool = Query(True, description="Trigger automated workflows"),
    location_id: Optional[str] = Query(None, description="GoHighLevel location ID")
):
    """Create GoHighLevel contact with AI-powered features."""
    logger.info("Creating GoHighLevel contact with AI features")
    
    try:
        from app.modules.integrations.contact_manager import ContactManager
        
        manager = ContactManager(access_token, location_id)
        
        result = await manager.create_ghl_contact(
            contact_payload=contact_payload,
            auto_score=auto_score,
            trigger_workflows=trigger_workflows
        )
        
        return result
    except Exception as e:
        logger.error(f"Error creating contact with AI: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create contact with AI: {e}"
        )


@router.post("/gohighlevel/contacts/ai-create-with-scoring", response_model=Dict[str, Any])
async def create_ghl_contact_with_scoring(
    contact_data: Dict[str, Any],
    access_token: str = Query(..., description="GoHighLevel access token"),
    scoring_context: Optional[Dict[str, Any]] = None,
    location_id: Optional[str] = Query(None, description="GoHighLevel location ID")
):
    """Create GoHighLevel contact with comprehensive lead scoring."""
    logger.info("Creating GoHighLevel contact with comprehensive scoring")
    
    try:
        from app.modules.integrations.contact_manager import ContactManager
        
        manager = ContactManager(access_token, location_id)
        
        result = await manager.create_contact_with_scoring(
            contact_data=contact_data,
            scoring_context=scoring_context
        )
        
        return result
    except Exception as e:
        logger.error(f"Error creating contact with scoring: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create contact with scoring: {e}"
        )


@router.post("/gohighlevel/contacts/batch-create", response_model=Dict[str, Any])
async def batch_create_ghl_contacts(
    contacts_data: List[Dict[str, Any]],
    access_token: str = Query(..., description="GoHighLevel access token"),
    auto_score: bool = Query(True, description="Automatically score each lead"),
    trigger_workflows: bool = Query(True, description="Trigger automated workflows"),
    location_id: Optional[str] = Query(None, description="GoHighLevel location ID")
):
    """Create multiple GoHighLevel contacts in batch with AI processing."""
    logger.info(f"Batch creating {len(contacts_data)} GoHighLevel contacts")
    
    try:
        from app.modules.integrations.contact_manager import ContactManager
        
        manager = ContactManager(access_token, location_id)
        
        result = await manager.batch_create_contacts(
            contacts_data=contacts_data,
            auto_score=auto_score,
            trigger_workflows=trigger_workflows
        )
        
        return result
    except Exception as e:
        logger.error(f"Error batch creating contacts: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to batch create contacts: {e}"
        )


@router.get("/gohighlevel/contacts/{contact_id}/ai-analysis", response_model=Dict[str, Any])
async def get_contact_ai_analysis(
    contact_id: str,
    access_token: str = Query(..., description="GoHighLevel access token"),
    location_id: Optional[str] = Query(None, description="GoHighLevel location ID")
):
    """Get comprehensive AI analysis for an existing contact."""
    logger.info(f"Getting AI analysis for contact {contact_id}")
    
    try:
        from app.modules.integrations.contact_manager import ContactManager
        
        manager = ContactManager(access_token, location_id)
        
        result = await manager.get_contact_ai_analysis(contact_id)
        
        return result
    except Exception as e:
        logger.error(f"Error getting contact AI analysis: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get contact AI analysis: {e}"
        )


@router.post("/gohighlevel/contacts/{contact_id}/update-ai-insights", response_model=Dict[str, Any])
async def update_contact_ai_insights(
    contact_id: str,
    insights: Dict[str, Any],
    access_token: str = Query(..., description="GoHighLevel access token"),
    location_id: Optional[str] = Query(None, description="GoHighLevel location ID")
):
    """Update contact with AI-generated insights and recommendations."""
    logger.info(f"Updating contact {contact_id} with AI insights")
    
    try:
        from app.modules.integrations.contact_manager import ContactManager
        
        manager = ContactManager(access_token, location_id)
        
        result = await manager.update_contact_with_ai_insights(contact_id, insights)
        
        return result
    except Exception as e:
        logger.error(f"Error updating contact with AI insights: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update contact with AI insights: {e}"
        )


@router.get("/gohighlevel/contacts/{contact_id}", response_model=Dict[str, Any])
async def get_ghl_contact(
    contact_id: str,
    client: GoHighLevelClient = Depends(get_ghl_client)
):
    """Get specific contact from GoHighLevel."""
    logger.info(f"Fetching GoHighLevel contact {contact_id}")
    
    try:
        contact = client.get_contact(contact_id)
        return contact
    except Exception as e:
        logger.error(f"Error fetching GoHighLevel contact: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch contact: {e}"
        )


@router.post("/gohighlevel/contacts", response_model=Dict[str, Any])
async def create_ghl_contact(
    contact: GHLContactCreateRequest,
    client: GoHighLevelClient = Depends(get_ghl_client)
):
    """Create contact in GoHighLevel."""
    logger.info("Creating GoHighLevel contact")
    
    try:
        contact_data = contact.dict()
        new_contact = client.create_contact(contact_data)
        return new_contact
    except Exception as e:
        logger.error(f"Error creating GoHighLevel contact: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create contact: {e}"
        )


@router.put("/gohighlevel/contacts/{contact_id}", response_model=Dict[str, Any])
async def update_ghl_contact(
    contact_id: str,
    contact: GHLContactUpdateRequest,
    client: GoHighLevelClient = Depends(get_ghl_client)
):
    """Update contact in GoHighLevel."""
    logger.info(f"Updating GoHighLevel contact {contact_id}")
    
    try:
        contact_data = contact.dict(exclude_unset=True)
        updated_contact = client.update_contact(contact_id, contact_data)
        return updated_contact
    except Exception as e:
        logger.error(f"Error updating GoHighLevel contact: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update contact: {e}"
        )


@router.delete("/gohighlevel/contacts/{contact_id}")
async def delete_ghl_contact(
    contact_id: str,
    client: GoHighLevelClient = Depends(get_ghl_client)
):
    """Delete contact from GoHighLevel."""
    logger.info(f"Deleting GoHighLevel contact {contact_id}")
    
    try:
        result = client.delete_contact(contact_id)
        return {"success": True, "message": "Contact deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting GoHighLevel contact: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete contact: {e}"
        )


# Appointment Management

@router.get("/gohighlevel/appointments", response_model=Dict[str, Any])
async def get_ghl_appointments(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    contact_id: Optional[str] = Query(None, description="Contact ID filter"),
    calendar_id: Optional[str] = Query(None, description="Calendar ID filter"),
    client: GoHighLevelClient = Depends(get_ghl_client)
):
    """Get appointments from GoHighLevel."""
    logger.info("Fetching GoHighLevel appointments")
    
    try:
        appointments = client.get_appointments(
            start_date=start_date,
            end_date=end_date,
            contact_id=contact_id,
            calendar_id=calendar_id
        )
        return appointments
    except Exception as e:
        logger.error(f"Error fetching GoHighLevel appointments: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch appointments: {e}"
        )


@router.post("/gohighlevel/appointments", response_model=Dict[str, Any])
async def create_ghl_appointment(
    appointment: GHLAppointmentCreateRequest,
    client: GoHighLevelClient = Depends(get_ghl_client)
):
    """Create appointment in GoHighLevel."""
    logger.info("Creating GoHighLevel appointment")
    
    try:
        appointment_data = appointment.dict()
        new_appointment = client.create_appointment(appointment_data)
        return new_appointment
    except Exception as e:
        logger.error(f"Error creating GoHighLevel appointment: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create appointment: {e}"
        )


# Campaign Management

@router.get("/gohighlevel/campaigns", response_model=Dict[str, Any])
async def get_ghl_campaigns(
    limit: int = Query(100, description="Number of campaigns to return"),
    offset: int = Query(0, description="Number of campaigns to skip"),
    client: GoHighLevelClient = Depends(get_ghl_client)
):
    """Get campaigns from GoHighLevel."""
    logger.info("Fetching GoHighLevel campaigns")
    
    try:
        campaigns = client.get_campaigns(limit=limit, offset=offset)
        return campaigns
    except Exception as e:
        logger.error(f"Error fetching GoHighLevel campaigns: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch campaigns: {e}"
        )


@router.post("/gohighlevel/campaigns", response_model=Dict[str, Any])
async def create_ghl_campaign(
    campaign: GHLCampaignCreateRequest,
    client: GoHighLevelClient = Depends(get_ghl_client)
):
    """Create campaign in GoHighLevel."""
    logger.info("Creating GoHighLevel campaign")
    
    try:
        campaign_data = campaign.dict()
        new_campaign = client.create_campaign(campaign_data)
        return new_campaign
    except Exception as e:
        logger.error(f"Error creating GoHighLevel campaign: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create campaign: {e}"
        )


# Task Management

@router.get("/gohighlevel/tasks", response_model=Dict[str, Any])
async def get_ghl_tasks(
    contact_id: Optional[str] = Query(None, description="Contact ID filter"),
    user_id: Optional[str] = Query(None, description="User ID filter"),
    limit: int = Query(100, description="Number of tasks to return"),
    offset: int = Query(0, description="Number of tasks to skip"),
    client: GoHighLevelClient = Depends(get_ghl_client)
):
    """Get tasks from GoHighLevel."""
    logger.info("Fetching GoHighLevel tasks")
    
    try:
        tasks = client.get_tasks(
            contact_id=contact_id,
            user_id=user_id,
            limit=limit,
            offset=offset
        )
        return tasks
    except Exception as e:
        logger.error(f"Error fetching GoHighLevel tasks: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch tasks: {e}"
        )


@router.post("/gohighlevel/tasks", response_model=Dict[str, Any])
async def create_ghl_task(
    task: GHLTaskCreateRequest,
    client: GoHighLevelClient = Depends(get_ghl_client)
):
    """Create task in GoHighLevel."""
    logger.info("Creating GoHighLevel task")
    
    try:
        task_data = task.dict()
        new_task = client.create_task(task_data)
        return new_task
    except Exception as e:
        logger.error(f"Error creating GoHighLevel task: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create task: {e}"
        )


# Integration Status

@router.get("/gohighlevel/status", response_model=GHLIntegrationStatus)
async def get_ghl_status(
    access_token: str = Query(..., description="GoHighLevel access token")
):
    """Get GoHighLevel integration status."""
    logger.info("Checking GoHighLevel integration status")
    
    try:
        client = GoHighLevelClient(access_token)
        user_info = client.get_current_user()
        
        return GHLIntegrationStatus(
            provider="gohighlevel",
            connected=True,
            connected_at="2023-10-27T10:00:00Z",  # This would come from stored data
            last_sync="2023-10-27T10:00:00Z",  # This would come from stored data
            scopes=["contacts", "appointments", "campaigns"],
            status="active",
            error=None
        )
    except Exception as e:
        logger.error(f"Error checking GoHighLevel status: {e}", exc_info=True)
        return GHLIntegrationStatus(
            provider="gohighlevel",
            connected=False,
            connected_at=None,
            last_sync=None,
            scopes=[],
            status="error",
            error=str(e)
        )


# Webhook Endpoints

@router.post("/webhooks/gohighlevel")
async def ghl_webhook(payload: dict):
    """Handle GoHighLevel webhooks with AI-powered processing."""
    logger.info("Processing GoHighLevel webhook")
    
    try:
        from app.modules.integrations.webhook_processor import WebhookProcessor
        
        processor = WebhookProcessor()
        
        # Extract event type and data from payload
        event_type = payload.get("eventType")
        data = payload.get("data", {})
        signature = payload.get("signature")
        
        if not event_type:
            raise ValueError("Missing eventType in webhook payload")
        
        # Process the webhook
        result = await processor.process_webhook(
            event_type=event_type,
            data=data,
            source="gohighlevel",
            signature=signature
        )
        
        return {
            "status": "ok",
            "result": result
        }
    except Exception as e:
        logger.error(f"Error processing GoHighLevel webhook: {e}", exc_info=True)
        return {
            "status": "error",
            "error": str(e)
        }


@router.post("/gohighlevel/webhook", response_model=GHLWebhookResponse)
async def ghl_webhook_structured(
    request: GHLWebhookRequest
):
    """Handle GoHighLevel webhooks with structured data."""
    logger.info(f"Processing GoHighLevel webhook: {request.event}")
    
    try:
        from app.modules.integrations.webhook_processor import WebhookProcessor
        
        processor = WebhookProcessor()
        
        # Process the webhook
        result = await processor.process_webhook(
            event_type=request.event,
            data=request.data,
            source="gohighlevel",
            signature=request.signature
        )
        
        return GHLWebhookResponse(
            success=True,
            message=f"Webhook {request.event} processed successfully",
            processed_at=result.get("processed_at", "2023-10-27T10:00:00Z")
        )
    except Exception as e:
        logger.error(f"Error processing GoHighLevel webhook: {e}", exc_info=True)
        return GHLWebhookResponse(
            success=False,
            message=f"Failed to process webhook: {e}",
            processed_at="2023-10-27T10:00:00Z"
        )
