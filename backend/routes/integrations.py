"""
Integration Routes
API endpoints for managing integrations (Odoo, Salesforce, etc.)
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid

from models.base import (
    IntegrationType, EntityType, IntegrationConfig,
    FieldMapping, IntegrationMapping, SyncJob, SyncStatus, UserRole
)
from services.auth.jwt_handler import get_current_user_from_token, require_role
from services.odoo.connector import OdooConnector
from services.ai_mapping.mapper import AIFieldMapper, get_canonical_schema
from services.data_lake.manager import DataLakeManager
from core.database import Database
from core.config import settings

router = APIRouter(prefix="/integrations", tags=["Integrations"])


# ===================== REQUEST/RESPONSE MODELS =====================

class OdooConfigRequest(BaseModel):
    url: str
    database: str
    username: str
    api_key: str
    enabled_entities: List[EntityType] = [EntityType.ACCOUNT, EntityType.OPPORTUNITY]


class O365ConfigRequest(BaseModel):
    client_id: str
    tenant_id: str
    client_secret: str


class IntegrationResponse(BaseModel):
    id: str
    integration_type: str
    enabled: bool
    last_sync: Optional[datetime] = None
    sync_status: str
    error_message: Optional[str] = None
    config_summary: Dict[str, Any] = {}


class TestConnectionResponse(BaseModel):
    success: bool
    message: str
    details: Optional[Dict[str, Any]] = None


class FieldMappingRequest(BaseModel):
    entity_type: EntityType
    mappings: List[FieldMapping]


class AutoMapRequest(BaseModel):
    entity_type: EntityType


class SyncRequest(BaseModel):
    entity_types: Optional[List[EntityType]] = None


# ===================== INTEGRATION CONFIG ROUTES =====================

@router.get("/", response_model=List[IntegrationResponse])
async def list_integrations(
    token_data: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.CEO]))
):
    """List all configured integrations"""
    db = Database.get_db()
    
    integrations = await db.integrations.find({}, {"_id": 0}).to_list(100)
    
    result = []
    for intg in integrations:
        # Don't expose sensitive config
        config_summary = {}
        if intg.get("config"):
            config = intg["config"]
            if "url" in config:
                config_summary["url"] = config["url"]
            if "database" in config:
                config_summary["database"] = config["database"]
        
        result.append(IntegrationResponse(
            id=intg.get("id", ""),
            integration_type=intg.get("integration_type", ""),
            enabled=intg.get("enabled", False),
            last_sync=intg.get("last_sync"),
            sync_status=intg.get("sync_status", "pending"),
            error_message=intg.get("error_message"),
            config_summary=config_summary
        ))
    
    return result


@router.get("/{integration_type}", response_model=IntegrationResponse)
async def get_integration(
    integration_type: IntegrationType,
    token_data: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Get integration configuration"""
    db = Database.get_db()
    
    intg = await db.integrations.find_one(
        {"integration_type": integration_type.value},
        {"_id": 0}
    )
    
    if not intg:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    config_summary = {}
    if intg.get("config"):
        config = intg["config"]
        if "url" in config:
            config_summary["url"] = config["url"]
        if "database" in config:
            config_summary["database"] = config["database"]
    
    return IntegrationResponse(
        id=intg.get("id", ""),
        integration_type=intg.get("integration_type", ""),
        enabled=intg.get("enabled", False),
        last_sync=intg.get("last_sync"),
        sync_status=intg.get("sync_status", "pending"),
        error_message=intg.get("error_message"),
        config_summary=config_summary
    )


# ===================== ODOO SPECIFIC ROUTES =====================

@router.post("/odoo/configure")
async def configure_odoo(
    config: OdooConfigRequest,
    token_data: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Configure Odoo integration"""
    db = Database.get_db()
    
    now = datetime.now(timezone.utc)
    intg_id = str(uuid.uuid4())
    
    # Check if already exists
    existing = await db.integrations.find_one({"integration_type": "odoo"})
    
    intg_doc = {
        "id": existing["id"] if existing else intg_id,
        "integration_type": "odoo",
        "enabled": True,
        "config": {
            "url": config.url,
            "database": config.database,
            "username": config.username,
            "api_key": config.api_key,  # Should encrypt in production
            "enabled_entities": [e.value for e in config.enabled_entities]
        },
        "sync_status": "pending",
        "updated_at": now
    }
    
    if existing:
        await db.integrations.update_one(
            {"integration_type": "odoo"},
            {"$set": intg_doc}
        )
    else:
        intg_doc["created_at"] = now
        await db.integrations.insert_one(intg_doc)
    
    return {"message": "Odoo integration configured", "id": intg_doc["id"]}


@router.post("/odoo/test", response_model=TestConnectionResponse)
async def test_odoo_connection(
    config: OdooConfigRequest,
    token_data: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Test Odoo connection"""
    try:
        async with OdooConnector(
            url=config.url,
            database=config.database,
            username=config.username,
            api_key=config.api_key
        ) as connector:
            result = await connector.test_connection()
            
            if result.get("connected"):
                return TestConnectionResponse(
                    success=True,
                    message=f"Connected to Odoo {result.get('server_version', 'unknown')}",
                    details=result
                )
            else:
                return TestConnectionResponse(
                    success=False,
                    message=f"Connection failed: {result.get('error', 'Unknown error')}",
                    details=result
                )
    except Exception as e:
        return TestConnectionResponse(
            success=False,
            message=f"Connection error: {str(e)}"
        )


@router.get("/odoo/fields/{model}")
async def get_odoo_fields(
    model: str,
    token_data: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Get available fields from an Odoo model"""
    db = Database.get_db()
    
    # Get Odoo config
    intg = await db.integrations.find_one({"integration_type": "odoo"})
    if not intg or not intg.get("config"):
        raise HTTPException(status_code=400, detail="Odoo not configured")
    
    config = intg["config"]
    
    try:
        async with OdooConnector(
            url=config["url"],
            database=config["database"],
            username=config["username"],
            api_key=config["api_key"]
        ) as connector:
            fields = await connector.fields_get(model)
            return {"model": model, "fields": fields}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===================== MICROSOFT 365 ROUTES =====================

@router.post("/ms365/configure")
async def configure_ms365(
    config: O365ConfigRequest,
    token_data: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Configure Microsoft 365 integration"""
    db = Database.get_db()
    
    now = datetime.now(timezone.utc)
    intg_id = str(uuid.uuid4())
    
    # Check if already exists
    existing = await db.integrations.find_one({"integration_type": "ms365"})
    
    intg_doc = {
        "id": existing["id"] if existing else intg_id,
        "integration_type": "ms365",
        "enabled": True,
        "config": {
            "client_id": config.client_id,
            "tenant_id": config.tenant_id,
            "client_secret": config.client_secret,  # Should encrypt in production
        },
        "sync_status": "pending",
        "updated_at": now
    }
    
    if existing:
        await db.integrations.update_one(
            {"integration_type": "ms365"},
            {"$set": intg_doc}
        )
    else:
        intg_doc["created_at"] = now
        await db.integrations.insert_one(intg_doc)
    
    return {"message": "Microsoft 365 integration configured", "id": intg_doc["id"]}


@router.post("/ms365/test", response_model=TestConnectionResponse)
async def test_ms365_connection(
    config: O365ConfigRequest,
    token_data: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Test Microsoft 365 connection by validating credentials with Azure AD"""
    import aiohttp
    
    try:
        # Try to get an access token from Azure AD using client credentials
        token_url = f"https://login.microsoftonline.com/{config.tenant_id}/oauth2/v2.0/token"
        
        data = {
            "client_id": config.client_id,
            "client_secret": config.client_secret,
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials"
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(token_url, data=data) as response:
                result = await response.json()
                
                if response.status == 200 and "access_token" in result:
                    # Test the token by calling Graph API
                    headers = {"Authorization": f"Bearer {result['access_token']}"}
                    async with session.get(
                        "https://graph.microsoft.com/v1.0/organization",
                        headers=headers
                    ) as org_response:
                        if org_response.status == 200:
                            org_data = await org_response.json()
                            org_name = org_data.get("value", [{}])[0].get("displayName", "Unknown")
                            return TestConnectionResponse(
                                success=True,
                                message=f"Connected to Microsoft 365 - Organization: {org_name}",
                                details={
                                    "organization": org_name,
                                    "tenant_id": config.tenant_id
                                }
                            )
                        else:
                            return TestConnectionResponse(
                                success=True,
                                message="Connected to Azure AD (Graph API access may need admin consent)",
                                details={"tenant_id": config.tenant_id}
                            )
                else:
                    error_desc = result.get("error_description", result.get("error", "Unknown error"))
                    return TestConnectionResponse(
                        success=False,
                        message=f"Authentication failed: {error_desc}"
                    )
                    
    except Exception as e:
        return TestConnectionResponse(
            success=False,
            message=f"Connection error: {str(e)}"
        )


# ===================== ODOO DEPARTMENT & USER SYNC =====================

class DepartmentSyncResponse(BaseModel):
    synced: int
    created: int
    updated: int
    deactivated: int
    errors: List[str] = []

class UserSyncResponse(BaseModel):
    synced: int
    created: int
    updated: int
    deactivated: int
    errors: List[str] = []

@router.post("/odoo/sync-departments", response_model=DepartmentSyncResponse)
async def sync_departments_from_odoo(
    token_data: dict = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    """
    Sync departments from Odoo hr.department.
    Departments are SOURCE OF TRUTH from Odoo - CRM departments are read-only.
    """
    db = Database.get_db()
    
    # Get Odoo config
    intg = await db.integrations.find_one({"integration_type": "odoo"})
    if not intg or not intg.get("enabled"):
        raise HTTPException(status_code=400, detail="Odoo integration not enabled")
    
    config = intg.get("config", {})
    if not config.get("url"):
        raise HTTPException(status_code=400, detail="Odoo not configured")
    
    # Connect to Odoo
    from integrations.odoo.connector import OdooConnector
    connector = OdooConnector(config)
    
    try:
        departments = await connector.fetch_departments()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch from Odoo: {str(e)}")
    finally:
        await connector.disconnect()
    
    # Sync to CRM
    created = 0
    updated = 0
    errors = []
    odoo_ids = []
    
    for dept in departments:
        odoo_ids.append(dept['odoo_id'])
        
        try:
            existing = await db.departments.find_one({"odoo_id": dept['odoo_id']})
            
            if existing:
                # Update existing
                await db.departments.update_one(
                    {"odoo_id": dept['odoo_id']},
                    {"$set": {
                        "name": dept['name'],
                        "complete_name": dept.get('complete_name'),
                        "parent_odoo_id": dept.get('parent_id'),
                        "manager_odoo_id": dept.get('manager_id'),
                        "active": dept.get('active', True),
                        "synced_at": datetime.now(timezone.utc),
                        "source": "odoo",
                    }}
                )
                updated += 1
            else:
                # Create new
                await db.departments.insert_one({
                    "id": str(uuid.uuid4()),
                    "odoo_id": dept['odoo_id'],
                    "name": dept['name'],
                    "complete_name": dept.get('complete_name'),
                    "parent_odoo_id": dept.get('parent_id'),
                    "manager_odoo_id": dept.get('manager_id'),
                    "active": dept.get('active', True),
                    "source": "odoo",
                    "synced_at": datetime.now(timezone.utc),
                    "created_at": datetime.now(timezone.utc),
                })
                created += 1
        except Exception as e:
            errors.append(f"Failed to sync department {dept.get('name')}: {str(e)}")
    
    # Deactivate departments no longer in Odoo
    deactivated = 0
    result = await db.departments.update_many(
        {"source": "odoo", "odoo_id": {"$nin": odoo_ids}, "active": True},
        {"$set": {"active": False, "deactivated_at": datetime.now(timezone.utc)}}
    )
    deactivated = result.modified_count
    
    # Log sync event
    await db.audit_log.insert_one({
        "id": str(uuid.uuid4()),
        "action": "sync_departments",
        "source": "odoo",
        "user_id": token_data["id"],
        "details": {"synced": len(departments), "created": created, "updated": updated, "deactivated": deactivated},
        "timestamp": datetime.now(timezone.utc),
    })
    
    return DepartmentSyncResponse(
        synced=len(departments),
        created=created,
        updated=updated,
        deactivated=deactivated,
        errors=errors
    )


@router.post("/odoo/sync-users", response_model=UserSyncResponse)
async def sync_users_from_odoo(
    token_data: dict = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    """
    Sync users from Odoo hr.employee.
    Users are SOURCE OF TRUTH from Odoo - manual user creation is blocked.
    Users synced here are set to 'pending' approval status.
    """
    db = Database.get_db()
    
    # Get Odoo config
    intg = await db.integrations.find_one({"integration_type": "odoo"})
    if not intg or not intg.get("enabled"):
        raise HTTPException(status_code=400, detail="Odoo integration not enabled")
    
    config = intg.get("config", {})
    if not config.get("url"):
        raise HTTPException(status_code=400, detail="Odoo not configured")
    
    # Connect to Odoo
    from integrations.odoo.connector import OdooConnector
    connector = OdooConnector(config)
    
    try:
        odoo_users = await connector.fetch_users()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch from Odoo: {str(e)}")
    finally:
        await connector.disconnect()
    
    # Sync to CRM
    created = 0
    updated = 0
    errors = []
    odoo_ids = []
    
    for odoo_user in odoo_users:
        employee_id = odoo_user.get('odoo_employee_id')
        user_id = odoo_user.get('odoo_user_id')
        odoo_ids.append(employee_id or user_id)
        
        if not odoo_user.get('email'):
            errors.append(f"Skipped user {odoo_user.get('name')}: no email")
            continue
        
        try:
            # Find by email (preferred) or odoo_id
            existing = await db.users.find_one({
                "$or": [
                    {"email": odoo_user['email']},
                    {"odoo_employee_id": employee_id},
                    {"odoo_user_id": user_id}
                ]
            })
            
            # Map department
            dept = None
            if odoo_user.get('department_odoo_id'):
                dept = await db.departments.find_one({"odoo_id": odoo_user['department_odoo_id']})
            
            if existing:
                # Update existing user
                update_data = {
                    "name": odoo_user['name'],
                    "odoo_employee_id": employee_id,
                    "odoo_user_id": user_id,
                    "job_title": odoo_user.get('job_title'),
                    "phone": odoo_user.get('phone'),
                    "department_id": dept['id'] if dept else existing.get('department_id'),
                    "department_name": odoo_user.get('department_name'),
                    "manager_odoo_id": odoo_user.get('manager_odoo_id'),
                    "synced_at": datetime.now(timezone.utc),
                    "source": "odoo",
                }
                await db.users.update_one({"id": existing['id']}, {"$set": update_data})
                updated += 1
            else:
                # Create new user (pending approval)
                new_user = {
                    "id": str(uuid.uuid4()),
                    "email": odoo_user['email'],
                    "name": odoo_user['name'],
                    "hashed_password": None,  # SSO only - no password
                    "odoo_employee_id": employee_id,
                    "odoo_user_id": user_id,
                    "job_title": odoo_user.get('job_title'),
                    "phone": odoo_user.get('phone'),
                    "department_id": dept['id'] if dept else None,
                    "department_name": odoo_user.get('department_name'),
                    "manager_odoo_id": odoo_user.get('manager_odoo_id'),
                    "role": "pending",  # Needs admin approval to assign role
                    "role_id": None,
                    "is_approved": False,
                    "approval_status": "pending",
                    "is_super_admin": False,
                    "source": "odoo",
                    "synced_at": datetime.now(timezone.utc),
                    "created_at": datetime.now(timezone.utc),
                }
                await db.users.insert_one(new_user)
                created += 1
                
        except Exception as e:
            errors.append(f"Failed to sync user {odoo_user.get('name')}: {str(e)}")
    
    # Deactivate users no longer in Odoo (only odoo-sourced users)
    deactivated = 0
    result = await db.users.update_many(
        {
            "source": "odoo",
            "$and": [
                {"odoo_employee_id": {"$nin": [u.get('odoo_employee_id') for u in odoo_users if u.get('odoo_employee_id')]}},
                {"odoo_user_id": {"$nin": [u.get('odoo_user_id') for u in odoo_users if u.get('odoo_user_id')]}}
            ],
            "is_approved": True
        },
        {"$set": {"is_approved": False, "approval_status": "deactivated", "deactivated_at": datetime.now(timezone.utc)}}
    )
    deactivated = result.modified_count
    
    # Log sync event
    await db.audit_log.insert_one({
        "id": str(uuid.uuid4()),
        "action": "sync_users",
        "source": "odoo",
        "user_id": token_data["id"],
        "details": {"synced": len(odoo_users), "created": created, "updated": updated, "deactivated": deactivated},
        "timestamp": datetime.now(timezone.utc),
    })
    
    return UserSyncResponse(
        synced=len(odoo_users),
        created=created,
        updated=updated,
        deactivated=deactivated,
        errors=errors
    )


@router.get("/departments")
async def get_synced_departments(
    token_data: dict = Depends(get_current_user_from_token)
):
    """Get all departments (synced from Odoo)"""
    db = Database.get_db()
    departments = await db.departments.find({"active": True}, {"_id": 0}).to_list(100)
    return departments


# ===================== FIELD MAPPING ROUTES =====================

@router.get("/mappings/{integration_type}/{entity_type}")
async def get_field_mappings(
    integration_type: IntegrationType,
    entity_type: EntityType,
    token_data: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Get field mappings for an integration"""
    db = Database.get_db()
    
    mapping = await db.field_mappings.find_one({
        "integration_type": integration_type.value,
        "entity_type": entity_type.value
    }, {"_id": 0})
    
    canonical_schema = get_canonical_schema(entity_type)
    
    return {
        "integration_type": integration_type.value,
        "entity_type": entity_type.value,
        "mappings": mapping.get("mappings", []) if mapping else [],
        "canonical_schema": canonical_schema
    }


@router.post("/mappings/{integration_type}")
async def save_field_mappings(
    integration_type: IntegrationType,
    request: FieldMappingRequest,
    token_data: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Save field mappings for an integration"""
    db = Database.get_db()
    
    now = datetime.now(timezone.utc)
    mapping_id = str(uuid.uuid4())
    
    existing = await db.field_mappings.find_one({
        "integration_type": integration_type.value,
        "entity_type": request.entity_type.value
    })
    
    mapping_doc = {
        "id": existing["id"] if existing else mapping_id,
        "integration_type": integration_type.value,
        "entity_type": request.entity_type.value,
        "mappings": [m.model_dump() for m in request.mappings],
        "is_active": True,
        "updated_at": now,
        "updated_by": token_data["id"]
    }
    
    if existing:
        await db.field_mappings.update_one(
            {"id": existing["id"]},
            {"$set": mapping_doc}
        )
    else:
        mapping_doc["created_at"] = now
        mapping_doc["created_by"] = token_data["id"]
        await db.field_mappings.insert_one(mapping_doc)
    
    return {"message": "Mappings saved", "count": len(request.mappings)}


@router.post("/mappings/{integration_type}/auto-map")
async def auto_map_fields(
    integration_type: IntegrationType,
    request: AutoMapRequest,
    token_data: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Use AI to automatically map fields"""
    db = Database.get_db()
    
    # Get integration config
    intg = await db.integrations.find_one({"integration_type": integration_type.value})
    if not intg or not intg.get("config"):
        raise HTTPException(status_code=400, detail=f"{integration_type.value} not configured")
    
    config = intg["config"]
    
    # Get source fields based on integration type
    source_fields = {}
    
    if integration_type == IntegrationType.ODOO:
        try:
            # Map entity type to Odoo model
            model_map = {
                EntityType.ACCOUNT: "res.partner",
                EntityType.OPPORTUNITY: "crm.lead",
                EntityType.CONTACT: "res.partner",
                EntityType.ORDER: "sale.order",
                EntityType.INVOICE: "account.move"
            }
            
            model = model_map.get(request.entity_type)
            if not model:
                raise HTTPException(status_code=400, detail=f"Unsupported entity type: {request.entity_type}")
            
            async with OdooConnector(
                url=config["url"],
                database=config["database"],
                username=config["username"],
                api_key=config["api_key"]
            ) as connector:
                source_fields = await connector.fields_get(model)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to get Odoo fields: {e}")
    
    # Use AI mapper
    api_key = settings.EMERGENT_LLM_KEY or settings.OPENAI_API_KEY
    mapper = AIFieldMapper(api_key=api_key, model=settings.AI_MODEL)
    
    mappings = await mapper.auto_map_fields(
        source_fields=source_fields,
        entity_type=request.entity_type,
        integration_type=integration_type
    )
    
    return {
        "entity_type": request.entity_type.value,
        "suggested_mappings": [m.model_dump() for m in mappings],
        "source_field_count": len(source_fields),
        "mapped_count": len(mappings)
    }


# ===================== SYNC ROUTES =====================

@router.post("/sync/{integration_type}")
async def trigger_sync(
    integration_type: IntegrationType,
    background_tasks: BackgroundTasks,
    request: Optional[SyncRequest] = None,
    token_data: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Trigger a sync job for an integration"""
    from services.sync.service import run_sync_job
    
    db = Database.get_db()
    
    # Get integration config
    intg = await db.integrations.find_one({"integration_type": integration_type.value})
    if not intg or not intg.get("enabled"):
        raise HTTPException(status_code=400, detail=f"{integration_type.value} not enabled")
    
    if not intg.get("config"):
        raise HTTPException(status_code=400, detail=f"{integration_type.value} not configured")
    
    # Validate config based on integration type
    config = intg["config"]
    if integration_type == IntegrationType.ODOO:
        if not config.get("url"):
            raise HTTPException(status_code=400, detail="Odoo URL not configured")
    elif integration_type == IntegrationType.MS365:
        if not config.get("client_id") or not config.get("tenant_id"):
            raise HTTPException(status_code=400, detail="Microsoft 365 credentials not configured")
    
    # Get entity types from request body or use defaults based on integration type
    if request and request.entity_types:
        entity_types = request.entity_types
    elif integration_type == IntegrationType.MS365:
        entity_types = [EntityType.EMAIL, EntityType.CALENDAR]
    else:
        entity_types = [EntityType.ACCOUNT, EntityType.OPPORTUNITY]
    
    # Create sync job
    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    job = SyncJob(
        id=job_id,
        integration_type=integration_type,
        entity_types=entity_types,
        status=SyncStatus.PENDING,
        created_at=now,
        created_by=token_data["id"]
    )
    
    await db.sync_jobs.insert_one(job.model_dump())
    
    # Update integration status
    await db.integrations.update_one(
        {"integration_type": integration_type.value},
        {"$set": {"sync_status": "in_progress"}}
    )
    
    # Run sync in background
    background_tasks.add_task(run_sync_job, job_id)
    
    return {"message": "Sync job started", "job_id": job_id}


@router.get("/sync/status")
async def get_sync_status(
    token_data: dict = Depends(get_current_user_from_token)
):
    """Get status of recent sync jobs"""
    db = Database.get_db()
    
    jobs = await db.sync_jobs.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    return {"jobs": jobs}


@router.get("/sync/{job_id}")
async def get_sync_job(
    job_id: str,
    token_data: dict = Depends(get_current_user_from_token)
):
    """Get details of a specific sync job"""
    db = Database.get_db()
    
    job = await db.sync_jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Sync job not found")
    
    return job
