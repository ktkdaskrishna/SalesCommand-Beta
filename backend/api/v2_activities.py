"""
Activities API v2 - CQRS Read Model
Serves activity data from activity_view projection
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import logging

from core.database import Database
from services.auth.jwt_handler import get_current_user_from_token
from models.base import UserRole

router = APIRouter(tags=["Activities v2"])
logger = logging.getLogger(__name__)


@router.get("/")
async def get_activities(
    user_id: Optional[str] = None,
    limit: int = 100,
    include_system: bool = False,  # NEW: Filter system events by default
    token_data: dict = Depends(get_current_user_from_token)
):
    """
    Get activities from CQRS activity_view.
    
    By default, filters OUT system events (user_login, data_synced, etc.)
    to show only business activities from Odoo.
    
    Args:
        user_id: Filter by specific user
        limit: Max number of activities
        include_system: If True, includes system events (default: False)
    """
    db = Database.get_db()
    current_user_id = token_data["id"]
    is_super_admin = token_data.get("role") == UserRole.SUPER_ADMIN
    
    # Define system event types to exclude
    system_event_types = [
        "user_login", "data_synced", "system", 
        "user_created", "user_updated", "sync_completed"
    ]
    
    try:
        # Build query based on access control
        query = {"is_active": True}
        
        # Filter out system events by default
        if not include_system:
            query["activity_type"] = {"$nin": system_event_types}
        
        if not is_super_admin:
            # Get user's access matrix to check what they can see
            access_matrix = await db.user_access_matrix.find_one(
                {"user_id": current_user_id},
                {"_id": 0, "accessible_user_ids": 1}
            )
            
            if access_matrix:
                accessible_ids = access_matrix.get("accessible_user_ids", [])
                accessible_ids.append(current_user_id)  # Add self
                
                # Filter activities to accessible users
                query["owner_user_id"] = {"$in": accessible_ids}
            else:
                # No access matrix - only show own activities
                query["owner_user_id"] = current_user_id
        
        # If user_id filter provided, apply it
        if user_id:
            query["owner_user_id"] = user_id
        
        # Fetch activities from activity_view
        activities = await db.activity_view.find(
            query,
            {"_id": 0}
        ).sort("due_date", 1).limit(limit).to_list(limit)
        
        logger.info(f"Fetched {len(activities)} activities for user {current_user_id}")
        
        return {
            "activities": activities,
            "total": len(activities)
        }
        
    except Exception as e:
        logger.error(f"Error fetching activities: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard-summary")
async def get_activity_dashboard_summary(
    include_system: bool = False,  # NEW: Filter system events by default
    token_data: dict = Depends(get_current_user_from_token)
):
    """
    Get activity summary for dashboard.
    
    By default, excludes system events to show only business activities.
    
    Returns counts by status for the current user's accessible activities.
    """
    db = Database.get_db()
    current_user_id = token_data["id"]
    is_super_admin = token_data.get("role") == UserRole.SUPER_ADMIN
    
    # Define system event types
    system_event_types = [
        "user_login", "data_synced", "system",
        "user_created", "user_updated", "sync_completed"
    ]
    
    try:
        # Build base query
        query = {"is_active": True}
        
        # Filter out system events by default
        if not include_system:
            query["activity_type"] = {"$nin": system_event_types}
        
        if not is_super_admin:
            # Get accessible user IDs
            access_matrix = await db.user_access_matrix.find_one(
                {"user_id": current_user_id},
                {"_id": 0, "accessible_user_ids": 1}
            )
            
            if access_matrix:
                accessible_ids = access_matrix.get("accessible_user_ids", [])
                accessible_ids.append(current_user_id)
                query["owner_user_id"] = {"$in": accessible_ids}
            else:
                query["owner_user_id"] = current_user_id
        
        # Get all activities
        activities = await db.activity_view.find(query, {"_id": 0}).to_list(1000)
        
        # Calculate summary
        now = datetime.now(timezone.utc)
        
        summary = {
            "total": len(activities),
            "overdue": 0,
            "due_today": 0,
            "upcoming": 0,
            "completed": 0,
            "by_type": {},
            "by_status": {}
        }
        
        for activity in activities:
            # Count by status
            status = activity.get("status", "planned")
            summary["by_status"][status] = summary["by_status"].get(status, 0) + 1
            
            if status == "done":
                summary["completed"] += 1
            
            # Count by type
            activity_type = activity.get("activity_type", "other")
            summary["by_type"][activity_type] = summary["by_type"].get(activity_type, 0) + 1
            
            # Count by due date
            due_date_str = activity.get("due_date")
            if due_date_str and status != "done":
                try:
                    due_date = datetime.fromisoformat(due_date_str.replace('Z', '+00:00'))
                    
                    if due_date < now:
                        summary["overdue"] += 1
                    elif due_date.date() == now.date():
                        summary["due_today"] += 1
                    else:
                        summary["upcoming"] += 1
                except Exception as e:
                    logger.warning(f"Invalid due_date format: {due_date_str}")
        
        return summary
        
    except Exception as e:
        logger.error(f"Error fetching activity summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{activity_id}")
async def get_activity_detail(
    activity_id: str,
    token_data: dict = Depends(get_current_user_from_token)
):
    """
    Get detailed information about a specific activity.
    
    Args:
        activity_id: Odoo activity ID
    """
    db = Database.get_db()
    
    try:
        # Parse activity_id as int (Odoo IDs are integers)
        try:
            odoo_activity_id = int(activity_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid activity ID format")
        
        # Fetch activity
        activity = await db.activity_view.find_one(
            {"odoo_id": odoo_activity_id},
            {"_id": 0}
        )
        
        if not activity:
            raise HTTPException(status_code=404, detail="Activity not found")
        
        # Check access control
        current_user_id = token_data["id"]
        is_super_admin = token_data.get("role") == UserRole.SUPER_ADMIN
        
        if not is_super_admin:
            owner_user_id = activity.get("owner_user_id")
            
            if owner_user_id != current_user_id:
                # Check if user can access via access matrix
                access_matrix = await db.user_access_matrix.find_one(
                    {"user_id": current_user_id},
                    {"_id": 0, "accessible_user_ids": 1}
                )
                
                accessible_ids = access_matrix.get("accessible_user_ids", []) if access_matrix else []
                
                if owner_user_id not in accessible_ids:
                    raise HTTPException(status_code=403, detail="Access denied")
        
        return activity
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching activity {activity_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
