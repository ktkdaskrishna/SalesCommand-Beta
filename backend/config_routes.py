# ===================== SUPER ADMIN CONFIGURATION API ROUTES =====================
# This module provides API endpoints for the configuration system

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
import secrets
import string
import os

from config_models import (
    ModuleDefinition, ModuleFeature, ModuleFeatureAction,
    RoleDefinition, RolePermission, DataAccessConfig, DataAccessLevel,
    BlueSheetConfig, BlueSheetElement, BlueSheetStage, BlueSheetContactRoleConfig,
    LLMConfig, PromptTemplate,
    LLMProvidersConfig, LLMProviderConfig, LLMProviderType,
    IncentiveConfig, IncentiveRule,
    IntegrationConfig,
    UIConfig, ThemeColors, ThemeTypography, BrandingConfig,
    SystemConfig,
    OrganizationSettings, UserCreateByAdmin, UserUpdateByAdmin, UserFullResponse,
    AIAgentsConfig, AIAgentConfig, AIAgentType,
    AIChatbotConfig,
    DepartmentsConfig, DepartmentConfig, TeamConfig,
    OrganizationContact,
    EmailConfig, UserInvitation,
    AccountFieldsConfig, AccountFieldDefinition, AccountSection, AccountLayoutConfig, FieldType,
    get_default_modules, get_default_roles, get_default_blue_sheet_config,
    get_default_llm_config, get_default_ui_config, get_default_organization, get_default_ai_agents,
    get_default_departments, get_default_llm_providers, get_default_contact_roles,
    get_default_email_config, get_default_chatbot_config, get_default_account_fields
)

config_router = APIRouter(prefix="/config", tags=["Configuration"])

# Import these from server.py when integrating
# from server import db, get_current_user, require_role, UserRole

# ===================== SYSTEM CONFIG ROUTES =====================

async def get_system_config(db) -> dict:
    """Get or create system configuration"""
    config = await db.system_config.find_one({"id": "system_config"}, {"_id": 0})
    if not config:
        # Initialize with defaults - Phase 3 enhanced config
        blue_sheet = get_default_blue_sheet_config().model_dump()
        blue_sheet["contact_roles"] = get_default_contact_roles().model_dump()
        
        config = {
            "id": "system_config",
            "organization": get_default_organization().model_dump(),
            "departments": get_default_departments().model_dump(),
            "account_fields": get_default_account_fields().model_dump(),
            "modules": [m.model_dump() for m in get_default_modules()],
            "roles": [r.model_dump() for r in get_default_roles()],
            "blue_sheet": blue_sheet,
            "llm": get_default_llm_config().model_dump(),
            "llm_providers": get_default_llm_providers().model_dump(),
            "ai_agents": get_default_ai_agents().model_dump(),
            "ai_chatbot": get_default_chatbot_config().model_dump(),
            "email": get_default_email_config().model_dump(),
            "incentives": {"rules": [], "payout_periods": ["monthly", "quarterly", "yearly"], "approval_required": True, "approval_roles": ["finance_manager", "ceo"]},
            "integrations": [],
            "ui": get_default_ui_config().model_dump(),
            "version": "3.0",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        await db.system_config.insert_one(config)
    else:
        # Ensure new fields exist for backward compatibility
        updated = False
        if "organization" not in config:
            config["organization"] = get_default_organization().model_dump()
            updated = True
        if "ai_agents" not in config:
            config["ai_agents"] = get_default_ai_agents().model_dump()
            updated = True
        if "departments" not in config:
            config["departments"] = get_default_departments().model_dump()
            updated = True
        if "llm_providers" not in config:
            config["llm_providers"] = get_default_llm_providers().model_dump()
            updated = True
        if "ai_chatbot" not in config:
            config["ai_chatbot"] = get_default_chatbot_config().model_dump()
            updated = True
        if "email" not in config:
            config["email"] = get_default_email_config().model_dump()
            updated = True
        if "account_fields" not in config:
            config["account_fields"] = get_default_account_fields().model_dump()
            updated = True
        if "blue_sheet" in config and "contact_roles" not in config["blue_sheet"]:
            config["blue_sheet"]["contact_roles"] = get_default_contact_roles().model_dump()
            updated = True
        if updated:
            await db.system_config.replace_one({"id": "system_config"}, config, upsert=True)
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
            "password_hash": pwd_context.hash(password),
            "department": user_data.department,
            "department_id": user_data.department_id,  # New field for department assignment
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
        del new_user["password_hash"]
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
        
        # Get fields that were explicitly set (exclude unset fields but include None values for nullable fields)
        update_data = user_data.model_dump(exclude_unset=True)
        
        # Handle nullable fields explicitly - allow setting them to None/null
        nullable_fields = ['department_id', 'department', 'manager_id', 'commission_template_id', 'product_line']
        for field in nullable_fields:
            if field in update_data:
                # Keep the value even if it's None (allowing removal)
                pass
            elif hasattr(user_data, field) and getattr(user_data, field) is None:
                # Field was explicitly set to None in request
                update_data[field] = None
        
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
        
        await db.users.update_one({"id": user_id}, {"$set": {"password_hash": hashed, "updated_at": datetime.now(timezone.utc)}})
        
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
    
    # ===================== DEPARTMENTS MANAGEMENT =====================
    
    @api_router.get("/config/departments")
    async def get_departments(user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.CEO]))):
        """Get all departments and teams"""
        config = await get_system_config(db)
        return config.get("departments", get_default_departments().model_dump())
    
    @api_router.put("/config/departments")
    async def update_departments(departments_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Update departments configuration"""
        config = await get_system_config(db)
        config["departments"] = departments_data
        await save_system_config(db, config, user["id"])
        return {"message": "Departments updated"}
    
    @api_router.post("/config/departments")
    async def create_department(dept_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Create a new department"""
        config = await get_system_config(db)
        departments = config.get("departments", {"departments": [], "teams": []})
        
        # Generate ID if not provided
        if not dept_data.get("id"):
            dept_data["id"] = dept_data["name"].lower().replace(" ", "_")
        
        # Check for duplicate
        existing_ids = [d["id"] for d in departments.get("departments", [])]
        if dept_data["id"] in existing_ids:
            raise HTTPException(status_code=400, detail="Department with this ID already exists")
        
        dept_data["created_at"] = datetime.now(timezone.utc).isoformat()
        departments["departments"].append(dept_data)
        config["departments"] = departments
        await save_system_config(db, config, user["id"])
        
        return {"message": "Department created", "department": dept_data}
    
    @api_router.put("/config/departments/{dept_id}")
    async def update_department(dept_id: str, dept_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Update a department"""
        config = await get_system_config(db)
        departments = config.get("departments", {"departments": [], "teams": []})
        
        dept_list = departments.get("departments", [])
        dept_idx = next((i for i, d in enumerate(dept_list) if d["id"] == dept_id), None)
        
        if dept_idx is None:
            raise HTTPException(status_code=404, detail="Department not found")
        
        dept_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        for key, value in dept_data.items():
            if key != "id":
                dept_list[dept_idx][key] = value
        
        departments["departments"] = dept_list
        config["departments"] = departments
        await save_system_config(db, config, user["id"])
        
        return {"message": "Department updated"}
    
    @api_router.delete("/config/departments/{dept_id}")
    async def delete_department(dept_id: str, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Delete a department"""
        config = await get_system_config(db)
        departments = config.get("departments", {"departments": [], "teams": []})
        
        original_len = len(departments.get("departments", []))
        departments["departments"] = [d for d in departments.get("departments", []) if d["id"] != dept_id]
        
        if len(departments["departments"]) == original_len:
            raise HTTPException(status_code=404, detail="Department not found")
        
        config["departments"] = departments
        await save_system_config(db, config, user["id"])
        
        return {"message": "Department deleted"}
    
    @api_router.post("/config/departments/{dept_id}/teams")
    async def create_team(dept_id: str, team_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Create a team within a department"""
        config = await get_system_config(db)
        departments = config.get("departments", {"departments": [], "teams": []})
        
        # Verify department exists
        dept_exists = any(d["id"] == dept_id for d in departments.get("departments", []))
        if not dept_exists:
            raise HTTPException(status_code=404, detail="Department not found")
        
        if not team_data.get("id"):
            team_data["id"] = f"{dept_id}_{team_data['name'].lower().replace(' ', '_')}"
        
        team_data["department_id"] = dept_id
        team_data["created_at"] = datetime.now(timezone.utc).isoformat()
        
        if "teams" not in departments:
            departments["teams"] = []
        departments["teams"].append(team_data)
        
        config["departments"] = departments
        await save_system_config(db, config, user["id"])
        
        return {"message": "Team created", "team": team_data}
    
    # ===================== LLM PROVIDERS MANAGEMENT =====================
    
    def mask_api_key(key: str) -> str:
        """Mask API key for display"""
        if not key or len(key) < 8:
            return "****"
        return key[:4] + "*" * (len(key) - 8) + key[-4:]
    
    @api_router.get("/config/llm-providers")
    async def get_llm_providers(user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Get LLM providers configuration - masks API keys"""
        config = await get_system_config(db)
        llm_providers = config.get("llm_providers", get_default_llm_providers().model_dump())
        
        # Mask API keys in response and check if configured
        for provider in llm_providers.get("providers", []):
            if provider.get("api_key"):
                provider["api_key_masked"] = mask_api_key(provider["api_key"])
                provider["api_key"] = None  # Don't send actual key
                provider["api_key_configured"] = True
            elif provider.get("api_key_env"):
                # Check if env var is set
                env_key = os.environ.get(provider["api_key_env"], "")
                provider["api_key_configured"] = bool(env_key)
                provider["api_key_masked"] = mask_api_key(env_key) if env_key else None
            else:
                provider["api_key_configured"] = False
                provider["api_key_masked"] = None
        
        return llm_providers
    
    @api_router.put("/config/llm-providers")
    async def update_llm_providers(providers_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Update LLM providers configuration"""
        config = await get_system_config(db)
        
        # Preserve existing API keys if not provided in update
        existing_providers = {p["id"]: p for p in config.get("llm_providers", {}).get("providers", [])}
        
        for provider in providers_data.get("providers", []):
            # If api_key is None, keep existing key
            if provider.get("api_key") is None and provider["id"] in existing_providers:
                provider["api_key"] = existing_providers[provider["id"]].get("api_key")
        
        config["llm_providers"] = providers_data
        await save_system_config(db, config, user["id"])
        return {"message": "LLM providers updated"}
    
    @api_router.post("/config/llm-providers")
    async def add_llm_provider(provider_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Add a new LLM provider"""
        config = await get_system_config(db)
        llm_providers = config.get("llm_providers", {"providers": []})
        
        if not provider_data.get("id"):
            provider_data["id"] = provider_data["provider"].lower()
        
        # Check for duplicate
        existing_ids = [p["id"] for p in llm_providers.get("providers", [])]
        if provider_data["id"] in existing_ids:
            raise HTTPException(status_code=400, detail="Provider with this ID already exists")
        
        llm_providers["providers"].append(provider_data)
        config["llm_providers"] = llm_providers
        await save_system_config(db, config, user["id"])
        
        return {"message": "LLM provider added", "provider": provider_data}
    
    @api_router.put("/config/llm-providers/{provider_id}")
    async def update_llm_provider(provider_id: str, provider_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Update an LLM provider"""
        config = await get_system_config(db)
        llm_providers = config.get("llm_providers", {"providers": []})
        
        providers = llm_providers.get("providers", [])
        provider_idx = next((i for i, p in enumerate(providers) if p["id"] == provider_id), None)
        
        if provider_idx is None:
            raise HTTPException(status_code=404, detail="Provider not found")
        
        # Preserve existing API key if not provided
        if provider_data.get("api_key") is None:
            provider_data["api_key"] = providers[provider_idx].get("api_key")
        
        for key, value in provider_data.items():
            if key != "id":
                providers[provider_idx][key] = value
        
        llm_providers["providers"] = providers
        config["llm_providers"] = llm_providers
        await save_system_config(db, config, user["id"])
        
        return {"message": "Provider updated"}
    
    @api_router.post("/config/llm-providers/{provider_id}/api-key")
    async def set_provider_api_key(provider_id: str, key_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Set or update API key for an LLM provider"""
        config = await get_system_config(db)
        llm_providers = config.get("llm_providers", {"providers": []})
        
        providers = llm_providers.get("providers", [])
        provider_idx = next((i for i, p in enumerate(providers) if p["id"] == provider_id), None)
        
        if provider_idx is None:
            raise HTTPException(status_code=404, detail="Provider not found")
        
        api_key = key_data.get("api_key", "").strip()
        use_env = key_data.get("use_env", False)
        env_var = key_data.get("api_key_env", "")
        
        if use_env:
            # Use environment variable
            providers[provider_idx]["api_key"] = None
            providers[provider_idx]["api_key_env"] = env_var
            providers[provider_idx]["api_key_configured"] = bool(os.environ.get(env_var, ""))
        elif api_key:
            # Use provided API key
            providers[provider_idx]["api_key"] = api_key
            providers[provider_idx]["api_key_env"] = ""
            providers[provider_idx]["api_key_configured"] = True
        else:
            # Clear API key
            providers[provider_idx]["api_key"] = None
            providers[provider_idx]["api_key_env"] = ""
            providers[provider_idx]["api_key_configured"] = False
        
        llm_providers["providers"] = providers
        config["llm_providers"] = llm_providers
        await save_system_config(db, config, user["id"])
        
        return {"message": "API key updated", "api_key_configured": providers[provider_idx]["api_key_configured"]}
    
    @api_router.delete("/config/llm-providers/{provider_id}")
    async def delete_llm_provider(provider_id: str, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Delete an LLM provider"""
        config = await get_system_config(db)
        llm_providers = config.get("llm_providers", {"providers": []})
        
        original_len = len(llm_providers.get("providers", []))
        llm_providers["providers"] = [p for p in llm_providers.get("providers", []) if p["id"] != provider_id]
        
        if len(llm_providers["providers"]) == original_len:
            raise HTTPException(status_code=404, detail="Provider not found")
        
        config["llm_providers"] = llm_providers
        await save_system_config(db, config, user["id"])
        
        return {"message": "Provider deleted"}
    
    # ===================== AI CHATBOT CONFIGURATION =====================
    
    @api_router.get("/config/ai-chatbot")
    async def get_ai_chatbot(user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Get AI chatbot configuration"""
        config = await get_system_config(db)
        return config.get("ai_chatbot", get_default_chatbot_config().model_dump())
    
    @api_router.put("/config/ai-chatbot")
    async def update_ai_chatbot(chatbot_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Update AI chatbot configuration"""
        config = await get_system_config(db)
        config["ai_chatbot"] = chatbot_data
        await save_system_config(db, config, user["id"])
        return {"message": "AI chatbot configuration updated"}
    
    @api_router.post("/config/ai-chatbot/toggle")
    async def toggle_ai_chatbot(enable: bool, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Enable or disable AI chatbot"""
        config = await get_system_config(db)
        chatbot = config.get("ai_chatbot", {})
        chatbot["is_enabled"] = enable
        config["ai_chatbot"] = chatbot
        await save_system_config(db, config, user["id"])
        return {"message": f"AI chatbot {'enabled' if enable else 'disabled'}", "is_enabled": enable}
    
    # ===================== BLUE SHEET CONTACT ROLES =====================
    
    @api_router.get("/config/contact-roles")
    async def get_contact_roles(user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.CEO]))):
        """Get Blue Sheet contact roles configuration"""
        config = await get_system_config(db)
        blue_sheet = config.get("blue_sheet", {})
        return blue_sheet.get("contact_roles", get_default_contact_roles().model_dump())
    
    @api_router.put("/config/contact-roles")
    async def update_contact_roles(roles_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Update Blue Sheet contact roles configuration"""
        config = await get_system_config(db)
        blue_sheet = config.get("blue_sheet", {})
        blue_sheet["contact_roles"] = roles_data
        config["blue_sheet"] = blue_sheet
        await save_system_config(db, config, user["id"])
        return {"message": "Contact roles updated"}
    
    # ===================== USER INVITATIONS =====================
    
    @api_router.post("/config/users/invite")
    async def invite_user(invitation_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Send invitation to a new user"""
        # Check if email already exists
        existing = await db.users.find_one({"email": invitation_data["email"]})
        if existing:
            raise HTTPException(status_code=400, detail="User with this email already exists")
        
        # Check for pending invitation
        pending = await db.user_invitations.find_one({
            "email": invitation_data["email"],
            "is_used": False,
            "expires_at": {"$gt": datetime.now(timezone.utc)}
        })
        if pending:
            raise HTTPException(status_code=400, detail="Pending invitation already exists for this email")
        
        # Generate invitation token
        token = secrets.token_urlsafe(32)
        
        invitation = {
            "id": str(uuid.uuid4()),
            "email": invitation_data["email"],
            "name": invitation_data["name"],
            "role": invitation_data.get("role", "account_manager"),
            "department_id": invitation_data.get("department_id"),
            "team_id": invitation_data.get("team_id"),
            "invited_by": user["id"],
            "invitation_token": token,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "is_used": False,
            "created_at": datetime.now(timezone.utc)
        }
        
        await db.user_invitations.insert_one(invitation)
        
        # TODO: Send email via Office 365 when configured
        # For now, return the invitation link
        
        return {
            "message": "Invitation created",
            "invitation_id": invitation["id"],
            "invitation_token": token,
            "expires_at": invitation["expires_at"].isoformat()
        }
    
    @api_router.get("/config/users/invitations")
    async def get_invitations(user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Get all pending invitations"""
        invitations = await db.user_invitations.find(
            {"is_used": False},
            {"_id": 0, "invitation_token": 0}
        ).to_list(100)
        return invitations
    
    @api_router.delete("/config/users/invitations/{invitation_id}")
    async def cancel_invitation(invitation_id: str, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Cancel a pending invitation"""
        result = await db.user_invitations.delete_one({"id": invitation_id, "is_used": False})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Invitation not found or already used")
        return {"message": "Invitation cancelled"}
    
    # ===================== ACCOUNT FIELDS CONFIGURATION =====================
    
    @api_router.get("/config/account-fields")
    async def get_account_fields(user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.CEO]))):
        """Get account field definitions"""
        config = await get_system_config(db)
        return config.get("account_fields", get_default_account_fields().model_dump())
    
    @api_router.put("/config/account-fields")
    async def update_account_fields(fields_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Update account field definitions"""
        config = await get_system_config(db)
        config["account_fields"] = fields_data
        await save_system_config(db, config, user["id"])
        return {"message": "Account fields updated"}
    
    @api_router.post("/config/account-fields/field")
    async def add_account_field(field_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Add a new custom field to accounts"""
        config = await get_system_config(db)
        account_fields = config.get("account_fields", get_default_account_fields().model_dump())
        
        # Generate ID if not provided
        if not field_data.get("id"):
            field_data["id"] = field_data["name"].lower().replace(" ", "_")
        
        # Check for duplicate ID
        existing_ids = [f["id"] for f in account_fields.get("fields", [])]
        if field_data["id"] in existing_ids:
            raise HTTPException(status_code=400, detail="Field with this ID already exists")
        
        # Set defaults
        field_data.setdefault("visible", True)
        field_data.setdefault("editable", True)
        field_data.setdefault("is_system", False)
        field_data.setdefault("order", len(account_fields.get("fields", [])) + 1)
        field_data["created_at"] = datetime.now(timezone.utc).isoformat()
        
        account_fields["fields"].append(field_data)
        config["account_fields"] = account_fields
        await save_system_config(db, config, user["id"])
        
        return {"message": "Field added", "field": field_data}
    
    @api_router.put("/config/account-fields/field/{field_id}")
    async def update_account_field(field_id: str, field_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Update an account field"""
        config = await get_system_config(db)
        account_fields = config.get("account_fields", {})
        fields = account_fields.get("fields", [])
        
        field_idx = next((i for i, f in enumerate(fields) if f["id"] == field_id), None)
        if field_idx is None:
            raise HTTPException(status_code=404, detail="Field not found")
        
        # Prevent modifying system fields' critical properties
        if fields[field_idx].get("is_system"):
            protected = ["id", "field_type", "is_system"]
            for key in protected:
                if key in field_data and field_data[key] != fields[field_idx].get(key):
                    raise HTTPException(status_code=400, detail=f"Cannot modify '{key}' on system fields")
        
        # Update field
        for key, value in field_data.items():
            if key != "id":  # Don't allow ID change
                fields[field_idx][key] = value
        
        account_fields["fields"] = fields
        config["account_fields"] = account_fields
        await save_system_config(db, config, user["id"])
        
        return {"message": "Field updated"}
    
    @api_router.delete("/config/account-fields/field/{field_id}")
    async def delete_account_field(field_id: str, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Delete a custom account field"""
        config = await get_system_config(db)
        account_fields = config.get("account_fields", {})
        fields = account_fields.get("fields", [])
        
        field = next((f for f in fields if f["id"] == field_id), None)
        if not field:
            raise HTTPException(status_code=404, detail="Field not found")
        
        if field.get("is_system"):
            raise HTTPException(status_code=400, detail="Cannot delete system fields")
        
        account_fields["fields"] = [f for f in fields if f["id"] != field_id]
        
        # Also remove from layout sections
        for section in account_fields.get("layout", {}).get("sections", []):
            if field_id in section.get("field_ids", []):
                section["field_ids"].remove(field_id)
        
        config["account_fields"] = account_fields
        await save_system_config(db, config, user["id"])
        
        return {"message": "Field deleted"}
    
    @api_router.put("/config/account-fields/layout")
    async def update_account_layout(layout_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Update account form layout (sections and field arrangement)"""
        config = await get_system_config(db)
        account_fields = config.get("account_fields", {})
        account_fields["layout"] = layout_data
        config["account_fields"] = account_fields
        await save_system_config(db, config, user["id"])
        
        return {"message": "Layout updated"}
    
    @api_router.post("/config/account-fields/section")
    async def add_account_section(section_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Add a new section to account form"""
        config = await get_system_config(db)
        account_fields = config.get("account_fields", {})
        layout = account_fields.get("layout", {"sections": [], "tabs": []})
        
        if not section_data.get("id"):
            section_data["id"] = section_data["name"].lower().replace(" ", "_")
        
        # Check for duplicate
        existing_ids = [s["id"] for s in layout.get("sections", [])]
        if section_data["id"] in existing_ids:
            raise HTTPException(status_code=400, detail="Section with this ID already exists")
        
        section_data.setdefault("order", len(layout.get("sections", [])) + 1)
        section_data.setdefault("columns", 2)
        section_data.setdefault("field_ids", [])
        
        layout["sections"].append(section_data)
        account_fields["layout"] = layout
        config["account_fields"] = account_fields
        await save_system_config(db, config, user["id"])
        
        return {"message": "Section added", "section": section_data}
    
    # ===================== ACCOUNT ENRICH (ODOO INTEGRATION) =====================
    
    @api_router.post("/accounts/{account_id}/enrich")
    async def enrich_account(account_id: str, user: dict = Depends(get_current_user)):
        """Enrich account with data from Odoo ERP (mocked for now)"""
        account = await db.accounts.find_one({"id": account_id})
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        
        # Check if user has permission to enrich (owner, admin, or CEO)
        if user["role"] not in ["super_admin", "ceo"] and account.get("assigned_am_id") != user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized to enrich this account")
        
        # Get Odoo integration config
        config = await get_system_config(db)
        integrations = config.get("integrations", [])
        odoo_config = next((i for i in integrations if i.get("integration_type") == "odoo"), None)
        
        # For now, generate mock data - in real implementation, call Odoo API
        import random
        
        # Mock Orders from Odoo
        mock_orders = [
            {
                "id": f"SO-2024-{str(i).zfill(3)}",
                "date": f"2024-{random.randint(1,12):02d}-{random.randint(1,28):02d}",
                "products": random.choice(["MSSP License", "Security Audit", "Consulting", "Penetration Testing"]),
                "amount": random.randint(25000, 200000),
                "status": random.choice(["pending", "in_progress", "delivered", "cancelled"]),
                "source": "odoo"
            }
            for i in range(1, random.randint(4, 8))
        ]
        
        # Mock Invoices from Odoo
        mock_invoices = [
            {
                "id": f"INV-2024-{str(i).zfill(3)}",
                "date": f"2024-{random.randint(1,12):02d}-{random.randint(1,28):02d}",
                "order_id": mock_orders[min(i-1, len(mock_orders)-1)]["id"] if mock_orders else None,
                "amount": random.randint(20000, 150000),
                "paid_amount": random.randint(0, 1) * random.randint(20000, 150000),
                "due_date": f"2024-{random.randint(1,12):02d}-{random.randint(1,28):02d}",
                "status": random.choice(["paid", "pending", "overdue"]),
                "source": "odoo"
            }
            for i in range(1, random.randint(3, 6))
        ]
        
        # Calculate totals
        total_orders = sum(o["amount"] for o in mock_orders)
        total_invoiced = sum(inv["amount"] for inv in mock_invoices)
        total_paid = sum(inv["paid_amount"] for inv in mock_invoices)
        outstanding = total_invoiced - total_paid
        
        # Update account with enriched data
        enrichment_data = {
            "total_orders": total_orders,
            "total_invoiced": total_invoiced,
            "total_paid": total_paid,
            "outstanding_amount": outstanding,
            "orders": mock_orders,
            "invoices": mock_invoices,
            "last_enriched_at": datetime.now(timezone.utc),
            "enrichment_source": "odoo_mock"
        }
        
        await db.accounts.update_one(
            {"id": account_id},
            {"$set": enrichment_data}
        )
        
        # Log the enrichment
        await db.audit_log.insert_one({
            "id": str(uuid.uuid4()),
            "entity_type": "account",
            "entity_id": account_id,
            "action": "enrich",
            "user_id": user["id"],
            "changes": {"enriched_from": "odoo_mock", "orders_count": len(mock_orders), "invoices_count": len(mock_invoices)},
            "created_at": datetime.now(timezone.utc)
        })
        
        return {
            "message": "Account enriched successfully",
            "source": "odoo_mock",
            "summary": {
                "total_orders": total_orders,
                "total_invoiced": total_invoiced,
                "total_paid": total_paid,
                "outstanding": outstanding,
                "orders_count": len(mock_orders),
                "invoices_count": len(mock_invoices)
            },
            "orders": mock_orders,
            "invoices": mock_invoices
        }
    
    @api_router.get("/accounts/{account_id}/orders")
    async def get_account_orders(account_id: str, user: dict = Depends(get_current_user)):
        """Get orders for an account (from enriched data)"""
        account = await db.accounts.find_one({"id": account_id}, {"_id": 0})
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        
        # Check permission
        if user["role"] not in ["super_admin", "ceo", "sales_director"] and account.get("assigned_am_id") != user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        return {
            "account_id": account_id,
            "orders": account.get("orders", []),
            "total": account.get("total_orders", 0),
            "last_enriched": account.get("last_enriched_at")
        }
    
    @api_router.get("/accounts/{account_id}/invoices")
    async def get_account_invoices(account_id: str, user: dict = Depends(get_current_user)):
        """Get invoices for an account (from enriched data)"""
        account = await db.accounts.find_one({"id": account_id}, {"_id": 0})
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        
        # Check permission
        if user["role"] not in ["super_admin", "ceo", "sales_director", "finance_manager"] and account.get("assigned_am_id") != user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        return {
            "account_id": account_id,
            "invoices": account.get("invoices", []),
            "total_invoiced": account.get("total_invoiced", 0),
            "total_paid": account.get("total_paid", 0),
            "outstanding": account.get("outstanding_amount", 0),
            "last_enriched": account.get("last_enriched_at")
        }
    
    # ===================== ORGANIZATION CONTACTS =====================
    
    @api_router.post("/organizations/{org_id}/contacts")
    async def create_org_contact(org_id: str, contact_data: dict, user: dict = Depends(get_current_user)):
        """Create a contact for an organization"""
        # Verify organization exists
        org = await db.accounts.find_one({"id": org_id})
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        contact = {
            "id": str(uuid.uuid4()),
            "organization_id": org_id,
            "name": contact_data["name"],
            "title": contact_data.get("title"),
            "email": contact_data.get("email"),
            "phone": contact_data.get("phone"),
            "linkedin_url": contact_data.get("linkedin_url"),
            "roles": contact_data.get("roles", []),
            "influence_level": contact_data.get("influence_level", "medium"),
            "relationship_status": contact_data.get("relationship_status", "neutral"),
            "notes": contact_data.get("notes"),
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "created_by": user["id"]
        }
        
        await db.organization_contacts.insert_one(contact)
        contact.pop("_id", None)
        
        return {"message": "Contact created", "contact": contact}
    
    @api_router.get("/organizations/{org_id}/contacts")
    async def get_org_contacts(org_id: str, user: dict = Depends(get_current_user)):
        """Get all contacts for an organization"""
        contacts = await db.organization_contacts.find(
            {"organization_id": org_id, "is_active": True},
            {"_id": 0}
        ).to_list(100)
        return contacts
    
    @api_router.put("/organizations/{org_id}/contacts/{contact_id}")
    async def update_org_contact(org_id: str, contact_id: str, contact_data: dict, user: dict = Depends(get_current_user)):
        """Update an organization contact"""
        contact = await db.organization_contacts.find_one({"id": contact_id, "organization_id": org_id})
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        update_data = {k: v for k, v in contact_data.items() if k not in ["id", "organization_id", "created_at"]}
        update_data["updated_at"] = datetime.now(timezone.utc)
        
        await db.organization_contacts.update_one({"id": contact_id}, {"$set": update_data})
        return {"message": "Contact updated"}
    
    @api_router.delete("/organizations/{org_id}/contacts/{contact_id}")
    async def delete_org_contact(org_id: str, contact_id: str, user: dict = Depends(get_current_user)):
        """Soft delete an organization contact"""
        result = await db.organization_contacts.update_one(
            {"id": contact_id, "organization_id": org_id},
            {"$set": {"is_active": False, "deleted_at": datetime.now(timezone.utc)}}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Contact not found")
        return {"message": "Contact deleted"}
    
    # ===================== EMAIL CONFIGURATION =====================
    
    @api_router.get("/config/email")
    async def get_email_config(user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Get email configuration"""
        config = await get_system_config(db)
        email_config = config.get("email", get_default_email_config().model_dump())
        # Don't expose secrets
        if "client_secret_env" in email_config:
            email_config["has_client_secret"] = bool(os.environ.get(email_config.get("client_secret_env", "")))
        return email_config
    
    @api_router.put("/config/email")
    async def update_email_config(email_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Update email configuration"""
        config = await get_system_config(db)
        config["email"] = email_data
        await save_system_config(db, config, user["id"])
        return {"message": "Email configuration updated"}
    
    @api_router.post("/config/email/test")
    async def test_email_config(test_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Test email configuration by sending a test email"""
        config = await get_system_config(db)
        email_config = config.get("email", {})
        
        if not email_config.get("is_enabled"):
            return {"success": False, "error": "Email is not enabled"}
        
        # TODO: Implement actual email sending via Office 365
        return {
            "success": True, 
            "message": "Email configuration test - Office 365 integration pending",
            "provider": email_config.get("provider")
        }
    
    # ===================== DATA ACCESS HELPER =====================
    
    @api_router.get("/config/data-access/{role_id}")
    async def get_role_data_access(role_id: str, user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.CEO]))):
        """Get data access configuration for a role"""
        config = await get_system_config(db)
        roles = config.get("roles", [])
        role = next((r for r in roles if r["id"] == role_id), None)
        
        if not role:
            raise HTTPException(status_code=404, detail="Role not found")
        
        return role.get("data_access", {
            "opportunities": "self",
            "accounts": "self",
            "activities": "self",
            "incentives": "self",
            "reports": "self",
            "users": "self"
        })
    
    @api_router.put("/config/data-access/{role_id}")
    async def update_role_data_access(role_id: str, access_data: dict, user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
        """Update data access configuration for a role"""
        config = await get_system_config(db)
        roles = config.get("roles", [])
        role_idx = next((i for i, r in enumerate(roles) if r["id"] == role_id), None)
        
        if role_idx is None:
            raise HTTPException(status_code=404, detail="Role not found")
        
        roles[role_idx]["data_access"] = access_data
        config["roles"] = roles
        await save_system_config(db, config, user["id"])
        
        return {"message": "Data access updated"}
    
    return api_router
