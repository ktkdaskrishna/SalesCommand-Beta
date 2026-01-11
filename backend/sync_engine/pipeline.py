"""
Sync Pipeline Orchestrator
Coordinates: Connector → Mapper → Validator → Normalizer → Loader → Logger
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Type
import logging
import asyncio

from core.interfaces import (
    ISyncPipeline,
    IConnector,
    IMapper,
    IValidator,
    INormalizer,
    ILoader,
    ILogger,
)
from core.base import SyncBatch, BaseEntity
from core.enums import SyncStatus, SyncMode, EntityType, IntegrationSource
from core.exceptions import SyncError, ValidationError


logger = logging.getLogger(__name__)


class SyncPipeline(ISyncPipeline):
    """
    Main sync pipeline orchestrator.
    
    Executes the full pipeline:
    1. Connector: Fetch data from source
    2. Mapper: Transform to internal format
    3. Validator: Check data integrity
    4. Normalizer: Standardize and dedupe
    5. Loader: Write to data lake
    6. Logger: Audit all operations
    """
    
    def __init__(
        self,
        connector: IConnector,
        mapper: IMapper,
        validator: IValidator,
        normalizer: INormalizer,
        loader: ILoader,
        sync_logger: ILogger,
        batch_size: int = 100,
        max_retries: int = 3,
        retry_delay: float = 1.0
    ):
        self._connector = connector
        self._mapper = mapper
        self._validator = validator
        self._normalizer = normalizer
        self._loader = loader
        self._logger = sync_logger
        
        self.batch_size = batch_size
        self.max_retries = max_retries
        self.retry_delay = retry_delay
    
    @property
    def connector(self) -> IConnector:
        return self._connector
    
    @property
    def source_name(self) -> str:
        return self._connector.source_name
    
    async def execute(
        self,
        entity_type: str,
        mode: str = "full",
        since: Optional[datetime] = None
    ) -> SyncBatch:
        """
        Execute the full sync pipeline.
        
        Args:
            entity_type: Type of entity to sync
            mode: Sync mode (full, incremental)
            since: For incremental, sync records modified since this time
            
        Returns:
            SyncBatch with results
        """
        # Create batch record
        batch = SyncBatch(
            source=self.source_name,
            entity_type=entity_type,
            metadata={"mode": mode, "since": since.isoformat() if since else None}
        )
        
        # Log start
        await self._logger.log_sync_start(batch)
        
        errors = []
        
        try:
            # Connect to source
            if not await self._connector.connect():
                raise SyncError(
                    self.source_name,
                    entity_type,
                    "Failed to connect to source system"
                )
            
            # Determine incremental timestamp
            if mode == "incremental" and not since:
                # Get last sync time from previous batch
                history = await self._logger.get_sync_history(self.source_name, limit=1)
                if history:
                    since = history[0].get("timestamp")
            
            # Process records in batches
            records_buffer = []
            
            async for source_record in self._connector.fetch_records(
                entity_type,
                since=since,
                batch_size=self.batch_size
            ):
                try:
                    # Process single record
                    result = await self._process_record(source_record, batch.id, entity_type)
                    
                    batch.records_processed += 1
                    
                    if result["status"] == "created":
                        batch.records_created += 1
                    elif result["status"] == "updated":
                        batch.records_updated += 1
                    elif result["status"] == "skipped":
                        pass
                    else:
                        batch.records_failed += 1
                        errors.append(result.get("error", {}))
                    
                    # Log progress
                    await self._logger.log_record_processed(
                        batch.id,
                        result["source_id"],
                        result["status"],
                        result.get("error_message")
                    )
                    
                except Exception as e:
                    batch.records_processed += 1
                    batch.records_failed += 1
                    error_info = {
                        "source_id": source_record.get("id"),
                        "error": str(e),
                        "type": type(e).__name__
                    }
                    errors.append(error_info)
                    
                    await self._logger.log_record_processed(
                        batch.id,
                        source_record.get("id"),
                        "error",
                        str(e)
                    )
                    
                    logger.error(f"Error processing record {source_record.get('id')}: {e}")
            
            # Determine final status
            if batch.records_failed == 0:
                batch.status = SyncStatus.COMPLETED.value
            elif batch.records_created + batch.records_updated > 0:
                batch.status = SyncStatus.PARTIAL.value
            else:
                batch.status = SyncStatus.FAILED.value
            
        except Exception as e:
            batch.status = SyncStatus.FAILED.value
            errors.append({
                "error": str(e),
                "type": type(e).__name__,
                "fatal": True
            })
            logger.error(f"Sync pipeline failed: {e}")
        
        finally:
            # Disconnect
            await self._connector.disconnect()
            
            # Finalize batch
            batch.completed_at = datetime.now(timezone.utc)
            batch.errors = errors
            
            # Log completion
            await self._logger.log_sync_complete(batch)
        
        return batch
    
    async def _process_record(
        self,
        source_record: Dict[str, Any],
        batch_id: str,
        entity_type: str
    ) -> Dict[str, Any]:
        """
        Process a single record through the pipeline.
        
        Returns:
            Dict with status and details
        """
        source_id = source_record.get("id")
        
        # Step 1: Map to raw format
        raw_record = self._mapper.map_to_raw(source_record, batch_id)
        
        # Step 2: Validate raw
        raw_errors = self._validator.validate_raw(raw_record)
        if raw_errors:
            return {
                "source_id": source_id,
                "status": "validation_error",
                "error_message": "; ".join(raw_errors),
                "error": {"stage": "raw_validation", "errors": raw_errors}
            }
        
        # Step 3: Map to canonical entity
        try:
            entity = self._mapper.map_to_canonical(raw_record)
        except Exception as e:
            return {
                "source_id": source_id,
                "status": "mapping_error",
                "error_message": str(e),
                "error": {"stage": "canonical_mapping", "errors": [str(e)]}
            }
        
        # Step 4: Validate canonical
        canonical_errors = self._validator.validate_canonical(entity)
        if canonical_errors:
            return {
                "source_id": source_id,
                "status": "validation_error",
                "error_message": "; ".join(canonical_errors),
                "error": {"stage": "canonical_validation", "errors": canonical_errors}
            }
        
        # Step 5: Normalize
        entity = await self._normalizer.normalize(entity)
        
        # Step 6: Check for duplicates
        existing = await self._normalizer.deduplicate(entity)
        is_update = existing is not None
        
        if is_update:
            entity = existing  # Use merged entity
        
        # Step 7: Resolve references
        entity = await self._normalizer.resolve_references(entity)
        
        # Step 8: Load to raw zone
        await self._loader.load_raw(raw_record)
        
        # Step 9: Load to canonical zone
        canonical_id = await self._loader.load_canonical(entity)
        
        # Step 10: Update serving zone
        await self._loader.load_serving(entity)
        
        return {
            "source_id": source_id,
            "canonical_id": canonical_id,
            "status": "updated" if is_update else "created"
        }
    
    async def replay(self, batch_id: str) -> SyncBatch:
        """
        Replay a previous sync batch.
        Useful for reprocessing after fixes or migrations.
        """
        # This would fetch raw records from the batch and reprocess
        # Implementation depends on specific requirements
        raise NotImplementedError("Replay not yet implemented")
    
    async def sync_single(
        self,
        entity_type: str,
        source_id: Any
    ) -> Optional[BaseEntity]:
        """
        Sync a single record by its source ID.
        Useful for real-time webhooks.
        """
        try:
            # Connect
            if not await self._connector.connect():
                raise SyncError(
                    self.source_name,
                    entity_type,
                    "Failed to connect"
                )
            
            # Fetch single record
            source_record = await self._connector.fetch_record(entity_type, source_id)
            if not source_record:
                return None
            
            # Create a mini-batch for this single record
            import uuid
            batch_id = f"single_{uuid.uuid4().hex[:8]}"
            
            # Process
            result = await self._process_record(source_record, batch_id, entity_type)
            
            if result["status"] in ("created", "updated"):
                # Return the canonical entity
                # This would need access to data lake to fetch
                return None  # For now
            
            return None
            
        finally:
            await self._connector.disconnect()


class SyncPipelineFactory:
    """
    Factory for creating sync pipelines for different integrations.
    """
    
    _registry: Dict[str, Type[ISyncPipeline]] = {}
    
    @classmethod
    def register(cls, source: IntegrationSource, pipeline_class: Type[ISyncPipeline]):
        """Register a pipeline class for a source"""
        cls._registry[source.value] = pipeline_class
    
    @classmethod
    def create(
        cls,
        source: IntegrationSource,
        config: Dict[str, Any],
        db
    ) -> ISyncPipeline:
        """Create a pipeline instance for a source"""
        if source.value not in cls._registry:
            raise ValueError(f"No pipeline registered for source: {source}")
        
        pipeline_class = cls._registry[source.value]
        return pipeline_class(config, db)
