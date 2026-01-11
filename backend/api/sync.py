"""
Sync API Routes
Manages sync operations and history
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from typing import Any, Dict, List, Optional
from datetime import datetime
from pydantic import BaseModel

from core.enums import EntityType, IntegrationSource, SyncMode


router = APIRouter(prefix="/sync", tags=["Sync Engine"])


class SyncRequest(BaseModel):
    """Request model for sync operation"""
    source: IntegrationSource
    entity_types: Optional[List[EntityType]] = None  # None = all types
    mode: SyncMode = SyncMode.INCREMENTAL
    priority: int = 5


class SyncJobResponse(BaseModel):
    """Response model for sync job"""
    job_id: str
    source: str
    entity_types: List[str]
    mode: str
    status: str
    created_at: datetime


@router.get("/status")
async def get_sync_status():
    """Get overall sync status"""
    return {
        "status": "idle",
        "active_jobs": 0,
        "pending_jobs": 0,
        "last_sync": None,
        "sources": {
            "odoo": {"connected": False, "last_sync": None},
            "ms365": {"connected": False, "last_sync": None}
        }
    }


@router.post("/trigger", response_model=SyncJobResponse)
async def trigger_sync(
    request: SyncRequest,
    background_tasks: BackgroundTasks,
    # db = Depends(get_db),
    # current_user = Depends(get_current_admin)
):
    """Trigger a new sync job (admin only)"""
    import uuid
    
    job_id = str(uuid.uuid4())
    
    # In production, this would enqueue to SyncWorker
    # For now, return a mock response
    
    return SyncJobResponse(
        job_id=job_id,
        source=request.source.value,
        entity_types=[e.value for e in (request.entity_types or [])],
        mode=request.mode.value,
        status="pending",
        created_at=datetime.utcnow()
    )


@router.get("/jobs")
async def list_sync_jobs(
    source: Optional[IntegrationSource] = None,
    status: Optional[str] = None,
    limit: int = 50,
    # db = Depends(get_db),
    # current_user = Depends(get_current_admin)
):
    """List sync jobs history"""
    return {
        "items": [],
        "total": 0
    }


@router.get("/jobs/{job_id}")
async def get_sync_job(
    job_id: str,
    # db = Depends(get_db),
    # current_user = Depends(get_current_admin)
):
    """Get specific sync job details"""
    return {
        "job_id": job_id,
        "status": "not_found"
    }


@router.post("/jobs/{job_id}/cancel")
async def cancel_sync_job(
    job_id: str,
    # db = Depends(get_db),
    # current_user = Depends(get_current_admin)
):
    """Cancel a pending sync job"""
    return {
        "job_id": job_id,
        "cancelled": False,
        "message": "Job not found or already running"
    }


@router.get("/history")
async def get_sync_history(
    source: Optional[IntegrationSource] = None,
    entity_type: Optional[EntityType] = None,
    limit: int = 50,
    # db = Depends(get_db)
):
    """Get sync batch history"""
    return {
        "items": [],
        "total": 0
    }


@router.post("/replay/{batch_id}")
async def replay_sync_batch(
    batch_id: str,
    background_tasks: BackgroundTasks,
    # db = Depends(get_db),
    # current_user = Depends(get_current_admin)
):
    """Replay a previous sync batch"""
    return {
        "job_id": None,
        "batch_id": batch_id,
        "status": "queued"
    }


@router.get("/schedules")
async def list_sync_schedules(
    # db = Depends(get_db),
    # current_user = Depends(get_current_admin)
):
    """List configured sync schedules"""
    return {
        "items": []
    }


@router.post("/schedules")
async def create_sync_schedule(
    source: IntegrationSource,
    entity_types: List[EntityType],
    interval_minutes: int = 60,
    mode: SyncMode = SyncMode.INCREMENTAL,
    # db = Depends(get_db),
    # current_user = Depends(get_current_admin)
):
    """Create a new sync schedule"""
    return {
        "schedule_id": None,
        "source": source.value,
        "interval_minutes": interval_minutes,
        "enabled": True
    }
