"""
User Profile Projection
Builds denormalized user_profiles materialized view
"""
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import logging

from projections.base import BaseProjection
from event_store.models import Event, EventType

logger = logging.getLogger(__name__)


class UserProfileProjection(BaseProjection):
    """
    Builds user_profiles collection - denormalized user data with:
    - All Odoo enrichment fields
    - Pre-computed hierarchy (manager + subordinates list)
    - Team information
    - Access permissions
    """
    
    def __init__(self, db):
        super().__init__(db, "UserProfileProjection")
        self.collection = db.user_profiles
    
    def subscribes_to(self) -> List[str]:
        return [
            EventType.ODOO_USER_SYNCED.value,
            EventType.USER_LOGGED_IN.value,
            EventType.MANAGER_ASSIGNED.value,
            EventType.USER_ROLE_CHANGED.value
        ]
    
    async def handle(self, event: Event):
        """
        Process user-related events.
        
        Args:
            event: Domain event
        """
        if event.event_type == EventType.ODOO_USER_SYNCED:
            await self._handle_odoo_user_synced(event)
        elif event.event_type == EventType.MANAGER_ASSIGNED:
            await self._handle_manager_assigned(event)
        elif event.event_type == EventType.USER_ROLE_CHANGED:
            await self._handle_role_changed(event)
    
    async def _handle_odoo_user_synced(self, event: Event):
        """
        Process OdooUserSynced event.
        Builds/updates denormalized user profile with hierarchy.
        
        Args:
            event: OdooUserSynced event
        """
        payload = event.payload
        email = payload.get("email")
        
        if not email:
            logger.warning(f"OdooUserSynced event {event.id} has no email")
            return
        
        email_lower = email.lower()
        odoo_employee_id = payload.get("odoo_employee_id")
        odoo_user_id = payload.get("odoo_user_id")
        manager_odoo_id = payload.get("manager_odoo_id")
        
        # STEP 1: Build hierarchy - find subordinates
        subordinates = []
        if odoo_employee_id:
            # Find all users who report to this user
            sub_docs = await self.collection.find({
                "odoo.manager_employee_id": odoo_employee_id
            }, {
                "id": 1,
                "email": 1,
                "name": 1,
                "odoo.user_id": 1,
                "odoo.employee_id": 1
            }).to_list(100)
            
            for sub in sub_docs:
                subordinates.append({
                    "user_id": sub["id"],
                    "odoo_employee_id": sub.get("odoo", {}).get("employee_id"),
                    "odoo_user_id": sub.get("odoo", {}).get("user_id"),
                    "name": sub.get("name"),
                    "email": sub.get("email")
                })
        
        # STEP 2: Find manager info
        manager = None
        if manager_odoo_id:
            manager_doc = await self.collection.find_one({
                "odoo.employee_id": manager_odoo_id
            }, {
                "id": 1,
                "email": 1,
                "name": 1,
                "odoo.employee_id": 1
            })
            
            if manager_doc:
                manager = {
                    "user_id": manager_doc["id"],
                    "odoo_employee_id": manager_doc.get("odoo", {}).get("employee_id"),
                    "name": manager_doc.get("name"),
                    "email": manager_doc.get("email")
                }
        
        # STEP 3: Upsert user profile
        update_doc = {
            "email": email_lower,
            "name": payload.get("name"),
            "job_title": payload.get("job_title"),
            
            # Odoo linkage (namespace to avoid conflicts)
            "odoo": {
                "user_id": odoo_user_id,
                "employee_id": odoo_employee_id,
                "salesperson_name": payload.get("name"),
                "team_id": payload.get("team_id"),
                "team_name": payload.get("team_name"),
                "department_id": payload.get("department_id"),
                "department_name": payload.get("department_name"),
                "manager_employee_id": manager_odoo_id  # For queries
            },
            
            # Pre-computed hierarchy
            "hierarchy": {
                "manager": manager,
                "subordinates": subordinates,
                "reports_count": len(subordinates),
                "is_manager": len(subordinates) > 0
            },
            
            # Metadata
            "last_sync": datetime.now(timezone.utc),
            "source": "odoo",
            "event_version": event.version
        }
        
        result = await self.collection.update_one(
            {"email": email_lower},
            {
                "$set": update_doc,
                "$inc": {"version": 1},
                "$setOnInsert": {
                    "id": str(uuid.uuid4()),
                    "created_at": datetime.now(timezone.utc),
                    "version": 1
                }
            },
            upsert=True
        )
        
        action = "updated" if result.matched_count > 0 else "created"
        logger.info(f"User profile {action} for {email}: user_id={odoo_user_id}, employee_id={odoo_employee_id}, subordinates={len(subordinates)}")
        
        # STEP 4: Update any users who have this person as manager
        # Their hierarchy.manager needs updating
        if odoo_employee_id:
            await self._update_subordinates_manager_info(
                odoo_employee_id,
                payload.get("name"),
                email_lower
            )
        
        await self.mark_processed(event.id)
    
    async def _update_subordinates_manager_info(
        self,
        manager_employee_id: int,
        manager_name: str,
        manager_email: str
    ):
        """
        Update manager info in all subordinates.
        When manager's name changes, update it everywhere.
        
        Args:
            manager_employee_id: Manager's employee ID
            manager_name: Manager's name
            manager_email: Manager's email
        """
        # Find manager's user_id
        manager_doc = await self.collection.find_one(
            {"odoo.employee_id": manager_employee_id},
            {"id": 1}
        )
        
        if not manager_doc:
            return
        
        manager_user_id = manager_doc["id"]
        
        # Update all subordinates
        result = await self.collection.update_many(
            {"odoo.manager_employee_id": manager_employee_id},
            {
                "$set": {
                    "hierarchy.manager": {
                        "user_id": manager_user_id,
                        "odoo_employee_id": manager_employee_id,
                        "name": manager_name,
                        "email": manager_email
                    }
                }
            }
        )
        
        if result.modified_count > 0:
            logger.info(f"Updated manager info in {result.modified_count} subordinate profiles")
    
    async def _handle_manager_assigned(self, event: Event):
        """
        Handle manager reassignment.
        
        Args:
            event: ManagerAssigned event
        """
        payload = event.payload
        user_email = payload.get("user_email")
        new_manager_id = payload.get("new_manager_employee_id")
        
        # Update user's manager
        await self.collection.update_one(
            {"email": user_email.lower()},
            {
                "$set": {
                    "odoo.manager_employee_id": new_manager_id,
                    "hierarchy.manager": None  # Will be populated by next sync
                },
                "$inc": {"version": 1}
            }
        )
        
        await self.mark_processed(event.id)
    
    async def _handle_role_changed(self, event: Event):
        """
        Handle user role change.
        
        Args:
            event: UserRoleChanged event
        """
        payload = event.payload
        user_email = payload.get("user_email")
        new_role = payload.get("new_role")
        
        await self.collection.update_one(
            {"email": user_email.lower()},
            {
                "$set": {
                    "role": new_role,
                    "role_updated_at": datetime.now(timezone.utc)
                },
                "$inc": {"version": 1}
            }
        )
        
        await self.mark_processed(event.id)
    
    async def get_user_by_email(self, email: str) -> Optional[dict]:
        """
        Query helper - get user profile by email.
        
        Args:
            email: User email
        
        Returns:
            User profile document or None
        """
        return await self.collection.find_one(
            {"email": email.lower()},
            {"_id": 0}
        )
    
    async def get_user_subordinates(self, user_id: str) -> List[dict]:
        """
        Query helper - get user's subordinates.
        
        Args:
            user_id: User UUID
        
        Returns:
            List of subordinate user profiles
        """
        user = await self.collection.find_one(
            {"id": user_id},
            {"hierarchy.subordinates": 1}
        )
        
        if not user:
            return []
        
        return user.get("hierarchy", {}).get("subordinates", [])
