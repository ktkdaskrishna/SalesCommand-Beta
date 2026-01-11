"""
Core Enumerations for Sales Intelligence Platform
"""

from enum import Enum


class DataZone(str, Enum):
    """Data Lake zones"""
    RAW = "raw"
    CANONICAL = "canonical"
    SERVING = "serving"


class SyncStatus(str, Enum):
    """Sync operation status"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"
    CANCELLED = "cancelled"


class SyncMode(str, Enum):
    """Sync operation modes"""
    FULL = "full"
    INCREMENTAL = "incremental"
    MANUAL = "manual"
    SCHEDULED = "scheduled"
    REPLAY = "replay"


class EntityType(str, Enum):
    """Canonical entity types"""
    CONTACT = "contact"
    ACCOUNT = "account"
    OPPORTUNITY = "opportunity"
    ACTIVITY = "activity"
    USER = "user"


class UserRole(str, Enum):
    """User roles for RBAC"""
    SUPER_ADMIN = "super_admin"
    CEO = "ceo"
    HOD = "hod"  # Head of Department
    SALES_DIRECTOR = "sales_director"
    SALES_MANAGER = "sales_manager"
    ACCOUNT_MANAGER = "account_manager"
    SALES_REP = "sales_rep"
    ANALYST = "analyst"
    VIEWER = "viewer"


class IntegrationSource(str, Enum):
    """Supported integration sources"""
    ODOO = "odoo"
    MICROSOFT365 = "ms365"
    SALESFORCE = "salesforce"
    HUBSPOT = "hubspot"
    SAP = "sap"
    CUSTOM_REST = "custom_rest"
    LOCAL = "local"


class OpportunityStage(str, Enum):
    """Standard opportunity stages"""
    LEAD = "lead"
    QUALIFICATION = "qualification"
    DISCOVERY = "discovery"
    PROPOSAL = "proposal"
    NEGOTIATION = "negotiation"
    CLOSED_WON = "closed_won"
    CLOSED_LOST = "closed_lost"


class ActivityType(str, Enum):
    """Activity types"""
    TASK = "task"
    MEETING = "meeting"
    CALL = "call"
    EMAIL = "email"
    PRESENTATION = "presentation"
    DEMO = "demo"
    FOLLOW_UP = "follow_up"


class ActivityStatus(str, Enum):
    """Activity status"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    OVERDUE = "overdue"


class Priority(str, Enum):
    """Priority levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class VisibilityScope(str, Enum):
    """Data visibility scopes for RBAC"""
    OWN = "own"  # User's own records only
    TEAM = "team"  # User's team records
    DEPARTMENT = "department"  # User's department records
    ALL = "all"  # All records (admin/CEO)
