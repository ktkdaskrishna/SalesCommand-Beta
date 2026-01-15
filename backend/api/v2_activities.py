"""
Activities API v2 - CQRS Endpoint
Minimal, safe implementation for activity data
"""
from fastapi import APIRouter, Depends
from typing import Optional
from datetime import datetime, timezone
import logging

from core.database import Database
from middleware.rbac import require_approved

router = APIRouter(tags=["Activities V2"])
logger = logging.getLogger(__name__)


@router.get("/")
async def get_activities_v2(
    opportunity_id: Optional[int] = None,
    token_data: dict = Depends(require_approved())
):
    """
    Get activities with CQRS authorization.
    Returns activities from activity_view collection.
    """
    db = Database.get_db()
    user_id = token_data["id"]
    
    # Query activity_view with authorization
    query = {
        "visible_to_user_ids": user_id,
        "is_active": True
    }
    
    if opportunity_id:
        query["opportunity.odoo_id"] = opportunity_id
    
    # Get activities
    activities = await db.activity_view.find(query, {"_id": 0}).to_list(1000)
    
    # Transform to timeline format
    timeline_activities = []
    for act in activities:
        timeline_activities.append({
            "id": act.get("id"),
            "title": act.get("summary", "Activity"),
            "activity_type": act.get("presales_category", "default").lower(),
            "timestamp": act.get("due_date") or act.get("last_synced"),
            "created_at": act.get("last_synced"),
            "user_name": act.get("assigned_to", {}).get("name", "Unknown"),
            "opportunity_name": act.get("opportunity", {}).get("name"),
            "status": act.get("state", "planned")
        })
    
    return timeline_activities


@router.get("/stats")
async def get_activity_stats_v2(
    token_data: dict = Depends(require_approved())
):
    """Get activity statistics"""
    db = Database.get_db()
    user_id = token_data["id"]
    
    # Count accessible activities
    total = await db.activity_view.count_documents({
        "visible_to_user_ids": user_id,
        "is_active": True
    })
    
    # Count today's activities
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)
    today = await db.activity_view.count_documents({
        "visible_to_user_ids": user_id,
        "is_active": True,
        "last_synced": {"$gte": today_start.isoformat()}
    })
    
    return {
        "total": total,
        "business_activities": total,
        "today_business": today,
        "by_type": {}
    }
