"""
Platform integrations module.
"""

from .meta_ads import MetaAdsClient
from .google_ads import GoogleAdsClient
from .tiktok_ads import TikTokAdsClient
from .base_client import BasePlatformClient

__all__ = [
    "MetaAdsClient",
    "GoogleAdsClient",
    "TikTokAdsClient",
    "BasePlatformClient"
]



