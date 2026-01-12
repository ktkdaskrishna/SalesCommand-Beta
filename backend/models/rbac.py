"""
RBAC Models
Configurable Role-Based Access Control models
All roles and permissions are database-driven, not hardcoded
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from enum import Enum
import uuid


def generate_uuid() -> str:
    return str(uuid.uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


# ===================== DATA SCOPE =====================

class DataScope(str, Enum):
    """How much data a role can access"""
    OWN = "own"           # Only records assigned to user
    TEAM = "team"         # Records assigned to team members
    DEPARTMENT = "department"  # Records in same department
    ALL = "all"           # All records (no filter)


# ===================== PERMISSION MODEL =====================

class Permission(BaseModel):
    """
    Individual permission definition.
    Stored in 'permissions' collection.
    """
    id: str = Field(default_factory=generate_uuid)
    code: str                    # e.g., "crm.accounts.view"
    name: str                    # e.g., "View Accounts"
    description: Optional[str] = None
    module: str                  # e.g., "crm", "admin", "integrations"
    resource: str                # e.g., "accounts", "users", "sync"
    action: str                  # e.g., "view", "create", "edit", "delete"
    is_active: bool = True
    created_at: datetime = Field(default_factory=utc_now)

    class Config:
        use_enum_values = True


# ===================== ROLE MODEL =====================

class Role(BaseModel):
    """
    Role definition with associated permissions.
    Stored in 'roles' collection.
    Fully configurable by Super Admin.
    """
    id: str = Field(default_factory=generate_uuid)
    code: str                    # e.g., "account_manager"
    name: str                    # e.g., "Account Manager"
    description: Optional[str] = None
    data_scope: DataScope = DataScope.OWN  # Default data visibility
    permissions: List[str] = []  # List of permission codes
    is_system: bool = False      # System roles can't be deleted
    is_active: bool = True
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    class Config:
        use_enum_values = True


# ===================== DEPARTMENT MODEL =====================

class Department(BaseModel):
    """
    Department definition.
    Stored in 'departments' collection.
    """
    id: str = Field(default_factory=generate_uuid)
    code: str                    # e.g., "sales"
    name: str                    # e.g., "Sales"
    description: Optional[str] = None
    parent_id: Optional[str] = None  # For hierarchy
    manager_id: Optional[str] = None  # Department head
    is_active: bool = True
    created_at: datetime = Field(default_factory=utc_now)

    class Config:
        use_enum_values = True


# ===================== USER MODEL (Enhanced) =====================

class User(BaseModel):
    """
    User with configurable role assignment.
    Role comes from 'roles' collection, not hardcoded enum.
    """
    id: str = Field(default_factory=generate_uuid)
    email: str
    name: str
    password_hash: str = ""
    
    # Role & Access (database-driven)
    role_id: Optional[str] = None        # Reference to roles collection
    department_id: Optional[str] = None  # Reference to departments collection
    is_super_admin: bool = False         # Admin privilege (separate from role)
    is_active: bool = True
    
    # Microsoft Identity (for SSO users)
    ms_id: Optional[str] = None
    ms_access_token: Optional[str] = None
    auth_provider: Optional[str] = None  # "local" or "microsoft"
    
    # Organization
    manager_id: Optional[str] = None
    team_id: Optional[str] = None
    job_title: Optional[str] = None
    
    # Metadata
    avatar_url: Optional[str] = None
    last_login: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    class Config:
        use_enum_values = True


# ===================== USER WITH RESOLVED ROLE =====================

class UserWithRole(BaseModel):
    """User with role and permissions resolved from database"""
    id: str
    email: str
    name: str
    role_id: Optional[str] = None
    role_code: Optional[str] = None
    role_name: Optional[str] = None
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    is_super_admin: bool = False
    is_active: bool = True
    data_scope: str = "own"
    permissions: List[str] = []  # Resolved permission codes
    job_title: Optional[str] = None
    avatar_url: Optional[str] = None


# ===================== O365 FIELD MAPPING =====================

class O365FieldMapping(BaseModel):
    """
    Field mapping configuration for O365 entities.
    Stored in 'field_mappings' collection with integration_type='ms365'.
    """
    id: str = Field(default_factory=generate_uuid)
    integration_type: str = "ms365"
    entity_type: str              # "user_directory", "outlook_contact"
    name: str                     # e.g., "Default User Directory Mapping"
    description: Optional[str] = None
    mappings: List[Dict[str, Any]] = []  # [{source_field, target_field, transform}]
    is_active: bool = True
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


# ===================== USER PERSONAL DATA =====================

class UserEmail(BaseModel):
    """
    Personal email record - scoped to owner only.
    Stored in 'user_emails' collection.
    """
    id: str = Field(default_factory=generate_uuid)
    owner_user_id: str           # CRITICAL: Only owner can access
    ms_email_id: str             # Microsoft Graph email ID
    subject: str = ""
    from_email: str = ""
    from_name: str = ""
    to_recipients: List[str] = []
    received_at: Optional[datetime] = None
    body_preview: str = ""
    has_attachments: bool = False
    is_read: bool = False
    importance: str = "normal"
    web_link: str = ""
    synced_at: datetime = Field(default_factory=utc_now)


class UserCalendarEvent(BaseModel):
    """
    Personal calendar event - scoped to owner only.
    Stored in 'user_calendar' collection.
    """
    id: str = Field(default_factory=generate_uuid)
    owner_user_id: str           # CRITICAL: Only owner can access
    ms_event_id: str             # Microsoft Graph event ID
    subject: str = ""
    organizer_email: str = ""
    organizer_name: str = ""
    attendees: List[Dict[str, Any]] = []
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    location: str = ""
    is_all_day: bool = False
    is_cancelled: bool = False
    web_link: str = ""
    online_meeting_url: str = ""
    synced_at: datetime = Field(default_factory=utc_now)


# ===================== REQUEST/RESPONSE MODELS =====================

class RoleCreateRequest(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    data_scope: str = "own"
    permissions: List[str] = []


class RoleUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    data_scope: Optional[str] = None
    permissions: Optional[List[str]] = None
    is_active: Optional[bool] = None


class UserCreateRequest(BaseModel):
    email: str
    name: str
    password: Optional[str] = None
    role_id: Optional[str] = None
    department_id: Optional[str] = None
    is_super_admin: bool = False
    job_title: Optional[str] = None


class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    role_id: Optional[str] = None
    department_id: Optional[str] = None
    is_super_admin: Optional[bool] = None
    is_active: Optional[bool] = None
    job_title: Optional[str] = None


class DepartmentCreateRequest(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    parent_id: Optional[str] = None
    manager_id: Optional[str] = None
