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
    entity_types: Optional[List[EntityType]] = None,
    token_data: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Trigger a sync job for an integration"""
    from services.sync.service import run_sync_job
    
    db = Database.get_db()
    
    # Get integration config
    intg = await db.integrations.find_one({"integration_type": integration_type.value})
    if not intg or not intg.get("enabled"):
        raise HTTPException(status_code=400, detail=f"{integration_type.value} not enabled")
    
    if not intg.get("config") or not intg["config"].get("url"):
        raise HTTPException(status_code=400, detail=f"{integration_type.value} not configured")
    
    # Create sync job
    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    job = SyncJob(
        id=job_id,
        integration_type=integration_type,
        entity_types=entity_types or [EntityType.ACCOUNT, EntityType.OPPORTUNITY],
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
