"""
Base Components for the Sync Engine Pipeline
Abstract implementations that integrations extend.
"""

from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, AsyncIterator
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging
import hashlib
import json

from core.interfaces import IConnector, IMapper, IValidator, INormalizer, ILoader, ILogger
from core.base import RawRecord, BaseEntity, SyncBatch, AuditEntry
from core.enums import DataZone, EntityType, IntegrationSource
from data_lake import DataLakeManager


logger = logging.getLogger(__name__)


class BaseConnector(IConnector):
    """
    Base connector implementation.
    Subclasses implement source-specific connection logic.
    """
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self._connected = False
    
    @property
    def is_connected(self) -> bool:
        return self._connected
    
    async def connect(self) -> bool:
        """Override in subclass"""
        raise NotImplementedError
    
    async def disconnect(self) -> None:
        """Override in subclass"""
        self._connected = False
    
    async def test_connection(self) -> Dict[str, Any]:
        """Test connection and return status"""
        try:
            connected = await self.connect()
            return {
                "connected": connected,
                "source": self.source_name,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        except Exception as e:
            return {
                "connected": False,
                "source": self.source_name,
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
    
    async def fetch_records(
        self,
        entity_type: str,
        since: Optional[datetime] = None,
        batch_size: int = 100
    ) -> AsyncIterator[Dict[str, Any]]:
        """Override in subclass"""
        raise NotImplementedError
    
    async def fetch_record(self, entity_type: str, record_id: Any) -> Optional[Dict[str, Any]]:
        """Override in subclass"""
        raise NotImplementedError
    
    async def get_record_count(self, entity_type: str, since: Optional[datetime] = None) -> int:
        """Override in subclass"""
        raise NotImplementedError
    
    @property
    def source_name(self) -> str:
        """Override in subclass"""
        raise NotImplementedError


class BaseMapper(IMapper):
    """
    Base mapper implementation.
    Transforms source data to internal schema.
    """
    
    def __init__(self, source: IntegrationSource, field_mappings: Optional[Dict[str, str]] = None):
        self.source = source
        self._field_mappings = field_mappings or {}
    
    def map_to_raw(self, source_data: Dict[str, Any], batch_id: str) -> RawRecord:
        """Create a raw record from source data"""
        source_id = self._extract_source_id(source_data)
        
        return RawRecord(
            source=self.source.value,
            source_id=str(source_id),
            raw_data=source_data,
            sync_batch_id=batch_id
        )
    
    def map_to_canonical(self, raw_record: RawRecord) -> BaseEntity:
        """Override in subclass to create specific entity type"""
        raise NotImplementedError
    
    def get_field_mappings(self) -> Dict[str, str]:
        return self._field_mappings
    
    def _extract_source_id(self, source_data: Dict[str, Any]) -> Any:
        """Extract the source system ID from the record"""
        return source_data.get("id")
    
    def _map_field(self, source_data: Dict[str, Any], source_field: str, default: Any = None) -> Any:
        """Map a field using configured mappings"""
        # Direct access
        if source_field in source_data:
            return source_data[source_field]
        
        # Check mappings
        if source_field in self._field_mappings:
            mapped_field = self._field_mappings[source_field]
            return source_data.get(mapped_field, default)
        
        return default
    
    def _compute_hash(self, data: Dict[str, Any]) -> str:
        """Compute a hash for change detection"""
        serialized = json.dumps(data, sort_keys=True, default=str)
        return hashlib.md5(serialized.encode()).hexdigest()


class BaseValidator(IValidator):
    """
    Base validator implementation.
    Validates data against business rules.
    """
    
    def __init__(self, rules: Optional[Dict[str, Any]] = None):
        self._rules = rules or {}
    
    def validate_raw(self, record: RawRecord) -> List[str]:
        """Validate raw record"""
        errors = []
        
        if not record.source_id:
            errors.append("Missing source ID")
        
        if not record.raw_data:
            errors.append("Empty raw data")
        
        return errors
    
    def validate_canonical(self, entity: BaseEntity) -> List[str]:
        """Override in subclass for entity-specific validation"""
        errors = []
        
        if not entity.id:
            errors.append("Missing entity ID")
        
        return errors
    
    def get_validation_rules(self) -> Dict[str, Any]:
        return self._rules
    
    def _validate_required(self, data: Dict[str, Any], fields: List[str]) -> List[str]:
        """Check required fields are present"""
        errors = []
        for field in fields:
            if field not in data or data[field] is None:
                errors.append(f"Missing required field: {field}")
        return errors
    
    def _validate_email(self, email: str) -> bool:
        """Basic email validation"""
        if not email:
            return True  # Optional
        return "@" in email and "." in email.split("@")[-1]


class BaseNormalizer(INormalizer):
    """
    Base normalizer implementation.
    Standardizes data formats and handles deduplication.
    """
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
    
    async def normalize(self, entity: BaseEntity) -> BaseEntity:
        """Apply normalization rules"""
        # Standardize strings (trim, normalize case)
        if hasattr(entity, 'name') and entity.name:
            entity.name = entity.name.strip()
        
        if hasattr(entity, 'email') and entity.email:
            entity.email = entity.email.lower().strip()
        
        if hasattr(entity, 'phone') and entity.phone:
            entity.phone = self._normalize_phone(entity.phone)
        
        return entity
    
    async def deduplicate(self, entity: BaseEntity) -> Optional[BaseEntity]:
        """Check for and handle duplicates. Override for specific logic."""
        return None
    
    async def resolve_references(self, entity: BaseEntity) -> BaseEntity:
        """Resolve foreign key references. Override for specific logic."""
        return entity
    
    def _normalize_phone(self, phone: str) -> str:
        """Normalize phone number format"""
        # Remove common formatting characters
        normalized = ''.join(c for c in phone if c.isdigit() or c == '+')
        return normalized


class BaseLoader(ILoader):
    """
    Base loader implementation.
    Writes data to data lake zones.
    """
    
    def __init__(self, data_lake: DataLakeManager):
        self.data_lake = data_lake
    
    async def load_raw(self, record: RawRecord) -> str:
        """Load to raw zone"""
        # Delegate to raw zone handler
        return await self.data_lake.raw.store(
            source=IntegrationSource(record.source),
            entity_type=self._get_entity_type(record),
            source_id=record.source_id,
            raw_data=record.raw_data,
            batch_id=record.sync_batch_id
        )
    
    async def load_canonical(self, entity: BaseEntity) -> str:
        """Load to canonical zone"""
        source = self._get_primary_source(entity)
        source_id = entity.get_source_id(source.value) if source else None
        
        entity_id, _ = await self.data_lake.canonical.upsert(
            entity=entity,
            source=source or IntegrationSource.LOCAL,
            source_id=source_id or entity.id
        )
        return entity_id
    
    async def load_serving(self, entity: BaseEntity) -> None:
        """Update serving zone based on entity change"""
        if hasattr(entity, 'owner_id') and entity.owner_id:
            await self.data_lake.serving.refresh_user_stats(entity.owner_id)
    
    async def bulk_load_raw(self, records: List[RawRecord]) -> int:
        """Bulk load to raw zone"""
        if not records:
            return 0
        
        # Group by source/entity type
        first = records[0]
        source = IntegrationSource(first.source)
        entity_type = self._get_entity_type(first)
        
        record_dicts = [
            {"source_id": r.source_id, "data": r.raw_data}
            for r in records
        ]
        
        return await self.data_lake.raw.bulk_store(
            source=source,
            entity_type=entity_type,
            records=record_dicts,
            batch_id=first.sync_batch_id
        )
    
    def _get_entity_type(self, record: RawRecord) -> EntityType:
        """Determine entity type from raw record. Override if needed."""
        return EntityType.CONTACT
    
    def _get_primary_source(self, entity: BaseEntity) -> Optional[IntegrationSource]:
        """Get primary source from entity"""
        if entity.sources:
            return IntegrationSource(entity.sources[0].source)
        return None


class BaseSyncLogger(ILogger):
    """
    Base sync logger implementation.
    Tracks all sync operations.
    """
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self._batch_logs: Dict[str, List[Dict]] = {}
    
    async def log_sync_start(self, batch: SyncBatch) -> None:
        """Log batch start"""
        self._batch_logs[batch.id] = []
        
        await self.db["sync_logs"].insert_one({
            "batch_id": batch.id,
            "source": batch.source,
            "entity_type": batch.entity_type,
            "event": "sync_started",
            "timestamp": datetime.now(timezone.utc),
            "metadata": batch.metadata
        })
        
        logger.info(f"Sync started: {batch.source}/{batch.entity_type} (batch: {batch.id})")
    
    async def log_sync_complete(self, batch: SyncBatch) -> None:
        """Log batch completion"""
        await self.db["sync_logs"].insert_one({
            "batch_id": batch.id,
            "source": batch.source,
            "entity_type": batch.entity_type,
            "event": "sync_completed",
            "timestamp": datetime.now(timezone.utc),
            "status": batch.status,
            "stats": {
                "processed": batch.records_processed,
                "created": batch.records_created,
                "updated": batch.records_updated,
                "failed": batch.records_failed
            },
            "errors": batch.errors[:10]  # Limit stored errors
        })
        
        # Flush batch logs
        if batch.id in self._batch_logs:
            del self._batch_logs[batch.id]
        
        logger.info(
            f"Sync completed: {batch.source}/{batch.entity_type} - "
            f"Processed: {batch.records_processed}, Created: {batch.records_created}, "
            f"Updated: {batch.records_updated}, Failed: {batch.records_failed}"
        )
    
    async def log_record_processed(
        self,
        batch_id: str,
        source_id: Any,
        status: str,
        error: Optional[str] = None
    ) -> None:
        """Log individual record processing"""
        log_entry = {
            "source_id": str(source_id),
            "status": status,
            "timestamp": datetime.now(timezone.utc),
            "error": error
        }
        
        if batch_id in self._batch_logs:
            self._batch_logs[batch_id].append(log_entry)
        
        if error:
            logger.warning(f"Record failed: {source_id} - {error}")
    
    async def log_audit(self, entry: AuditEntry) -> None:
        """Write audit entry"""
        await self.db["audit_trail"].insert_one(entry.model_dump())
    
    async def get_sync_history(
        self,
        source: Optional[str] = None,
        limit: int = 50
    ) -> List[SyncBatch]:
        """Get sync history"""
        query = {"event": "sync_completed"}
        if source:
            query["source"] = source
        
        cursor = self.db["sync_logs"].find(
            query,
            {"_id": 0}
        ).sort("timestamp", -1).limit(limit)
        
        return await cursor.to_list(length=None)
