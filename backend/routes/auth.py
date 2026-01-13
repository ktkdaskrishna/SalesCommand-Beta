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
import logging

from models.base import (
    UserCreate, UserLogin, UserResponse, TokenResponse, UserRole
)
from services.auth.jwt_handler import (
    hash_password, verify_password, create_access_token,
    get_current_user_from_token, require_role
)
from core.database import Database

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    """
    Register a new user.
    
    NOTE: Manual registration is BLOCKED for production.
    Users must be synced from Odoo and authenticated via SSO.
    This endpoint is kept for backwards compatibility but returns an error.
    """
    # BLOCK manual registration - users must come from Odoo sync
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Manual registration is disabled. Users must be synced from Odoo and use SSO to login. Contact your administrator."
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
            is_super_admin=user.get("is_super_admin", False),
            avatar_url=user.get("avatar_url"),
            created_at=user["created_at"],
            updated_at=user.get("updated_at", user["created_at"])
        )
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user(token_data: dict = Depends(get_current_user_from_token)):
    """Get current authenticated user (including pending users)"""
    db = Database.get_db()
    
    user = await db.users.find_one({"id": token_data["id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get role information if exists
    if user.get("role_id"):
        role = await db.roles.find_one({"id": user["role_id"]}, {"_id": 0})
        if role:
            user["role_name"] = role.get("name")
            user["role_code"] = role.get("code")
            user["data_scope"] = role.get("data_scope")
            user["permissions"] = role.get("permissions", [])
    
    # Get department information if exists
    if user.get("department_id"):
        dept = await db.departments.find_one({"id": user["department_id"]}, {"_id": 0})
        if dept:
            user["department_name"] = dept.get("name")
    
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

@router.get("/microsoft/config")
async def get_microsoft_config():
    """Get Microsoft OAuth configuration for frontend MSAL"""
    db = Database.get_db()
    
    # Get O365 config
    intg = await db.integrations.find_one({"integration_type": "ms365"})
    if not intg or not intg.get("config") or not intg.get("enabled"):
        return {"client_id": None, "tenant_id": None, "message": "Microsoft 365 not configured"}
    
    config = intg["config"]
    client_id = config.get("client_id")
    tenant_id = config.get("tenant_id")
    
    if not client_id or not tenant_id:
        return {"client_id": None, "tenant_id": None, "message": "Missing client_id or tenant_id"}
    
    return {
        "client_id": client_id,
        "tenant_id": tenant_id
    }


class MicrosoftCompleteRequest(BaseModel):
    access_token: str
    id_token: Optional[str] = None
    account: dict


@router.post("/microsoft/complete", response_model=TokenResponse)
async def microsoft_complete(request: MicrosoftCompleteRequest):
    """
    Complete Microsoft SSO login.
    Called by frontend after MSAL authentication.
    Validates the tokens, creates/updates user, and returns app JWT.
    Fetches user profile details from Azure AD (name, email, job title, department, etc.)
    """
    db = Database.get_db()
    
    try:
        # Verify the access token by calling Microsoft Graph with extended fields
        async with aiohttp.ClientSession() as session:
            headers = {"Authorization": f"Bearer {request.access_token}"}
            # Request additional user profile fields from Graph API
            graph_url = "https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName,jobTitle,department,officeLocation,mobilePhone,businessPhones,companyName"
            async with session.get(graph_url, headers=headers) as response:
                if response.status != 200:
                    error_text = await response.text()
                    logger.error(f"Microsoft Graph API error: {error_text}")
                    raise HTTPException(
                        status_code=401, 
                        detail="Invalid Microsoft access token"
                    )
                
                ms_user = await response.json()
        
        # Log the fetched user data for debugging
        logger.info(f"Microsoft Graph user data: {ms_user}")
        
        # Extract user info from Graph API response
        email = ms_user.get("mail") or ms_user.get("userPrincipalName")
        name = ms_user.get("displayName") or request.account.get("name") or email.split("@")[0]
        ms_id = ms_user.get("id") or request.account.get("localAccountId")
        job_title = ms_user.get("jobTitle")
        department = ms_user.get("department")
        office_location = ms_user.get("officeLocation")
        mobile_phone = ms_user.get("mobilePhone")
        business_phones = ms_user.get("businessPhones", [])
        company_name = ms_user.get("companyName")
        
        if not email:
            raise HTTPException(status_code=400, detail="Could not get email from Microsoft account")
        
        # Check if user exists
        existing_user = await db.users.find_one({"email": email})
        
        now = datetime.now(timezone.utc)
        
        if existing_user:
            # Update user with Microsoft info and tokens
            await db.users.update_one(
                {"email": email},
                {"$set": {
                    "ms_id": ms_id,
                    "ms_access_token": request.access_token,
                    "updated_at": now,
                    "last_login": now
                }}
            )
            user = existing_user
            user_id = existing_user["id"]
            approval_status = existing_user.get("approval_status", "approved")
        else:
            # Create new user for SSO - PENDING APPROVAL
            user_id = str(uuid.uuid4())
            user = {
                "id": user_id,
                "email": email,
                "password_hash": "",  # No password for SSO users
                "name": name,
                "role_id": None,  # No role until admin assigns
                "department_id": None,
                "is_super_admin": False,
                "is_active": True,
                "approval_status": "pending",  # NEW: Requires admin approval
                "avatar_url": None,
                "ms_id": ms_id,
                "ms_access_token": request.access_token,
                "auth_provider": "microsoft",
                "job_title": ms_user.get("jobTitle"),
                "created_at": now,
                "updated_at": now,
                "last_login": now
            }
            await db.users.insert_one(user)
            approval_status = "pending"
            logger.info(f"New SSO user created (pending approval): {email}")
        
        # Create our application JWT token
        jwt_token = create_access_token(user_id, email, user.get("role", "pending"))
        
        logger.info(f"Microsoft SSO login successful for: {email}")
        
        return TokenResponse(
            access_token=jwt_token,
            user=UserResponse(
                id=user_id,
                email=email,
                name=user.get("name", name),
                role=user.get("role", "pending"),
                department=user.get("department"),
                product_line=user.get("product_line"),
                is_active=user.get("is_active", True),
                is_super_admin=user.get("is_super_admin", False),
                avatar_url=user.get("avatar_url"),
                created_at=user.get("created_at", now),
                updated_at=user.get("updated_at", now),
                approval_status=approval_status
            )
        )
        
    except aiohttp.ClientError as e:
        logger.error(f"Network error during Microsoft SSO: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Network error: {str(e)}")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        logger.error(f"Microsoft SSO error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Authentication error: {str(e)}")
