"""
Activities API v2 - CQRS Endpoint
Serves activities from activity_view with inherited authorization
"""
from fastapi import APIRouter, Depends, Query
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
    presales_category: Optional[str] = None,
    state: Optional[str] = None,
    include_system: bool = Query(default=False),
    token_data: dict = Depends(require_approved())
):
    """
    Get activities using CQRS with inherited authorization.
    
    Activities inherit visibility from opportunities.
    Managers automatically see subordinate activities.
    """
    db = Database.get_db()
    user_id = token_data["id"]
    
    # Build query
    query = {
        "visible_to_user_ids": user_id,
        "is_active": True
    }
    
    if opportunity_id:
        query["opportunity.odoo_id"] = opportunity_id
    
    if presales_category:
        query["presales_category"] = presales_category
    
    if state:
        query["state"] = state
    
    # Query CQRS activity_view
    activities = await db.activity_view.find(query, {"_id": 0}).to_list(1000)
    
    # Transform to timeline format
    timeline_activities = []
    for act in activities:
        timeline_activities.append({
            "id": act.get("id"),
            "title": act.get("summary", "Activity"),
            "description": act.get("note", ""),
            "activity_type": act.get("presales_category", "default").lower(),
            "timestamp": act.get("due_date") or act.get("last_synced"),
            "created_at": act.get("last_synced"),
            "user_id": act.get("assigned_to", {}).get("user_id"),
            "user_name": act.get("assigned_to", {}).get("name", "Unknown"),
            "opportunity_id": act.get("opportunity", {}).get("odoo_id"),
            "opportunity_name": act.get("opportunity", {}).get("name"),
            "status": act.get("state", "planned"),
            "source": "odoo"
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
    
    # Count by category
    pipeline = [
        {"$match": {"visible_to_user_ids": user_id, "is_active": True}},
        {"$group": {"_id": "$presales_category", "count": {"$sum": 1}}}
    ]
    
    by_type = {}
    async for doc in db.activity_view.aggregate(pipeline):
        by_type[doc["_id"] or "unknown"] = doc["count"]
    
    # Count today's activities
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today = await db.activity_view.count_documents({
        "visible_to_user_ids": user_id,
        "is_active": True,
        "due_date": {"$gte": today_start.isoformat()}
    })
    
    return {
        "total": total,
        "business_activities": total,
        "today_business": today,
        "by_type": by_type
    }
