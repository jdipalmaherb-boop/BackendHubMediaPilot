"""
Tests for the Ad Copy Generator module.
"""

import pytest
from unittest.mock import Mock, patch
from app.modules.ad_copy.generator import AdCopyGenerator
from app.modules.ad_copy.llm_client import OpenAIClient


class TestAdCopyGenerator:
    """Test cases for AdCopyGenerator."""

    @pytest.fixture
    def mock_llm_client(self):
        """Mock LLM client for testing."""
        client = Mock(spec=OpenAIClient)
        client.generate_text.return_value = [
            '{"variations": [{"headline": "Test Headline", "primary_text": "Test Text", "cta_text": "Test CTA", "sabri_suby_score": 0.9}]}'
        ]
        return client

    @pytest.fixture
    def ad_copy_generator(self, mock_llm_client):
        """AdCopyGenerator instance with mocked LLM client."""
        return AdCopyGenerator(llm_client=mock_llm_client)

    @pytest.mark.asyncio
    async def test_generate_ad_copy_variations(self, ad_copy_generator):
        """Test generating ad copy variations."""
        product_description = "Test product"
        target_audience = {"age": "25-45", "interests": ["technology"]}
        campaign_goal = "lead_generation"

        result = await ad_copy_generator.generate_ad_copy_variations(
            product_description=product_description,
            target_audience=target_audience,
            campaign_goal=campaign_goal,
            num_variations=3
        )

        assert isinstance(result, list)
        assert len(result) > 0
        assert "headline" in result[0]
        assert "primary_text" in result[0]
        assert "cta_text" in result[0]
        assert "confidence_score" in result[0]

    @pytest.mark.asyncio
    async def test_predict_conversion_potential(self, ad_copy_generator):
        """Test predicting conversion potential."""
        ad_copy = {
            "headline": "Test Headline",
            "primary_text": "Test Text",
            "cta_text": "Buy Now"
        }

        result = await ad_copy_generator.predict_conversion_potential(ad_copy)

        assert isinstance(result, float)
        assert 0 <= result <= 1

    @pytest.mark.asyncio
    async def test_generate_ad_copy_variations_with_existing_copy(self, ad_copy_generator):
        """Test generating ad copy variations with existing copy."""
        product_description = "Test product"
        target_audience = {"age": "25-45", "interests": ["technology"]}
        campaign_goal = "lead_generation"
        existing_copy = "Existing ad copy"

        result = await ad_copy_generator.generate_ad_copy_variations(
            product_description=product_description,
            target_audience=target_audience,
            campaign_goal=campaign_goal,
            num_variations=3,
            existing_copy=existing_copy
        )

        assert isinstance(result, list)
        assert len(result) > 0

    @pytest.mark.asyncio
    async def test_generate_ad_copy_variations_empty_response(self, ad_copy_generator):
        """Test handling empty response from LLM."""
        ad_copy_generator.llm_client.generate_text.return_value = []

        result = await ad_copy_generator.generate_ad_copy_variations(
            product_description="Test product",
            target_audience={"age": "25-45"},
            campaign_goal="lead_generation"
        )

        assert result == []

    @pytest.mark.asyncio
    async def test_generate_ad_copy_variations_invalid_json(self, ad_copy_generator):
        """Test handling invalid JSON response from LLM."""
        ad_copy_generator.llm_client.generate_text.return_value = ["Invalid JSON"]

        result = await ad_copy_generator.generate_ad_copy_variations(
            product_description="Test product",
            target_audience={"age": "25-45"},
            campaign_goal="lead_generation"
        )

        assert result == []

    @pytest.mark.asyncio
    async def test_generate_ad_copy_variations_exception(self, ad_copy_generator):
        """Test handling exception during generation."""
        ad_copy_generator.llm_client.generate_text.side_effect = Exception("Test exception")

        result = await ad_copy_generator.generate_ad_copy_variations(
            product_description="Test product",
            target_audience={"age": "25-45"},
            campaign_goal="lead_generation"
        )

        assert result == []



