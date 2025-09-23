"""Database models for the AI Ads Automation Platform."""

from .base import BaseModel
from .campaign import Campaign, AdGroup, AdCreative, AdPerformance, Audience, PlatformAccount, UserRule
from .ai import LLMConfig, AdCopySuggestion, CreativeSuggestion, TargetingSuggestion, OptimizationLog, AIInsight
from .social_media import Post, PostMetric
