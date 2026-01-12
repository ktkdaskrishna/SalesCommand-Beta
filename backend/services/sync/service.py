"""
Sync Service
Handles data synchronization from integrations to Data Lake
"""
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import uuid

from motor.motor_asyncio import AsyncIOMotorDatabase
from services.odoo.connector import OdooConnector
from services.data_lake.manager import DataLakeManager
from models.base import (
    EntityType, IntegrationType, SyncStatus, SyncJob
)
from core.database import Database

logger = logging.getLogger(__name__)


class SyncService:
    """
    Synchronization service for pulling data from integrations
    and loading into Data Lake
    """
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.data_lake = DataLakeManager(db)
        self._field_mappings_cache: Dict[str, Dict[str, Any]] = {}
    
    async def _load_field_mappings(self, integration_type: str, entity_type: EntityType) -> Optional[List[Dict[str, Any]]]:
        """
        Load custom field mappings from database for a specific entity type.
        Returns None if no custom mappings exist.
        """
        cache_key = f"{integration_type}:{entity_type.value}"
        
        if cache_key in self._field_mappings_cache:
            return self._field_mappings_cache[cache_key]
        
        mapping = await self.db.field_mappings.find_one({
            "integration_type": integration_type,
            "entity_type": entity_type.value,
            "is_active": True
        }, {"_id": 0})
        
        if mapping and mapping.get("mappings"):
            self._field_mappings_cache[cache_key] = mapping["mappings"]
            logger.info(f"Loaded {len(mapping['mappings'])} custom mappings for {entity_type.value}")
            return mapping["mappings"]
        
        return None
    
    async def run_odoo_sync(
        self,
        job_id: str,
        config: Dict[str, Any],
        entity_types: List[EntityType]
    ) -> Dict[str, Any]:
        """
        Run Odoo sync job
        """
        results = {
            "total_records": 0,
            "processed_records": 0,
            "failed_records": 0,
            "entities": {}
        }
        
        # Clear mappings cache at start of each sync
        self._field_mappings_cache = {}
        
        try:
            async with OdooConnector(
                url=config["url"],
                database=config["database"],
                username=config["username"],
                api_key=config["api_key"]
            ) as connector:
                
                for entity_type in entity_types:
                    try:
                        entity_result = await self._sync_entity(
                            connector, job_id, entity_type
                        )
                        results["entities"][entity_type.value] = entity_result
                        results["total_records"] += entity_result["total"]
                        results["processed_records"] += entity_result["processed"]
                        results["failed_records"] += entity_result["failed"]
                    except Exception as e:
                        logger.error(f"Failed to sync {entity_type.value}: {e}")
                        results["entities"][entity_type.value] = {
                            "error": str(e),
                            "total": 0,
                            "processed": 0,
                            "failed": 0
                        }
            
            return results
            
        except Exception as e:
            logger.error(f"Odoo sync failed: {e}")
            raise
    
    async def _sync_entity(
        self,
        connector: OdooConnector,
        job_id: str,
        entity_type: EntityType
    ) -> Dict[str, Any]:
        """
        Sync a single entity type from Odoo
        """
        result = {"total": 0, "processed": 0, "failed": 0, "used_custom_mappings": False}
        
        # Load custom field mappings if available
        custom_mappings = await self._load_field_mappings("odoo", entity_type)
        if custom_mappings:
            result["used_custom_mappings"] = True
            logger.info(f"Using {len(custom_mappings)} custom mappings for {entity_type.value}")
        
        # Map entity type to Odoo model and method
        entity_config = {
            EntityType.ACCOUNT: {
                "model": "res.partner",
                "method": connector.get_partners,
                "filter": [("is_company", "=", True)]
            },
            EntityType.CONTACT: {
                "model": "res.partner", 
                "method": connector.get_partners,
                # Use proper Odoo domain - contacts are non-company partners
                "filter": [("is_company", "=", False)]
            },
            EntityType.OPPORTUNITY: {
                "model": "crm.lead",
                "method": connector.get_opportunities,
                "filter": []
            },
            EntityType.ORDER: {
                "model": "sale.order",
                "method": connector.get_sale_orders,
                "filter": []
            },
            EntityType.INVOICE: {
                "model": "account.move",
                "method": connector.get_invoices,
                "filter": []
            }
        }
        
        config = entity_config.get(entity_type)
        if not config:
            logger.warning(f"No sync config for entity type: {entity_type}")
            return result
        
        try:
            # Fetch records from Odoo with pagination
            offset = 0
            limit = 100
            
            while True:
                records = await config["method"](
                    domain=config.get("filter", []),
                    limit=limit,
                    offset=offset
                )
                
                if not records:
                    break
                
                result["total"] += len(records)
                
                for record in records:
                    try:
                        source_id = str(record.get("id"))
                        logger.info(f"Processing record {source_id} for entity {entity_type.value}")
                        
                        # Ingest to Raw Zone
                        raw_result = await self.data_lake.ingest_raw(
                            source=IntegrationType.ODOO,
                            source_id=source_id,
                            entity_type=entity_type,
                            raw_data=record,
                            sync_batch_id=job_id
                        )
                        logger.info(f"Raw ingestion complete for {source_id}")
                        
                        # Transform using custom mappings or default normalization
                        if custom_mappings:
                            normalized = self._apply_custom_mappings(record, custom_mappings)
                        else:
                            normalized = self._normalize_odoo_record(record, entity_type)
                        
                        logger.info(f"Normalized data for {source_id}: {list(normalized.keys())}")
                        
                        await self.data_lake.normalize_to_canonical(
                            raw_record={
                                "source": IntegrationType.ODOO.value,
                                "source_id": source_id,
                                "entity_type": entity_type.value
                            },
                            normalized_data=normalized,
                            validation_result={"status": "valid", "errors": [], "quality_score": 1.0}
                        )
                        logger.info(f"Canonical zone complete for {source_id}")
                        
                        # Aggregate to Serving Zone
                        await self.data_lake.aggregate_to_serving(
                            entity_type=entity_type,
                            serving_data={**normalized, "id": source_id},
                            canonical_refs=[source_id],
                            aggregation_type="single"
                        )
                        logger.info(f"Serving zone complete for {source_id}")
                        
                        result["processed"] += 1
                        
                    except Exception as e:
                        logger.error(f"Failed to process record {record.get('id')}: {e}")
                        result["failed"] += 1
                
                offset += limit
                
                # Safety limit
                if offset > 10000:
                    logger.warning("Reached safety limit of 10000 records")
                    break
            
            logger.info(f"Synced {entity_type.value}: {result}")
            return result
            
        except Exception as e:
            logger.error(f"Entity sync failed: {e}")
            raise
    
    def _normalize_odoo_record(
        self,
        record: Dict[str, Any],
        entity_type: EntityType
    ) -> Dict[str, Any]:
        """
        Normalize Odoo record to canonical schema.
        Field names now match Odoo naming conventions more closely.
        """
        if entity_type == EntityType.ACCOUNT:
            return {
                "name": record.get("name", ""),
                "email": record.get("email") or "",
                "phone": record.get("phone") or "",
                "website": record.get("website") or "",
                "street": record.get("street") or "",
                "city": record.get("city") or "",
                "zip": record.get("zip") or "",
                "state_name": self._extract_name(record.get("state_id")),
                "country_name": self._extract_name(record.get("country_id")),
                "salesperson_id": self._extract_id(record.get("user_id")),
                "salesperson_name": self._extract_name(record.get("user_id")),
                "create_date": record.get("create_date"),
                "write_date": record.get("write_date"),
            }
        
        elif entity_type == EntityType.CONTACT:
            return {
                "name": record.get("name", ""),
                "email": record.get("email") or "",
                "phone": record.get("phone") or "",
                "company_id": self._extract_id(record.get("parent_id")),
                "company_name": self._extract_name(record.get("parent_id")),
                "function": record.get("function") or "",
                "create_date": record.get("create_date"),
                "write_date": record.get("write_date"),
            }
        
        elif entity_type == EntityType.OPPORTUNITY:
            return {
                "name": record.get("name", ""),
                "partner_id": self._extract_id(record.get("partner_id")),
                "partner_name": self._extract_name(record.get("partner_id")),
                "expected_revenue": record.get("expected_revenue") or 0,
                "probability": record.get("probability") or 0,
                "stage_name": self._extract_name(record.get("stage_id")),
                "date_deadline": record.get("date_deadline"),
                "description": record.get("description") or "",
                "salesperson_id": self._extract_id(record.get("user_id")),
                "salesperson_name": self._extract_name(record.get("user_id")),
                "create_date": record.get("create_date"),
                "write_date": record.get("write_date"),
            }
        
        elif entity_type == EntityType.ORDER:
            return {
                "name": record.get("name", ""),
                "partner_id": self._extract_id(record.get("partner_id")),
                "partner_name": self._extract_name(record.get("partner_id")),
                "amount_total": record.get("amount_total") or 0,
                "amount_untaxed": record.get("amount_untaxed") or 0,
                "amount_tax": record.get("amount_tax") or 0,
                "state": record.get("state") or "",
                "date_order": record.get("date_order"),
                "salesperson_id": self._extract_id(record.get("user_id")),
                "salesperson_name": self._extract_name(record.get("user_id")),
                "create_date": record.get("create_date"),
                "write_date": record.get("write_date"),
            }
        
        elif entity_type == EntityType.INVOICE:
            return {
                "name": record.get("name", ""),
                "partner_id": self._extract_id(record.get("partner_id")),
                "partner_name": self._extract_name(record.get("partner_id")),
                "amount_total": record.get("amount_total") or 0,
                "amount_residual": record.get("amount_residual") or 0,
                "state": record.get("state") or "",
                "payment_state": record.get("payment_state") or "",
                "invoice_date": record.get("invoice_date"),
                "invoice_date_due": record.get("invoice_date_due"),
                "salesperson_id": self._extract_id(record.get("user_id")),
                "salesperson_name": self._extract_name(record.get("user_id")),
                "create_date": record.get("create_date"),
                "write_date": record.get("write_date"),
            }
        
        return record
    
    def _apply_custom_mappings(
        self,
        record: Dict[str, Any],
        mappings: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Apply custom field mappings to transform a source record to canonical schema.
        
        Each mapping has:
        - source_field: The field name in the source record (Odoo)
        - target_field: The field name in the canonical schema
        - transform: Optional transformation function name
        """
        result = {}
        
        for mapping in mappings:
            source_field = mapping.get("source_field")
            target_field = mapping.get("target_field")
            transform = mapping.get("transform")
            
            if not source_field or not target_field:
                continue
            
            # Get the source value
            source_value = record.get(source_field)
            
            # Apply transformation if specified
            if transform == "extract_id":
                source_value = self._extract_id(source_value)
            elif transform == "extract_name":
                source_value = self._extract_name(source_value)
            elif transform == "to_string":
                source_value = str(source_value) if source_value is not None else ""
            elif transform == "to_float":
                try:
                    source_value = float(source_value) if source_value else 0.0
                except (ValueError, TypeError):
                    source_value = 0.0
            elif transform == "to_int":
                try:
                    source_value = int(source_value) if source_value else 0
                except (ValueError, TypeError):
                    source_value = 0
            elif transform == "boolean":
                source_value = bool(source_value)
            
            # Handle None/empty values
            if source_value is None:
                source_value = ""
            
            result[target_field] = source_value
        
        # Always include tracking dates if available
        if "create_date" in record:
            result["created_date"] = record["create_date"]
        if "write_date" in record:
            result["modified_date"] = record["write_date"]
        
        return result
    
    def _extract_id(self, field) -> Optional[str]:
        """Extract ID from Odoo many2one field"""
        if isinstance(field, (list, tuple)) and len(field) >= 1:
            return str(field[0])
        return None
    
    def _extract_name(self, field) -> str:
        """Extract name from Odoo many2one field"""
        if isinstance(field, (list, tuple)) and len(field) >= 2:
            return str(field[1])
        return ""


async def run_sync_job(job_id: str):
    """
    Background task to run a sync job
    """
    db = Database.get_db()
    
    try:
        # Get job
        job = await db.sync_jobs.find_one({"id": job_id})
        if not job:
            logger.error(f"Job not found: {job_id}")
            return
        
        # Update job status
        await db.sync_jobs.update_one(
            {"id": job_id},
            {"$set": {
                "status": SyncStatus.IN_PROGRESS.value,
                "started_at": datetime.now(timezone.utc)
            }}
        )
        
        # Get integration config
        integration_type = job["integration_type"]
        intg = await db.integrations.find_one({"integration_type": integration_type})
        
        if not intg or not intg.get("config"):
            raise Exception(f"Integration {integration_type} not configured")
        
        # Run sync
        sync_service = SyncService(db)
        
        entity_types = [EntityType(et) for et in job.get("entity_types", ["account", "opportunity"])]
        
        if integration_type == "odoo":
            results = await sync_service.run_odoo_sync(
                job_id=job_id,
                config=intg["config"],
                entity_types=entity_types
            )
        elif integration_type == "ms365":
            results = await sync_service.run_ms365_sync(
                job_id=job_id,
                config=intg["config"],
                entity_types=entity_types
            )
        else:
            raise Exception(f"Unsupported integration type: {integration_type}")
        
        # Update job as completed
        await db.sync_jobs.update_one(
            {"id": job_id},
            {"$set": {
                "status": SyncStatus.COMPLETED.value,
                "completed_at": datetime.now(timezone.utc),
                "total_records": results["total_records"],
                "processed_records": results["processed_records"],
                "failed_records": results["failed_records"],
                "summary": results
            }}
        )
        
        # Update integration status
        await db.integrations.update_one(
            {"integration_type": integration_type},
            {"$set": {
                "sync_status": "completed",
                "last_sync": datetime.now(timezone.utc)
            }}
        )
        
        logger.info(f"Sync job {job_id} completed: {results}")
        
    except Exception as e:
        logger.error(f"Sync job {job_id} failed: {e}")
        
        # Update job as failed
        await db.sync_jobs.update_one(
            {"id": job_id},
            {"$set": {
                "status": SyncStatus.FAILED.value,
                "completed_at": datetime.now(timezone.utc),
                "errors": [str(e)]
            }}
        )
        
        # Update integration status
        await db.integrations.update_one(
            {"integration_type": job.get("integration_type")},
            {"$set": {
                "sync_status": "failed",
                "error_message": str(e)
            }}
        )
