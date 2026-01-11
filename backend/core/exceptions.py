"""
Core Exceptions for Sales Intelligence Platform
"""


class SalesIntelException(Exception):
    """Base exception for all platform errors"""
    
    def __init__(self, message: str, code: str = "UNKNOWN_ERROR", details: dict = None):
        self.message = message
        self.code = code
        self.details = details or {}
        super().__init__(self.message)
    
    def to_dict(self) -> dict:
        return {
            "error": self.code,
            "message": self.message,
            "details": self.details
        }


class ConnectionError(SalesIntelException):
    """Error connecting to external system"""
    
    def __init__(self, source: str, message: str, details: dict = None):
        super().__init__(
            message=f"Connection to {source} failed: {message}",
            code="CONNECTION_ERROR",
            details={"source": source, **(details or {})}
        )


class ValidationError(SalesIntelException):
    """Data validation error"""
    
    def __init__(self, entity_type: str, errors: list, record_id: str = None):
        super().__init__(
            message=f"Validation failed for {entity_type}: {', '.join(errors)}",
            code="VALIDATION_ERROR",
            details={
                "entity_type": entity_type,
                "record_id": record_id,
                "validation_errors": errors
            }
        )


class SyncError(SalesIntelException):
    """Error during sync operation"""
    
    def __init__(self, source: str, entity_type: str, message: str, batch_id: str = None):
        super().__init__(
            message=f"Sync error for {source}/{entity_type}: {message}",
            code="SYNC_ERROR",
            details={
                "source": source,
                "entity_type": entity_type,
                "batch_id": batch_id
            }
        )


class AuthenticationError(SalesIntelException):
    """Authentication failed"""
    
    def __init__(self, message: str = "Authentication failed", provider: str = None):
        super().__init__(
            message=message,
            code="AUTHENTICATION_ERROR",
            details={"provider": provider} if provider else {}
        )


class AuthorizationError(SalesIntelException):
    """Authorization/permission denied"""
    
    def __init__(self, message: str = "Permission denied", required_role: str = None):
        super().__init__(
            message=message,
            code="AUTHORIZATION_ERROR",
            details={"required_role": required_role} if required_role else {}
        )


class NotFoundError(SalesIntelException):
    """Resource not found"""
    
    def __init__(self, entity_type: str, entity_id: str):
        super().__init__(
            message=f"{entity_type} with ID {entity_id} not found",
            code="NOT_FOUND",
            details={"entity_type": entity_type, "entity_id": entity_id}
        )


class DuplicateError(SalesIntelException):
    """Duplicate record detected"""
    
    def __init__(self, entity_type: str, identifier: str, existing_id: str):
        super().__init__(
            message=f"Duplicate {entity_type} found: {identifier}",
            code="DUPLICATE_ERROR",
            details={
                "entity_type": entity_type,
                "identifier": identifier,
                "existing_id": existing_id
            }
        )


class ConfigurationError(SalesIntelException):
    """Configuration error"""
    
    def __init__(self, message: str, config_key: str = None):
        super().__init__(
            message=f"Configuration error: {message}",
            code="CONFIG_ERROR",
            details={"config_key": config_key} if config_key else {}
        )


class RateLimitError(SalesIntelException):
    """Rate limit exceeded"""
    
    def __init__(self, source: str, retry_after: int = None):
        super().__init__(
            message=f"Rate limit exceeded for {source}",
            code="RATE_LIMIT_ERROR",
            details={
                "source": source,
                "retry_after": retry_after
            }
        )


class DataIntegrityError(SalesIntelException):
    """Data integrity violation"""
    
    def __init__(self, message: str, zone: str = None, entity_type: str = None):
        super().__init__(
            message=f"Data integrity error: {message}",
            code="DATA_INTEGRITY_ERROR",
            details={
                "zone": zone,
                "entity_type": entity_type
            }
        )
