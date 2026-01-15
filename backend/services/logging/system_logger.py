"""
System Logger - Session-Based Error Tracking
Comprehensive logging system for admin monitoring
"""
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
import uuid
import traceback
import logging
import json

from core.database import Database

logger = logging.getLogger(__name__)


class SystemLogger:
    """
    Centralized system logger with session tracking.
    Logs are stored in MongoDB for admin dashboard viewing.
    """
    
    def __init__(self, db=None):
        self.db = db or Database.get_db()
    
    async def log_error(
        self,
        error_type: str,
        message: str,
        details: Dict[str, Any] = None,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        endpoint: Optional[str] = None,
        stack_trace: Optional[str] = None
    ) -> str:
        """
        Log an error to the system.
        
        Args:
            error_type: Category of error (e.g., 'api_error', 'sync_error', 'auth_error')
            message: Error message
            details: Additional context
            user_id: User who triggered the error
            session_id: Session ID for grouping
            endpoint: API endpoint where error occurred
            stack_trace: Full stack trace
        
        Returns:
            Error log ID
        """
        error_id = str(uuid.uuid4())
        
        error_doc = {
            "id": error_id,
            "error_type": error_type,
            "message": message,
            "details": details or {},
            "user_id": user_id,
            "session_id": session_id,
            "endpoint": endpoint,
            "stack_trace": stack_trace,
            "severity": self._determine_severity(error_type),
            "timestamp": datetime.now(timezone.utc),
            "resolved": False,
            "resolved_at": None,
            "resolved_by": None
        }
        
        await self.db.system_errors.insert_one(error_doc)
        logger.error(f"Logged error {error_id}: {error_type} - {message}")
        
        return error_id
    
    async def log_event(
        self,
        event_type: str,
        message: str,
        details: Dict[str, Any] = None,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        level: str = "info"
    ) -> str:
        """
        Log a system event (non-error).
        
        Args:
            event_type: Type of event (e.g., 'user_login', 'sync_complete', 'api_call')
            message: Event description
            details: Additional context
            user_id: User who triggered event
            session_id: Session ID
            level: Log level (info, warning, debug)
        
        Returns:
            Event log ID
        """
        event_id = str(uuid.uuid4())
        
        event_doc = {
            "id": event_id,
            "event_type": event_type,
            "message": message,
            "details": details or {},
            "user_id": user_id,
            "session_id": session_id,
            "level": level,
            "timestamp": datetime.now(timezone.utc)
        }
        
        await self.db.system_logs.insert_one(event_doc)
        
        return event_id
    
    async def log_api_call(
        self,
        method: str,
        endpoint: str,
        status_code: int,
        duration_ms: float,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        request_body: Optional[Dict] = None,
        response_body: Optional[Dict] = None,
        error: Optional[str] = None
    ):
        """
        Log API call for monitoring and debugging.
        
        Args:
            method: HTTP method
            endpoint: API endpoint
            status_code: Response status
            duration_ms: Request duration
            user_id: User making request
            session_id: Session ID
            request_body: Request payload (sanitized)
            response_body: Response payload (sanitized)
            error: Error message if failed
        """
        await self.db.api_call_logs.insert_one({
            "id": str(uuid.uuid4()),
            "method": method,
            "endpoint": endpoint,
            "status_code": status_code,
            "duration_ms": duration_ms,
            "user_id": user_id,
            "session_id": session_id,
            "request_body": self._sanitize_payload(request_body),
            "response_body": self._sanitize_payload(response_body),
            "error": error,
            "timestamp": datetime.now(timezone.utc),
            "is_error": status_code >= 400
        })
    
    async def get_errors_by_session(
        self,
        session_id: str,
        limit: int = 100
    ) -> List[Dict]:
        """
        Get all errors for a specific session.
        
        Args:
            session_id: Session ID
            limit: Max errors to return
        
        Returns:
            List of error documents
        """
        cursor = self.db.system_errors.find(
            {"session_id": session_id}
        ).sort("timestamp", -1).limit(limit)
        
        return await cursor.to_list(limit)
    
    async def get_recent_errors(
        self,
        limit: int = 100,
        error_type: Optional[str] = None,
        unresolved_only: bool = False
    ) -> List[Dict]:
        """
        Get recent system errors.
        
        Args:
            limit: Max errors
            error_type: Filter by type
            unresolved_only: Only show unresolved
        
        Returns:
            List of errors
        """
        query = {}
        if error_type:
            query["error_type"] = error_type
        if unresolved_only:
            query["resolved"] = False
        
        cursor = self.db.system_errors.find(
            query,
            {"_id": 0}
        ).sort("timestamp", -1).limit(limit)
        
        return await cursor.to_list(limit)
    
    async def get_sessions_with_errors(self, limit: int = 50) -> List[Dict]:
        """
        Get all sessions that have errors.
        Groups errors by session for easy debugging.
        
        Returns:
            List of sessions with error counts
        """
        pipeline = [
            {"$match": {"session_id": {"$ne": None}}},
            {"$group": {
                "_id": "$session_id",
                "error_count": {"$sum": 1},
                "first_error": {"$min": "$timestamp"},
                "last_error": {"$max": "$timestamp"},
                "error_types": {"$addToSet": "$error_type"},
                "user_id": {"$first": "$user_id"}
            }},
            {"$sort": {"last_error": -1}},
            {"$limit": limit}
        ]
        
        results = []
        async for doc in self.db.system_errors.aggregate(pipeline):
            results.append({
                "session_id": doc["_id"],
                "error_count": doc["error_count"],
                "first_error": doc["first_error"],
                "last_error": doc["last_error"],
                "error_types": doc["error_types"],
                "user_id": doc["user_id"]
            })
        
        return results
    
    async def mark_error_resolved(
        self,
        error_id: str,
        resolved_by: str,
        resolution_note: Optional[str] = None
    ):
        """
        Mark an error as resolved.
        
        Args:
            error_id: Error ID
            resolved_by: Admin user ID who resolved it
            resolution_note: Note about resolution
        """
        await self.db.system_errors.update_one(
            {"id": error_id},
            {
                "$set": {
                    "resolved": True,
                    "resolved_at": datetime.now(timezone.utc),
                    "resolved_by": resolved_by,
                    "resolution_note": resolution_note
                }
            }
        )
    
    def _determine_severity(self, error_type: str) -> str:
        """Determine error severity based on type"""
        critical_types = ['auth_error', 'database_error', 'sync_error']
        warning_types = ['validation_error', 'not_found']
        
        if error_type in critical_types:
            return 'critical'
        elif error_type in warning_types:
            return 'warning'
        return 'error'
    
    def _sanitize_payload(self, payload: Optional[Dict]) -> Optional[Dict]:
        """Remove sensitive data from payload"""
        if not payload:
            return None
        
        sanitized = payload.copy()
        sensitive_keys = ['password', 'api_key', 'token', 'secret', 'access_token']
        
        for key in sensitive_keys:
            if key in sanitized:
                sanitized[key] = '***REDACTED***'
        
        return sanitized


# Global system logger instance
system_logger = SystemLogger()
