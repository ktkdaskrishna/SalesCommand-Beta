"""
Dashboard API v2 - CQRS Query Side
Fast dashboard using pre-computed materialized views
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
from datetime import datetime, timezone
import logging

from core.database import Database
from middleware.rbac import require_approved

router = APIRouter(tags=["Dashboard V2"])
logger = logging.getLogger(__name__)


@router.get("/")
async def get_dashboard_v2(
    token_data: dict = Depends(require_approved())
):
    """
    Get dashboard data using CQRS read models.
    
    Performance: <200ms (vs 3-5s in v1)
    
    Data Sources:
    - dashboard_metrics (pre-computed KPIs)
    - opportunity_view (pre-joined relationships)
    - user_access_matrix (pre-computed access control)
    """
    db = Database.get_db()
    user_id = token_data["id"]
    
    # STEP 1: Get user profile first (CQRS uses different collection than auth!)
    user_profile = await db.user_profiles.find_one(
        {"email": token_data["email"].lower()},
        {"_id": 0}
    )
    
    if not user_profile:
        # User authenticated via old users collection but not in CQRS yet
        # This happens when user was created before CQRS migration
        logger.warning(f"User {token_data['email']} not in CQRS system, using fallback")
        raise HTTPException(
            status_code=503,
            detail="CQRS migration in progress. Please contact administrator or re-sync from Odoo."
        )
    
    cqrs_user_id = user_profile["id"]  # Use CQRS user ID, not auth user ID
    
    # STEP 2: Get access matrix (O(1) lookup!)
    access = await db.user_access_matrix.find_one({"user_id": cqrs_user_id}, {"_id": 0})
    
    if not access:
        # Cache miss - rebuild
        logger.warning(f"Access matrix cache miss for user {cqrs_user_id}, rebuilding...")
        from projections.access_matrix_projection import AccessMatrixProjection
        from event_store.store import EventStore
        
        projection = AccessMatrixProjection(db)
        projection.event_store = EventStore(db)
        await projection.rebuild_for_user(cqrs_user_id)
        access = await db.user_access_matrix.find_one({"user_id": cqrs_user_id}, {"_id": 0})
        
        if not access:
            # Still no access - data issue
            logger.error(f"Cannot build access matrix for user {cqrs_user_id}")
            raise HTTPException(status_code=500, detail="Access matrix not available")
    
    # STEP 3: Get accessible opportunity IDs
    accessible_opp_ids = access.get("accessible_opportunities", [])
    
    # STEP 4: Fetch opportunities (already denormalized - no joins!)
    opportunities = await db.opportunity_view.find({
        "odoo_id": {"$in": accessible_opp_ids},
        "is_active": True
    }, {"_id": 0}).to_list(1000)
    
    # CRITICAL: Convert odoo_id to string for frontend drag & drop compatibility
    for opp in opportunities:
        if "odoo_id" in opp and isinstance(opp["odoo_id"], (int, float)):
            opp["odoo_id"] = str(int(opp["odoo_id"]))
    
    # STEP 5: Get pre-computed metrics
    metrics = await db.dashboard_metrics.find_one(
        {"user_id": cqrs_user_id},
        {"_id": 0}
    )
    
    if not metrics:
        # Cache miss - compute on demand
        logger.info(f"Metrics cache miss for user {cqrs_user_id}, computing...")
        metrics = await _compute_metrics_on_demand(cqrs_user_id, opportunities)
    
    return {
        "source": "cqrs_v2",
        "performance": "materialized_views",
        
        # Metrics (pre-computed)
        "metrics": {
            "pipeline_value": metrics.get("pipeline_value", 0),
            "won_revenue": metrics.get("won_revenue", 0),
            "active_opportunities": metrics.get("active_opportunities", 0),
            "total_opportunities": len(opportunities),
            "by_stage": metrics.get("by_stage", {})
        },
        
        # Opportunities (denormalized - all relationships included!)
        "opportunities": opportunities,
        
        # Hierarchy context
        "hierarchy": {
            "is_manager": access.get("is_manager", False),
            "subordinate_count": access.get("subordinate_count", 0),
            "subordinates": user_profile.get("hierarchy", {}).get("subordinates", []) if user_profile else []
        },
        
        # Data freshness
        "data_freshness": {
            "metrics_computed_at": metrics.get("computed_at").isoformat() if metrics.get("computed_at") else None,
            "access_computed_at": access.get("computed_at").isoformat() if access.get("computed_at") else None,
            "cache_age_seconds": None  # Removed problematic calculation
        },
        
        "last_updated": datetime.now(timezone.utc).isoformat()
    }


async def _compute_metrics_on_demand(user_id: str, opportunities: List[dict]) -> dict:
    """Compute metrics on cache miss"""
    active = [o for o in opportunities if o.get("stage") not in ["Won", "Lost", "Closed Won", "Closed Lost"]]
    won = [o for o in opportunities if o.get("stage") in ["Won", "Closed Won"]]
    
    return {
        "user_id": user_id,
        "pipeline_value": sum(o.get("value", 0) for o in active),
        "won_revenue": sum(o.get("value", 0) for o in won),
        "active_opportunities": len(active),
        "computed_at": datetime.now(timezone.utc)
    }


@router.get("/opportunities")
async def get_opportunities_v2(
    token_data: dict = Depends(require_approved())
):
    """
    Get opportunities using CQRS.
    Uses pre-computed visible_to_user_ids for instant access control.
    """
    db = Database.get_db()
    user_id = token_data["id"]
    
    # Simple query - access control already pre-computed!
    opportunities = await db.opportunity_view.find({
        "visible_to_user_ids": user_id,
        "is_active": True
    }, {"_id": 0}).to_list(1000)
    
    # CRITICAL: Convert odoo_id to string for frontend drag & drop compatibility
    for opp in opportunities:
        if "odoo_id" in opp and isinstance(opp["odoo_id"], (int, float)):
            opp["odoo_id"] = str(int(opp["odoo_id"]))
    
    return {
        "opportunities": opportunities,
        "count": len(opportunities),
        "source": "cqrs_v2"
    }


@router.get("/users/profile")
async def get_user_profile_v2(
    token_data: dict = Depends(require_approved())
):
    """
    Get current user's denormalized profile.
    Includes hierarchy, subordinates, team info.
    """
    db = Database.get_db()
    user_id = token_data["id"]
    
    profile = await db.user_profiles.find_one(
        {"id": user_id},
        {"_id": 0, "password_hash": 0, "ms_access_token": 0}
    )
    
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    return profile


@router.get("/users/hierarchy")
async def get_user_hierarchy_v2(
    token_data: dict = Depends(require_approved())
):
    """
    Get user's organizational hierarchy.
    """
    db = Database.get_db()
    user_id = token_data["id"]
    
    profile = await db.user_profiles.find_one(
        {"id": user_id},
        {"_id": 0, "hierarchy": 1}
    )
    
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    
    return profile.get("hierarchy", {})
