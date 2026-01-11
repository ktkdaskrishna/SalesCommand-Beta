"""
Microsoft 365 Integration Module
Provides SSO and user sync via Azure AD / Microsoft Graph
"""

from .auth_provider import MS365AuthProvider
from .connector import MS365Connector

__all__ = [
    "MS365AuthProvider",
    "MS365Connector",
]
