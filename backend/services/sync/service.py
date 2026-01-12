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
from services.ms365.connector import MS365Connector
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
    
    async def run_ms365_sync(
        self,
        job_id: str,
        config: Dict[str, Any],
        entity_types: List[EntityType],
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Run Microsoft 365 sync job using Microsoft Graph API.
        Requires user's MS365 access token stored from SSO login.
        """
        results = {
            "total_records": 0,
            "processed_records": 0,
            "failed_records": 0,
            "entities": {}
        }
        
        logger.info(f"Starting MS365 sync for entities: {[e.value for e in entity_types]}")
        
        # Get user's MS365 access token
        access_token = None
        if user_id:
            user = await self.db.users.find_one({"id": user_id}, {"ms_access_token": 1})
            if user:
                access_token = user.get("ms_access_token")
        
        if not access_token:
            # Try to get from the most recently logged in MS365 user
            ms_user = await self.db.users.find_one(
                {"ms_access_token": {"$exists": True, "$ne": ""}},
                {"ms_access_token": 1},
                sort=[("last_login", -1)]
            )
            if ms_user:
                access_token = ms_user.get("ms_access_token")
        
        if not access_token:
            logger.warning("No MS365 access token available. User must login with Microsoft SSO first.")
            for entity_type in entity_types:
                results["entities"][entity_type.value] = {
                    "total": 0,
                    "processed": 0,
                    "failed": 0,
                    "error": "No MS365 access token. Please login with Microsoft SSO first."
                }
            return results
        
        try:
            async with MS365Connector(access_token) as connector:
                for entity_type in entity_types:
                    try:
                        entity_result = await self._sync_ms365_entity(
                            connector, job_id, entity_type
                        )
                        results["entities"][entity_type.value] = entity_result
                        results["total_records"] += entity_result["total"]
                        results["processed_records"] += entity_result["processed"]
                        results["failed_records"] += entity_result["failed"]
                    except Exception as e:
                        logger.error(f"Failed to sync MS365 {entity_type.value}: {e}")
                        results["entities"][entity_type.value] = {
                            "error": str(e),
                            "total": 0,
                            "processed": 0,
                            "failed": 0
                        }
        except Exception as e:
            logger.error(f"MS365 connector error: {e}")
            for entity_type in entity_types:
                if entity_type.value not in results["entities"]:
                    results["entities"][entity_type.value] = {
                        "error": str(e),
                        "total": 0,
                        "processed": 0,
                        "failed": 0
                    }
        
        return results
    
    async def _sync_ms365_entity(
        self,
        connector: MS365Connector,
        job_id: str,
        entity_type: EntityType
    ) -> Dict[str, Any]:
        """
        Sync a single entity type from MS365
        """
        result = {"total": 0, "processed": 0, "failed": 0}
        
        try:
            # Fetch data based on entity type
            if entity_type == EntityType.EMAIL:
                records = await connector.get_emails(top=100)
            elif entity_type == EntityType.CALENDAR:
                records = await connector.get_calendar_events(top=100)
            elif entity_type == EntityType.OUTLOOK_CONTACT:
                records = await connector.get_contacts(top=200)
            elif entity_type == EntityType.ONEDRIVE:
                records = await connector.get_files(top=100)
            else:
                logger.warning(f"Unsupported MS365 entity type: {entity_type}")
                return result
            
            result["total"] = len(records)
            
            # Process each record through the data lake
            for record in records:
                try:
                    # Add metadata
                    record["_sync_job_id"] = job_id
                    record["_synced_at"] = datetime.now(timezone.utc).isoformat()
                    
                    source_id = record.get("source_id", str(uuid.uuid4()))
                    
                    # Ingest to Raw zone
                    await self.data_lake.ingest_raw(
                        source=IntegrationType.MS365,
                        source_id=source_id,
                        entity_type=entity_type,
                        raw_data=record,
                        sync_batch_id=job_id
                    )
                    
                    # Normalize and move to Canonical zone
                    canonical_data = self._normalize_ms365_record(record, entity_type)
                    await self.data_lake.normalize_to_canonical(
                        raw_record={
                            "source": "ms365",
                            "source_id": source_id,
                            "entity_type": entity_type.value
                        },
                        normalized_data=canonical_data,
                        validation_result={"status": "valid", "errors": [], "quality_score": 1.0}
                    )
                    
                    result["processed"] += 1
                    
                except Exception as e:
                    logger.error(f"Failed to process MS365 record: {e}")
                    result["failed"] += 1
            
            logger.info(f"MS365 {entity_type.value} sync: {result}")
            return result
            
        except Exception as e:
            logger.error(f"Error syncing MS365 {entity_type.value}: {e}")
            result["failed"] = result["total"]
            raise
    
    def _normalize_ms365_record(self, record: Dict[str, Any], entity_type: EntityType) -> Dict[str, Any]:
        """
        Normalize MS365 record to canonical schema
        """
        now = datetime.now(timezone.utc)
        
        if entity_type == EntityType.EMAIL:
            return {
                "id": record.get("source_id"),
                "subject": record.get("subject", ""),
                "from_email": record.get("from_email", ""),
                "from_name": record.get("from_name", ""),
                "to_recipients": record.get("to_recipients", []),
                "cc_recipients": record.get("cc_recipients", []),
                "received_at": record.get("received_at"),
                "sent_at": record.get("sent_at"),
                "body_preview": record.get("body_preview", ""),
                "has_attachments": record.get("has_attachments", False),
                "importance": record.get("importance", "normal"),
                "is_read": record.get("is_read", False),
                "web_link": record.get("web_link", ""),
                "source": "ms365",
                "entity_type": "email",
                "synced_at": now.isoformat()
            }
        
        elif entity_type == EntityType.CALENDAR:
            return {
                "id": record.get("source_id"),
                "subject": record.get("subject", ""),
                "organizer_email": record.get("organizer_email", ""),
                "organizer_name": record.get("organizer_name", ""),
                "attendees": record.get("attendees", []),
                "start_time": record.get("start_time"),
                "end_time": record.get("end_time"),
                "location": record.get("location", ""),
                "body_preview": record.get("body_preview", ""),
                "is_all_day": record.get("is_all_day", False),
                "is_cancelled": record.get("is_cancelled", False),
                "web_link": record.get("web_link", ""),
                "online_meeting_url": record.get("online_meeting_url", ""),
                "source": "ms365",
                "entity_type": "calendar",
                "synced_at": now.isoformat()
            }
        
        elif entity_type == EntityType.OUTLOOK_CONTACT:
            return {
                "id": record.get("source_id"),
                "display_name": record.get("display_name", ""),
                "first_name": record.get("first_name", ""),
                "last_name": record.get("last_name", ""),
                "email": record.get("email", ""),
                "all_emails": record.get("all_emails", []),
                "business_phones": record.get("business_phones", []),
                "mobile_phone": record.get("mobile_phone", ""),
                "company": record.get("company", ""),
                "job_title": record.get("job_title", ""),
                "department": record.get("department", ""),
                "source": "ms365",
                "entity_type": "outlook_contact",
                "synced_at": now.isoformat()
            }
        
        elif entity_type == EntityType.ONEDRIVE:
            return {
                "id": record.get("source_id"),
                "name": record.get("name", ""),
                "size": record.get("size", 0),
                "created_at": record.get("created_at"),
                "modified_at": record.get("modified_at"),
                "web_url": record.get("web_url", ""),
                "is_folder": record.get("is_folder", False),
                "mime_type": record.get("mime_type", ""),
                "created_by": record.get("created_by", ""),
                "modified_by": record.get("modified_by", ""),
                "source": "ms365",
                "entity_type": "onedrive",
                "synced_at": now.isoformat()
            }
        
        # Default: return record as-is with metadata
        return {
            **record,
            "source": "ms365",
            "entity_type": entity_type.value,
            "synced_at": now.isoformat()
        }
    
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
            # Get user_id from job (created_by) to fetch their MS365 token
            user_id = job.get("created_by")
            results = await sync_service.run_ms365_sync(
                job_id=job_id,
                config=intg["config"],
                entity_types=entity_types,
                user_id=user_id
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
