"""
Webhook processor for GoHighLevel and other CRM integrations.
"""

import json
import hashlib
import hmac
from datetime import datetime
from typing import Dict, Any, Optional, List
from enum import Enum

from app.core.logging import logger
from app.modules.integrations.gohighlevel_client import GoHighLevelClient
from app.modules.brand_voice.assistant import BrandVoiceAssistant
from app.modules.analytics.marketing_analyst import MarketingAnalyst
from app.modules.trend_discovery.trend_recipe_generator import TrendRecipeGenerator


class WebhookEventType(Enum):
    """Supported webhook event types."""
    CONTACT_CREATED = "contact.created"
    CONTACT_UPDATED = "contact.updated"
    CONTACT_DELETED = "contact.deleted"
    FORM_SUBMISSION = "form.submission"
    APPOINTMENT_SCHEDULED = "appointment.scheduled"
    APPOINTMENT_CANCELLED = "appointment.cancelled"
    CAMPAIGN_STARTED = "campaign.started"
    CAMPAIGN_STOPPED = "campaign.stopped"
    TASK_CREATED = "task.created"
    TASK_COMPLETED = "task.completed"
    OPPORTUNITY_CREATED = "opportunity.created"
    OPPORTUNITY_UPDATED = "opportunity.updated"
    CONVERSATION_STARTED = "conversation.started"
    MESSAGE_RECEIVED = "message.received"


class WebhookProcessor:
    """Processes webhooks from various CRM integrations."""

    def __init__(self):
        self.brand_voice = BrandVoiceAssistant()
        self.analyst = MarketingAnalyst()
        self.trend_generator = TrendRecipeGenerator()
        logger.info("WebhookProcessor initialized")

    async def process_webhook(
        self,
        event_type: str,
        data: Dict[str, Any],
        source: str = "gohighlevel",
        signature: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Process incoming webhook events.
        
        Args:
            event_type: Type of webhook event
            data: Event data payload
            source: Source system (gohighlevel, hubspot, etc.)
            signature: Webhook signature for verification
            
        Returns:
            Dict containing processing result
        """
        logger.info(f"Processing webhook: {event_type} from {source}")
        
        try:
            # Verify webhook signature if provided
            if signature and not self._verify_signature(data, signature, source):
                raise ValueError("Invalid webhook signature")
            
            # Route to appropriate handler
            if event_type == WebhookEventType.CONTACT_CREATED.value:
                result = await self._handle_contact_created(data, source)
            elif event_type == WebhookEventType.CONTACT_UPDATED.value:
                result = await self._handle_contact_updated(data, source)
            elif event_type == WebhookEventType.FORM_SUBMISSION.value:
                result = await self._handle_form_submission(data, source)
            elif event_type == WebhookEventType.APPOINTMENT_SCHEDULED.value:
                result = await self._handle_appointment_scheduled(data, source)
            elif event_type == WebhookEventType.CAMPAIGN_STARTED.value:
                result = await self._handle_campaign_started(data, source)
            elif event_type == WebhookEventType.TASK_CREATED.value:
                result = await self._handle_task_created(data, source)
            elif event_type == WebhookEventType.OPPORTUNITY_CREATED.value:
                result = await self._handle_opportunity_created(data, source)
            elif event_type == WebhookEventType.CONVERSATION_STARTED.value:
                result = await self._handle_conversation_started(data, source)
            else:
                result = await self._handle_unknown_event(event_type, data, source)
            
            logger.info(f"Webhook processed successfully: {event_type}")
            return {
                "status": "success",
                "event_type": event_type,
                "source": source,
                "processed_at": datetime.utcnow().isoformat(),
                "result": result
            }
            
        except Exception as e:
            logger.error(f"Error processing webhook {event_type}: {e}", exc_info=True)
            return {
                "status": "error",
                "event_type": event_type,
                "source": source,
                "error": str(e),
                "processed_at": datetime.utcnow().isoformat()
            }

    async def _handle_contact_created(
        self, 
        data: Dict[str, Any], 
        source: str
    ) -> Dict[str, Any]:
        """Handle contact creation webhook."""
        logger.info("Processing contact creation")
        
        contact_id = data.get("id")
        contact_info = {
            "id": contact_id,
            "first_name": data.get("firstName", ""),
            "last_name": data.get("lastName", ""),
            "email": data.get("email", ""),
            "phone": data.get("phone", ""),
            "source": data.get("source", "webhook"),
            "tags": data.get("tags", []),
            "custom_fields": data.get("customFields", {}),
            "created_at": datetime.utcnow().isoformat()
        }
        
        # Store contact in local database
        await self._store_contact(contact_info)
        
        # Start onboarding flows
        onboarding_result = await self._start_onboarding_flows(contact_info)
        
        # Generate personalized content
        content_result = await self._generate_personalized_content(contact_info)
        
        # Create follow-up tasks
        tasks_result = await self._create_follow_up_tasks(contact_info)
        
        return {
            "contact_stored": True,
            "onboarding_started": onboarding_result,
            "content_generated": content_result,
            "tasks_created": tasks_result
        }

    async def _handle_contact_updated(
        self, 
        data: Dict[str, Any], 
        source: str
    ) -> Dict[str, Any]:
        """Handle contact update webhook."""
        logger.info("Processing contact update")
        
        contact_id = data.get("id")
        updated_fields = data.get("updatedFields", [])
        
        # Update contact in local database
        await self._update_contact(contact_id, data)
        
        # Check for significant changes that trigger workflows
        workflow_result = await self._trigger_update_workflows(contact_id, updated_fields)
        
        return {
            "contact_updated": True,
            "workflows_triggered": workflow_result
        }

    async def _handle_form_submission(
        self, 
        data: Dict[str, Any], 
        source: str
    ) -> Dict[str, Any]:
        """Handle form submission webhook."""
        logger.info("Processing form submission")
        
        form_data = {
            "form_id": data.get("formId"),
            "form_name": data.get("formName"),
            "contact_id": data.get("contactId"),
            "submission_data": data.get("submissionData", {}),
            "submitted_at": datetime.utcnow().isoformat()
        }
        
        # AI-powered lead scoring
        lead_score = await self._score_lead_ai(form_data)
        
        # Create nurture sequence based on score
        nurture_result = await self._create_nurture_sequence(form_data, lead_score)
        
        # Generate personalized follow-up content
        content_result = await self._generate_form_follow_up(form_data, lead_score)
        
        # Assign to appropriate sales rep
        assignment_result = await self._assign_to_sales_rep(form_data, lead_score)
        
        return {
            "lead_scored": lead_score,
            "nurture_sequence_created": nurture_result,
            "follow_up_content_generated": content_result,
            "sales_rep_assigned": assignment_result
        }

    async def _handle_appointment_scheduled(
        self, 
        data: Dict[str, Any], 
        source: str
    ) -> Dict[str, Any]:
        """Handle appointment scheduling webhook."""
        logger.info("Processing appointment scheduling")
        
        appointment_data = {
            "appointment_id": data.get("id"),
            "contact_id": data.get("contactId"),
            "title": data.get("title"),
            "start_time": data.get("startTime"),
            "end_time": data.get("endTime"),
            "notes": data.get("notes", ""),
            "calendar_id": data.get("calendarId")
        }
        
        # Send confirmation and preparation materials
        confirmation_result = await self._send_appointment_confirmation(appointment_data)
        
        # Create preparation tasks
        prep_result = await self._create_appointment_prep_tasks(appointment_data)
        
        # Generate meeting agenda
        agenda_result = await self._generate_meeting_agenda(appointment_data)
        
        return {
            "confirmation_sent": confirmation_result,
            "prep_tasks_created": prep_result,
            "agenda_generated": agenda_result
        }

    async def _handle_campaign_started(
        self, 
        data: Dict[str, Any], 
        source: str
    ) -> Dict[str, Any]:
        """Handle campaign start webhook."""
        logger.info("Processing campaign start")
        
        campaign_data = {
            "campaign_id": data.get("id"),
            "name": data.get("name"),
            "type": data.get("type"),
            "started_at": datetime.utcnow().isoformat()
        }
        
        # Start campaign monitoring
        monitoring_result = await self._start_campaign_monitoring(campaign_data)
        
        # Create performance tracking
        tracking_result = await self._create_performance_tracking(campaign_data)
        
        return {
            "monitoring_started": monitoring_result,
            "tracking_created": tracking_result
        }

    async def _handle_task_created(
        self, 
        data: Dict[str, Any], 
        source: str
    ) -> Dict[str, Any]:
        """Handle task creation webhook."""
        logger.info("Processing task creation")
        
        task_data = {
            "task_id": data.get("id"),
            "title": data.get("title"),
            "description": data.get("description"),
            "assigned_to": data.get("assignedTo"),
            "due_date": data.get("dueDate"),
            "priority": data.get("priority", "medium")
        }
        
        # Send task notification
        notification_result = await self._send_task_notification(task_data)
        
        # Create task reminders
        reminder_result = await self._create_task_reminders(task_data)
        
        return {
            "notification_sent": notification_result,
            "reminders_created": reminder_result
        }

    async def _handle_opportunity_created(
        self, 
        data: Dict[str, Any], 
        source: str
    ) -> Dict[str, Any]:
        """Handle opportunity creation webhook."""
        logger.info("Processing opportunity creation")
        
        opportunity_data = {
            "opportunity_id": data.get("id"),
            "name": data.get("name"),
            "contact_id": data.get("contactId"),
            "value": data.get("value"),
            "stage": data.get("stage"),
            "pipeline_id": data.get("pipelineId")
        }
        
        # Generate opportunity analysis
        analysis_result = await self._analyze_opportunity(opportunity_data)
        
        # Create sales strategy
        strategy_result = await self._create_sales_strategy(opportunity_data)
        
        # Set up opportunity tracking
        tracking_result = await self._setup_opportunity_tracking(opportunity_data)
        
        return {
            "analysis_completed": analysis_result,
            "strategy_created": strategy_result,
            "tracking_setup": tracking_result
        }

    async def _handle_conversation_started(
        self, 
        data: Dict[str, Any], 
        source: str
    ) -> Dict[str, Any]:
        """Handle conversation start webhook."""
        logger.info("Processing conversation start")
        
        conversation_data = {
            "conversation_id": data.get("id"),
            "contact_id": data.get("contactId"),
            "type": data.get("type"),
            "channel": data.get("channel"),
            "started_at": datetime.utcnow().isoformat()
        }
        
        # Generate conversation context
        context_result = await self._generate_conversation_context(conversation_data)
        
        # Create response suggestions
        suggestions_result = await self._generate_response_suggestions(conversation_data)
        
        # Set up conversation tracking
        tracking_result = await self._setup_conversation_tracking(conversation_data)
        
        return {
            "context_generated": context_result,
            "suggestions_created": suggestions_result,
            "tracking_setup": tracking_result
        }

    async def _handle_unknown_event(
        self, 
        event_type: str, 
        data: Dict[str, Any], 
        source: str
    ) -> Dict[str, Any]:
        """Handle unknown webhook events."""
        logger.warning(f"Unknown webhook event: {event_type}")
        
        # Log the event for analysis
        await self._log_unknown_event(event_type, data, source)
        
        return {
            "event_logged": True,
            "message": f"Unknown event type: {event_type}"
        }

    # Helper methods for webhook processing

    def _verify_signature(self, data: Dict[str, Any], signature: str, source: str) -> bool:
        """Verify webhook signature for security."""
        try:
            # This would implement proper signature verification
            # based on the source system's webhook security model
            return True  # Placeholder implementation
        except Exception as e:
            logger.error(f"Error verifying webhook signature: {e}")
            return False

    async def _store_contact(self, contact_info: Dict[str, Any]) -> bool:
        """Store contact in local database."""
        try:
            # This would store the contact in your database
            logger.info(f"Storing contact: {contact_info['id']}")
            return True
        except Exception as e:
            logger.error(f"Error storing contact: {e}")
            return False

    async def _update_contact(self, contact_id: str, data: Dict[str, Any]) -> bool:
        """Update contact in local database."""
        try:
            logger.info(f"Updating contact: {contact_id}")
            return True
        except Exception as e:
            logger.error(f"Error updating contact: {e}")
            return False

    async def _start_onboarding_flows(self, contact_info: Dict[str, Any]) -> Dict[str, Any]:
        """Start automated onboarding flows for new contacts."""
        try:
            # Determine onboarding flow based on contact source and tags
            flow_type = self._determine_onboarding_flow(contact_info)
            
            # Start appropriate flow
            if flow_type == "email_sequence":
                return await self._start_email_onboarding(contact_info)
            elif flow_type == "sms_sequence":
                return await self._start_sms_onboarding(contact_info)
            elif flow_type == "call_sequence":
                return await self._start_call_onboarding(contact_info)
            else:
                return await self._start_mixed_onboarding(contact_info)
                
        except Exception as e:
            logger.error(f"Error starting onboarding flows: {e}")
            return {"success": False, "error": str(e)}

    async def _generate_personalized_content(self, contact_info: Dict[str, Any]) -> Dict[str, Any]:
        """Generate personalized content for new contacts."""
        try:
            # Use brand voice assistant to generate personalized content
            content_request = {
                "brand": contact_info.get("custom_fields", {}).get("brand", "default"),
                "platform": "email",
                "tone": "welcoming",
                "context": f"New contact: {contact_info['first_name']} {contact_info['last_name']}",
                "custom_requirements": [
                    "Include welcome message",
                    "Mention their source: " + contact_info.get("source", "unknown"),
                    "Personalize with their name"
                ]
            }
            
            content = await self.brand_voice.generate_caption_variants(content_request)
            
            return {
                "success": True,
                "content": content,
                "generated_at": datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"Error generating personalized content: {e}")
            return {"success": False, "error": str(e)}

    async def _create_follow_up_tasks(self, contact_info: Dict[str, Any]) -> Dict[str, Any]:
        """Create follow-up tasks for new contacts."""
        try:
            tasks = []
            
            # Create immediate follow-up task
            tasks.append({
                "title": f"Follow up with {contact_info['first_name']} {contact_info['last_name']}",
                "description": "New contact from " + contact_info.get("source", "unknown"),
                "priority": "high",
                "due_date": (datetime.utcnow().timestamp() + 3600),  # 1 hour from now
                "contact_id": contact_info["id"]
            })
            
            # Create 24-hour follow-up task
            tasks.append({
                "title": f"Check in with {contact_info['first_name']} {contact_info['last_name']}",
                "description": "24-hour follow-up check",
                "priority": "medium",
                "due_date": (datetime.utcnow().timestamp() + 86400),  # 24 hours from now
                "contact_id": contact_info["id"]
            })
            
            return {
                "success": True,
                "tasks_created": len(tasks),
                "tasks": tasks
            }
        except Exception as e:
            logger.error(f"Error creating follow-up tasks: {e}")
            return {"success": False, "error": str(e)}

    async def _score_lead_ai(self, form_data: Dict[str, Any]) -> Dict[str, Any]:
        """AI-powered lead scoring based on form submission."""
        try:
            # Use AI to analyze form data and score the lead
            submission_data = form_data.get("submission_data", {})
            
            # Simple scoring algorithm (in production, this would use ML)
            score = 0
            factors = []
            
            # Email quality
            email = submission_data.get("email", "")
            if email and "@" in email:
                score += 20
                factors.append("Valid email provided")
            
            # Phone number
            phone = submission_data.get("phone", "")
            if phone and len(phone) >= 10:
                score += 15
                factors.append("Phone number provided")
            
            # Company information
            company = submission_data.get("company", "")
            if company:
                score += 10
                factors.append("Company information provided")
            
            # Budget indication
            budget = submission_data.get("budget", "")
            if budget and any(word in budget.lower() for word in ["high", "large", "enterprise"]):
                score += 25
                factors.append("High budget indication")
            
            # Urgency indicators
            urgency_words = ["urgent", "asap", "immediately", "quickly"]
            message = submission_data.get("message", "").lower()
            if any(word in message for word in urgency_words):
                score += 20
                factors.append("Urgency indicators present")
            
            # Lead quality classification
            if score >= 70:
                quality = "hot"
            elif score >= 40:
                quality = "warm"
            else:
                quality = "cold"
            
            return {
                "score": min(score, 100),
                "quality": quality,
                "factors": factors,
                "scored_at": datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"Error scoring lead: {e}")
            return {"score": 0, "quality": "unknown", "error": str(e)}

    async def _create_nurture_sequence(self, form_data: Dict[str, Any], lead_score: Dict[str, Any]) -> Dict[str, Any]:
        """Create nurture sequence based on lead score."""
        try:
            quality = lead_score.get("quality", "cold")
            contact_id = form_data.get("contact_id")
            
            # Create different sequences based on lead quality
            if quality == "hot":
                sequence = await self._create_hot_lead_sequence(contact_id)
            elif quality == "warm":
                sequence = await self._create_warm_lead_sequence(contact_id)
            else:
                sequence = await self._create_cold_lead_sequence(contact_id)
            
            return {
                "success": True,
                "sequence_created": sequence,
                "lead_quality": quality
            }
        except Exception as e:
            logger.error(f"Error creating nurture sequence: {e}")
            return {"success": False, "error": str(e)}

    async def _generate_form_follow_up(self, form_data: Dict[str, Any], lead_score: Dict[str, Any]) -> Dict[str, Any]:
        """Generate personalized follow-up content for form submissions."""
        try:
            # Use brand voice assistant to generate follow-up content
            content_request = {
                "brand": "default",
                "platform": "email",
                "tone": "professional",
                "context": f"Form submission follow-up - Lead quality: {lead_score.get('quality', 'unknown')}",
                "custom_requirements": [
                    "Thank them for their interest",
                    "Reference their form submission",
                    "Provide next steps",
                    "Include call-to-action"
                ]
            }
            
            content = await self.brand_voice.generate_caption_variants(content_request)
            
            return {
                "success": True,
                "content": content,
                "lead_quality": lead_score.get("quality"),
                "generated_at": datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"Error generating form follow-up: {e}")
            return {"success": False, "error": str(e)}

    async def _assign_to_sales_rep(self, form_data: Dict[str, Any], lead_score: Dict[str, Any]) -> Dict[str, Any]:
        """Assign lead to appropriate sales rep based on score and criteria."""
        try:
            quality = lead_score.get("quality", "cold")
            contact_id = form_data.get("contact_id")
            
            # Simple assignment logic (in production, this would be more sophisticated)
            if quality == "hot":
                assigned_rep = "senior_sales_rep"
                priority = "high"
            elif quality == "warm":
                assigned_rep = "sales_rep"
                priority = "medium"
            else:
                assigned_rep = "junior_sales_rep"
                priority = "low"
            
            return {
                "success": True,
                "assigned_rep": assigned_rep,
                "priority": priority,
                "contact_id": contact_id
            }
        except Exception as e:
            logger.error(f"Error assigning sales rep: {e}")
            return {"success": False, "error": str(e)}

    # Additional helper methods would be implemented here...
    # (The methods below are placeholder implementations)

    def _determine_onboarding_flow(self, contact_info: Dict[str, Any]) -> str:
        """Determine the appropriate onboarding flow for a contact."""
        source = contact_info.get("source", "").lower()
        tags = contact_info.get("tags", [])
        
        if "email" in source or "newsletter" in source:
            return "email_sequence"
        elif "phone" in source or "call" in source:
            return "call_sequence"
        elif "sms" in source or "text" in source:
            return "sms_sequence"
        else:
            return "mixed_onboarding"

    async def _start_email_onboarding(self, contact_info: Dict[str, Any]) -> Dict[str, Any]:
        """Start email-based onboarding sequence."""
        return {"flow_type": "email_sequence", "started": True}

    async def _start_sms_onboarding(self, contact_info: Dict[str, Any]) -> Dict[str, Any]:
        """Start SMS-based onboarding sequence."""
        return {"flow_type": "sms_sequence", "started": True}

    async def _start_call_onboarding(self, contact_info: Dict[str, Any]) -> Dict[str, Any]:
        """Start call-based onboarding sequence."""
        return {"flow_type": "call_sequence", "started": True}

    async def _start_mixed_onboarding(self, contact_info: Dict[str, Any]) -> Dict[str, Any]:
        """Start mixed-channel onboarding sequence."""
        return {"flow_type": "mixed_onboarding", "started": True}

    async def _create_hot_lead_sequence(self, contact_id: str) -> Dict[str, Any]:
        """Create nurture sequence for hot leads."""
        return {"sequence_type": "hot_lead", "contact_id": contact_id, "created": True}

    async def _create_warm_lead_sequence(self, contact_id: str) -> Dict[str, Any]:
        """Create nurture sequence for warm leads."""
        return {"sequence_type": "warm_lead", "contact_id": contact_id, "created": True}

    async def _create_cold_lead_sequence(self, contact_id: str) -> Dict[str, Any]:
        """Create nurture sequence for cold leads."""
        return {"sequence_type": "cold_lead", "contact_id": contact_id, "created": True}

    async def _log_unknown_event(self, event_type: str, data: Dict[str, Any], source: str) -> bool:
        """Log unknown events for analysis."""
        logger.warning(f"Unknown event logged: {event_type} from {source}")
        return True

    # Placeholder methods for other webhook handlers
    async def _trigger_update_workflows(self, contact_id: str, updated_fields: List[str]) -> Dict[str, Any]:
        return {"workflows_triggered": 0}

    async def _send_appointment_confirmation(self, appointment_data: Dict[str, Any]) -> bool:
        return True

    async def _create_appointment_prep_tasks(self, appointment_data: Dict[str, Any]) -> Dict[str, Any]:
        return {"tasks_created": 0}

    async def _generate_meeting_agenda(self, appointment_data: Dict[str, Any]) -> Dict[str, Any]:
        return {"agenda_generated": True}

    async def _start_campaign_monitoring(self, campaign_data: Dict[str, Any]) -> bool:
        return True

    async def _create_performance_tracking(self, campaign_data: Dict[str, Any]) -> Dict[str, Any]:
        return {"tracking_created": True}

    async def _send_task_notification(self, task_data: Dict[str, Any]) -> bool:
        return True

    async def _create_task_reminders(self, task_data: Dict[str, Any]) -> Dict[str, Any]:
        return {"reminders_created": 0}

    async def _analyze_opportunity(self, opportunity_data: Dict[str, Any]) -> Dict[str, Any]:
        return {"analysis_completed": True}

    async def _create_sales_strategy(self, opportunity_data: Dict[str, Any]) -> Dict[str, Any]:
        return {"strategy_created": True}

    async def _setup_opportunity_tracking(self, opportunity_data: Dict[str, Any]) -> bool:
        return True

    async def _generate_conversation_context(self, conversation_data: Dict[str, Any]) -> Dict[str, Any]:
        return {"context_generated": True}

    async def _generate_response_suggestions(self, conversation_data: Dict[str, Any]) -> Dict[str, Any]:
        return {"suggestions_created": True}

    async def _setup_conversation_tracking(self, conversation_data: Dict[str, Any]) -> bool:
        return True



