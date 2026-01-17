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
    
    # CRITICAL: Convert odoo_id to string and extract owner/account info from CQRS projections
    for opp in opportunities:
        # Convert odoo_id to string
        if "odoo_id" in opp and isinstance(opp["odoo_id"], (int, float)):
            opp["odoo_id"] = str(int(opp["odoo_id"]))
        
        # Extract owner info from salesperson object (CQRS format)
        salesperson = opp.get("salesperson") or {}
        if isinstance(salesperson, dict):
            opp["owner_id"] = salesperson.get("odoo_user_id") or salesperson.get("user_id")
            opp["owner_name"] = salesperson.get("name", "Unassigned")
            opp["owner_email"] = salesperson.get("email", "")
            opp["owner_assigned"] = salesperson.get("odoo_user_id") is not None
        else:
            opp["owner_name"] = "Unassigned"
            opp["owner_assigned"] = False
        
        # Extract account info from account object (CQRS format)
        account = opp.get("account") or {}
        if isinstance(account, dict) and account.get("odoo_id"):
            opp["account_id"] = account.get("odoo_id")
            opp["account_name"] = account.get("name", "")
            opp["account_linked"] = True
        else:
            # Fallback: Some opportunities might not have account object
            opp["account_id"] = None
            opp["account_name"] = ""
            opp["account_linked"] = False
    
    # ENHANCED: Aggregate activity counts for each opportunity
    logger.info(f"Aggregating activities for {len(opportunities)} opportunities...")
    
    for opp in opportunities:
        try:
            odoo_id = opp.get("odoo_id")
            
            # Try to convert to int for matching with Odoo activity res_id
            try:
                odoo_id_int = int(odoo_id)
            except (ValueError, TypeError):
                odoo_id_int = None
            
            # Query activities - try both string and int matching
            if odoo_id_int:
                activity_query = {
                    "entity_type": "activity",
                    "$or": [{"is_active": True}, {"is_active": {"$exists": False}}],
                    "data.res_model": "crm.lead",
                    "data.res_id": odoo_id_int  # Use integer for Odoo matching
                }
            else:
                activity_query = {
                    "entity_type": "activity",
                    "$or": [{"is_active": True}, {"is_active": {"$exists": False}}],
                    "data.res_model": "crm.lead",
                    "data.res_id": odoo_id
                }
            
            activity_docs = await db.data_lake_serving.find(activity_query).to_list(100)
            
            # Count by status
            activities_data = [doc.get("data", {}) for doc in activity_docs]
            completed = len([a for a in activities_data if a.get("state") == "done"])
            pending = len([a for a in activities_data if a.get("state") not in ["done", "cancel", "cancelled"]])
            
            # Calculate overdue
            now = datetime.now(timezone.utc)
            overdue = 0
            last_activity_date = None
            
            for a in activities_data:
                due_date_str = a.get("date_deadline")
                if due_date_str and a.get("state") != "done":
                    try:
                        due_date = datetime.fromisoformat(str(due_date_str).replace('Z', '+00:00'))
                        if due_date < now:
                            overdue += 1
                        # Track last activity
                        if not last_activity_date or due_date > last_activity_date:
                            last_activity_date = due_date
                    except:
                        pass
            
            # Add to opportunity object
            opp["completed_activities"] = completed
            opp["pending_activities"] = pending
            opp["overdue_activities"] = overdue
            opp["total_activities"] = len(activities_data)
            opp["last_activity_date"] = last_activity_date.isoformat() if last_activity_date else None
            
            if len(activities_data) > 0:
                logger.debug(f"Opp {opp.get('name')}: {len(activities_data)} activities ({completed} done, {pending} pending)")
            
        except Exception as e:
            logger.error(f"Error aggregating activities for opportunity {opp.get('odoo_id')}: {e}")
            # Set defaults on error
            opp["completed_activities"] = 0
            opp["pending_activities"] = 0
            opp["overdue_activities"] = 0
            opp["total_activities"] = 0
            opp["last_activity_date"] = None
    
    logger.info(f"Activity aggregation complete")
    
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
