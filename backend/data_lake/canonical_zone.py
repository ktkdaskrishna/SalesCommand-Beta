"""
Canonical Zone Handler for Sales Intelligence Platform
Manages normalized, unified data models.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Type, TypeVar
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
import logging
import hashlib
import json

from core.base import BaseEntity
from core.enums import DataZone, EntityType, IntegrationSource, VisibilityScope, UserRole
from .models import (
    CanonicalContact,
    CanonicalAccount,
    CanonicalOpportunity,
    CanonicalActivity,
    CanonicalUser,
)


logger = logging.getLogger(__name__)

T = TypeVar('T', bound=BaseEntity)


class CanonicalZoneHandler:
    """
    Handles all operations for the Canonical Zone of the Data Lake.
    
    Principles:
    - Unified data models across sources
    - Stable schema for downstream consumers
    - Source references maintained for traceability
    - Deduplication and merging logic
    """
    
    # Collection mappings
    COLLECTION_MAP = {
        EntityType.CONTACT: ("canonical_contacts", CanonicalContact),
        EntityType.ACCOUNT: ("canonical_accounts", CanonicalAccount),
        EntityType.OPPORTUNITY: ("canonical_opportunities", CanonicalOpportunity),
        EntityType.ACTIVITY: ("canonical_activities", CanonicalActivity),
        EntityType.USER: ("canonical_users", CanonicalUser),
    }
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
    
    def _get_collection_info(self, entity_type: EntityType) -> tuple:
        """Get collection name and model class for entity type"""
        if entity_type not in self.COLLECTION_MAP:
            raise ValueError(f"Unknown entity type: {entity_type}")
        return self.COLLECTION_MAP[entity_type]
    
    async def upsert(
        self,
        entity: BaseEntity,
        source: IntegrationSource,
        source_id: str,
        user_id: Optional[str] = None
    ) -> tuple[str, bool]:
        """
        Insert or update an entity in the canonical zone.
        
        Args:
            entity: The canonical entity to upsert
            source: Source system
            source_id: ID in source system
            user_id: User performing the operation
            
        Returns:
            Tuple of (entity_id, is_new)
        """
        entity_type = EntityType(entity.entity_type)
        collection_name, _ = self._get_collection_info(entity_type)
        collection = self.db[collection_name]
        
        # Check for existing entity by source reference
        existing = await collection.find_one({
            "_sources": {
                "$elemMatch": {
                    "source": source.value,
                    "source_id": source_id
                }
            }
        })
        
        # Add/update source reference
        entity.add_source(source.value, source_id)
        
        if existing:
            # Update existing entity
            entity.id = existing["id"]
            entity.created_at = existing.get("created_at", entity.created_at)
            entity.created_by = existing.get("created_by")
            entity.updated_at = datetime.now(timezone.utc)
            entity.updated_by = user_id
            entity.version = existing.get("_version", 0) + 1
            
            # Merge sources from existing
            existing_sources = existing.get("_sources", [])
            for src in existing_sources:
                if not any(s.source == src["source"] and s.source_id == src["source_id"] 
                          for s in entity.sources):
                    entity.sources.append(src)
            
            await collection.update_one(
                {"id": entity.id},
                {"$set": entity.to_mongo_dict()}
            )
            
            logger.debug(f"Updated canonical {entity_type.value}: {entity.id}")
            return entity.id, False
        else:
            # Insert new entity
            entity.created_at = datetime.now(timezone.utc)
            entity.created_by = user_id
            entity.updated_at = entity.created_at
            entity.version = 1
            
            await collection.insert_one(entity.to_mongo_dict())
            
            logger.debug(f"Created canonical {entity_type.value}: {entity.id}")
            return entity.id, True
    
    async def get_by_id(
        self,
        entity_type: EntityType,
        entity_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get an entity by its canonical ID"""
        collection_name, _ = self._get_collection_info(entity_type)
        collection = self.db[collection_name]
        
        return await collection.find_one({"id": entity_id}, {"_id": 0})
    
    async def get_by_source(
        self,
        entity_type: EntityType,
        source: IntegrationSource,
        source_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get an entity by source system reference"""
        collection_name, _ = self._get_collection_info(entity_type)
        collection = self.db[collection_name]
        
        return await collection.find_one({
            "_sources": {
                "$elemMatch": {
                    "source": source.value,
                    "source_id": source_id
                }
            }
        }, {"_id": 0})
    
    async def find(
        self,
        entity_type: EntityType,
        query: Dict[str, Any],
        limit: int = 100,
        skip: int = 0,
        sort: Optional[List[tuple]] = None
    ) -> List[Dict[str, Any]]:
        """Find entities matching query"""
        collection_name, _ = self._get_collection_info(entity_type)
        collection = self.db[collection_name]
        
        cursor = collection.find(query, {"_id": 0})
        
        if sort:
            cursor = cursor.sort(sort)
        
        cursor = cursor.skip(skip).limit(limit)
        
        return await cursor.to_list(length=None)
    
    async def find_with_visibility(
        self,
        entity_type: EntityType,
        user_id: str,
        user_role: UserRole,
        visibility_scope: VisibilityScope,
        team_ids: Optional[List[str]] = None,
        department_id: Optional[str] = None,
        additional_query: Optional[Dict[str, Any]] = None,
        limit: int = 100,
        skip: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Find entities with RBAC visibility enforcement.
        
        Args:
            entity_type: Type of entity to query
            user_id: Current user's ID
            user_role: User's role for permission checking
            visibility_scope: User's visibility scope
            team_ids: User's team IDs (for team-scoped visibility)
            department_id: User's department ID
            additional_query: Additional query filters
            limit: Max results
            skip: Results to skip
            
        Returns:
            List of entities the user can see
        """
        collection_name, _ = self._get_collection_info(entity_type)
        collection = self.db[collection_name]
        
        # Build visibility filter based on scope
        visibility_filter = {}
        
        if visibility_scope == VisibilityScope.OWN:
            # User sees only their own records
            visibility_filter["$or"] = [
                {"owner_id": user_id},
                {"assigned_to": user_id}
            ]
        elif visibility_scope == VisibilityScope.TEAM:
            # User sees team records
            if team_ids:
                visibility_filter["$or"] = [
                    {"owner_id": user_id},
                    {"team_id": {"$in": team_ids}}
                ]
            else:
                visibility_filter["owner_id"] = user_id
        elif visibility_scope == VisibilityScope.DEPARTMENT:
            # User sees department records
            if department_id:
                visibility_filter["$or"] = [
                    {"owner_id": user_id},
                    {"department_id": department_id}
                ]
            else:
                visibility_filter["owner_id"] = user_id
        # ALL scope: no visibility filter
        
        # Combine with additional query
        query = {}
        if visibility_filter:
            query.update(visibility_filter)
        if additional_query:
            if "$or" in query and "$or" in additional_query:
                # Merge $or conditions with $and
                query = {
                    "$and": [
                        {"$or": query["$or"]},
                        {"$or": additional_query["$or"]}
                    ]
                }
            else:
                query.update(additional_query)
        
        cursor = collection.find(query, {"_id": 0}).skip(skip).limit(limit)
        
        return await cursor.to_list(length=None)
    
    async def count(
        self,
        entity_type: EntityType,
        query: Optional[Dict[str, Any]] = None
    ) -> int:
        """Count entities matching query"""
        collection_name, _ = self._get_collection_info(entity_type)
        collection = self.db[collection_name]
        
        return await collection.count_documents(query or {})
    
    async def delete(
        self,
        entity_type: EntityType,
        entity_id: str
    ) -> bool:
        """Delete an entity by ID"""
        collection_name, _ = self._get_collection_info(entity_type)
        collection = self.db[collection_name]
        
        result = await collection.delete_one({"id": entity_id})
        return result.deleted_count > 0
    
    async def find_duplicates(
        self,
        entity_type: EntityType,
        entity: BaseEntity
    ) -> List[Dict[str, Any]]:
        """
        Find potential duplicates for an entity.
        Uses email for contacts/users, name for accounts.
        """
        collection_name, _ = self._get_collection_info(entity_type)
        collection = self.db[collection_name]
        
        query = {"id": {"$ne": entity.id}}
        
        if entity_type in (EntityType.CONTACT, EntityType.USER):
            if hasattr(entity, 'email') and entity.email:
                query["email"] = entity.email
            else:
                return []
        elif entity_type == EntityType.ACCOUNT:
            if hasattr(entity, 'name') and entity.name:
                query["name"] = entity.name
            else:
                return []
        else:
            return []
        
        cursor = collection.find(query, {"_id": 0}).limit(10)
        return await cursor.to_list(length=None)
    
    async def merge_entities(
        self,
        entity_type: EntityType,
        primary_id: str,
        secondary_id: str,
        user_id: Optional[str] = None
    ) -> Optional[str]:
        """
        Merge two entities, keeping the primary and removing the secondary.
        
        Args:
            entity_type: Type of entity
            primary_id: ID of entity to keep
            secondary_id: ID of entity to merge into primary
            user_id: User performing merge
            
        Returns:
            Primary entity ID if successful
        """
        collection_name, _ = self._get_collection_info(entity_type)
        collection = self.db[collection_name]
        
        primary = await collection.find_one({"id": primary_id})
        secondary = await collection.find_one({"id": secondary_id})
        
        if not primary or not secondary:
            return None
        
        # Merge sources
        primary_sources = primary.get("_sources", [])
        secondary_sources = secondary.get("_sources", [])
        
        for src in secondary_sources:
            if not any(s["source"] == src["source"] and s["source_id"] == src["source_id"]
                      for s in primary_sources):
                primary_sources.append(src)
        
        # Update primary with merged sources
        await collection.update_one(
            {"id": primary_id},
            {
                "$set": {
                    "_sources": primary_sources,
                    "updated_at": datetime.now(timezone.utc),
                    "updated_by": user_id
                },
                "$inc": {"_version": 1}
            }
        )
        
        # Delete secondary
        await collection.delete_one({"id": secondary_id})
        
        # Update references in related entities
        await self._update_references(entity_type, secondary_id, primary_id)
        
        logger.info(f"Merged {entity_type.value} {secondary_id} into {primary_id}")
        return primary_id
    
    async def _update_references(
        self,
        entity_type: EntityType,
        old_id: str,
        new_id: str
    ) -> None:
        """Update foreign key references after merge"""
        
        if entity_type == EntityType.CONTACT:
            # Update opportunities and activities that reference this contact
            await self.db["canonical_opportunities"].update_many(
                {"contact_id": old_id},
                {"$set": {"contact_id": new_id}}
            )
            await self.db["canonical_activities"].update_many(
                {"contact_id": old_id},
                {"$set": {"contact_id": new_id}}
            )
        
        elif entity_type == EntityType.ACCOUNT:
            # Update contacts, opportunities, activities
            await self.db["canonical_contacts"].update_many(
                {"account_id": old_id},
                {"$set": {"account_id": new_id}}
            )
            await self.db["canonical_opportunities"].update_many(
                {"account_id": old_id},
                {"$set": {"account_id": new_id}}
            )
            await self.db["canonical_activities"].update_many(
                {"account_id": old_id},
                {"$set": {"account_id": new_id}}
            )
        
        elif entity_type == EntityType.USER:
            # Update owner/assigned references
            for coll_name in ["canonical_accounts", "canonical_opportunities", 
                             "canonical_activities", "canonical_contacts"]:
                await self.db[coll_name].update_many(
                    {"owner_id": old_id},
                    {"$set": {"owner_id": new_id}}
                )
                await self.db[coll_name].update_many(
                    {"assigned_to": old_id},
                    {"$set": {"assigned_to": new_id}}
                )
