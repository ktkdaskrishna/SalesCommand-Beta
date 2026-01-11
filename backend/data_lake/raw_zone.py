"""
Raw Zone Handler for Sales Intelligence Platform
Manages immutable, timestamped copies of source data.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging

from core.base import RawRecord, AuditEntry
from core.enums import DataZone, EntityType, IntegrationSource


logger = logging.getLogger(__name__)


class RawZoneHandler:
    """
    Handles all operations for the Raw Zone of the Data Lake.
    
    Principles:
    - Data is immutable (append-only)
    - Every record is timestamped
    - Original data is preserved exactly as received
    - Records are replayable via batch_id
    """
    
    # Collection name mappings
    COLLECTION_MAP = {
        (IntegrationSource.ODOO, EntityType.CONTACT): "raw_odoo_partners",
        (IntegrationSource.ODOO, EntityType.ACCOUNT): "raw_odoo_partners",
        (IntegrationSource.ODOO, EntityType.OPPORTUNITY): "raw_odoo_leads",
        (IntegrationSource.ODOO, EntityType.ACTIVITY): "raw_odoo_activities",
        (IntegrationSource.ODOO, EntityType.USER): "raw_odoo_users",
        (IntegrationSource.MICROSOFT365, EntityType.USER): "raw_ms365_users",
        (IntegrationSource.MICROSOFT365, EntityType.CONTACT): "raw_ms365_contacts",
        (IntegrationSource.MICROSOFT365, EntityType.ACTIVITY): "raw_ms365_events",
    }
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
    
    def _get_collection_name(self, source: IntegrationSource, entity_type: EntityType) -> str:
        """Get the collection name for a source/entity combination"""
        key = (source, entity_type)
        if key in self.COLLECTION_MAP:
            return self.COLLECTION_MAP[key]
        # Default naming pattern
        return f"raw_{source.value}_{entity_type.value}s"
    
    async def store(
        self,
        source: IntegrationSource,
        entity_type: EntityType,
        source_id: Any,
        raw_data: Dict[str, Any],
        batch_id: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Store a raw record in the appropriate collection.
        
        Args:
            source: Source system (odoo, ms365, etc.)
            entity_type: Type of entity (contact, account, etc.)
            source_id: ID in the source system
            raw_data: Original unmodified data
            batch_id: Sync batch ID for replay
            metadata: Optional additional metadata
            
        Returns:
            The raw record ID
        """
        collection_name = self._get_collection_name(source, entity_type)
        collection = self.db[collection_name]
        
        record = RawRecord(
            source=source.value,
            source_id=str(source_id),
            raw_data=raw_data,
            sync_batch_id=batch_id
        )
        
        doc = record.to_mongo_dict()
        if metadata:
            doc["_metadata"] = metadata
        
        result = await collection.insert_one(doc)
        
        logger.debug(f"Stored raw record: {collection_name}/{record.raw_id}")
        return record.raw_id
    
    async def bulk_store(
        self,
        source: IntegrationSource,
        entity_type: EntityType,
        records: List[Dict[str, Any]],
        batch_id: str
    ) -> int:
        """
        Bulk store multiple raw records.
        
        Args:
            source: Source system
            entity_type: Type of entity
            records: List of dicts with 'source_id' and 'data' keys
            batch_id: Sync batch ID
            
        Returns:
            Number of records stored
        """
        if not records:
            return 0
        
        collection_name = self._get_collection_name(source, entity_type)
        collection = self.db[collection_name]
        
        docs = []
        for rec in records:
            record = RawRecord(
                source=source.value,
                source_id=str(rec["source_id"]),
                raw_data=rec["data"],
                sync_batch_id=batch_id
            )
            docs.append(record.to_mongo_dict())
        
        result = await collection.insert_many(docs)
        count = len(result.inserted_ids)
        
        logger.info(f"Bulk stored {count} raw records to {collection_name}")
        return count
    
    async def get_by_batch(
        self,
        source: IntegrationSource,
        entity_type: EntityType,
        batch_id: str
    ) -> List[Dict[str, Any]]:
        """Get all raw records from a specific sync batch (for replay)"""
        collection_name = self._get_collection_name(source, entity_type)
        collection = self.db[collection_name]
        
        cursor = collection.find(
            {"_sync_batch_id": batch_id},
            {"_id": 0}
        ).sort("_ingested_at", 1)
        
        return await cursor.to_list(length=None)
    
    async def get_by_source_id(
        self,
        source: IntegrationSource,
        entity_type: EntityType,
        source_id: Any
    ) -> Optional[Dict[str, Any]]:
        """Get the most recent raw record for a source ID"""
        collection_name = self._get_collection_name(source, entity_type)
        collection = self.db[collection_name]
        
        doc = await collection.find_one(
            {"_source_id": str(source_id)},
            {"_id": 0},
            sort=[("_ingested_at", -1)]
        )
        
        return doc
    
    async def get_latest_sync_time(
        self,
        source: IntegrationSource,
        entity_type: EntityType
    ) -> Optional[datetime]:
        """Get the timestamp of the most recent sync for incremental syncs"""
        collection_name = self._get_collection_name(source, entity_type)
        collection = self.db[collection_name]
        
        doc = await collection.find_one(
            {},
            {"_ingested_at": 1},
            sort=[("_ingested_at", -1)]
        )
        
        return doc["_ingested_at"] if doc else None
    
    async def count_records(
        self,
        source: IntegrationSource,
        entity_type: EntityType,
        since: Optional[datetime] = None
    ) -> int:
        """Count raw records, optionally since a timestamp"""
        collection_name = self._get_collection_name(source, entity_type)
        collection = self.db[collection_name]
        
        query = {}
        if since:
            query["_ingested_at"] = {"$gte": since}
        
        return await collection.count_documents(query)
    
    async def get_batches(
        self,
        source: Optional[IntegrationSource] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get list of sync batches for a source"""
        collection = self.db["sync_batches"]
        
        query = {}
        if source:
            query["source"] = source.value
        
        cursor = collection.find(
            query,
            {"_id": 0}
        ).sort("started_at", -1).limit(limit)
        
        return await cursor.to_list(length=None)
    
    async def create_batch(
        self,
        source: IntegrationSource,
        entity_type: EntityType,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """Create a new sync batch record"""
        import uuid
        
        batch_id = str(uuid.uuid4())
        batch_doc = {
            "id": batch_id,
            "source": source.value,
            "entity_type": entity_type.value,
            "started_at": datetime.now(timezone.utc),
            "completed_at": None,
            "status": "running",
            "records_processed": 0,
            "records_created": 0,
            "records_updated": 0,
            "records_failed": 0,
            "errors": [],
            "metadata": metadata or {}
        }
        
        await self.db["sync_batches"].insert_one(batch_doc)
        logger.info(f"Created sync batch: {batch_id} for {source.value}/{entity_type.value}")
        
        return batch_id
    
    async def update_batch(
        self,
        batch_id: str,
        updates: Dict[str, Any]
    ) -> None:
        """Update a sync batch record"""
        await self.db["sync_batches"].update_one(
            {"id": batch_id},
            {"$set": updates}
        )
    
    async def complete_batch(
        self,
        batch_id: str,
        status: str,
        stats: Dict[str, int],
        errors: Optional[List[Dict[str, Any]]] = None
    ) -> None:
        """Mark a sync batch as complete"""
        await self.update_batch(batch_id, {
            "completed_at": datetime.now(timezone.utc),
            "status": status,
            "records_processed": stats.get("processed", 0),
            "records_created": stats.get("created", 0),
            "records_updated": stats.get("updated", 0),
            "records_failed": stats.get("failed", 0),
            "errors": errors or []
        })
