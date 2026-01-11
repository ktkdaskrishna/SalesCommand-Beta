"""
Data Lake Manager for Sales Intelligence Platform
Orchestrates operations across Raw, Canonical, and Serving zones.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging

from core.enums import EntityType, IntegrationSource, VisibilityScope, UserRole
from core.base import BaseEntity, AuditEntry
from .raw_zone import RawZoneHandler
from .canonical_zone import CanonicalZoneHandler
from .serving_zone import ServingZoneHandler


logger = logging.getLogger(__name__)


class DataLakeManager:
    """
    Central manager for the Data Lake.
    Provides a unified interface for all data lake operations.
    """
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.raw = RawZoneHandler(db)
        self.canonical = CanonicalZoneHandler(db)
        self.serving = ServingZoneHandler(db)
    
    # ==================== HIGH-LEVEL OPERATIONS ====================
    
    async def ingest_from_source(
        self,
        source: IntegrationSource,
        entity_type: EntityType,
        source_id: str,
        raw_data: Dict[str, Any],
        canonical_entity: BaseEntity,
        batch_id: str,
        user_id: Optional[str] = None
    ) -> tuple[str, str, bool]:
        """
        Full ingestion pipeline: Raw → Canonical → Serving update
        
        Args:
            source: Source system
            entity_type: Entity type
            source_id: ID in source system
            raw_data: Original data from source
            canonical_entity: Normalized entity
            batch_id: Sync batch ID
            user_id: User performing sync
            
        Returns:
            Tuple of (raw_id, canonical_id, is_new)
        """
        # Step 1: Store in Raw Zone (immutable)
        raw_id = await self.raw.store(
            source=source,
            entity_type=entity_type,
            source_id=source_id,
            raw_data=raw_data,
            batch_id=batch_id
        )
        
        # Step 2: Upsert in Canonical Zone
        canonical_id, is_new = await self.canonical.upsert(
            entity=canonical_entity,
            source=source,
            source_id=source_id,
            user_id=user_id
        )
        
        # Step 3: Log audit entry
        await self._log_audit(
            entity_type=entity_type,
            entity_id=canonical_id,
            action="sync_create" if is_new else "sync_update",
            zone="canonical",
            source=source.value,
            user_id=user_id,
            metadata={
                "raw_id": raw_id,
                "batch_id": batch_id,
                "source_id": source_id
            }
        )
        
        # Step 4: Trigger serving zone updates (async in background ideally)
        if canonical_entity.owner_id:
            try:
                await self.serving.refresh_user_stats(canonical_entity.owner_id)
            except Exception as e:
                logger.warning(f"Failed to refresh serving stats: {e}")
        
        return raw_id, canonical_id, is_new
    
    async def get_entity(
        self,
        entity_type: EntityType,
        entity_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get an entity from the canonical zone"""
        return await self.canonical.get_by_id(entity_type, entity_id)
    
    async def get_entity_by_source(
        self,
        entity_type: EntityType,
        source: IntegrationSource,
        source_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get an entity by source system reference"""
        return await self.canonical.get_by_source(entity_type, source, source_id)
    
    async def query_entities(
        self,
        entity_type: EntityType,
        user_id: str,
        role: UserRole,
        visibility: VisibilityScope,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 100,
        skip: int = 0,
        team_ids: Optional[List[str]] = None,
        department_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Query entities with RBAC enforcement.
        This is the primary method for dashboard data access.
        """
        return await self.canonical.find_with_visibility(
            entity_type=entity_type,
            user_id=user_id,
            user_role=role,
            visibility_scope=visibility,
            team_ids=team_ids,
            department_id=department_id,
            additional_query=filters,
            limit=limit,
            skip=skip
        )
    
    async def get_dashboard_data(
        self,
        user_id: str,
        role: UserRole,
        visibility: VisibilityScope,
        period: str = "daily"
    ) -> Dict[str, Any]:
        """
        Get all dashboard data for a user from the Serving Zone.
        This is the optimized read path for dashboards.
        """
        # Get cached stats or refresh
        stats = await self.serving.get_dashboard_stats(user_id, period)
        if not stats:
            stats_obj = await self.serving.refresh_user_stats(user_id, period)
            stats = stats_obj.to_mongo_dict()
        
        # Get pipeline summary
        pipeline = await self.serving.get_pipeline_summary(user_id, visibility)
        if not pipeline:
            pipeline_obj = await self.serving.refresh_pipeline_summary(user_id, visibility)
            pipeline = pipeline_obj.to_mongo_dict()
        
        # Get activity feed
        activity_feed = await self.serving.get_activity_feed(user_id, limit=20)
        
        # Get KPI trend
        kpi_trend = await self.serving.get_kpi_trend(user_id, days=30)
        
        return {
            "stats": stats,
            "pipeline": pipeline,
            "activity_feed": activity_feed,
            "kpi_trend": kpi_trend,
            "computed_at": datetime.now(timezone.utc).isoformat()
        }
    
    async def refresh_all_serving_data(
        self,
        user_id: str,
        visibility: VisibilityScope = VisibilityScope.OWN
    ) -> None:
        """Force refresh all serving zone data for a user"""
        for period in ["daily", "weekly", "monthly"]:
            await self.serving.refresh_user_stats(user_id, period)
        
        await self.serving.refresh_pipeline_summary(user_id, visibility)
        
        logger.info(f"Refreshed all serving data for user {user_id}")
    
    # ==================== SYNC MANAGEMENT ====================
    
    async def start_sync_batch(
        self,
        source: IntegrationSource,
        entity_type: EntityType,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """Start a new sync batch"""
        return await self.raw.create_batch(source, entity_type, metadata)
    
    async def complete_sync_batch(
        self,
        batch_id: str,
        status: str,
        stats: Dict[str, int],
        errors: Optional[List[Dict[str, Any]]] = None
    ) -> None:
        """Complete a sync batch"""
        await self.raw.complete_batch(batch_id, status, stats, errors)
    
    async def get_sync_history(
        self,
        source: Optional[IntegrationSource] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get sync batch history"""
        return await self.raw.get_batches(source, limit)
    
    async def get_last_sync_time(
        self,
        source: IntegrationSource,
        entity_type: EntityType
    ) -> Optional[datetime]:
        """Get timestamp of last successful sync"""
        return await self.raw.get_latest_sync_time(source, entity_type)
    
    # ==================== AUDIT & LOGGING ====================
    
    async def _log_audit(
        self,
        entity_type: EntityType,
        entity_id: str,
        action: str,
        zone: str,
        source: Optional[str] = None,
        user_id: Optional[str] = None,
        changes: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """Log an audit entry"""
        entry = AuditEntry(
            entity_type=entity_type.value,
            entity_id=entity_id,
            action=action,
            zone=zone,
            user_id=user_id,
            source=source,
            changes=changes or {},
            metadata=metadata or {}
        )
        
        await self.db["audit_trail"].insert_one(entry.model_dump())
    
    async def get_audit_trail(
        self,
        entity_type: Optional[EntityType] = None,
        entity_id: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get audit trail entries"""
        query = {}
        if entity_type:
            query["entity_type"] = entity_type.value
        if entity_id:
            query["entity_id"] = entity_id
        
        cursor = self.db["audit_trail"].find(
            query,
            {"_id": 0}
        ).sort("timestamp", -1).limit(limit)
        
        return await cursor.to_list(length=None)
    
    # ==================== DATA INTEGRITY ====================
    
    async def verify_data_integrity(
        self,
        entity_type: EntityType,
        source: Optional[IntegrationSource] = None
    ) -> Dict[str, Any]:
        """
        Verify data integrity across zones.
        Checks for orphaned records, missing references, etc.
        """
        results = {
            "entity_type": entity_type.value,
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "issues": [],
            "stats": {}
        }
        
        # Count records in canonical zone
        canonical_count = await self.canonical.count(entity_type)
        results["stats"]["canonical_count"] = canonical_count
        
        # If source specified, count raw records
        if source:
            raw_count = await self.raw.count_records(source, entity_type)
            results["stats"]["raw_count"] = raw_count
        
        # Check for entities without sources
        collection_name = self.canonical.COLLECTION_MAP.get(entity_type, (None, None))[0]
        if collection_name:
            orphaned = await self.db[collection_name].count_documents({
                "$or": [
                    {"_sources": {"$exists": False}},
                    {"_sources": {"$size": 0}}
                ]
            })
            if orphaned > 0:
                results["issues"].append({
                    "type": "orphaned_entities",
                    "count": orphaned,
                    "description": f"{orphaned} entities have no source references"
                })
        
        results["is_healthy"] = len(results["issues"]) == 0
        return results
