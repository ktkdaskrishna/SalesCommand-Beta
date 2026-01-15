"""
Activity API - Enhanced with CQRS Support
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional, List
from datetime import datetime, timezone
import logging

from core.database import Database
from middleware.rbac import require_approved

router = APIRouter(prefix="/api/v2/activities", tags=["Activities V2"])
logger = logging.getLogger(__name__)


@router.get("/")
async def get_activities_v2(
    opportunity_id: Optional[int] = None,
    presales_category: Optional[str] = None,
    state: Optional[str] = None,
    token_data: dict = Depends(require_approved())
):
    """
    Get activities using CQRS with inherited authorization.
    
    Authorization:
    - Activities inherit visibility from opportunities
    - Managers see subordinate activities automatically
    - Pre-computed visible_to_user_ids for O(1) access
    
    Query Params:
        opportunity_id: Filter by opportunity (Odoo ID)
        presales_category: Filter by category (POC, Demo, etc.)
        state: Filter by state (planned, today, overdue, done)
    """
    db = Database.get_db()
    user_id = token_data["id"]
    
    # Build query
    query = {
        "visible_to_user_ids": user_id,  # Authorization via visibility
        "is_active": True
    }
    
    if opportunity_id:
        query["opportunity.odoo_id"] = opportunity_id
    
    if presales_category:
        query["presales_category"] = presales_category
    
    if state:
        query["state"] = state
    
    # Query activity_view (CQRS)
    activities = await db.activity_view.find(query, {"_id": 0}).to_list(1000)
    
    # Group by presales category for KPI summary
    by_category = {}
    for activity in activities:
        category = activity.get("presales_category", "Other")
        if category not in by_category:
            by_category[category] = []
        by_category[category].append(activity)
    
    return {
        "activities": activities,
        "count": len(activities),
        "by_category": {k: len(v) for k, v in by_category.items()},
        "source": "cqrs_activity_view"
    }


@router.get("/opportunity/{opportunity_id}")
async def get_activities_for_opportunity(
    opportunity_id: int,
    token_data: dict = Depends(require_approved())
):
    """
    Get all activities for a specific opportunity.
    Verifies user has access to the opportunity first.
    """
    db = Database.get_db()
    user_id = token_data["id"]
    
    # Verify user can see this opportunity
    opportunity = await db.opportunity_view.find_one({
        "odoo_id": opportunity_id,
        "visible_to_user_ids": user_id
    })
    
    if not opportunity:
        return {
            "activities": [],
            "count": 0,
            "message": "Opportunity not accessible"
        }
    
    # Get activities (already filtered by visibility)
    activities = await db.activity_view.find({
        "opportunity.odoo_id": opportunity_id,
        "visible_to_user_ids": user_id,
        "is_active": True
    }, {"_id": 0}).to_list(1000)
    
    return {
        "opportunity": {
            "id": opportunity["id"],
            "name": opportunity["name"]
        },
        "activities": activities,
        "count": len(activities)
    }


@router.get("/presales-summary")
async def get_presales_summary(
    token_data: dict = Depends(require_approved())
):
    """
    Get presales activity summary for KPI dashboard.
    Counts activities by category for the current user.
    """
    db = Database.get_db()
    user_id = token_data["id"]
    
    # Get all accessible activities
    activities = await db.activity_view.find({
        "visible_to_user_ids": user_id,
        "is_active": True
    }).to_list(10000)
    
    # Count by category
    summary = {
        "POC": 0,
        "Demo": 0,
        "Presentation": 0,
        "RFP_Influence": 0,
        "Lead": 0,
        "Meeting": 0,
        "Call": 0,
        "Other": 0
    }
    
    for activity in activities:
        category = activity.get("presales_category", "Other")
        if category in summary:
            summary[category] += 1
        else:
            summary["Other"] += 1
    
    return {
        "summary": summary,
        "total_activities": len(activities),
        "by_state": await self._count_by_state(activities)
    }
    
    
    def _count_by_state(self, activities):
        """Count activities by state"""
        by_state = {"planned": 0, "today": 0, "overdue": 0, "done": 0}
        
        for act in activities:
            state = act.get("state", "planned")
            if state in by_state:
                by_state[state] += 1
        
        return by_state
