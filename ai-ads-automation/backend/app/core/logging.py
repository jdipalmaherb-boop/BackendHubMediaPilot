"""
Logging configuration for the AI Ads Automation Platform.
"""

import logging
import sys
from typing import Any, Dict

import structlog
from structlog.types import Processor

from app.core.config import settings


def setup_logging() -> None:
    """Configure structured logging."""
    
    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, settings.LOG_LEVEL.upper()),
    )
    
    # Configure structlog
    processors: list[Processor] = [
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ]
    
    structlog.configure(
        processors=processors,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> structlog.BoundLogger:
    """Get a structured logger instance."""
    return structlog.get_logger(name)


class LoggerMixin:
    """Mixin class to add logging capabilities to any class."""
    
    @property
    def logger(self) -> structlog.BoundLogger:
        """Get logger for this class."""
        return get_logger(self.__class__.__name__)


def log_function_call(func_name: str, **kwargs: Any) -> None:
    """Log function call with parameters."""
    logger = get_logger("function_call")
    logger.info(f"Calling {func_name}", function=func_name, **kwargs)


def log_performance(operation: str, duration: float, **metadata: Any) -> None:
    """Log performance metrics."""
    logger = get_logger("performance")
    logger.info(
        f"Performance: {operation}",
        operation=operation,
        duration=duration,
        **metadata
    )


def log_ai_operation(module: str, operation: str, **metadata: Any) -> None:
    """Log AI module operations."""
    logger = get_logger("ai_operation")
    logger.info(
        f"AI {module}: {operation}",
        module=module,
        operation=operation,
        **metadata
    )


def log_platform_api(platform: str, endpoint: str, status_code: int, **metadata: Any) -> None:
    """Log platform API calls."""
    logger = get_logger("platform_api")
    logger.info(
        f"Platform API: {platform} {endpoint}",
        platform=platform,
        endpoint=endpoint,
        status_code=status_code,
        **metadata
    )


def log_optimization(campaign_id: str, action: str, **metadata: Any) -> None:
    """Log optimization actions."""
    logger = get_logger("optimization")
    logger.info(
        f"Optimization: {action}",
        campaign_id=campaign_id,
        action=action,
        **metadata
    )



