"""
RBAC Middleware
Permission checking and access control for all routes
"""
import logging
from typing import List, Optional, Callable
from functools import wraps

from fastapi import HTTPException, Depends
from services.auth.jwt_handler import get_current_user_from_token
from services.rbac.service import RBACService
from core.database import Database

logger = logging.getLogger(__name__)


class PermissionChecker:
    """
    Permission checker dependency for FastAPI routes.
    Validates user has required permission and is in approved state.
    """
    
    def __init__(self, permission: str = None, require_role: bool = True):
        self.permission = permission
        self.require_role = require_role
    
    async def __call__(self, token_data: dict = Depends(get_current_user_from_token)):
        db = Database.get_db()
        rbac = RBACService(db)
        
        # Get user with resolved role
        user = await rbac.get_user_with_role(token_data["id"])
        
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Account is deactivated")
        
        # Check approval status
        user_doc = await db.users.find_one({"id": token_data["id"]}, {"approval_status": 1})
        approval_status = user_doc.get("approval_status", "approved") if user_doc else "approved"
        
        # Super admins bypass all checks
        if user.is_super_admin:
            return {**token_data, "user": user, "approval_status": "approved"}
        
        # Check if user needs approval
        if approval_status == "pending":
            raise HTTPException(
                status_code=403, 
                detail="Account pending approval. Please contact administrator."
            )
        
        if approval_status == "rejected":
            raise HTTPException(
                status_code=403, 
                detail="Account access has been denied."
            )
        
        # Check if role is required and assigned
        if self.require_role and not user.role_id:
            raise HTTPException(
                status_code=403, 
                detail="No role assigned. Please contact administrator."
            )
        
        # Check specific permission if required
        if self.permission:
            if not rbac.has_permission(user, self.permission):
                raise HTTPException(
                    status_code=403, 
                    detail=f"Permission denied: {self.permission}"
                )
        
        return {**token_data, "user": user, "approval_status": approval_status}


# Pre-built permission checkers for common use cases
def require_permission(permission: str):
    """Require specific permission"""
    return PermissionChecker(permission=permission, require_role=True)


def require_approved():
    """Require approved user (any role)"""
    return PermissionChecker(permission=None, require_role=True)


def require_any_auth():
    """Require authentication only (for pending users to view status)"""
    return PermissionChecker(permission=None, require_role=False)


# Specific permission checkers
require_crm_accounts_view = PermissionChecker("crm.accounts.view")
require_crm_accounts_edit = PermissionChecker("crm.accounts.edit")
require_crm_opportunities_view = PermissionChecker("crm.opportunities.view")
require_datalake_view = PermissionChecker("datalake.raw.view")
require_integrations_view = PermissionChecker("integrations.odoo.view")
require_fieldmapping_view = PermissionChecker("fieldmapping.view")
require_fieldmapping_edit = PermissionChecker("fieldmapping.edit")


async def get_user_data_filter(token_data: dict) -> dict:
    """
    Get MongoDB query filter based on user's data scope.
    Call this in routes to filter data appropriately.
    """
    db = Database.get_db()
    rbac = RBACService(db)
    
    user = token_data.get("user")
    if not user:
        user = await rbac.get_user_with_role(token_data["id"])
    
    if not user:
        return {"_blocked": True}  # Block all data
    
    # Super admin sees all
    if user.is_super_admin or user.data_scope == "all":
        return {}
    
    # Get team/department members if needed
    if user.data_scope == "own":
        return {"$or": [
            {"assigned_to": user.id},
            {"owner_id": user.id},
            {"created_by": user.id},
            {"user_id": user.id}
        ]}
    
    if user.data_scope == "team" and user.department_id:
        # Get users in same department
        cursor = db.users.find(
            {"department_id": user.department_id, "is_active": True},
            {"id": 1}
        )
        team_ids = [u["id"] async for u in cursor]
        return {"$or": [
            {"assigned_to": {"$in": team_ids}},
            {"owner_id": {"$in": team_ids}},
            {"created_by": {"$in": team_ids}}
        ]}
    
    if user.data_scope == "department" and user.department_id:
        return {"department_id": user.department_id}
    
    # Default: own only
    return {"assigned_to": user.id}
