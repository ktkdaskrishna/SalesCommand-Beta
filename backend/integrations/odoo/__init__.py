"""
Odoo Integration Module
Implements the sync pipeline for Odoo ERP (v17/v18/v19)
"""

from .connector import OdooConnector
from .mapper import OdooContactMapper, OdooOpportunityMapper, OdooActivityMapper, OdooUserMapper
from .validator import OdooValidator
from .normalizer import OdooNormalizer
from .pipeline import OdooSyncPipeline

__all__ = [
    "OdooConnector",
    "OdooContactMapper",
    "OdooOpportunityMapper",
    "OdooActivityMapper",
    "OdooUserMapper",
    "OdooValidator",
    "OdooNormalizer",
    "OdooSyncPipeline",
]
