"""
CQRS Sync API - Manual Trigger Endpoint
Allows manual triggering of CQRS event-driven sync
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import Dict, Any
from datetime import datetime, timezone
import uuid
import logging

from core.database import Database
from middleware.rbac import require_approved  # Changed from require_permission
from models.base import UserRole

router = APIRouter(tags=["CQRS Sync"])
logger = logging.getLogger(__name__)


@router.post("/sync/trigger")
async def trigger_cqrs_sync(
    background_tasks: BackgroundTasks,
    token_data: dict = Depends(require_approved())  # Allow all approved users, not just specific permission
):
    """
    Manually trigger CQRS sync from Odoo.
    Available to all approved users (will be restricted to admins in production).
    
    Process:
    1. Fetch data from Odoo
    2. Store in odoo_raw_data
    3. Generate domain events
    4. Publish events to event bus
    5. Projections update materialized views
    
    Returns:
        Sync job ID for status tracking
    """
    db = Database.get_db()
    sync_job_id = str(uuid.uuid4())
    
    # Check if sync already running
    active_sync = await db.cqrs_sync_jobs.find_one({"status": "running"})
    if active_sync:
        raise HTTPException(
            status_code=409,
            detail="Sync already in progress. Please wait for completion."
        )
    
    # Create sync job record
    await db.cqrs_sync_jobs.insert_one({
        "id": sync_job_id,
        "status": "running",
        "started_at": datetime.now(timezone.utc),
        "triggered_by": token_data["id"],
        "trigger_source": "manual"
    })
    
    # Run sync in background
    background_tasks.add_task(run_cqrs_sync, sync_job_id)
    
    return {
        "sync_job_id": sync_job_id,
        "status": "started",
        "message": "CQRS sync initiated. Projections will update automatically.",
        "check_status_url": f"/api/integrations/cqrs/sync/{sync_job_id}"
    }


@router.get("/sync/{job_id}")
async def get_cqrs_sync_status(
    job_id: str,
    token_data: dict = Depends(require_permission("manage_integrations"))
):
    """Get status of a CQRS sync job"""
    db = Database.get_db()
    
    job = await db.cqrs_sync_jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Sync job not found")
    
    return job


async def run_cqrs_sync(sync_job_id: str):
    """
    Execute CQRS sync in background.
    Uses OdooSyncHandler to generate events.
    """
    db = Database.get_db()
    
    try:
        # Get Odoo config
        intg = await db.integrations.find_one({"integration_type": "odoo"})
        if not intg or not intg.get("enabled"):
            raise RuntimeError("Odoo integration not enabled")
        
        odoo_config = intg.get("config", {})
        
        # Run CQRS sync handler
        from domain.sync_handler import OdooSyncHandler
        
        sync_handler = OdooSyncHandler(db)
        stats = await sync_handler.handle_sync_command(sync_job_id, odoo_config)
        
        # Update job status
        await db.cqrs_sync_jobs.update_one(
            {"id": sync_job_id},
            {
                "$set": {
                    "status": "completed",
                    "completed_at": datetime.now(timezone.utc),
                    "stats": stats
                }
            }
        )
        
        logger.info(f"CQRS sync {sync_job_id} completed: {stats}")
        
    except Exception as e:
        logger.error(f"CQRS sync {sync_job_id} failed: {e}")
        
        # Update job with error
        await db.cqrs_sync_jobs.update_one(
            {"id": sync_job_id},
            {
                "$set": {
                    "status": "failed",
                    "completed_at": datetime.now(timezone.utc),
                    "error_message": str(e)
                }
            }
        )


@router.get("/health")
async def get_cqrs_health(
    token_data: dict = Depends(require_approved())  # All approved users
):
    """
    Get CQRS system health.
    Check projection status and data freshness.
    """
    db = Database.get_db()
    
    # Check event store
    event_count = await db.events.count_documents({})
    
    # Check projections
    user_profiles_count = await db.user_profiles.count_documents({})
    opportunity_view_count = await db.opportunity_view.count_documents({})
    access_matrix_count = await db.user_access_matrix.count_documents({})
    
    # Check last sync
    last_sync = await db.cqrs_sync_jobs.find_one(
        {"status": "completed"},
        sort=[("completed_at", -1)]
    )
    
    return {
        "status": "healthy",
        "event_store": {
            "total_events": event_count,
            "status": "operational"
        },
        "projections": {
            "user_profiles": user_profiles_count,
            "opportunity_view": opportunity_view_count,
            "access_matrix": access_matrix_count
        },
        "last_sync": {
            "job_id": last_sync.get("id") if last_sync else None,
            "completed_at": last_sync.get("completed_at") if last_sync else None,
            "stats": last_sync.get("stats") if last_sync else None
        }
    }
