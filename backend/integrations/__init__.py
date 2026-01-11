"""
Integrations Module
Provides connectors for external systems
"""

from .odoo import OdooSyncPipeline, OdooConnector
from .salesforce import SalesforceSyncPipeline, SalesforceConnector, create_salesforce_pipeline

__all__ = [
    # Odoo
    "OdooSyncPipeline",
    "OdooConnector",
    # Salesforce
    "SalesforceSyncPipeline",
    "SalesforceConnector",
    "create_salesforce_pipeline",
]
