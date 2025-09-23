"""
Core configuration settings for the AI Ads Automation Platform.
"""

import os
from typing import List, Optional
from pydantic import BaseSettings, validator


class Settings(BaseSettings):
    """Application settings."""
    
    # Application
    APP_NAME: str = "AI Ads Automation Platform"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"
    
    # Database
    DATABASE_URL: str = "sqlite:///./ai_ads.db"
    SQLITE_URL: str = "sqlite:///./ai_ads.db"
    
    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 30
    BCRYPT_ROUNDS: int = 12
    
    # LLM Configuration
    OPENAI_API_KEY: Optional[str] = None
    LLM_BASE_URL: str = "https://api.openai.com/v1"
    LLM_MODEL: str = "gpt-4"
    LLM_TEMPERATURE: float = 0.7
    LLM_MAX_TOKENS: int = 1000
    
    # Platform APIs
    META_ACCESS_TOKEN: Optional[str] = None
    META_APP_ID: Optional[str] = None
    META_APP_SECRET: Optional[str] = None
    
    GOOGLE_ADS_DEVELOPER_TOKEN: Optional[str] = None
    GOOGLE_ADS_CLIENT_ID: Optional[str] = None
    GOOGLE_ADS_CLIENT_SECRET: Optional[str] = None
    GOOGLE_ADS_REFRESH_TOKEN: Optional[str] = None
    GOOGLE_ADS_CUSTOMER_ID: Optional[str] = None
    
    TIKTOK_ACCESS_TOKEN: Optional[str] = None
    TIKTOK_APP_ID: Optional[str] = None
    TIKTOK_APP_SECRET: Optional[str] = None
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    REDIS_PASSWORD: Optional[str] = None
    
    # Monitoring
    SENTRY_DSN: Optional[str] = None
    LOG_LEVEL: str = "INFO"
    ENABLE_METRICS: bool = True
    
    # Feature Flags
    ENABLE_AI_OPTIMIZATION: bool = True
    ENABLE_AUTOMATION: bool = True
    ENABLE_AB_TESTING: bool = True
    ENABLE_NOTIFICATIONS: bool = True
    ENABLE_SIMULATION: bool = True
    
    # Safety & Limits
    MAX_DAILY_SPEND: float = 10000.0
    MAX_BUDGET_INCREASE_PERCENT: float = 50.0
    ANOMALY_DETECTION_THRESHOLD: float = 3.0
    AUTO_THROTTLE_ENABLED: bool = True
    
    # ML Configuration
    ML_MODEL_PATH: str = "./models/"
    TRAINING_DATA_PATH: str = "./data/training/"
    SIMULATION_DATA_PATH: str = "./data/simulation/"
    BATCH_SIZE: int = 32
    LEARNING_RATE: float = 0.001
    TRAINING_EPOCHS: int = 100
    
    # Optimization Engine
    OPTIMIZER_UPDATE_FREQUENCY: int = 300  # seconds
    CONTEXTUAL_BANDIT_ALPHA: float = 1.0
    RL_POLICY_LEARNING_RATE: float = 0.0003
    RL_POLICY_EPOCHS: int = 10
    
    # Creative Generation
    CREATIVE_APP_API_URL: str = "http://localhost:8080"
    CREATIVE_APP_API_KEY: Optional[str] = None
    FALLBACK_TO_SYNTHETIC: bool = True
    
    # CORS
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001"]
    
    @validator("ALLOWED_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v):
        if isinstance(v, str):
            return [i.strip() for i in v.split(",")]
        return v
    
    @validator("DATABASE_URL", pre=True)
    def validate_database_url(cls, v):
        if v.startswith("sqlite"):
            return v
        if not v.startswith(("postgresql://", "postgres://")):
            raise ValueError("DATABASE_URL must be a valid PostgreSQL or SQLite URL")
        return v
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()



