"""
Microsoft 365 Authentication Provider
Implements OAuth 2.0 / OpenID Connect for Azure AD
"""

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional
import httpx
import jwt
import logging

from core.interfaces import IAuthProvider
from core.config import get_settings


logger = logging.getLogger(__name__)


class MS365AuthProvider(IAuthProvider):
    """
    Microsoft 365 / Azure AD authentication provider.
    
    Implements:
    - OAuth 2.0 Authorization Code Flow
    - OpenID Connect for identity
    - Token validation and refresh
    """
    
    # Microsoft OAuth endpoints
    AUTHORITY_BASE = "https://login.microsoftonline.com"
    GRAPH_API = "https://graph.microsoft.com/v1.0"
    
    def __init__(
        self,
        client_id: str,
        client_secret: str,
        tenant_id: str,
        redirect_uri: str
    ):
        self.client_id = client_id
        self.client_secret = client_secret
        self.tenant_id = tenant_id
        self.redirect_uri = redirect_uri
        
        self.authority = f"{self.AUTHORITY_BASE}/{tenant_id}"
        self.token_endpoint = f"{self.authority}/oauth2/v2.0/token"
        self.auth_endpoint = f"{self.authority}/oauth2/v2.0/authorize"
        self.jwks_uri = f"{self.authority}/discovery/v2.0/keys"
        
        self._jwks_cache = None
        self._jwks_cache_time = None
    
    @property
    def provider_name(self) -> str:
        return "ms365"
    
    def get_login_url(self, state: str) -> str:
        """
        Generate OAuth authorization URL.
        
        Args:
            state: Random state for CSRF protection
            
        Returns:
            Authorization URL to redirect user to
        """
        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": self.redirect_uri,
            "scope": "openid profile email User.Read",
            "response_mode": "query",
            "state": state,
            "prompt": "select_account",
        }
        
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{self.auth_endpoint}?{query}"
    
    async def authenticate(self, credentials: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Exchange authorization code for tokens and user info.
        
        Args:
            credentials: Dict with 'code' from OAuth callback
            
        Returns:
            User info dict or None if failed
        """
        code = credentials.get("code")
        if not code:
            logger.error("No authorization code provided")
            return None
        
        try:
            # Exchange code for tokens
            tokens = await self._exchange_code(code)
            if not tokens:
                return None
            
            # Get user info from Graph API
            user_info = await self._get_user_info(tokens["access_token"])
            if not user_info:
                return None
            
            # Parse ID token for additional claims
            id_claims = self._decode_id_token(tokens.get("id_token"))
            
            return {
                "id": user_info.get("id"),
                "email": user_info.get("mail") or user_info.get("userPrincipalName"),
                "name": user_info.get("displayName"),
                "first_name": user_info.get("givenName"),
                "last_name": user_info.get("surname"),
                "job_title": user_info.get("jobTitle"),
                "department": user_info.get("department"),
                "provider": self.provider_name,
                "access_token": tokens["access_token"],
                "refresh_token": tokens.get("refresh_token"),
                "expires_at": datetime.now(timezone.utc) + timedelta(seconds=tokens.get("expires_in", 3600)),
            }
            
        except Exception as e:
            logger.error(f"MS365 authentication failed: {e}")
            return None
    
    async def validate_token(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Validate an access token and return user info.
        """
        try:
            # Try to get user info - if token is valid, this will work
            user_info = await self._get_user_info(token)
            if user_info:
                return {
                    "id": user_info.get("id"),
                    "email": user_info.get("mail") or user_info.get("userPrincipalName"),
                    "name": user_info.get("displayName"),
                    "valid": True
                }
            return None
        except Exception as e:
            logger.error(f"Token validation failed: {e}")
            return None
    
    async def refresh_token(self, refresh_token: str) -> Optional[Dict[str, Any]]:
        """
        Refresh an expired access token.
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.token_endpoint,
                    data={
                        "client_id": self.client_id,
                        "client_secret": self.client_secret,
                        "grant_type": "refresh_token",
                        "refresh_token": refresh_token,
                        "scope": "openid profile email User.Read",
                    }
                )
                
                if response.status_code != 200:
                    logger.error(f"Token refresh failed: {response.text}")
                    return None
                
                tokens = response.json()
                return {
                    "access_token": tokens["access_token"],
                    "refresh_token": tokens.get("refresh_token", refresh_token),
                    "expires_at": datetime.now(timezone.utc) + timedelta(seconds=tokens.get("expires_in", 3600)),
                }
                
        except Exception as e:
            logger.error(f"Token refresh failed: {e}")
            return None
    
    async def _exchange_code(self, code: str) -> Optional[Dict[str, Any]]:
        """Exchange authorization code for tokens"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_endpoint,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.redirect_uri,
                    "scope": "openid profile email User.Read offline_access",
                }
            )
            
            if response.status_code != 200:
                logger.error(f"Code exchange failed: {response.text}")
                return None
            
            return response.json()
    
    async def _get_user_info(self, access_token: str) -> Optional[Dict[str, Any]]:
        """Fetch user info from Microsoft Graph API"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.GRAPH_API}/me",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if response.status_code != 200:
                logger.error(f"Graph API call failed: {response.text}")
                return None
            
            return response.json()
    
    def _decode_id_token(self, id_token: str) -> Dict[str, Any]:
        """Decode ID token without full validation (for claims extraction)"""
        if not id_token:
            return {}
        
        try:
            # Decode without verification for claims (we trust the token from MS)
            return jwt.decode(id_token, options={"verify_signature": False})
        except Exception as e:
            logger.warning(f"Failed to decode ID token: {e}")
            return {}


def create_ms365_provider() -> Optional[MS365AuthProvider]:
    """Factory function to create MS365 provider from settings"""
    settings = get_settings()
    
    if not settings.ms365_enabled:
        return None
    
    return MS365AuthProvider(
        client_id=settings.ms365_client_id,
        client_secret=settings.ms365_client_secret,
        tenant_id=settings.ms365_tenant_id,
        redirect_uri=settings.ms365_redirect_uri
    )
