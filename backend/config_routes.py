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
            "modules": [m.model_dump() for m in get_default_modules()],
            "roles": [r.model_dump() for r in get_default_roles()],
            "blue_sheet": get_default_blue_sheet_config().model_dump(),
            "llm": get_default_llm_config().model_dump(),
            "incentives": {"rules": [], "payout_periods": ["monthly", "quarterly", "yearly"], "approval_required": True, "approval_roles": ["finance_manager", "ceo"]},
            "integrations": [],
            "ui": get_default_ui_config().model_dump(),
            "version": "1.0",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        await db.system_config.insert_one(config)
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
        
        await save_system_config(db, config, user["id"])
        return {"message": f"Configuration reset to defaults{f' for {section}' if section else ''}"}
    
    return api_router
