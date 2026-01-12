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
        result = {"total": 0, "processed": 0, "failed": 0}
        
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
                "filter": [("is_company", "=", False)]
            },
            EntityType.OPPORTUNITY: {
                "model": "crm.lead",
                "method": connector.get_opportunities,
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
                        # Ingest to Raw Zone
                        await self.data_lake.ingest_raw(
                            source=IntegrationType.ODOO,
                            source_id=str(record.get("id")),
                            entity_type=entity_type,
                            raw_data=record,
                            sync_batch_id=job_id
                        )
                        
                        # Transform and load to Canonical Zone
                        normalized = self._normalize_odoo_record(record, entity_type)
                        await self.data_lake.normalize_to_canonical(
                            raw_record={
                                "source": IntegrationType.ODOO.value,
                                "source_id": str(record.get("id")),
                                "entity_type": entity_type.value
                            },
                            normalized_data=normalized,
                            validation_result={"status": "valid", "errors": [], "quality_score": 1.0}
                        )
                        
                        # Aggregate to Serving Zone
                        await self.data_lake.aggregate_to_serving(
                            entity_type=entity_type,
                            serving_data={**normalized, "id": str(record.get("id"))},
                            canonical_refs=[str(record.get("id"))],
                            aggregation_type="single"
                        )
                        
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
        Normalize Odoo record to canonical schema
        """
        if entity_type == EntityType.ACCOUNT:
            return {
                "name": record.get("name", ""),
                "email": record.get("email") or "",
                "phone": record.get("phone") or record.get("mobile") or "",
                "website": record.get("website") or "",
                "industry": self._extract_name(record.get("industry_id")),
                "address_street": record.get("street") or "",
                "address_city": record.get("city") or "",
                "address_state": self._extract_name(record.get("state_id")),
                "address_country": self._extract_name(record.get("country_id")),
                "address_zip": record.get("zip") or "",
                "owner_id": self._extract_id(record.get("user_id")),
                "owner_name": self._extract_name(record.get("user_id")),
                "created_date": record.get("create_date"),
                "modified_date": record.get("write_date"),
            }
        
        elif entity_type == EntityType.CONTACT:
            return {
                "name": record.get("name", ""),
                "email": record.get("email") or "",
                "phone": record.get("phone") or "",
                "mobile": record.get("mobile") or "",
                "account_id": self._extract_id(record.get("parent_id")),
                "account_name": self._extract_name(record.get("parent_id")),
                "created_date": record.get("create_date"),
                "modified_date": record.get("write_date"),
            }
        
        elif entity_type == EntityType.OPPORTUNITY:
            return {
                "name": record.get("name", ""),
                "account_id": self._extract_id(record.get("partner_id")),
                "account_name": self._extract_name(record.get("partner_id")),
                "value": record.get("expected_revenue") or 0,
                "probability": record.get("probability") or 0,
                "stage": self._extract_name(record.get("stage_id")),
                "close_date": record.get("date_deadline"),
                "description": record.get("description") or "",
                "owner_id": self._extract_id(record.get("user_id")),
                "owner_name": self._extract_name(record.get("user_id")),
                "created_date": record.get("create_date"),
                "modified_date": record.get("write_date"),
            }
        
        return record
    
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
