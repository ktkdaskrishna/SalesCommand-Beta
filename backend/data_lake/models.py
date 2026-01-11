"""
Canonical Data Models for Sales Intelligence Platform
These are the stable, normalized entities in the canonical zone.
"""

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Literal
from pydantic import Field, EmailStr
import uuid

from core.base import BaseEntity, SourceReference
from core.enums import (
    EntityType,
    OpportunityStage,
    ActivityType,
    ActivityStatus,
    Priority,
    UserRole,
    VisibilityScope,
)


class CanonicalContact(BaseEntity):
    """Canonical contact/person entity"""
    
    entity_type: Literal["contact"] = "contact"
    
    # Core Fields
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    
    # Company Association
    account_id: Optional[str] = None
    company_name: Optional[str] = None
    job_title: Optional[str] = None
    department: Optional[str] = None
    
    # Address
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    
    # Classification
    contact_type: Optional[str] = None  # customer, prospect, partner, vendor
    tags: List[str] = Field(default_factory=list)
    
    # Ownership
    owner_id: Optional[str] = None
    team_id: Optional[str] = None
    
    # Metadata
    is_active: bool = True
    notes: Optional[str] = None


class CanonicalAccount(BaseEntity):
    """Canonical account/company entity"""
    
    entity_type: Literal["account"] = "account"
    
    # Core Fields
    name: str
    website: Optional[str] = None
    industry: Optional[str] = None
    employee_count: Optional[int] = None
    annual_revenue: Optional[float] = None
    
    # Primary Contact
    primary_contact_id: Optional[str] = None
    
    # Address
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    
    # Classification
    account_type: Optional[str] = None  # prospect, customer, partner, churned
    tier: Optional[str] = None  # enterprise, mid-market, smb
    tags: List[str] = Field(default_factory=list)
    
    # Ownership
    owner_id: Optional[str] = None
    team_id: Optional[str] = None
    department_id: Optional[str] = None
    
    # Engagement
    last_activity_date: Optional[datetime] = None
    total_opportunities: int = 0
    total_value: float = 0.0
    won_value: float = 0.0
    
    # Status
    is_active: bool = True
    health_score: Optional[int] = None  # 0-100
    
    # Custom Fields (dynamic)
    custom_fields: Dict[str, Any] = Field(default_factory=dict)


class CanonicalOpportunity(BaseEntity):
    """Canonical opportunity/deal entity"""
    
    entity_type: Literal["opportunity"] = "opportunity"
    
    # Core Fields
    name: str
    account_id: Optional[str] = None
    contact_id: Optional[str] = None
    
    # Deal Info
    stage: str = OpportunityStage.LEAD
    probability: int = Field(default=10, ge=0, le=100)
    amount: float = 0.0
    currency: str = "USD"
    
    # Dates
    expected_close_date: Optional[datetime] = None
    actual_close_date: Optional[datetime] = None
    
    # Classification
    opportunity_type: Optional[str] = None  # new_business, upsell, renewal
    lead_source: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    priority: Priority = Priority.MEDIUM
    
    # Ownership
    owner_id: Optional[str] = None
    team_id: Optional[str] = None
    
    # Tracking
    stage_history: List[Dict[str, Any]] = Field(default_factory=list)
    next_step: Optional[str] = None
    competitor: Optional[str] = None
    loss_reason: Optional[str] = None
    
    # Status
    is_closed: bool = False
    is_won: bool = False
    
    # Custom Fields
    custom_fields: Dict[str, Any] = Field(default_factory=dict)
    
    def add_stage_change(self, new_stage: str, changed_by: str = None):
        """Record stage change in history"""
        self.stage_history.append({
            "from_stage": self.stage,
            "to_stage": new_stage,
            "changed_at": datetime.now(timezone.utc).isoformat(),
            "changed_by": changed_by
        })
        self.stage = new_stage


class CanonicalActivity(BaseEntity):
    """Canonical activity/task entity"""
    
    entity_type: Literal["activity"] = "activity"
    
    # Core Fields
    subject: str
    activity_type: ActivityType = ActivityType.TASK
    description: Optional[str] = None
    
    # Relations
    account_id: Optional[str] = None
    contact_id: Optional[str] = None
    opportunity_id: Optional[str] = None
    
    # Timing
    due_date: Optional[datetime] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    
    # Status
    status: ActivityStatus = ActivityStatus.PENDING
    priority: Priority = Priority.MEDIUM
    completed_at: Optional[datetime] = None
    
    # Ownership
    owner_id: Optional[str] = None
    assigned_to: Optional[str] = None
    
    # Meeting Details
    location: Optional[str] = None
    meeting_url: Optional[str] = None
    attendees: List[str] = Field(default_factory=list)
    
    # Outcome
    outcome: Optional[str] = None
    notes: Optional[str] = None


class CanonicalUser(BaseEntity):
    """Canonical user entity"""
    
    entity_type: Literal["user"] = "user"
    
    # Core Fields
    email: EmailStr
    name: str
    
    # Auth
    password_hash: Optional[str] = None
    auth_provider: str = "local"  # local, ms365, google
    external_id: Optional[str] = None
    
    # Role & Permissions
    role: UserRole = UserRole.SALES_REP
    visibility_scope: VisibilityScope = VisibilityScope.OWN
    permissions: List[str] = Field(default_factory=list)
    
    # Organization
    department_id: Optional[str] = None
    team_id: Optional[str] = None
    manager_id: Optional[str] = None
    
    # Profile
    avatar_url: Optional[str] = None
    phone: Optional[str] = None
    job_title: Optional[str] = None
    timezone: str = "UTC"
    
    # Status
    is_active: bool = True
    last_login: Optional[datetime] = None
    
    # Settings
    preferences: Dict[str, Any] = Field(default_factory=dict)


# ===================== SERVING ZONE MODELS =====================

class ServingDashboardStats(BaseEntity):
    """Pre-aggregated dashboard statistics per user"""
    
    user_id: str
    period: str  # daily, weekly, monthly, quarterly, yearly
    period_start: datetime
    period_end: datetime
    
    # Accounts
    total_accounts: int = 0
    new_accounts: int = 0
    active_accounts: int = 0
    
    # Opportunities
    total_opportunities: int = 0
    open_opportunities: int = 0
    won_opportunities: int = 0
    lost_opportunities: int = 0
    pipeline_value: float = 0.0
    won_value: float = 0.0
    
    # Activities
    total_activities: int = 0
    completed_activities: int = 0
    overdue_activities: int = 0
    upcoming_activities: int = 0
    
    # Performance
    conversion_rate: float = 0.0
    average_deal_size: float = 0.0
    win_rate: float = 0.0
    
    # Computed at
    computed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ServingPipelineSummary(BaseEntity):
    """Pipeline summary for dashboard view"""
    
    user_id: str
    scope: VisibilityScope = VisibilityScope.OWN
    
    # Stage Breakdown
    stages: List[Dict[str, Any]] = Field(default_factory=list)
    # Example: [{"stage": "qualification", "count": 5, "value": 50000}, ...]
    
    # Totals
    total_pipeline_value: float = 0.0
    total_opportunities: int = 0
    weighted_pipeline: float = 0.0
    
    # Aging
    average_age_days: float = 0.0
    stalled_count: int = 0
    
    # Computed at
    computed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ServingKPISnapshot(BaseEntity):
    """KPI snapshot for trend analysis"""
    
    user_id: str
    date: datetime
    
    # KPIs
    kpis: Dict[str, float] = Field(default_factory=dict)
    # Example: {"calls_made": 15, "meetings_held": 3, "proposals_sent": 2, ...}
    
    # Goals
    goals: Dict[str, float] = Field(default_factory=dict)
    # Example: {"calls_made": 20, "meetings_held": 5, ...}
    
    # Achievement
    achievement_pct: Dict[str, float] = Field(default_factory=dict)


class ServingActivityFeed(BaseEntity):
    """Activity feed for dashboard"""
    
    user_id: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    # Activity Info
    activity_type: str  # created_account, won_deal, completed_activity, etc.
    title: str
    description: Optional[str] = None
    
    # References
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    entity_name: Optional[str] = None
    
    # Actor
    actor_id: Optional[str] = None
    actor_name: Optional[str] = None
    
    # Metadata
    metadata: Dict[str, Any] = Field(default_factory=dict)
