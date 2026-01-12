"""
Auth Routes
Authentication endpoints for the API
"""
from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
from datetime import datetime, timezone
import uuid

from models.base import (
    UserCreate, UserLogin, UserResponse, TokenResponse, UserRole
)
from services.auth.jwt_handler import (
    hash_password, verify_password, create_access_token,
    get_current_user_from_token, require_role
)
from core.database import Database

router = APIRouter(prefix="/auth", tags=["Authentication"])


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
