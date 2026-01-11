"""
Salesforce Data Normalizer
==========================
Handles data standardization, deduplication, and reference resolution.

The normalizer ensures:
1. Data is standardized (email lowercase, phone formatted, etc.)
2. Duplicates are detected and merged
3. Salesforce IDs are resolved to canonical IDs

This is critical for data quality and preventing duplicate records
when the same entity exists in multiple source systems.
"""

from typing import Any, Dict, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging

from sync_engine.base_components import BaseNormalizer
from core.base import BaseEntity
from core.enums import IntegrationSource, EntityType
from data_lake.models import (
    CanonicalContact,
    CanonicalAccount,
    CanonicalOpportunity,
    CanonicalActivity,
)


logger = logging.getLogger(__name__)


class SalesforceNormalizer(BaseNormalizer):
    """
    Normalizer for Salesforce data.
    
    Handles:
    - Data standardization (email lowercase, phone formatting)
    - Deduplication by Salesforce ID
    - Reference resolution (AccountId → canonical_account.id)
    - Cross-system deduplication (same contact in SF and Odoo)
    """
    
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db)
        # Cache for Salesforce ID → Canonical ID mapping
        self._sf_to_canonical_cache: Dict[str, str] = {}
    
    async def normalize(self, entity: BaseEntity) -> BaseEntity:
        """
        Apply Salesforce-specific normalization.
        
        Standardizes:
        - Email to lowercase
        - Phone numbers
        - URLs (website)
        - Names (proper case)
        """
        # Apply base normalization first
        entity = await super().normalize(entity)
        
        # Salesforce-specific normalizations
        if isinstance(entity, CanonicalContact):
            entity = self._normalize_contact(entity)
        elif isinstance(entity, CanonicalAccount):
            entity = self._normalize_account(entity)
        elif isinstance(entity, CanonicalOpportunity):
            entity = self._normalize_opportunity(entity)
        
        return entity
    
    async def deduplicate(self, entity: BaseEntity) -> Optional[BaseEntity]:
        """
        Check for existing entity by Salesforce ID.
        
        If found, merges the new data with existing and returns merged entity.
        If not found, checks for duplicates by other criteria (email, name).
        """
        if not entity.sources:
            return None
        
        # Find Salesforce source reference
        sf_source = next(
            (s for s in entity.sources if s.source == IntegrationSource.SALESFORCE.value),
            None
        )
        
        if not sf_source:
            return None
        
        # Get collection name
        collection_name = self._get_collection_name(entity)
        if not collection_name:
            return None
        
        # Check if already exists by Salesforce ID
        existing = await self.db[collection_name].find_one({
            "_sources": {
                "$elemMatch": {
                    "source": IntegrationSource.SALESFORCE.value,
                    "source_id": sf_source.source_id
                }
            }
        })
        
        if existing:
            # Found by SF ID - merge and return
            return await self._merge_with_existing(entity, existing)
        
        # Not found by SF ID - check for cross-system duplicates
        # (e.g., same email in Odoo)
        cross_system_match = await self._find_cross_system_duplicate(entity, collection_name)
        if cross_system_match:
            logger.info(f"Found cross-system duplicate for {entity.id}")
            return await self._merge_with_existing(entity, cross_system_match)
        
        return None
    
    async def resolve_references(self, entity: BaseEntity) -> BaseEntity:
        """
        Resolve Salesforce foreign keys to canonical IDs.
        
        Examples:
        - Contact.AccountId (Salesforce) → Contact.account_id (canonical)
        - Opportunity.OwnerId (Salesforce) → Opportunity.owner_id (canonical)
        """
        if isinstance(entity, CanonicalContact):
            entity = await self._resolve_contact_refs(entity)
        elif isinstance(entity, CanonicalOpportunity):
            entity = await self._resolve_opportunity_refs(entity)
        elif isinstance(entity, CanonicalActivity):
            entity = await self._resolve_activity_refs(entity)
        
        return entity
    
    async def _resolve_contact_refs(self, contact: CanonicalContact) -> CanonicalContact:
        """Resolve contact foreign keys"""
        
        # Resolve AccountId → canonical account
        if contact.account_id and self._is_salesforce_id(contact.account_id):
            canonical_id = await self._resolve_sf_ref(
                'canonical_accounts',
                contact.account_id
            )
            if canonical_id:
                contact.account_id = canonical_id
            else:
                # Account not synced yet - keep SF ID for later resolution
                logger.debug(f"Account {contact.account_id} not found - keeping SF ID")
        
        # Resolve OwnerId → canonical user
        if contact.owner_id and self._is_salesforce_id(contact.owner_id):
            canonical_id = await self._resolve_sf_ref(
                'canonical_users',
                contact.owner_id
            )
            if canonical_id:
                contact.owner_id = canonical_id
        
        return contact
    
    async def _resolve_opportunity_refs(self, opp: CanonicalOpportunity) -> CanonicalOpportunity:
        """Resolve opportunity foreign keys"""
        
        # Resolve AccountId
        if opp.account_id and self._is_salesforce_id(opp.account_id):
            canonical_id = await self._resolve_sf_ref(
                'canonical_accounts',
                opp.account_id
            )
            if canonical_id:
                opp.account_id = canonical_id
        
        # Resolve ContactId
        if opp.contact_id and self._is_salesforce_id(opp.contact_id):
            canonical_id = await self._resolve_sf_ref(
                'canonical_contacts',
                opp.contact_id
            )
            if canonical_id:
                opp.contact_id = canonical_id
        
        # Resolve OwnerId
        if opp.owner_id and self._is_salesforce_id(opp.owner_id):
            canonical_id = await self._resolve_sf_ref(
                'canonical_users',
                opp.owner_id
            )
            if canonical_id:
                opp.owner_id = canonical_id
        
        return opp
    
    async def _resolve_activity_refs(self, activity: CanonicalActivity) -> CanonicalActivity:
        """Resolve activity foreign keys"""
        
        if activity.account_id and self._is_salesforce_id(activity.account_id):
            canonical_id = await self._resolve_sf_ref(
                'canonical_accounts',
                activity.account_id
            )
            if canonical_id:
                activity.account_id = canonical_id
        
        if activity.owner_id and self._is_salesforce_id(activity.owner_id):
            canonical_id = await self._resolve_sf_ref(
                'canonical_users',
                activity.owner_id
            )
            if canonical_id:
                activity.owner_id = canonical_id
        
        return activity
    
    async def _resolve_sf_ref(
        self,
        collection: str,
        salesforce_id: str
    ) -> Optional[str]:
        """
        Resolve a Salesforce ID to canonical ID.
        Uses cache for performance.
        """
        cache_key = f"{collection}:{salesforce_id}"
        
        # Check cache first
        if cache_key in self._sf_to_canonical_cache:
            return self._sf_to_canonical_cache[cache_key]
        
        # Query database
        doc = await self.db[collection].find_one({
            "_sources": {
                "$elemMatch": {
                    "source": IntegrationSource.SALESFORCE.value,
                    "source_id": salesforce_id
                }
            }
        }, {"id": 1})
        
        if doc:
            canonical_id = doc["id"]
            self._sf_to_canonical_cache[cache_key] = canonical_id
            return canonical_id
        
        return None
    
    async def _find_cross_system_duplicate(
        self,
        entity: BaseEntity,
        collection_name: str
    ) -> Optional[Dict[str, Any]]:
        """
        Find duplicate by business key (email, name) from OTHER sources.
        
        This enables merging when:
        - Contact "john@acme.com" exists in Odoo
        - Same contact "john@acme.com" comes from Salesforce
        - We detect it's the same person and merge the records
        """
        query = None
        
        if isinstance(entity, CanonicalContact):
            if entity.email:
                query = {"email": entity.email}
        elif isinstance(entity, CanonicalAccount):
            if entity.name:
                # Exact name match for accounts
                query = {"name": entity.name}
        
        if not query:
            return None
        
        # Exclude records that already have Salesforce source
        query["_sources.source"] = {"$ne": IntegrationSource.SALESFORCE.value}
        
        return await self.db[collection_name].find_one(query)
    
    async def _merge_with_existing(
        self,
        new_entity: BaseEntity,
        existing: Dict[str, Any]
    ) -> BaseEntity:
        """
        Merge new entity data with existing record.
        
        Strategy:
        - Keep existing ID
        - Merge source references
        - Update fields (newer data wins)
        """
        from core.base import SourceReference
        
        # Use existing ID
        new_entity.id = existing["id"]
        new_entity.created_at = existing.get("created_at", new_entity.created_at)
        new_entity.created_by = existing.get("created_by")
        
        # Merge sources
        existing_sources = existing.get("_sources", [])
        for src in existing_sources:
            if not any(
                s.source == src["source"] and s.source_id == src["source_id"]
                for s in new_entity.sources
            ):
                new_entity.sources.append(SourceReference(**src))
        
        return new_entity
    
    def _get_collection_name(self, entity: BaseEntity) -> Optional[str]:
        """Get MongoDB collection for entity type"""
        if isinstance(entity, CanonicalContact):
            return "canonical_contacts"
        elif isinstance(entity, CanonicalAccount):
            return "canonical_accounts"
        elif isinstance(entity, CanonicalOpportunity):
            return "canonical_opportunities"
        elif isinstance(entity, CanonicalActivity):
            return "canonical_activities"
        return None
    
    def _is_salesforce_id(self, value: str) -> bool:
        """Check if value looks like a Salesforce ID"""
        if not value:
            return False
        # Salesforce IDs are 15 or 18 character alphanumeric
        return len(value) in (15, 18) and value.isalnum()
    
    def _normalize_contact(self, contact: CanonicalContact) -> CanonicalContact:
        """Apply contact-specific normalization"""
        # Standardize job title
        if contact.job_title:
            contact.job_title = contact.job_title.strip().title()
        
        return contact
    
    def _normalize_account(self, account: CanonicalAccount) -> CanonicalAccount:
        """Apply account-specific normalization"""
        # Standardize website URL
        if account.website:
            website = account.website.strip().lower()
            if not website.startswith(('http://', 'https://')):
                website = f"https://{website}"
            account.website = website
        
        return account
    
    def _normalize_opportunity(self, opp: CanonicalOpportunity) -> CanonicalOpportunity:
        """Apply opportunity-specific normalization"""
        # Ensure bounds
        opp.probability = max(0, min(100, opp.probability))
        opp.amount = max(0, opp.amount)
        
        return opp
    
    def clear_cache(self):
        """Clear the reference resolution cache"""
        self._sf_to_canonical_cache.clear()
