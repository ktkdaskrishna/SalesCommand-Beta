"""
Configuration Management for Sales Intelligence Platform
Environment-based configuration with validation.
"""

from functools import lru_cache
from typing import Optional, List
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Database
    mongo_url: str = Field(default="mongodb://localhost:27017", alias="MONGO_URL")
    db_name: str = Field(default="salesintel", alias="DB_NAME")
    redis_url: str = Field(default="redis://localhost:6379", alias="REDIS_URL")
    
    # Security
    jwt_secret: str = Field(default="change-me-in-production", alias="JWT_SECRET")
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24
    
    # CORS
    cors_origins: str = Field(default="*", alias="CORS_ORIGINS")
    
    # Microsoft 365 SSO
    ms365_client_id: Optional[str] = Field(default=None, alias="MS365_CLIENT_ID")
    ms365_client_secret: Optional[str] = Field(default=None, alias="MS365_CLIENT_SECRET")
    ms365_tenant_id: Optional[str] = Field(default=None, alias="MS365_TENANT_ID")
    ms365_redirect_uri: str = Field(
        default="http://localhost:3000/auth/callback",
        alias="MS365_REDIRECT_URI"
    )
    
    # Odoo Integration
    odoo_url: Optional[str] = Field(default=None, alias="ODOO_URL")
    odoo_database: Optional[str] = Field(default=None, alias="ODOO_DATABASE")
    odoo_username: Optional[str] = Field(default=None, alias="ODOO_USERNAME")
    odoo_api_key: Optional[str] = Field(default=None, alias="ODOO_API_KEY")
    
    # LLM Integration
    emergent_llm_key: Optional[str] = Field(default=None, alias="EMERGENT_LLM_KEY")
    
    # Sync Settings
    sync_batch_size: int = 100
    sync_retry_attempts: int = 3
    sync_retry_delay_seconds: int = 5
    
    # Feature Flags
    enable_ms365_sso: bool = Field(default=False)
    enable_odoo_integration: bool = Field(default=True)
    enable_ai_features: bool = Field(default=True)
    
    # Logging
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins string to list"""
        if self.cors_origins == "*":
            return ["*"]
        return [origin.strip() for origin in self.cors_origins.split(",")]
    
    @property
    def ms365_enabled(self) -> bool:
        """Check if MS365 SSO is fully configured"""
        return all([
            self.ms365_client_id,
            self.ms365_client_secret,
            self.ms365_tenant_id
        ])
    
    @property
    def odoo_enabled(self) -> bool:
        """Check if Odoo integration is fully configured"""
        return all([
            self.odoo_url,
            self.odoo_database,
            self.odoo_username,
            self.odoo_api_key
        ])


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
