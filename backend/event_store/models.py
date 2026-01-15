"""
Event Store Models
Core event and aggregate models for CQRS
"""
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from enum import Enum
import uuid


class AggregateType(str, Enum):
    """Types of aggregates in the system"""
    USER = "User"
    OPPORTUNITY = "Opportunity"
    ACCOUNT = "Account"
    ACTIVITY = "Activity"
    INVOICE = "Invoice"


class EventType(str, Enum):
    """Event types for all domain events"""
    # User events
    ODOO_USER_SYNCED = "OdooUserSynced"
    USER_LOGGED_IN = "UserLoggedIn"
    MANAGER_ASSIGNED = "ManagerAssigned"
    USER_ROLE_CHANGED = "UserRoleChanged"
    
    # Opportunity events
    ODOO_OPPORTUNITY_SYNCED = "OdooOpportunitySynced"
    OPPORTUNITY_CREATED = "OpportunityCreated"
    OPPORTUNITY_ASSIGNED = "OpportunityAssigned"
    OPPORTUNITY_STAGE_CHANGED = "OpportunityStageChanged"
    OPPORTUNITY_DELETED = "OpportunityDeleted"
    
    # Account events
    ODOO_ACCOUNT_SYNCED = "OdooAccountSynced"
    
    # Invoice events
    ODOO_INVOICE_SYNCED = "OdooInvoiceSynced"
    
    # Activity events
    ODOO_ACTIVITY_SYNCED = "OdooActivitySynced"


class EventMetadata(BaseModel):
    """Metadata for event context"""
    user_id: Optional[str] = None
    source: str = "system"
    correlation_id: Optional[str] = None
    causation_id: Optional[str] = None


class Event(BaseModel):
    """Immutable event in the event store"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_type: EventType
    aggregate_type: AggregateType
    aggregate_id: str
    payload: Dict[str, Any]
    metadata: EventMetadata = Field(default_factory=EventMetadata)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    version: int = 1
    processed_by: List[str] = Field(default_factory=list)
    
    class Config:
        use_enum_values = True
    
    @classmethod
    def from_dict(cls, data: dict) -> 'Event':
        """Create event from MongoDB document"""
        return cls(
            id=data.get("id"),
            event_type=data.get("event_type"),
            aggregate_type=data.get("aggregate_type"),
            aggregate_id=data.get("aggregate_id"),
            payload=data.get("payload", {}),
            metadata=EventMetadata(**data.get("metadata", {})),
            timestamp=data.get("timestamp"),
            version=data.get("version", 1),
            processed_by=data.get("processed_by", [])
        )


class OdooRawData(BaseModel):
    """Immutable Odoo source data"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    entity_type: str
    odoo_id: Any  # Can be int or string
    raw_data: Dict[str, Any]
    fetched_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    sync_job_id: str
    is_latest: bool = True
    checksum: str
