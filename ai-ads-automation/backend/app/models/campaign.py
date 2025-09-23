"""
Campaign-related database models.
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import List, Optional

from sqlalchemy import (
    Boolean, Column, DateTime, Enum as SQLEnum, ForeignKey, 
    Integer, Numeric, String, Text, JSON
)
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin, AuditMixin, MetadataMixin


class CampaignStatus(str, Enum):
    """Campaign status enumeration."""
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class CampaignObjective(str, Enum):
    """Campaign objective enumeration."""
    AWARENESS = "awareness"
    TRAFFIC = "traffic"
    ENGAGEMENT = "engagement"
    LEADS = "leads"
    SALES = "sales"
    APP_INSTALLS = "app_installs"
    VIDEO_VIEWS = "video_views"


class Platform(str, Enum):
    """Platform enumeration."""
    META = "meta"
    GOOGLE = "google"
    TIKTOK = "tiktok"
    LINKEDIN = "linkedin"
    TWITTER = "twitter"


class Campaign(Base, TimestampMixin, AuditMixin, MetadataMixin):
    """Campaign model."""
    
    __tablename__ = "campaigns"
    
    id = Column(String(255), primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Platform and external IDs
    platform = Column(SQLEnum(Platform), nullable=False)
    platform_campaign_id = Column(String(255), nullable=True)
    
    # Campaign settings
    objective = Column(SQLEnum(CampaignObjective), nullable=False)
    status = Column(SQLEnum(CampaignStatus), default=CampaignStatus.DRAFT, nullable=False)
    
    # Budget settings
    budget = Column(Numeric(10, 2), nullable=False)
    daily_budget = Column(Numeric(10, 2), nullable=False)
    spent = Column(Numeric(10, 2), default=0, nullable=False)
    
    # Date settings
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    
    # AI settings
    ai_optimization_enabled = Column(Boolean, default=True, nullable=False)
    automation_enabled = Column(Boolean, default=True, nullable=False)
    ab_testing_enabled = Column(Boolean, default=True, nullable=False)
    
    # Performance metrics (cached)
    impressions = Column(Integer, default=0, nullable=False)
    clicks = Column(Integer, default=0, nullable=False)
    conversions = Column(Integer, default=0, nullable=False)
    ctr = Column(Numeric(5, 4), default=0, nullable=False)  # Click-through rate
    cpc = Column(Numeric(10, 4), default=0, nullable=False)  # Cost per click
    cpa = Column(Numeric(10, 4), default=0, nullable=False)  # Cost per acquisition
    roas = Column(Numeric(10, 4), default=0, nullable=False)  # Return on ad spend
    
    # Relationships
    ad_groups = relationship("AdGroup", back_populates="campaign", cascade="all, delete-orphan")
    creatives = relationship("Creative", back_populates="campaign", cascade="all, delete-orphan")
    audiences = relationship("Audience", back_populates="campaign", cascade="all, delete-orphan")
    performance_data = relationship("PerformanceData", back_populates="campaign", cascade="all, delete-orphan")
    optimizations = relationship("Optimization", back_populates="campaign", cascade="all, delete-orphan")
    ab_tests = relationship("ABTest", back_populates="campaign", cascade="all, delete-orphan")


class AdGroup(Base, TimestampMixin, AuditMixin, MetadataMixin):
    """Ad Group model."""
    
    __tablename__ = "ad_groups"
    
    id = Column(String(255), primary_key=True)
    campaign_id = Column(String(255), ForeignKey("campaigns.id"), nullable=False)
    platform_ad_group_id = Column(String(255), nullable=True)
    
    name = Column(String(255), nullable=False)
    status = Column(String(50), default="active", nullable=False)
    
    # Bidding settings
    bid_strategy = Column(String(50), nullable=False)
    bid_amount = Column(Numeric(10, 4), nullable=True)
    
    # Targeting settings (stored as JSON)
    targeting = Column(JSON, nullable=True)
    placements = Column(JSON, nullable=True)
    schedule = Column(JSON, nullable=True)
    
    # Performance metrics
    impressions = Column(Integer, default=0, nullable=False)
    clicks = Column(Integer, default=0, nullable=False)
    conversions = Column(Integer, default=0, nullable=False)
    spend = Column(Numeric(10, 2), default=0, nullable=False)
    
    # Relationships
    campaign = relationship("Campaign", back_populates="ad_groups")
    creatives = relationship("Creative", back_populates="ad_group", cascade="all, delete-orphan")


class Creative(Base, TimestampMixin, AuditMixin, MetadataMixin):
    """Creative model."""
    
    __tablename__ = "creatives"
    
    id = Column(String(255), primary_key=True)
    campaign_id = Column(String(255), ForeignKey("campaigns.id"), nullable=False)
    ad_group_id = Column(String(255), ForeignKey("ad_groups.id"), nullable=True)
    platform_creative_id = Column(String(255), nullable=True)
    
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)  # image, video, carousel, etc.
    format = Column(String(50), nullable=False)  # single_image, single_video, etc.
    status = Column(String(50), default="active", nullable=False)
    
    # Creative content
    headline = Column(String(255), nullable=True)
    primary_text = Column(Text, nullable=True)
    cta_text = Column(String(100), nullable=True)
    
    # Assets
    image_url = Column(String(500), nullable=True)
    video_url = Column(String(500), nullable=True)
    thumbnail_url = Column(String(500), nullable=True)
    
    # AI-generated content
    ai_generated = Column(Boolean, default=False, nullable=False)
    ai_score = Column(Numeric(3, 2), nullable=True)  # AI confidence score
    ai_feedback = Column(Text, nullable=True)
    
    # Performance metrics
    impressions = Column(Integer, default=0, nullable=False)
    clicks = Column(Integer, default=0, nullable=False)
    conversions = Column(Integer, default=0, nullable=False)
    engagement_rate = Column(Numeric(5, 4), default=0, nullable=False)
    
    # Relationships
    campaign = relationship("Campaign", back_populates="creatives")
    ad_group = relationship("AdGroup", back_populates="creatives")


class Audience(Base, TimestampMixin, AuditMixin, MetadataMixin):
    """Audience model."""
    
    __tablename__ = "audiences"
    
    id = Column(String(255), primary_key=True)
    campaign_id = Column(String(255), ForeignKey("campaigns.id"), nullable=False)
    platform_audience_id = Column(String(255), nullable=True)
    
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)  # core, lookalike, custom, etc.
    status = Column(String(50), default="active", nullable=False)
    
    # Audience settings
    demographics = Column(JSON, nullable=True)
    interests = Column(JSON, nullable=True)
    behaviors = Column(JSON, nullable=True)
    custom_audience = Column(JSON, nullable=True)
    lookalike_settings = Column(JSON, nullable=True)
    
    # Audience metrics
    estimated_size = Column(Integer, nullable=True)
    actual_size = Column(Integer, nullable=True)
    quality_score = Column(Numeric(3, 2), nullable=True)
    
    # Performance metrics
    impressions = Column(Integer, default=0, nullable=False)
    clicks = Column(Integer, default=0, nullable=False)
    conversions = Column(Integer, default=0, nullable=False)
    ctr = Column(Numeric(5, 4), default=0, nullable=False)
    cpc = Column(Numeric(10, 4), default=0, nullable=False)
    cpa = Column(Numeric(10, 4), default=0, nullable=False)
    
    # Relationships
    campaign = relationship("Campaign", back_populates="audiences")


class PerformanceData(Base, TimestampMixin, MetadataMixin):
    """Performance data model for storing historical metrics."""
    
    __tablename__ = "performance_data"
    
    id = Column(String(255), primary_key=True)
    campaign_id = Column(String(255), ForeignKey("campaigns.id"), nullable=False)
    
    # Date and platform
    date = Column(DateTime, nullable=False)
    platform = Column(SQLEnum(Platform), nullable=False)
    
    # Performance metrics
    impressions = Column(Integer, default=0, nullable=False)
    clicks = Column(Integer, default=0, nullable=False)
    conversions = Column(Integer, default=0, nullable=False)
    spend = Column(Numeric(10, 2), default=0, nullable=False)
    revenue = Column(Numeric(10, 2), default=0, nullable=False)
    
    # Calculated metrics
    ctr = Column(Numeric(5, 4), default=0, nullable=False)
    cpc = Column(Numeric(10, 4), default=0, nullable=False)
    cpa = Column(Numeric(10, 4), default=0, nullable=False)
    roas = Column(Numeric(10, 4), default=0, nullable=False)
    engagement_rate = Column(Numeric(5, 4), default=0, nullable=False)
    
    # Additional metrics
    video_views = Column(Integer, default=0, nullable=False)
    completion_rate = Column(Numeric(5, 4), default=0, nullable=False)
    
    # Relationships
    campaign = relationship("Campaign", back_populates="performance_data")



