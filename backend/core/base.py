"""
Core Base Classes for Sales Intelligence Platform
"""

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from pydantic import BaseModel as PydanticBaseModel, Field
import uuid


class BaseModel(PydanticBaseModel):
    """Base Pydantic model with common configuration"""
    
    class Config:
        populate_by_name = True
        str_strip_whitespace = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None,
        }


class AuditMixin(BaseModel):
    """Mixin for audit trail fields"""
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    version: int = Field(default=1, alias="_version")


class SourceReference(BaseModel):
    """Reference to source system record"""
    
    source: str  # e.g., "odoo", "ms365", "salesforce"
    source_id: str  # ID in the source system
    source_model: Optional[str] = None  # e.g., "res.partner", "crm.lead"
    last_synced_at: Optional[datetime] = None
    sync_hash: Optional[str] = None  # For change detection


class BaseEntity(AuditMixin):
    """Base class for all canonical entities"""
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sources: List[SourceReference] = Field(default_factory=list, alias="_sources")
    
    def add_source(self, source: str, source_id: str, source_model: Optional[str] = None):
        """Add or update a source reference"""
        existing = next(
            (s for s in self.sources if s.source == source and s.source_id == source_id),
            None
        )
        if existing:
            existing.last_synced_at = datetime.now(timezone.utc)
        else:
            self.sources.append(SourceReference(
                source=source,
                source_id=source_id,
                source_model=source_model,
                last_synced_at=datetime.now(timezone.utc)
            ))
    
    def get_source_id(self, source: str) -> Optional[str]:
        """Get the ID from a specific source system"""
        ref = next((s for s in self.sources if s.source == source), None)
        return ref.source_id if ref else None
    
    def to_mongo_dict(self) -> Dict[str, Any]:
        """Convert to MongoDB-safe dictionary (excludes _id)"""
        data = self.model_dump(by_alias=True)
        data.pop("_id", None)
        return data


class RawRecord(BaseModel):
    """Base class for raw zone records"""
    
    raw_id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_raw_id")
    source: str = Field(..., alias="_source")
    source_id: Any = Field(..., alias="_source_id")
    ingested_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), 
        alias="_ingested_at"
    )
    sync_batch_id: str = Field(..., alias="_sync_batch_id")
    raw_data: Dict[str, Any] = Field(..., alias="_raw_data")
    
    def to_mongo_dict(self) -> Dict[str, Any]:
        """Convert to MongoDB-safe dictionary"""
        return self.model_dump(by_alias=True)


class SyncBatch(AuditMixin):
    """Represents a sync batch for replay capability"""
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    source: str
    entity_type: str
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    status: str = "running"  # running, completed, failed, partial
    records_processed: int = 0
    records_created: int = 0
    records_updated: int = 0
    records_failed: int = 0
    errors: List[Dict[str, Any]] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AuditEntry(BaseModel):
    """Audit trail entry for all data changes"""
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    entity_type: str
    entity_id: str
    action: str  # create, update, delete, sync
    zone: str  # raw, canonical, serving
    user_id: Optional[str] = None
    source: Optional[str] = None
    changes: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)
