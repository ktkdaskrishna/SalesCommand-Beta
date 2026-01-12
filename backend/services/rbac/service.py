"""
RBAC Service
Handles role-based access control, permission checks, and data filtering
All roles/permissions are database-driven
"""
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorDatabase
from models.rbac import (
    Role, Permission, Department, User, UserWithRole,
    DataScope, RoleCreateRequest, UserCreateRequest
)

logger = logging.getLogger(__name__)


class RBACService:
    """
    Role-Based Access Control Service.
    All roles and permissions are stored in database, fully configurable.
    """
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self._permission_cache: Dict[str, List[str]] = {}
        self._role_cache: Dict[str, Dict] = {}
    
    # ===================== PERMISSION MANAGEMENT =====================
    
    async def get_all_permissions(self) -> List[Dict[str, Any]]:
        """Get all available permissions"""
        cursor = self.db.permissions.find({"is_active": True}, {"_id": 0})
        return await cursor.to_list(500)
    
    async def get_permissions_by_module(self, module: str) -> List[Dict[str, Any]]:
        """Get permissions for a specific module"""
        cursor = self.db.permissions.find(
            {"module": module, "is_active": True}, 
            {"_id": 0}
        )
        return await cursor.to_list(100)
    
    async def seed_default_permissions(self):
        """Seed default permissions if none exist"""
        count = await self.db.permissions.count_documents({})
        if count > 0:
            logger.info(f"Permissions already exist ({count}), skipping seed")
            return
        
        default_permissions = [
            # CRM - Accounts
            {"code": "crm.accounts.view", "name": "View Accounts", "module": "crm", "resource": "accounts", "action": "view"},
            {"code": "crm.accounts.create", "name": "Create Accounts", "module": "crm", "resource": "accounts", "action": "create"},
            {"code": "crm.accounts.edit", "name": "Edit Accounts", "module": "crm", "resource": "accounts", "action": "edit"},
            {"code": "crm.accounts.delete", "name": "Delete Accounts", "module": "crm", "resource": "accounts", "action": "delete"},
            
            # CRM - Contacts
            {"code": "crm.contacts.view", "name": "View Contacts", "module": "crm", "resource": "contacts", "action": "view"},
            {"code": "crm.contacts.create", "name": "Create Contacts", "module": "crm", "resource": "contacts", "action": "create"},
            {"code": "crm.contacts.edit", "name": "Edit Contacts", "module": "crm", "resource": "contacts", "action": "edit"},
            {"code": "crm.contacts.delete", "name": "Delete Contacts", "module": "crm", "resource": "contacts", "action": "delete"},
            
            # CRM - Opportunities
            {"code": "crm.opportunities.view", "name": "View Opportunities", "module": "crm", "resource": "opportunities", "action": "view"},
            {"code": "crm.opportunities.create", "name": "Create Opportunities", "module": "crm", "resource": "opportunities", "action": "create"},
            {"code": "crm.opportunities.edit", "name": "Edit Opportunities", "module": "crm", "resource": "opportunities", "action": "edit"},
            {"code": "crm.opportunities.delete", "name": "Delete Opportunities", "module": "crm", "resource": "opportunities", "action": "delete"},
            
            # CRM - Orders
            {"code": "crm.orders.view", "name": "View Orders", "module": "crm", "resource": "orders", "action": "view"},
            {"code": "crm.orders.create", "name": "Create Orders", "module": "crm", "resource": "orders", "action": "create"},
            {"code": "crm.orders.edit", "name": "Edit Orders", "module": "crm", "resource": "orders", "action": "edit"},
            
            # CRM - Invoices
            {"code": "crm.invoices.view", "name": "View Invoices", "module": "crm", "resource": "invoices", "action": "view"},
            
            # Data Lake
            {"code": "datalake.raw.view", "name": "View Raw Zone", "module": "datalake", "resource": "raw", "action": "view"},
            {"code": "datalake.canonical.view", "name": "View Canonical Zone", "module": "datalake", "resource": "canonical", "action": "view"},
            {"code": "datalake.serving.view", "name": "View Serving Zone", "module": "datalake", "resource": "serving", "action": "view"},
            
            # Integrations
            {"code": "integrations.odoo.view", "name": "View Odoo Integration", "module": "integrations", "resource": "odoo", "action": "view"},
            {"code": "integrations.odoo.configure", "name": "Configure Odoo", "module": "integrations", "resource": "odoo", "action": "configure"},
            {"code": "integrations.odoo.sync", "name": "Run Odoo Sync", "module": "integrations", "resource": "odoo", "action": "sync"},
            {"code": "integrations.ms365.view", "name": "View MS365 Integration", "module": "integrations", "resource": "ms365", "action": "view"},
            {"code": "integrations.ms365.configure", "name": "Configure MS365", "module": "integrations", "resource": "ms365", "action": "configure"},
            {"code": "integrations.ms365.sync_directory", "name": "Sync User Directory", "module": "integrations", "resource": "ms365", "action": "sync_directory"},
            
            # Field Mapping
            {"code": "fieldmapping.view", "name": "View Field Mappings", "module": "fieldmapping", "resource": "mappings", "action": "view"},
            {"code": "fieldmapping.edit", "name": "Edit Field Mappings", "module": "fieldmapping", "resource": "mappings", "action": "edit"},
            
            # Personal Data (user's own)
            {"code": "personal.emails.view", "name": "View Own Emails", "module": "personal", "resource": "emails", "action": "view"},
            {"code": "personal.calendar.view", "name": "View Own Calendar", "module": "personal", "resource": "calendar", "action": "view"},
            {"code": "personal.contacts.view", "name": "View Own Outlook Contacts", "module": "personal", "resource": "contacts", "action": "view"},
            
            # Admin - Users
            {"code": "admin.users.view", "name": "View Users", "module": "admin", "resource": "users", "action": "view"},
            {"code": "admin.users.create", "name": "Create Users", "module": "admin", "resource": "users", "action": "create"},
            {"code": "admin.users.edit", "name": "Edit Users", "module": "admin", "resource": "users", "action": "edit"},
            {"code": "admin.users.delete", "name": "Delete Users", "module": "admin", "resource": "users", "action": "delete"},
            
            # Admin - Roles
            {"code": "admin.roles.view", "name": "View Roles", "module": "admin", "resource": "roles", "action": "view"},
            {"code": "admin.roles.create", "name": "Create Roles", "module": "admin", "resource": "roles", "action": "create"},
            {"code": "admin.roles.edit", "name": "Edit Roles", "module": "admin", "resource": "roles", "action": "edit"},
            {"code": "admin.roles.delete", "name": "Delete Roles", "module": "admin", "resource": "roles", "action": "delete"},
            
            # Admin - Departments
            {"code": "admin.departments.view", "name": "View Departments", "module": "admin", "resource": "departments", "action": "view"},
            {"code": "admin.departments.manage", "name": "Manage Departments", "module": "admin", "resource": "departments", "action": "manage"},
            
            # Admin - System
            {"code": "admin.system.view", "name": "View System Config", "module": "admin", "resource": "system", "action": "view"},
            {"code": "admin.system.edit", "name": "Edit System Config", "module": "admin", "resource": "system", "action": "edit"},
        ]
        
        now = datetime.now(timezone.utc)
        for perm in default_permissions:
            perm["id"] = str(__import__("uuid").uuid4())
            perm["is_active"] = True
            perm["created_at"] = now
        
        await self.db.permissions.insert_many(default_permissions)
        logger.info(f"Seeded {len(default_permissions)} default permissions")
    
    # ===================== ROLE MANAGEMENT =====================
    
    async def get_all_roles(self) -> List[Dict[str, Any]]:
        """Get all roles"""
        cursor = self.db.roles.find({}, {"_id": 0})
        return await cursor.to_list(100)
    
    async def get_role_by_id(self, role_id: str) -> Optional[Dict[str, Any]]:
        """Get role by ID with caching"""
        if role_id in self._role_cache:
            return self._role_cache[role_id]
        
        role = await self.db.roles.find_one({"id": role_id}, {"_id": 0})
        if role:
            self._role_cache[role_id] = role
        return role
    
    async def get_role_by_code(self, code: str) -> Optional[Dict[str, Any]]:
        """Get role by code"""
        return await self.db.roles.find_one({"code": code}, {"_id": 0})
    
    async def create_role(self, data: RoleCreateRequest, created_by: str) -> Dict[str, Any]:
        """Create a new role"""
        now = datetime.now(timezone.utc)
        role = {
            "id": str(__import__("uuid").uuid4()),
            "code": data.code,
            "name": data.name,
            "description": data.description,
            "data_scope": data.data_scope,
            "permissions": data.permissions,
            "is_system": False,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
            "created_by": created_by
        }
        await self.db.roles.insert_one(role)
        logger.info(f"Created role: {data.code}")
        return {k: v for k, v in role.items() if k != "_id"}
    
    async def update_role(self, role_id: str, updates: Dict[str, Any]) -> bool:
        """Update a role"""
        updates["updated_at"] = datetime.now(timezone.utc)
        result = await self.db.roles.update_one(
            {"id": role_id},
            {"$set": updates}
        )
        # Clear cache
        self._role_cache.pop(role_id, None)
        return result.modified_count > 0
    
    async def delete_role(self, role_id: str) -> bool:
        """Delete a role (soft delete for system roles)"""
        role = await self.get_role_by_id(role_id)
        if role and role.get("is_system"):
            # Soft delete system roles
            return await self.update_role(role_id, {"is_active": False})
        
        result = await self.db.roles.delete_one({"id": role_id})
        self._role_cache.pop(role_id, None)
        return result.deleted_count > 0
    
    async def seed_default_roles(self):
        """Seed default roles if none exist"""
        count = await self.db.roles.count_documents({})
        if count > 0:
            logger.info(f"Roles already exist ({count}), skipping seed")
            return
        
        default_roles = [
            {
                "code": "super_admin",
                "name": "Super Admin",
                "description": "Full system access with user management",
                "data_scope": "all",
                "permissions": ["*"],  # All permissions
                "is_system": True
            },
            {
                "code": "ceo",
                "name": "CEO",
                "description": "Executive access with company-wide visibility",
                "data_scope": "all",
                "permissions": [
                    "crm.accounts.view", "crm.contacts.view", "crm.opportunities.view",
                    "crm.orders.view", "crm.invoices.view",
                    "datalake.serving.view", "datalake.canonical.view",
                    "integrations.odoo.view", "integrations.ms365.view",
                    "personal.emails.view", "personal.calendar.view"
                ],
                "is_system": True
            },
            {
                "code": "sales_director",
                "name": "Sales Director",
                "description": "Sales team management with full CRM access",
                "data_scope": "all",
                "permissions": [
                    "crm.accounts.view", "crm.accounts.create", "crm.accounts.edit",
                    "crm.contacts.view", "crm.contacts.create", "crm.contacts.edit",
                    "crm.opportunities.view", "crm.opportunities.create", "crm.opportunities.edit",
                    "crm.orders.view", "crm.orders.create",
                    "datalake.serving.view",
                    "integrations.odoo.view", "integrations.odoo.sync",
                    "personal.emails.view", "personal.calendar.view"
                ],
                "is_system": True
            },
            {
                "code": "product_director",
                "name": "Product Director",
                "description": "Product oversight with read access",
                "data_scope": "all",
                "permissions": [
                    "crm.accounts.view", "crm.contacts.view", "crm.opportunities.view",
                    "crm.orders.view", "datalake.serving.view",
                    "personal.emails.view", "personal.calendar.view"
                ],
                "is_system": True
            },
            {
                "code": "account_manager",
                "name": "Account Manager",
                "description": "Manages assigned accounts and opportunities",
                "data_scope": "own",
                "permissions": [
                    "crm.accounts.view", "crm.accounts.create", "crm.accounts.edit",
                    "crm.contacts.view", "crm.contacts.create", "crm.contacts.edit",
                    "crm.opportunities.view", "crm.opportunities.create", "crm.opportunities.edit",
                    "crm.orders.view", "crm.orders.create",
                    "personal.emails.view", "personal.calendar.view", "personal.contacts.view"
                ],
                "is_system": True
            },
            {
                "code": "presales",
                "name": "Presales",
                "description": "Technical presales support",
                "data_scope": "team",
                "permissions": [
                    "crm.accounts.view", "crm.contacts.view",
                    "crm.opportunities.view", "crm.opportunities.edit",
                    "personal.emails.view", "personal.calendar.view"
                ],
                "is_system": True
            },
            {
                "code": "strategy",
                "name": "Strategy Team",
                "description": "Strategic analysis and planning",
                "data_scope": "all",
                "permissions": [
                    "crm.accounts.view", "crm.contacts.view", "crm.opportunities.view",
                    "crm.orders.view", "crm.invoices.view",
                    "datalake.serving.view", "datalake.canonical.view"
                ],
                "is_system": True
            }
        ]
        
        now = datetime.now(timezone.utc)
        for role in default_roles:
            role["id"] = str(__import__("uuid").uuid4())
            role["is_active"] = True
            role["created_at"] = now
            role["updated_at"] = now
        
        await self.db.roles.insert_many(default_roles)
        logger.info(f"Seeded {len(default_roles)} default roles")
    
    # ===================== DEPARTMENT MANAGEMENT =====================
    
    async def get_all_departments(self) -> List[Dict[str, Any]]:
        """Get all departments"""
        cursor = self.db.departments.find({"is_active": True}, {"_id": 0})
        return await cursor.to_list(100)
    
    async def seed_default_departments(self):
        """Seed default departments if none exist"""
        count = await self.db.departments.count_documents({})
        if count > 0:
            logger.info(f"Departments already exist ({count}), skipping seed")
            return
        
        default_departments = [
            {"code": "sales", "name": "Sales", "description": "Sales team"},
            {"code": "presales", "name": "Presales", "description": "Technical presales"},
            {"code": "product", "name": "Product", "description": "Product management"},
            {"code": "strategy", "name": "Strategy", "description": "Strategy and planning"},
            {"code": "operations", "name": "Operations", "description": "Operations team"},
        ]
        
        now = datetime.now(timezone.utc)
        for dept in default_departments:
            dept["id"] = str(__import__("uuid").uuid4())
            dept["is_active"] = True
            dept["created_at"] = now
        
        await self.db.departments.insert_many(default_departments)
        logger.info(f"Seeded {len(default_departments)} default departments")
    
    # ===================== USER ROLE RESOLUTION =====================
    
    async def get_user_with_role(self, user_id: str) -> Optional[UserWithRole]:
        """Get user with resolved role and permissions"""
        user = await self.db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
        if not user:
            return None
        
        # Resolve role
        role = None
        permissions = []
        data_scope = "own"
        role_code = None
        role_name = None
        
        if user.get("role_id"):
            role = await self.get_role_by_id(user["role_id"])
            if role:
                role_code = role.get("code")
                role_name = role.get("name")
                data_scope = role.get("data_scope", "own")
                permissions = role.get("permissions", [])
        
        # Super admin gets all permissions
        if user.get("is_super_admin"):
            permissions = ["*"]
            data_scope = "all"
        
        # Resolve department
        department_name = None
        if user.get("department_id"):
            dept = await self.db.departments.find_one({"id": user["department_id"]}, {"name": 1})
            if dept:
                department_name = dept.get("name")
        
        return UserWithRole(
            id=user["id"],
            email=user["email"],
            name=user.get("name", ""),
            role_id=user.get("role_id"),
            role_code=role_code,
            role_name=role_name,
            department_id=user.get("department_id"),
            department_name=department_name,
            is_super_admin=user.get("is_super_admin", False),
            is_active=user.get("is_active", True),
            data_scope=data_scope,
            permissions=permissions,
            job_title=user.get("job_title"),
            avatar_url=user.get("avatar_url")
        )
    
    # ===================== PERMISSION CHECKS =====================
    
    def has_permission(self, user: UserWithRole, permission_code: str) -> bool:
        """Check if user has a specific permission"""
        if not user.is_active:
            return False
        
        if user.is_super_admin or "*" in user.permissions:
            return True
        
        return permission_code in user.permissions
    
    def get_data_filter(self, user: UserWithRole, entity_type: str = None) -> Dict[str, Any]:
        """
        Get MongoDB query filter based on user's data scope.
        Returns filter to apply to queries.
        """
        if user.is_super_admin or user.data_scope == "all":
            return {}  # No filter - see all
        
        if user.data_scope == "own":
            return {"$or": [
                {"assigned_to": user.id},
                {"created_by": user.id},
                {"owner_id": user.id}
            ]}
        
        if user.data_scope == "team" and user.department_id:
            # Get team members (same department for now)
            # In production, this would be a proper team lookup
            return {"$or": [
                {"assigned_to": user.id},
                {"department_id": user.department_id}
            ]}
        
        if user.data_scope == "department" and user.department_id:
            return {"department_id": user.department_id}
        
        # Default: own only
        return {"assigned_to": user.id}
    
    # ===================== INITIALIZATION =====================
    
    async def initialize(self):
        """Initialize RBAC system with default data"""
        await self.seed_default_permissions()
        await self.seed_default_roles()
        await self.seed_default_departments()
        logger.info("RBAC system initialized")
