"""
Tests for the contact manager module.
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
from app.modules.integrations.contact_manager import ContactManager, create_ghl_contact
from app.modules.integrations.lead_scoring import LeadScore


class TestContactManager:
    """Test cases for ContactManager."""

    @pytest.fixture
    def manager(self):
        """ContactManager instance for testing."""
        return ContactManager("test_access_token", "test_location_id")

    @pytest.fixture
    def sample_contact_payload(self):
        """Sample contact payload for testing."""
        return {
            "firstName": "John",
            "lastName": "Doe",
            "email": "john.doe@example.com",
            "phone": "+1234567890",
            "company": "Acme Corp",
            "source": "website"
        }

    @pytest.fixture
    def sample_ghl_response(self):
        """Sample GoHighLevel API response."""
        return {
            "id": "contact_123",
            "firstName": "John",
            "lastName": "Doe",
            "email": "john.doe@example.com",
            "createdAt": "2023-10-27T10:00:00Z"
        }

    @pytest.mark.asyncio
    async def test_create_ghl_contact_success(self, manager, sample_contact_payload, sample_ghl_response):
        """Test successful contact creation with AI features."""
        with patch.object(manager.client, 'create_contact') as mock_create:
            mock_create.return_value = sample_ghl_response
            
            with patch.object(manager, '_score_new_contact') as mock_score:
                mock_score.return_value = LeadScore(
                    score=75, quality="warm", factors=[], confidence=0.8,
                    recommendations=[], next_actions=[]
                )
                
                with patch.object(manager, '_trigger_contact_workflows') as mock_workflows:
                    mock_workflows.return_value = {"workflow_triggered": True}
                    
                    result = await manager.create_ghl_contact(sample_contact_payload)
                    
                    assert result["success"] is True
                    assert result["contact_id"] == "contact_123"
                    assert "lead_score" in result
                    assert "workflows" in result

    @pytest.mark.asyncio
    async def test_create_ghl_contact_without_ai(self, manager, sample_contact_payload, sample_ghl_response):
        """Test contact creation without AI features."""
        with patch.object(manager.client, 'create_contact') as mock_create:
            mock_create.return_value = sample_ghl_response
            
            result = await manager.create_ghl_contact(
                sample_contact_payload,
                auto_score=False,
                trigger_workflows=False
            )
            
            assert result["success"] is True
            assert result["contact_id"] == "contact_123"
            assert "lead_score" not in result
            assert "workflows" not in result

    @pytest.mark.asyncio
    async def test_create_ghl_contact_failure(self, manager, sample_contact_payload):
        """Test contact creation failure."""
        with patch.object(manager.client, 'create_contact') as mock_create:
            mock_create.return_value = None  # Simulate API failure
            
            result = await manager.create_ghl_contact(sample_contact_payload)
            
            assert result["success"] is False
            assert "error" in result

    @pytest.mark.asyncio
    async def test_create_contact_with_scoring(self, manager, sample_contact_payload):
        """Test contact creation with comprehensive scoring."""
        with patch.object(manager.scoring_engine, 'score_lead') as mock_score:
            mock_score.return_value = LeadScore(
                score=85, quality="hot", factors=["Valid email"], confidence=0.9,
                recommendations=["Immediate follow-up"], next_actions=["Call now"]
            )
            
            with patch.object(manager, 'create_ghl_contact') as mock_create:
                mock_create.return_value = {
                    "success": True,
                    "contact_id": "contact_123",
                    "ghl_response": {"id": "contact_123"}
                }
                
                result = await manager.create_contact_with_scoring(sample_contact_payload)
                
                assert result["success"] is True
                assert "pre_creation_score" in result
                assert result["pre_creation_score"]["score"] == 85
                assert result["pre_creation_score"]["quality"] == "hot"

    @pytest.mark.asyncio
    async def test_batch_create_contacts(self, manager):
        """Test batch contact creation."""
        contacts_data = [
            {"firstName": "John", "lastName": "Doe", "email": "john@example.com"},
            {"firstName": "Jane", "lastName": "Smith", "email": "jane@example.com"}
        ]
        
        with patch.object(manager, 'create_ghl_contact') as mock_create:
            mock_create.return_value = {
                "success": True,
                "contact_id": "contact_123",
                "lead_score": LeadScore(score=75, quality="warm", factors=[], confidence=0.8, recommendations=[], next_actions=[])
            }
            
            result = await manager.batch_create_contacts(contacts_data)
            
            assert result["batch_summary"]["total_contacts"] == 2
            assert result["batch_summary"]["successful_creations"] == 2
            assert result["batch_summary"]["failed_creations"] == 0
            assert len(result["results"]) == 2

    @pytest.mark.asyncio
    async def test_update_contact_with_ai_insights(self, manager):
        """Test updating contact with AI insights."""
        insights = {
            "score": 85,
            "quality": "hot",
            "confidence": 0.9,
            "factors": ["Valid email", "High budget"],
            "recommendations": ["Immediate follow-up"]
        }
        
        with patch.object(manager.client, 'update_contact') as mock_update:
            mock_update.return_value = {"id": "contact_123", "updated": True}
            
            result = await manager.update_contact_with_ai_insights("contact_123", insights)
            
            assert result["success"] is True
            assert result["contact_id"] == "contact_123"
            assert "updated_fields" in result

    @pytest.mark.asyncio
    async def test_get_contact_ai_analysis(self, manager):
        """Test getting contact AI analysis."""
        contact_data = {
            "id": "contact_123",
            "email": "john@example.com",
            "company": "Acme Corp",
            "customFields": {}
        }
        
        with patch.object(manager.client, 'get_contact') as mock_get:
            mock_get.return_value = contact_data
            
            with patch.object(manager.scoring_engine, 'score_lead') as mock_score:
                mock_score.return_value = LeadScore(
                    score=75, quality="warm", factors=[], confidence=0.8,
                    recommendations=[], next_actions=[]
                )
                
                with patch.object(manager, '_generate_contact_recommendations') as mock_recs:
                    mock_recs.return_value = ["Follow up this week"]
                    
                    with patch.object(manager, '_analyze_contact_engagement') as mock_engagement:
                        mock_engagement.return_value = {"total_interactions": 5}
                        
                        result = await manager.get_contact_ai_analysis("contact_123")
                        
                        assert result["contact_id"] == "contact_123"
                        assert "lead_score" in result
                        assert "recommendations" in result
                        assert "engagement_analysis" in result

    def test_enhance_contact_payload(self, manager, sample_contact_payload):
        """Test contact payload enhancement."""
        custom_fields = {"custom_field": "value"}
        
        enhanced = manager._enhance_contact_payload(sample_contact_payload, custom_fields)
        
        assert "createdAt" in enhanced
        assert "customFields" in enhanced
        assert enhanced["customFields"]["custom_field"] == "value"
        assert enhanced["customFields"]["ai_processed"] is True

    def test_prepare_scoring_data(self, manager, sample_contact_payload):
        """Test scoring data preparation."""
        scoring_context = {"budget": "high", "urgency": "urgent"}
        
        scoring_data = manager._prepare_scoring_data(sample_contact_payload, scoring_context)
        
        assert scoring_data["email"] == "john.doe@example.com"
        assert scoring_data["budget"] == "high"
        assert scoring_data["urgency"] == "urgent"

    def test_enhance_payload_with_score(self, manager, sample_contact_payload):
        """Test payload enhancement with lead score."""
        lead_score = LeadScore(
            score=85, quality="hot", factors=["Valid email"], confidence=0.9,
            recommendations=["Immediate follow-up"], next_actions=["Call now"]
        )
        
        enhanced = manager._enhance_payload_with_score(sample_contact_payload, lead_score)
        
        assert enhanced["customFields"]["ai_lead_score"] == 85
        assert enhanced["customFields"]["ai_lead_quality"] == "hot"
        assert "hot-lead" in enhanced["tags"]
        assert "priority" in enhanced["tags"]

    @pytest.mark.asyncio
    async def test_score_new_contact(self, manager, sample_contact_payload, sample_ghl_response):
        """Test scoring a newly created contact."""
        with patch.object(manager.scoring_engine, 'score_lead') as mock_score:
            mock_score.return_value = LeadScore(
                score=75, quality="warm", factors=[], confidence=0.8,
                recommendations=[], next_actions=[]
            )
            
            result = await manager._score_new_contact(sample_contact_payload, sample_ghl_response)
            
            assert isinstance(result, LeadScore)
            assert result.score == 75
            assert result.quality == "warm"

    @pytest.mark.asyncio
    async def test_trigger_contact_workflows(self, manager, sample_contact_payload):
        """Test triggering contact workflows."""
        with patch.object(manager.webhook_processor, 'process_webhook') as mock_webhook:
            mock_webhook.return_value = {
                "status": "success",
                "result": {"workflow_triggered": True}
            }
            
            result = await manager._trigger_contact_workflows(
                "contact_123", sample_contact_payload, None
            )
            
            assert result["workflow_triggered"] is True

    @pytest.mark.asyncio
    async def test_generate_batch_analytics(self, manager):
        """Test batch analytics generation."""
        results = [
            {
                "success": True,
                "lead_score": LeadScore(score=80, quality="hot", factors=[], confidence=0.9, recommendations=[], next_actions=[])
            },
            {
                "success": True,
                "lead_score": LeadScore(score=60, quality="warm", factors=[], confidence=0.7, recommendations=[], next_actions=[])
            }
        ]
        
        with patch.object(manager.scoring_engine, 'get_scoring_analytics') as mock_analytics:
            mock_analytics.return_value = {
                "total_leads": 2,
                "average_score": 70.0,
                "quality_distribution": {"hot": 1, "warm": 1}
            }
            
            analytics = await manager._generate_batch_analytics(results)
            
            assert analytics["total_leads"] == 2
            assert analytics["average_score"] == 70.0

    def test_prepare_analysis_data(self, manager):
        """Test analysis data preparation."""
        contact = {
            "id": "contact_123",
            "email": "john@example.com",
            "phone": "+1234567890",
            "company": "Acme Corp",
            "customFields": {"industry": "tech"},
            "tags": ["lead", "vip"]
        }
        
        analysis_data = manager._prepare_analysis_data(contact)
        
        assert analysis_data["email"] == "john@example.com"
        assert analysis_data["company"] == "Acme Corp"
        assert analysis_data["custom_fields"]["industry"] == "tech"
        assert "lead" in analysis_data["tags"]

    @pytest.mark.asyncio
    async def test_generate_contact_recommendations(self, manager):
        """Test contact recommendation generation."""
        contact = {
            "email": "john@example.com",
            "phone": "+1234567890",
            "company": "Acme Corp"
        }
        
        lead_score = LeadScore(
            score=85, quality="hot", factors=[], confidence=0.9,
            recommendations=[], next_actions=[]
        )
        
        recommendations = await manager._generate_contact_recommendations(contact, lead_score)
        
        assert len(recommendations) > 0
        assert "Schedule immediate discovery call" in recommendations

    @pytest.mark.asyncio
    async def test_analyze_contact_engagement(self, manager):
        """Test contact engagement analysis."""
        result = await manager._analyze_contact_engagement("contact_123")
        
        assert "total_interactions" in result
        assert "engagement_score" in result
        assert "preferred_channels" in result


class TestCreateGHLContactFunction:
    """Test cases for the original create_ghl_contact function."""

    @patch('requests.post')
    def test_create_ghl_contact_success(self, mock_post):
        """Test successful contact creation with original function."""
        mock_response = Mock()
        mock_response.json.return_value = {"id": "contact_123", "success": True}
        mock_post.return_value = mock_response
        
        result = create_ghl_contact("test_token", {"firstName": "John", "lastName": "Doe"})
        
        assert result["id"] == "contact_123"
        assert result["success"] is True
        mock_post.assert_called_once()

    @patch('requests.post')
    def test_create_ghl_contact_failure(self, mock_post):
        """Test contact creation failure with original function."""
        mock_post.side_effect = Exception("API Error")
        
        result = create_ghl_contact("test_token", {"firstName": "John"})
        
        assert "error" in result
        assert result["error"] == "API Error"

    @patch('requests.post')
    def test_create_ghl_contact_api_error(self, mock_post):
        """Test API error response with original function."""
        mock_response = Mock()
        mock_response.status_code = 400
        mock_response.json.return_value = {"error": "Invalid data"}
        mock_post.return_value = mock_response
        
        result = create_ghl_contact("test_token", {"invalid": "data"})
        
        assert "error" in result
        assert result["status_code"] == 400



