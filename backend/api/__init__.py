"""
API Routes Module
Organizes all API endpoints
"""

from .data_lake import router as data_lake_router
from .sync import router as sync_router
from .auth_ms365 import router as ms365_router
from .dashboard import router as dashboard_router

__all__ = [
    "data_lake_router",
    "sync_router",
    "ms365_router",
    "dashboard_router",
]
