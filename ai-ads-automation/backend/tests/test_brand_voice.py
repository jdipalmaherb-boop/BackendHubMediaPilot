"""
Tests for the brand voice assistant.
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
from app.modules.brand_voice.assistant import BrandVoiceAssistant
from app.schemas.brand_voice import CaptionGenerateRequest, CaptionAnalyzeRequest


class TestBrandVoiceAssistant:
    """Test cases for BrandVoiceAssistant."""

    @pytest.fixture
    def mock_llm_client(self):
        """Mock LLM client for testing."""
        client = Mock()
        client.generate_text = AsyncMock(return_value=[
            '{"primary": "Test primary caption", "alts": ["Alt 1", "Alt 2"], "hashtags": ["#test", "#brand"], "cta": "Shop now!"}'
        ])
        return client

    @pytest.fixture
    def mock_feedback_service(self):
        """Mock feedback service for testing."""
        service = Mock()
        service.get_winning_content_for_brand = AsyncMock(return_value=[
            {"content": "Winning content 1"},
            {"content": "Winning content 2"},
            {"content": "Winning content 3"}
        ])
        service.search_similar_content = AsyncMock(return_value=[
            {"content": "Similar content 1"},
            {"content": "Similar content 2"}
        ])
        return service

    @pytest.fixture
    def assistant(self, mock_llm_client, mock_feedback_service):
        """BrandVoiceAssistant instance for testing."""
        return BrandVoiceAssistant(
            llm_client=mock_llm_client,
            feedback_service=mock_feedback_service
        )

    @pytest.mark.asyncio
    async def test_generate_caption_success(self, assistant):
        """Test successful caption generation."""
        result = await assistant.generate_caption(
            brand="TestBrand",
            platform="instagram",
            tone="casual",
            top_winning_examples=["Example 1", "Example 2", "Example 3"]
        )
        
        assert "primary" in result
        assert "alts" in result
        assert "hashtags" in result
        assert "cta" in result
        assert len(result["alts"]) == 2
        assert len(result["hashtags"]) == 10

    @pytest.mark.asyncio
    async def test_generate_caption_llm_error(self, assistant):
        """Test caption generation when LLM fails."""
        assistant.llm_client.generate_text = AsyncMock(return_value=[])
        
        result = await assistant.generate_caption(
            brand="TestBrand",
            platform="instagram",
            tone="casual",
            top_winning_examples=["Example 1"]
        )
        
        # Should return fallback response
        assert "primary" in result
        assert "TestBrand" in result["primary"]

    @pytest.mark.asyncio
    async def test_generate_caption_invalid_json(self, assistant):
        """Test caption generation with invalid JSON response."""
        assistant.llm_client.generate_text = AsyncMock(return_value=["Invalid JSON"])
        
        result = await assistant.generate_caption(
            brand="TestBrand",
            platform="instagram",
            tone="casual",
            top_winning_examples=["Example 1"]
        )
        
        # Should return fallback response
        assert "primary" in result
        assert "TestBrand" in result["primary"]

    @pytest.mark.asyncio
    async def test_get_winning_examples_for_brand(self, assistant):
        """Test getting winning examples for a brand."""
        examples = await assistant.get_winning_examples_for_brand("brand123", 3)
        
        assert len(examples) == 3
        assert all(isinstance(example, str) for example in examples)

    @pytest.mark.asyncio
    async def test_get_winning_examples_error(self, assistant):
        """Test getting winning examples when feedback service fails."""
        assistant.feedback_service.get_winning_content_for_brand = AsyncMock(
            side_effect=Exception("Feedback service error")
        )
        
        examples = await assistant.get_winning_examples_for_brand("brand123", 3)
        
        # Should return fallback examples
        assert len(examples) == 3
        assert all("brand123" in example for example in examples)

    @pytest.mark.asyncio
    async def test_search_similar_content(self, assistant):
        """Test searching for similar content."""
        results = await assistant.search_similar_content("test query", 3)
        
        assert len(results) == 2
        assert all(isinstance(result, str) for result in results)

    @pytest.mark.asyncio
    async def test_search_similar_content_error(self, assistant):
        """Test searching similar content when service fails."""
        assistant.feedback_service.search_similar_content = AsyncMock(
            side_effect=Exception("Search error")
        )
        
        results = await assistant.search_similar_content("test query", 3)
        
        # Should return fallback results
        assert len(results) == 3
        assert all(isinstance(result, str) for result in results)

    @pytest.mark.asyncio
    async def test_analyze_caption(self, assistant):
        """Test caption analysis."""
        caption = "🚀 Amazing product! Shop now! #test #brand"
        
        analysis = await assistant.analyze_caption(caption)
        
        assert analysis.character_count == len(caption)
        assert analysis.word_count > 0
        assert analysis.hashtag_count == 2
        assert analysis.emoji_count > 0
        assert analysis.has_urgency is True
        assert analysis.has_clear_cta is True
        assert analysis.conversion_potential in ["low", "medium", "high"]

    @pytest.mark.asyncio
    async def test_analyze_caption_error(self, assistant):
        """Test caption analysis with error handling."""
        # This should not raise an exception
        analysis = await assistant.analyze_caption("")
        
        assert analysis.character_count == 0
        assert analysis.word_count == 0
        assert analysis.conversion_potential == "low"

    @pytest.mark.asyncio
    async def test_get_stats(self, assistant):
        """Test getting statistics."""
        stats = await assistant.get_stats()
        
        assert "total_generations" in stats
        assert "brands_served" in stats
        assert "platforms_used" in stats
        assert "average_character_count" in stats
        assert "success_rate" in stats

    def test_create_system_prompt(self, assistant):
        """Test system prompt creation."""
        prompt = assistant._create_system_prompt("TestBrand", "instagram", "casual")
        
        assert "TestBrand" in prompt
        assert "instagram" in prompt
        assert "casual" in prompt
        assert "JSON" in prompt
        assert "primary" in prompt
        assert "alts" in prompt
        assert "hashtags" in prompt
        assert "cta" in prompt

    def test_create_user_prompt(self, assistant):
        """Test user prompt creation."""
        prompt = assistant._create_user_prompt(
            brand="TestBrand",
            platform="instagram",
            tone="casual",
            top_winning_examples=["Example 1", "Example 2"],
            product_description="Test product",
            target_audience="Young adults"
        )
        
        assert "TestBrand" in prompt
        assert "instagram" in prompt
        assert "casual" in prompt
        assert "Example 1" in prompt
        assert "Example 2" in prompt
        assert "Test product" in prompt
        assert "Young adults" in prompt

    def test_validate_and_clean_response(self, assistant):
        """Test response validation and cleaning."""
        # Test with valid response
        valid_response = {
            "primary": "Test primary",
            "alts": ["Alt 1", "Alt 2"],
            "hashtags": ["#test", "#brand"],
            "cta": "Shop now!"
        }
        
        result = assistant._validate_and_clean_response(valid_response, "TestBrand", "instagram")
        
        assert result["primary"] == "Test primary"
        assert len(result["alts"]) == 2
        assert len(result["hashtags"]) == 10  # Should be padded to 10
        assert result["cta"] == "Shop now!"

    def test_validate_and_clean_response_missing_keys(self, assistant):
        """Test response validation with missing keys."""
        incomplete_response = {
            "primary": "Test primary"
        }
        
        result = assistant._validate_and_clean_response(incomplete_response, "TestBrand", "instagram")
        
        assert "primary" in result
        assert "alts" in result
        assert "hashtags" in result
        assert "cta" in result
        assert len(result["alts"]) == 2
        assert len(result["hashtags"]) == 10

    def test_truncate_text(self, assistant):
        """Test text truncation."""
        long_text = "This is a very long text that should be truncated because it exceeds the maximum length allowed for captions on social media platforms"
        
        truncated = assistant._truncate_text(long_text, 50)
        
        assert len(truncated) <= 53  # 50 + "..."
        assert truncated.endswith("...")

    def test_truncate_text_short(self, assistant):
        """Test text truncation with short text."""
        short_text = "Short text"
        
        truncated = assistant._truncate_text(short_text, 50)
        
        assert truncated == short_text

    def test_generate_default_hashtags(self, assistant):
        """Test default hashtag generation."""
        hashtags = assistant._generate_default_hashtags("Test Brand", "instagram")
        
        assert len(hashtags) == 10
        assert all(hashtag.startswith("#") for hashtag in hashtags)
        assert "#testbrand" in hashtags

    def test_create_fallback_response(self, assistant):
        """Test fallback response creation."""
        response = assistant._create_fallback_response("TestBrand", "instagram")
        
        assert "primary" in response
        assert "alts" in response
        assert "hashtags" in response
        assert "cta" in response
        assert "TestBrand" in response["primary"]
        assert len(response["alts"]) == 2
        assert len(response["hashtags"]) == 10



