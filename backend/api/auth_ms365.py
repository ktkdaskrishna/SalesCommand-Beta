"""
Microsoft 365 SSO Routes
Handles OAuth 2.0 / OpenID Connect flow
"""

from fastapi import APIRouter, HTTPException, Response, Request
from fastapi.responses import RedirectResponse
from typing import Any, Dict, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
import secrets

from core.config import get_settings
from integrations.microsoft365.auth_provider import create_ms365_provider


router = APIRouter(prefix="/auth/ms365", tags=["Microsoft 365 Auth"])


class TokenResponse(BaseModel):
    """Response model for successful authentication"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: Dict[str, Any]


class MS365ConfigResponse(BaseModel):
    """Response model for MS365 configuration status"""
    enabled: bool
    client_id: Optional[str] = None
    tenant_id: Optional[str] = None


@router.get("/config", response_model=MS365ConfigResponse)
async def get_ms365_config():
    """Get MS365 SSO configuration status"""
    settings = get_settings()
    
    return MS365ConfigResponse(
        enabled=settings.ms365_enabled,
        client_id=settings.ms365_client_id[:8] + "..." if settings.ms365_client_id else None,
        tenant_id=settings.ms365_tenant_id[:8] + "..." if settings.ms365_tenant_id else None
    )


@router.get("/login")
async def ms365_login(request: Request, redirect_to: Optional[str] = None):
    """
    Initiate MS365 OAuth login flow.
    
    Args:
        redirect_to: URL to redirect to after successful login
    """
    provider = create_ms365_provider()
    if not provider:
        raise HTTPException(
            status_code=503,
            detail="Microsoft 365 SSO is not configured"
        )
    
    # Generate state for CSRF protection
    state = secrets.token_urlsafe(32)
    
    # Store state and redirect URL in session/cookie
    # In production, use secure session storage
    
    login_url = provider.get_login_url(state)
    
    return RedirectResponse(url=login_url)


@router.get("/callback")
async def ms365_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None
):
    """
    Handle OAuth callback from Microsoft.
    """
    # Check for errors from Microsoft
    if error:
        raise HTTPException(
            status_code=400,
            detail=f"OAuth error: {error_description or error}"
        )
    
    if not code:
        raise HTTPException(
            status_code=400,
            detail="No authorization code received"
        )
    
    # Validate state (CSRF protection)
    # In production, verify against stored state
    
    provider = create_ms365_provider()
    if not provider:
        raise HTTPException(
            status_code=503,
            detail="Microsoft 365 SSO is not configured"
        )
    
    # Exchange code for tokens
    user_info = await provider.authenticate({"code": code})
    
    if not user_info:
        raise HTTPException(
            status_code=401,
            detail="Failed to authenticate with Microsoft"
        )
    
    # At this point, we have validated user info from Microsoft
    # The main app should:
    # 1. Find or create user in local database
    # 2. Generate JWT token
    # 3. Redirect to frontend with token
    
    # For now, return user info
    return {
        "status": "success",
        "user": {
            "email": user_info.get("email"),
            "name": user_info.get("name"),
            "provider": "ms365"
        },
        "message": "Authentication successful. Implement user creation and JWT generation."
    }


@router.post("/token/refresh")
async def refresh_ms365_token(refresh_token: str):
    """
    Refresh MS365 access token.
    """
    provider = create_ms365_provider()
    if not provider:
        raise HTTPException(
            status_code=503,
            detail="Microsoft 365 SSO is not configured"
        )
    
    result = await provider.refresh_token(refresh_token)
    
    if not result:
        raise HTTPException(
            status_code=401,
            detail="Failed to refresh token"
        )
    
    return result


@router.post("/token/validate")
async def validate_ms365_token(access_token: str):
    """
    Validate an MS365 access token.
    """
    provider = create_ms365_provider()
    if not provider:
        raise HTTPException(
            status_code=503,
            detail="Microsoft 365 SSO is not configured"
        )
    
    result = await provider.validate_token(access_token)
    
    if not result:
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )
    
    return result
