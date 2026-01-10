# ===================== SUPER ADMIN CONFIGURATION SYSTEM =====================
# This file contains all configuration models and logic for the metadata-driven
# enterprise configuration framework.

from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

# ===================== ORGANIZATION CONFIGURATION =====================

class OrganizationSettings(BaseModel):
    """Organization-level settings"""
    id: str = "org_config"
    name: str = "SalesCommand Enterprise"
    domain: Optional[str] = None
    industry: Optional[str] = None
    timezone: str = "UTC"
    date_format: str = "YYYY-MM-DD"
    currency: str = "USD"
    currency_symbol: str = "$"
    fiscal_year_start_month: int = 1  # January
    working_days: List[str] = ["monday", "tuesday", "wednesday", "thursday", "friday"]
    working_hours_start: str = "09:00"
    working_hours_end: str = "18:00"
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: str = "#2563EB"
    quota_period: str = "quarterly"  # monthly, quarterly, yearly
    default_commission_rate: float = 0.05
    enable_referrals: bool = True
    enable_ai_features: bool = True
    data_retention_days: int = 365
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

# ===================== USER MANAGEMENT MODELS =====================

class UserCreateByAdmin(BaseModel):
    """Model for admin creating a user"""
    email: EmailStr
    name: str
    role: str
    password: Optional[str] = None  # If not provided, generate random
    department: Optional[str] = None
    product_line: Optional[str] = None
    manager_id: Optional[str] = None
    quota: float = 500000
    commission_template_id: Optional[str] = None
    is_active: bool = True

class UserUpdateByAdmin(BaseModel):
    """Model for admin updating a user"""
    name: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    product_line: Optional[str] = None
    manager_id: Optional[str] = None
    quota: Optional[float] = None
    commission_template_id: Optional[str] = None
    is_active: Optional[bool] = None

class UserFullResponse(BaseModel):
    """Full user response for admin"""
    id: str
    email: str
    name: str
    role: str
    department: Optional[str] = None
    product_line: Optional[str] = None
    manager_id: Optional[str] = None
    manager_name: Optional[str] = None
    quota: float = 500000
    commission_template_id: Optional[str] = None
    commission_template_name: Optional[str] = None
    is_active: bool = True
    avatar_url: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    last_login: Optional[datetime] = None

# ===================== AI AGENT CONFIGURATION =====================

class AIAgentType(str, Enum):
    PROBABILITY_ANALYZER = "probability_analyzer"
    SALES_INSIGHTS = "sales_insights"
    EMAIL_ANALYZER = "email_analyzer"
    DEAL_COACH = "deal_coach"
    FORECAST_PREDICTOR = "forecast_predictor"
    ACTIVITY_SUGGESTER = "activity_suggester"

class AIAgentConfig(BaseModel):
    """Individual AI agent configuration"""
    id: str
    name: str
    agent_type: AIAgentType
    description: Optional[str] = None
    is_enabled: bool = True
    llm_provider: str = "openai"
    model: str = "gpt-4o"
    temperature: float = 0.7
    max_tokens: int = 1000
    system_prompt: str
    user_prompt_template: str
    input_variables: List[str] = []
    output_format: str = "text"  # text, json, structured
    output_schema: Optional[Dict] = None  # JSON schema for structured output
    trigger_type: str = "manual"  # manual, automatic, scheduled
    trigger_conditions: Optional[Dict] = None
    allowed_roles: List[str] = []  # Empty means all roles
    rate_limit_per_user: int = 100  # Per day
    cache_enabled: bool = True
    cache_ttl_minutes: int = 60

class AIAgentsConfig(BaseModel):
    """Complete AI agents configuration"""
    agents: List[AIAgentConfig] = []
    global_rate_limit: int = 10000  # Per day for organization
    enable_usage_tracking: bool = True
    enable_feedback_collection: bool = True
    fallback_provider: Optional[str] = None
    cost_tracking_enabled: bool = True
    max_cost_per_day: Optional[float] = None

# ===================== CORE CONFIGURATION MODELS =====================

class ModuleType(str, Enum):
    CRM = "crm"
    SALES = "sales"
    INCENTIVES = "incentives"
    ACTIVITIES = "activities"
    KPI = "kpi"
    INTEGRATIONS = "integrations"
    ADMIN = "admin"
    AI = "ai"
    REPORTS = "reports"

class ActionType(str, Enum):
    VIEW = "view"
    CREATE = "create"
    EDIT = "edit"
    DELETE = "delete"
    APPROVE = "approve"
    CONFIGURE = "configure"
    EXPORT = "export"

# ===================== MODULE DEFINITION =====================

class ModuleFeatureAction(BaseModel):
    """Individual action within a feature"""
    id: str
    name: str
    action_type: ActionType
    description: Optional[str] = None
    is_enabled: bool = True

class ModuleFeature(BaseModel):
    """Feature within a module"""
    id: str
    name: str
    description: Optional[str] = None
    actions: List[ModuleFeatureAction] = []
    is_enabled: bool = True
    config_schema: Optional[Dict] = None  # JSON schema for feature-specific config

class ModuleDefinition(BaseModel):
    """Complete module definition"""
    id: str
    name: str
    module_type: ModuleType
    description: Optional[str] = None
    icon: str = "box"
    features: List[ModuleFeature] = []
    is_enabled: bool = True
    order: int = 0

# ===================== ROLE CONFIGURATION =====================

class RolePermission(BaseModel):
    """Permission assignment for a role"""
    module_id: str
    feature_id: str
    action_ids: List[str] = []  # List of allowed action IDs

class RoleDefinition(BaseModel):
    """Complete role definition with permissions"""
    id: str
    name: str
    description: Optional[str] = None
    is_system_role: bool = False  # System roles cannot be deleted
    permissions: List[RolePermission] = []
    dashboard_config: Optional[Dict] = None  # Default dashboard for this role
    is_active: bool = True

# ===================== BLUE SHEET CONFIGURATION =====================

class BlueSheetElement(BaseModel):
    """Configurable element in Blue Sheet analysis"""
    id: str
    name: str
    category: str  # buying_influence, red_flag, win_result, action_plan
    element_type: str  # checkbox, number, select
    weight: int = 10  # Points weight
    is_negative: bool = False  # For red flags
    options: Optional[List[str]] = None  # For select type
    description: Optional[str] = None
    is_enabled: bool = True
    order: int = 0

class BlueSheetStage(BaseModel):
    """Pipeline stage configuration"""
    id: str
    name: str
    order: int
    color: str = "#3B82F6"
    probability_default: int = 10
    is_won: bool = False
    is_lost: bool = False
    required_elements: List[str] = []  # Blue sheet elements required at this stage

class BlueSheetConfig(BaseModel):
    """Complete Blue Sheet configuration"""
    elements: List[BlueSheetElement] = []
    stages: List[BlueSheetStage] = []
    probability_formula: str = "weighted_sum"  # weighted_sum, ai_calculated, hybrid
    max_score: int = 100
    ai_enhancement_enabled: bool = True

# ===================== LLM CONFIGURATION =====================

class LLMProviderConfig(BaseModel):
    """LLM provider configuration"""
    provider: str  # openai, anthropic, gemini
    model: str
    api_key_env: str  # Environment variable name for API key
    temperature: float = 0.7
    max_tokens: int = 1000
    is_enabled: bool = True

class PromptTemplate(BaseModel):
    """Configurable prompt template"""
    id: str
    name: str
    category: str  # probability_analysis, insights, recommendations, email_analysis
    system_prompt: str
    user_prompt_template: str  # Can include {variables}
    input_variables: List[str] = []  # Variables to inject
    output_format: str = "text"  # text, json, markdown
    is_enabled: bool = True

class LLMConfig(BaseModel):
    """Complete LLM configuration"""
    default_provider: str = "openai"
    providers: List[LLMProviderConfig] = []
    prompt_templates: List[PromptTemplate] = []
    enable_caching: bool = True
    cache_ttl_minutes: int = 60

# ===================== INCENTIVE CONFIGURATION =====================

class IncentiveTier(BaseModel):
    """Commission tier definition"""
    min_value: float
    max_value: float
    rate: Optional[float] = None
    multiplier: float = 1.0

class IncentiveRule(BaseModel):
    """Incentive calculation rule"""
    id: str
    name: str
    rule_type: str  # flat, tiered_attainment, tiered_revenue, quota_based
    base_rate: float
    tiers: List[IncentiveTier] = []
    product_weights: Dict[str, float] = {}
    new_logo_multiplier: float = 1.0
    renewal_rate: float = 0.05
    cap_multiplier: Optional[float] = None
    conditions: Dict[str, Any] = {}  # Additional conditions

class IncentiveConfig(BaseModel):
    """Complete incentive configuration"""
    rules: List[IncentiveRule] = []
    payout_periods: List[str] = ["monthly", "quarterly", "yearly"]
    approval_required: bool = True
    approval_roles: List[str] = ["finance_manager", "ceo"]

# ===================== INTEGRATION CONFIGURATION =====================

class IntegrationFieldMapping(BaseModel):
    """Field mapping for integration sync"""
    source_field: str
    target_field: str
    transform: Optional[str] = None  # Optional transformation function

class IntegrationConfig(BaseModel):
    """Individual integration configuration"""
    id: str
    name: str
    integration_type: str  # odoo, office365, salesforce, etc.
    is_enabled: bool = False
    api_url: Optional[str] = None
    auth_type: str = "api_key"  # api_key, oauth2, basic
    sync_interval_minutes: int = 60
    field_mappings: List[IntegrationFieldMapping] = []
    sync_entities: List[str] = []  # accounts, opportunities, activities
    webhook_url: Optional[str] = None
    settings: Dict[str, Any] = {}

# ===================== UI/THEME CONFIGURATION =====================

class ThemeColors(BaseModel):
    """Theme color configuration"""
    primary: str = "#0F172A"
    primary_foreground: str = "#F8FAFC"
    secondary: str = "#F1F5F9"
    secondary_foreground: str = "#0F172A"
    accent: str = "#2563EB"
    accent_foreground: str = "#FFFFFF"
    destructive: str = "#EF4444"
    success: str = "#10B981"
    warning: str = "#F59E0B"
    background: str = "#FFFFFF"
    surface: str = "#F8FAFC"
    border: str = "#E2E8F0"
    muted: str = "#64748B"

class ThemeTypography(BaseModel):
    """Typography configuration"""
    heading_font: str = "Manrope"
    body_font: str = "Inter"
    mono_font: str = "JetBrains Mono"

class BrandingConfig(BaseModel):
    """Branding configuration"""
    app_name: str = "SalesCommand"
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    tagline: Optional[str] = None

class UIConfig(BaseModel):
    """Complete UI configuration"""
    theme_mode: str = "light"  # light, dark, system
    colors: ThemeColors = ThemeColors()
    typography: ThemeTypography = ThemeTypography()
    branding: BrandingConfig = BrandingConfig()
    sidebar_collapsed: bool = False
    compact_mode: bool = False
    animations_enabled: bool = True

# ===================== SYSTEM CONFIGURATION =====================

class SystemConfig(BaseModel):
    """Master system configuration"""
    id: str = "system_config"
    organization: OrganizationSettings = OrganizationSettings()
    modules: List[ModuleDefinition] = []
    roles: List[RoleDefinition] = []
    blue_sheet: BlueSheetConfig = BlueSheetConfig()
    llm: LLMConfig = LLMConfig()
    ai_agents: AIAgentsConfig = AIAgentsConfig()
    incentives: IncentiveConfig = IncentiveConfig()
    integrations: List[IntegrationConfig] = []
    ui: UIConfig = UIConfig()
    version: str = "1.0"
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None

# ===================== DEFAULT CONFIGURATIONS =====================

def get_default_modules() -> List[ModuleDefinition]:
    """Return default module definitions"""
    return [
        ModuleDefinition(
            id="crm",
            name="CRM",
            module_type=ModuleType.CRM,
            description="Customer Relationship Management",
            icon="users",
            order=1,
            features=[
                ModuleFeature(
                    id="accounts",
                    name="Accounts",
                    description="Manage customer accounts",
                    actions=[
                        ModuleFeatureAction(id="accounts_view", name="View Accounts", action_type=ActionType.VIEW),
                        ModuleFeatureAction(id="accounts_create", name="Create Accounts", action_type=ActionType.CREATE),
                        ModuleFeatureAction(id="accounts_edit", name="Edit Accounts", action_type=ActionType.EDIT),
                        ModuleFeatureAction(id="accounts_delete", name="Delete Accounts", action_type=ActionType.DELETE),
                    ]
                ),
                ModuleFeature(
                    id="opportunities",
                    name="Opportunities",
                    description="Manage sales opportunities",
                    actions=[
                        ModuleFeatureAction(id="opps_view", name="View Opportunities", action_type=ActionType.VIEW),
                        ModuleFeatureAction(id="opps_create", name="Create Opportunities", action_type=ActionType.CREATE),
                        ModuleFeatureAction(id="opps_edit", name="Edit Opportunities", action_type=ActionType.EDIT),
                        ModuleFeatureAction(id="opps_delete", name="Delete Opportunities", action_type=ActionType.DELETE),
                        ModuleFeatureAction(id="opps_kanban", name="Kanban Board", action_type=ActionType.VIEW),
                        ModuleFeatureAction(id="opps_blue_sheet", name="Blue Sheet Analysis", action_type=ActionType.VIEW),
                    ]
                ),
                ModuleFeature(
                    id="contacts",
                    name="Contacts",
                    description="Manage contacts and stakeholders",
                    actions=[
                        ModuleFeatureAction(id="contacts_view", name="View Contacts", action_type=ActionType.VIEW),
                        ModuleFeatureAction(id="contacts_create", name="Create Contacts", action_type=ActionType.CREATE),
                        ModuleFeatureAction(id="contacts_edit", name="Edit Contacts", action_type=ActionType.EDIT),
                    ]
                ),
            ]
        ),
        ModuleDefinition(
            id="sales",
            name="Sales",
            module_type=ModuleType.SALES,
            description="Sales tracking and metrics",
            icon="trending-up",
            order=2,
            features=[
                ModuleFeature(
                    id="sales_metrics",
                    name="Sales Metrics",
                    description="View sales performance metrics",
                    actions=[
                        ModuleFeatureAction(id="metrics_view", name="View Metrics", action_type=ActionType.VIEW),
                        ModuleFeatureAction(id="metrics_export", name="Export Metrics", action_type=ActionType.EXPORT),
                    ]
                ),
                ModuleFeature(
                    id="pipeline",
                    name="Pipeline",
                    description="Sales pipeline management",
                    actions=[
                        ModuleFeatureAction(id="pipeline_view", name="View Pipeline", action_type=ActionType.VIEW),
                        ModuleFeatureAction(id="pipeline_configure", name="Configure Stages", action_type=ActionType.CONFIGURE),
                    ]
                ),
                ModuleFeature(
                    id="forecasting",
                    name="Forecasting",
                    description="Revenue forecasting",
                    actions=[
                        ModuleFeatureAction(id="forecast_view", name="View Forecasts", action_type=ActionType.VIEW),
                    ]
                ),
            ]
        ),
        ModuleDefinition(
            id="incentives",
            name="Incentives",
            module_type=ModuleType.INCENTIVES,
            description="Commission and incentive management",
            icon="gift",
            order=3,
            features=[
                ModuleFeature(
                    id="incentive_tracking",
                    name="Incentive Tracking",
                    description="Track earned incentives",
                    actions=[
                        ModuleFeatureAction(id="incentive_view", name="View Incentives", action_type=ActionType.VIEW),
                        ModuleFeatureAction(id="incentive_calculate", name="Calculate Incentives", action_type=ActionType.VIEW),
                    ]
                ),
                ModuleFeature(
                    id="incentive_config",
                    name="Incentive Configuration",
                    description="Configure commission structures",
                    actions=[
                        ModuleFeatureAction(id="incentive_config_view", name="View Configuration", action_type=ActionType.VIEW),
                        ModuleFeatureAction(id="incentive_config_edit", name="Edit Configuration", action_type=ActionType.CONFIGURE),
                    ]
                ),
                ModuleFeature(
                    id="referrals",
                    name="Referrals",
                    description="Manage referral incentives",
                    actions=[
                        ModuleFeatureAction(id="referrals_view", name="View Referrals", action_type=ActionType.VIEW),
                        ModuleFeatureAction(id="referrals_create", name="Create Referrals", action_type=ActionType.CREATE),
                        ModuleFeatureAction(id="referrals_approve", name="Approve Referrals", action_type=ActionType.APPROVE),
                    ]
                ),
            ]
        ),
        ModuleDefinition(
            id="activities",
            name="Activities",
            module_type=ModuleType.ACTIVITIES,
            description="Task and activity management",
            icon="list-todo",
            order=4,
            features=[
                ModuleFeature(
                    id="tasks",
                    name="Tasks",
                    description="Manage tasks and activities",
                    actions=[
                        ModuleFeatureAction(id="tasks_view", name="View Tasks", action_type=ActionType.VIEW),
                        ModuleFeatureAction(id="tasks_create", name="Create Tasks", action_type=ActionType.CREATE),
                        ModuleFeatureAction(id="tasks_edit", name="Edit Tasks", action_type=ActionType.EDIT),
                        ModuleFeatureAction(id="tasks_delete", name="Delete Tasks", action_type=ActionType.DELETE),
                    ]
                ),
                ModuleFeature(
                    id="calendar",
                    name="Calendar",
                    description="Calendar integration",
                    actions=[
                        ModuleFeatureAction(id="calendar_view", name="View Calendar", action_type=ActionType.VIEW),
                    ]
                ),
            ]
        ),
        ModuleDefinition(
            id="kpi",
            name="KPIs",
            module_type=ModuleType.KPI,
            description="Key Performance Indicators",
            icon="bar-chart",
            order=5,
            features=[
                ModuleFeature(
                    id="kpi_dashboard",
                    name="KPI Dashboard",
                    description="View KPI dashboard",
                    actions=[
                        ModuleFeatureAction(id="kpi_view", name="View KPIs", action_type=ActionType.VIEW),
                    ]
                ),
                ModuleFeature(
                    id="kpi_config",
                    name="KPI Configuration",
                    description="Configure KPIs",
                    actions=[
                        ModuleFeatureAction(id="kpi_create", name="Create KPIs", action_type=ActionType.CREATE),
                        ModuleFeatureAction(id="kpi_edit", name="Edit KPIs", action_type=ActionType.EDIT),
                    ]
                ),
            ]
        ),
        ModuleDefinition(
            id="ai",
            name="AI & Analytics",
            module_type=ModuleType.AI,
            description="AI-powered insights and analytics",
            icon="sparkles",
            order=6,
            features=[
                ModuleFeature(
                    id="ai_insights",
                    name="AI Insights",
                    description="AI-generated sales insights",
                    actions=[
                        ModuleFeatureAction(id="insights_view", name="View Insights", action_type=ActionType.VIEW),
                    ]
                ),
                ModuleFeature(
                    id="ai_probability",
                    name="Probability Analysis",
                    description="AI probability calculation",
                    actions=[
                        ModuleFeatureAction(id="probability_view", name="Calculate Probability", action_type=ActionType.VIEW),
                    ]
                ),
                ModuleFeature(
                    id="ai_config",
                    name="AI Configuration",
                    description="Configure AI settings",
                    actions=[
                        ModuleFeatureAction(id="ai_config_view", name="View AI Config", action_type=ActionType.VIEW),
                        ModuleFeatureAction(id="ai_config_edit", name="Edit AI Config", action_type=ActionType.CONFIGURE),
                    ]
                ),
            ]
        ),
        ModuleDefinition(
            id="integrations",
            name="Integrations",
            module_type=ModuleType.INTEGRATIONS,
            description="External system integrations",
            icon="plug",
            order=7,
            features=[
                ModuleFeature(
                    id="integration_status",
                    name="Integration Status",
                    description="View integration status",
                    actions=[
                        ModuleFeatureAction(id="integrations_view", name="View Integrations", action_type=ActionType.VIEW),
                    ]
                ),
                ModuleFeature(
                    id="integration_config",
                    name="Integration Configuration",
                    description="Configure integrations",
                    actions=[
                        ModuleFeatureAction(id="integrations_configure", name="Configure Integrations", action_type=ActionType.CONFIGURE),
                    ]
                ),
            ]
        ),
        ModuleDefinition(
            id="admin",
            name="Administration",
            module_type=ModuleType.ADMIN,
            description="System administration",
            icon="settings",
            order=8,
            features=[
                ModuleFeature(
                    id="user_management",
                    name="User Management",
                    description="Manage users",
                    actions=[
                        ModuleFeatureAction(id="users_view", name="View Users", action_type=ActionType.VIEW),
                        ModuleFeatureAction(id="users_create", name="Create Users", action_type=ActionType.CREATE),
                        ModuleFeatureAction(id="users_edit", name="Edit Users", action_type=ActionType.EDIT),
                        ModuleFeatureAction(id="users_delete", name="Delete Users", action_type=ActionType.DELETE),
                    ]
                ),
                ModuleFeature(
                    id="role_management",
                    name="Role Management",
                    description="Manage roles and permissions",
                    actions=[
                        ModuleFeatureAction(id="roles_view", name="View Roles", action_type=ActionType.VIEW),
                        ModuleFeatureAction(id="roles_create", name="Create Roles", action_type=ActionType.CREATE),
                        ModuleFeatureAction(id="roles_edit", name="Edit Roles", action_type=ActionType.EDIT),
                        ModuleFeatureAction(id="roles_delete", name="Delete Roles", action_type=ActionType.DELETE),
                    ]
                ),
                ModuleFeature(
                    id="system_config",
                    name="System Configuration",
                    description="Configure system settings",
                    actions=[
                        ModuleFeatureAction(id="config_view", name="View Configuration", action_type=ActionType.VIEW),
                        ModuleFeatureAction(id="config_edit", name="Edit Configuration", action_type=ActionType.CONFIGURE),
                    ]
                ),
                ModuleFeature(
                    id="ui_customization",
                    name="UI Customization",
                    description="Customize UI and branding",
                    actions=[
                        ModuleFeatureAction(id="ui_view", name="View UI Settings", action_type=ActionType.VIEW),
                        ModuleFeatureAction(id="ui_edit", name="Edit UI Settings", action_type=ActionType.CONFIGURE),
                    ]
                ),
                ModuleFeature(
                    id="audit_log",
                    name="Audit Log",
                    description="View system audit logs",
                    actions=[
                        ModuleFeatureAction(id="audit_view", name="View Audit Log", action_type=ActionType.VIEW),
                    ]
                ),
            ]
        ),
        ModuleDefinition(
            id="reports",
            name="Reports",
            module_type=ModuleType.REPORTS,
            description="Reporting and analytics",
            icon="file-text",
            order=9,
            features=[
                ModuleFeature(
                    id="standard_reports",
                    name="Standard Reports",
                    description="Pre-built reports",
                    actions=[
                        ModuleFeatureAction(id="reports_view", name="View Reports", action_type=ActionType.VIEW),
                        ModuleFeatureAction(id="reports_export", name="Export Reports", action_type=ActionType.EXPORT),
                    ]
                ),
                ModuleFeature(
                    id="custom_reports",
                    name="Custom Reports",
                    description="Create custom reports",
                    actions=[
                        ModuleFeatureAction(id="custom_reports_create", name="Create Custom Reports", action_type=ActionType.CREATE),
                    ]
                ),
            ]
        ),
    ]


def get_default_roles() -> List[RoleDefinition]:
    """Return default role definitions"""
    return [
        RoleDefinition(
            id="super_admin",
            name="Super Admin",
            description="Full system access with configuration capabilities",
            is_system_role=True,
            permissions=[
                # Full access to all modules
                RolePermission(module_id="crm", feature_id="accounts", action_ids=["accounts_view", "accounts_create", "accounts_edit", "accounts_delete"]),
                RolePermission(module_id="crm", feature_id="opportunities", action_ids=["opps_view", "opps_create", "opps_edit", "opps_delete", "opps_kanban", "opps_blue_sheet"]),
                RolePermission(module_id="crm", feature_id="contacts", action_ids=["contacts_view", "contacts_create", "contacts_edit"]),
                RolePermission(module_id="sales", feature_id="sales_metrics", action_ids=["metrics_view", "metrics_export"]),
                RolePermission(module_id="sales", feature_id="pipeline", action_ids=["pipeline_view", "pipeline_configure"]),
                RolePermission(module_id="sales", feature_id="forecasting", action_ids=["forecast_view"]),
                RolePermission(module_id="incentives", feature_id="incentive_tracking", action_ids=["incentive_view", "incentive_calculate"]),
                RolePermission(module_id="incentives", feature_id="incentive_config", action_ids=["incentive_config_view", "incentive_config_edit"]),
                RolePermission(module_id="incentives", feature_id="referrals", action_ids=["referrals_view", "referrals_create", "referrals_approve"]),
                RolePermission(module_id="activities", feature_id="tasks", action_ids=["tasks_view", "tasks_create", "tasks_edit", "tasks_delete"]),
                RolePermission(module_id="activities", feature_id="calendar", action_ids=["calendar_view"]),
                RolePermission(module_id="kpi", feature_id="kpi_dashboard", action_ids=["kpi_view"]),
                RolePermission(module_id="kpi", feature_id="kpi_config", action_ids=["kpi_create", "kpi_edit"]),
                RolePermission(module_id="ai", feature_id="ai_insights", action_ids=["insights_view"]),
                RolePermission(module_id="ai", feature_id="ai_probability", action_ids=["probability_view"]),
                RolePermission(module_id="ai", feature_id="ai_config", action_ids=["ai_config_view", "ai_config_edit"]),
                RolePermission(module_id="integrations", feature_id="integration_status", action_ids=["integrations_view"]),
                RolePermission(module_id="integrations", feature_id="integration_config", action_ids=["integrations_configure"]),
                RolePermission(module_id="admin", feature_id="user_management", action_ids=["users_view", "users_create", "users_edit", "users_delete"]),
                RolePermission(module_id="admin", feature_id="role_management", action_ids=["roles_view", "roles_create", "roles_edit", "roles_delete"]),
                RolePermission(module_id="admin", feature_id="system_config", action_ids=["config_view", "config_edit"]),
                RolePermission(module_id="admin", feature_id="ui_customization", action_ids=["ui_view", "ui_edit"]),
                RolePermission(module_id="admin", feature_id="audit_log", action_ids=["audit_view"]),
                RolePermission(module_id="reports", feature_id="standard_reports", action_ids=["reports_view", "reports_export"]),
                RolePermission(module_id="reports", feature_id="custom_reports", action_ids=["custom_reports_create"]),
            ]
        ),
        RoleDefinition(
            id="ceo",
            name="CEO",
            description="Executive dashboard with company-wide visibility",
            is_system_role=True,
            permissions=[
                RolePermission(module_id="crm", feature_id="accounts", action_ids=["accounts_view"]),
                RolePermission(module_id="crm", feature_id="opportunities", action_ids=["opps_view", "opps_kanban", "opps_blue_sheet"]),
                RolePermission(module_id="sales", feature_id="sales_metrics", action_ids=["metrics_view", "metrics_export"]),
                RolePermission(module_id="sales", feature_id="pipeline", action_ids=["pipeline_view"]),
                RolePermission(module_id="sales", feature_id="forecasting", action_ids=["forecast_view"]),
                RolePermission(module_id="incentives", feature_id="incentive_tracking", action_ids=["incentive_view"]),
                RolePermission(module_id="incentives", feature_id="incentive_config", action_ids=["incentive_config_view", "incentive_config_edit"]),
                RolePermission(module_id="kpi", feature_id="kpi_dashboard", action_ids=["kpi_view"]),
                RolePermission(module_id="kpi", feature_id="kpi_config", action_ids=["kpi_create", "kpi_edit"]),
                RolePermission(module_id="ai", feature_id="ai_insights", action_ids=["insights_view"]),
                RolePermission(module_id="admin", feature_id="user_management", action_ids=["users_view"]),
                RolePermission(module_id="reports", feature_id="standard_reports", action_ids=["reports_view", "reports_export"]),
            ]
        ),
        RoleDefinition(
            id="sales_director",
            name="Sales Director",
            description="Sales team management and incentive configuration",
            is_system_role=True,
            permissions=[
                RolePermission(module_id="crm", feature_id="accounts", action_ids=["accounts_view"]),
                RolePermission(module_id="crm", feature_id="opportunities", action_ids=["opps_view", "opps_kanban", "opps_blue_sheet"]),
                RolePermission(module_id="sales", feature_id="sales_metrics", action_ids=["metrics_view", "metrics_export"]),
                RolePermission(module_id="sales", feature_id="pipeline", action_ids=["pipeline_view", "pipeline_configure"]),
                RolePermission(module_id="sales", feature_id="forecasting", action_ids=["forecast_view"]),
                RolePermission(module_id="incentives", feature_id="incentive_tracking", action_ids=["incentive_view"]),
                RolePermission(module_id="incentives", feature_id="incentive_config", action_ids=["incentive_config_view", "incentive_config_edit"]),
                RolePermission(module_id="incentives", feature_id="referrals", action_ids=["referrals_view", "referrals_approve"]),
                RolePermission(module_id="kpi", feature_id="kpi_dashboard", action_ids=["kpi_view"]),
                RolePermission(module_id="ai", feature_id="ai_insights", action_ids=["insights_view"]),
                RolePermission(module_id="reports", feature_id="standard_reports", action_ids=["reports_view", "reports_export"]),
            ]
        ),
        RoleDefinition(
            id="finance_manager",
            name="Finance Manager",
            description="Financial oversight and commission management",
            is_system_role=True,
            permissions=[
                RolePermission(module_id="sales", feature_id="sales_metrics", action_ids=["metrics_view", "metrics_export"]),
                RolePermission(module_id="incentives", feature_id="incentive_tracking", action_ids=["incentive_view"]),
                RolePermission(module_id="incentives", feature_id="incentive_config", action_ids=["incentive_config_view", "incentive_config_edit"]),
                RolePermission(module_id="incentives", feature_id="referrals", action_ids=["referrals_view", "referrals_approve"]),
                RolePermission(module_id="reports", feature_id="standard_reports", action_ids=["reports_view", "reports_export"]),
            ]
        ),
        RoleDefinition(
            id="account_manager",
            name="Account Manager",
            description="Customer account and opportunity management",
            is_system_role=True,
            permissions=[
                RolePermission(module_id="crm", feature_id="accounts", action_ids=["accounts_view", "accounts_create", "accounts_edit"]),
                RolePermission(module_id="crm", feature_id="opportunities", action_ids=["opps_view", "opps_create", "opps_edit", "opps_kanban", "opps_blue_sheet"]),
                RolePermission(module_id="crm", feature_id="contacts", action_ids=["contacts_view", "contacts_create", "contacts_edit"]),
                RolePermission(module_id="sales", feature_id="sales_metrics", action_ids=["metrics_view"]),
                RolePermission(module_id="incentives", feature_id="incentive_tracking", action_ids=["incentive_view", "incentive_calculate"]),
                RolePermission(module_id="incentives", feature_id="referrals", action_ids=["referrals_view", "referrals_create"]),
                RolePermission(module_id="activities", feature_id="tasks", action_ids=["tasks_view", "tasks_create", "tasks_edit"]),
                RolePermission(module_id="kpi", feature_id="kpi_dashboard", action_ids=["kpi_view"]),
                RolePermission(module_id="ai", feature_id="ai_insights", action_ids=["insights_view"]),
                RolePermission(module_id="ai", feature_id="ai_probability", action_ids=["probability_view"]),
            ]
        ),
        RoleDefinition(
            id="product_director",
            name="Product Director",
            description="Product line management and activity oversight",
            is_system_role=True,
            permissions=[
                RolePermission(module_id="crm", feature_id="accounts", action_ids=["accounts_view"]),
                RolePermission(module_id="crm", feature_id="opportunities", action_ids=["opps_view", "opps_kanban"]),
                RolePermission(module_id="sales", feature_id="sales_metrics", action_ids=["metrics_view"]),
                RolePermission(module_id="sales", feature_id="pipeline", action_ids=["pipeline_view"]),
                RolePermission(module_id="activities", feature_id="tasks", action_ids=["tasks_view", "tasks_create", "tasks_edit"]),
                RolePermission(module_id="kpi", feature_id="kpi_dashboard", action_ids=["kpi_view"]),
                RolePermission(module_id="ai", feature_id="ai_insights", action_ids=["insights_view"]),
            ]
        ),
        RoleDefinition(
            id="strategy",
            name="Strategy Team",
            description="Relationship management and strategic planning",
            is_system_role=True,
            permissions=[
                RolePermission(module_id="crm", feature_id="accounts", action_ids=["accounts_view"]),
                RolePermission(module_id="crm", feature_id="opportunities", action_ids=["opps_view"]),
                RolePermission(module_id="crm", feature_id="contacts", action_ids=["contacts_view", "contacts_create", "contacts_edit"]),
                RolePermission(module_id="activities", feature_id="tasks", action_ids=["tasks_view", "tasks_create", "tasks_edit"]),
                RolePermission(module_id="kpi", feature_id="kpi_dashboard", action_ids=["kpi_view"]),
            ]
        ),
        RoleDefinition(
            id="referrer",
            name="Referrer",
            description="Track referral incentives",
            is_system_role=True,
            permissions=[
                RolePermission(module_id="crm", feature_id="opportunities", action_ids=["opps_view"]),
                RolePermission(module_id="incentives", feature_id="referrals", action_ids=["referrals_view"]),
            ]
        ),
    ]


def get_default_blue_sheet_config() -> BlueSheetConfig:
    """Return default Blue Sheet configuration"""
    return BlueSheetConfig(
        elements=[
            # Buying Influences
            BlueSheetElement(id="economic_buyer_identified", name="Economic Buyer Identified", category="buying_influence", element_type="checkbox", weight=10, order=1),
            BlueSheetElement(id="economic_buyer_favorable", name="Economic Buyer Favorable", category="buying_influence", element_type="checkbox", weight=10, order=2),
            BlueSheetElement(id="user_buyers_favorable", name="User Buyers Favorable", category="buying_influence", element_type="number", weight=3, order=3, description="Number of favorable user buyers"),
            BlueSheetElement(id="technical_buyers_favorable", name="Technical Buyers Favorable", category="buying_influence", element_type="number", weight=3, order=4),
            BlueSheetElement(id="coach_identified", name="Coach Identified", category="buying_influence", element_type="checkbox", weight=5, order=5),
            BlueSheetElement(id="coach_engaged", name="Coach Actively Engaged", category="buying_influence", element_type="checkbox", weight=5, order=6),
            # Red Flags
            BlueSheetElement(id="no_access_to_eb", name="No Access to Economic Buyer", category="red_flag", element_type="checkbox", weight=15, is_negative=True, order=10),
            BlueSheetElement(id="budget_not_confirmed", name="Budget Not Confirmed", category="red_flag", element_type="checkbox", weight=12, is_negative=True, order=11),
            BlueSheetElement(id="competition_preferred", name="Competition Preferred", category="red_flag", element_type="checkbox", weight=15, is_negative=True, order=12),
            BlueSheetElement(id="reorganization_pending", name="Reorganization Pending", category="red_flag", element_type="checkbox", weight=10, is_negative=True, order=13),
            BlueSheetElement(id="timeline_unclear", name="Timeline Unclear", category="red_flag", element_type="checkbox", weight=8, is_negative=True, order=14),
            # Win Results
            BlueSheetElement(id="clear_business_results", name="Clear Business Results Defined", category="win_result", element_type="checkbox", weight=12, order=20),
            BlueSheetElement(id="quantifiable_value", name="Quantifiable Value Proposition", category="win_result", element_type="checkbox", weight=8, order=21),
            # Action Plan
            BlueSheetElement(id="next_steps_defined", name="Next Steps Defined", category="action_plan", element_type="checkbox", weight=8, order=30),
            BlueSheetElement(id="mutual_action_plan", name="Mutual Action Plan Agreed", category="action_plan", element_type="checkbox", weight=7, order=31),
        ],
        stages=[
            BlueSheetStage(id="lead", name="Lead", order=1, color="#6366F1", probability_default=5),
            BlueSheetStage(id="qualification", name="Qualification", order=2, color="#8B5CF6", probability_default=10, required_elements=["economic_buyer_identified"]),
            BlueSheetStage(id="discovery", name="Discovery", order=3, color="#3B82F6", probability_default=25, required_elements=["economic_buyer_identified", "coach_identified"]),
            BlueSheetStage(id="proposal", name="Proposal", order=4, color="#F59E0B", probability_default=50, required_elements=["clear_business_results"]),
            BlueSheetStage(id="negotiation", name="Negotiation", order=5, color="#F97316", probability_default=75, required_elements=["quantifiable_value", "next_steps_defined"]),
            BlueSheetStage(id="closed_won", name="Closed Won", order=6, color="#10B981", probability_default=100, is_won=True),
            BlueSheetStage(id="closed_lost", name="Closed Lost", order=7, color="#EF4444", probability_default=0, is_lost=True),
        ],
        probability_formula="weighted_sum",
        max_score=100,
        ai_enhancement_enabled=True
    )


def get_default_llm_config() -> LLMConfig:
    """Return default LLM configuration"""
    return LLMConfig(
        default_provider="openai",
        providers=[
            LLMProviderConfig(
                provider="openai",
                model="gpt-4o",
                api_key_env="EMERGENT_LLM_KEY",
                temperature=0.7,
                max_tokens=1000,
                is_enabled=True
            ),
        ],
        prompt_templates=[
            PromptTemplate(
                id="probability_analysis",
                name="Opportunity Probability Analysis",
                category="probability_analysis",
                system_prompt="You are a sales strategy expert specializing in B2B enterprise cybersecurity sales using Miller Heiman Blue Sheet methodology. Provide brief, actionable recommendations.",
                user_prompt_template="""Analyze this opportunity and provide probability insights:
                
Opportunity: {opportunity_name}
Value: ${opportunity_value}
Current Stage: {stage}
Blue Sheet Score: {score}

Analysis factors:
- Economic Buyer Status: {economic_buyer_status}
- Coach Engagement: {coach_status}
- Red Flags: {red_flags}
- Business Results: {business_results}

Provide 3 specific actionable recommendations to improve win probability.""",
                input_variables=["opportunity_name", "opportunity_value", "stage", "score", "economic_buyer_status", "coach_status", "red_flags", "business_results"],
                output_format="text",
                is_enabled=True
            ),
            PromptTemplate(
                id="sales_insights",
                name="Sales Pipeline Insights",
                category="insights",
                system_prompt="You are a sales analytics expert. Provide 3-4 brief, actionable insights based on the sales data provided. Be concise and specific.",
                user_prompt_template="""Analyze this sales data and provide insights:

User Role: {user_role}
Active Opportunities: {active_opportunities}
Total Pipeline Value: ${pipeline_value}
Won Deals: {won_deals}
Pending Activities: {pending_activities}

Focus on patterns, risks, and improvement opportunities.""",
                input_variables=["user_role", "active_opportunities", "pipeline_value", "won_deals", "pending_activities"],
                output_format="text",
                is_enabled=True
            ),
            PromptTemplate(
                id="email_analysis",
                name="Email Thread Analysis",
                category="email_analysis",
                system_prompt="You are an email analysis assistant. Extract key information from email threads related to sales opportunities.",
                user_prompt_template="""Analyze this email thread and suggest updates:

Email Subject: {subject}
Participants: {participants}
Content Summary: {content}

Related Opportunity: {opportunity_name}
Current Stage: {stage}

Suggest:
1. Activity to log
2. Opportunity stage update (if any)
3. Follow-up actions""",
                input_variables=["subject", "participants", "content", "opportunity_name", "stage"],
                output_format="json",
                is_enabled=True
            ),
        ],
        enable_caching=True,
        cache_ttl_minutes=60
    )


def get_default_ui_config() -> UIConfig:
    """Return default UI configuration"""
    return UIConfig(
        theme_mode="light",
        colors=ThemeColors(),
        typography=ThemeTypography(),
        branding=BrandingConfig(
            app_name="SalesCommand",
            tagline="Enterprise Sales Platform"
        ),
        sidebar_collapsed=False,
        compact_mode=False,
        animations_enabled=True
    )
