"""
Core Interfaces for Sync Pipeline Components
Following the pattern: Connector → Mapper → Validator → Normalizer → Loader → Logger
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, AsyncIterator, TypeVar, Generic
from datetime import datetime

from .base import RawRecord, BaseEntity, SyncBatch, AuditEntry


T = TypeVar('T', bound=BaseEntity)


class IConnector(ABC):
    """
    Interface for source system connectors.
    Responsible for fetching data from external systems.
    """
    
    @abstractmethod
    async def connect(self) -> bool:
        """Establish connection to the source system"""
        pass
    
    @abstractmethod
    async def disconnect(self) -> None:
        """Close connection to the source system"""
        pass
    
    @abstractmethod
    async def test_connection(self) -> Dict[str, Any]:
        """Test the connection and return status info"""
        pass
    
    @abstractmethod
    async def fetch_records(
        self,
        entity_type: str,
        since: Optional[datetime] = None,
        batch_size: int = 100
    ) -> AsyncIterator[Dict[str, Any]]:
        """Fetch records from source system, optionally since a timestamp"""
        pass
    
    @abstractmethod
    async def fetch_record(self, entity_type: str, record_id: Any) -> Optional[Dict[str, Any]]:
        """Fetch a single record by ID"""
        pass
    
    @abstractmethod
    async def get_record_count(self, entity_type: str, since: Optional[datetime] = None) -> int:
        """Get count of records for planning"""
        pass
    
    @property
    @abstractmethod
    def source_name(self) -> str:
        """Return the source system identifier"""
        pass


class IMapper(ABC):
    """
    Interface for data mappers.
    Transforms source data format to internal schema.
    """
    
    @abstractmethod
    def map_to_raw(self, source_data: Dict[str, Any], batch_id: str) -> RawRecord:
        """Map source data to raw zone record"""
        pass
    
    @abstractmethod
    def map_to_canonical(self, raw_record: RawRecord) -> BaseEntity:
        """Map raw record to canonical entity"""
        pass
    
    @abstractmethod
    def get_field_mappings(self) -> Dict[str, str]:
        """Return the field mapping configuration"""
        pass


class IValidator(ABC):
    """
    Interface for data validators.
    Ensures data integrity and business rules.
    """
    
    @abstractmethod
    def validate_raw(self, record: RawRecord) -> List[str]:
        """Validate raw record, return list of errors (empty if valid)"""
        pass
    
    @abstractmethod
    def validate_canonical(self, entity: BaseEntity) -> List[str]:
        """Validate canonical entity, return list of errors"""
        pass
    
    @abstractmethod
    def get_validation_rules(self) -> Dict[str, Any]:
        """Return the validation rules configuration"""
        pass


class INormalizer(ABC):
    """
    Interface for data normalizers.
    Standardizes data formats and handles deduplication.
    """
    
    @abstractmethod
    async def normalize(self, entity: BaseEntity) -> BaseEntity:
        """Normalize entity data (standardize formats, clean data)"""
        pass
    
    @abstractmethod
    async def deduplicate(self, entity: BaseEntity) -> Optional[BaseEntity]:
        """
        Check for duplicates and merge if found.
        Returns merged entity or None if new.
        """
        pass
    
    @abstractmethod
    async def resolve_references(self, entity: BaseEntity) -> BaseEntity:
        """Resolve foreign key references to canonical IDs"""
        pass


class ILoader(ABC):
    """
    Interface for data loaders.
    Writes data to appropriate data lake zone.
    """
    
    @abstractmethod
    async def load_raw(self, record: RawRecord) -> str:
        """Load record to raw zone, return record ID"""
        pass
    
    @abstractmethod
    async def load_canonical(self, entity: BaseEntity) -> str:
        """Load/update entity in canonical zone, return entity ID"""
        pass
    
    @abstractmethod
    async def load_serving(self, entity: BaseEntity) -> None:
        """Update serving zone views based on entity change"""
        pass
    
    @abstractmethod
    async def bulk_load_raw(self, records: List[RawRecord]) -> int:
        """Bulk load to raw zone, return count loaded"""
        pass


class ILogger(ABC):
    """
    Interface for sync logging and auditing.
    Tracks all operations for observability and replay.
    """
    
    @abstractmethod
    async def log_sync_start(self, batch: SyncBatch) -> None:
        """Log sync batch start"""
        pass
    
    @abstractmethod
    async def log_sync_complete(self, batch: SyncBatch) -> None:
        """Log sync batch completion"""
        pass
    
    @abstractmethod
    async def log_record_processed(
        self,
        batch_id: str,
        source_id: Any,
        status: str,
        error: Optional[str] = None
    ) -> None:
        """Log individual record processing"""
        pass
    
    @abstractmethod
    async def log_audit(self, entry: AuditEntry) -> None:
        """Write audit trail entry"""
        pass
    
    @abstractmethod
    async def get_sync_history(
        self,
        source: Optional[str] = None,
        limit: int = 50
    ) -> List[SyncBatch]:
        """Get sync batch history"""
        pass


class ISyncPipeline(ABC):
    """
    Interface for the complete sync pipeline.
    Orchestrates: Connector → Mapper → Validator → Normalizer → Loader → Logger
    """
    
    @abstractmethod
    async def execute(
        self,
        entity_type: str,
        mode: str = "full",  # full, incremental
        since: Optional[datetime] = None
    ) -> SyncBatch:
        """Execute the full sync pipeline"""
        pass
    
    @abstractmethod
    async def replay(self, batch_id: str) -> SyncBatch:
        """Replay a specific sync batch"""
        pass
    
    @abstractmethod
    async def sync_single(self, entity_type: str, source_id: Any) -> Optional[BaseEntity]:
        """Sync a single record by source ID"""
        pass
    
    @property
    @abstractmethod
    def connector(self) -> IConnector:
        """Get the connector instance"""
        pass
    
    @property
    @abstractmethod
    def source_name(self) -> str:
        """Get the source system name"""
        pass


class IAuthProvider(ABC):
    """
    Interface for authentication providers (M365, Local, etc.)
    """
    
    @abstractmethod
    async def authenticate(self, credentials: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Authenticate user, return user info or None"""
        pass
    
    @abstractmethod
    async def validate_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Validate token, return user info or None"""
        pass
    
    @abstractmethod
    async def refresh_token(self, refresh_token: str) -> Optional[Dict[str, Any]]:
        """Refresh access token"""
        pass
    
    @abstractmethod
    def get_login_url(self, state: str) -> str:
        """Get OAuth login URL (for SSO providers)"""
        pass
    
    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the provider identifier"""
        pass
