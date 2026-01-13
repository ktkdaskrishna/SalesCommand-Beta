"""
Activity Logging Service
Automatically logs user activities for the Activity Timeline feature.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional
from core.database import Database


class ActivityLogger:
    """Logs user activities to the activities collection."""
    
    ACTIVITY_TYPES = {
        "opportunity_created": "Created opportunity",
        "opportunity_updated": "Updated opportunity",
        "opportunity_stage_changed": "Moved opportunity to {stage}",
        "account_viewed": "Viewed account",
        "goal_created": "Created goal",
        "goal_updated": "Updated goal progress",
        "deal_confidence_analyzed": "Analyzed deal confidence",
        "user_login": "Logged in",
        "data_synced": "Synced data from Odoo",
    }
    
    @staticmethod
    async def log(
        activity_type: str,
        user_id: str,
        user_name: str,
        user_email: str,
        title: str,
        description: Optional[str] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        entity_name: Optional[str] = None,
        metadata: Optional[dict] = None
    ) -> dict:
        """
        Log a user activity.
        
        Args:
            activity_type: Type of activity (see ACTIVITY_TYPES)
            user_id: ID of the user performing the action
            user_name: Name of the user
            user_email: Email of the user
            title: Short title for the activity
            description: Optional longer description
            entity_type: Type of entity affected (opportunity, account, goal, etc.)
            entity_id: ID of the affected entity
            entity_name: Name of the affected entity
            metadata: Additional metadata about the activity
        
        Returns:
            The created activity document
        """
        db = Database.get_db()
        
        activity = {
            "id": str(uuid.uuid4()),
            "activity_type": activity_type,
            "title": title,
            "description": description or "",
            "user_id": user_id,
            "user_name": user_name,
            "user_email": user_email,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "entity_name": entity_name,
            "metadata": metadata or {},
            "status": "completed",
            "created_at": datetime.now(timezone.utc),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        
        await db.activities.insert_one(activity)
        
        # Remove MongoDB _id before returning
        activity.pop("_id", None)
        
        return activity
    
    @staticmethod
    async def log_opportunity_action(
        action: str,
        user_id: str,
        user_name: str,
        user_email: str,
        opportunity_id: str,
        opportunity_name: str,
        account_name: Optional[str] = None,
        value: Optional[float] = None,
        stage: Optional[str] = None,
        old_stage: Optional[str] = None
    ):
        """Log an opportunity-related activity."""
        
        if action == "created":
            title = f"Created opportunity: {opportunity_name}"
            activity_type = "opportunity_created"
        elif action == "stage_changed":
            title = f"Moved '{opportunity_name}' to {stage}"
            activity_type = "opportunity_stage_changed"
        else:
            title = f"Updated opportunity: {opportunity_name}"
            activity_type = "opportunity_updated"
        
        description = ""
        if account_name:
            description += f"Account: {account_name}. "
        if value:
            description += f"Value: ${value:,.0f}. "
        if old_stage and stage:
            description += f"Stage changed from '{old_stage}' to '{stage}'."
        
        return await ActivityLogger.log(
            activity_type=activity_type,
            user_id=user_id,
            user_name=user_name,
            user_email=user_email,
            title=title,
            description=description.strip(),
            entity_type="opportunity",
            entity_id=opportunity_id,
            entity_name=opportunity_name,
            metadata={
                "account_name": account_name,
                "value": value,
                "stage": stage,
                "old_stage": old_stage,
            }
        )
    
    @staticmethod
    async def log_login(user_id: str, user_name: str, user_email: str):
        """Log a user login activity."""
        return await ActivityLogger.log(
            activity_type="user_login",
            user_id=user_id,
            user_name=user_name,
            user_email=user_email,
            title=f"{user_name} logged in",
            description=f"User {user_email} logged into the platform",
        )
    
    @staticmethod
    async def log_deal_confidence(
        user_id: str,
        user_name: str,
        user_email: str,
        opportunity_id: str,
        opportunity_name: str,
        confidence_score: int
    ):
        """Log a deal confidence analysis activity."""
        return await ActivityLogger.log(
            activity_type="deal_confidence_analyzed",
            user_id=user_id,
            user_name=user_name,
            user_email=user_email,
            title=f"Analyzed deal confidence: {opportunity_name}",
            description=f"AI confidence score: {confidence_score}%",
            entity_type="opportunity",
            entity_id=opportunity_id,
            entity_name=opportunity_name,
            metadata={"confidence_score": confidence_score}
        )


# Singleton instance for easy import
activity_logger = ActivityLogger()
