"""
Admin Routes
API endpoints for Super Admin functionality
- User Management
- Role & Permission Management
- Department Management
- System Configuration
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone

from models.rbac import (
    RoleCreateRequest, RoleUpdateRequest,
    UserCreateRequest, UserUpdateRequest,
    DepartmentCreateRequest
)
from services.rbac.service import RBACService
from services.auth.jwt_handler import get_current_user_from_token, hash_password
from core.database import Database

router = APIRouter(prefix="/admin", tags=["Admin"])


# ===================== MIDDLEWARE =====================

async def require_super_admin(token_data: dict = Depends(get_current_user_from_token)):
    """Require super admin privileges"""
    db = Database.get_db()
    user = await db.users.find_one({"id": token_data["id"]}, {"is_super_admin": 1})
    
    if not user or not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    return token_data


# ===================== PERMISSIONS =====================

@router.get("/permissions")
async def get_all_permissions(token_data: dict = Depends(require_super_admin)):
    """Get all available permissions"""
    db = Database.get_db()
    rbac = RBACService(db)
    permissions = await rbac.get_all_permissions()
    
    # Group by module
    grouped = {}
    for perm in permissions:
        module = perm.get("module", "other")
        if module not in grouped:
            grouped[module] = []
        grouped[module].append(perm)
    
    return {"permissions": permissions, "grouped": grouped}


class PermissionCreateRequest(BaseModel):
    code: str
    name: str
    module: str
    resource: str
    action: str
    description: Optional[str] = None


@router.post("/permissions")
async def create_permission(
    request: PermissionCreateRequest,
    token_data: dict = Depends(require_super_admin)
):
    """Create a new custom permission"""
    db = Database.get_db()
    
    # Check if code exists
    existing = await db.permissions.find_one({"code": request.code})
    if existing:
        raise HTTPException(status_code=400, detail="Permission code already exists")
    
    now = datetime.now(timezone.utc)
    permission = {
        "id": str(__import__("uuid").uuid4()),
        "code": request.code,
        "name": request.name,
        "module": request.module,
        "resource": request.resource,
        "action": request.action,
        "description": request.description,
        "is_active": True,
        "is_custom": True,  # Mark as custom permission
        "created_at": now,
        "created_by": token_data["id"]
    }
    
    await db.permissions.insert_one(permission)
    del permission["_id"]
    return {"message": "Permission created", "permission": permission}


@router.delete("/permissions/{perm_id}")
async def delete_permission(
    perm_id: str,
    token_data: dict = Depends(require_super_admin)
):
    """Delete a custom permission"""
    db = Database.get_db()
    
    perm = await db.permissions.find_one({"id": perm_id})
    if not perm:
        raise HTTPException(status_code=404, detail="Permission not found")
    
    if not perm.get("is_custom"):
        raise HTTPException(status_code=400, detail="Cannot delete system permissions")
    
    await db.permissions.delete_one({"id": perm_id})
    return {"message": "Permission deleted"}


@router.get("/permissions/{module}")
async def get_permissions_by_module(
    module: str,
    token_data: dict = Depends(require_super_admin)
):
    """Get permissions for a specific module"""
    db = Database.get_db()
    rbac = RBACService(db)
    return await rbac.get_permissions_by_module(module)


# ===================== ROLES =====================

@router.get("/roles")
async def get_all_roles(token_data: dict = Depends(require_super_admin)):
    """Get all roles with their permissions"""
    db = Database.get_db()
    rbac = RBACService(db)
    roles = await rbac.get_all_roles()
    return {"roles": roles, "count": len(roles)}


@router.get("/roles/{role_id}")
async def get_role(role_id: str, token_data: dict = Depends(require_super_admin)):
    """Get a specific role"""
    db = Database.get_db()
    rbac = RBACService(db)
    role = await rbac.get_role_by_id(role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return role


@router.post("/roles")
async def create_role(
    request: RoleCreateRequest,
    token_data: dict = Depends(require_super_admin)
):
    """Create a new role"""
    db = Database.get_db()
    rbac = RBACService(db)
    
    # Check if code exists
    existing = await rbac.get_role_by_code(request.code)
    if existing:
        raise HTTPException(status_code=400, detail="Role code already exists")
    
    role = await rbac.create_role(request, token_data["id"])
    return {"message": "Role created", "role": role}


@router.put("/roles/{role_id}")
async def update_role(
    role_id: str,
    request: RoleUpdateRequest,
    token_data: dict = Depends(require_super_admin)
):
    """Update a role"""
    db = Database.get_db()
    rbac = RBACService(db)
    
    role = await rbac.get_role_by_id(role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    updates = {k: v for k, v in request.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")
    
    success = await rbac.update_role(role_id, updates)
    return {"message": "Role updated" if success else "No changes made"}


@router.delete("/roles/{role_id}")
async def delete_role(role_id: str, token_data: dict = Depends(require_super_admin)):
    """Delete a role"""
    db = Database.get_db()
    rbac = RBACService(db)
    
    role = await rbac.get_role_by_id(role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    if role.get("is_system"):
        raise HTTPException(status_code=400, detail="Cannot delete system roles")
    
    # Check if any users have this role
    user_count = await db.users.count_documents({"role_id": role_id})
    if user_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete role: {user_count} users have this role"
        )
    
    success = await rbac.delete_role(role_id)
    return {"message": "Role deleted" if success else "Failed to delete role"}


# ===================== DEPARTMENTS =====================

@router.get("/departments")
async def get_all_departments(token_data: dict = Depends(require_super_admin)):
    """Get all departments"""
    db = Database.get_db()
    rbac = RBACService(db)
    departments = await rbac.get_all_departments()
    return {"departments": departments, "count": len(departments)}


@router.post("/departments")
async def create_department(
    request: DepartmentCreateRequest,
    token_data: dict = Depends(require_super_admin)
):
    """Create a new department"""
    db = Database.get_db()
    
    # Check if code exists
    existing = await db.departments.find_one({"code": request.code})
    if existing:
        raise HTTPException(status_code=400, detail="Department code already exists")
    
    now = datetime.now(timezone.utc)
    department = {
        "id": str(__import__("uuid").uuid4()),
        "code": request.code,
        "name": request.name,
        "description": request.description,
        "parent_id": request.parent_id,
        "manager_id": request.manager_id,
        "is_active": True,
        "created_at": now
    }
    
    await db.departments.insert_one(department)
    del department["_id"]
    return {"message": "Department created", "department": department}


@router.put("/departments/{dept_id}")
async def update_department(
    dept_id: str,
    name: Optional[str] = None,
    description: Optional[str] = None,
    manager_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    token_data: dict = Depends(require_super_admin)
):
    """Update a department"""
    db = Database.get_db()
    
    updates = {}
    if name is not None:
        updates["name"] = name
    if description is not None:
        updates["description"] = description
    if manager_id is not None:
        updates["manager_id"] = manager_id
    if is_active is not None:
        updates["is_active"] = is_active
    
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")
    
    result = await db.departments.update_one({"id": dept_id}, {"$set": updates})
    return {"message": "Department updated" if result.modified_count else "No changes made"}


# ===================== USER MANAGEMENT =====================

@router.get("/users")
async def get_all_users(
    role_id: Optional[str] = None,
    department_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    token_data: dict = Depends(require_super_admin)
):
    """Get all users with optional filters"""
    db = Database.get_db()
    rbac = RBACService(db)
    
    query = {}
    if role_id:
        query["role_id"] = role_id
    if department_id:
        query["department_id"] = department_id
    if is_active is not None:
        query["is_active"] = is_active
    
    cursor = db.users.find(query, {"_id": 0, "password_hash": 0, "ms_access_token": 0})
    users = await cursor.to_list(500)
    
    # Resolve role and department names
    roles = {r["id"]: r for r in await rbac.get_all_roles()}
    depts = {d["id"]: d for d in await rbac.get_all_departments()}
    
    for user in users:
        if user.get("role_id") and user["role_id"] in roles:
            user["role_name"] = roles[user["role_id"]].get("name")
            user["role_code"] = roles[user["role_id"]].get("code")
        if user.get("department_id") and user["department_id"] in depts:
            user["department_name"] = depts[user["department_id"]].get("name")
    
    return {"users": users, "count": len(users)}


@router.get("/users/{user_id}")
async def get_user(user_id: str, token_data: dict = Depends(require_super_admin)):
    """Get a specific user with resolved role"""
    db = Database.get_db()
    rbac = RBACService(db)
    
    user_with_role = await rbac.get_user_with_role(user_id)
    if not user_with_role:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user_with_role.model_dump()


@router.post("/users")
async def create_user(
    request: UserCreateRequest,
    token_data: dict = Depends(require_super_admin)
):
    """Create a new user"""
    db = Database.get_db()
    
    # Check if email exists
    existing = await db.users.find_one({"email": request.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate role if provided
    if request.role_id:
        role = await db.roles.find_one({"id": request.role_id})
        if not role:
            raise HTTPException(status_code=400, detail="Invalid role_id")
    
    # Validate department if provided
    if request.department_id:
        dept = await db.departments.find_one({"id": request.department_id})
        if not dept:
            raise HTTPException(status_code=400, detail="Invalid department_id")
    
    now = datetime.now(timezone.utc)
    user = {
        "id": str(__import__("uuid").uuid4()),
        "email": request.email,
        "name": request.name,
        "password_hash": hash_password(request.password) if request.password else "",
        "role_id": request.role_id,
        "department_id": request.department_id,
        "is_super_admin": request.is_super_admin,
        "is_active": True,
        "job_title": request.job_title,
        "auth_provider": "local",
        "created_at": now,
        "updated_at": now
    }
    
    await db.users.insert_one(user)
    
    # Return without sensitive data
    del user["_id"]
    del user["password_hash"]
    return {"message": "User created", "user": user}


@router.put("/users/{user_id}")
async def update_user(
    user_id: str,
    request: UserUpdateRequest,
    token_data: dict = Depends(require_super_admin)
):
    """Update a user"""
    db = Database.get_db()
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    updates = {k: v for k, v in request.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")
    
    # Validate role if being updated
    if "role_id" in updates and updates["role_id"]:
        role = await db.roles.find_one({"id": updates["role_id"]})
        if not role:
            raise HTTPException(status_code=400, detail="Invalid role_id")
    
    # Validate department if being updated
    if "department_id" in updates and updates["department_id"]:
        dept = await db.departments.find_one({"id": updates["department_id"]})
        if not dept:
            raise HTTPException(status_code=400, detail="Invalid department_id")
    
    updates["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.users.update_one({"id": user_id}, {"$set": updates})
    return {"message": "User updated" if result.modified_count else "No changes made"}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, token_data: dict = Depends(require_super_admin)):
    """Deactivate a user (soft delete)"""
    db = Database.get_db()
    
    if user_id == token_data["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Soft delete
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}}
    )
    return {"message": "User deactivated" if result.modified_count else "No changes made"}


# ===================== BULK OPERATIONS =====================

@router.post("/users/bulk-assign-role")
async def bulk_assign_role(
    user_ids: List[str],
    role_id: str,
    token_data: dict = Depends(require_super_admin)
):
    """Assign role to multiple users"""
    db = Database.get_db()
    
    # Validate role
    role = await db.roles.find_one({"id": role_id})
    if not role:
        raise HTTPException(status_code=400, detail="Invalid role_id")
    
    result = await db.users.update_many(
        {"id": {"$in": user_ids}},
        {"$set": {"role_id": role_id, "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {
        "message": f"Updated {result.modified_count} users",
        "role_name": role.get("name")
    }


@router.post("/users/bulk-assign-department")
async def bulk_assign_department(
    user_ids: List[str],
    department_id: str,
    token_data: dict = Depends(require_super_admin)
):
    """Assign department to multiple users"""
    db = Database.get_db()
    
    # Validate department
    dept = await db.departments.find_one({"id": department_id})
    if not dept:
        raise HTTPException(status_code=400, detail="Invalid department_id")
    
    result = await db.users.update_many(
        {"id": {"$in": user_ids}},
        {"$set": {"department_id": department_id, "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {
        "message": f"Updated {result.modified_count} users",
        "department_name": dept.get("name")
    }


# ===================== CURRENT USER ROLE INFO =====================

@router.get("/me/permissions")
async def get_my_permissions(token_data: dict = Depends(get_current_user_from_token)):
    """Get current user's resolved permissions"""
    db = Database.get_db()
    rbac = RBACService(db)
    
    user_with_role = await rbac.get_user_with_role(token_data["id"])
    if not user_with_role:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "user_id": user_with_role.id,
        "role_code": user_with_role.role_code,
        "role_name": user_with_role.role_name,
        "is_super_admin": user_with_role.is_super_admin,
        "data_scope": user_with_role.data_scope,
        "permissions": user_with_role.permissions
    }


# ===================== AZURE AD USER DIRECTORY SYNC =====================

@router.post("/sync-azure-users")
async def sync_azure_ad_users(
    token_data: dict = Depends(require_super_admin)
):
    """
    Sync users from Azure AD directory into the application.
    This syncs ONLY identity information (name, email, department, job title).
    Does NOT sync personal emails, calendar, or files.
    
    Uses the most recently logged-in MS365 user's token.
    For full directory sync, admin consent with User.Read.All is required.
    """
    from services.ms365.connector import MS365Connector
    import uuid
    
    db = Database.get_db()
    
    # Get MS365 token from any user who has logged in via SSO
    ms_user = await db.users.find_one(
        {"ms_access_token": {"$exists": True, "$ne": ""}},
        {"ms_access_token": 1},
        sort=[("last_login", -1)]
    )
    
    if not ms_user or not ms_user.get("ms_access_token"):
        raise HTTPException(
            status_code=400,
            detail="No Microsoft 365 token available. A user must first login with Microsoft SSO."
        )
    
    try:
        async with MS365Connector(ms_user["ms_access_token"]) as connector:
            # Fetch users from Azure AD
            ad_users = await connector.get_organization_users(top=200)
            
            now = datetime.now(timezone.utc)
            created = 0
            updated = 0
            skipped = 0
            
            for ad_user in ad_users:
                email = ad_user.get("email")
                if not email:
                    skipped += 1
                    continue
                
                # Check if user exists
                existing = await db.users.find_one({"email": email})
                
                # Try to match department from our departments collection
                dept_id = None
                if ad_user.get("department"):
                    dept = await db.departments.find_one({
                        "$or": [
                            {"name": {"$regex": ad_user["department"], "$options": "i"}},
                            {"code": {"$regex": ad_user["department"], "$options": "i"}}
                        ]
                    })
                    if dept:
                        dept_id = dept["id"]
                
                if existing:
                    # Update existing user with Azure AD info
                    updates = {
                        "ms_id": ad_user.get("ms_id"),
                        "name": ad_user.get("display_name") or existing.get("name"),
                        "job_title": ad_user.get("job_title") or existing.get("job_title"),
                        "updated_at": now
                    }
                    
                    # Only update department if we found a match
                    if dept_id:
                        updates["department_id"] = dept_id
                    
                    await db.users.update_one({"email": email}, {"$set": updates})
                    updated += 1
                else:
                    # Create new user (without password - SSO only)
                    new_user = {
                        "id": str(uuid.uuid4()),
                        "email": email,
                        "name": ad_user.get("display_name", email.split("@")[0]),
                        "password_hash": "",
                        "ms_id": ad_user.get("ms_id"),
                        "job_title": ad_user.get("job_title"),
                        "department_id": dept_id,
                        "role_id": None,  # Super admin assigns role later
                        "is_super_admin": False,
                        "is_active": ad_user.get("is_active", True),
                        "auth_provider": "microsoft",
                        "created_at": now,
                        "updated_at": now
                    }
                    await db.users.insert_one(new_user)
                    created += 1
            
            return {
                "message": "Azure AD user sync completed",
                "total_fetched": len(ad_users),
                "created": created,
                "updated": updated,
                "skipped": skipped
            }
            
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to sync Azure AD users: {str(e)}"
        )
