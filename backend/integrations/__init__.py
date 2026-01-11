"""
Integrations Module
Provides connectors for external systems
"""

from .odoo import OdooSyncPipeline, OdooConnector

__all__ = [
    "OdooSyncPipeline",
    "OdooConnector",
]
