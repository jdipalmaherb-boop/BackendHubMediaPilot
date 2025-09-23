"""
AI-related database models for learning and optimization.
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import (
    Boolean, Column, DateTime, Enum as SQLEnum, ForeignKey, 
    Integer, Numeric, String, Text, JSON
)
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin, MetadataMixin


class OptimizationType(str, Enum):
    """Optimization type enumeration."""
    BID_ADJUSTMENT = "bid_adjustment"
    BUDGET_REALLOCATION = "budget_reallocation"
    AUDIENCE_EXPANSION = "audience_expansion"
    CREATIVE_REPLACEMENT = "creative_replacement"
    SCHEDULE_ADJUSTMENT = "schedule_adjustment"
    TARGETING_REFINEMENT = "targeting_refinement"


class OptimizationStatus(str, Enum):
    """Optimization status enumeration."""
    PENDING = "pending"
    APPLIED = "applied"
    FAILED = "failed"
    REJECTED = "rejected"
    REVERTED = "reverted"


class ABTestStatus(str, Enum):
    """A/B test status enumeration."""
    RUNNING = "running"
    COMPLETED = "completed"
    PAUSED = "paused"
    CANCELLED = "cancelled"


class ABTestType(str, Enum):
    """A/B test type enumeration."""
    CREATIVE = "creative"
    AUDIENCE = "audience"
    BID_STRATEGY = "bid_strategy"
    TARGETING = "targeting"
    COPY = "copy"
    PLACEMENT = "placement"


class LearningDataType(str, Enum):
    """Learning data type enumeration."""
    CAMPAIGN_PERFORMANCE = "campaign_performance"
    CREATIVE_PERFORMANCE = "creative_performance"
    AUDIENCE_PERFORMANCE = "audience_performance"
    BID_OPTIMIZATION = "bid_optimization"
    COPY_PERFORMANCE = "copy_performance"
    TARGETING_PERFORMANCE = "targeting_performance"


class Optimization(Base, TimestampMixin, MetadataMixin):
    """Optimization model for tracking AI-driven optimizations."""
    
    __tablename__ = "optimizations"
    
    id = Column(String(255), primary_key=True)
    campaign_id = Column(String(255), ForeignKey("campaigns.id"), nullable=False)
    
    # Optimization details
    type = Column(SQLEnum(OptimizationType), nullable=False)
    status = Column(SQLEnum(OptimizationStatus), default=OptimizationStatus.PENDING, nullable=False)
    
    # Action details
    action = Column(JSON, nullable=False)  # The action to be taken
    reason = Column(Text, nullable=True)  # Why this optimization was suggested
    ai_confidence = Column(Numeric(3, 2), nullable=True)  # AI confidence score (0-1)
    
    # Expected impact
    expected_impact = Column(JSON, nullable=True)  # Expected performance changes
    actual_impact = Column(JSON, nullable=True)  # Actual performance changes
    
    # Execution details
    applied_at = Column(DateTime, nullable=True)
    reverted_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Relationships
    campaign = relationship("Campaign", back_populates="optimizations")


class ABTest(Base, TimestampMixin, MetadataMixin):
    """A/B test model for testing different variations."""
    
    __tablename__ = "ab_tests"
    
    id = Column(String(255), primary_key=True)
    campaign_id = Column(String(255), ForeignKey("campaigns.id"), nullable=False)
    
    # Test details
    name = Column(String(255), nullable=False)
    type = Column(SQLEnum(ABTestType), nullable=False)
    status = Column(SQLEnum(ABTestStatus), default=ABTestStatus.RUNNING, nullable=False)
    
    # Test configuration
    variants = Column(JSON, nullable=False)  # Test variants
    traffic_split = Column(JSON, nullable=True)  # Traffic allocation per variant
    success_metrics = Column(JSON, nullable=False)  # Metrics to measure success
    
    # Test results
    winner = Column(String(255), nullable=True)  # Winning variant ID
    confidence = Column(Numeric(3, 2), nullable=True)  # Statistical confidence
    p_value = Column(Numeric(5, 4), nullable=True)  # Statistical significance
    
    # Test duration
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=True)
    min_duration_days = Column(Integer, default=7, nullable=False)
    max_duration_days = Column(Integer, default=30, nullable=False)
    
    # Relationships
    campaign = relationship("Campaign", back_populates="ab_tests")


class LearningData(Base, TimestampMixin, MetadataMixin):
    """Learning data model for storing training data."""
    
    __tablename__ = "learning_data"
    
    id = Column(String(255), primary_key=True)
    campaign_id = Column(String(255), ForeignKey("campaigns.id"), nullable=True)
    
    # Data type and source
    data_type = Column(SQLEnum(LearningDataType), nullable=False)
    source = Column(String(100), nullable=False)  # platform, simulation, etc.
    
    # Input data
    input_data = Column(JSON, nullable=False)  # Input features/context
    output_data = Column(JSON, nullable=True)  # Expected output/target
    actual_output = Column(JSON, nullable=True)  # Actual output/result
    
    # Performance metrics
    accuracy = Column(Numeric(5, 4), nullable=True)  # Prediction accuracy
    performance_score = Column(Numeric(5, 4), nullable=True)  # Overall performance score
    
    # Metadata
    model_version = Column(String(50), nullable=True)
    training_batch = Column(String(50), nullable=True)
    
    # Relationships
    campaign = relationship("Campaign")


class AIModel(Base, TimestampMixin, MetadataMixin):
    """AI model registry for tracking different models."""
    
    __tablename__ = "ai_models"
    
    id = Column(String(255), primary_key=True)
    name = Column(String(255), nullable=False)
    type = Column(String(100), nullable=False)  # copy_generator, optimizer, etc.
    version = Column(String(50), nullable=False)
    
    # Model details
    description = Column(Text, nullable=True)
    model_path = Column(String(500), nullable=True)
    config = Column(JSON, nullable=True)  # Model configuration
    
    # Performance metrics
    accuracy = Column(Numeric(5, 4), nullable=True)
    precision = Column(Numeric(5, 4), nullable=True)
    recall = Column(Numeric(5, 4), nullable=True)
    f1_score = Column(Numeric(5, 4), nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True, nullable=False)
    is_training = Column(Boolean, default=False, nullable=False)
    
    # Training details
    training_data_size = Column(Integer, nullable=True)
    training_duration = Column(Integer, nullable=True)  # in seconds
    last_trained_at = Column(DateTime, nullable=True)


class AdCopy(Base, TimestampMixin, MetadataMixin):
    """Ad copy model for storing generated copy variations."""
    
    __tablename__ = "ad_copies"
    
    id = Column(String(255), primary_key=True)
    campaign_id = Column(String(255), ForeignKey("campaigns.id"), nullable=False)
    
    # Copy content
    headline = Column(String(255), nullable=False)
    primary_text = Column(Text, nullable=False)
    cta_text = Column(String(100), nullable=False)
    
    # Copy metadata
    style = Column(String(50), nullable=True)  # sabri_suby, emotional, etc.
    tone = Column(String(50), nullable=True)  # professional, casual, etc.
    length = Column(Integer, nullable=True)  # Character count
    
    # AI generation details
    ai_generated = Column(Boolean, default=True, nullable=False)
    ai_confidence = Column(Numeric(3, 2), nullable=True)
    ai_model_version = Column(String(50), nullable=True)
    
    # Performance metrics
    impressions = Column(Integer, default=0, nullable=False)
    clicks = Column(Integer, default=0, nullable=False)
    conversions = Column(Integer, default=0, nullable=False)
    ctr = Column(Numeric(5, 4), default=0, nullable=False)
    engagement_rate = Column(Numeric(5, 4), default=0, nullable=False)
    
    # Relationships
    campaign = relationship("Campaign")


class CreativeGeneration(Base, TimestampMixin, MetadataMixin):
    """Creative generation model for tracking AI-generated creatives."""
    
    __tablename__ = "creative_generations"
    
    id = Column(String(255), primary_key=True)
    campaign_id = Column(String(255), ForeignKey("campaigns.id"), nullable=False)
    
    # Creative details
    type = Column(String(50), nullable=False)  # image, video, carousel
    format = Column(String(50), nullable=False)  # single_image, single_video
    platform = Column(String(50), nullable=False)  # meta, google, tiktok
    
    # Generated content
    image_url = Column(String(500), nullable=True)
    video_url = Column(String(500), nullable=True)
    thumbnail_url = Column(String(500), nullable=True)
    
    # AI generation details
    ai_generated = Column(Boolean, default=True, nullable=False)
    ai_score = Column(Numeric(3, 2), nullable=True)
    ai_feedback = Column(Text, nullable=True)
    ai_model_version = Column(String(50), nullable=True)
    
    # Generation parameters
    prompt = Column(Text, nullable=True)
    style_guide = Column(JSON, nullable=True)
    brand_guidelines = Column(JSON, nullable=True)
    
    # Performance metrics
    impressions = Column(Integer, default=0, nullable=False)
    clicks = Column(Integer, default=0, nullable=False)
    conversions = Column(Integer, default=0, nullable=False)
    engagement_rate = Column(Numeric(5, 4), default=0, nullable=False)
    
    # Relationships
    campaign = relationship("Campaign")



