"""
Odoo Data Normalizer
Handles deduplication and reference resolution for Odoo data
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


class OdooNormalizer(BaseNormalizer):
    """
    Normalizer for Odoo data.
    Handles:
    - Data standardization
    - Deduplication by Odoo ID
    - Reference resolution (partner_id -> account_id, etc.)
    """
    
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db)
        self._odoo_to_canonical_cache: Dict[str, str] = {}
    
    async def normalize(self, entity: BaseEntity) -> BaseEntity:
        """Apply Odoo-specific normalization"""
        # Base normalization
        entity = await super().normalize(entity)
        
        # Odoo-specific normalizations
        if isinstance(entity, CanonicalContact):
            entity = self._normalize_contact(entity)
        elif isinstance(entity, CanonicalAccount):
            entity = self._normalize_account(entity)
        elif isinstance(entity, CanonicalOpportunity):
            entity = self._normalize_opportunity(entity)
        
        return entity
    
    async def deduplicate(self, entity: BaseEntity) -> Optional[BaseEntity]:
        """
        Check for existing entity by Odoo source reference.
        Returns merged entity if duplicate found.
        """
        if not entity.sources:
            return None
        
        # Find Odoo source reference
        odoo_source = next(
            (s for s in entity.sources if s.source == IntegrationSource.ODOO.value),
            None
        )
        
        if not odoo_source:
            return None
        
        # Determine collection based on entity type
        collection_name = self._get_collection_name(entity)
        if not collection_name:
            return None
        
        # Look for existing by Odoo ID
        existing = await self.db[collection_name].find_one({
            "_sources": {
                "$elemMatch": {
                    "source": IntegrationSource.ODOO.value,
                    "source_id": odoo_source.source_id
                }
            }
        })
        
        if existing:
            # Update entity with existing ID and merge sources
            entity.id = existing["id"]
            entity.created_at = existing.get("created_at", entity.created_at)
            entity.created_by = existing.get("created_by")
            
            # Merge any additional sources from existing
            existing_sources = existing.get("_sources", [])
            for src in existing_sources:
                if not any(s.source == src["source"] and s.source_id == src["source_id"]
                          for s in entity.sources):
                    from core.base import SourceReference
                    entity.sources.append(SourceReference(**src))
            
            return entity
        
        return None
    
    async def resolve_references(self, entity: BaseEntity) -> BaseEntity:
        """
        Resolve Odoo foreign keys to canonical IDs.
        Example: partner_id (Odoo) -> account_id (canonical)
        """
        if isinstance(entity, CanonicalContact):
            entity = await self._resolve_contact_refs(entity)
        elif isinstance(entity, CanonicalOpportunity):
            entity = await self._resolve_opportunity_refs(entity)
        elif isinstance(entity, CanonicalActivity):
            entity = await self._resolve_activity_refs(entity)
        
        return entity
    
    async def _resolve_contact_refs(self, contact: CanonicalContact) -> CanonicalContact:
        """Resolve contact references"""
        # Resolve account_id (parent company in Odoo)
        if contact.account_id and contact.account_id.isdigit():
            canonical_id = await self._resolve_odoo_ref(
                'canonical_accounts',
                contact.account_id
            )
            if canonical_id:
                contact.account_id = canonical_id
        
        # Resolve owner_id (salesperson)
        if contact.owner_id and contact.owner_id.isdigit():
            canonical_id = await self._resolve_odoo_ref(
                'canonical_users',
                contact.owner_id
            )
            if canonical_id:
                contact.owner_id = canonical_id
        
        return contact
    
    async def _resolve_opportunity_refs(self, opp: CanonicalOpportunity) -> CanonicalOpportunity:
        """Resolve opportunity references"""
        # Resolve account_id (partner_id in Odoo)
        if opp.account_id and opp.account_id.isdigit():
            canonical_id = await self._resolve_odoo_ref(
                'canonical_accounts',
                opp.account_id
            )
            if canonical_id:
                opp.account_id = canonical_id
        
        # Resolve owner_id
        if opp.owner_id and opp.owner_id.isdigit():
            canonical_id = await self._resolve_odoo_ref(
                'canonical_users',
                opp.owner_id
            )
            if canonical_id:
                opp.owner_id = canonical_id
        
        return opp
    
    async def _resolve_activity_refs(self, activity: CanonicalActivity) -> CanonicalActivity:
        """Resolve activity references"""
        # Resolve account_id
        if activity.account_id and activity.account_id.isdigit():
            canonical_id = await self._resolve_odoo_ref(
                'canonical_accounts',
                activity.account_id
            )
            if canonical_id:
                activity.account_id = canonical_id
        
        # Resolve opportunity_id
        if activity.opportunity_id and activity.opportunity_id.isdigit():
            canonical_id = await self._resolve_odoo_ref(
                'canonical_opportunities',
                activity.opportunity_id
            )
            if canonical_id:
                activity.opportunity_id = canonical_id
        
        # Resolve owner_id
        if activity.owner_id and activity.owner_id.isdigit():
            canonical_id = await self._resolve_odoo_ref(
                'canonical_users',
                activity.owner_id
            )
            if canonical_id:
                activity.owner_id = canonical_id
        
        return activity
    
    async def _resolve_odoo_ref(
        self,
        collection: str,
        odoo_id: str
    ) -> Optional[str]:
        """
        Resolve an Odoo ID to a canonical ID.
        Uses caching for performance.
        """
        cache_key = f"{collection}:{odoo_id}"
        
        # Check cache
        if cache_key in self._odoo_to_canonical_cache:
            return self._odoo_to_canonical_cache[cache_key]
        
        # Query database
        doc = await self.db[collection].find_one({
            "_sources": {
                "$elemMatch": {
                    "source": IntegrationSource.ODOO.value,
                    "source_id": odoo_id
                }
            }
        }, {"id": 1})
        
        if doc:
            canonical_id = doc["id"]
            self._odoo_to_canonical_cache[cache_key] = canonical_id
            return canonical_id
        
        return None
    
    def _get_collection_name(self, entity: BaseEntity) -> Optional[str]:
        """Get MongoDB collection name for entity type"""
        if isinstance(entity, CanonicalContact):
            return "canonical_contacts"
        elif isinstance(entity, CanonicalAccount):
            return "canonical_accounts"
        elif isinstance(entity, CanonicalOpportunity):
            return "canonical_opportunities"
        elif isinstance(entity, CanonicalActivity):
            return "canonical_activities"
        return None
    
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
        # Ensure probability is within bounds
        opp.probability = max(0, min(100, opp.probability))
        
        # Ensure amount is non-negative
        opp.amount = max(0, opp.amount)
        
        return opp
    
    def clear_cache(self):
        """Clear the reference resolution cache"""
        self._odoo_to_canonical_cache.clear()
