"""
Opportunity Projection
Builds denormalized opportunity_view with all relationships pre-joined
"""
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import logging

from projections.base import BaseProjection
from event_store.models import Event, EventType

logger = logging.getLogger(__name__)


class OpportunityProjection(BaseProjection):
    """
    Builds opportunity_view collection - denormalized opportunities with:
    - Salesperson info (pre-joined from user_profiles)
    - Account info (pre-joined)
    - Manager info (for hierarchy visibility)
    - Pre-computed visible_to_user_ids (for fast access control)
    """
    
    def __init__(self, db):
        super().__init__(db, "OpportunityProjection")
        self.collection = db.opportunity_view
        self.user_profiles = db.user_profiles
    
    def subscribes_to(self) -> List[str]:
        return [
            EventType.ODOO_OPPORTUNITY_SYNCED.value,
            EventType.OPPORTUNITY_ASSIGNED.value,
            EventType.OPPORTUNITY_STAGE_CHANGED.value,
            EventType.OPPORTUNITY_DELETED.value
        ]
    
    async def handle(self, event: Event):
        if event.event_type == EventType.ODOO_OPPORTUNITY_SYNCED:
            await self._handle_opportunity_synced(event)
        elif event.event_type == EventType.OPPORTUNITY_ASSIGNED:
            await self._handle_assigned(event)
        elif event.event_type == EventType.OPPORTUNITY_DELETED:
            await self._handle_deleted(event)
    
    async def _handle_opportunity_synced(self, event: Event):
        """
        Build denormalized opportunity with all relationships.
        
        Critical: Pre-computes visible_to_user_ids for O(1) access control.
        """
        payload = event.payload
        odoo_id = payload.get("id")
        
        if not odoo_id:
            logger.warning(f"Event {event.id} has no opportunity ID")
            return
        
        # STEP 1: Find salesperson (denormalize user info)
        salesperson = None
        visible_to_user_ids = []
        
        sp_odoo_user_id = payload.get("salesperson_id")
        
        if sp_odoo_user_id:
            # Find user by odoo_user_id in user_profiles
            sp_user = await self.user_profiles.find_one({
                "odoo.user_id": sp_odoo_user_id
            }, {"_id": 0})
            
            if sp_user:
                salesperson = {
                    "user_id": sp_user["id"],
                    "odoo_user_id": sp_user["odoo"]["user_id"],
                    "odoo_employee_id": sp_user["odoo"]["employee_id"],
                    "name": sp_user["name"],
                    "email": sp_user["email"],
                    "team_id": sp_user.get("odoo", {}).get("team_id"),
                    "team_name": sp_user.get("odoo", {}).get("team_name"),
                    
                    # Include manager for visibility
                    "manager": sp_user.get("hierarchy", {}).get("manager")
                }
                
                # Owner can see
                visible_to_user_ids.append(sp_user["id"])
                
                # Manager can see (CRITICAL for hierarchy visibility)
                if salesperson.get("manager"):
                    manager_user_id = salesperson["manager"].get("user_id")
                    if manager_user_id:
                        visible_to_user_ids.append(manager_user_id)
                        logger.debug(f"Added manager {manager_user_id} to visibility for opp {odoo_id}")
        else:
            logger.warning(f"Opportunity {odoo_id} has no salesperson_id")
        
        # STEP 2: Find account info (denormalize)
        account = None
        partner_id = payload.get("partner_id")
        
        if partner_id:
            # Get from odoo_raw_data
            acc_doc = await self.db.odoo_raw_data.find_one({
                "entity_type": "account",
                "odoo_id": partner_id,
                "is_latest": True
            })
            
            if acc_doc:
                acc_data = acc_doc.get("raw_data", {})
                account = {
                    "odoo_id": partner_id,
                    "name": acc_data.get("name"),
                    "city": acc_data.get("city"),
                    "country": acc_data.get("country_name")
                }
        
        # STEP 3: Add all super admins to visible_to
        admin_docs = await self.user_profiles.find(
            {"is_super_admin": True},
            {"id": 1}
        ).to_list(100)
        
        for admin in admin_docs:
            visible_to_user_ids.append(admin["id"])
        
        # STEP 4: Upsert opportunity view
        opportunity_doc = {
            "odoo_id": odoo_id,
            "name": payload.get("name"),
            "stage": payload.get("stage_name"),
            "value": float(payload.get("expected_revenue", 0) or 0),
            "probability": float(payload.get("probability", 0) or 0),
            "expected_close_date": payload.get("date_deadline"),
            "description": payload.get("description"),
            
            # Denormalized relationships
            "salesperson": salesperson,
            "account": account,
            
            # Pre-computed access control (CRITICAL for performance)
            "visible_to_user_ids": list(set(visible_to_user_ids)),  # Dedupe
            
            # Metadata
            "source": "odoo",
            "is_active": True,
            "last_synced": datetime.now(timezone.utc),
            "event_version": event.version
        }
        
        result = await self.collection.update_one(
            {"odoo_id": odoo_id},
            {
                "$set": opportunity_doc,
                "$setOnInsert": {
                    "id": str(uuid.uuid4()),
                    "created_at": datetime.now(timezone.utc),
                    "version": 1
                }
            },
            upsert=True
        )
        
        action = "updated" if result.matched_count > 0 else "created"
        logger.info(f"Opportunity {action}: {payload.get('name')} (ID={odoo_id}), visible_to={len(visible_to_user_ids)} users")
        
        await self.mark_processed(event.id)
    
    async def _handle_assigned(self, event: Event):
        """Handle opportunity reassignment"""
        payload = event.payload
        opp_id = payload.get("opportunity_id")
        new_owner_id = payload.get("new_owner_id")
        
        # Rebuild visibility for this opportunity
        # (Triggers full re-denormalization)
        await self._handle_opportunity_synced(event)
        
        await self.mark_processed(event.id)
    
    async def _handle_deleted(self, event: Event):
        """Soft-delete opportunity"""
        payload = event.payload
        odoo_id = payload.get("odoo_id")
        
        await self.collection.update_one(
            {"odoo_id": odoo_id},
            {
                "$set": {
                    "is_active": False,
                    "deleted_at": datetime.now(timezone.utc),
                    "delete_reason": "odoo_deleted"
                }
            }
        )
        
        logger.info(f"Opportunity soft-deleted: {odoo_id}")
        await self.mark_processed(event.id)
