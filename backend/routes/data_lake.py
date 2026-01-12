"""
Data Lake Routes
API endpoints for Data Lake operations
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime

from models.base import EntityType, IntegrationType, UserRole
from services.data_lake.manager import DataLakeManager
from services.auth.jwt_handler import get_current_user_from_token, require_role
from core.database import Database

router = APIRouter(prefix="/data-lake", tags=["Data Lake"])


def get_data_lake_manager() -> DataLakeManager:
    """Get DataLakeManager instance"""
    return DataLakeManager(Database.get_db())


@router.get("/health")
async def get_data_lake_health(
    token_data: dict = Depends(get_current_user_from_token)
):
    """Get Data Lake health statistics"""
    manager = get_data_lake_manager()
    return await manager.get_health_stats()


@router.get("/raw")
async def get_raw_records(
    source: Optional[IntegrationType] = None,
    entity_type: Optional[EntityType] = None,
    limit: int = Query(default=100, le=1000),
    token_data: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Get raw zone records (admin only)"""
    manager = get_data_lake_manager()
    records = await manager.get_raw_records(
        source=source,
        entity_type=entity_type,
        limit=limit
    )
    return {"count": len(records), "records": records}


@router.get("/canonical")
async def get_canonical_records(
    entity_type: Optional[EntityType] = None,
    validation_status: Optional[str] = None,
    limit: int = Query(default=100, le=1000),
    token_data: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Get canonical zone records"""
    manager = get_data_lake_manager()
    records = await manager.get_canonical_records(
        entity_type=entity_type,
        validation_status=validation_status,
        limit=limit
    )
    return {"count": len(records), "records": records}


@router.get("/serving")
async def get_serving_records(
    entity_type: Optional[EntityType] = None,
    limit: int = Query(default=100, le=1000),
    token_data: dict = Depends(get_current_user_from_token)
):
    """Get serving zone records (dashboard data)"""
    manager = get_data_lake_manager()
    records = await manager.get_serving_records(
        entity_type=entity_type,
        limit=limit
    )
    return {"count": len(records), "records": records}


@router.get("/serving/{entity_type}")
async def get_serving_by_entity(
    entity_type: EntityType,
    limit: int = Query(default=100, le=1000),
    token_data: dict = Depends(get_current_user_from_token)
):
    """Get serving records by entity type"""
    manager = get_data_lake_manager()
    records = await manager.get_serving_records(
        entity_type=entity_type,
        limit=limit
    )
    
    # Extract just the data for dashboard consumption
    return {
        "entity_type": entity_type.value,
        "count": len(records),
        "data": [r.get("data", {}) for r in records]
    }
