"""
Main API router for v1 endpoints.
"""

from fastapi import APIRouter
from app.api.v1 import social_media
from app.modules.feedback_loop import router as feedback_router
from app.modules.brand_voice import router as brand_voice_router
from app.modules.trend_discovery import router as trend_discovery_router
from app.modules.analytics import router as analytics_router
from app.modules.reporting import router as reporting_router
from app.modules.integrations import router as integrations_router

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(social_media.router, prefix="/social-media", tags=["social-media"])
api_router.include_router(feedback_router, prefix="/feedback-loop", tags=["feedback-loop"])
api_router.include_router(brand_voice_router, prefix="/brand-voice", tags=["brand-voice"])
api_router.include_router(trend_discovery_router, prefix="/trend-discovery", tags=["trend-discovery"])
api_router.include_router(analytics_router, prefix="/analytics", tags=["analytics"])
api_router.include_router(reporting_router, prefix="/reporting", tags=["reporting"])
api_router.include_router(integrations_router, prefix="/integrations", tags=["integrations"])
