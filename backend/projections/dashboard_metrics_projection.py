"""
Dashboard Metrics Projection
Pre-computes KPIs for fast dashboard loading
"""
from typing import List
from datetime import datetime, timezone
import logging

from projections.base import BaseProjection
from event_store.models import Event, EventType

logger = logging.getLogger(__name__)


class DashboardMetricsProjection(BaseProjection):
    """
    Builds dashboard_metrics collection - pre-computed KPIs.
    
    Updates when:
    - Opportunities change (value, stage)
    - User hierarchy changes
    - Activities created/completed
    
    TTL: 5 minutes (auto-refresh)
    """
    
    def __init__(self, db):
        super().__init__(db, "DashboardMetricsProjection")
        self.collection = db.dashboard_metrics
        self.opportunity_view = db.opportunity_view
        self.user_profiles = db.user_profiles
        self.user_access_matrix = db.user_access_matrix
    
    def subscribes_to(self) -> List[str]:
        return [
            EventType.ODOO_OPPORTUNITY_SYNCED.value,
            EventType.OPPORTUNITY_STAGE_CHANGED.value,
            EventType.ODOO_USER_SYNCED.value
        ]
    
    async def handle(self, event: Event):
        """Rebuild metrics when data changes"""
        if event.event_type in [EventType.ODOO_OPPORTUNITY_SYNCED, EventType.OPPORTUNITY_STAGE_CHANGED]:
            # Opportunity changed - rebuild for affected users
            await self._handle_opportunity_changed(event)
        elif event.event_type == EventType.ODOO_USER_SYNCED:
            # User changed - rebuild their metrics
            payload = event.payload
            email = payload.get("email")
            if email:
                user = await self.user_profiles.find_one({"email": email.lower()})
                if user:
                    await self.rebuild_for_user(user["id"])
        
        await self.mark_processed(event.id)
    
    async def _handle_opportunity_changed(self, event: Event):
        """Rebuild metrics when opportunity changes"""
        payload = event.payload
        sp_id = payload.get("salesperson_id")
        
        if sp_id:
            # Find user and rebuild
            user = await self.user_profiles.find_one({"odoo.user_id": sp_id})
            if user:
                await self.rebuild_for_user(user["id"])
                
                # Also rebuild manager's metrics
                manager = user.get("hierarchy", {}).get("manager")
                if manager:
                    await self.rebuild_for_user(manager["user_id"])
    
    async def rebuild_for_user(self, user_id: str):
        """
        Compute all metrics for a user.
        
        Args:
            user_id: User UUID
        """
        # Get access matrix
        access = await self.user_access_matrix.find_one({"user_id": user_id})
        if not access:
            logger.warning(f"No access matrix for user {user_id}")
            return
        
        accessible_opp_ids = access.get("accessible_opportunities", [])
        
        # Get opportunities
        opps = await self.opportunity_view.find({
            "odoo_id": {"$in": accessible_opp_ids},
            "is_active": True
        }).to_list(10000)
        
        # Calculate metrics
        active_opps = [o for o in opps if o["stage"] not in ["Won", "Lost", "Closed Won", "Closed Lost"]]
        won_opps = [o for o in opps if o["stage"] in ["Won", "Closed Won"]]
        
        pipeline_value = sum(o["value"] for o in active_opps)
        won_revenue = sum(o["value"] for o in won_opps)
        
        # By stage breakdown
        by_stage = {}
        for opp in active_opps:
            stage = opp["stage"]
            if stage not in by_stage:
                by_stage[stage] = {"count": 0, "value": 0}
            by_stage[stage]["count"] += 1
            by_stage[stage]["value"] += opp["value"]
        
        # Team metrics (for managers)
        team_metrics = None
        if access.get("is_manager"):
            subordinate_count = access.get("subordinate_count", 0)
            team_metrics = {
                "team_size": subordinate_count,
                "team_pipeline": pipeline_value,
                "team_won": won_revenue
            }
        
        # Store metrics
        metrics_doc = {
            "user_id": user_id,
            
            # Core metrics
            "pipeline_value": pipeline_value,
            "won_revenue": won_revenue,
            "active_opportunities": len(active_opps),
            "total_opportunities": len(opps),
            "won_count": len(won_opps),
            
            # Breakdowns
            "by_stage": by_stage,
            
            # Team metrics (if manager)
            "team_metrics": team_metrics,
            
            # Cache metadata
            "computed_at": datetime.now(timezone.utc),
            "ttl": 300,
            "data_points": len(opps)
        }
        
        await self.collection.update_one(
            {"user_id": user_id},
            {"$set": metrics_doc},
            upsert=True
        )
        
        logger.info(f"Metrics computed for user {user_id}: pipeline=${pipeline_value:,.0f}, {len(active_opps)} active opps")
