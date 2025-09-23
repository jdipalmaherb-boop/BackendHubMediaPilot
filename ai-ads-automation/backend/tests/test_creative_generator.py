"""
Tests for the Creative Generator module.
"""

import pytest
from unittest.mock import Mock, patch
from app.modules.creative.generator import CreativeGenerator
from app.modules.creative.video_app_client import VideoAppClient
from app.modules.creative.synthetic_generator import SyntheticCreativeGenerator
from app.schemas.creative import CreativeGenerateRequest, CreativeOptimizeRequest


class TestCreativeGenerator:
    """Test cases for CreativeGenerator."""

    @pytest.fixture
    def mock_video_app_client(self):
        """Mock video app client for testing."""
        client = Mock(spec=VideoAppClient)
        client.is_available.return_value = True
        client.generate_video_creatives.return_value = []
        client.optimize_video_creative.return_value = "optimized_url"
        return client

    @pytest.fixture
    def mock_synthetic_generator(self):
        """Mock synthetic generator for testing."""
        generator = Mock(spec=SyntheticCreativeGenerator)
        generator.generate_synthetic_creatives.return_value = []
        generator.optimize_creative_asset.return_value = "optimized_url"
        return generator

    @pytest.fixture
    def creative_generator(self, mock_video_app_client, mock_synthetic_generator):
        """CreativeGenerator instance with mocked dependencies."""
        return CreativeGenerator(
            video_app_client=mock_video_app_client,
            synthetic_generator=mock_synthetic_generator
        )

    @pytest.mark.asyncio
    async def test_generate_creatives_video(self, creative_generator):
        """Test generating video creatives."""
        request = CreativeGenerateRequest(
            campaign_id="test_campaign",
            product_description="Test product",
            ad_copy={"headline": "Test", "primary_text": "Test", "cta_text": "Test"},
            media_type="video",
            num_variations=3,
            original_media_url="http://example.com/video.mp4"
        )

        result = await creative_generator.generate_creatives(request)

        assert isinstance(result, list)
        creative_generator.video_app_client.generate_video_creatives.assert_called_once()

    @pytest.mark.asyncio
    async def test_generate_creatives_image(self, creative_generator):
        """Test generating image creatives."""
        request = CreativeGenerateRequest(
            campaign_id="test_campaign",
            product_description="Test product",
            ad_copy={"headline": "Test", "primary_text": "Test", "cta_text": "Test"},
            media_type="image",
            num_variations=3
        )

        result = await creative_generator.generate_creatives(request)

        assert isinstance(result, list)
        creative_generator.synthetic_generator.generate_synthetic_creatives.assert_called_once()

    @pytest.mark.asyncio
    async def test_generate_creatives_video_app_unavailable(self, creative_generator):
        """Test generating creatives when video app is unavailable."""
        creative_generator.video_app_client.is_available.return_value = False

        request = CreativeGenerateRequest(
            campaign_id="test_campaign",
            product_description="Test product",
            ad_copy={"headline": "Test", "primary_text": "Test", "cta_text": "Test"},
            media_type="video",
            num_variations=3,
            original_media_url="http://example.com/video.mp4"
        )

        result = await creative_generator.generate_creatives(request)

        assert isinstance(result, list)
        creative_generator.synthetic_generator.generate_synthetic_creatives.assert_called_once()

    @pytest.mark.asyncio
    async def test_generate_creatives_video_app_failure(self, creative_generator):
        """Test generating creatives when video app fails."""
        creative_generator.video_app_client.generate_video_creatives.side_effect = Exception("Video app error")

        request = CreativeGenerateRequest(
            campaign_id="test_campaign",
            product_description="Test product",
            ad_copy={"headline": "Test", "primary_text": "Test", "cta_text": "Test"},
            media_type="video",
            num_variations=3,
            original_media_url="http://example.com/video.mp4"
        )

        result = await creative_generator.generate_creatives(request)

        assert isinstance(result, list)
        creative_generator.synthetic_generator.generate_synthetic_creatives.assert_called_once()

    @pytest.mark.asyncio
    async def test_optimize_creative_video(self, creative_generator):
        """Test optimizing video creative."""
        request = CreativeOptimizeRequest(
            creative_id="test_creative",
            media_url="http://example.com/video.mp4",
            media_type="video",
            platform_optimized_for="meta",
            ad_copy={"headline": "Test", "primary_text": "Test", "cta_text": "Test"}
        )

        result = await creative_generator.optimize_creative(request)

        assert result.creative_id == "test_creative"
        assert result.optimized_media_url == "optimized_url"
        assert result.engagement_score == 0.85
        assert result.conversion_potential_score == 0.75

    @pytest.mark.asyncio
    async def test_optimize_creative_image(self, creative_generator):
        """Test optimizing image creative."""
        request = CreativeOptimizeRequest(
            creative_id="test_creative",
            media_url="http://example.com/image.jpg",
            media_type="image",
            platform_optimized_for="google",
            ad_copy={"headline": "Test", "primary_text": "Test", "cta_text": "Test"}
        )

        result = await creative_generator.optimize_creative(request)

        assert result.creative_id == "test_creative"
        assert result.optimized_media_url == "optimized_url"
        assert result.engagement_score == 0.85
        assert result.conversion_potential_score == 0.75

    @pytest.mark.asyncio
    async def test_optimize_creative_video_app_unavailable(self, creative_generator):
        """Test optimizing creative when video app is unavailable."""
        creative_generator.video_app_client.is_available.return_value = False

        request = CreativeOptimizeRequest(
            creative_id="test_creative",
            media_url="http://example.com/video.mp4",
            media_type="video",
            platform_optimized_for="meta",
            ad_copy={"headline": "Test", "primary_text": "Test", "cta_text": "Test"}
        )

        result = await creative_generator.optimize_creative(request)

        assert result.creative_id == "test_creative"
        assert result.optimized_media_url == "optimized_url"
        creative_generator.synthetic_generator.optimize_creative_asset.assert_called_once()

    @pytest.mark.asyncio
    async def test_optimize_creative_video_app_failure(self, creative_generator):
        """Test optimizing creative when video app fails."""
        creative_generator.video_app_client.optimize_video_creative.side_effect = Exception("Video app error")

        request = CreativeOptimizeRequest(
            creative_id="test_creative",
            media_url="http://example.com/video.mp4",
            media_type="video",
            platform_optimized_for="meta",
            ad_copy={"headline": "Test", "primary_text": "Test", "cta_text": "Test"}
        )

        result = await creative_generator.optimize_creative(request)

        assert result.creative_id == "test_creative"
        assert result.optimized_media_url == "optimized_url"
        creative_generator.synthetic_generator.optimize_creative_asset.assert_called_once()



