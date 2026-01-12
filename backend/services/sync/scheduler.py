"""
Scheduled Sync Service
Polls Odoo for changes at regular intervals
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import uuid

from models.base import EntityType, IntegrationType, SyncStatus, SyncJob
from services.sync.service import SyncService, run_sync_job
from core.database import Database

logger = logging.getLogger(__name__)


class ScheduledSyncManager:
    """
    Manages scheduled/polling-based sync from Odoo.
    Runs in background and checks for changes periodically.
    """
    
    def __init__(self):
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._interval_minutes = 5  # Default: check every 5 minutes
    
    async def start(self, interval_minutes: int = 5):
        """Start the scheduled sync loop"""
        if self._running:
            logger.warning("Scheduled sync already running")
            return
        
        self._interval_minutes = interval_minutes
        self._running = True
        self._task = asyncio.create_task(self._sync_loop())
        logger.info(f"Scheduled sync started (interval: {interval_minutes} minutes)")
    
    async def stop(self):
        """Stop the scheduled sync loop"""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Scheduled sync stopped")
    
    async def _sync_loop(self):
        """Main sync loop"""
        while self._running:
            try:
                await self._run_incremental_sync()
            except Exception as e:
                logger.error(f"Scheduled sync error: {e}")
            
            # Wait for next interval
            await asyncio.sleep(self._interval_minutes * 60)
    
    async def _run_incremental_sync(self):
        """
        Run incremental sync - only fetch records modified since last sync
        """
        db = Database.get_db()
        
        # Get Odoo integration
        intg = await db.integrations.find_one({"integration_type": "odoo"})
        if not intg or not intg.get("enabled"):
            return
        
        # Get last sync time
        last_sync = intg.get("last_sync")
        if not last_sync:
            # First sync - do full sync instead
            logger.info("No previous sync, skipping incremental (use manual sync first)")
            return
        
        # Only sync if enough time has passed
        now = datetime.now(timezone.utc)
        if isinstance(last_sync, str):
            last_sync = datetime.fromisoformat(last_sync.replace('Z', '+00:00'))
        
        time_since_sync = (now - last_sync).total_seconds() / 60
        if time_since_sync < self._interval_minutes:
            return
        
        logger.info(f"Running incremental sync (changes since {last_sync})")
        
        # Create sync job
        job_id = str(uuid.uuid4())
        
        # Get enabled entities from config
        enabled_entities = intg.get("config", {}).get("enabled_entities", ["opportunity"])
        entity_types = [EntityType(et) for et in enabled_entities]
        
        job = SyncJob(
            id=job_id,
            integration_type=IntegrationType.ODOO,
            entity_types=entity_types,
            status=SyncStatus.PENDING,
            created_at=now,
            created_by="scheduled_sync"
        )
        
        await db.sync_jobs.insert_one(job.model_dump())
        
        # Run sync with modified_since filter
        await run_sync_job(job_id)


# Global instance
scheduled_sync_manager = ScheduledSyncManager()


async def start_scheduled_sync(interval_minutes: int = 5):
    """Start scheduled sync (call from app startup)"""
    await scheduled_sync_manager.start(interval_minutes)


async def stop_scheduled_sync():
    """Stop scheduled sync (call from app shutdown)"""
    await scheduled_sync_manager.stop()
