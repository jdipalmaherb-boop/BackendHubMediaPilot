"""
Tests for the feedback loop module.
"""

import pytest
from unittest.mock import Mock, patch
from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from app.modules.feedback_loop.feedback_service import FeedbackService
from app.modules.feedback_loop.embedding_store import EmbeddingStore
from app.schemas.feedback_loop import MetricsIngestRequest, WinnerSearchRequest


class TestFeedbackService:
    """Test cases for FeedbackService."""

    @pytest.fixture
    def mock_db(self):
        """Mock database session."""
        return Mock()

    @pytest.fixture
    def feedback_service(self):
        """FeedbackService instance for testing."""
        return FeedbackService()

    def test_compute_ctr(self, feedback_service):
        """Test CTR calculation."""
        # Normal case
        assert feedback_service.compute_ctr(1000, 50) == 0.05
        
        # Zero impressions
        assert feedback_service.compute_ctr(0, 50) == 0.0
        
        # Zero clicks
        assert feedback_service.compute_ctr(1000, 0) == 0.0
        
        # Both zero
        assert feedback_service.compute_ctr(0, 0) == 0.0

    def test_ingest_metrics_success(self, feedback_service, mock_db):
        """Test successful metrics ingestion."""
        post_id = str(uuid4())
        
        with patch.object(mock_db, 'add') as mock_add, \
             patch.object(mock_db, 'commit') as mock_commit:
            
            result = feedback_service.ingest_metrics(
                db=mock_db,
                post_id=post_id,
                platform="facebook",
                impressions=1000,
                clicks=50,
                conversions=5,
                revenue=Decimal("100.50")
            )
            
            assert result is True
            mock_add.assert_called_once()
            mock_commit.assert_called_once()

    def test_ingest_metrics_failure(self, feedback_service, mock_db):
        """Test metrics ingestion failure."""
        post_id = str(uuid4())
        
        with patch.object(mock_db, 'add') as mock_add, \
             patch.object(mock_db, 'commit', side_effect=Exception("DB Error")):
            
            result = feedback_service.ingest_metrics(
                db=mock_db,
                post_id=post_id,
                platform="facebook",
                impressions=1000,
                clicks=50,
                conversions=5,
                revenue=Decimal("100.50")
            )
            
            assert result is False

    def test_find_best_post(self, feedback_service, mock_db):
        """Test finding the best post."""
        # Mock posts
        post1 = Mock()
        post1.id = "post1"
        
        post2 = Mock()
        post2.id = "post2"
        
        posts = [post1, post2]
        
        # Mock metrics
        metric1 = Mock()
        metric1.conversions = 10
        metric1.ctr = 0.05
        metric1.revenue = Decimal("100.0")
        
        metric2 = Mock()
        metric2.conversions = 15
        metric2.ctr = 0.08
        metric2.revenue = Decimal("200.0")
        
        with patch.object(mock_db, 'query') as mock_query:
            mock_query.return_value.filter_by.return_value.order_by.return_value.first.side_effect = [metric1, metric2]
            
            best_post = feedback_service._find_best_post(mock_db, posts)
            
            assert best_post == post2  # post2 has higher score

    def test_find_best_post_no_metrics(self, feedback_service, mock_db):
        """Test finding best post when no metrics exist."""
        post1 = Mock()
        post1.id = "post1"
        
        posts = [post1]
        
        with patch.object(mock_db, 'query') as mock_query:
            mock_query.return_value.filter_by.return_value.order_by.return_value.first.return_value = None
            
            best_post = feedback_service._find_best_post(mock_db, posts)
            
            assert best_post is None

    def test_search_similar_content(self, feedback_service):
        """Test searching for similar content."""
        # Add some test content
        feedback_service.embedding_store.add(
            key="test:1",
            text="Amazing new product launch!",
            metadata={"brand": "test"}
        )
        
        feedback_service.embedding_store.add(
            key="test:2",
            text="Check out our latest innovation!",
            metadata={"brand": "test"}
        )
        
        # Search for similar content
        results = feedback_service.search_similar_content(
            query_text="New product announcement",
            limit=5
        )
        
        assert len(results) > 0
        assert all("similarity_score" in result for result in results)
        assert all("content" in result for result in results)

    def test_get_winning_content_for_brand(self, feedback_service):
        """Test getting winning content for a brand."""
        brand_id = "brand123"
        
        # Add some test content
        feedback_service.embedding_store.add(
            key=f"brand:{brand_id}:winner:post1",
            text="Winning content 1",
            metadata={"brand_id": brand_id}
        )
        
        feedback_service.embedding_store.add(
            key=f"brand:{brand_id}:winner:post2",
            text="Winning content 2",
            metadata={"brand_id": brand_id}
        )
        
        # Get winning content for brand
        winners = feedback_service.get_winning_content_for_brand(brand_id)
        
        assert len(winners) == 2
        assert all(winner["key"].startswith(f"brand:{brand_id}:winner:") for winner in winners)

    def test_get_feedback_stats(self, feedback_service):
        """Test getting feedback statistics."""
        # Add some test content
        feedback_service.embedding_store.add(
            key="brand:1:winner:post1",
            text="Test content 1",
            metadata={}
        )
        
        feedback_service.embedding_store.add(
            key="brand:2:winner:post2",
            text="Test content 2",
            metadata={}
        )
        
        stats = feedback_service.get_feedback_stats()
        
        assert "total_items" in stats
        assert "brands_with_winners" in stats
        assert "brand_counts" in stats
        assert stats["total_items"] == 2
        assert stats["brands_with_winners"] == 2


class TestEmbeddingStore:
    """Test cases for EmbeddingStore."""

    @pytest.fixture
    def embedding_store(self):
        """EmbeddingStore instance for testing."""
        return EmbeddingStore()

    def test_add_content(self, embedding_store):
        """Test adding content to the store."""
        key = "test:1"
        text = "Test content"
        metadata = {"brand": "test"}
        
        result = embedding_store.add(key, text, metadata)
        
        assert result is True
        assert key in embedding_store.store
        assert embedding_store.store[key]["text"] == text
        assert embedding_store.store[key]["metadata"] == metadata

    def test_get_content(self, embedding_store):
        """Test retrieving content from the store."""
        key = "test:1"
        text = "Test content"
        metadata = {"brand": "test"}
        
        embedding_store.add(key, text, metadata)
        result = embedding_store.get(key)
        
        assert result is not None
        assert result["text"] == text
        assert result["metadata"] == metadata

    def test_get_nonexistent_content(self, embedding_store):
        """Test retrieving nonexistent content."""
        result = embedding_store.get("nonexistent")
        assert result is None

    def test_search_content(self, embedding_store):
        """Test searching for content."""
        # Add some test content
        embedding_store.add("test:1", "Amazing new product launch!", {"brand": "test"})
        embedding_store.add("test:2", "Check out our latest innovation!", {"brand": "test"})
        embedding_store.add("test:3", "Completely different content", {"brand": "other"})
        
        # Search for similar content
        results = embedding_store.search("new product announcement", limit=2)
        
        assert len(results) <= 2
        assert all(isinstance(result, tuple) and len(result) == 3 for result in results)
        assert all(isinstance(result[1], float) for result in results)  # similarity score

    def test_delete_content(self, embedding_store):
        """Test deleting content from the store."""
        key = "test:1"
        text = "Test content"
        
        embedding_store.add(key, text)
        assert key in embedding_store.store
        
        result = embedding_store.delete(key)
        assert result is True
        assert key not in embedding_store.store

    def test_delete_nonexistent_content(self, embedding_store):
        """Test deleting nonexistent content."""
        result = embedding_store.delete("nonexistent")
        assert result is False

    def test_get_brand_winners(self, embedding_store):
        """Test getting winners for a specific brand."""
        brand_id = "brand123"
        
        # Add content for different brands
        embedding_store.add(f"brand:{brand_id}:winner:post1", "Content 1", {"brand_id": brand_id})
        embedding_store.add(f"brand:{brand_id}:winner:post2", "Content 2", {"brand_id": brand_id})
        embedding_store.add("brand:other:winner:post3", "Content 3", {"brand_id": "other"})
        
        winners = embedding_store.get_brand_winners(brand_id)
        
        assert len(winners) == 2
        assert all(winner["key"].startswith(f"brand:{brand_id}:winner:") for winner in winners)

    def test_get_stats(self, embedding_store):
        """Test getting store statistics."""
        # Add some test content
        embedding_store.add("brand:1:winner:post1", "Content 1", {})
        embedding_store.add("brand:1:winner:post2", "Content 2", {})
        embedding_store.add("brand:2:winner:post3", "Content 3", {})
        
        stats = embedding_store.get_stats()
        
        assert stats["total_items"] == 3
        assert stats["brands_with_winners"] == 2
        assert "brand_counts" in stats
        assert stats["brand_counts"]["1"] == 2
        assert stats["brand_counts"]["2"] == 1

    def test_dummy_embedding_generation(self, embedding_store):
        """Test dummy embedding generation."""
        text = "Test content for embedding"
        embedding = embedding_store._generate_dummy_embedding(text)
        
        assert len(embedding) == 128
        assert isinstance(embedding, type(embedding_store._generate_dummy_embedding("other")))
        
        # Test that same text produces same embedding
        embedding2 = embedding_store._generate_dummy_embedding(text)
        assert (embedding == embedding2).all()

    def test_similarity_computation(self, embedding_store):
        """Test similarity computation."""
        embedding1 = embedding_store._generate_dummy_embedding("Test content 1")
        embedding2 = embedding_store._generate_dummy_embedding("Test content 2")
        embedding3 = embedding_store._generate_dummy_embedding("Test content 1")  # Same as 1
        
        # Same embeddings should have similarity of 1.0
        similarity_same = embedding_store._compute_similarity(embedding1, embedding3)
        assert abs(similarity_same - 1.0) < 0.001
        
        # Different embeddings should have similarity < 1.0
        similarity_diff = embedding_store._compute_similarity(embedding1, embedding2)
        assert similarity_diff < 1.0
        assert similarity_diff >= 0.0



