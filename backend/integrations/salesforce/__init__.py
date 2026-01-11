"""
Salesforce Integration Module
Complete example of integrating a new system with the Data Lake architecture.

This serves as a TEMPLATE for any new integration:
1. Connector - API connection & data fetching
2. Mapper - Transform source fields → canonical fields
3. Validator - Business rule validation
4. Normalizer - Deduplication & reference resolution
5. Pipeline - Wire components together
"""

from .connector import SalesforceConnector
from .mapper import (
    SalesforceContactMapper,
    SalesforceAccountMapper,
    SalesforceOpportunityMapper,
)
from .validator import SalesforceValidator
from .normalizer import SalesforceNormalizer
from .pipeline import SalesforceSyncPipeline, create_salesforce_pipeline

__all__ = [
    "SalesforceConnector",
    "SalesforceContactMapper",
    "SalesforceAccountMapper", 
    "SalesforceOpportunityMapper",
    "SalesforceValidator",
    "SalesforceNormalizer",
    "SalesforceSyncPipeline",
    "create_salesforce_pipeline",
]
