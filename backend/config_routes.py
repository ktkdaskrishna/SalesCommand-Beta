# ===================== SUPER ADMIN CONFIGURATION API ROUTES =====================
# This module provides API endpoints for the configuration system

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import secrets
import string

from config_models import (
    ModuleDefinition, ModuleFeature, ModuleFeatureAction,
    RoleDefinition, RolePermission,
    BlueSheetConfig, BlueSheetElement, BlueSheetStage,
    LLMConfig, LLMProviderConfig, PromptTemplate,
    IncentiveConfig, IncentiveRule,
    IntegrationConfig,
    UIConfig, ThemeColors, ThemeTypography, BrandingConfig,
    SystemConfig,
    OrganizationSettings, UserCreateByAdmin, UserUpdateByAdmin, UserFullResponse,
    AIAgentsConfig, AIAgentConfig, AIAgentType,
    get_default_modules, get_default_roles, get_default_blue_sheet_config,
    get_default_llm_config, get_default_ui_config, get_default_organization, get_default_ai_agents
)

config_router = APIRouter(prefix="/config", tags=["Configuration"])

# Import these from server.py when integrating
# from server import db, get_current_user, require_role, UserRole

# ===================== SYSTEM CONFIG ROUTES =====================

async def get_system_config(db) -> dict:
    """Get or create system configuration"""
    config = await db.system_config.find_one({"id": "system_config"}, {"_id": 0})
    if not config:
        # Initialize with defaults
        config = {
            "id": "system_config",
            "organization": get_default_organization().model_dump(),
            "modules": [m.model_dump() for m in get_default_modules()],
            "roles": [r.model_dump() for r in get_default_roles()],
            "blue_sheet": get_default_blue_sheet_config().model_dump(),
            "llm": get_default_llm_config().model_dump(),
            "ai_agents": get_default_ai_agents().model_dump(),
            "incentives": {"rules": [], "payout_periods": ["monthly", "quarterly", "yearly"], "approval_required": True, "approval_roles": ["finance_manager", "ceo"]},
            "integrations": [],
            "ui": get_default_ui_config().model_dump(),
            "version": "1.0",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        await db.system_config.insert_one(config)
    else:
        # Ensure new fields exist for backward compatibility
        if "organization" not in config:
            config["organization"] = get_default_organization().model_dump()
        if "ai_agents" not in config:
            config["ai_agents"] = get_default_ai_agents().model_dump()
    return config


async def save_system_config(db, config: dict, user_id: str):
    """Save system configuration"""
    config["updated_at"] = datetime.now(timezone.utc)
    config["updated_by"] = user_id
    await db.system_config.replace_one({"id": "system_config"}, config, upsert=True)
    
    # Log the change
    await db.audit_log.insert_one({
        "id": str(uuid.uuid4()),
        "entity_type": "system_config",
        "entity_id": "system_config",
        "action": "update",
        "user_id": user_id,
        "changes": {"updated": True},
        "created_at": datetime.now(timezone.utc)
    })


# ===================== PERMISSION CHECK HELPERS =====================

async def get_user_permissions(db, user_id: str) -> dict:
    """Get user's permissions based on their role"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return {"modules": {}, "features": {}, "actions": set()}
    
    config = await get_system_config(db)
    role_id = user.get("role", "account_manager")
    
    # Find role definition
    role_def = None
    for role in config.get("roles", []):
        if role["id"] == role_id:
            role_def = role
            break
    
    if not role_def:
        return {"modules": {}, "features": {}, "actions": set()}
    
    # Build permission map
    permissions = {
        "modules": {},
        "features": {},
        "actions": set()
    }
    
    for perm in role_def.get("permissions", []):
        module_id = perm["module_id"]
        feature_id = perm["feature_id"]
        action_ids = perm.get("action_ids", [])
        
        if module_id not in permissions["modules"]:
            permissions["modules"][module_id] = True
        
        feature_key = f"{module_id}.{feature_id}"
        permissions["features"][feature_key] = True
        
        for action_id in action_ids:
            permissions["actions"].add(action_id)
    
    permissions["actions"] = list(permissions["actions"])
    return permissions


def check_permission(permissions: dict, action_id: str) -> bool:
    """Check if user has specific permission"""
    return action_id in permissions.get("actions", [])


# ===================== API ENDPOINT FUNCTIONS =====================
# These will be integrated into the main server.py

def create_config_routes(api_router, db, get_current_user, require_role, UserRole):
    """Create all configuration routes"""
    
    # ===================== SYSTEM CONFIG =====================
    
    @api_router.get("/config/system")
    async def get_full_system_config(user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Get complete system configuration"""
        config = await get_system_config(db)
        return config
    
    @api_router.get("/config/user-permissions")
    async def get_current_user_permissions(user: dict = Depends(get_current_user)):
        """Get current user's permissions"""
        return await get_user_permissions(db, user["id"])
    
    @api_router.get("/config/user-config")
    async def get_user_config(user: dict = Depends(get_current_user)):
        """Get configuration relevant to current user"""
        config = await get_system_config(db)
        permissions = await get_user_permissions(db, user["id"])
        
        # Filter modules and features based on permissions
        visible_modules = []
        for module in config.get("modules", []):
            if module["id"] in permissions.get("modules", {}):
                visible_features = []
                for feature in module.get("features", []):
                    feature_key = f"{module['id']}.{feature['id']}"
                    if feature_key in permissions.get("features", {}):
                        visible_features.append(feature)
                
                if visible_features:
                    module_copy = dict(module)
                    module_copy["features"] = visible_features
                    visible_modules.append(module_copy)
        
        return {
            "modules": visible_modules,
            "ui": config.get("ui", {}),
            "permissions": permissions
        }
    
    # ===================== MODULE MANAGEMENT =====================
    
    @api_router.get("/config/modules")
    async def get_modules(user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Get all module definitions"""
        config = await get_system_config(db)
        return config.get("modules", [])
    
    @api_router.put("/config/modules/{module_id}")
    async def update_module(module_id: str, module_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Update a module definition"""
        config = await get_system_config(db)
        modules = config.get("modules", [])
        
        for i, m in enumerate(modules):
            if m["id"] == module_id:
                modules[i] = {**m, **module_data}
                break
        
        config["modules"] = modules
        await save_system_config(db, config, user["id"])
        return {"message": "Module updated"}
    
    @api_router.put("/config/modules/{module_id}/features/{feature_id}")
    async def update_feature(module_id: str, feature_id: str, feature_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Update a feature within a module"""
        config = await get_system_config(db)
        modules = config.get("modules", [])
        
        for module in modules:
            if module["id"] == module_id:
                for i, feature in enumerate(module.get("features", [])):
                    if feature["id"] == feature_id:
                        module["features"][i] = {**feature, **feature_data}
                        break
                break
        
        config["modules"] = modules
        await save_system_config(db, config, user["id"])
        return {"message": "Feature updated"}
    
    # ===================== ROLE MANAGEMENT =====================
    
    @api_router.get("/config/roles")
    async def get_roles(user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.CEO]))):
        """Get all role definitions"""
        config = await get_system_config(db)
        return config.get("roles", [])
    
    @api_router.post("/config/roles")
    async def create_role(role_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Create a new role"""
        config = await get_system_config(db)
        roles = config.get("roles", [])
        
        # Check for duplicate
        for r in roles:
            if r["id"] == role_data.get("id"):
                raise HTTPException(status_code=400, detail="Role ID already exists")
        
        new_role = {
            "id": role_data.get("id", str(uuid.uuid4())),
            "name": role_data["name"],
            "description": role_data.get("description", ""),
            "is_system_role": False,
            "permissions": role_data.get("permissions", []),
            "dashboard_config": role_data.get("dashboard_config"),
            "is_active": True
        }
        
        roles.append(new_role)
        config["roles"] = roles
        await save_system_config(db, config, user["id"])
        return new_role
    
    @api_router.put("/config/roles/{role_id}")
    async def update_role(role_id: str, role_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Update a role definition"""
        config = await get_system_config(db)
        roles = config.get("roles", [])
        
        for i, r in enumerate(roles):
            if r["id"] == role_id:
                # Don't allow changing is_system_role
                role_data["is_system_role"] = r.get("is_system_role", False)
                roles[i] = {**r, **role_data}
                break
        else:
            raise HTTPException(status_code=404, detail="Role not found")
        
        config["roles"] = roles
        await save_system_config(db, config, user["id"])
        
        # Update all users with this role to reflect new permissions
        return {"message": "Role updated"}
    
    @api_router.delete("/config/roles/{role_id}")
    async def delete_role(role_id: str, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Delete a role (only non-system roles)"""
        config = await get_system_config(db)
        roles = config.get("roles", [])
        
        for i, r in enumerate(roles):
            if r["id"] == role_id:
                if r.get("is_system_role"):
                    raise HTTPException(status_code=400, detail="Cannot delete system roles")
                roles.pop(i)
                break
        else:
            raise HTTPException(status_code=404, detail="Role not found")
        
        config["roles"] = roles
        await save_system_config(db, config, user["id"])
        return {"message": "Role deleted"}
    
    @api_router.put("/config/roles/{role_id}/permissions")
    async def update_role_permissions(role_id: str, permissions: List[dict], user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Update role permissions"""
        config = await get_system_config(db)
        roles = config.get("roles", [])
        
        for i, r in enumerate(roles):
            if r["id"] == role_id:
                roles[i]["permissions"] = permissions
                break
        else:
            raise HTTPException(status_code=404, detail="Role not found")
        
        config["roles"] = roles
        await save_system_config(db, config, user["id"])
        return {"message": "Permissions updated"}
    
    # ===================== BLUE SHEET CONFIGURATION =====================
    
    @api_router.get("/config/blue-sheet")
    async def get_blue_sheet_config(user: dict = Depends(get_current_user)):
        """Get Blue Sheet configuration"""
        config = await get_system_config(db)
        return config.get("blue_sheet", {})
    
    @api_router.put("/config/blue-sheet")
    async def update_blue_sheet_config(blue_sheet_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.CEO, UserRole.SALES_DIRECTOR]))):
        """Update Blue Sheet configuration"""
        config = await get_system_config(db)
        config["blue_sheet"] = blue_sheet_data
        await save_system_config(db, config, user["id"])
        return {"message": "Blue Sheet configuration updated"}
    
    @api_router.post("/config/blue-sheet/elements")
    async def add_blue_sheet_element(element_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Add a new Blue Sheet element"""
        config = await get_system_config(db)
        blue_sheet = config.get("blue_sheet", {"elements": [], "stages": []})
        
        new_element = {
            "id": element_data.get("id", str(uuid.uuid4())),
            "name": element_data["name"],
            "category": element_data["category"],
            "element_type": element_data.get("element_type", "checkbox"),
            "weight": element_data.get("weight", 10),
            "is_negative": element_data.get("is_negative", False),
            "options": element_data.get("options"),
            "description": element_data.get("description"),
            "is_enabled": True,
            "order": element_data.get("order", len(blue_sheet.get("elements", [])))
        }
        
        blue_sheet.setdefault("elements", []).append(new_element)
        config["blue_sheet"] = blue_sheet
        await save_system_config(db, config, user["id"])
        return new_element
    
    @api_router.put("/config/blue-sheet/elements/{element_id}")
    async def update_blue_sheet_element(element_id: str, element_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Update a Blue Sheet element"""
        config = await get_system_config(db)
        blue_sheet = config.get("blue_sheet", {})
        elements = blue_sheet.get("elements", [])
        
        for i, e in enumerate(elements):
            if e["id"] == element_id:
                elements[i] = {**e, **element_data}
                break
        
        blue_sheet["elements"] = elements
        config["blue_sheet"] = blue_sheet
        await save_system_config(db, config, user["id"])
        return {"message": "Element updated"}
    
    @api_router.put("/config/blue-sheet/stages")
    async def update_blue_sheet_stages(stages: List[dict], user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Update pipeline stages"""
        config = await get_system_config(db)
        blue_sheet = config.get("blue_sheet", {})
        blue_sheet["stages"] = stages
        config["blue_sheet"] = blue_sheet
        await save_system_config(db, config, user["id"])
        
        # Also update the pipeline_stages collection for backward compatibility
        await db.pipeline_stages.delete_many({})
        if stages:
            await db.pipeline_stages.insert_many([{**s, "_id": None} for s in stages])
        
        return {"message": "Stages updated"}
    
    # ===================== LLM CONFIGURATION =====================
    
    @api_router.get("/config/llm")
    async def get_llm_config(user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Get LLM configuration"""
        config = await get_system_config(db)
        return config.get("llm", {})
    
    @api_router.put("/config/llm")
    async def update_llm_config(llm_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Update LLM configuration"""
        config = await get_system_config(db)
        config["llm"] = llm_data
        await save_system_config(db, config, user["id"])
        return {"message": "LLM configuration updated"}
    
    @api_router.post("/config/llm/prompts")
    async def add_prompt_template(prompt_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Add a new prompt template"""
        config = await get_system_config(db)
        llm = config.get("llm", {"providers": [], "prompt_templates": []})
        
        new_prompt = {
            "id": prompt_data.get("id", str(uuid.uuid4())),
            "name": prompt_data["name"],
            "category": prompt_data["category"],
            "system_prompt": prompt_data["system_prompt"],
            "user_prompt_template": prompt_data["user_prompt_template"],
            "input_variables": prompt_data.get("input_variables", []),
            "output_format": prompt_data.get("output_format", "text"),
            "is_enabled": True
        }
        
        llm.setdefault("prompt_templates", []).append(new_prompt)
        config["llm"] = llm
        await save_system_config(db, config, user["id"])
        return new_prompt
    
    @api_router.put("/config/llm/prompts/{prompt_id}")
    async def update_prompt_template(prompt_id: str, prompt_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Update a prompt template"""
        config = await get_system_config(db)
        llm = config.get("llm", {})
        prompts = llm.get("prompt_templates", [])
        
        for i, p in enumerate(prompts):
            if p["id"] == prompt_id:
                prompts[i] = {**p, **prompt_data}
                break
        
        llm["prompt_templates"] = prompts
        config["llm"] = llm
        await save_system_config(db, config, user["id"])
        return {"message": "Prompt template updated"}
    
    # ===================== INCENTIVE CONFIGURATION =====================
    
    @api_router.get("/config/incentives")
    async def get_incentive_config(user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.CEO, UserRole.SALES_DIRECTOR, UserRole.FINANCE_MANAGER]))):
        """Get incentive configuration"""
        config = await get_system_config(db)
        return config.get("incentives", {})
    
    @api_router.put("/config/incentives")
    async def update_incentive_config(incentive_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.CEO, UserRole.SALES_DIRECTOR, UserRole.FINANCE_MANAGER]))):
        """Update incentive configuration"""
        config = await get_system_config(db)
        config["incentives"] = incentive_data
        await save_system_config(db, config, user["id"])
        return {"message": "Incentive configuration updated"}
    
    # ===================== INTEGRATION CONFIGURATION =====================
    
    @api_router.get("/config/integrations")
    async def get_integrations_config(user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Get all integration configurations"""
        config = await get_system_config(db)
        return config.get("integrations", [])
    
    @api_router.put("/config/integrations")
    async def update_integrations_config(integrations_data: List[dict], user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Update integration configurations"""
        config = await get_system_config(db)
        config["integrations"] = integrations_data
        await save_system_config(db, config, user["id"])
        return {"message": "Integrations configuration updated"}
    
    @api_router.put("/config/integrations/{integration_id}")
    async def update_integration(integration_id: str, integration_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Update a specific integration"""
        config = await get_system_config(db)
        integrations = config.get("integrations", [])
        
        found = False
        for i, intg in enumerate(integrations):
            if intg["id"] == integration_id:
                integrations[i] = {**intg, **integration_data}
                found = True
                break
        
        if not found:
            # Add new integration
            integration_data["id"] = integration_id
            integrations.append(integration_data)
        
        config["integrations"] = integrations
        await save_system_config(db, config, user["id"])
        return {"message": "Integration updated"}
    
    # ===================== UI CONFIGURATION =====================
    
    @api_router.get("/config/ui")
    async def get_ui_config(user: dict = Depends(get_current_user)):
        """Get UI configuration (available to all users)"""
        config = await get_system_config(db)
        return config.get("ui", {})
    
    @api_router.put("/config/ui")
    async def update_ui_config(ui_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Update UI configuration"""
        config = await get_system_config(db)
        config["ui"] = ui_data
        await save_system_config(db, config, user["id"])
        return {"message": "UI configuration updated"}
    
    @api_router.put("/config/ui/theme")
    async def update_theme(theme_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Update theme colors"""
        config = await get_system_config(db)
        ui = config.get("ui", {})
        ui["colors"] = theme_data.get("colors", ui.get("colors", {}))
        ui["theme_mode"] = theme_data.get("theme_mode", ui.get("theme_mode", "light"))
        config["ui"] = ui
        await save_system_config(db, config, user["id"])
        return {"message": "Theme updated"}
    
    @api_router.put("/config/ui/branding")
    async def update_branding(branding_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Update branding configuration"""
        config = await get_system_config(db)
        ui = config.get("ui", {})
        ui["branding"] = branding_data
        config["ui"] = ui
        await save_system_config(db, config, user["id"])
        return {"message": "Branding updated"}
    
    # ===================== AUDIT LOG =====================
    
    @api_router.get("/config/audit-log")
    async def get_audit_log(limit: int = 100, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Get configuration audit log"""
        logs = await db.audit_log.find(
            {},
            {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(limit)
        return logs
    
    # ===================== INITIALIZATION =====================
    
    @api_router.post("/config/initialize")
    async def initialize_system_config(user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Initialize system configuration with defaults"""
        existing = await db.system_config.find_one({"id": "system_config"})
        if existing:
            raise HTTPException(status_code=400, detail="Configuration already exists")
        
        config = await get_system_config(db)
        return {"message": "System configuration initialized", "version": config.get("version")}
    
    @api_router.post("/config/reset-defaults")
    async def reset_to_defaults(section: Optional[str] = None, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Reset configuration to defaults"""
        config = await get_system_config(db)
        
        if section == "modules" or section is None:
            config["modules"] = [m.model_dump() for m in get_default_modules()]
        if section == "roles" or section is None:
            config["roles"] = [r.model_dump() for r in get_default_roles()]
        if section == "blue_sheet" or section is None:
            config["blue_sheet"] = get_default_blue_sheet_config().model_dump()
        if section == "llm" or section is None:
            config["llm"] = get_default_llm_config().model_dump()
        if section == "ui" or section is None:
            config["ui"] = get_default_ui_config().model_dump()
        if section == "ai_agents" or section is None:
            config["ai_agents"] = get_default_ai_agents().model_dump()
        if section == "organization" or section is None:
            config["organization"] = get_default_organization().model_dump()
        
        await save_system_config(db, config, user["id"])
        return {"message": f"Configuration reset to defaults{f' for {section}' if section else ''}"}
    
    # ===================== ORGANIZATION MANAGEMENT =====================
    
    @api_router.get("/config/organization")
    async def get_organization(user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.CEO]))):
        """Get organization settings"""
        config = await get_system_config(db)
        return config.get("organization", get_default_organization().model_dump())
    
    @api_router.put("/config/organization")
    async def update_organization(org_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Update organization settings"""
        config = await get_system_config(db)
        org = config.get("organization", {})
        
        # Update only provided fields
        for key, value in org_data.items():
            if key not in ["id", "created_at"]:  # Protect immutable fields
                org[key] = value
        
        org["updated_at"] = datetime.now(timezone.utc).isoformat()
        config["organization"] = org
        await save_system_config(db, config, user["id"])
        return {"message": "Organization settings updated", "organization": org}
    
    # ===================== USER MANAGEMENT (ADMIN) =====================
    
    @api_router.get("/config/users")
    async def get_all_users_admin(user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.CEO]))):
        """Get all users with full details for admin"""
        users_cursor = db.users.find({}, {"_id": 0, "hashed_password": 0})
        users = await users_cursor.to_list(1000)
        
        # Enrich with manager names and commission template names
        for u in users:
            if u.get("manager_id"):
                manager = await db.users.find_one({"id": u["manager_id"]}, {"_id": 0, "name": 1})
                u["manager_name"] = manager.get("name") if manager else None
            if u.get("commission_template_id"):
                template = await db.commission_templates.find_one({"id": u["commission_template_id"]}, {"_id": 0, "name": 1})
                u["commission_template_name"] = template.get("name") if template else None
        
        return users
    
    @api_router.post("/config/users")
    async def create_user_admin(user_data: UserCreateByAdmin, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Create a new user (admin only)"""
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")
        
        # Check if email already exists
        existing = await db.users.find_one({"email": user_data.email})
        if existing:
            raise HTTPException(status_code=400, detail="User with this email already exists")
        
        # Validate role exists
        config = await get_system_config(db)
        role_ids = [r["id"] for r in config.get("roles", [])]
        if user_data.role not in role_ids:
            raise HTTPException(status_code=400, detail=f"Invalid role. Valid roles: {role_ids}")
        
        # Generate password if not provided
        password = user_data.password or ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(12))
        
        new_user = {
            "id": str(uuid.uuid4()),
            "email": user_data.email,
            "name": user_data.name,
            "role": user_data.role,
            "hashed_password": pwd_context.hash(password),
            "department": user_data.department,
            "product_line": user_data.product_line,
            "manager_id": user_data.manager_id,
            "quota": user_data.quota,
            "commission_template_id": user_data.commission_template_id,
            "is_active": user_data.is_active,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        await db.users.insert_one(new_user)
        
        # Log the action
        await db.audit_log.insert_one({
            "id": str(uuid.uuid4()),
            "entity_type": "user",
            "entity_id": new_user["id"],
            "action": "create",
            "user_id": user["id"],
            "changes": {"email": user_data.email, "role": user_data.role},
            "created_at": datetime.now(timezone.utc)
        })
        
        # Return without sensitive data
        del new_user["hashed_password"]
        new_user["_id"] = None
        del new_user["_id"]
        new_user["generated_password"] = password if not user_data.password else None
        
        return {"message": "User created successfully", "user": new_user}
    
    @api_router.put("/config/users/{user_id}")
    async def update_user_admin(user_id: str, user_data: UserUpdateByAdmin, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Update a user (admin only)"""
        target_user = await db.users.find_one({"id": user_id})
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Validate role if provided
        if user_data.role:
            config = await get_system_config(db)
            role_ids = [r["id"] for r in config.get("roles", [])]
            if user_data.role not in role_ids:
                raise HTTPException(status_code=400, detail=f"Invalid role. Valid roles: {role_ids}")
        
        update_data = {k: v for k, v in user_data.model_dump().items() if v is not None}
        if update_data:
            update_data["updated_at"] = datetime.now(timezone.utc)
            await db.users.update_one({"id": user_id}, {"$set": update_data})
            
            # Log the action
            await db.audit_log.insert_one({
                "id": str(uuid.uuid4()),
                "entity_type": "user",
                "entity_id": user_id,
                "action": "update",
                "user_id": user["id"],
                "changes": update_data,
                "created_at": datetime.now(timezone.utc)
            })
        
        return {"message": "User updated successfully"}
    
    @api_router.delete("/config/users/{user_id}")
    async def delete_user_admin(user_id: str, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Delete a user (admin only) - soft delete by setting is_active=False"""
        target_user = await db.users.find_one({"id": user_id})
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Prevent self-deletion
        if user_id == user["id"]:
            raise HTTPException(status_code=400, detail="Cannot delete your own account")
        
        # Soft delete
        await db.users.update_one({"id": user_id}, {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}})
        
        # Log the action
        await db.audit_log.insert_one({
            "id": str(uuid.uuid4()),
            "entity_type": "user",
            "entity_id": user_id,
            "action": "delete",
            "user_id": user["id"],
            "changes": {"is_active": False},
            "created_at": datetime.now(timezone.utc)
        })
        
        return {"message": "User deactivated successfully"}
    
    @api_router.post("/config/users/{user_id}/reset-password")
    async def reset_user_password(user_id: str, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Reset a user's password (admin only)"""
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")
        
        target_user = await db.users.find_one({"id": user_id})
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Generate new password
        new_password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(12))
        hashed = pwd_context.hash(new_password)
        
        await db.users.update_one({"id": user_id}, {"$set": {"hashed_password": hashed, "updated_at": datetime.now(timezone.utc)}})
        
        # Log the action
        await db.audit_log.insert_one({
            "id": str(uuid.uuid4()),
            "entity_type": "user",
            "entity_id": user_id,
            "action": "password_reset",
            "user_id": user["id"],
            "changes": {"password_reset": True},
            "created_at": datetime.now(timezone.utc)
        })
        
        return {"message": "Password reset successfully", "new_password": new_password}
    
    @api_router.put("/config/users/{user_id}/role")
    async def assign_role(user_id: str, role_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Assign a role to a user"""
        target_user = await db.users.find_one({"id": user_id})
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        new_role = role_data.get("role")
        if not new_role:
            raise HTTPException(status_code=400, detail="Role is required")
        
        # Validate role exists
        config = await get_system_config(db)
        role_ids = [r["id"] for r in config.get("roles", [])]
        if new_role not in role_ids:
            raise HTTPException(status_code=400, detail=f"Invalid role. Valid roles: {role_ids}")
        
        old_role = target_user.get("role")
        await db.users.update_one({"id": user_id}, {"$set": {"role": new_role, "updated_at": datetime.now(timezone.utc)}})
        
        # Log the action
        await db.audit_log.insert_one({
            "id": str(uuid.uuid4()),
            "entity_type": "user",
            "entity_id": user_id,
            "action": "role_change",
            "user_id": user["id"],
            "changes": {"old_role": old_role, "new_role": new_role},
            "created_at": datetime.now(timezone.utc)
        })
        
        return {"message": f"Role changed from {old_role} to {new_role}"}
    
    # ===================== AI AGENTS CONFIGURATION =====================
    
    @api_router.get("/config/ai-agents")
    async def get_ai_agents(user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Get AI agents configuration"""
        config = await get_system_config(db)
        return config.get("ai_agents", get_default_ai_agents().model_dump())
    
    @api_router.put("/config/ai-agents")
    async def update_ai_agents(agents_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Update AI agents configuration"""
        config = await get_system_config(db)
        config["ai_agents"] = agents_data
        await save_system_config(db, config, user["id"])
        return {"message": "AI agents configuration updated"}
    
    @api_router.get("/config/ai-agents/{agent_id}")
    async def get_ai_agent(agent_id: str, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Get a specific AI agent configuration"""
        config = await get_system_config(db)
        agents = config.get("ai_agents", {}).get("agents", [])
        agent = next((a for a in agents if a["id"] == agent_id), None)
        if not agent:
            raise HTTPException(status_code=404, detail="AI agent not found")
        return agent
    
    @api_router.post("/config/ai-agents")
    async def create_ai_agent(agent_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Create a new AI agent"""
        config = await get_system_config(db)
        ai_agents = config.get("ai_agents", get_default_ai_agents().model_dump())
        
        # Validate required fields
        required_fields = ["name", "agent_type", "system_prompt", "user_prompt_template"]
        for field in required_fields:
            if not agent_data.get(field):
                raise HTTPException(status_code=400, detail=f"{field} is required")
        
        # Generate ID if not provided
        if not agent_data.get("id"):
            agent_data["id"] = agent_data["name"].lower().replace(" ", "_")
        
        # Check for duplicate ID
        existing_ids = [a["id"] for a in ai_agents.get("agents", [])]
        if agent_data["id"] in existing_ids:
            raise HTTPException(status_code=400, detail="Agent with this ID already exists")
        
        # Set defaults
        agent_data.setdefault("is_enabled", True)
        agent_data.setdefault("llm_provider", "openai")
        agent_data.setdefault("model", "gpt-4o")
        agent_data.setdefault("temperature", 0.7)
        agent_data.setdefault("max_tokens", 1000)
        agent_data.setdefault("trigger_type", "manual")
        agent_data.setdefault("rate_limit_per_user", 50)
        agent_data.setdefault("cache_enabled", True)
        agent_data.setdefault("cache_ttl_minutes", 60)
        
        ai_agents["agents"].append(agent_data)
        config["ai_agents"] = ai_agents
        await save_system_config(db, config, user["id"])
        
        return {"message": "AI agent created", "agent": agent_data}
    
    @api_router.put("/config/ai-agents/{agent_id}")
    async def update_ai_agent(agent_id: str, agent_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Update an AI agent"""
        config = await get_system_config(db)
        ai_agents = config.get("ai_agents", {})
        agents = ai_agents.get("agents", [])
        
        agent_idx = next((i for i, a in enumerate(agents) if a["id"] == agent_id), None)
        if agent_idx is None:
            raise HTTPException(status_code=404, detail="AI agent not found")
        
        # Update agent
        for key, value in agent_data.items():
            if key != "id":  # Don't allow ID change
                agents[agent_idx][key] = value
        
        ai_agents["agents"] = agents
        config["ai_agents"] = ai_agents
        await save_system_config(db, config, user["id"])
        
        return {"message": "AI agent updated", "agent": agents[agent_idx]}
    
    @api_router.delete("/config/ai-agents/{agent_id}")
    async def delete_ai_agent(agent_id: str, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Delete an AI agent"""
        config = await get_system_config(db)
        ai_agents = config.get("ai_agents", {})
        agents = ai_agents.get("agents", [])
        
        original_len = len(agents)
        agents = [a for a in agents if a["id"] != agent_id]
        
        if len(agents) == original_len:
            raise HTTPException(status_code=404, detail="AI agent not found")
        
        ai_agents["agents"] = agents
        config["ai_agents"] = ai_agents
        await save_system_config(db, config, user["id"])
        
        return {"message": "AI agent deleted"}
    
    @api_router.post("/config/ai-agents/{agent_id}/test")
    async def test_ai_agent(agent_id: str, test_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Test an AI agent with sample data"""
        import os
        
        config = await get_system_config(db)
        agents = config.get("ai_agents", {}).get("agents", [])
        agent = next((a for a in agents if a["id"] == agent_id), None)
        if not agent:
            raise HTTPException(status_code=404, detail="AI agent not found")
        
        # Get LLM config
        llm_config = config.get("llm", {})
        providers = llm_config.get("providers", [])
        provider = next((p for p in providers if p.get("provider") == agent.get("llm_provider") and p.get("is_enabled")), None)
        
        if not provider:
            return {"success": False, "error": "LLM provider not configured or disabled"}
        
        try:
            # Get API key from environment
            api_key = os.environ.get(provider.get("api_key_env", "EMERGENT_LLM_KEY"))
            if not api_key:
                return {"success": False, "error": f"API key not found in environment variable: {provider.get('api_key_env')}"}
            
            # Format the prompt with test data
            user_prompt = agent.get("user_prompt_template", "")
            for key, value in test_data.items():
                user_prompt = user_prompt.replace("{" + key + "}", str(value))
            
            # Make API call based on provider
            if provider.get("provider") == "openai":
                from emergentintegrations.llm.openai import chat as openai_chat
                response = await openai_chat(
                    api_key=api_key,
                    user_prompt=user_prompt,
                    system_prompt=agent.get("system_prompt", ""),
                    model=agent.get("model", "gpt-4o"),
                    temperature=agent.get("temperature", 0.7),
                    max_tokens=agent.get("max_tokens", 1000)
                )
                return {"success": True, "response": response, "agent": agent["name"]}
            else:
                return {"success": False, "error": f"Provider {provider.get('provider')} not supported for testing"}
                
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    @api_router.post("/config/llm/test-connection")
    async def test_llm_connection(provider_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Test LLM provider connection"""
        import os
        
        provider = provider_data.get("provider", "openai")
        api_key_env = provider_data.get("api_key_env", "EMERGENT_LLM_KEY")
        model = provider_data.get("model", "gpt-4o")
        
        api_key = os.environ.get(api_key_env)
        if not api_key:
            return {"success": False, "error": f"API key not found: {api_key_env}"}
        
        try:
            if provider == "openai":
                from emergentintegrations.llm.openai import chat as openai_chat
                response = await openai_chat(
                    api_key=api_key,
                    user_prompt="Say 'Connection successful!' in exactly 3 words.",
                    system_prompt="You are a test assistant. Be concise.",
                    model=model,
                    max_tokens=20
                )
                return {"success": True, "response": response, "provider": provider, "model": model}
            else:
                return {"success": False, "error": f"Provider {provider} not supported"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    return api_router
