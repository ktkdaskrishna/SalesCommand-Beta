"""
Admin Logs Routes
System logs and error tracking for administrators
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import logging

from core.database import Database
from models.base import UserRole
from middleware.rbac import require_role
from services.logging.system_logger import system_logger

router = APIRouter(prefix="/admin/logs", tags=["Admin Logs"])
logger = logging.getLogger(__name__)


@router.get("/errors")
async def get_system_errors(
    limit: int = Query(default=100, le=500),
    error_type: Optional[str] = None,
    unresolved_only: bool = False,
    session_id: Optional[str] = None,
    token_data: dict = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    """
    Get system errors.
    Admin only - for debugging and monitoring.
    
    Query Params:
        limit: Max errors to return (default 100, max 500)
        error_type: Filter by error type
        unresolved_only: Only show unresolved errors
        session_id: Filter by session ID
    """
    db = Database.get_db()
    
    query = {}
    if error_type:
        query["error_type"] = error_type
    if unresolved_only:
        query["resolved"] = False
    if session_id:
        query["session_id"] = session_id
    
    errors = await db.system_errors.find(
        query,
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    # Get summary stats
    total_errors = await db.system_errors.count_documents(query)
    unresolved_count = await db.system_errors.count_documents({**query, "resolved": False})
    
    # Get error counts by type
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$error_type",
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}}
    ]
    
    by_type = {}
    async for doc in db.system_errors.aggregate(pipeline):
        by_type[doc["_id"]] = doc["count"]
    
    return {
        "errors": errors,
        "total": total_errors,
        "unresolved": unresolved_count,
        "by_type": by_type,
        "showing": len(errors)
    }


@router.get("/sessions")
async def get_sessions_with_errors(
    limit: int = Query(default=50, le=100),
    token_data: dict = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    """
    Get all sessions that have errors.
    Grouped by session for easy debugging.
    """
    sessions = await system_logger.get_sessions_with_errors(limit)
    
    # Enrich with user info
    db = Database.get_db()
    
    for session in sessions:
        if session.get("user_id"):
            user = await db.users.find_one(
                {"id": session["user_id"]},
                {"email": 1, "name": 1}
            )
            if user:
                session["user_email"] = user.get("email")
                session["user_name"] = user.get("name")
    
    return {
        "sessions": sessions,
        "total": len(sessions)
    }


@router.get("/session/{session_id}")
async def get_session_details(
    session_id: str,
    token_data: dict = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    """
    Get all logs and errors for a specific session.
    Useful for debugging a user's journey.
    """
    db = Database.get_db()
    
    # Get errors
    errors = await system_logger.get_errors_by_session(session_id)
    
    # Get events
    events = await db.system_logs.find(
        {"session_id": session_id},
        {"_id": 0}
    ).sort("timestamp", 1).to_list(1000)
    
    # Get API calls
    api_calls = await db.api_call_logs.find(
        {"session_id": session_id},
        {"_id": 0}
    ).sort("timestamp", 1).to_list(1000)
    
    return {
        "session_id": session_id,
        "errors": errors,
        "events": events,
        "api_calls": api_calls,
        "summary": {
            "total_errors": len(errors),
            "total_events": len(events),
            "total_api_calls": len(api_calls),
            "duration": calculate_session_duration(events + api_calls)
        }
    }


@router.post("/errors/{error_id}/resolve")
async def resolve_error(
    error_id: str,
    resolution_note: Optional[str] = None,
    token_data: dict = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    """
    Mark an error as resolved.
    """
    await system_logger.mark_error_resolved(
        error_id=error_id,
        resolved_by=token_data["id"],
        resolution_note=resolution_note
    )
    
    return {"message": "Error marked as resolved"}


@router.get("/api-calls")
async def get_api_call_logs(
    limit: int = Query(default=100, le=500),
    errors_only: bool = False,
    endpoint: Optional[str] = None,
    session_id: Optional[str] = None,
    token_data: dict = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    """
    Get API call logs.
    """
    db = Database.get_db()
    
    query = {}
    if errors_only:
        query["is_error"] = True
    if endpoint:
        query["endpoint"] = {"$regex": endpoint, "$options": "i"}
    if session_id:
        query["session_id"] = session_id
    
    logs = await db.api_call_logs.find(
        query,
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    # Stats
    total = await db.api_call_logs.count_documents(query)
    avg_duration = await db.api_call_logs.aggregate([
        {"$match": query},
        {"$group": {"_id": None, "avg": {"$avg": "$duration_ms"}}}
    ]).to_list(1)
    
    return {
        "logs": logs,
        "total": total,
        "average_duration_ms": avg_duration[0]["avg"] if avg_duration else 0,
        "showing": len(logs)
    }


@router.get("/stats")
async def get_log_stats(
    hours: int = Query(default=24, le=168),  # Last 24 hours by default, max 7 days
    token_data: dict = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    """
    Get logging statistics.
    Overview of system health.
    """
    db = Database.get_db()
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    
    # Error stats
    total_errors = await db.system_errors.count_documents({"timestamp": {"$gte": since}})
    unresolved_errors = await db.system_errors.count_documents({
        "timestamp": {"$gte": since},
        "resolved": False
    })
    
    # API call stats
    total_api_calls = await db.api_call_logs.count_documents({"timestamp": {"$gte": since}})
    failed_api_calls = await db.api_call_logs.count_documents({
        "timestamp": {"$gte": since},
        "is_error": True
    })
    
    # Session stats
    unique_sessions = len(await db.api_call_logs.distinct("session_id", {"timestamp": {"$gte": since}}))
    
    return {
        "period_hours": hours,
        "since": since.isoformat(),
        "errors": {
            "total": total_errors,
            "unresolved": unresolved_errors,
            "resolved": total_errors - unresolved_errors
        },
        "api_calls": {
            "total": total_api_calls,
            "failed": failed_api_calls,
            "success": total_api_calls - failed_api_calls,
            "success_rate": ((total_api_calls - failed_api_calls) / total_api_calls * 100) if total_api_calls > 0 else 100
        },
        "sessions": {
            "unique": unique_sessions
        }
    }


def calculate_session_duration(logs: List) -> Optional[float]:
    """Calculate session duration from logs"""
    if not logs:
        return None
    
    timestamps = [log.get("timestamp") for log in logs if log.get("timestamp")]
    if len(timestamps) < 2:
        return None
    
    first = min(timestamps)
    last = max(timestamps)
    
    return (last - first).total_seconds()
