"""
Tests for the integrations module.
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
from app.modules.integrations.gohighlevel_oauth import GoHighLevelOAuth
from app.modules.integrations.gohighlevel_client import GoHighLevelClient


class TestGoHighLevelOAuth:
    """Test cases for GoHighLevelOAuth."""

    @pytest.fixture
    def oauth(self):
        """GoHighLevelOAuth instance for testing."""
        with patch.dict('os.environ', {
            'GHL_CLIENT_ID': 'test_client_id',
            'GHL_CLIENT_SECRET': 'test_client_secret',
            'GHL_OAUTH_REDIRECT': 'http://localhost:8000/callback'
        }):
            return GoHighLevelOAuth()

    def test_generate_auth_url_success(self, oauth):
        """Test successful auth URL generation."""
        auth_data = oauth.generate_auth_url()
        
        assert "url" in auth_data
        assert "state" in auth_data
        assert "scopes" in auth_data
        assert "gohighlevel.com" in auth_data["url"]
        assert "test_client_id" in auth_data["url"]
        assert "contacts" in auth_data["scopes"]

    def test_generate_auth_url_with_state(self, oauth):
        """Test auth URL generation with custom state."""
        custom_state = "custom_state_123"
        auth_data = oauth.generate_auth_url(custom_state)
        
        assert auth_data["state"] == custom_state
        assert custom_state in auth_data["url"]

    def test_generate_auth_url_missing_credentials(self):
        """Test auth URL generation with missing credentials."""
        with patch.dict('os.environ', {}, clear=True):
            oauth = GoHighLevelOAuth()
            
            with pytest.raises(Exception):
                oauth.generate_auth_url()

    @patch('requests.post')
    def test_exchange_code_for_token_success(self, mock_post, oauth):
        """Test successful code exchange for token."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "access_token": "test_access_token",
            "refresh_token": "test_refresh_token",
            "expires_in": 3600,
            "scope": "contacts appointments"
        }
        mock_post.return_value = mock_response
        
        result = oauth.exchange_code_for_token("test_code", "test_state")
        
        assert result["status"] == "connected"
        assert result["data"]["access_token"] == "test_access_token"
        assert result["data"]["refresh_token"] == "test_refresh_token"
        assert "expires_at" in result

    @patch('requests.post')
    def test_exchange_code_for_token_failure(self, mock_post, oauth):
        """Test code exchange failure."""
        mock_response = Mock()
        mock_response.status_code = 400
        mock_response.text = "Invalid code"
        mock_post.return_value = mock_response
        
        with pytest.raises(Exception):
            oauth.exchange_code_for_token("invalid_code", "test_state")

    @patch('requests.post')
    def test_refresh_access_token_success(self, mock_post, oauth):
        """Test successful token refresh."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "access_token": "new_access_token",
            "refresh_token": "new_refresh_token",
            "expires_in": 3600
        }
        mock_post.return_value = mock_response
        
        result = oauth.refresh_access_token("test_refresh_token")
        
        assert result["status"] == "refreshed"
        assert result["data"]["access_token"] == "new_access_token"
        assert "expires_at" in result

    @patch('requests.post')
    def test_revoke_token_success(self, mock_post, oauth):
        """Test successful token revocation."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_post.return_value = mock_response
        
        result = oauth.revoke_token("test_token")
        
        assert result["status"] == "revoked"
        assert "successfully" in result["message"]

    @patch('requests.get')
    def test_validate_token_success(self, mock_get, oauth):
        """Test successful token validation."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"id": "user123", "name": "Test User"}
        mock_get.return_value = mock_response
        
        result = oauth.validate_token("test_token")
        
        assert result["valid"] is True
        assert result["user"]["id"] == "user123"

    @patch('requests.get')
    def test_validate_token_failure(self, mock_get, oauth):
        """Test token validation failure."""
        mock_response = Mock()
        mock_response.status_code = 401
        mock_get.return_value = mock_response
        
        result = oauth.validate_token("invalid_token")
        
        assert result["valid"] is False
        assert "failed" in result["message"]

    def test_generate_state(self, oauth):
        """Test state generation."""
        state1 = oauth._generate_state()
        state2 = oauth._generate_state()
        
        assert len(state1) > 0
        assert len(state2) > 0
        assert state1 != state2  # Should be different each time


class TestGoHighLevelClient:
    """Test cases for GoHighLevelClient."""

    @pytest.fixture
    def client(self):
        """GoHighLevelClient instance for testing."""
        return GoHighLevelClient("test_access_token", "test_location_id")

    @patch('requests.get')
    def test_get_contacts_success(self, mock_get, client):
        """Test successful contacts retrieval."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "contacts": [
                {"id": "1", "firstName": "John", "lastName": "Doe"},
                {"id": "2", "firstName": "Jane", "lastName": "Smith"}
            ]
        }
        mock_get.return_value = mock_response
        
        result = client.get_contacts(limit=10, offset=0)
        
        assert "contacts" in result
        assert len(result["contacts"]) == 2

    @patch('requests.get')
    def test_get_contact_success(self, mock_get, client):
        """Test successful single contact retrieval."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "id": "1",
            "firstName": "John",
            "lastName": "Doe",
            "email": "john@example.com"
        }
        mock_get.return_value = mock_response
        
        result = client.get_contact("1")
        
        assert result["id"] == "1"
        assert result["firstName"] == "John"

    @patch('requests.post')
    def test_create_contact_success(self, mock_post, client):
        """Test successful contact creation."""
        mock_response = Mock()
        mock_response.status_code = 201
        mock_response.json.return_value = {
            "id": "new_contact_id",
            "firstName": "New",
            "lastName": "Contact"
        }
        mock_post.return_value = mock_response
        
        contact_data = {
            "firstName": "New",
            "lastName": "Contact",
            "email": "new@example.com"
        }
        
        result = client.create_contact(contact_data)
        
        assert result["id"] == "new_contact_id"
        assert result["firstName"] == "New"

    @patch('requests.put')
    def test_update_contact_success(self, mock_put, client):
        """Test successful contact update."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "id": "1",
            "firstName": "Updated",
            "lastName": "Contact"
        }
        mock_put.return_value = mock_response
        
        contact_data = {"firstName": "Updated"}
        
        result = client.update_contact("1", contact_data)
        
        assert result["firstName"] == "Updated"

    @patch('requests.delete')
    def test_delete_contact_success(self, mock_delete, client):
        """Test successful contact deletion."""
        mock_response = Mock()
        mock_response.status_code = 204
        mock_response.content = b""
        mock_delete.return_value = mock_response
        
        result = client.delete_contact("1")
        
        assert result == {}

    @patch('requests.get')
    def test_get_appointments_success(self, mock_get, client):
        """Test successful appointments retrieval."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "appointments": [
                {"id": "1", "title": "Meeting 1"},
                {"id": "2", "title": "Meeting 2"}
            ]
        }
        mock_get.return_value = mock_response
        
        result = client.get_appointments()
        
        assert "appointments" in result
        assert len(result["appointments"]) == 2

    @patch('requests.post')
    def test_create_appointment_success(self, mock_post, client):
        """Test successful appointment creation."""
        mock_response = Mock()
        mock_response.status_code = 201
        mock_response.json.return_value = {
            "id": "new_appointment_id",
            "title": "New Appointment"
        }
        mock_post.return_value = mock_response
        
        appointment_data = {
            "title": "New Appointment",
            "startTime": "2023-10-27T10:00:00Z",
            "endTime": "2023-10-27T11:00:00Z",
            "contactId": "contact_1"
        }
        
        result = client.create_appointment(appointment_data)
        
        assert result["id"] == "new_appointment_id"
        assert result["title"] == "New Appointment"

    @patch('requests.get')
    def test_get_campaigns_success(self, mock_get, client):
        """Test successful campaigns retrieval."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "campaigns": [
                {"id": "1", "name": "Campaign 1"},
                {"id": "2", "name": "Campaign 2"}
            ]
        }
        mock_get.return_value = mock_response
        
        result = client.get_campaigns()
        
        assert "campaigns" in result
        assert len(result["campaigns"]) == 2

    @patch('requests.post')
    def test_create_campaign_success(self, mock_post, client):
        """Test successful campaign creation."""
        mock_response = Mock()
        mock_response.status_code = 201
        mock_response.json.return_value = {
            "id": "new_campaign_id",
            "name": "New Campaign"
        }
        mock_post.return_value = mock_response
        
        campaign_data = {
            "name": "New Campaign",
            "type": "email"
        }
        
        result = client.create_campaign(campaign_data)
        
        assert result["id"] == "new_campaign_id"
        assert result["name"] == "New Campaign"

    @patch('requests.get')
    def test_get_tasks_success(self, mock_get, client):
        """Test successful tasks retrieval."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "tasks": [
                {"id": "1", "title": "Task 1"},
                {"id": "2", "title": "Task 2"}
            ]
        }
        mock_get.return_value = mock_response
        
        result = client.get_tasks()
        
        assert "tasks" in result
        assert len(result["tasks"]) == 2

    @patch('requests.post')
    def test_create_task_success(self, mock_post, client):
        """Test successful task creation."""
        mock_response = Mock()
        mock_response.status_code = 201
        mock_response.json.return_value = {
            "id": "new_task_id",
            "title": "New Task"
        }
        mock_post.return_value = mock_response
        
        task_data = {
            "title": "New Task",
            "description": "Task description"
        }
        
        result = client.create_task(task_data)
        
        assert result["id"] == "new_task_id"
        assert result["title"] == "New Task"

    @patch('requests.get')
    def test_get_current_user_success(self, mock_get, client):
        """Test successful current user retrieval."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "id": "user_123",
            "name": "Test User",
            "email": "user@example.com"
        }
        mock_get.return_value = mock_response
        
        result = client.get_current_user()
        
        assert result["id"] == "user_123"
        assert result["name"] == "Test User"

    @patch('requests.get')
    def test_api_request_failure(self, mock_get, client):
        """Test API request failure handling."""
        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"
        mock_get.return_value = mock_response
        
        with pytest.raises(Exception) as exc_info:
            client.get_contacts()
        
        assert "API request failed" in str(exc_info.value)

    @patch('requests.get')
    def test_request_exception(self, mock_get, client):
        """Test request exception handling."""
        mock_get.side_effect = Exception("Network error")
        
        with pytest.raises(Exception) as exc_info:
            client.get_contacts()
        
        assert "Request failed" in str(exc_info.value)

    def test_make_request_unsupported_method(self, client):
        """Test unsupported HTTP method."""
        with pytest.raises(ValueError) as exc_info:
            client._make_request("PATCH", "/test")
        
        assert "Unsupported HTTP method" in str(exc_info.value)

    def test_client_initialization(self):
        """Test client initialization."""
        client = GoHighLevelClient("test_token", "test_location")
        
        assert client.access_token == "test_token"
        assert client.location_id == "test_location"
        assert "Bearer test_token" in client.headers["Authorization"]
        assert client.headers["Content-Type"] == "application/json"



