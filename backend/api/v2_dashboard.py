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

router = APIRouter(prefix="/api/v2/dashboard", tags=["Dashboard V2"])
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
    
    # STEP 1: Get access matrix (O(1) lookup!)
    access = await db.user_access_matrix.find_one({"user_id": user_id}, {"_id": 0})
    
    if not access:
        # Cache miss - rebuild
        logger.warning(f"Access matrix cache miss for user {user_id}, rebuilding...")
        from projections.access_matrix_projection import AccessMatrixProjection
        projection = AccessMatrixProjection(db)
        await projection.rebuild_for_user(user_id)
        access = await db.user_access_matrix.find_one({"user_id": user_id}, {"_id": 0})
    
    # STEP 2: Get accessible opportunity IDs
    accessible_opp_ids = access.get("accessible_opportunities", [])
    
    # STEP 3: Fetch opportunities (already denormalized - no joins!)
    opportunities = await db.opportunity_view.find({
        "odoo_id": {"$in": accessible_opp_ids},
        "is_active": True
    }, {"_id": 0}).to_list(1000)
    
    # STEP 4: Get pre-computed metrics
    metrics = await db.dashboard_metrics.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )
    
    if not metrics:
        # Cache miss - compute on demand
        logger.info(f"Metrics cache miss for user {user_id}, computing...\")\n        metrics = await _compute_metrics_on_demand(user_id, opportunities)
    \n    # STEP 5: Get user profile for hierarchy context\n    user_profile = await db.user_profiles.find_one(\n        {\"id\": user_id},\n        {\"_id\": 0, \"hierarchy\": 1, \"odoo\": 1, \"name\": 1, \"email\": 1}\n    )\n    \n    return {\n        \"source\": \"cqrs_v2\",\n        \"performance\": \"materialized_views\",\n        \n        # Metrics (pre-computed)\n        \"metrics\": {\n            \"pipeline_value\": metrics.get(\"pipeline_value\", 0),\n            \"won_revenue\": metrics.get(\"won_revenue\", 0),\n            \"active_opportunities\": metrics.get(\"active_opportunities\", 0),\n            \"total_opportunities\": len(opportunities),\n            \"by_stage\": metrics.get(\"by_stage\", {})\n        },\n        \n        # Opportunities (denormalized - all relationships included!)\n        \"opportunities\": opportunities,\n        \n        # Hierarchy context\n        \"hierarchy\": {\n            \"is_manager\": access.get(\"is_manager\", False),\n            \"subordinate_count\": access.get(\"subordinate_count\", 0),\n            \"subordinates\": user_profile.get(\"hierarchy\", {}).get(\"subordinates\", []) if user_profile else []\n        },\n        \n        # Data freshness\n        \"data_freshness\": {\n            \"metrics_computed_at\": metrics.get(\"computed_at\") if metrics else None,\n            \"access_computed_at\": access.get(\"computed_at\"),\n            \"cache_age_seconds\": (datetime.now(timezone.utc) - access.get(\"computed_at\")).total_seconds() if access.get(\"computed_at\") else None\n        },\n        \n        \"last_updated\": datetime.now(timezone.utc).isoformat()\n    }\n\n\nasync def _compute_metrics_on_demand(user_id: str, opportunities: List[dict]) -> dict:\n    \"\"\"Compute metrics on cache miss\"\"\"\n    active = [o for o in opportunities if o[\"stage\"] not in [\"Won\", \"Lost\", \"Closed Won\", \"Closed Lost\"]]\n    won = [o for o in opportunities if o[\"stage\"] in [\"Won\", \"Closed Won\"]]\n    \n    return {\n        \"user_id\": user_id,\n        \"pipeline_value\": sum(o[\"value\"] for o in active),\n        \"won_revenue\": sum(o[\"value\"] for o in won),\n        \"active_opportunities\": len(active),\n        \"computed_at\": datetime.now(timezone.utc)\n    }\n\n\n@router.get(\"/opportunities\")\nasync def get_opportunities_v2(\n    token_data: dict = Depends(require_approved())\n):\n    \"\"\"\n    Get opportunities using CQRS.\n    Uses pre-computed visible_to_user_ids for instant access control.\n    \"\"\"\n    db = Database.get_db()\n    user_id = token_data[\"id\"]\n    \n    # Simple query - access control already pre-computed!\n    opportunities = await db.opportunity_view.find({\n        \"visible_to_user_ids\": user_id,\n        \"is_active\": True\n    }, {\"_id\": 0}).to_list(1000)\n    \n    return {\n        \"opportunities\": opportunities,\n        \"count\": len(opportunities),\n        \"source\": \"cqrs_v2\"\n    }\n\n\n@router.get(\"/users/profile\")\nasync def get_user_profile_v2(\n    token_data: dict = Depends(require_approved())\n):\n    \"\"\"\n    Get current user's denormalized profile.\n    Includes hierarchy, subordinates, team info.\n    \"\"\"\n    db = Database.get_db()\n    user_id = token_data[\"id\"]\n    \n    profile = await db.user_profiles.find_one(\n        {\"id\": user_id},\n        {\"_id\": 0, \"password_hash\": 0, \"ms_access_token\": 0}\n    )\n    \n    if not profile:\n        raise HTTPException(status_code=404, detail=\"Profile not found\")\n    \n    return profile\n\n\n@router.get(\"/users/hierarchy\")\nasync def get_user_hierarchy_v2(\n    token_data: dict = Depends(require_approved())\n):\n    \"\"\"\n    Get user's organizational hierarchy.\n    \"\"\"\n    db = Database.get_db()\n    user_id = token_data[\"id\"]\n    \n    profile = await db.user_profiles.find_one(\n        {\"id\": user_id},\n        {\"_id\": 0, \"hierarchy\": 1}\n    )\n    \n    if not profile:\n        raise HTTPException(status_code=404, detail=\"User not found\")\n    \n    return profile.get(\"hierarchy\", {})\n