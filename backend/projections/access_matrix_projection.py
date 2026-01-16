"""
Access Matrix Projection
Pre-computes what each user can access for fast authorization
"""
from typing import List
from datetime import datetime, timezone
import logging

from projections.base import BaseProjection
from event_store.models import Event, EventType

logger = logging.getLogger(__name__)


class AccessMatrixProjection(BaseProjection):
    """
    Builds user_access_matrix collection - pre-computed access control.
    
    This is a PERFORMANCE optimization:
    - Instead of filtering 1000s of opps on every request
    - Pre-compute which opp IDs each user can see
    - O(1) lookup instead of O(n) filtering
    
    Rebuilds when:
    - User hierarchy changes
    - Opportunity assignment changes
    - User role changes
    """
    
    def __init__(self, db):
        super().__init__(db, "AccessMatrixProjection")
        self.collection = db.user_access_matrix
        self.user_profiles = db.user_profiles
        self.opportunity_view = db.opportunity_view
    
    def subscribes_to(self) -> List[str]:
        return [
            EventType.ODOO_USER_SYNCED.value,
            EventType.MANAGER_ASSIGNED.value,
            EventType.ODOO_OPPORTUNITY_SYNCED.value,
            EventType.OPPORTUNITY_ASSIGNED.value
        ]
    
    async def handle(self, event: Event):
        """
        Rebuild access matrix when relationships change.
        
        Strategy: When a user or opportunity changes, rebuild the
        access matrix for affected users only (not entire system).
        """
        if event.event_type in [EventType.ODOO_USER_SYNCED, EventType.MANAGER_ASSIGNED]:
            # User changed - rebuild their matrix and their manager's
            await self._handle_user_changed(event)
        
        elif event.event_type in [EventType.ODOO_OPPORTUNITY_SYNCED, EventType.OPPORTUNITY_ASSIGNED]:
            # Opportunity changed - rebuild matrix for involved users
            await self._handle_opportunity_changed(event)
    
    async def _handle_user_changed(self, event: Event):
        """Rebuild access matrix when user hierarchy changes"""
        payload = event.payload
        email = payload.get("email")
        
        if not email:
            return
        
        # Find user
        user = await self.user_profiles.find_one({"email": email.lower()})
        if not user:
            return
        
        # Rebuild this user's matrix
        await self.rebuild_for_user(user["id"])
        
        # If this user is a manager, rebuild subordinates' access too
        # (Their visibility might have changed)
        if user.get("hierarchy", {}).get("is_manager"):
            subordinates = user.get("hierarchy", {}).get("subordinates", [])
            for sub in subordinates:
                await self.rebuild_for_user(sub["user_id"])
        
        # If this user has a manager, rebuild manager's access
        # (Manager needs to see subordinate's new data)
        manager = user.get("hierarchy", {}).get("manager")
        if manager:
            await self.rebuild_for_user(manager["user_id"])
        
        await self.mark_processed(event.id)
    
    async def _handle_opportunity_changed(self, event: Event):
        """Rebuild access when opportunity assignment changes"""
        payload = event.payload
        
        # Rebuild for old and new owners
        old_owner = payload.get("old_owner_id")
        new_owner = payload.get("new_owner_id") or payload.get("salesperson_id")
        
        if old_owner:
            # Find user and rebuild
            user = await self.user_profiles.find_one({"odoo.user_id": old_owner})
            if user:
                await self.rebuild_for_user(user["id"])
        
        if new_owner:
            user = await self.user_profiles.find_one({"odoo.user_id": new_owner})
            if user:
                await self.rebuild_for_user(user["id"])
                
                # Also rebuild manager's access
                manager = user.get("hierarchy", {}).get("manager")
                if manager:
                    await self.rebuild_for_user(manager["user_id"])
        
        await self.mark_processed(event.id)
    
    async def rebuild_for_user(self, user_id: str):
        """
        Rebuild access matrix for a specific user.
        
        This is the CORE of access control - pre-computes everything.
        
        Args:
            user_id: User UUID
        """
        # Get user profile
        user = await self.user_profiles.find_one({"id": user_id}, {"_id": 0})
        if not user:
            logger.warning(f"Cannot rebuild access matrix - user {user_id} not found")
            return
        
        is_super_admin = user.get("is_super_admin", False)
        
        # STEP 1: Find accessible opportunities
        if is_super_admin:
            # Admins see everything
            all_opps = await self.opportunity_view.find(
                {"is_active": True},
                {"odoo_id": 1}
            ).to_list(10000)
            accessible_opp_ids = [o["odoo_id"] for o in all_opps]
        else:
            # Use pre-computed visible_to_user_ids (fast!)
            accessible_opps = await self.opportunity_view.find(
                {
                    "visible_to_user_ids": user_id,
                    "is_active": True
                },
                {"odoo_id": 1}
            ).to_list(10000)
            accessible_opp_ids = [o["odoo_id"] for o in accessible_opps]
        
        # STEP 2: Find accessible accounts
        # (Accounts visible if user has access to any related opportunity)
        accessible_accounts = set()
        opps_with_accounts = await self.opportunity_view.find(
            {
                "odoo_id": {"$in": accessible_opp_ids},
                "account.odoo_id": {"$ne": None}
            },
            {"account.odoo_id": 1}
        ).to_list(10000)
        
        for opp in opps_with_accounts:
            acc_id = opp.get("account", {}).get("odoo_id")
            if acc_id:
                accessible_accounts.add(acc_id)
        
        # STEP 3: Get subordinate info (including ALL levels recursively)
        subordinates = user.get("hierarchy", {}).get("subordinates", [])
        direct_subordinate_ids = [s["user_id"] for s in subordinates]
        
        # Get ALL subordinates recursively (multi-level hierarchy)
        all_subordinate_ids = await self._get_all_subordinates_recursive(user_id)
        
        # STEP 4: Store access matrix
        access_doc = {
            "user_id": user_id,
            "email": user["email"],
            
            # Pre-computed access lists
            "accessible_opportunities": accessible_opp_ids,
            "accessible_accounts": list(accessible_accounts),
            "accessible_user_ids": subordinate_ids,  # Users they can view
            
            # Hierarchy context
            "is_super_admin": is_super_admin,
            "is_manager": user.get("hierarchy", {}).get("is_manager", False),
            "subordinate_count": len(subordinates),
            "managed_team_ids": [user.get("odoo", {}).get("team_id")] if user.get("odoo", {}).get("team_id") else [],
            
            # Cache metadata
            "computed_at": datetime.now(timezone.utc),
            "ttl": 300  # 5 minutes
        }
        
        await self.collection.update_one(
            {"user_id": user_id},
            {"$set": access_doc},
            upsert=True
        )
        
        logger.info(f"Access matrix rebuilt for {user['email']}: {len(accessible_opp_ids)} opps, {len(subordinates)} subordinates")
