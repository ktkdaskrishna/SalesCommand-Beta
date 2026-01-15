"""
Activity Projection - CQRS Read Model for Activities
Builds denormalized activity_view with inherited authorization from opportunities
"""
from typing import List
from datetime import datetime, timezone
import uuid
import logging

from projections.base import BaseProjection
from event_store.models import Event, EventType

logger = logging.getLogger(__name__)


class ActivityProjection(BaseProjection):
    """
    Builds activity_view collection.
    
    CRITICAL: Activities inherit visibility from linked opportunities.
    """
    
    def __init__(self, db):
        super().__init__(db, "ActivityProjection")
        self.collection = db.activity_view
        self.opportunity_view = db.opportunity_view
        self.user_profiles = db.user_profiles
    
    def subscribes_to(self) -> List[str]:
        return [EventType.ODOO_ACTIVITY_SYNCED.value]
    
    async def handle(self, event: Event):
        """Process activity sync event"""
        if event.event_type == EventType.ODOO_ACTIVITY_SYNCED:
            await self._handle_activity_synced(event)
    
    async def _handle_activity_synced(self, event: Event):
        """Build denormalized activity with inherited authorization"""
        payload = event.payload
        activity_id = payload.get("id")
        res_model = payload.get("res_model")
        res_id = payload.get("res_id")
        
        # Only process opportunity activities
        if res_model != "crm.lead":
            logger.debug(f"Skipping non-opportunity activity: {activity_id}")
            return
        
        # Find linked opportunity
        opportunity = await self.opportunity_view.find_one({"odoo_id": res_id})
        
        if not opportunity:
            logger.warning(f"Activity {activity_id} links to unknown opportunity {res_id}")
            return
        
        # Find assigned user
        user_odoo_id = payload.get("user_id")
        assigned_user = None
        
        if user_odoo_id:
            user_profile = await self.user_profiles.find_one({"odoo.user_id": user_odoo_id})
            
            if user_profile:
                assigned_user = {
                    "user_id": user_profile["id"],
                    "odoo_user_id": user_profile["odoo"]["user_id"],
                    "name": user_profile["name"],
                    "email": user_profile["email"]
                }
            else:
                assigned_user = {
                    "user_id": None,
                    "odoo_user_id": user_odoo_id,
                    "name": payload.get("user_name"),
                    "email": None
                }
        
        # Categorize for presales
        presales_category = self._categorize_for_presales(
            payload.get("summary", ""),
            payload.get("activity_type", "")
        )
        
        # Build activity document
        activity_doc = {
            "odoo_id": activity_id,
            "activity_type": payload.get("activity_type"),
            "summary": payload.get("summary"),
            "note": payload.get("note"),
            "due_date": payload.get("date_deadline"),
            "state": payload.get("state"),
            "presales_category": presales_category,
            
            # Denormalized opportunity
            "opportunity": {
                "id": opportunity["id"],
                "odoo_id": opportunity["odoo_id"],
                "name": opportunity["name"],
                "salesperson": opportunity.get("salesperson")
            },
            
            # Denormalized user
            "assigned_to": assigned_user,
            
            # INHERIT VISIBILITY FROM OPPORTUNITY
            "visible_to_user_ids": opportunity.get("visible_to_user_ids", []),
            
            # Metadata
            "is_active": True,
            "last_synced": datetime.now(timezone.utc),
            "source": "odoo",
            "event_version": event.version
        }
        
        # Upsert
        await self.collection.update_one(
            {"odoo_id": activity_id},
            {
                "$set": activity_doc,
                "$setOnInsert": {
                    "id": str(uuid.uuid4()),
                    "created_at": datetime.now(timezone.utc),
                    "version": 1
                }
            },
            upsert=True
        )
        
        logger.info(f"Activity {activity_id} linked to opportunity {res_id}, visible to {len(activity_doc['visible_to_user_ids'])} users")
        
        await self.mark_processed(event.id)
    
    def _categorize_for_presales(self, summary: str, activity_type: str) -> str:
        """Categorize activity for Presales KPI tracking"""
        summary_lower = (summary or "").lower()
        type_lower = (activity_type or "").lower()
        
        # POC
        if any(kw in summary_lower for kw in ["poc", "proof of concept", "pilot"]):
            return "POC"
        
        # Demo
        if any(kw in summary_lower for kw in ["demo", "demonstration", "walkthrough"]):
            return "Demo"
        
        # Presentation
        if any(kw in summary_lower for kw in ["presentation", "pitch", "deck"]):
            return "Presentation"
        
        # RFP
        if any(kw in summary_lower for kw in ["rfp", "tender", "proposal", "bid"]):
            return "RFP_Influence"
        
        # Lead
        if any(kw in summary_lower for kw in ["lead", "qualification", "discovery"]):
            return "Lead"
        
        # By type
        if "meeting" in type_lower:
            return "Meeting"
        if "call" in type_lower:
            return "Call"
        
        return "Other"
