"""
Base Models
Core Pydantic models for the application
"""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from enum import Enum
import uuid


def generate_uuid() -> str:
    """Generate a new UUID string"""
    return str(uuid.uuid4())


def utc_now() -> datetime:
    """Get current UTC datetime"""
    return datetime.now(timezone.utc)


# ===================== ENUMS =====================

class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    CEO = "ceo"
    ADMIN = "admin"
    SALES_DIRECTOR = "sales_director"
    FINANCE_MANAGER = "finance_manager"
    PRODUCT_DIRECTOR = "product_director"
    ACCOUNT_MANAGER = "account_manager"
    STRATEGY = "strategy"
    REFERRER = "referrer"


class IntegrationType(str, Enum):
    ODOO = "odoo"
    SALESFORCE = "salesforce"
    HUBSPOT = "hubspot"
    MS365 = "ms365"


class DataLakeZone(str, Enum):
    RAW = "raw"
    CANONICAL = "canonical"
    SERVING = "serving"


class SyncStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class EntityType(str, Enum):
    # Odoo/CRM entities
    ACCOUNT = "account"
    CONTACT = "contact"
    OPPORTUNITY = "opportunity"
    ACTIVITY = "activity"
    PRODUCT = "product"
    ORDER = "order"
    INVOICE = "invoice"
    # Microsoft 365 entities
    EMAIL = "email"
    CALENDAR = "calendar"
    OUTLOOK_CONTACT = "outlook_contact"
    ONEDRIVE = "onedrive"


# ===================== BASE MODELS =====================

class TimestampMixin(BaseModel):
    """Mixin for created_at and updated_at fields"""
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class APIResponse(BaseModel):
    """Standard API response wrapper"""
    success: bool = True
    message: str = "OK"
    data: Optional[Any] = None
    errors: Optional[List[str]] = None


# ===================== USER MODELS =====================

class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: UserRole = UserRole.ACCOUNT_MANAGER
    department: Optional[str] = None
    product_line: Optional[str] = None
    is_active: bool = True


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(UserBase, TimestampMixin):
    id: str
    avatar_url: Optional[str] = None
    
    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ===================== DATA LAKE MODELS =====================

class RawRecord(BaseModel):
    """Raw Zone record - stores data exactly as received from source"""
    id: str = Field(default_factory=generate_uuid)
    source: IntegrationType
    source_id: str  # Original ID from source system
    entity_type: EntityType
    raw_data: Dict[str, Any]  # Unmodified source data
    ingested_at: datetime = Field(default_factory=utc_now)
    sync_batch_id: str  # Track which sync job ingested this
    checksum: Optional[str] = None  # For detecting changes


class CanonicalRecord(BaseModel):
    """Canonical Zone record - normalized, validated data"""
    canonical_id: str = Field(default_factory=generate_uuid)
    entity_type: EntityType
    
    # Standardized fields (varies by entity type)
    data: Dict[str, Any]
    
    # Source references for lineage
    source_refs: List[Dict[str, str]] = []  # [{source: "odoo", source_id: "123"}]
    
    # Validation & Quality
    validation_status: str = "valid"  # valid, warning, invalid
    validation_errors: List[str] = []
    quality_score: float = 1.0  # 0-1 score
    
    # Timestamps
    first_seen: datetime = Field(default_factory=utc_now)
    last_updated: datetime = Field(default_factory=utc_now)
    last_validated: datetime = Field(default_factory=utc_now)


class ServingRecord(BaseModel):
    """Serving Zone record - aggregated, dashboard-ready data"""
    serving_id: str = Field(default_factory=generate_uuid)
    entity_type: EntityType
    
    # Aggregated/enriched data optimized for queries
    data: Dict[str, Any]
    
    # Aggregation metadata
    canonical_refs: List[str] = []  # IDs of source canonical records
    aggregation_type: str = "single"  # single, merged, computed
    
    # Performance
    last_aggregated: datetime = Field(default_factory=utc_now)
    cache_ttl: int = 3600  # Seconds until stale


# ===================== FIELD MAPPING MODELS =====================

class FieldMapping(BaseModel):
    """Field mapping configuration for integration"""
    source_field: str
    target_field: str
    transform: Optional[str] = None  # e.g., "uppercase", "date_parse", "lookup"
    transform_config: Optional[Dict[str, Any]] = None
    confidence: float = 1.0  # AI mapping confidence (0-1)
    is_ai_suggested: bool = False
    is_confirmed: bool = False


class IntegrationMapping(BaseModel):
    """Complete mapping configuration for an integration"""
    id: str = Field(default_factory=generate_uuid)
    integration_type: IntegrationType
    entity_type: EntityType
    mappings: List[FieldMapping] = []
    is_active: bool = True
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
    created_by: Optional[str] = None


# ===================== SYNC MODELS =====================

class SyncJob(BaseModel):
    """Sync job tracking"""
    id: str = Field(default_factory=generate_uuid)
    integration_type: IntegrationType
    status: SyncStatus = SyncStatus.PENDING
    entity_types: List[EntityType] = []
    
    # Progress
    total_records: int = 0
    processed_records: int = 0
    failed_records: int = 0
    
    # Timing
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    # Results
    errors: List[str] = []
    summary: Optional[Dict[str, Any]] = None
    
    created_at: datetime = Field(default_factory=utc_now)
    created_by: Optional[str] = None


# ===================== INTEGRATION CONFIG MODELS =====================

class OdooConfig(BaseModel):
    """Odoo integration configuration"""
    url: str
    database: str
    username: str
    api_key: str  # Will be encrypted at rest
    sync_interval_minutes: int = 60
    enabled_entities: List[EntityType] = [EntityType.ACCOUNT, EntityType.OPPORTUNITY]


class IntegrationConfig(BaseModel):
    """Generic integration configuration"""
    id: str = Field(default_factory=generate_uuid)
    integration_type: IntegrationType
    enabled: bool = False
    config: Dict[str, Any] = {}  # Type-specific config
    last_sync: Optional[datetime] = None
    sync_status: SyncStatus = SyncStatus.PENDING
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
