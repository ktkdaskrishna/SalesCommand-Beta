"""
Data Lake Module for Sales Intelligence Platform
Implements the three-zone architecture: Raw → Canonical → Serving
"""

from .manager import DataLakeManager
from .raw_zone import RawZoneHandler
from .canonical_zone import CanonicalZoneHandler
from .serving_zone import ServingZoneHandler
from .models import (
    # Canonical Models
    CanonicalContact,
    CanonicalAccount,
    CanonicalOpportunity,
    CanonicalActivity,
    CanonicalUser,
    # Serving Models
    ServingDashboardStats,
    ServingPipelineSummary,
    ServingKPISnapshot,
    ServingActivityFeed,
)

__all__ = [
    "DataLakeManager",
    "RawZoneHandler",
    "CanonicalZoneHandler",
    "ServingZoneHandler",
    # Models
    "CanonicalContact",
    "CanonicalAccount",
    "CanonicalOpportunity",
    "CanonicalActivity",
    "CanonicalUser",
    "ServingDashboardStats",
    "ServingPipelineSummary",
    "ServingKPISnapshot",
    "ServingActivityFeed",
]
