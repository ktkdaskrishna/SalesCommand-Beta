"""
Salesforce Sync Pipeline
========================
Complete sync pipeline that wires all components together.

This is the MAIN entry point for Salesforce synchronization.
It orchestrates: Connector → Mapper → Validator → Normalizer → Loader → Logger

Usage:
    pipeline = create_salesforce_pipeline(config, db)
    
    # Sync all entity types
    results = await pipeline.sync_all()
    
    # Sync specific entity type
    batch = await pipeline.execute("contact", mode="incremental")
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging

from sync_engine.pipeline import SyncPipeline
from sync_engine.base_components import BaseLoader, BaseSyncLogger
from core.interfaces import ISyncPipeline
from core.base import SyncBatch, RawRecord
from core.enums import IntegrationSource, EntityType, SyncStatus

from .connector import SalesforceConnector
from .mapper import (
    SalesforceContactMapper,
    SalesforceAccountMapper,
    SalesforceOpportunityMapper,
    SalesforceLeadMapper,
    SalesforceUserMapper,
)
from .validator import SalesforceValidator
from .normalizer import SalesforceNormalizer


logger = logging.getLogger(__name__)


class SalesforceLoader(BaseLoader):
    """
    Salesforce-specific loader.
    Determines entity type from raw record structure.
    """
    
    def _get_entity_type(self, record: RawRecord) -> EntityType:
        """Determine entity type from Salesforce record"""
        data = record.raw_data
        source_model = None
        
        # Check source reference for model info
        # The source model is stored when we create the raw record
        
        # Fallback: check field patterns
        if "AccountId" in data and "StageName" in data:
            return EntityType.OPPORTUNITY
        elif "AccountId" in data and "FirstName" in data:
            return EntityType.CONTACT
        elif "NumberOfEmployees" in data or "Industry" in data:
            return EntityType.ACCOUNT
        elif "Username" in data:
            return EntityType.USER
        elif "ActivityDate" in data:
            return EntityType.ACTIVITY
        
        return EntityType.CONTACT


class SalesforceSyncPipeline(ISyncPipeline):
    """
    Complete Salesforce sync pipeline.
    
    Handles syncing:
    - Users (sync first - needed for owner references)
    - Accounts
    - Contacts
    - Opportunities
    - Leads (converted to opportunities)
    - Activities/Tasks
    """
    
    # Entity type → Mapper class mapping
    ENTITY_MAPPERS = {
        'user': SalesforceUserMapper,
        'account': SalesforceAccountMapper,
        'contact': SalesforceContactMapper,
        'opportunity': SalesforceOpportunityMapper,
        'lead': SalesforceLeadMapper,
    }
    
    # Recommended sync order (dependencies first)
    SYNC_ORDER = ['user', 'account', 'contact', 'opportunity']
    
    def __init__(self, config: Dict[str, Any], db: AsyncIOMotorDatabase):
        """
        Initialize the Salesforce pipeline.
        
        Args:
            config: Salesforce configuration
                - instance_url: Salesforce instance URL
                - access_token: OAuth access token
                - api_version: API version (default v58.0)
            db: MongoDB database instance
        """
        self.config = config
        self.db = db
        
        # Initialize components
        self._connector = SalesforceConnector(config)
        self._validator = SalesforceValidator()
        self._normalizer = SalesforceNormalizer(db)
        self._sync_logger = BaseSyncLogger(db)
        
        # Data lake manager
        from data_lake import DataLakeManager
        self._data_lake = DataLakeManager(db)
        self._loader = SalesforceLoader(self._data_lake)
        
        # Cache of pipelines per entity type
        self._pipelines: Dict[str, SyncPipeline] = {}
    
    @property
    def connector(self):
        return self._connector
    
    @property
    def source_name(self) -> str:
        return IntegrationSource.SALESFORCE.value
    
    def _get_pipeline(self, entity_type: str) -> SyncPipeline:
        """Get or create pipeline for entity type"""
        if entity_type not in self._pipelines:
            mapper_class = self.ENTITY_MAPPERS.get(entity_type)
            if not mapper_class:
                raise ValueError(f"No mapper for entity type: {entity_type}")
            
            mapper = mapper_class()
            
            self._pipelines[entity_type] = SyncPipeline(
                connector=self._connector,
                mapper=mapper,
                validator=self._validator,
                normalizer=self._normalizer,
                loader=self._loader,
                sync_logger=self._sync_logger,
                batch_size=self.config.get('batch_size', 200)
            )
        
        return self._pipelines[entity_type]
    
    async def execute(
        self,
        entity_type: str,
        mode: str = "full",
        since: Optional[datetime] = None
    ) -> SyncBatch:
        """
        Execute sync for a specific entity type.
        
        Args:
            entity_type: Type to sync (user, account, contact, opportunity)
            mode: full or incremental
            since: For incremental, sync records after this time
            
        Returns:
            SyncBatch with results
        """
        pipeline = self._get_pipeline(entity_type)
        return await pipeline.execute(entity_type, mode, since)
    
    async def sync_all(
        self,
        mode: str = "full",
        since: Optional[datetime] = None,
        entity_types: Optional[List[str]] = None
    ) -> Dict[str, SyncBatch]:
        """
        Sync all (or specified) entity types in dependency order.
        
        Args:
            mode: full or incremental
            since: For incremental sync
            entity_types: Specific types to sync, or None for all
            
        Returns:
            Dict mapping entity_type → SyncBatch results
        """
        results = {}
        
        # Determine types to sync
        types_to_sync = entity_types or self.SYNC_ORDER
        
        # Sync in order
        for entity_type in types_to_sync:
            if entity_type not in self.ENTITY_MAPPERS:
                logger.warning(f"Unknown entity type: {entity_type}")
                continue
            
            try:
                logger.info(f"Starting Salesforce {entity_type} sync...")
                results[entity_type] = await self.execute(entity_type, mode, since)
                
                logger.info(
                    f"Salesforce {entity_type} sync complete: "
                    f"{results[entity_type].records_processed} processed, "
                    f"{results[entity_type].records_created} created, "
                    f"{results[entity_type].records_updated} updated"
                )
                
            except Exception as e:
                logger.error(f"Failed to sync Salesforce {entity_type}: {e}")
                results[entity_type] = SyncBatch(
                    source=self.source_name,
                    entity_type=entity_type,
                    status=SyncStatus.FAILED.value,
                    errors=[{"error": str(e)}]
                )
        
        # Clear normalizer cache after full sync
        self._normalizer.clear_cache()
        
        return results
    
    async def replay(self, batch_id: str) -> SyncBatch:
        """
        Replay a previous sync batch.
        
        Useful for:
        - Reprocessing after bug fixes
        - Re-running normalization with new rules
        """
        # Get batch info
        batch_doc = await self.db["sync_batches"].find_one({"id": batch_id})
        if not batch_doc:
            raise ValueError(f"Batch not found: {batch_id}")
        
        entity_type = batch_doc["entity_type"]
        
        # Get raw records from batch
        raw_records = await self._data_lake.raw.get_by_batch(
            IntegrationSource.SALESFORCE,
            EntityType(entity_type),
            batch_id
        )
        
        # Create replay batch
        replay_batch = SyncBatch(
            source=self.source_name,
            entity_type=entity_type,
            metadata={"replay_of": batch_id, "mode": "replay"}
        )
        
        await self._sync_logger.log_sync_start(replay_batch)
        
        pipeline = self._get_pipeline(entity_type)
        
        # Reprocess each record
        for raw_doc in raw_records:
            try:
                raw_record = RawRecord(
                    source=raw_doc["_source"],
                    source_id=raw_doc["_source_id"],
                    raw_data=raw_doc["_raw_data"],
                    sync_batch_id=replay_batch.id
                )
                
                # Map to canonical
                entity = pipeline._mapper.map_to_canonical(raw_record)
                
                # Validate
                errors = self._validator.validate_canonical(entity)
                if errors:
                    replay_batch.records_failed += 1
                    continue
                
                # Normalize
                entity = await self._normalizer.normalize(entity)
                await self._normalizer.deduplicate(entity)
                entity = await self._normalizer.resolve_references(entity)
                
                # Load (skip raw since it exists)
                await self._loader.load_canonical(entity)
                await self._loader.load_serving(entity)
                
                replay_batch.records_processed += 1
                replay_batch.records_updated += 1
                
            except Exception as e:
                replay_batch.records_processed += 1
                replay_batch.records_failed += 1
                replay_batch.errors.append({
                    "source_id": raw_doc.get("_source_id"),
                    "error": str(e)
                })
        
        replay_batch.status = SyncStatus.COMPLETED.value if replay_batch.records_failed == 0 else SyncStatus.PARTIAL.value
        await self._sync_logger.log_sync_complete(replay_batch)
        
        return replay_batch
    
    async def sync_single(
        self,
        entity_type: str,
        source_id: str
    ) -> Optional[Any]:
        """
        Sync a single record by Salesforce ID.
        
        Useful for:
        - Real-time webhooks
        - Manual refresh of specific record
        """
        pipeline = self._get_pipeline(entity_type)
        return await pipeline.sync_single(entity_type, source_id)
    
    async def test_connection(self) -> Dict[str, Any]:
        """Test Salesforce connection"""
        return await self._connector.test_connection()


def create_salesforce_pipeline(
    config: Dict[str, Any],
    db: AsyncIOMotorDatabase
) -> SalesforceSyncPipeline:
    """
    Factory function to create Salesforce pipeline.
    
    Usage:
        config = {
            "instance_url": "https://yourcompany.salesforce.com",
            "access_token": "your-oauth-token",
            "api_version": "v58.0"
        }
        
        pipeline = create_salesforce_pipeline(config, db)
        results = await pipeline.sync_all()
    """
    return SalesforceSyncPipeline(config, db)
