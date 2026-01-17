"""
Core Configuration Module
Enterprise-grade configuration management with BYOK support
"""
from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings with environment variable support"""
    
    # Database
    MONGO_URL: str = Field(..., description="MongoDB connection URL")
    DB_NAME: str = Field(default="salesintel", description="Database name")
    
    # JWT Authentication
    JWT_SECRET: str = Field(default="salesintel-secret-key-2025", description="JWT secret key")
    JWT_ALGORITHM: str = Field(default="HS256", description="JWT algorithm")
    JWT_EXPIRATION_HOURS: int = Field(default=24, description="Token expiration in hours")
    
    # CORS
    CORS_ORIGINS: str = Field(default="*", description="CORS allowed origins")
    
    # Redis (for background jobs)
    REDIS_URL: Optional[str] = Field(default=None, description="Redis connection URL")

    # ClickHouse Data Lake
    CLICKHOUSE_URL: Optional[str] = Field(default=None, description="ClickHouse HTTP URL")
    CLICKHOUSE_DATABASE: str = Field(default="salesintel", description="ClickHouse database name")
    CLICKHOUSE_USER: Optional[str] = Field(default=None, description="ClickHouse username")
    CLICKHOUSE_PASSWORD: Optional[str] = Field(default=None, description="ClickHouse password")
    
    # AI Configuration - BYOK (Bring Your Own Key)
    EMERGENT_LLM_KEY: Optional[str] = Field(default=None, description="Emergent LLM API key")
    OPENAI_API_KEY: Optional[str] = Field(default=None, description="OpenAI API key (BYOK)")
    AI_MODEL: str = Field(default="gpt-4o", description="Default AI model")
    
    # Odoo Integration
    ODOO_URL: Optional[str] = Field(default=None, description="Odoo instance URL")
    ODOO_DATABASE: Optional[str] = Field(default=None, description="Odoo database name")
    ODOO_USERNAME: Optional[str] = Field(default=None, description="Odoo username")
    ODOO_API_KEY: Optional[str] = Field(default=None, description="Odoo API key")
    
    # Microsoft 365 SSO
    MS365_CLIENT_ID: Optional[str] = Field(default=None, description="Azure AD Client ID")
    MS365_CLIENT_SECRET: Optional[str] = Field(default=None, description="Azure AD Client Secret")
    MS365_TENANT_ID: Optional[str] = Field(default=None, description="Azure AD Tenant ID")
    MS365_REDIRECT_URI: Optional[str] = Field(default=None, description="OAuth redirect URI")
    
    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


# Export singleton
settings = get_settings()
