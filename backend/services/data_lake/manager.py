"""
Data Lake Manager
Handles all Data Lake zone operations (Raw, Canonical, Serving)
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import hashlib
import json
import logging

from motor.motor_asyncio import AsyncIOMotorDatabase
from models.base import (
    RawRecord, CanonicalRecord, ServingRecord,
    EntityType, IntegrationType, DataLakeZone
)
from core.database import Database

logger = logging.getLogger(__name__)


class DataLakeManager:
    """
    Manages the three-zone Data Lake architecture:
    - Raw (Bronze): Immutable source data
    - Canonical (Silver): Normalized, validated
    - Serving (Gold): Aggregated, query-optimized
    """
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.raw_collection = db[Database.RAW_ZONE]
        self.canonical_collection = db[Database.CANONICAL_ZONE]
        self.serving_collection = db[Database.SERVING_ZONE]
    
    # ===================== RAW ZONE OPERATIONS =====================
    
    async def ingest_raw(
        self,
        source: IntegrationType,
        source_id: str,
        entity_type: EntityType,
        raw_data: Dict[str, Any],
        sync_batch_id: str
    ) -> RawRecord:
        """
        Ingest raw data into the Raw Zone (Bronze layer).
        Data is stored exactly as received from source.
        """
        # Calculate checksum for change detection
        checksum = self._calculate_checksum(raw_data)
        
        # Check if record already exists - must match source, source_id AND entity_type
        existing = await self.raw_collection.find_one({
            "source": source.value,
            "source_id": source_id,
            "entity_type": entity_type.value
        })
        
        record = RawRecord(
            source=source,
            source_id=source_id,
            entity_type=entity_type,
            raw_data=raw_data,
            sync_batch_id=sync_batch_id,
            checksum=checksum
        )
        
        if existing:
            # Update if checksum changed
            if existing.get("checksum") != checksum:
                await self.raw_collection.update_one(
                    {"_id": existing["_id"]},
                    {"$set": {
                        "raw_data": raw_data,
                        "checksum": checksum,
                        "ingested_at": record.ingested_at,
                        "sync_batch_id": sync_batch_id
                    }}
                )
                logger.info(f"Updated raw record: {source.value}/{entity_type.value}/{source_id}")
            else:
                logger.debug(f"Raw record unchanged: {source.value}/{entity_type.value}/{source_id}")
        else:
            # Insert new record
            await self.raw_collection.insert_one(record.model_dump())
            logger.info(f"Inserted raw record: {source.value}/{entity_type.value}/{source_id}")
        
        return record
    
    async def get_raw_records(
        self,
        source: Optional[IntegrationType] = None,
        entity_type: Optional[EntityType] = None,
        since: Optional[datetime] = None,
        limit: int = 1000
    ) -> List[Dict[str, Any]]:
        """Query raw records with filters"""
        query = {}
        if source:
            query["source"] = source.value
        if entity_type:
            query["entity_type"] = entity_type.value
        if since:
            query["ingested_at"] = {"$gte": since}
        
        cursor = self.raw_collection.find(query, {"_id": 0}).limit(limit)
        return await cursor.to_list(length=limit)
    
    # ===================== CANONICAL ZONE OPERATIONS =====================
    
    async def normalize_to_canonical(
        self,
        raw_record: Dict[str, Any],
        normalized_data: Dict[str, Any],
        validation_result: Dict[str, Any]
    ) -> CanonicalRecord:
        """
        Transform raw data to canonical form and store in Canonical Zone.
        This is where field mapping and validation happens.
        """
        source = raw_record["source"]
        source_id = raw_record["source_id"]
        entity_type = raw_record["entity_type"]
        
        # Check for existing canonical record - must match entity_type as well
        existing = await self.canonical_collection.find_one({
            "entity_type": entity_type,
            "source_refs": {
                "$elemMatch": {
                    "source": source,
                    "source_id": source_id
                }
            }
        })
        
        record = CanonicalRecord(
            entity_type=EntityType(entity_type),
            data=normalized_data,
            source_refs=[{"source": source, "source_id": source_id}],
            validation_status=validation_result.get("status", "valid"),
            validation_errors=validation_result.get("errors", []),
            quality_score=validation_result.get("quality_score", 1.0)
        )
        
        if existing:
            # Update existing canonical record
            await self.canonical_collection.update_one(
                {"canonical_id": existing["canonical_id"]},
                {"$set": {
                    "data": normalized_data,
                    "validation_status": record.validation_status,
                    "validation_errors": record.validation_errors,
                    "quality_score": record.quality_score,
                    "last_updated": record.last_updated,
                    "last_validated": record.last_validated
                }}
            )
            record.canonical_id = existing["canonical_id"]
            record.first_seen = existing.get("first_seen", record.first_seen)
            logger.info(f"Updated canonical record: {entity_type}/{source_id}")
        else:
            await self.canonical_collection.insert_one(record.model_dump())
            logger.info(f"Inserted canonical record: {entity_type}/{source_id}")
        
        return record
    
    async def get_canonical_records(
        self,
        entity_type: Optional[EntityType] = None,
        validation_status: Optional[str] = None,
        limit: int = 1000
    ) -> List[Dict[str, Any]]:
        """Query canonical records"""
        query = {}
        if entity_type:
            query["entity_type"] = entity_type.value
        if validation_status:
            query["validation_status"] = validation_status
        
        cursor = self.canonical_collection.find(query, {"_id": 0}).limit(limit)
        return await cursor.to_list(length=limit)
    
    # ===================== SERVING ZONE OPERATIONS =====================
    
    async def aggregate_to_serving(
        self,
        entity_type: EntityType,
        serving_data: Dict[str, Any],
        canonical_refs: List[str],
        aggregation_type: str = "single"
    ) -> ServingRecord:
        """
        Aggregate canonical data into Serving Zone for fast dashboard queries.
        """
        # Check for existing serving record - must match entity_type as well
        serving_id = serving_data.get("id") or serving_data.get("serving_id")
        
        existing = None
        if serving_id:
            existing = await self.serving_collection.find_one({
                "entity_type": entity_type.value,
                "serving_id": serving_id
            })
        
        record = ServingRecord(
            entity_type=entity_type,
            data=serving_data,
            canonical_refs=canonical_refs,
            aggregation_type=aggregation_type
        )
        
        if serving_id:
            record.serving_id = serving_id
        
        if existing:
            await self.serving_collection.update_one(
                {"serving_id": existing["serving_id"], "entity_type": entity_type.value},
                {"$set": {
                    "data": serving_data,
                    "canonical_refs": canonical_refs,
                    "last_aggregated": record.last_aggregated
                }}
            )
            record.serving_id = existing["serving_id"]
            logger.info(f"Updated serving record: {entity_type.value}/{serving_id}")
        else:
            await self.serving_collection.insert_one(record.model_dump())
            logger.info(f"Inserted serving record: {entity_type.value}/{serving_id}")
        
        return record
    
    async def get_serving_records(
        self,
        entity_type: Optional[EntityType] = None,
        limit: int = 1000
    ) -> List[Dict[str, Any]]:
        """Query serving records - optimized for dashboard"""
        query = {}
        if entity_type:
            query["entity_type"] = entity_type.value
        
        cursor = self.serving_collection.find(query, {"_id": 0}).limit(limit)
        return await cursor.to_list(length=limit)
    
    async def get_serving_by_id(self, serving_id: str) -> Optional[Dict[str, Any]]:
        """Get single serving record by ID"""
        return await self.serving_collection.find_one(
            {"serving_id": serving_id},
            {"_id": 0}
        )
    
    # ===================== DATA LAKE HEALTH =====================
    
    async def get_health_stats(self) -> Dict[str, Any]:
        """Get Data Lake health statistics"""
        raw_count = await self.raw_collection.count_documents({})
        canonical_count = await self.canonical_collection.count_documents({})
        serving_count = await self.serving_collection.count_documents({})
        
        # Quality metrics
        invalid_count = await self.canonical_collection.count_documents({
            "validation_status": "invalid"
        })
        
        return {
            "zones": {
                "raw": {"count": raw_count, "status": "healthy"},
                "canonical": {"count": canonical_count, "status": "healthy"},
                "serving": {"count": serving_count, "status": "healthy"}
            },
            "quality": {
                "total_canonical": canonical_count,
                "invalid_records": invalid_count,
                "quality_rate": round((canonical_count - invalid_count) / max(canonical_count, 1) * 100, 2)
            },
            "last_check": datetime.now(timezone.utc).isoformat()
        }
    
    # ===================== UTILITIES =====================
    
    def _calculate_checksum(self, data: Dict[str, Any]) -> str:
        """Calculate MD5 checksum for change detection"""
        json_str = json.dumps(data, sort_keys=True, default=str)
        return hashlib.md5(json_str.encode()).hexdigest()
