"""
Background Sync Worker
Handles scheduled and queued sync jobs.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
import json

from core.enums import IntegrationSource, EntityType, SyncMode, SyncStatus
from core.config import get_settings


logger = logging.getLogger(__name__)


class SyncWorker:
    """
    Background worker for processing sync jobs.
    
    Supports:
    - Manual sync triggers
    - Scheduled syncs
    - Incremental syncs
    - Job queue processing
    """
    
    def __init__(self, db, redis_client=None):
        self.db = db
        self.redis = redis_client
        self.settings = get_settings()
        self._running = False
        self._pipelines = {}
    
    def register_pipeline(self, source: IntegrationSource, pipeline):
        """Register a sync pipeline for a source"""
        self._pipelines[source.value] = pipeline
    
    async def start(self):
        """Start the worker"""
        self._running = True
        logger.info("Sync worker started")
        
        # Start job processing loop
        await asyncio.gather(
            self._process_job_queue(),
            self._run_scheduled_syncs()
        )
    
    async def stop(self):
        """Stop the worker gracefully"""
        self._running = False
        logger.info("Sync worker stopped")
    
    async def enqueue_sync(
        self,
        source: IntegrationSource,
        entity_type: EntityType,
        mode: SyncMode = SyncMode.FULL,
        priority: int = 5,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Add a sync job to the queue.
        
        Args:
            source: Source system
            entity_type: Entity type to sync
            mode: Sync mode
            priority: Job priority (1=highest, 10=lowest)
            metadata: Additional job metadata
            
        Returns:
            Job ID
        """
        import uuid
        
        job_id = str(uuid.uuid4())
        job = {
            "id": job_id,
            "source": source.value,
            "entity_type": entity_type.value,
            "mode": mode.value,
            "priority": priority,
            "status": "pending",
            "created_at": datetime.now(timezone.utc),
            "metadata": metadata or {}
        }
        
        # Store in MongoDB (or Redis if available)
        await self.db["sync_jobs"].insert_one(job)
        
        logger.info(f"Enqueued sync job: {job_id} ({source.value}/{entity_type.value})")
        return job_id
    
    async def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a sync job"""
        return await self.db["sync_jobs"].find_one(
            {"id": job_id},
            {"_id": 0}
        )
    
    async def cancel_job(self, job_id: str) -> bool:
        """Cancel a pending sync job"""
        result = await self.db["sync_jobs"].update_one(
            {"id": job_id, "status": "pending"},
            {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc)}}
        )
        return result.modified_count > 0
    
    async def _process_job_queue(self):
        """Main job processing loop"""
        while self._running:
            try:
                # Get next pending job (oldest, highest priority)
                job = await self.db["sync_jobs"].find_one_and_update(
                    {"status": "pending"},
                    {"$set": {"status": "running", "started_at": datetime.now(timezone.utc)}},
                    sort=[("priority", 1), ("created_at", 1)],
                    return_document=True
                )
                
                if job:
                    await self._execute_job(job)
                else:
                    # No jobs, wait before checking again
                    await asyncio.sleep(5)
                    
            except Exception as e:
                logger.error(f"Error in job processing: {e}")
                await asyncio.sleep(5)
    
    async def _execute_job(self, job: Dict[str, Any]):
        """Execute a single sync job"""
        job_id = job["id"]
        source = job["source"]
        entity_type = job["entity_type"]
        mode = job["mode"]
        
        logger.info(f"Executing job {job_id}: {source}/{entity_type} ({mode})")
        
        try:
            # Get pipeline for source
            pipeline = self._pipelines.get(source)
            if not pipeline:
                raise ValueError(f"No pipeline registered for source: {source}")
            
            # Determine 'since' for incremental
            since = None
            if mode == SyncMode.INCREMENTAL.value:
                last_sync = await self._get_last_successful_sync(source, entity_type)
                if last_sync:
                    since = last_sync
            
            # Execute pipeline
            batch = await pipeline.execute(
                entity_type=entity_type,
                mode=mode,
                since=since
            )
            
            # Update job status
            await self.db["sync_jobs"].update_one(
                {"id": job_id},
                {
                    "$set": {
                        "status": "completed" if batch.status == SyncStatus.COMPLETED.value else "failed",
                        "completed_at": datetime.now(timezone.utc),
                        "result": {
                            "batch_id": batch.id,
                            "processed": batch.records_processed,
                            "created": batch.records_created,
                            "updated": batch.records_updated,
                            "failed": batch.records_failed
                        }
                    }
                }
            )
            
            logger.info(f"Job {job_id} completed: {batch.status}")
            
        except Exception as e:
            logger.error(f"Job {job_id} failed: {e}")
            
            await self.db["sync_jobs"].update_one(
                {"id": job_id},
                {
                    "$set": {
                        "status": "failed",
                        "completed_at": datetime.now(timezone.utc),
                        "error": str(e)
                    }
                }
            )
    
    async def _run_scheduled_syncs(self):
        """Handle scheduled sync jobs"""
        while self._running:
            try:
                # Get scheduled sync configurations
                schedules = await self.db["sync_schedules"].find(
                    {"enabled": True}
                ).to_list(length=None)
                
                now = datetime.now(timezone.utc)
                
                for schedule in schedules:
                    # Check if due
                    next_run = schedule.get("next_run")
                    if next_run and now >= next_run:
                        # Enqueue the sync
                        await self.enqueue_sync(
                            source=IntegrationSource(schedule["source"]),
                            entity_type=EntityType(schedule["entity_type"]),
                            mode=SyncMode(schedule.get("mode", "incremental")),
                            priority=3,
                            metadata={"scheduled": True, "schedule_id": schedule.get("id")}
                        )
                        
                        # Update next run time
                        interval = schedule.get("interval_minutes", 60)
                        next_run = now + timedelta(minutes=interval)
                        
                        await self.db["sync_schedules"].update_one(
                            {"id": schedule["id"]},
                            {"$set": {"next_run": next_run, "last_run": now}}
                        )
                
                # Check every minute
                await asyncio.sleep(60)
                
            except Exception as e:
                logger.error(f"Error in scheduled sync check: {e}")
                await asyncio.sleep(60)
    
    async def _get_last_successful_sync(
        self,
        source: str,
        entity_type: str
    ) -> Optional[datetime]:
        """Get timestamp of last successful sync for incremental mode"""
        job = await self.db["sync_jobs"].find_one(
            {
                "source": source,
                "entity_type": entity_type,
                "status": "completed"
            },
            sort=[("completed_at", -1)]
        )
        
        return job.get("completed_at") if job else None


# Entry point for running as standalone worker
async def main():
    """Main entry point for background worker"""
    import os
    from motor.motor_asyncio import AsyncIOMotorClient
    
    # Connect to MongoDB
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "salesintel")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Create and start worker
    worker = SyncWorker(db)
    
    # Register pipelines (would be done by integration modules)
    # worker.register_pipeline(IntegrationSource.ODOO, odoo_pipeline)
    
    try:
        await worker.start()
    except KeyboardInterrupt:
        await worker.stop()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
