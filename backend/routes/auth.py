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
            # Update user with Microsoft info and tokens (sync Azure AD data)
            update_data = {
                "ms_id": ms_id,
                "ms_access_token": request.access_token,
                "name": name,  # Sync name from AD
                "updated_at": now,
                "last_login": now
            }
            # Update optional fields if available from Azure AD
            if job_title:
                update_data["job_title"] = job_title
            if department:
                update_data["ad_department"] = department  # Store AD department separately
            if office_location:
                update_data["office_location"] = office_location
            if mobile_phone:
                update_data["mobile_phone"] = mobile_phone
            if business_phones:
                update_data["business_phones"] = business_phones
            if company_name:
                update_data["company_name"] = company_name
                
            await db.users.update_one(
                {"email": email},
                {"$set": update_data}
            )
            user = existing_user
            user_id = existing_user["id"]
            approval_status = existing_user.get("approval_status", "approved")
            logger.info(f"Existing SSO user updated with Azure AD data: {email}")
        else:
            # Create new user for SSO - PENDING APPROVAL
            # All Azure AD profile data is synced
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
                "approval_status": "pending",  # Requires admin approval
                "avatar_url": None,
                "ms_id": ms_id,
                "ms_access_token": request.access_token,
                "auth_provider": "microsoft",
                # Azure AD profile fields
                "job_title": job_title,
                "ad_department": department,
                "office_location": office_location,
                "mobile_phone": mobile_phone,
                "business_phones": business_phones,
                "company_name": company_name,
                # Timestamps
                "created_at": now,
                "updated_at": now,
                "last_login": now
            }
            await db.users.insert_one(user)
            approval_status = "pending"
            logger.info(f"New SSO user created (pending approval): {email} - Job: {job_title}, Dept: {department}")
        
        # Create our application JWT token
        user_role = user.get("role")
        jwt_token = create_access_token(user_id, email, user_role if user_role else None)
        
        logger.info(f"Microsoft SSO login successful for: {email}")
        
        return TokenResponse(
            access_token=jwt_token,
            user=UserResponse(
                id=user_id,
                email=email,
                name=user.get("name", name),
                role=user_role,  # None for pending users
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


# ===================== SELF-SERVICE ODOO LINKING =====================

async def require_approved():
    """Dependency to require an approved user"""
    async def dependency(token_data: dict = Depends(get_current_user_from_token)):
        db = Database.get_db()
        user = await db.users.find_one({"id": token_data["id"]})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        if user.get("approval_status") == "pending":
            raise HTTPException(status_code=403, detail="User pending approval")
        
        return token_data
    return Depends(dependency)


@router.post("/relink-odoo")
async def self_relink_to_odoo(
    token_data: dict = Depends(get_current_user_from_token)
):
    """
    Self-service endpoint for users to re-link their profile to Odoo.
    Any approved user can attempt to re-link THEMSELVES.
    
    Matching strategies (in order):
    1. Email match (work_email or login in Odoo users)
    2. Name match (fuzzy)
    3. Salesperson match (from opportunities)
    """
    db = Database.get_db()
    
    user_id = token_data["id"]
    user = await db.users.find_one({"id": user_id})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("approval_status") == "pending":
        raise HTTPException(status_code=403, detail="Your account is pending approval. Please contact an administrator.")
    
    user_email = (user.get("email") or "").lower()
    user_name = user.get("name", "")
    odoo_enrichment = {}
    match_method = None
    match_details = []
    
    try:
        # Strategy 1: Match by email
        odoo_user_doc = await db.data_lake_serving.find_one({
            "entity_type": "user",
            "$or": [
                {"data.email": {"$regex": f"^{user_email}$", "$options": "i"}},
                {"data.login": {"$regex": f"^{user_email}$", "$options": "i"}},
                {"data.work_email": {"$regex": f"^{user_email}$", "$options": "i"}}
            ]
        })
        
        if odoo_user_doc:
            odoo_data = odoo_user_doc.get("data", {})
            odoo_enrichment = {
                "odoo_user_id": odoo_data.get("odoo_user_id") or odoo_data.get("id"),
                "odoo_employee_id": odoo_data.get("odoo_employee_id") or odoo_data.get("employee_id"),
                "odoo_department_id": odoo_data.get("department_odoo_id") or odoo_data.get("department_id"),
                "odoo_department_name": odoo_data.get("department_name"),
                "odoo_team_id": odoo_data.get("team_id"),
                "odoo_team_name": odoo_data.get("team_name"),
                "odoo_job_title": odoo_data.get("job_title"),
                "odoo_salesperson_name": odoo_data.get("name"),
                "odoo_matched": True,
                "odoo_match_email": user_email,
            }
            match_method = "email"
            match_details.append(f"Email matched: {user_email}")
        
        # Strategy 2: Match by name (if email didn't match)
        if not odoo_enrichment and user_name:
            # Try exact name match first
            odoo_user_by_name = await db.data_lake_serving.find_one({
                "entity_type": "user",
                "data.name": {"$regex": f"^{user_name}$", "$options": "i"}
            })
            
            if not odoo_user_by_name:
                # Try partial name match (first name or last name)
                name_parts = user_name.split()
                if name_parts:
                    odoo_user_by_name = await db.data_lake_serving.find_one({
                        "entity_type": "user",
                        "$or": [
                            {"data.name": {"$regex": name_parts[0], "$options": "i"}},
                            {"data.name": {"$regex": name_parts[-1], "$options": "i"}} if len(name_parts) > 1 else {}
                        ]
                    })
            
            if odoo_user_by_name:
                odoo_data = odoo_user_by_name.get("data", {})
                odoo_enrichment = {
                    "odoo_user_id": odoo_data.get("odoo_user_id") or odoo_data.get("id"),
                    "odoo_employee_id": odoo_data.get("odoo_employee_id"),
                    "odoo_department_id": odoo_data.get("department_odoo_id"),
                    "odoo_department_name": odoo_data.get("department_name"),
                    "odoo_job_title": odoo_data.get("job_title"),
                    "odoo_salesperson_name": odoo_data.get("name"),
                    "odoo_matched": True,
                    "odoo_match_email": odoo_data.get("email") or odoo_data.get("work_email"),
                }
                match_method = "name"
                match_details.append(f"Name matched: {user_name} → {odoo_data.get('name')}")
        
        # Strategy 3: Match by salesperson in opportunities
        if not odoo_enrichment:
            opp = await db.data_lake_serving.find_one({
                "entity_type": "opportunity",
                "$or": [
                    {"data.salesperson_email": {"$regex": user_email, "$options": "i"}},
                    {"data.salesperson_name": {"$regex": user_name, "$options": "i"}}
                ]
            })
            
            if opp:
                opp_data = opp.get("data", {})
                odoo_enrichment = {
                    "odoo_salesperson_name": opp_data.get("salesperson_name") or user_name,
                    "odoo_team_id": opp_data.get("team_id"),
                    "odoo_team_name": opp_data.get("team_name"),
                    "odoo_matched": True,
                    "odoo_match_email": user_email,
                }
                match_method = "opportunity_salesperson"
                match_details.append(f"Matched as salesperson in opportunity: {opp_data.get('name')}")
        
    except Exception as e:
        logger.error(f"Error in self-relink: {e}")
        raise HTTPException(status_code=500, detail=f"Error during Odoo matching: {str(e)}")
    
    if odoo_enrichment:
        # Update user with Odoo data
        update_data = {
            "updated_at": datetime.now(timezone.utc),
            "odoo_match_status": f"self_linked_{match_method}",
            "odoo_match_method": match_method,
            **odoo_enrichment
        }
        await db.users.update_one({"id": user_id}, {"$set": update_data})
        
        # Log the self-link
        await db.audit_log.insert_one({
            "id": str(uuid.uuid4()),
            "action": "user_self_relinked",
            "user_id": user_id,
            "match_method": match_method,
            "match_details": match_details,
            "odoo_enrichment": odoo_enrichment,
            "timestamp": datetime.now(timezone.utc),
        })
        
        return {
            "success": True,
            "message": "Successfully linked to Odoo",
            "match_method": match_method,
            "match_details": match_details,
            "odoo_salesperson_name": odoo_enrichment.get("odoo_salesperson_name"),
            "odoo_department_name": odoo_enrichment.get("odoo_department_name"),
            "odoo_team_name": odoo_enrichment.get("odoo_team_name"),
        }
    else:
        # No match found - provide helpful suggestions
        # Check how many users exist in Odoo sync
        odoo_user_count = await db.data_lake_serving.count_documents({"entity_type": "user"})
        
        suggestions = []
        if odoo_user_count == 0:
            suggestions.append("No Odoo users have been synced yet. Ask an administrator to run an Odoo sync first.")
        else:
            suggestions.append(f"Found {odoo_user_count} Odoo users in sync, but none matched your profile.")
            suggestions.append(f"Ensure your work email in Odoo matches: {user_email}")
            suggestions.append("Contact an administrator to manually link your account if needed.")
        
        return {
            "success": False,
            "message": "No Odoo match found",
            "attempted_email": user_email,
            "attempted_name": user_name,
            "suggestions": suggestions
        }

