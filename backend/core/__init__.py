"""
Sales Intelligence Platform - Core Module
Base classes, interfaces, and shared utilities for enterprise architecture.
"""

from .base import BaseModel, BaseEntity, AuditMixin
from .interfaces import (
    IConnector,
    IMapper,
    IValidator,
    INormalizer,
    ILoader,
    ILogger,
    ISyncPipeline,
)
from .exceptions import (
    SalesIntelException,
    ConnectionError,
    ValidationError,
    SyncError,
    AuthenticationError,
    AuthorizationError,
)
from .config import Settings, get_settings
from .enums import (
    DataZone,
    SyncStatus,
    SyncMode,
    EntityType,
    UserRole,
    IntegrationSource,
)

__all__ = [
    # Base
    "BaseModel",
    "BaseEntity", 
    "AuditMixin",
    # Interfaces
    "IConnector",
    "IMapper",
    "IValidator",
    "INormalizer",
    "ILoader",
    "ILogger",
    "ISyncPipeline",
    # Exceptions
    "SalesIntelException",
    "ConnectionError",
    "ValidationError",
    "SyncError",
    "AuthenticationError",
    "AuthorizationError",
    # Config
    "Settings",
    "get_settings",
    # Enums
    "DataZone",
    "SyncStatus",
    "SyncMode",
    "EntityType",
    "UserRole",
    "IntegrationSource",
]
