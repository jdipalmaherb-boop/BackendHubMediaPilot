"""
Tests for social media posts and metrics.
"""

import pytest
from unittest.mock import Mock, patch
from datetime import datetime, timedelta
from uuid import uuid4
from decimal import Decimal

from app.models.social_media import Post, PostMetric
from app.schemas.social_media import PostCreate, PostMetricCreate, PostUpdate, PostMetricUpdate


class TestPostModel:
    """Test cases for Post model."""

    def test_post_creation(self):
        """Test creating a post."""
        brand_id = uuid4()
        post = Post(
            brand_id=brand_id,
            variant="primary",
            content="Test post content"
        )
        
        assert post.brand_id == brand_id
        assert post.variant == "primary"
        assert post.content == "Test post content"
        assert post.created_at is not None

    def test_post_variant_validation(self):
        """Test post variant validation."""
        brand_id = uuid4()
        
        # Valid variants
        for variant in ["primary", "A", "B"]:
            post = Post(
                brand_id=brand_id,
                variant=variant,
                content="Test content"
            )
            assert post.variant == variant

    def test_post_repr(self):
        """Test post string representation."""
        brand_id = uuid4()
        post = Post(
            id=uuid4(),
            brand_id=brand_id,
            variant="primary",
            content="Test content"
        )
        
        repr_str = repr(post)
        assert "Post" in repr_str
        assert str(post.id) in repr_str
        assert str(brand_id) in repr_str
        assert "primary" in repr_str


class TestPostMetricModel:
    """Test cases for PostMetric model."""

    def test_post_metric_creation(self):
        """Test creating a post metric."""
        post_id = uuid4()
        metric = PostMetric(
            post_id=post_id,
            platform="facebook",
            impressions=1000,
            clicks=50,
            ctr=0.05,
            conversions=5,
            revenue=Decimal("100.50")
        )
        
        assert metric.post_id == post_id
        assert metric.platform == "facebook"
        assert metric.impressions == 1000
        assert metric.clicks == 50
        assert metric.ctr == 0.05
        assert metric.conversions == 5
        assert metric.revenue == Decimal("100.50")
        assert metric.collected_at is not None

    def test_calculated_ctr(self):
        """Test calculated CTR property."""
        post_id = uuid4()
        
        # Test with impressions > 0
        metric = PostMetric(
            post_id=post_id,
            platform="facebook",
            impressions=1000,
            clicks=50,
            ctr=0.05
        )
        assert metric.calculated_ctr == 0.05
        
        # Test with impressions = 0
        metric.impressions = 0
        assert metric.calculated_ctr == 0.05  # Should return stored CTR

    def test_conversion_rate(self):
        """Test conversion rate property."""
        post_id = uuid4()
        
        # Test with clicks > 0
        metric = PostMetric(
            post_id=post_id,
            platform="facebook",
            clicks=100,
            conversions=10
        )
        assert metric.conversion_rate == 0.1
        
        # Test with clicks = 0
        metric.clicks = 0
        assert metric.conversion_rate == 0.0

    def test_revenue_per_conversion(self):
        """Test revenue per conversion property."""
        post_id = uuid4()
        
        # Test with conversions > 0
        metric = PostMetric(
            post_id=post_id,
            platform="facebook",
            conversions=10,
            revenue=Decimal("100.00")
        )
        assert metric.revenue_per_conversion == 10.0
        
        # Test with conversions = 0
        metric.conversions = 0
        assert metric.revenue_per_conversion == 0.0

    def test_post_metric_repr(self):
        """Test post metric string representation."""
        post_id = uuid4()
        metric = PostMetric(
            id=uuid4(),
            post_id=post_id,
            platform="facebook"
        )
        
        repr_str = repr(metric)
        assert "PostMetric" in repr_str
        assert str(metric.id) in repr_str
        assert str(post_id) in repr_str
        assert "facebook" in repr_str


class TestPostSchemas:
    """Test cases for Post schemas."""

    def test_post_create_schema(self):
        """Test PostCreate schema validation."""
        brand_id = uuid4()
        
        # Valid data
        post_data = PostCreate(
            brand_id=brand_id,
            variant="primary",
            content="Test content"
        )
        assert post_data.brand_id == brand_id
        assert post_data.variant == "primary"
        assert post_data.content == "Test content"

    def test_post_create_variant_validation(self):
        """Test PostCreate variant validation."""
        brand_id = uuid4()
        
        # Valid variants
        for variant in ["primary", "A", "B"]:
            post_data = PostCreate(
                brand_id=brand_id,
                variant=variant,
                content="Test content"
            )
            assert post_data.variant == variant
        
        # Invalid variant
        with pytest.raises(ValueError):
            PostCreate(
                brand_id=brand_id,
                variant="invalid",
                content="Test content"
            )

    def test_post_update_schema(self):
        """Test PostUpdate schema validation."""
        # Valid update data
        update_data = PostUpdate(
            variant="A",
            content="Updated content"
        )
        assert update_data.variant == "A"
        assert update_data.content == "Updated content"
        
        # Partial update
        update_data = PostUpdate(variant="B")
        assert update_data.variant == "B"
        assert update_data.content is None

    def test_post_metric_create_schema(self):
        """Test PostMetricCreate schema validation."""
        post_id = uuid4()
        
        # Valid data
        metric_data = PostMetricCreate(
            post_id=post_id,
            platform="facebook",
            impressions=1000,
            clicks=50,
            ctr=0.05,
            conversions=5,
            revenue=Decimal("100.50")
        )
        assert metric_data.post_id == post_id
        assert metric_data.platform == "facebook"
        assert metric_data.impressions == 1000
        assert metric_data.clicks == 50
        assert metric_data.ctr == 0.05
        assert metric_data.conversions == 5
        assert metric_data.revenue == Decimal("100.50")

    def test_post_metric_create_validation(self):
        """Test PostMetricCreate validation rules."""
        post_id = uuid4()
        
        # Test negative values are rejected
        with pytest.raises(ValueError):
            PostMetricCreate(
                post_id=post_id,
                platform="facebook",
                impressions=-1
            )
        
        with pytest.raises(ValueError):
            PostMetricCreate(
                post_id=post_id,
                platform="facebook",
                clicks=-1
            )
        
        with pytest.raises(ValueError):
            PostMetricCreate(
                post_id=post_id,
                platform="facebook",
                ctr=1.5  # CTR should be <= 1.0
            )
        
        with pytest.raises(ValueError):
            PostMetricCreate(
                post_id=post_id,
                platform="facebook",
                conversions=-1
            )
        
        with pytest.raises(ValueError):
            PostMetricCreate(
                post_id=post_id,
                platform="facebook",
                revenue=Decimal("-10.0")
            )

    def test_post_metric_update_schema(self):
        """Test PostMetricUpdate schema validation."""
        # Valid update data
        update_data = PostMetricUpdate(
            impressions=2000,
            clicks=100,
            ctr=0.05
        )
        assert update_data.impressions == 2000
        assert update_data.clicks == 100
        assert update_data.ctr == 0.05
        
        # Partial update
        update_data = PostMetricUpdate(impressions=1500)
        assert update_data.impressions == 1500
        assert update_data.clicks is None



