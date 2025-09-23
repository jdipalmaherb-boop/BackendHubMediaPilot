"""
SQLAlchemy models for social media posts and metrics.
"""

from sqlalchemy import Column, String, Integer, Float, Numeric, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from .base import BaseModel


class Post(BaseModel):
    """Model for social media posts with A/B testing support."""
    
    __tablename__ = "posts"

    brand_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    variant = Column(String, nullable=False, index=True)
    content = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    metrics = relationship("PostMetric", back_populates="post", cascade="all, delete-orphan")

    # Constraints
    __table_args__ = (
        CheckConstraint("variant IN ('primary', 'A', 'B')", name="check_variant"),
    )

    def __repr__(self):
        return f"<Post(id={self.id}, brand_id={self.brand_id}, variant={self.variant})>"


class PostMetric(BaseModel):
    """Model for post performance metrics across platforms."""
    
    __tablename__ = "post_metrics"

    post_id = Column(UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    platform = Column(String, nullable=False, index=True)
    impressions = Column(Integer, default=0, nullable=False)
    clicks = Column(Integer, default=0, nullable=False)
    ctr = Column(Float, default=0.0, nullable=False)
    conversions = Column(Integer, default=0, nullable=False)
    revenue = Column(Numeric(10, 2), default=0.0, nullable=False)
    collected_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    # Relationships
    post = relationship("Post", back_populates="metrics")

    def __repr__(self):
        return f"<PostMetric(id={self.id}, post_id={self.post_id}, platform={self.platform})>"

    @property
    def calculated_ctr(self) -> float:
        """Calculate CTR if impressions > 0, otherwise return stored CTR."""
        if self.impressions > 0:
            return self.clicks / self.impressions
        return self.ctr

    @property
    def conversion_rate(self) -> float:
        """Calculate conversion rate if clicks > 0, otherwise return 0."""
        if self.clicks > 0:
            return self.conversions / self.clicks
        return 0.0

    @property
    def revenue_per_conversion(self) -> float:
        """Calculate revenue per conversion if conversions > 0, otherwise return 0."""
        if self.conversions > 0:
            return float(self.revenue) / self.conversions
        return 0.0



