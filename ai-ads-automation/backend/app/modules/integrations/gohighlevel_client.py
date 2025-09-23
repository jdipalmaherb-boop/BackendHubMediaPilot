"""
GoHighLevel API client for CRM operations.
"""

import requests
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from app.core.logging import logger


class GoHighLevelClient:
    """Client for GoHighLevel API operations."""

    def __init__(self, access_token: str, location_id: Optional[str] = None):
        self.access_token = access_token
        self.location_id = location_id
        self.base_url = "https://api.gohighlevel.com/v1"
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        logger.info("GoHighLevel API client initialized")

    def _make_request(
        self, 
        method: str, 
        endpoint: str, 
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Make API request to GoHighLevel."""
        url = f"{self.base_url}{endpoint}"
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=self.headers, params=params, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, headers=self.headers, json=data, timeout=30)
            elif method.upper() == "PUT":
                response = requests.put(url, headers=self.headers, json=data, timeout=30)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=self.headers, timeout=30)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            if response.status_code in [200, 201, 204]:
                return response.json() if response.content else {}
            else:
                logger.error(f"API request failed: {response.status_code} - {response.text}")
                raise Exception(f"API request failed: {response.status_code} - {response.text}")
                
        except requests.RequestException as e:
            logger.error(f"Request error: {e}")
            raise Exception(f"Request failed: {e}")

    # Contact Management
    def get_contacts(
        self, 
        limit: int = 100, 
        offset: int = 0,
        query: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Get contacts from GoHighLevel."""
        params = {"limit": limit, "offset": offset}
        if query:
            params["query"] = query
        if tags:
            params["tags"] = ",".join(tags)
        
        return self._make_request("GET", "/contacts", params=params)

    def get_contact(self, contact_id: str) -> Dict[str, Any]:
        """Get specific contact by ID."""
        return self._make_request("GET", f"/contacts/{contact_id}")

    def create_contact(self, contact_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new contact."""
        if self.location_id:
            contact_data["locationId"] = self.location_id
        return self._make_request("POST", "/contacts", data=contact_data)

    def update_contact(self, contact_id: str, contact_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update existing contact."""
        return self._make_request("PUT", f"/contacts/{contact_id}", data=contact_data)

    def delete_contact(self, contact_id: str) -> Dict[str, Any]:
        """Delete contact."""
        return self._make_request("DELETE", f"/contacts/{contact_id}")

    def add_contact_tag(self, contact_id: str, tag: str) -> Dict[str, Any]:
        """Add tag to contact."""
        return self._make_request("POST", f"/contacts/{contact_id}/tags", data={"tag": tag})

    def remove_contact_tag(self, contact_id: str, tag: str) -> Dict[str, Any]:
        """Remove tag from contact."""
        return self._make_request("DELETE", f"/contacts/{contact_id}/tags/{tag}")

    # Appointment Management
    def get_appointments(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        contact_id: Optional[str] = None,
        calendar_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get appointments from GoHighLevel."""
        params = {}
        if start_date:
            params["startDate"] = start_date
        if end_date:
            params["endDate"] = end_date
        if contact_id:
            params["contactId"] = contact_id
        if calendar_id:
            params["calendarId"] = calendar_id
        
        return self._make_request("GET", "/appointments", params=params)

    def get_appointment(self, appointment_id: str) -> Dict[str, Any]:
        """Get specific appointment by ID."""
        return self._make_request("GET", f"/appointments/{appointment_id}")

    def create_appointment(self, appointment_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new appointment."""
        if self.location_id:
            appointment_data["locationId"] = self.location_id
        return self._make_request("POST", "/appointments", data=appointment_data)

    def update_appointment(self, appointment_id: str, appointment_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update existing appointment."""
        return self._make_request("PUT", f"/appointments/{appointment_id}", data=appointment_data)

    def delete_appointment(self, appointment_id: str) -> Dict[str, Any]:
        """Delete appointment."""
        return self._make_request("DELETE", f"/appointments/{appointment_id}")

    # Campaign Management
    def get_campaigns(self, limit: int = 100, offset: int = 0) -> Dict[str, Any]:
        """Get campaigns from GoHighLevel."""
        params = {"limit": limit, "offset": offset}
        return self._make_request("GET", "/campaigns", params=params)

    def get_campaign(self, campaign_id: str) -> Dict[str, Any]:
        """Get specific campaign by ID."""
        return self._make_request("GET", f"/campaigns/{campaign_id}")

    def create_campaign(self, campaign_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new campaign."""
        if self.location_id:
            campaign_data["locationId"] = self.location_id
        return self._make_request("POST", "/campaigns", data=campaign_data)

    def update_campaign(self, campaign_id: str, campaign_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update existing campaign."""
        return self._make_request("PUT", f"/campaigns/{campaign_id}", data=campaign_data)

    def start_campaign(self, campaign_id: str) -> Dict[str, Any]:
        """Start campaign."""
        return self._make_request("POST", f"/campaigns/{campaign_id}/start")

    def stop_campaign(self, campaign_id: str) -> Dict[str, Any]:
        """Stop campaign."""
        return self._make_request("POST", f"/campaigns/{campaign_id}/stop")

    # Conversation Management
    def get_conversations(
        self,
        contact_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> Dict[str, Any]:
        """Get conversations from GoHighLevel."""
        params = {"limit": limit, "offset": offset}
        if contact_id:
            params["contactId"] = contact_id
        
        return self._make_request("GET", "/conversations", params=params)

    def get_conversation(self, conversation_id: str) -> Dict[str, Any]:
        """Get specific conversation by ID."""
        return self._make_request("GET", f"/conversations/{conversation_id}")

    def send_message(self, conversation_id: str, message_data: Dict[str, Any]) -> Dict[str, Any]:
        """Send message in conversation."""
        return self._make_request("POST", f"/conversations/{conversation_id}/messages", data=message_data)

    # Location Management
    def get_locations(self) -> Dict[str, Any]:
        """Get locations from GoHighLevel."""
        return self._make_request("GET", "/locations")

    def get_location(self, location_id: str) -> Dict[str, Any]:
        """Get specific location by ID."""
        return self._make_request("GET", f"/locations/{location_id}")

    # Opportunity Management
    def get_opportunities(
        self,
        contact_id: Optional[str] = None,
        pipeline_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> Dict[str, Any]:
        """Get opportunities from GoHighLevel."""
        params = {"limit": limit, "offset": offset}
        if contact_id:
            params["contactId"] = contact_id
        if pipeline_id:
            params["pipelineId"] = pipeline_id
        
        return self._make_request("GET", "/opportunities", params=params)

    def get_opportunity(self, opportunity_id: str) -> Dict[str, Any]:
        """Get specific opportunity by ID."""
        return self._make_request("GET", f"/opportunities/{opportunity_id}")

    def create_opportunity(self, opportunity_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new opportunity."""
        if self.location_id:
            opportunity_data["locationId"] = self.location_id
        return self._make_request("POST", "/opportunities", data=opportunity_data)

    def update_opportunity(self, opportunity_id: str, opportunity_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update existing opportunity."""
        return self._make_request("PUT", f"/opportunities/{opportunity_id}", data=opportunity_data)

    def delete_opportunity(self, opportunity_id: str) -> Dict[str, Any]:
        """Delete opportunity."""
        return self._make_request("DELETE", f"/opportunities/{opportunity_id}")

    # Pipeline Management
    def get_pipelines(self) -> Dict[str, Any]:
        """Get pipelines from GoHighLevel."""
        return self._make_request("GET", "/pipelines")

    def get_pipeline(self, pipeline_id: str) -> Dict[str, Any]:
        """Get specific pipeline by ID."""
        return self._make_request("GET", f"/pipelines/{pipeline_id}")

    # Product Management
    def get_products(self, limit: int = 100, offset: int = 0) -> Dict[str, Any]:
        """Get products from GoHighLevel."""
        params = {"limit": limit, "offset": offset}
        return self._make_request("GET", "/products", params=params)

    def get_product(self, product_id: str) -> Dict[str, Any]:
        """Get specific product by ID."""
        return self._make_request("GET", f"/products/{product_id}")

    def create_product(self, product_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new product."""
        if self.location_id:
            product_data["locationId"] = self.location_id
        return self._make_request("POST", "/products", data=product_data)

    def update_product(self, product_id: str, product_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update existing product."""
        return self._make_request("PUT", f"/products/{product_id}", data=product_data)

    def delete_product(self, product_id: str) -> Dict[str, Any]:
        """Delete product."""
        return self._make_request("DELETE", f"/products/{product_id}")

    # Task Management
    def get_tasks(
        self,
        contact_id: Optional[str] = None,
        user_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> Dict[str, Any]:
        """Get tasks from GoHighLevel."""
        params = {"limit": limit, "offset": offset}
        if contact_id:
            params["contactId"] = contact_id
        if user_id:
            params["userId"] = user_id
        
        return self._make_request("GET", "/tasks", params=params)

    def get_task(self, task_id: str) -> Dict[str, Any]:
        """Get specific task by ID."""
        return self._make_request("GET", f"/tasks/{task_id}")

    def create_task(self, task_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new task."""
        if self.location_id:
            task_data["locationId"] = self.location_id
        return self._make_request("POST", "/tasks", data=task_data)

    def update_task(self, task_id: str, task_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update existing task."""
        return self._make_request("PUT", f"/tasks/{task_id}", data=task_data)

    def delete_task(self, task_id: str) -> Dict[str, Any]:
        """Delete task."""
        return self._make_request("DELETE", f"/tasks/{task_id}")

    def complete_task(self, task_id: str) -> Dict[str, Any]:
        """Mark task as completed."""
        return self._make_request("POST", f"/tasks/{task_id}/complete")

    # User Management
    def get_users(self) -> Dict[str, Any]:
        """Get users from GoHighLevel."""
        return self._make_request("GET", "/users")

    def get_user(self, user_id: str) -> Dict[str, Any]:
        """Get specific user by ID."""
        return self._make_request("GET", f"/users/{user_id}")

    def get_current_user(self) -> Dict[str, Any]:
        """Get current user information."""
        return self._make_request("GET", "/users/me")

    # Analytics and Reporting
    def get_analytics(
        self,
        start_date: str,
        end_date: str,
        metrics: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Get analytics data from GoHighLevel."""
        params = {"startDate": start_date, "endDate": end_date}
        if metrics:
            params["metrics"] = ",".join(metrics)
        
        return self._make_request("GET", "/analytics", params=params)

    def get_reports(
        self,
        report_type: str,
        start_date: str,
        end_date: str
    ) -> Dict[str, Any]:
        """Get reports from GoHighLevel."""
        params = {
            "type": report_type,
            "startDate": start_date,
            "endDate": end_date
        }
        
        return self._make_request("GET", "/reports", params=params)



