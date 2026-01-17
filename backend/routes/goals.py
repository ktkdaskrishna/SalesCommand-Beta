"""
Goals API Routes
CRUD operations for goals and objectives tracking
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid

from core.database import Database
from services.auth.jwt_handler import get_current_user_from_token

router = APIRouter(prefix="/goals", tags=["Goals"])


# ===================== MODELS =====================

class GoalCreate(BaseModel):
    name: str
    description: Optional[str] = None
    target_value: float
    current_value: float = 0
    unit: str = "currency"  # currency, percentage, count
    goal_type: str = "revenue"  # revenue, leads, conversion, clients, satisfaction, audit
    due_date: str
    assignee_type: Optional[str] = "user"  # user, role, department
    assignee_id: Optional[str] = None


class GoalUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    target_value: Optional[float] = None
    current_value: Optional[float] = None
    unit: Optional[str] = None
    goal_type: Optional[str] = None
    due_date: Optional[str] = None
    assignee_type: Optional[str] = None
    assignee_id: Optional[str] = None


# ===================== MIDDLEWARE =====================

async def require_approved_user(token_data: dict = Depends(get_current_user_from_token)):
    """Require an approved user"""
    db = Database.get_db()
    user = await db.users.find_one({"id": token_data["id"]})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("approval_status") == "pending":
        raise HTTPException(status_code=403, detail="User pending approval")
    
    return token_data


# ===================== ROUTES =====================

@router.get("")
async def get_goals(
    assignee_type: Optional[str] = None,
    goal_type: Optional[str] = None,
    token_data: dict = Depends(require_approved_user)
):
    """
    Get all goals. Optionally filter by assignee type or goal type.
    """
    db = Database.get_db()
    
    query = {"is_active": {"$ne": False}}
    
    if assignee_type:
        query["assignee_type"] = assignee_type
    if goal_type:
        query["goal_type"] = goal_type
    
    goals = await db.goals.find(query, {"_id": 0}).sort("due_date", 1).to_list(100)
    
    # Calculate achievement percentage for each goal
    for goal in goals:
        if goal.get("target_value", 0) > 0:
            goal["achievement_percentage"] = round(
                (goal.get("current_value", 0) / goal["target_value"]) * 100, 1
            )
        else:
            goal["achievement_percentage"] = 0
    
    return {"goals": goals, "count": len(goals)}


@router.get("/{goal_id}")
async def get_goal(
    goal_id: str,
    token_data: dict = Depends(require_approved_user)
):
    """Get a single goal by ID"""
    db = Database.get_db()
    
    goal = await db.goals.find_one({"id": goal_id}, {"_id": 0})
    
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    # Calculate achievement percentage
    if goal.get("target_value", 0) > 0:
        goal["achievement_percentage"] = round(
            (goal.get("current_value", 0) / goal["target_value"]) * 100, 1
        )
    else:
        goal["achievement_percentage"] = 0
    
    return goal


@router.post("")
async def create_goal(
    goal: GoalCreate,
    token_data: dict = Depends(require_approved_user)
):
    """Create a new goal"""
    db = Database.get_db()
    
    now = datetime.now(timezone.utc)
    
    goal_doc = {
        "id": str(uuid.uuid4()),
        "name": goal.name,
        "description": goal.description,
        "target_value": goal.target_value,
        "current_value": goal.current_value,
        "unit": goal.unit,
        "goal_type": goal.goal_type,
        "due_date": goal.due_date,
        "assignee_type": goal.assignee_type,
        "assignee_id": goal.assignee_id or token_data["id"],
        "created_by": token_data["id"],
        "created_at": now,
        "updated_at": now,
        "is_active": True,
    }
    
    await db.goals.insert_one(goal_doc)
    del goal_doc["_id"]
    
    return {"message": "Goal created successfully", "goal": goal_doc}


@router.put("/{goal_id}")
async def update_goal(
    goal_id: str,
    updates: GoalUpdate,
    token_data: dict = Depends(require_approved_user)
):
    """Update an existing goal"""
    db = Database.get_db()
    
    existing = await db.goals.find_one({"id": goal_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No updates provided")
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.goals.update_one({"id": goal_id}, {"$set": update_data})
    
    return {"message": "Goal updated successfully"}


@router.delete("/{goal_id}")
async def delete_goal(
    goal_id: str,
    token_data: dict = Depends(require_approved_user)
):
    """Delete a goal (soft delete)"""
    db = Database.get_db()
    
    existing = await db.goals.find_one({"id": goal_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    await db.goals.update_one(
        {"id": goal_id},
        {"$set": {"is_active": False, "deleted_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Goal deleted successfully"}


@router.patch("/{goal_id}/progress")
async def update_goal_progress(
    goal_id: str,
    current_value: float,
    token_data: dict = Depends(require_approved_user)
):
    """Update just the current value (progress) of a goal"""
    db = Database.get_db()
    
    existing = await db.goals.find_one({"id": goal_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    await db.goals.update_one(
        {"id": goal_id},
        {"$set": {
            "current_value": current_value,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    



@router.get("/team/subordinates")
async def get_team_subordinates(
    token_data: dict = Depends(require_approved_user)
):
    """
    Get list of subordinates for manager goal assignment.
    Returns team members that the current user manages.
    """
    db = Database.get_db()
    user_id = token_data["id"]
    
    # Get user's profile from user_profiles (CQRS)
    user_profile = await db.user_profiles.find_one({"email": token_data["email"].lower()}, {"_id": 0})
    
    if not user_profile:
        return {"subordinates": [], "is_manager": False}
    
    # Get subordinates from hierarchy
    is_manager = user_profile.get("hierarchy", {}).get("is_manager", False)
    subordinates = user_profile.get("hierarchy", {}).get("subordinates", [])
    
    # Format for frontend
    team_members = []
    for sub in subordinates:
        team_members.append({
            "user_id": sub.get("user_id"),
            "name": sub.get("name"),
            "email": sub.get("email"),
            "odoo_employee_id": sub.get("odoo_employee_id"),
        })
    
    return {
        "is_manager": is_manager,
        "subordinates": team_members,
        "count": len(team_members)
    }


@router.post("/assign-to-team")
async def assign_goal_to_team(
    goal_id: str,
    team_member_ids: List[str],
    token_data: dict = Depends(require_approved_user)
):
    """
    Assign an existing goal to multiple team members.
    Creates individual goal instances for each team member.
    """
    db = Database.get_db()
    
    # Get original goal
    original_goal = await db.goals.find_one({"id": goal_id}, {"_id": 0})
    if not original_goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    # Check if user is manager
    user_profile = await db.user_profiles.find_one({"email": token_data["email"].lower()}, {"_id": 0})
    if not user_profile or not user_profile.get("hierarchy", {}).get("is_manager"):
        raise HTTPException(status_code=403, detail="Only managers can assign team goals")
    
    # Create goal instances for each team member
    created_goals = []
    now = datetime.now(timezone.utc)
    
    for member_id in team_member_ids:
        team_goal = {
            "id": str(uuid.uuid4()),
            "name": original_goal["name"],
            "description": original_goal.get("description"),
            "target_value": original_goal["target_value"],
            "current_value": 0,  # Reset for new assignee
            "unit": original_goal["unit"],
            "goal_type": original_goal["goal_type"],
            "due_date": original_goal["due_date"],
            "assignee_type": "user",
            "assignee_id": member_id,
            "parent_goal_id": goal_id,  # Link to parent goal
            "created_by": token_data["id"],
            "assigned_by": token_data["id"],  # Track who assigned
            "created_at": now,
            "updated_at": now,
            "is_active": True,
        }
        
        await db.goals.insert_one(team_goal)
        created_goals.append(team_goal["id"])
    
    return {
        "message": f"Goal assigned to {len(team_member_ids)} team members",
        "created_goal_ids": created_goals
    }

    # Calculate new achievement percentage
    target = existing.get("target_value", 0)
    achievement = round((current_value / target) * 100, 1) if target > 0 else 0
    
    return {
        "message": "Goal progress updated",
        "current_value": current_value,
        "achievement_percentage": achievement
    }


# ===================== AGGREGATE ENDPOINTS =====================

@router.get("/summary/stats")
async def get_goals_summary(
    token_data: dict = Depends(require_approved_user)
):
    """
    Get summary statistics for all goals.
    If no goals exist, auto-populate current_value from actual opportunity data.
    """
    db = Database.get_db()
    
    goals = await db.goals.find({"is_active": {"$ne": False}}, {"_id": 0}).to_list(500)
    
    # If there are revenue goals with 0 current value, try to update from opportunities
    for goal in goals:
        if goal.get("goal_type") == "revenue" and goal.get("current_value", 0) == 0:
            # Calculate actual won revenue from opportunities
            opp_docs = await db.data_lake_serving.find({
                "entity_type": "opportunity",
                "$or": [
                    {"is_active": True},
                    {"is_active": {"$exists": False}}
                ]
            }).to_list(1000)
            
            won_revenue = 0
            pipeline_value = 0
            for doc in opp_docs:
                opp = doc.get("data", {})
                value = float(opp.get("expected_revenue", 0) or 0)
                stage = (opp.get("stage_name") or "").lower()
                
                if "won" in stage:
                    won_revenue += value
                elif "lost" not in stage:
                    pipeline_value += value
            
            # Update goal's current_value with actual data
            if won_revenue > 0 or pipeline_value > 0:
                # For revenue goals, use won revenue
                new_value = won_revenue if won_revenue > 0 else pipeline_value * 0.3  # Estimate 30% close rate
                await db.goals.update_one(
                    {"id": goal["id"]},
                    {"$set": {"current_value": new_value}}
                )
                goal["current_value"] = new_value
    
    total = len(goals)
    if total == 0:
        return {
            "total_goals": 0,
            "overall_progress": 0,
            "achieved": 0,
            "on_track": 0,
            "at_risk": 0,
            "behind": 0,
        }
    
    achieved = 0
    on_track = 0
    at_risk = 0
    behind = 0
    total_progress = 0
    
    for goal in goals:
        target = goal.get("target_value", 0)
        current = goal.get("current_value", 0)
        pct = (current / target * 100) if target > 0 else 0
        total_progress += pct
        
        if pct >= 100:
            achieved += 1
        elif pct >= 70:
            on_track += 1
        elif pct >= 40:
            at_risk += 1
        else:
            behind += 1
    
    return {
        "total_goals": total,
        "overall_progress": round(total_progress / total, 1) if total > 0 else 0,
        "achieved": achieved,
        "on_track": on_track,
        "at_risk": at_risk,
        "behind": behind,
    }
