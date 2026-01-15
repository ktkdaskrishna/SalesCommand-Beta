"""
Global Error Handler Middleware
Captures all unhandled exceptions and logs them
"""
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import traceback
import logging
import time
import uuid

from services.logging.system_logger import system_logger

logger = logging.getLogger(__name__)


async def error_handler_middleware(request: Request, call_next):
    """
    Middleware to catch and log all errors.
    Adds session tracking to every request.
    """
    # Generate or extract session ID
    session_id = request.headers.get('X-Session-ID') or str(uuid.uuid4())
    request.state.session_id = session_id
    
    start_time = time.time()
    
    try:
        response = await call_next(request)
        duration_ms = (time.time() - start_time) * 1000
        
        # Log API call (non-blocking)
        try:
            user_id = getattr(request.state, 'user_id', None)
            
            await system_logger.log_api_call(
                method=request.method,
                endpoint=str(request.url.path),
                status_code=response.status_code,
                duration_ms=duration_ms,
                user_id=user_id,
                session_id=session_id
            )
        except Exception as log_error:
            logger.warning(f"Failed to log API call: {log_error}")
        
        # Add session ID to response headers
        response.headers['X-Session-ID'] = session_id
        
        return response
        
    except Exception as exc:
        duration_ms = (time.time() - start_time) * 1000
        
        # Get user ID if available
        user_id = getattr(request.state, 'user_id', None)
        
        # Get full stack trace
        stack_trace = traceback.format_exc()
        
        # Log error to database
        try:
            await system_logger.log_error(
                error_type='unhandled_exception',
                message=str(exc),
                details={
                    "method": request.method,
                    "endpoint": str(request.url.path),
                    "duration_ms": duration_ms,
                    "query_params": dict(request.query_params)
                },
                user_id=user_id,
                session_id=session_id,
                endpoint=str(request.url.path),
                stack_trace=stack_trace
            )
        except Exception as log_error:
            logger.error(f"Failed to log error: {log_error}")
        
        # Log to console
        logger.error(f"Unhandled error in {request.method} {request.url.path}: {exc}")
        logger.error(stack_trace)
        
        # Return error response
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": "Internal server error",
                "error_id": session_id,
                "message": str(exc),
                "session_id": session_id
            },
            headers={'X-Session-ID': session_id}
        )


def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """
    Custom handler for HTTP exceptions.
    Logs to system_errors collection.
    """
    session_id = getattr(request.state, 'session_id', str(uuid.uuid4()))
    
    # Log non-404 errors
    if exc.status_code >= 500:
        try:
            import asyncio
            asyncio.create_task(system_logger.log_error(
                error_type='http_exception',
                message=exc.detail,
                details={
                    "status_code": exc.status_code,
                    "endpoint": str(request.url.path),
                    "method": request.method
                },
                session_id=session_id,
                endpoint=str(request.url.path)
            ))
        except Exception:
            pass
    
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "session_id": session_id},
        headers={'X-Session-ID': session_id}
    )


def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Handler for request validation errors.
    """
    session_id = getattr(request.state, 'session_id', str(uuid.uuid4()))
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": exc.errors(),
            "body": exc.body,
            "session_id": session_id
        },
        headers={'X-Session-ID': session_id}
    )
