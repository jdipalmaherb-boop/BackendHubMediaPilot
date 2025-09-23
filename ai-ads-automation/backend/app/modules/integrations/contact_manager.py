"""
Enhanced contact management for GoHighLevel with AI-powered features.
"""

import requests
from datetime import datetime
from typing import Dict, Any, Optional, List, Tuple
from app.core.logging import logger
from app.modules.integrations.gohighlevel_client import GoHighLevelClient
from app.modules.integrations.lead_scoring import LeadScoringEngine, LeadScore
from app.modules.integrations.webhook_processor import WebhookProcessor


class ContactManager:
    """Enhanced contact management with AI-powered features."""

    def __init__(self, access_token: str, location_id: Optional[str] = None):
        self.client = GoHighLevelClient(access_token, location_id)
        self.scoring_engine = LeadScoringEngine()
        self.webhook_processor = WebhookProcessor()
        logger.info("ContactManager initialized")

    async def create_ghl_contact(
        self,
        contact_payload: Dict[str, Any],
        auto_score: bool = True,
        trigger_workflows: bool = True,
        custom_fields: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create a GoHighLevel contact with enhanced AI features.
        
        Args:
            contact_payload: Contact data for creation
            auto_score: Whether to automatically score the lead
            trigger_workflows: Whether to trigger automated workflows
            custom_fields: Additional custom fields to add
            
        Returns:
            Dict containing creation result and AI insights
        """
        logger.info("Creating GoHighLevel contact with AI features")
        
        try:
            # Enhance contact payload with custom fields
            enhanced_payload = self._enhance_contact_payload(contact_payload, custom_fields)
            
            # Create contact in GoHighLevel
            ghl_response = self.client.create_contact(enhanced_payload)
            
            if not ghl_response or "id" not in ghl_response:
                raise ValueError("Failed to create contact in GoHighLevel")
            
            contact_id = ghl_response["id"]
            logger.info(f"Contact created successfully: {contact_id}")
            
            # Prepare result
            result = {
                "success": True,
                "contact_id": contact_id,
                "ghl_response": ghl_response,
                "created_at": datetime.utcnow().isoformat()
            }
            
            # AI-powered lead scoring
            if auto_score:
                try:
                    lead_score = await self._score_new_contact(enhanced_payload, ghl_response)
                    result["lead_score"] = lead_score
                    logger.info(f"Lead scored: {lead_score.quality} ({lead_score.score}/100)")
                except Exception as e:
                    logger.error(f"Error scoring lead: {e}")
                    result["scoring_error"] = str(e)
            
            # Trigger automated workflows
            if trigger_workflows:
                try:
                    workflow_result = await self._trigger_contact_workflows(
                        contact_id, enhanced_payload, result.get("lead_score")
                    )
                    result["workflows"] = workflow_result
                    logger.info("Workflows triggered successfully")
                except Exception as e:
                    logger.error(f"Error triggering workflows: {e}")
                    result["workflow_error"] = str(e)
            
            # Update contact with AI insights
            if result.get("lead_score"):
                await self._update_contact_with_insights(contact_id, result["lead_score"])
            
            return result
            
        except Exception as e:
            logger.error(f"Error creating contact: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "created_at": datetime.utcnow().isoformat()
            }

    async def create_contact_with_scoring(
        self,
        contact_data: Dict[str, Any],
        scoring_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create contact with comprehensive lead scoring and analysis.
        
        Args:
            contact_data: Basic contact information
            scoring_context: Additional context for scoring (form data, source, etc.)
            
        Returns:
            Dict with contact creation and scoring results
        """
        logger.info("Creating contact with comprehensive scoring")
        
        try:
            # Prepare scoring data
            scoring_data = self._prepare_scoring_data(contact_data, scoring_context)
            
            # Score the lead before creation
            lead_score = await self.scoring_engine.score_lead(scoring_data)
            
            # Enhance contact payload based on score
            enhanced_payload = self._enhance_payload_with_score(contact_data, lead_score)
            
            # Create contact
            creation_result = await self.create_ghl_contact(
                contact_payload=enhanced_payload,
                auto_score=False,  # Already scored
                trigger_workflows=True
            )
            
            # Add scoring results
            creation_result["pre_creation_score"] = {
                "score": lead_score.score,
                "quality": lead_score.quality,
                "confidence": lead_score.confidence,
                "factors": lead_score.factors,
                "recommendations": lead_score.recommendations
            }
            
            return creation_result
            
        except Exception as e:
            logger.error(f"Error creating contact with scoring: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "created_at": datetime.utcnow().isoformat()
            }

    async def batch_create_contacts(
        self,
        contacts_data: List[Dict[str, Any]],
        auto_score: bool = True,
        trigger_workflows: bool = True
    ) -> Dict[str, Any]:
        """
        Create multiple contacts in batch with AI processing.
        
        Args:
            contacts_data: List of contact data
            auto_score: Whether to score each lead
            trigger_workflows: Whether to trigger workflows
            
        Returns:
            Dict with batch creation results and analytics
        """
        logger.info(f"Batch creating {len(contacts_data)} contacts")
        
        results = []
        successful_creations = 0
        failed_creations = 0
        
        for i, contact_data in enumerate(contacts_data):
            try:
                result = await self.create_ghl_contact(
                    contact_payload=contact_data,
                    auto_score=auto_score,
                    trigger_workflows=trigger_workflows
                )
                results.append(result)
                
                if result["success"]:
                    successful_creations += 1
                else:
                    failed_creations += 1
                    
            except Exception as e:
                logger.error(f"Error creating contact {i}: {e}")
                results.append({
                    "success": False,
                    "error": str(e),
                    "contact_index": i
                })
                failed_creations += 1
        
        # Generate batch analytics
        analytics = await self._generate_batch_analytics(results)
        
        return {
            "batch_summary": {
                "total_contacts": len(contacts_data),
                "successful_creations": successful_creations,
                "failed_creations": failed_creations,
                "success_rate": successful_creations / len(contacts_data) * 100
            },
            "results": results,
            "analytics": analytics,
            "processed_at": datetime.utcnow().isoformat()
        }

    async def update_contact_with_ai_insights(
        self,
        contact_id: str,
        insights: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Update contact with AI-generated insights and recommendations.
        
        Args:
            contact_id: GoHighLevel contact ID
            insights: AI insights to add as custom fields
            
        Returns:
            Dict with update result
        """
        logger.info(f"Updating contact {contact_id} with AI insights")
        
        try:
            # Prepare custom fields with AI insights
            custom_fields = {
                "ai_lead_score": insights.get("score", 0),
                "ai_lead_quality": insights.get("quality", "unknown"),
                "ai_confidence": insights.get("confidence", 0.0),
                "ai_factors": ", ".join(insights.get("factors", [])),
                "ai_recommendations": ", ".join(insights.get("recommendations", [])),
                "ai_updated_at": datetime.utcnow().isoformat()
            }
            
            # Update contact
            update_data = {"customFields": custom_fields}
            result = self.client.update_contact(contact_id, update_data)
            
            return {
                "success": True,
                "contact_id": contact_id,
                "updated_fields": list(custom_fields.keys()),
                "ghl_response": result
            }
            
        except Exception as e:
            logger.error(f"Error updating contact with AI insights: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "contact_id": contact_id
            }

    async def get_contact_ai_analysis(
        self,
        contact_id: str
    ) -> Dict[str, Any]:
        """
        Get comprehensive AI analysis for an existing contact.
        
        Args:
            contact_id: GoHighLevel contact ID
            
        Returns:
            Dict with AI analysis results
        """
        logger.info(f"Getting AI analysis for contact {contact_id}")
        
        try:
            # Get contact data
            contact = self.client.get_contact(contact_id)
            
            # Prepare data for analysis
            analysis_data = self._prepare_analysis_data(contact)
            
            # Score the contact
            lead_score = await self.scoring_engine.score_lead(analysis_data)
            
            # Generate recommendations
            recommendations = await self._generate_contact_recommendations(contact, lead_score)
            
            # Analyze engagement patterns
            engagement_analysis = await self._analyze_contact_engagement(contact_id)
            
            return {
                "contact_id": contact_id,
                "lead_score": {
                    "score": lead_score.score,
                    "quality": lead_score.quality,
                    "confidence": lead_score.confidence,
                    "factors": lead_score.factors
                },
                "recommendations": recommendations,
                "engagement_analysis": engagement_analysis,
                "analyzed_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error analyzing contact: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "contact_id": contact_id
            }

    # Helper methods

    def _enhance_contact_payload(
        self,
        contact_payload: Dict[str, Any],
        custom_fields: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Enhance contact payload with additional fields."""
        enhanced = contact_payload.copy()
        
        # Add timestamp
        enhanced["createdAt"] = datetime.utcnow().isoformat()
        
        # Add custom fields
        if custom_fields:
            if "customFields" not in enhanced:
                enhanced["customFields"] = {}
            enhanced["customFields"].update(custom_fields)
        
        # Add AI processing flag
        if "customFields" not in enhanced:
            enhanced["customFields"] = {}
        enhanced["customFields"]["ai_processed"] = True
        enhanced["customFields"]["ai_processed_at"] = datetime.utcnow().isoformat()
        
        return enhanced

    async def _score_new_contact(
        self,
        contact_payload: Dict[str, Any],
        ghl_response: Dict[str, Any]
    ) -> LeadScore:
        """Score a newly created contact."""
        # Prepare scoring data
        scoring_data = {
            "email": contact_payload.get("email", ""),
            "phone": contact_payload.get("phone", ""),
            "company": contact_payload.get("company", ""),
            "job_title": contact_payload.get("jobTitle", ""),
            "source": contact_payload.get("source", "api"),
            "custom_fields": contact_payload.get("customFields", {})
        }
        
        # Add GHL response data
        if ghl_response:
            scoring_data["ghl_contact_id"] = ghl_response.get("id")
            scoring_data["created_at"] = ghl_response.get("createdAt")
        
        return await self.scoring_engine.score_lead(scoring_data)

    async def _trigger_contact_workflows(
        self,
        contact_id: str,
        contact_payload: Dict[str, Any],
        lead_score: Optional[LeadScore]
    ) -> Dict[str, Any]:
        """Trigger automated workflows for new contact."""
        try:
            # Simulate webhook event for contact creation
            webhook_data = {
                "id": contact_id,
                "firstName": contact_payload.get("firstName", ""),
                "lastName": contact_payload.get("lastName", ""),
                "email": contact_payload.get("email", ""),
                "phone": contact_payload.get("phone", ""),
                "source": contact_payload.get("source", "api"),
                "tags": contact_payload.get("tags", []),
                "customFields": contact_payload.get("customFields", {})
            }
            
            # Process as webhook
            result = await self.webhook_processor.process_webhook(
                event_type="contact.created",
                data=webhook_data,
                source="gohighlevel"
            )
            
            return result.get("result", {})
            
        except Exception as e:
            logger.error(f"Error triggering workflows: {e}")
            return {"error": str(e)}

    async def _update_contact_with_insights(
        self,
        contact_id: str,
        lead_score: LeadScore
    ) -> bool:
        """Update contact with lead scoring insights."""
        try:
            insights = {
                "score": lead_score.score,
                "quality": lead_score.quality,
                "confidence": lead_score.confidence,
                "factors": lead_score.factors,
                "recommendations": lead_score.recommendations
            }
            
            result = await self.update_contact_with_ai_insights(contact_id, insights)
            return result["success"]
            
        except Exception as e:
            logger.error(f"Error updating contact with insights: {e}")
            return False

    def _prepare_scoring_data(
        self,
        contact_data: Dict[str, Any],
        scoring_context: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Prepare data for lead scoring."""
        scoring_data = {
            "email": contact_data.get("email", ""),
            "phone": contact_data.get("phone", ""),
            "company": contact_data.get("company", ""),
            "job_title": contact_data.get("jobTitle", ""),
            "source": contact_data.get("source", "api")
        }
        
        # Add custom fields
        if "customFields" in contact_data:
            scoring_data.update(contact_data["customFields"])
        
        # Add scoring context
        if scoring_context:
            scoring_data.update(scoring_context)
        
        return scoring_data

    def _enhance_payload_with_score(
        self,
        contact_data: Dict[str, Any],
        lead_score: LeadScore
    ) -> Dict[str, Any]:
        """Enhance contact payload based on lead score."""
        enhanced = contact_data.copy()
        
        # Add AI insights as custom fields
        if "customFields" not in enhanced:
            enhanced["customFields"] = {}
        
        enhanced["customFields"].update({
            "ai_lead_score": lead_score.score,
            "ai_lead_quality": lead_score.quality,
            "ai_confidence": lead_score.confidence,
            "ai_factors": ", ".join(lead_score.factors[:5]),  # Limit to first 5
            "ai_scored_at": datetime.utcnow().isoformat()
        })
        
        # Add tags based on quality
        if "tags" not in enhanced:
            enhanced["tags"] = []
        
        quality_tags = {
            "hot": ["hot-lead", "priority"],
            "warm": ["warm-lead", "follow-up"],
            "cold": ["cold-lead", "nurture"],
            "unqualified": ["unqualified", "review"]
        }
        
        if lead_score.quality in quality_tags:
            enhanced["tags"].extend(quality_tags[lead_score.quality])
        
        return enhanced

    async def _generate_batch_analytics(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate analytics for batch contact creation."""
        successful_results = [r for r in results if r.get("success")]
        
        if not successful_results:
            return {"message": "No successful creations to analyze"}
        
        # Extract lead scores
        lead_scores = []
        for result in successful_results:
            if "lead_score" in result:
                lead_scores.append(result["lead_score"])
        
        if lead_scores:
            analytics = await self.scoring_engine.get_scoring_analytics(lead_scores)
        else:
            analytics = {"message": "No lead scores available for analysis"}
        
        return analytics

    def _prepare_analysis_data(self, contact: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare contact data for AI analysis."""
        return {
            "email": contact.get("email", ""),
            "phone": contact.get("phone", ""),
            "company": contact.get("company", ""),
            "job_title": contact.get("jobTitle", ""),
            "source": contact.get("source", "unknown"),
            "custom_fields": contact.get("customFields", {}),
            "created_at": contact.get("createdAt", ""),
            "tags": contact.get("tags", [])
        }

    async def _generate_contact_recommendations(
        self,
        contact: Dict[str, Any],
        lead_score: LeadScore
    ) -> List[str]:
        """Generate specific recommendations for a contact."""
        recommendations = []
        
        # Quality-based recommendations
        if lead_score.quality == "hot":
            recommendations.extend([
                "Schedule immediate discovery call",
                "Prepare personalized demo",
                "Check for existing opportunities",
                "Assign to senior sales rep"
            ])
        elif lead_score.quality == "warm":
            recommendations.extend([
                "Send relevant case studies",
                "Schedule follow-up call this week",
                "Add to high-priority nurture sequence"
            ])
        else:
            recommendations.extend([
                "Add to standard nurture sequence",
                "Send educational content",
                "Monitor engagement metrics"
            ])
        
        # Contact-specific recommendations
        if not contact.get("phone"):
            recommendations.append("Request phone number in next interaction")
        
        if not contact.get("company"):
            recommendations.append("Gather company information")
        
        if lead_score.score < 50:
            recommendations.append("Focus on lead qualification")
        
        return recommendations

    async def _analyze_contact_engagement(self, contact_id: str) -> Dict[str, Any]:
        """Analyze contact engagement patterns."""
        try:
            # This would typically analyze historical interactions
            # For now, return placeholder data
            return {
                "total_interactions": 0,
                "last_engagement": None,
                "engagement_score": 0.0,
                "preferred_channels": [],
                "response_rate": 0.0
            }
        except Exception as e:
            logger.error(f"Error analyzing engagement: {e}")
            return {"error": str(e)}


# Convenience function matching your original signature
def create_ghl_contact(access_token: str, contact_payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create a GoHighLevel contact (original function signature).
    
    Args:
        access_token: GoHighLevel API access token
        contact_payload: Contact data for creation
        
    Returns:
        Dict containing GoHighLevel API response
    """
    try:
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        resp = requests.post(
            "https://api.gohighlevel.com/v1/contacts/",
            json=contact_payload,
            headers=headers
        )
        
        return resp.json()
        
    except Exception as e:
        logger.error(f"Error in create_ghl_contact: {e}")
        return {"error": str(e), "status_code": resp.status_code if 'resp' in locals() else None}



