"""
Background Sync Service
Automated synchronization of Odoo data with configurable intervals
Handles: accounts, opportunities, invoices, employees/users
Implements soft-delete for removed Odoo records
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import uuid

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from core.database import Database
from core.config import settings

logger = logging.getLogger(__name__)


class OdooReconciler:
    """
    Handles reconciliation between Odoo and our database.
    Compares records, handles inserts, updates, and soft-deletes.
    """
    
    def __init__(self, db):
        self.db = db
        
    async def reconcile_entity(
        self, 
        entity_type: str, 
        odoo_records: List[Dict], 
        id_field: str = "id"
    ) -> Dict[str, int]:
        """
        Reconcile a single entity type.
        
        Returns dict with counts: {inserted, updated, soft_deleted, errors}
        """
        stats = {"inserted": 0, "updated": 0, "soft_deleted": 0, "errors": 0}
        
        # Get IDs from Odoo
        odoo_ids = set()
        for rec in odoo_records:
            odoo_id = rec.get(id_field)
            if odoo_id:
                odoo_ids.add(str(odoo_id))
        
        # Process each Odoo record
        for rec in odoo_records:
            odoo_id = rec.get(id_field)
            if not odoo_id:
                stats["errors"] += 1
                continue
                
            try:
                # Check if exists in our DB
                existing = await self.db.data_lake_serving.find_one({
                    "entity_type": entity_type,
                    "data.id": odoo_id
                })
                
                now = datetime.now(timezone.utc)
                
                if existing:
                    # Update existing record
                    await self.db.data_lake_serving.update_one(
                        {"_id": existing["_id"]},
                        {"$set": {
                            "data": rec,
                            "is_active": True,
                            "last_aggregated": now,
                            "updated_at": now,
                        }}
                    )
                    stats["updated"] += 1
                else:
                    # Insert new record
                    await self.db.data_lake_serving.insert_one({
                        "entity_type": entity_type,
                        "serving_id": str(odoo_id),
                        "data": rec,
                        "is_active": True,
                        "source": "odoo",
                        "last_aggregated": now,
                        "created_at": now,
                        "updated_at": now,
                    })
                    stats["inserted"] += 1
                    
            except Exception as e:
                logger.error(f"Error reconciling {entity_type} {odoo_id}: {e}")
                stats["errors"] += 1
        
        # Soft-delete records no longer in Odoo
        if odoo_ids:
            result = await self.db.data_lake_serving.update_many(
                {
                    "entity_type": entity_type,
                    "data.id": {"$nin": list(odoo_ids)},
                    "is_active": True,
                    "source": "odoo"
                },
                {"$set": {
                    "is_active": False,
                    "deleted_at": datetime.now(timezone.utc),
                    "delete_reason": "removed_from_odoo"
                }}
            )
            stats["soft_deleted"] = result.modified_count
        
        return stats


class BackgroundSyncService:
    """
    Manages scheduled background sync jobs for Odoo integration.
    """
    
    _instance = None
    _scheduler: Optional[AsyncIOScheduler] = None
    _sync_interval_minutes: int = 5  # Default 5 minutes
    _is_running: bool = False
    
    @classmethod
    def get_instance(cls) -> 'BackgroundSyncService':
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    def __init__(self):
        if BackgroundSyncService._instance is not None:
            raise RuntimeError("Use get_instance() instead")
        self._scheduler = AsyncIOScheduler()
        
    async def start(self, interval_minutes: int = 5):
        """Start the background sync scheduler"""
        if self._is_running:
            logger.info("Sync service already running")
            return
            
        self._sync_interval_minutes = interval_minutes
        
        # Add the sync job
        self._scheduler.add_job(
            self._run_full_sync,
            IntervalTrigger(minutes=interval_minutes),
            id="odoo_full_sync",
            name="Odoo Full Sync",
            replace_existing=True,
            max_instances=1,  # Prevent overlapping syncs
        )
        
        self._scheduler.start()
        self._is_running = True
        logger.info(f"Background sync service started with {interval_minutes} minute interval")
        
    async def stop(self):
        """Stop the background sync scheduler"""
        if self._scheduler and self._is_running:
            self._scheduler.shutdown(wait=False)
            self._is_running = False
            logger.info("Background sync service stopped")
            
    async def trigger_sync_now(self) -> Dict[str, Any]:
        """Manually trigger a sync immediately"""
        return await self._run_full_sync()
        
    async def get_status(self) -> Dict[str, Any]:
        """Get current sync service status"""
        db = Database.get_db()
        
        # Get last sync log
        last_sync = await db.sync_logs.find_one(
            {"status": "completed"},
            sort=[("completed_at", -1)]
        )
        
        # Get last failure
        last_failure = await db.sync_logs.find_one(
            {"status": "failed"},
            sort=[("completed_at", -1)]
        )
        
        # Count recent failures (last 24 hours)
        from datetime import timedelta
        yesterday = datetime.now(timezone.utc) - timedelta(hours=24)
        recent_failures = await db.sync_logs.count_documents({
            "status": "failed",
            "completed_at": {"$gte": yesterday}
        })
        
        return {
            "is_running": self._is_running,
            "interval_minutes": self._sync_interval_minutes,
            "last_sync": {
                "timestamp": last_sync.get("completed_at") if last_sync else None,
                "stats": last_sync.get("stats") if last_sync else None,
            } if last_sync else None,
            "last_failure": {
                "timestamp": last_failure.get("completed_at") if last_failure else None,
                "error": last_failure.get("error_message") if last_failure else None,
            } if last_failure else None,
            "recent_failures_24h": recent_failures,
            "health": "healthy" if recent_failures < 3 else "degraded" if recent_failures < 6 else "critical"
        }
        
    async def _run_full_sync(self) -> Dict[str, Any]:
        """
        Run a full sync of all Odoo entities.
        Called by scheduler or manually triggered.
        """
        db = Database.get_db()
        sync_id = str(uuid.uuid4())
        started_at = datetime.now(timezone.utc)
        
        logger.info(f"Starting full Odoo sync (job {sync_id})")
        
        # Create sync log entry
        await db.sync_logs.insert_one({
            "id": sync_id,
            "started_at": started_at,
            "status": "running",
            "trigger": "scheduled",
        })
        
        try:
            # Get Odoo config
            intg = await db.integrations.find_one({"integration_type": "odoo"})
            if not intg or not intg.get("enabled"):
                raise RuntimeError("Odoo integration not enabled")
                
            config = intg.get("config", {})
            if not config.get("url"):
                raise RuntimeError("Odoo not configured")
            
            # Connect to Odoo
            from integrations.odoo.connector import OdooConnector
            connector = OdooConnector(config)
            
            stats = {
                "accounts": {"inserted": 0, "updated": 0, "soft_deleted": 0, "errors": 0},
                "opportunities": {"inserted": 0, "updated": 0, "soft_deleted": 0, "errors": 0},
                "invoices": {"inserted": 0, "updated": 0, "soft_deleted": 0, "errors": 0},
                "users": {"inserted": 0, "updated": 0, "soft_deleted": 0, "errors": 0},
            }
            
            reconciler = OdooReconciler(db)
            
            try:
                # Sync Accounts (res.partner)
                logger.info("Syncing accounts...")
                accounts = await connector.fetch_accounts()
                stats["accounts"] = await reconciler.reconcile_entity("account", accounts)
                logger.info(f"Accounts: {stats['accounts']}")
                
                # Sync Opportunities (crm.lead)
                logger.info("Syncing opportunities...")
                opportunities = await connector.fetch_opportunities()
                stats["opportunities"] = await reconciler.reconcile_entity("opportunity", opportunities)
                logger.info(f"Opportunities: {stats['opportunities']}")
                
                # Sync Invoices (account.move)
                logger.info("Syncing invoices...")
                invoices = await connector.fetch_invoices()
                stats["invoices"] = await reconciler.reconcile_entity("invoice", invoices)
                logger.info(f"Invoices: {stats['invoices']}")
                
                # Sync Users/Employees (hr.employee)
                logger.info("Syncing users/employees...")
                users = await connector.fetch_users()
                stats["users"] = await reconciler.reconcile_entity("user", users)
                logger.info(f"Users: {stats['users']}")
                
            finally:
                await connector.disconnect()
            
            # Calculate totals
            total_inserted = sum(s["inserted"] for s in stats.values())
            total_updated = sum(s["updated"] for s in stats.values())
            total_soft_deleted = sum(s["soft_deleted"] for s in stats.values())
            total_errors = sum(s["errors"] for s in stats.values())
            
            completed_at = datetime.now(timezone.utc)
            duration_seconds = (completed_at - started_at).total_seconds()
            
            # Update sync log
            await db.sync_logs.update_one(
                {"id": sync_id},
                {"$set": {
                    "status": "completed",
                    "completed_at": completed_at,
                    "duration_seconds": duration_seconds,
                    "stats": stats,
                    "totals": {
                        "inserted": total_inserted,
                        "updated": total_updated,
                        "soft_deleted": total_soft_deleted,
                        "errors": total_errors,
                    }
                }}
            )
            
            # Update integration last_sync
            await db.integrations.update_one(
                {"integration_type": "odoo"},
                {"$set": {
                    "last_sync": completed_at,
                    "sync_status": "success",
                    "last_sync_stats": stats,
                }}
            )
            
            logger.info(f"Sync completed in {duration_seconds:.1f}s: +{total_inserted} ~{total_updated} -{total_soft_deleted}")
            
            return {
                "success": True,
                "sync_id": sync_id,
                "duration_seconds": duration_seconds,
                "stats": stats,
            }
            
        except Exception as e:
            logger.error(f"Sync failed: {e}")
            
            completed_at = datetime.now(timezone.utc)
            
            # Update sync log with failure
            await db.sync_logs.update_one(
                {"id": sync_id},
                {"$set": {
                    "status": "failed",
                    "completed_at": completed_at,
                    "error_message": str(e),
                }}
            )
            
            # Update integration status
            await db.integrations.update_one(
                {"integration_type": "odoo"},
                {"$set": {
                    "sync_status": "error",
                    "last_sync_error": str(e),
                    "last_sync_error_at": completed_at,
                }}
            )
            
            return {
                "success": False,
                "sync_id": sync_id,
                "error": str(e),
            }


# Global sync service instance
sync_service = BackgroundSyncService.get_instance()


async def start_background_sync(interval_minutes: int = 5):
    """Helper function to start background sync from server startup"""
    await sync_service.start(interval_minutes)


async def stop_background_sync():
    """Helper function to stop background sync on server shutdown"""
    await sync_service.stop()
