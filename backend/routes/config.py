"""
Role Configuration Routes
API endpoints for managing roles, navigation, and dashboard configuration
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime, timezone
import uuid
import logging

from core.database import Database
from services.auth.jwt_handler import get_current_user_from_token
from middleware.rbac import require_approved

router = APIRouter(prefix="/config", tags=["Configuration"])
logger = logging.getLogger(__name__)

# ===================== MODELS =====================

class NavigationItem(BaseModel):
    id: str
    label: str
    icon: str
    path: str
    enabled: bool = True
    order: int = 0

class DashboardWidget(BaseModel):
    widget: str
    x: int
    y: int
    w: int
    h: int

class RoleNavigationConfig(BaseModel):
    main_menu: List[NavigationItem] = []
    admin_menu: List[NavigationItem] = []

class RoleDashboardConfig(BaseModel):
    layout: List[DashboardWidget] = []

class RoleIncentiveConfig(BaseModel):
    commission_template_id: Optional[str] = None
    show_earnings: bool = True
    show_team_earnings: bool = False

class RoleConfigUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    data_scope: Optional[str] = None
    permissions: Optional[List[str]] = None
    navigation: Optional[RoleNavigationConfig] = None
    default_dashboard: Optional[RoleDashboardConfig] = None
    incentive_config: Optional[RoleIncentiveConfig] = None

class RoleCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    data_scope: str = "own"
    permissions: List[str] = []
    navigation: Optional[RoleNavigationConfig] = None
    default_dashboard: Optional[RoleDashboardConfig] = None
    incentive_config: Optional[RoleIncentiveConfig] = None

class UserDashboardLayout(BaseModel):
    layout: List[DashboardWidget]

# ===================== DEFAULT CONFIGURATIONS =====================

DEFAULT_NAV_ITEMS = [
    {"id": "dashboard", "label": "Dashboard", "icon": "LayoutDashboard", "path": "/dashboard", "order": 1},
    {"id": "accounts", "label": "Accounts", "icon": "Building2", "path": "/accounts", "order": 2},
    {"id": "opportunities", "label": "Opportunities", "icon": "Target", "path": "/opportunities", "order": 3},
    {"id": "kpis", "label": "KPIs", "icon": "BarChart3", "path": "/kpis", "order": 4},
    {"id": "email", "label": "Email", "icon": "Mail", "path": "/email", "order": 5},
    {"id": "reports", "label": "Reports", "icon": "FileText", "path": "/reports", "order": 6},
]

ADMIN_NAV_ITEMS = [
    {"id": "system-config", "label": "System Config", "icon": "Settings", "path": "/admin", "order": 1},
    {"id": "integrations", "label": "Integrations", "icon": "Plug2", "path": "/integrations", "order": 2},
    {"id": "data-lake", "label": "Data Lake", "icon": "Database", "path": "/data-lake", "order": 3},
    {"id": "field-mapping", "label": "Field Mapping", "icon": "Wand2", "path": "/field-mapping", "order": 4},
]

# Widget definitions for the registry
WIDGET_REGISTRY = {
    # KPI Cards
    "pipeline_value": {"name": "Pipeline Value", "category": "kpi", "minW": 2, "minH": 2, "description": "Total active pipeline value"},
    "won_revenue": {"name": "Won Revenue", "category": "kpi", "minW": 2, "minH": 2, "description": "Revenue from closed deals"},
    "quota_gauge": {"name": "Quota Attainment", "category": "kpi", "minW": 2, "minH": 2, "description": "Progress towards quota"},
    "active_opportunities": {"name": "Active Opportunities", "category": "kpi", "minW": 2, "minH": 2, "description": "Count of open deals"},
    "activity_completion": {"name": "Activity Completion", "category": "kpi", "minW": 2, "minH": 2, "description": "Task completion rate"},
    "win_rate": {"name": "Win Rate", "category": "kpi", "minW": 2, "minH": 2, "description": "Deal win percentage"},
    
    # Charts
    "pipeline_by_stage": {"name": "Pipeline by Stage", "category": "chart", "minW": 4, "minH": 3, "description": "Deals grouped by stage"},
    "revenue_by_product": {"name": "Revenue by Service Line", "category": "chart", "minW": 4, "minH": 3, "description": "Revenue breakdown by product"},
    "win_rate_trend": {"name": "Win Rate Trend", "category": "chart", "minW": 4, "minH": 3, "description": "Win rate over time"},
    "forecast_vs_actual": {"name": "Forecast vs Actual", "category": "chart", "minW": 6, "minH": 3, "description": "Projected vs actual revenue"},
    "monthly_revenue": {"name": "Monthly Revenue", "category": "chart", "minW": 4, "minH": 3, "description": "Revenue trend by month"},
    
    # Lists
    "upcoming_activities": {"name": "Upcoming Activities", "category": "list", "minW": 3, "minH": 4, "description": "Pending tasks and meetings"},
    "recent_emails": {"name": "Recent Emails", "category": "list", "minW": 3, "minH": 4, "description": "Latest email messages"},
    "team_leaderboard": {"name": "Team Leaderboard", "category": "list", "minW": 4, "minH": 4, "description": "Top performers ranking"},
    "collection_aging": {"name": "Collection Aging", "category": "list", "minW": 4, "minH": 3, "description": "Outstanding payments by age"},
    "recent_opportunities": {"name": "Recent Opportunities", "category": "list", "minW": 4, "minH": 3, "description": "Latest deals created/updated"},
    
    # Mini Kanban
    "pipeline_kanban": {"name": "Pipeline Mini Kanban", "category": "kanban", "minW": 8, "minH": 5, "description": "Compact pipeline view"},
}

DEFAULT_SALES_DASHBOARD = [
    {"widget": "pipeline_value", "x": 0, "y": 0, "w": 3, "h": 2},
    {"widget": "won_revenue", "x": 3, "y": 0, "w": 3, "h": 2},
    {"widget": "active_opportunities", "x": 6, "y": 0, "w": 3, "h": 2},
    {"widget": "activity_completion", "x": 9, "y": 0, "w": 3, "h": 2},
    {"widget": "pipeline_kanban", "x": 0, "y": 2, "w": 8, "h": 5},
    {"widget": "upcoming_activities", "x": 8, "y": 2, "w": 4, "h": 5},
]

DEFAULT_EXECUTIVE_DASHBOARD = [
    {"widget": "pipeline_value", "x": 0, "y": 0, "w": 3, "h": 2},
    {"widget": "won_revenue", "x": 3, "y": 0, "w": 3, "h": 2},
    {"widget": "quota_gauge", "x": 6, "y": 0, "w": 3, "h": 2},
    {"widget": "win_rate", "x": 9, "y": 0, "w": 3, "h": 2},
    {"widget": "pipeline_by_stage", "x": 0, "y": 2, "w": 6, "h": 4},
    {"widget": "revenue_by_product", "x": 6, "y": 2, "w": 6, "h": 4},
    {"widget": "team_leaderboard", "x": 0, "y": 6, "w": 6, "h": 4},
    {"widget": "forecast_vs_actual", "x": 6, "y": 6, "w": 6, "h": 4},
]

# ===================== WIDGET REGISTRY =====================

@router.get("/widgets")
async def get_widget_registry(
    token_data: dict = Depends(require_approved())
):
    """Get all available dashboard widgets"""
    return {
        "widgets": WIDGET_REGISTRY,
        "categories": ["kpi", "chart", "list", "kanban"]
    }

# ===================== NAVIGATION ITEMS =====================

@router.get("/navigation-items")
async def get_available_navigation_items(
    token_data: dict = Depends(require_approved())
):
    """Get all available navigation items for role configuration"""
    return {
        "main_menu": DEFAULT_NAV_ITEMS,
        "admin_menu": ADMIN_NAV_ITEMS
    }

# ===================== ROLE CONFIGURATION =====================

@router.get("/roles")
async def get_all_roles(
    token_data: dict = Depends(require_approved())
):
    """Get all roles with their configurations"""
    db = Database.get_db()
    roles = await db.roles.find({}, {"_id": 0}).to_list(100)
    return roles

@router.get("/roles/{role_id}")
async def get_role_config(
    role_id: str,
    token_data: dict = Depends(require_approved())
):
    """Get a specific role's configuration"""
    db = Database.get_db()
    role = await db.roles.find_one({"id": role_id}, {"_id": 0})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return role

@router.post("/roles")
async def create_role(
    data: RoleCreate,
    token_data: dict = Depends(require_approved())
):
    """Create a new role with full configuration"""
    db = Database.get_db()
    
    # Check if code exists
    existing = await db.roles.find_one({"code": data.code})
    if existing:
        raise HTTPException(status_code=400, detail="Role code already exists")
    
    now = datetime.now(timezone.utc)
    role_id = str(uuid.uuid4())
    
    # Set default navigation if not provided
    navigation = data.navigation.model_dump() if data.navigation else {
        "main_menu": [{"id": item["id"], **item, "enabled": True} for item in DEFAULT_NAV_ITEMS],
        "admin_menu": []
    }
    
    # Set default dashboard if not provided
    default_dashboard = data.default_dashboard.model_dump() if data.default_dashboard else {
        "layout": DEFAULT_SALES_DASHBOARD
    }
    
    # Set default incentive config
    incentive_config = data.incentive_config.model_dump() if data.incentive_config else {
        "commission_template_id": None,
        "show_earnings": True,
        "show_team_earnings": False
    }
    
    role = {
        "id": role_id,
        "code": data.code,
        "name": data.name,
        "description": data.description,
        "data_scope": data.data_scope,
        "permissions": data.permissions,
        "navigation": navigation,
        "default_dashboard": default_dashboard,
        "incentive_config": incentive_config,
        "is_system": False,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
        "created_by": token_data["id"]
    }
    
    await db.roles.insert_one(role)
    role.pop("_id", None)
    return role

@router.put("/roles/{role_id}")
async def update_role_config(
    role_id: str,
    data: RoleConfigUpdate,
    token_data: dict = Depends(require_approved())
):
    """Update a role's configuration (navigation, dashboard, permissions, etc.)"""
    db = Database.get_db()
    
    role = await db.roles.find_one({"id": role_id})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    update_data = {"updated_at": datetime.now(timezone.utc)}
    
    if data.name is not None:
        update_data["name"] = data.name
    if data.description is not None:
        update_data["description"] = data.description
    if data.data_scope is not None:
        update_data["data_scope"] = data.data_scope
    if data.permissions is not None:
        update_data["permissions"] = data.permissions
    if data.navigation is not None:
        update_data["navigation"] = data.navigation.model_dump()
    if data.default_dashboard is not None:
        update_data["default_dashboard"] = data.default_dashboard.model_dump()
    if data.incentive_config is not None:
        update_data["incentive_config"] = data.incentive_config.model_dump()
    
    await db.roles.update_one({"id": role_id}, {"$set": update_data})
    
    updated_role = await db.roles.find_one({"id": role_id}, {"_id": 0})
    return updated_role

@router.delete("/roles/{role_id}")
async def delete_role(
    role_id: str,
    token_data: dict = Depends(require_approved())
):
    """Delete a role (cannot delete system roles)"""
    db = Database.get_db()
    
    role = await db.roles.find_one({"id": role_id})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    if role.get("is_system"):
        raise HTTPException(status_code=400, detail="Cannot delete system roles")
    
    # Check if any users have this role
    user_count = await db.users.count_documents({"role_id": role_id})
    if user_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete role: {user_count} users assigned")
    
    await db.roles.delete_one({"id": role_id})
    return {"message": "Role deleted"}

# ===================== USER DASHBOARD PREFERENCES =====================

@router.get("/user/dashboard")
async def get_user_dashboard_layout(
    token_data: dict = Depends(require_approved())
):
    """Get current user's dashboard layout (or role default)"""
    db = Database.get_db()
    user_id = token_data["id"]
    
    # Check for user-specific layout
    user_pref = await db.user_preferences.find_one(
        {"user_id": user_id, "type": "dashboard_layout"},
        {"_id": 0}
    )
    
    if user_pref:
        return {
            "layout": user_pref.get("layout", []),
            "source": "user"
        }
    
    # Fall back to role default
    user = await db.users.find_one({"id": user_id}, {"role_id": 1})
    if user and user.get("role_id"):
        role = await db.roles.find_one({"id": user["role_id"]}, {"_id": 0})
        if role and role.get("default_dashboard"):
            return {
                "layout": role["default_dashboard"].get("layout", DEFAULT_SALES_DASHBOARD),
                "source": "role"
            }
    
    # Ultimate fallback
    return {
        "layout": DEFAULT_SALES_DASHBOARD,
        "source": "default"
    }

@router.put("/user/dashboard")
async def save_user_dashboard_layout(
    data: UserDashboardLayout,
    token_data: dict = Depends(require_approved())
):
    """Save user's custom dashboard layout"""
    db = Database.get_db()
    user_id = token_data["id"]
    now = datetime.now(timezone.utc)
    
    await db.user_preferences.update_one(
        {"user_id": user_id, "type": "dashboard_layout"},
        {"$set": {
            "user_id": user_id,
            "type": "dashboard_layout",
            "layout": [w.model_dump() for w in data.layout],
            "updated_at": now
        }},
        upsert=True
    )
    
    return {"message": "Dashboard layout saved", "layout": data.layout}

@router.delete("/user/dashboard")
async def reset_user_dashboard_layout(
    token_data: dict = Depends(require_approved())
):
    """Reset user's dashboard to role default"""
    db = Database.get_db()
    user_id = token_data["id"]
    
    await db.user_preferences.delete_one(
        {"user_id": user_id, "type": "dashboard_layout"}
    )
    
    return {"message": "Dashboard reset to default"}

# ===================== USER NAVIGATION =====================

@router.get("/user/navigation")
async def get_user_navigation(
    token_data: dict = Depends(require_approved())
):
    """Get navigation items for current user based on their role"""
    db = Database.get_db()
    user_id = token_data["id"]
    
    user = await db.users.find_one({"id": user_id}, {"role_id": 1, "is_super_admin": 1})
    
    # Super admin gets everything
    if user and user.get("is_super_admin"):
        return {
            "main_menu": [{"id": item["id"], **item, "enabled": True} for item in DEFAULT_NAV_ITEMS],
            "admin_menu": [{"id": item["id"], **item, "enabled": True} for item in ADMIN_NAV_ITEMS]
        }
    
    # Get role-specific navigation
    if user and user.get("role_id"):
        role = await db.roles.find_one({"id": user["role_id"]}, {"_id": 0})
        if role and role.get("navigation"):
            return role["navigation"]
    
    # Default navigation (no admin)
    return {
        "main_menu": [{"id": item["id"], **item, "enabled": True} for item in DEFAULT_NAV_ITEMS],
        "admin_menu": []
    }

# ===================== SERVICE LINES (PRODUCT LINES) =====================

@router.get("/service-lines")
async def get_service_lines(
    token_data: dict = Depends(require_approved())
):
    """Get all service/product lines"""
    db = Database.get_db()
    lines = await db.service_lines.find({}, {"_id": 0}).to_list(100)
    
    # Seed Securado defaults if none exist
    if not lines:
        default_lines = [
            {"id": str(uuid.uuid4()), "code": "MCD", "name": "Managed Cyber Defense", "commission_weight": 1.3, "is_recurring": True, "order": 1},
            {"id": str(uuid.uuid4()), "code": "ACS", "name": "Adaptive Cloud Security", "commission_weight": 1.2, "is_recurring": True, "order": 2},
            {"id": str(uuid.uuid4()), "code": "GRC", "name": "IT GRC Services", "commission_weight": 1.1, "is_recurring": False, "order": 3},
            {"id": str(uuid.uuid4()), "code": "CONSULTING", "name": "Security Consulting", "commission_weight": 1.0, "is_recurring": False, "order": 4},
            {"id": str(uuid.uuid4()), "code": "MSSP", "name": "Managed Security Services", "commission_weight": 1.25, "is_recurring": True, "order": 5},
            {"id": str(uuid.uuid4()), "code": "ACADEMY", "name": "Securado Academy", "commission_weight": 0.8, "is_recurring": False, "order": 6},
        ]
        now = datetime.now(timezone.utc)
        for line in default_lines:
            line["created_at"] = now
            line["is_active"] = True
        await db.service_lines.insert_many(default_lines)
        lines = default_lines
    
    return lines

@router.post("/service-lines")
async def create_service_line(
    code: str = Query(...),
    name: str = Query(...),
    commission_weight: float = Query(default=1.0),
    is_recurring: bool = Query(default=False),
    token_data: dict = Depends(require_approved())
):
    """Create a new service line"""
    db = Database.get_db()
    
    existing = await db.service_lines.find_one({"code": code})
    if existing:
        raise HTTPException(status_code=400, detail="Service line code already exists")
    
    now = datetime.now(timezone.utc)
    max_order = await db.service_lines.find_one(sort=[("order", -1)])
    next_order = (max_order.get("order", 0) + 1) if max_order else 1
    
    line = {
        "id": str(uuid.uuid4()),
        "code": code,
        "name": name,
        "commission_weight": commission_weight,
        "is_recurring": is_recurring,
        "is_active": True,
        "order": next_order,
        "created_at": now
    }
    
    await db.service_lines.insert_one(line)
    line.pop("_id", None)
    return line

@router.put("/service-lines/{line_id}")
async def update_service_line(
    line_id: str,
    name: Optional[str] = Query(default=None),
    commission_weight: Optional[float] = Query(default=None),
    is_recurring: Optional[bool] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    token_data: dict = Depends(require_approved())
):
    """Update a service line"""
    db = Database.get_db()
    
    update_data = {}
    if name is not None:
        update_data["name"] = name
    if commission_weight is not None:
        update_data["commission_weight"] = commission_weight
    if is_recurring is not None:
        update_data["is_recurring"] = is_recurring
    if is_active is not None:
        update_data["is_active"] = is_active
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No updates provided")
    
    result = await db.service_lines.update_one({"id": line_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Service line not found")
    
    updated = await db.service_lines.find_one({"id": line_id}, {"_id": 0})
    return updated

# ===================== PIPELINE STAGES =====================

@router.get("/pipeline-stages")
async def get_pipeline_stages(
    token_data: dict = Depends(require_approved())
):
    """Get all pipeline stages"""
    db = Database.get_db()
    stages = await db.pipeline_stages.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    return stages

@router.put("/pipeline-stages/{stage_id}")
async def update_pipeline_stage(
    stage_id: str,
    name: Optional[str] = Query(default=None),
    color: Optional[str] = Query(default=None),
    probability_default: Optional[int] = Query(default=None),
    order: Optional[int] = Query(default=None),
    token_data: dict = Depends(require_approved())
):
    """Update a pipeline stage"""
    db = Database.get_db()
    
    update_data = {}
    if name is not None:
        update_data["name"] = name
    if color is not None:
        update_data["color"] = color
    if probability_default is not None:
        update_data["probability_default"] = probability_default
    if order is not None:
        update_data["order"] = order
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No updates provided")
    
    result = await db.pipeline_stages.update_one({"id": stage_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Stage not found")
    
    updated = await db.pipeline_stages.find_one({"id": stage_id}, {"_id": 0})
    return updated

@router.post("/pipeline-stages")
async def create_pipeline_stage(
    name: str = Query(...),
    color: str = Query(default="#6B7280"),
    probability_default: int = Query(default=25),
    token_data: dict = Depends(require_approved())
):
    """Create a new pipeline stage"""
    db = Database.get_db()
    
    # Get max order
    max_stage = await db.pipeline_stages.find_one(sort=[("order", -1)])
    next_order = (max_stage.get("order", 0) + 1) if max_stage else 1
    
    stage = {
        "id": name.lower().replace(" ", "_"),
        "name": name,
        "color": color,
        "probability_default": probability_default,
        "order": next_order,
        "is_won": False,
        "is_lost": False
    }
    
    await db.pipeline_stages.insert_one(stage)
    stage.pop("_id", None)
    return stage
