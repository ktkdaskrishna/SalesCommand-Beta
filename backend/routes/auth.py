"""
Auth Routes
Authentication endpoints for the API
"""
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import aiohttp
import os

from models.base import (
    UserCreate, UserLogin, UserResponse, TokenResponse, UserRole
)
from services.auth.jwt_handler import (
    hash_password, verify_password, create_access_token,
    get_current_user_from_token, require_role
)
from core.database import Database

router = APIRouter(prefix="/auth", tags=["Authentication"])


class MicrosoftCallbackRequest(BaseModel):
    code: str
    redirect_uri: str
    code_verifier: str


@router.post("/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    """Register a new user"""
    db = Database.get_db()
    
    # Check if email exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    user_dict = {
        "id": user_id,
        "email": user_data.email,
        "password_hash": hash_password(user_data.password),
        "name": user_data.name,
        "role": user_data.role.value if isinstance(user_data.role, UserRole) else user_data.role,
        "department": user_data.department,
        "product_line": user_data.product_line,
        "is_active": True,
        "avatar_url": None,
        "created_at": now,
        "updated_at": now
    }
    
    await db.users.insert_one(user_dict)
    
    token = create_access_token(user_id, user_data.email, user_dict["role"])
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            email=user_data.email,
            name=user_data.name,
            role=user_dict["role"],
            department=user_data.department,
            product_line=user_data.product_line,
            is_active=True,
            created_at=now,
            updated_at=now
        )
    )


@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """Login and get access token"""
    db = Database.get_db()
    
    user = await db.users.find_one({"email": credentials.email})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is disabled"
        )
    
    token = create_access_token(user["id"], user["email"], user["role"])
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            role=user["role"],
            department=user.get("department"),
            product_line=user.get("product_line"),
            is_active=user.get("is_active", True),
            avatar_url=user.get("avatar_url"),
            created_at=user["created_at"],
            updated_at=user.get("updated_at", user["created_at"])
        )
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user(token_data: dict = Depends(get_current_user_from_token)):
    """Get current authenticated user"""
    db = Database.get_db()
    
    user = await db.users.find_one({"id": token_data["id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserResponse(**user)


@router.get("/users", response_model=List[UserResponse])
async def get_users(
    token_data: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.CEO, UserRole.ADMIN]))
):
    """Get all users (admin only)"""
    db = Database.get_db()
    
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [UserResponse(**u) for u in users]


# ===================== MICROSOFT SSO ROUTES =====================

@router.get("/microsoft/login")
async def microsoft_login():
    """Get Microsoft OAuth authorization URL"""
    db = Database.get_db()
    
    # Get O365 config
    intg = await db.integrations.find_one({"integration_type": "ms365"})
    if not intg or not intg.get("config") or not intg.get("enabled"):
        return {"auth_url": None, "message": "Microsoft 365 not configured"}
    
    config = intg["config"]
    client_id = config.get("client_id")
    tenant_id = config.get("tenant_id")
    
    if not client_id or not tenant_id:
        return {"auth_url": None, "message": "Missing client_id or tenant_id"}
    
    # Get frontend URL for redirect
    frontend_url = os.environ.get("FRONTEND_URL", "https://unruffled-hermann-2.preview.emergentagent.com")
    redirect_uri = f"{frontend_url}/login"
    
    # Microsoft OAuth scopes
    scopes = [
        "openid",
        "profile", 
        "email",
        "User.Read",
        "Mail.Read",
        "Mail.Send",
        "Calendars.Read",
        "Calendars.ReadWrite",
        "offline_access"
    ]
    
    auth_url = (
        f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/authorize?"
        f"client_id={client_id}&"
        f"response_type=code&"
        f"redirect_uri={redirect_uri}&"
        f"response_mode=query&"
        f"scope={' '.join(scopes)}&"
        f"state=salesintel"
    )
    
    return {"auth_url": auth_url}


@router.post("/microsoft/callback", response_model=TokenResponse)
async def microsoft_callback(callback_data: MicrosoftCallbackRequest):
    """Handle Microsoft OAuth callback and create/login user"""
    db = Database.get_db()
    
    # Get O365 config
    intg = await db.integrations.find_one({"integration_type": "ms365"})
    if not intg or not intg.get("config"):
        raise HTTPException(status_code=400, detail="Microsoft 365 not configured")
    
    config = intg["config"]
    client_id = config.get("client_id")
    client_secret = config.get("client_secret")
    tenant_id = config.get("tenant_id")
    
    # Exchange code for tokens
    token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    
    token_data = {
        "client_id": client_id,
        "client_secret": client_secret,
        "code": callback_data.code,
        "redirect_uri": callback_data.redirect_uri,
        "grant_type": "authorization_code"
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            # Get tokens
            async with session.post(token_url, data=token_data) as response:
                token_result = await response.json()
                
                if "error" in token_result:
                    raise HTTPException(
                        status_code=400,
                        detail=token_result.get("error_description", "Token exchange failed")
                    )
                
                access_token = token_result.get("access_token")
                refresh_token = token_result.get("refresh_token")
            
            # Get user info from Microsoft Graph
            headers = {"Authorization": f"Bearer {access_token}"}
            async with session.get("https://graph.microsoft.com/v1.0/me", headers=headers) as user_response:
                if user_response.status != 200:
                    raise HTTPException(status_code=400, detail="Failed to get user info")
                
                ms_user = await user_response.json()
        
        # Extract user info
        email = ms_user.get("mail") or ms_user.get("userPrincipalName")
        name = ms_user.get("displayName", email.split("@")[0])
        ms_id = ms_user.get("id")
        
        # Check if user exists
        existing_user = await db.users.find_one({"email": email})
        
        now = datetime.now(timezone.utc)
        
        if existing_user:
            # Update user with Microsoft tokens
            await db.users.update_one(
                {"email": email},
                {"$set": {
                    "ms_id": ms_id,
                    "ms_access_token": access_token,
                    "ms_refresh_token": refresh_token,
                    "updated_at": now,
                    "last_login": now
                }}
            )
            user = existing_user
        else:
            # Create new user
            user_id = str(uuid.uuid4())
            user = {
                "id": user_id,
                "email": email,
                "password_hash": "",  # No password for SSO users
                "name": name,
                "role": UserRole.ADMIN.value,  # Default role for SSO users
                "department": None,
                "product_line": None,
                "is_active": True,
                "avatar_url": None,
                "ms_id": ms_id,
                "ms_access_token": access_token,
                "ms_refresh_token": refresh_token,
                "auth_provider": "microsoft",
                "created_at": now,
                "updated_at": now,
                "last_login": now
            }
            await db.users.insert_one(user)
        
        # Create our JWT token
        jwt_token = create_access_token(user["id"], email, user["role"])
        
        return TokenResponse(
            access_token=jwt_token,
            user=UserResponse(
                id=user["id"],
                email=email,
                name=user.get("name", name),
                role=user["role"],
                department=user.get("department"),
                product_line=user.get("product_line"),
                is_active=user.get("is_active", True),
                avatar_url=user.get("avatar_url"),
                created_at=user.get("created_at", now),
                updated_at=user.get("updated_at", now)
            )
        )
        
    except aiohttp.ClientError as e:
        raise HTTPException(status_code=500, detail=f"Network error: {str(e)}")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"Authentication error: {str(e)}")
