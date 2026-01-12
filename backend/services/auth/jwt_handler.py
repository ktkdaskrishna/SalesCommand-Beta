"""
JWT Authentication Handler
Secure token management for the application
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
import jwt
from passlib.context import CryptContext
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from core.config import settings
from models.base import UserRole

# Password hashing - support both bcrypt and sha256_crypt for backward compatibility
pwd_context = CryptContext(schemes=["bcrypt", "sha256_crypt"], deprecated="auto")

# Security bearer
security = HTTPBearer()


def hash_password(password: str) -> str:
    """Hash a password for storage"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(
    user_id: str,
    email: str,
    role: str,
    expires_delta: Optional[timedelta] = None
) -> str:
    """Create a new JWT access token"""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRATION_HOURS)
    
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": expire,
        "iat": datetime.now(timezone.utc)
    }
    
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> Dict[str, Any]:
    """Decode and validate a JWT token"""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )


async def get_current_user_from_token(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    """
    Extract and validate current user from JWT token.
    Returns the decoded payload (not the full user object).
    Full user lookup should be done in the route if needed.
    """
    payload = decode_token(credentials.credentials)
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload"
        )
    
    return {
        "id": user_id,
        "email": payload.get("email"),
        "role": payload.get("role")
    }


def require_role(allowed_roles: list):
    """
    Dependency factory to require specific roles.
    Usage: Depends(require_role([UserRole.ADMIN, UserRole.CEO]))
    """
    async def role_checker(
        token_data: Dict[str, Any] = Depends(get_current_user_from_token)
    ) -> Dict[str, Any]:
        user_role = token_data.get("role")
        
        # Convert string roles to check
        role_values = [r.value if isinstance(r, UserRole) else r for r in allowed_roles]
        
        if user_role not in role_values:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return token_data
    
    return role_checker


# Role hierarchy for permission checks
ROLE_HIERARCHY = {
    UserRole.SUPER_ADMIN.value: 100,
    UserRole.CEO.value: 90,
    UserRole.ADMIN.value: 80,
    UserRole.SALES_DIRECTOR.value: 70,
    UserRole.FINANCE_MANAGER.value: 70,
    UserRole.PRODUCT_DIRECTOR.value: 60,
    UserRole.ACCOUNT_MANAGER.value: 50,
    UserRole.STRATEGY.value: 40,
    UserRole.REFERRER.value: 30,
}


def has_permission(user_role: str, required_role: str) -> bool:
    """Check if user role has sufficient permissions"""
    user_level = ROLE_HIERARCHY.get(user_role, 0)
    required_level = ROLE_HIERARCHY.get(required_role, 100)
    return user_level >= required_level
