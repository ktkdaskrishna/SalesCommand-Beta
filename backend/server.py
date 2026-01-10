from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'salescommand-secret-key-2025')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Password hashing - use sha256_crypt as fallback for compatibility
pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")

# Security
security = HTTPBearer()

app = FastAPI(title="SalesCommand Enterprise API")
api_router = APIRouter(prefix="/api")

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ===================== MODELS =====================

class UserRole:
    CEO = "ceo"
    PRODUCT_DIRECTOR = "product_director"
    ACCOUNT_MANAGER = "account_manager"
    STRATEGY = "strategy"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"
    SALES_DIRECTOR = "sales_director"
    FINANCE_MANAGER = "finance_manager"
    REFERRER = "referrer"

ROLE_HIERARCHY = {
    UserRole.SUPER_ADMIN: 7,
    UserRole.CEO: 6,
    UserRole.ADMIN: 5,
    UserRole.SALES_DIRECTOR: 4,
    UserRole.FINANCE_MANAGER: 4,
    UserRole.PRODUCT_DIRECTOR: 3,
    UserRole.ACCOUNT_MANAGER: 2,
    UserRole.STRATEGY: 1,
    UserRole.REFERRER: 0
}

# User Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = UserRole.ACCOUNT_MANAGER
    department: Optional[str] = None
    product_line: Optional[str] = None  # For Product Directors

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    department: Optional[str] = None
    product_line: Optional[str] = None
    created_at: datetime
    avatar_url: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Account Models
class StakeholderCreate(BaseModel):
    name: str
    title: str
    email: Optional[str] = None
    phone: Optional[str] = None
    influence_level: str = "medium"  # low, medium, high, champion
    notes: Optional[str] = None

class AccountCreate(BaseModel):
    name: str
    industry: Optional[str] = None
    website: Optional[str] = None
    annual_revenue: Optional[float] = None
    employee_count: Optional[int] = None
    business_overview: Optional[str] = None
    relationship_maturity: str = "new"  # new, developing, established, strategic
    strategic_notes: Optional[str] = None
    stakeholders: List[StakeholderCreate] = []
    assigned_am_id: Optional[str] = None
    odoo_id: Optional[str] = None

class AccountResponse(BaseModel):
    id: str
    name: str
    industry: Optional[str] = None
    website: Optional[str] = None
    annual_revenue: Optional[float] = None
    employee_count: Optional[int] = None
    business_overview: Optional[str] = None
    relationship_maturity: str
    strategic_notes: Optional[str] = None
    stakeholders: List[Dict] = []
    assigned_am_id: Optional[str] = None
    assigned_am_name: Optional[str] = None
    odoo_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    opportunity_count: int = 0
    total_pipeline_value: float = 0

# Opportunity Models
class OpportunityCreate(BaseModel):
    name: str
    account_id: str
    value: float
    stage: str = "qualification"  # qualification, discovery, proposal, negotiation, closed_won, closed_lost
    probability: int = 10
    expected_close_date: Optional[datetime] = None
    product_lines: List[str] = []  # MSSP, Application Security, Network Security, GRC
    description: Optional[str] = None
    # Blue Sheet Fields
    single_sales_objective: Optional[str] = None
    ideal_customer_profile: Optional[str] = None
    buying_influences: List[Dict] = []  # {name, role, influence_type, current_status}
    red_flags: List[str] = []
    strengths: List[str] = []
    competition: Optional[str] = None
    odoo_id: Optional[str] = None

class OpportunityResponse(BaseModel):
    id: str
    name: str
    account_id: str
    account_name: Optional[str] = None
    value: float
    stage: str
    probability: int
    expected_close_date: Optional[datetime] = None
    product_lines: List[str] = []
    description: Optional[str] = None
    single_sales_objective: Optional[str] = None
    ideal_customer_profile: Optional[str] = None
    buying_influences: List[Dict] = []
    red_flags: List[str] = []
    strengths: List[str] = []
    competition: Optional[str] = None
    owner_id: str
    owner_name: Optional[str] = None
    odoo_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

# Activity Models
class ActivityCreate(BaseModel):
    title: str
    description: Optional[str] = None
    activity_type: str = "task"  # task, meeting, call, email, presentation, demo
    priority: str = "medium"  # low, medium, high, critical
    status: str = "pending"  # pending, in_progress, completed, cancelled
    due_date: Optional[datetime] = None
    account_id: Optional[str] = None
    opportunity_id: Optional[str] = None
    product_line: Optional[str] = None
    assigned_to_id: Optional[str] = None
    dependencies: List[str] = []  # List of activity IDs

class ActivityResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    activity_type: str
    priority: str
    status: str
    due_date: Optional[datetime] = None
    account_id: Optional[str] = None
    account_name: Optional[str] = None
    opportunity_id: Optional[str] = None
    opportunity_name: Optional[str] = None
    product_line: Optional[str] = None
    created_by_id: str
    created_by_name: Optional[str] = None
    assigned_to_id: Optional[str] = None
    assigned_to_name: Optional[str] = None
    dependencies: List[str] = []
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

# KPI Models
class KPICreate(BaseModel):
    name: str
    target_value: float
    current_value: float = 0
    unit: str = "currency"  # currency, percentage, count
    period: str = "monthly"  # weekly, monthly, quarterly, yearly
    category: str = "sales"  # sales, activity, relationship, execution
    user_id: Optional[str] = None
    product_line: Optional[str] = None

class KPIResponse(BaseModel):
    id: str
    name: str
    target_value: float
    current_value: float
    unit: str
    period: str
    category: str
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    product_line: Optional[str] = None
    achievement_percentage: float = 0
    trend: str = "stable"  # up, down, stable
    created_at: datetime
    updated_at: datetime

# Incentive Models
class IncentiveCreate(BaseModel):
    user_id: str
    name: str
    description: Optional[str] = None
    target_amount: float
    earned_amount: float = 0
    period: str = "quarterly"
    criteria: Dict = {}  # {closed_deals: 5, pipeline_value: 1000000}

class IncentiveResponse(BaseModel):
    id: str
    user_id: str
    user_name: Optional[str] = None
    name: str
    description: Optional[str] = None
    target_amount: float
    earned_amount: float
    period: str
    criteria: Dict = {}
    achievement_percentage: float = 0
    status: str = "in_progress"  # in_progress, achieved, missed
    created_at: datetime
    updated_at: datetime

# Integration Settings Models
class IntegrationSettingCreate(BaseModel):
    integration_type: str  # odoo, office365
    enabled: bool = False
    api_url: Optional[str] = None
    api_key: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    tenant_id: Optional[str] = None
    sync_interval_minutes: int = 60
    settings: Dict = {}

class IntegrationSettingResponse(BaseModel):
    id: str
    integration_type: str
    enabled: bool
    api_url: Optional[str] = None
    has_api_key: bool = False
    has_client_credentials: bool = False
    sync_interval_minutes: int
    last_sync: Optional[datetime] = None
    settings: Dict = {}
    status: str = "disconnected"  # connected, disconnected, error

# Dashboard Models
class DashboardWidgetConfig(BaseModel):
    widget_id: str
    widget_type: str  # kpi_card, chart, table, progress, alert
    title: str
    position: Dict = {"x": 0, "y": 0}
    size: Dict = {"w": 4, "h": 2}
    config: Dict = {}
    visible: bool = True

class DashboardConfigCreate(BaseModel):
    name: str = "Default"
    widgets: List[DashboardWidgetConfig] = []
    is_default: bool = False

class DashboardConfigResponse(BaseModel):
    id: str
    user_id: str
    name: str
    widgets: List[Dict]
    is_default: bool
    created_at: datetime
    updated_at: datetime

# Notification Models
class NotificationResponse(BaseModel):
    id: str
    user_id: str
    title: str
    message: str
    notification_type: str  # info, warning, success, error
    read: bool = False
    link: Optional[str] = None
    created_at: datetime

# ===================== PIPELINE STAGE MODELS =====================

class PipelineStageCreate(BaseModel):
    name: str
    order: int
    color: str = "#3B82F6"
    probability_default: int = 10
    is_won: bool = False
    is_lost: bool = False

class PipelineStageResponse(BaseModel):
    id: str
    name: str
    order: int
    color: str
    probability_default: int
    is_won: bool
    is_lost: bool

# ===================== COMMISSION TEMPLATE MODELS =====================

class CommissionTier(BaseModel):
    min_attainment: float  # 0-100%
    max_attainment: float
    multiplier: float  # e.g., 0.5, 1.0, 1.5
    rate: Optional[float] = None  # Optional flat rate

class CommissionTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    template_type: str  # flat, tiered_attainment, tiered_revenue, quota_based
    base_rate: float = 0.05  # 5% default
    tiers: List[CommissionTier] = []
    product_weights: Dict[str, float] = {}  # Product line weights
    new_logo_multiplier: float = 1.0
    renewal_rate: float = 0.05
    cap_multiplier: Optional[float] = 2.5  # Max payout cap
    is_active: bool = True

class CommissionTemplateResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    template_type: str
    base_rate: float
    tiers: List[Dict]
    product_weights: Dict[str, float]
    new_logo_multiplier: float
    renewal_rate: float
    cap_multiplier: Optional[float]
    is_active: bool
    created_at: datetime
    updated_at: datetime

# ===================== REFERRAL MODELS =====================

class ReferralCreate(BaseModel):
    opportunity_id: str
    referrer_user_id: str
    incentive_percentage: float = 5.0  # Default 5%
    notes: Optional[str] = None

class ReferralResponse(BaseModel):
    id: str
    opportunity_id: str
    opportunity_name: Optional[str] = None
    referrer_user_id: str
    referrer_name: Optional[str] = None
    incentive_percentage: float
    earned_amount: float = 0
    status: str  # pending, approved, paid
    notes: Optional[str] = None
    created_at: datetime

# ===================== BLUE SHEET PROBABILITY MODEL =====================

class BlueSheetAnalysis(BaseModel):
    opportunity_id: str
    # Buying Influences (0-25 points each)
    economic_buyer_identified: bool = False
    economic_buyer_favorable: bool = False
    user_buyers_identified: int = 0
    user_buyers_favorable: int = 0
    technical_buyers_identified: int = 0
    technical_buyers_favorable: int = 0
    coach_identified: bool = False
    coach_engaged: bool = False
    # Red Flags (-5 to -15 points each)
    no_access_to_economic_buyer: bool = False
    reorganization_pending: bool = False
    budget_not_confirmed: bool = False
    competition_preferred: bool = False
    timeline_unclear: bool = False
    # Win Results (0-20 points)
    clear_business_results: bool = False
    quantifiable_value: bool = False
    # Action Plan
    next_steps_defined: bool = False
    mutual_action_plan: bool = False
    
class BlueSheetProbabilityResponse(BaseModel):
    opportunity_id: str
    calculated_probability: int
    confidence_level: str  # low, medium, high
    analysis_summary: str
    recommendations: List[str]
    score_breakdown: Dict[str, int]

# ===================== SALES METRICS MODELS =====================

class SalesMetricsResponse(BaseModel):
    user_id: str
    period: str  # monthly, quarterly, ytd
    period_start: datetime
    period_end: datetime
    orders_won: float = 0
    orders_booked: float = 0
    orders_invoiced: float = 0
    orders_collected: float = 0
    quota: float = 0
    attainment_percentage: float = 0
    commission_earned: float = 0
    commission_projected: float = 0

# ===================== AUTH HELPERS =====================

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(user_id: str, email: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": expire
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_role(allowed_roles: List[str]):
    async def role_checker(user: dict = Depends(get_current_user)):
        if user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return role_checker

# ===================== AUTH ROUTES =====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user_dict = {
        "id": user_id,
        "email": user_data.email,
        "password_hash": hash_password(user_data.password),
        "name": user_data.name,
        "role": user_data.role,
        "department": user_data.department,
        "product_line": user_data.product_line,
        "avatar_url": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    await db.users.insert_one(user_dict)
    
    token = create_access_token(user_id, user_data.email, user_data.role)
    user_response = UserResponse(
        id=user_id,
        email=user_data.email,
        name=user_data.name,
        role=user_data.role,
        department=user_data.department,
        product_line=user_data.product_line,
        created_at=user_dict["created_at"]
    )
    return TokenResponse(access_token=token, user=user_response)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token(user["id"], user["email"], user["role"])
    user_response = UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        role=user["role"],
        department=user.get("department"),
        product_line=user.get("product_line"),
        created_at=user["created_at"],
        avatar_url=user.get("avatar_url")
    )
    return TokenResponse(access_token=token, user=user_response)

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        role=user["role"],
        department=user.get("department"),
        product_line=user.get("product_line"),
        created_at=user["created_at"],
        avatar_url=user.get("avatar_url")
    )

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(user: dict = Depends(require_role([UserRole.CEO, UserRole.ADMIN]))):
    users = await db.users.find({}, {"password_hash": 0, "_id": 0}).to_list(1000)
    return [UserResponse(**u) for u in users]

# ===================== ACCOUNT ROUTES =====================

@api_router.post("/accounts", response_model=AccountResponse)
async def create_account(account_data: AccountCreate, user: dict = Depends(get_current_user)):
    account_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    account_dict = {
        "id": account_id,
        **account_data.model_dump(),
        "created_at": now,
        "updated_at": now,
        "created_by_id": user["id"]
    }
    await db.accounts.insert_one(account_dict)
    
    # Get AM name if assigned
    am_name = None
    if account_data.assigned_am_id:
        am = await db.users.find_one({"id": account_data.assigned_am_id})
        if am:
            am_name = am["name"]
    
    return AccountResponse(
        id=account_id,
        **account_data.model_dump(),
        assigned_am_name=am_name,
        created_at=now,
        updated_at=now
    )

@api_router.get("/accounts", response_model=List[AccountResponse])
async def get_accounts(user: dict = Depends(get_current_user)):
    query = {}
    # Filter based on role
    if user["role"] == UserRole.ACCOUNT_MANAGER:
        query["assigned_am_id"] = user["id"]
    
    accounts = await db.accounts.find(query, {"_id": 0}).to_list(1000)
    
    # Enrich with opportunity data
    result = []
    for acc in accounts:
        opps = await db.opportunities.find({"account_id": acc["id"]}, {"_id": 0}).to_list(100)
        acc["opportunity_count"] = len(opps)
        acc["total_pipeline_value"] = sum(o.get("value", 0) for o in opps if o.get("stage") not in ["closed_won", "closed_lost"])
        
        if acc.get("assigned_am_id"):
            am = await db.users.find_one({"id": acc["assigned_am_id"]})
            acc["assigned_am_name"] = am["name"] if am else None
        
        result.append(AccountResponse(**acc))
    return result

@api_router.get("/accounts/{account_id}", response_model=AccountResponse)
async def get_account(account_id: str, user: dict = Depends(get_current_user)):
    account = await db.accounts.find_one({"id": account_id}, {"_id": 0})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    opps = await db.opportunities.find({"account_id": account_id}, {"_id": 0}).to_list(100)
    account["opportunity_count"] = len(opps)
    account["total_pipeline_value"] = sum(o.get("value", 0) for o in opps if o.get("stage") not in ["closed_won", "closed_lost"])
    
    if account.get("assigned_am_id"):
        am = await db.users.find_one({"id": account["assigned_am_id"]})
        account["assigned_am_name"] = am["name"] if am else None
    
    return AccountResponse(**account)

@api_router.put("/accounts/{account_id}", response_model=AccountResponse)
async def update_account(account_id: str, account_data: AccountCreate, user: dict = Depends(get_current_user)):
    account = await db.accounts.find_one({"id": account_id})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    update_data = account_data.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.accounts.update_one({"id": account_id}, {"$set": update_data})
    updated = await db.accounts.find_one({"id": account_id}, {"_id": 0})
    
    return AccountResponse(**updated)

# ===================== OPPORTUNITY ROUTES =====================

@api_router.post("/opportunities", response_model=OpportunityResponse)
async def create_opportunity(opp_data: OpportunityCreate, user: dict = Depends(get_current_user)):
    opp_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    opp_dict = {
        "id": opp_id,
        **opp_data.model_dump(),
        "owner_id": user["id"],
        "created_at": now,
        "updated_at": now
    }
    await db.opportunities.insert_one(opp_dict)
    
    # Get account name
    account = await db.accounts.find_one({"id": opp_data.account_id})
    account_name = account["name"] if account else None
    
    return OpportunityResponse(
        id=opp_id,
        **opp_data.model_dump(),
        owner_id=user["id"],
        owner_name=user["name"],
        account_name=account_name,
        created_at=now,
        updated_at=now
    )

@api_router.get("/opportunities", response_model=List[OpportunityResponse])
async def get_opportunities(
    stage: Optional[str] = None,
    product_line: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    query = {}
    
    # Filter based on role
    if user["role"] == UserRole.ACCOUNT_MANAGER:
        query["owner_id"] = user["id"]
    elif user["role"] == UserRole.PRODUCT_DIRECTOR and user.get("product_line"):
        query["product_lines"] = user["product_line"]
    
    if stage:
        query["stage"] = stage
    if product_line:
        query["product_lines"] = product_line
    
    opps = await db.opportunities.find(query, {"_id": 0}).to_list(1000)
    
    result = []
    for opp in opps:
        account = await db.accounts.find_one({"id": opp["account_id"]})
        opp["account_name"] = account["name"] if account else None
        
        owner = await db.users.find_one({"id": opp["owner_id"]})
        opp["owner_name"] = owner["name"] if owner else None
        
        result.append(OpportunityResponse(**opp))
    return result

@api_router.get("/opportunities/kanban")
async def get_opportunities_kanban_view(user: dict = Depends(get_current_user)):
    """Get opportunities organized by stage for Kanban board"""
    query = {}
    if user["role"] == UserRole.ACCOUNT_MANAGER:
        query["owner_id"] = user["id"]
    elif user["role"] == UserRole.REFERRER:
        referrals = await db.referrals.find({"referrer_user_id": user["id"]}, {"_id": 0}).to_list(100)
        opp_ids = [r["opportunity_id"] for r in referrals]
        query["id"] = {"$in": opp_ids}
    
    opps = await db.opportunities.find(query, {"_id": 0}).to_list(10000)
    
    # Get stages
    stages = await db.pipeline_stages.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    if not stages:
        stages = [
            {"id": "lead", "name": "Lead", "order": 1, "color": "#6366F1"},
            {"id": "qualification", "name": "Qualification", "order": 2, "color": "#8B5CF6"},
            {"id": "discovery", "name": "Discovery", "order": 3, "color": "#3B82F6"},
            {"id": "proposal", "name": "Proposal", "order": 4, "color": "#F59E0B"},
            {"id": "negotiation", "name": "Negotiation", "order": 5, "color": "#F97316"},
            {"id": "closed_won", "name": "Closed Won", "order": 6, "color": "#10B981"},
            {"id": "closed_lost", "name": "Closed Lost", "order": 7, "color": "#EF4444"},
        ]
    
    # Organize by stage
    kanban_data = {}
    for stage in stages:
        stage_id = stage["id"]
        stage_opps = [o for o in opps if o.get("stage") == stage_id]
        
        # Enrich with account name and activity count
        for opp in stage_opps:
            account = await db.accounts.find_one({"id": opp.get("account_id")}, {"_id": 0, "name": 1})
            opp["account_name"] = account["name"] if account else "Unknown"
            activities = await db.activities.count_documents({"opportunity_id": opp["id"]})
            opp["activity_count"] = activities
        
        kanban_data[stage_id] = {
            "stage": stage,
            "opportunities": stage_opps,
            "total_value": sum(o.get("value", 0) for o in stage_opps),
            "count": len(stage_opps)
        }
    
    return {"stages": stages, "kanban": kanban_data}

@api_router.get("/opportunities/{opp_id}", response_model=OpportunityResponse)
async def get_opportunity(opp_id: str, user: dict = Depends(get_current_user)):
    opp = await db.opportunities.find_one({"id": opp_id}, {"_id": 0})
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    account = await db.accounts.find_one({"id": opp["account_id"]})
    opp["account_name"] = account["name"] if account else None
    
    owner = await db.users.find_one({"id": opp["owner_id"]})
    opp["owner_name"] = owner["name"] if owner else None
    
    return OpportunityResponse(**opp)

@api_router.put("/opportunities/{opp_id}", response_model=OpportunityResponse)
async def update_opportunity(opp_id: str, opp_data: OpportunityCreate, user: dict = Depends(get_current_user)):
    opp = await db.opportunities.find_one({"id": opp_id})
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    update_data = opp_data.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.opportunities.update_one({"id": opp_id}, {"$set": update_data})
    updated = await db.opportunities.find_one({"id": opp_id}, {"_id": 0})
    
    account = await db.accounts.find_one({"id": updated["account_id"]})
    updated["account_name"] = account["name"] if account else None
    
    owner = await db.users.find_one({"id": updated["owner_id"]})
    updated["owner_name"] = owner["name"] if owner else None
    
    return OpportunityResponse(**updated)

# ===================== ACTIVITY ROUTES =====================

@api_router.post("/activities", response_model=ActivityResponse)
async def create_activity(activity_data: ActivityCreate, user: dict = Depends(get_current_user)):
    activity_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    activity_dict = {
        "id": activity_id,
        **activity_data.model_dump(),
        "created_by_id": user["id"],
        "completed_at": None,
        "created_at": now,
        "updated_at": now
    }
    await db.activities.insert_one(activity_dict)
    
    # Get related names
    account_name = None
    if activity_data.account_id:
        account = await db.accounts.find_one({"id": activity_data.account_id})
        account_name = account["name"] if account else None
    
    opp_name = None
    if activity_data.opportunity_id:
        opp = await db.opportunities.find_one({"id": activity_data.opportunity_id})
        opp_name = opp["name"] if opp else None
    
    assigned_name = None
    if activity_data.assigned_to_id:
        assigned = await db.users.find_one({"id": activity_data.assigned_to_id})
        assigned_name = assigned["name"] if assigned else None
    
    return ActivityResponse(
        id=activity_id,
        **activity_data.model_dump(),
        created_by_id=user["id"],
        created_by_name=user["name"],
        account_name=account_name,
        opportunity_name=opp_name,
        assigned_to_name=assigned_name,
        completed_at=None,
        created_at=now,
        updated_at=now
    )

@api_router.get("/activities", response_model=List[ActivityResponse])
async def get_activities(
    status: Optional[str] = None,
    product_line: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    query = {}
    
    # Filter based on role
    if user["role"] == UserRole.ACCOUNT_MANAGER:
        query["$or"] = [{"created_by_id": user["id"]}, {"assigned_to_id": user["id"]}]
    elif user["role"] == UserRole.PRODUCT_DIRECTOR and user.get("product_line"):
        query["product_line"] = user["product_line"]
    
    if status:
        query["status"] = status
    if product_line:
        query["product_line"] = product_line
    
    activities = await db.activities.find(query, {"_id": 0}).to_list(1000)
    
    result = []
    for act in activities:
        if act.get("account_id"):
            account = await db.accounts.find_one({"id": act["account_id"]})
            act["account_name"] = account["name"] if account else None
        
        if act.get("opportunity_id"):
            opp = await db.opportunities.find_one({"id": act["opportunity_id"]})
            act["opportunity_name"] = opp["name"] if opp else None
        
        creator = await db.users.find_one({"id": act["created_by_id"]})
        act["created_by_name"] = creator["name"] if creator else None
        
        if act.get("assigned_to_id"):
            assigned = await db.users.find_one({"id": act["assigned_to_id"]})
            act["assigned_to_name"] = assigned["name"] if assigned else None
        
        result.append(ActivityResponse(**act))
    return result

@api_router.put("/activities/{activity_id}", response_model=ActivityResponse)
async def update_activity(activity_id: str, activity_data: ActivityCreate, user: dict = Depends(get_current_user)):
    activity = await db.activities.find_one({"id": activity_id})
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    update_data = activity_data.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    # Set completed_at if status changed to completed
    if activity_data.status == "completed" and activity.get("status") != "completed":
        update_data["completed_at"] = datetime.now(timezone.utc)
    
    await db.activities.update_one({"id": activity_id}, {"$set": update_data})
    updated = await db.activities.find_one({"id": activity_id}, {"_id": 0})
    
    # Get related names
    if updated.get("account_id"):
        account = await db.accounts.find_one({"id": updated["account_id"]})
        updated["account_name"] = account["name"] if account else None
    
    if updated.get("opportunity_id"):
        opp = await db.opportunities.find_one({"id": updated["opportunity_id"]})
        updated["opportunity_name"] = opp["name"] if opp else None
    
    creator = await db.users.find_one({"id": updated["created_by_id"]})
    updated["created_by_name"] = creator["name"] if creator else None
    
    if updated.get("assigned_to_id"):
        assigned = await db.users.find_one({"id": updated["assigned_to_id"]})
        updated["assigned_to_name"] = assigned["name"] if assigned else None
    
    return ActivityResponse(**updated)

@api_router.patch("/activities/{activity_id}/status")
async def update_activity_status(activity_id: str, status: str, user: dict = Depends(get_current_user)):
    activity = await db.activities.find_one({"id": activity_id})
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    update_data = {"status": status, "updated_at": datetime.now(timezone.utc)}
    if status == "completed":
        update_data["completed_at"] = datetime.now(timezone.utc)
    
    await db.activities.update_one({"id": activity_id}, {"$set": update_data})
    return {"message": "Status updated", "status": status}

# ===================== KPI ROUTES =====================

@api_router.post("/kpis", response_model=KPIResponse)
async def create_kpi(kpi_data: KPICreate, user: dict = Depends(require_role([UserRole.CEO, UserRole.ADMIN]))):
    kpi_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    achievement = (kpi_data.current_value / kpi_data.target_value * 100) if kpi_data.target_value > 0 else 0
    
    kpi_dict = {
        "id": kpi_id,
        **kpi_data.model_dump(),
        "achievement_percentage": achievement,
        "trend": "stable",
        "created_at": now,
        "updated_at": now
    }
    await db.kpis.insert_one(kpi_dict)
    
    user_name = None
    if kpi_data.user_id:
        kpi_user = await db.users.find_one({"id": kpi_data.user_id})
        user_name = kpi_user["name"] if kpi_user else None
    
    return KPIResponse(
        id=kpi_id,
        **kpi_data.model_dump(),
        user_name=user_name,
        achievement_percentage=achievement,
        trend="stable",
        created_at=now,
        updated_at=now
    )

@api_router.get("/kpis", response_model=List[KPIResponse])
async def get_kpis(
    category: Optional[str] = None,
    user_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    
    # Filter based on role
    if current_user["role"] == UserRole.ACCOUNT_MANAGER:
        query["$or"] = [{"user_id": current_user["id"]}, {"user_id": None}]
    elif current_user["role"] == UserRole.PRODUCT_DIRECTOR:
        query["$or"] = [
            {"user_id": current_user["id"]},
            {"product_line": current_user.get("product_line")},
            {"user_id": None}
        ]
    
    if category:
        query["category"] = category
    if user_id:
        query["user_id"] = user_id
    
    kpis = await db.kpis.find(query, {"_id": 0}).to_list(1000)
    
    result = []
    for kpi in kpis:
        if kpi.get("user_id"):
            kpi_user = await db.users.find_one({"id": kpi["user_id"]})
            kpi["user_name"] = kpi_user["name"] if kpi_user else None
        result.append(KPIResponse(**kpi))
    return result

@api_router.put("/kpis/{kpi_id}", response_model=KPIResponse)
async def update_kpi(kpi_id: str, kpi_data: KPICreate, user: dict = Depends(require_role([UserRole.CEO, UserRole.ADMIN]))):
    kpi = await db.kpis.find_one({"id": kpi_id})
    if not kpi:
        raise HTTPException(status_code=404, detail="KPI not found")
    
    # Calculate new achievement and trend
    achievement = (kpi_data.current_value / kpi_data.target_value * 100) if kpi_data.target_value > 0 else 0
    old_achievement = kpi.get("achievement_percentage", 0)
    
    if achievement > old_achievement:
        trend = "up"
    elif achievement < old_achievement:
        trend = "down"
    else:
        trend = "stable"
    
    update_data = kpi_data.model_dump()
    update_data["achievement_percentage"] = achievement
    update_data["trend"] = trend
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.kpis.update_one({"id": kpi_id}, {"$set": update_data})
    updated = await db.kpis.find_one({"id": kpi_id}, {"_id": 0})
    
    if updated.get("user_id"):
        kpi_user = await db.users.find_one({"id": updated["user_id"]})
        updated["user_name"] = kpi_user["name"] if kpi_user else None
    
    return KPIResponse(**updated)

# ===================== INCENTIVE ROUTES =====================

@api_router.post("/incentives", response_model=IncentiveResponse)
async def create_incentive(incentive_data: IncentiveCreate, user: dict = Depends(require_role([UserRole.CEO, UserRole.ADMIN]))):
    incentive_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    achievement = (incentive_data.earned_amount / incentive_data.target_amount * 100) if incentive_data.target_amount > 0 else 0
    status = "achieved" if achievement >= 100 else "in_progress"
    
    incentive_dict = {
        "id": incentive_id,
        **incentive_data.model_dump(),
        "achievement_percentage": achievement,
        "status": status,
        "created_at": now,
        "updated_at": now
    }
    await db.incentives.insert_one(incentive_dict)
    
    incentive_user = await db.users.find_one({"id": incentive_data.user_id})
    user_name = incentive_user["name"] if incentive_user else None
    
    return IncentiveResponse(
        id=incentive_id,
        **incentive_data.model_dump(),
        user_name=user_name,
        achievement_percentage=achievement,
        status=status,
        created_at=now,
        updated_at=now
    )

@api_router.get("/incentives", response_model=List[IncentiveResponse])
async def get_incentives(user_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    
    # Filter based on role
    if current_user["role"] not in [UserRole.CEO, UserRole.ADMIN]:
        query["user_id"] = current_user["id"]
    elif user_id:
        query["user_id"] = user_id
    
    incentives = await db.incentives.find(query, {"_id": 0}).to_list(1000)
    
    result = []
    for inc in incentives:
        inc_user = await db.users.find_one({"id": inc["user_id"]})
        inc["user_name"] = inc_user["name"] if inc_user else None
        result.append(IncentiveResponse(**inc))
    return result

# ===================== INTEGRATION SETTINGS ROUTES =====================

@api_router.get("/integrations", response_model=List[IntegrationSettingResponse])
async def get_integrations(user: dict = Depends(require_role([UserRole.CEO, UserRole.ADMIN]))):
    integrations = await db.integrations.find({}, {"_id": 0, "api_key": 0, "client_secret": 0}).to_list(100)
    
    result = []
    for intg in integrations:
        intg["has_api_key"] = bool(intg.get("api_key_set"))
        intg["has_client_credentials"] = bool(intg.get("client_id_set"))
        result.append(IntegrationSettingResponse(**intg))
    return result

@api_router.post("/integrations", response_model=IntegrationSettingResponse)
async def create_or_update_integration(intg_data: IntegrationSettingCreate, user: dict = Depends(require_role([UserRole.CEO, UserRole.ADMIN]))):
    intg_id = str(uuid.uuid4())
    
    existing = await db.integrations.find_one({"integration_type": intg_data.integration_type})
    
    intg_dict = {
        "id": existing["id"] if existing else intg_id,
        "integration_type": intg_data.integration_type,
        "enabled": intg_data.enabled,
        "api_url": intg_data.api_url,
        "sync_interval_minutes": intg_data.sync_interval_minutes,
        "settings": intg_data.settings,
        "status": "connected" if intg_data.enabled else "disconnected",
        "last_sync": None,
        "updated_at": datetime.now(timezone.utc)
    }
    
    # Store API key securely (mark as set)
    if intg_data.api_key:
        intg_dict["api_key"] = intg_data.api_key
        intg_dict["api_key_set"] = True
    
    if intg_data.client_id:
        intg_dict["client_id"] = intg_data.client_id
        intg_dict["client_id_set"] = True
    
    if intg_data.client_secret:
        intg_dict["client_secret"] = intg_data.client_secret
    
    if intg_data.tenant_id:
        intg_dict["tenant_id"] = intg_data.tenant_id
    
    if existing:
        await db.integrations.update_one({"integration_type": intg_data.integration_type}, {"$set": intg_dict})
    else:
        intg_dict["created_at"] = datetime.now(timezone.utc)
        await db.integrations.insert_one(intg_dict)
    
    return IntegrationSettingResponse(
        id=intg_dict["id"],
        integration_type=intg_data.integration_type,
        enabled=intg_data.enabled,
        api_url=intg_data.api_url,
        has_api_key=bool(intg_data.api_key),
        has_client_credentials=bool(intg_data.client_id),
        sync_interval_minutes=intg_data.sync_interval_minutes,
        settings=intg_data.settings,
        status="connected" if intg_data.enabled else "disconnected"
    )

# ===================== DASHBOARD CONFIG ROUTES =====================

@api_router.get("/dashboard/config", response_model=List[DashboardConfigResponse])
async def get_dashboard_configs(user: dict = Depends(get_current_user)):
    configs = await db.dashboard_configs.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    return [DashboardConfigResponse(**c) for c in configs]

@api_router.post("/dashboard/config", response_model=DashboardConfigResponse)
async def save_dashboard_config(config_data: DashboardConfigCreate, user: dict = Depends(get_current_user)):
    config_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    # If setting as default, unset other defaults
    if config_data.is_default:
        await db.dashboard_configs.update_many(
            {"user_id": user["id"]},
            {"$set": {"is_default": False}}
        )
    
    config_dict = {
        "id": config_id,
        "user_id": user["id"],
        "name": config_data.name,
        "widgets": [w.model_dump() for w in config_data.widgets],
        "is_default": config_data.is_default,
        "created_at": now,
        "updated_at": now
    }
    await db.dashboard_configs.insert_one(config_dict)
    
    return DashboardConfigResponse(**config_dict)

# ===================== NOTIFICATIONS ROUTES =====================

@api_router.get("/notifications", response_model=List[NotificationResponse])
async def get_notifications(user: dict = Depends(get_current_user)):
    notifications = await db.notifications.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return [NotificationResponse(**n) for n in notifications]

@api_router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one(
        {"id": notification_id, "user_id": user["id"]},
        {"$set": {"read": True}}
    )
    return {"message": "Notification marked as read"}

# ===================== DASHBOARD STATS ROUTES =====================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(user: dict = Depends(get_current_user)):
    """Get aggregated dashboard statistics based on user role"""
    
    stats = {
        "total_pipeline_value": 0,
        "won_revenue": 0,
        "active_opportunities": 0,
        "pending_activities": 0,
        "overdue_activities": 0,
        "kpi_achievement": 0,
        "activity_completion_rate": 0
    }
    
    # Base queries based on role
    opp_query = {}
    activity_query = {}
    
    if user["role"] == UserRole.ACCOUNT_MANAGER:
        opp_query["owner_id"] = user["id"]
        activity_query["$or"] = [{"created_by_id": user["id"]}, {"assigned_to_id": user["id"]}]
    elif user["role"] == UserRole.PRODUCT_DIRECTOR and user.get("product_line"):
        opp_query["product_lines"] = user["product_line"]
        activity_query["product_line"] = user["product_line"]
    
    # Opportunity stats
    opps = await db.opportunities.find(opp_query, {"_id": 0}).to_list(10000)
    stats["total_pipeline_value"] = sum(o.get("value", 0) for o in opps if o.get("stage") not in ["closed_won", "closed_lost"])
    stats["won_revenue"] = sum(o.get("value", 0) for o in opps if o.get("stage") == "closed_won")
    stats["active_opportunities"] = len([o for o in opps if o.get("stage") not in ["closed_won", "closed_lost"]])
    
    # Activity stats
    activities = await db.activities.find(activity_query, {"_id": 0}).to_list(10000)
    stats["pending_activities"] = len([a for a in activities if a.get("status") in ["pending", "in_progress"]])
    
    now = datetime.now(timezone.utc)
    
    def is_overdue(due_date):
        if not due_date:
            return False
        if isinstance(due_date, str):
            try:
                due_date = datetime.fromisoformat(due_date.replace("Z", "+00:00"))
            except:
                return False
        if due_date.tzinfo is None:
            due_date = due_date.replace(tzinfo=timezone.utc)
        return due_date < now
    
    stats["overdue_activities"] = len([
        a for a in activities 
        if a.get("status") not in ["completed", "cancelled"] 
        and is_overdue(a.get("due_date"))
    ])
    
    completed = len([a for a in activities if a.get("status") == "completed"])
    total = len(activities)
    stats["activity_completion_rate"] = round((completed / total * 100) if total > 0 else 0, 1)
    
    # KPI achievement
    kpis = await db.kpis.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    if kpis:
        stats["kpi_achievement"] = round(sum(k.get("achievement_percentage", 0) for k in kpis) / len(kpis), 1)
    
    return stats

@api_router.get("/dashboard/pipeline-by-stage")
async def get_pipeline_by_stage(user: dict = Depends(get_current_user)):
    """Get opportunity pipeline grouped by stage"""
    query = {}
    if user["role"] == UserRole.ACCOUNT_MANAGER:
        query["owner_id"] = user["id"]
    elif user["role"] == UserRole.PRODUCT_DIRECTOR and user.get("product_line"):
        query["product_lines"] = user["product_line"]
    
    opps = await db.opportunities.find(query, {"_id": 0}).to_list(10000)
    
    stages = ["qualification", "discovery", "proposal", "negotiation", "closed_won", "closed_lost"]
    result = []
    for stage in stages:
        stage_opps = [o for o in opps if o.get("stage") == stage]
        result.append({
            "stage": stage.replace("_", " ").title(),
            "count": len(stage_opps),
            "value": sum(o.get("value", 0) for o in stage_opps)
        })
    
    return result

@api_router.get("/dashboard/activities-by-status")
async def get_activities_by_status(user: dict = Depends(get_current_user)):
    """Get activities grouped by status"""
    query = {}
    if user["role"] == UserRole.ACCOUNT_MANAGER:
        query["$or"] = [{"created_by_id": user["id"]}, {"assigned_to_id": user["id"]}]
    elif user["role"] == UserRole.PRODUCT_DIRECTOR and user.get("product_line"):
        query["product_line"] = user["product_line"]
    
    activities = await db.activities.find(query, {"_id": 0}).to_list(10000)
    
    statuses = ["pending", "in_progress", "completed", "cancelled"]
    result = []
    for status in statuses:
        status_acts = [a for a in activities if a.get("status") == status]
        result.append({
            "status": status.replace("_", " ").title(),
            "count": len(status_acts)
        })
    
    return result

@api_router.get("/dashboard/revenue-trend")
async def get_revenue_trend(user: dict = Depends(get_current_user)):
    """Get monthly revenue trend"""
    query = {"stage": "closed_won"}
    if user["role"] == UserRole.ACCOUNT_MANAGER:
        query["owner_id"] = user["id"]
    elif user["role"] == UserRole.PRODUCT_DIRECTOR and user.get("product_line"):
        query["product_lines"] = user["product_line"]
    
    opps = await db.opportunities.find(query, {"_id": 0}).to_list(10000)
    
    # Group by month (last 6 months)
    months = []
    now = datetime.now(timezone.utc)
    for i in range(5, -1, -1):
        month_date = now - timedelta(days=30*i)
        months.append({
            "month": month_date.strftime("%b"),
            "actual": 0,
            "target": 100000  # Default target
        })
    
    for opp in opps:
        created = opp.get("created_at", now)
        if isinstance(created, str):
            try:
                created = datetime.fromisoformat(created.replace("Z", "+00:00"))
            except:
                created = now
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        month_idx = min(5, max(0, 5 - (now - created).days // 30))
        if 0 <= month_idx < len(months):
            months[month_idx]["actual"] += opp.get("value", 0)
    
    return months

# ===================== AI INSIGHTS ROUTES =====================

@api_router.post("/ai/insights")
async def get_ai_insights(user: dict = Depends(get_current_user)):
    """Generate AI-powered sales insights"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        # Gather context data
        opp_query = {}
        if user["role"] == UserRole.ACCOUNT_MANAGER:
            opp_query["owner_id"] = user["id"]
        
        opps = await db.opportunities.find(opp_query, {"_id": 0}).to_list(100)
        activities = await db.activities.find({}, {"_id": 0}).to_list(100)
        
        # Build context
        context = f"""
        User Role: {user["role"]}
        Active Opportunities: {len([o for o in opps if o.get("stage") not in ["closed_won", "closed_lost"]])}
        Total Pipeline Value: ${sum(o.get("value", 0) for o in opps if o.get("stage") not in ["closed_won", "closed_lost"]):,.0f}
        Won Deals: {len([o for o in opps if o.get("stage") == "closed_won"])}
        Pending Activities: {len([a for a in activities if a.get("status") == "pending"])}
        """
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            return {"insights": ["AI insights require API key configuration."], "recommendations": []}
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"insights-{user['id']}-{datetime.now().timestamp()}",
            system_message="You are a sales analytics expert. Provide 3-4 brief, actionable insights based on the sales data provided. Be concise and specific."
        ).with_model("openai", "gpt-4o")
        
        message = UserMessage(text=f"Analyze this sales data and provide insights:\n{context}")
        response = await chat.send_message(message)
        
        # Parse response into insights
        insights = [line.strip() for line in response.split("\n") if line.strip() and not line.startswith("#")][:4]
        
        return {
            "insights": insights,
            "recommendations": [
                "Focus on high-value opportunities in negotiation stage",
                "Schedule follow-ups for stalled deals",
                "Review overdue activities"
            ],
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"AI insights error: {e}")
        return {
            "insights": [
                "Pipeline health looks stable",
                "Consider reviewing pending activities",
                "Focus on advancing qualification stage deals"
            ],
            "recommendations": [],
            "error": str(e)
        }

# ===================== SEED DATA =====================

@api_router.post("/seed")
async def seed_demo_data():
    """Seed demo data for testing"""
    
    # Check if already seeded
    existing_users = await db.users.count_documents({})
    if existing_users > 0:
        return {"message": "Data already exists"}
    
    now = datetime.now(timezone.utc)
    
    # Create demo users
    users = [
        {"id": str(uuid.uuid4()), "email": "superadmin@salescommand.com", "password_hash": hash_password("demo123"), "name": "Admin Master", "role": "super_admin", "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "email": "ceo@salescommand.com", "password_hash": hash_password("demo123"), "name": "Sarah Chen", "role": "ceo", "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "email": "sales.director@salescommand.com", "password_hash": hash_password("demo123"), "name": "David Martinez", "role": "sales_director", "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "email": "pd.mssp@salescommand.com", "password_hash": hash_password("demo123"), "name": "Michael Torres", "role": "product_director", "product_line": "MSSP", "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "email": "pd.appsec@salescommand.com", "password_hash": hash_password("demo123"), "name": "Lisa Wang", "role": "product_director", "product_line": "Application Security", "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "email": "am1@salescommand.com", "password_hash": hash_password("demo123"), "name": "James Wilson", "role": "account_manager", "quota": 500000, "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "email": "am2@salescommand.com", "password_hash": hash_password("demo123"), "name": "Emily Davis", "role": "account_manager", "quota": 400000, "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "email": "strategy@salescommand.com", "password_hash": hash_password("demo123"), "name": "Robert Kim", "role": "strategy", "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "email": "finance@salescommand.com", "password_hash": hash_password("demo123"), "name": "Nancy Lee", "role": "finance_manager", "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "email": "referrer@salescommand.com", "password_hash": hash_password("demo123"), "name": "Tom Referral", "role": "referrer", "department": "Engineering", "created_at": now, "updated_at": now},
    ]
    await db.users.insert_many(users)
    
    am1_id = users[5]["id"]
    am2_id = users[6]["id"]
    referrer_id = users[9]["id"]
    
    # Create default pipeline stages
    pipeline_stages = [
        {"id": "lead", "name": "Lead", "order": 1, "color": "#6366F1", "probability_default": 5, "is_won": False, "is_lost": False},
        {"id": "qualification", "name": "Qualification", "order": 2, "color": "#8B5CF6", "probability_default": 10, "is_won": False, "is_lost": False},
        {"id": "discovery", "name": "Discovery", "order": 3, "color": "#3B82F6", "probability_default": 25, "is_won": False, "is_lost": False},
        {"id": "proposal", "name": "Proposal", "order": 4, "color": "#F59E0B", "probability_default": 50, "is_won": False, "is_lost": False},
        {"id": "negotiation", "name": "Negotiation", "order": 5, "color": "#F97316", "probability_default": 75, "is_won": False, "is_lost": False},
        {"id": "closed_won", "name": "Closed Won", "order": 6, "color": "#10B981", "probability_default": 100, "is_won": True, "is_lost": False},
        {"id": "closed_lost", "name": "Closed Lost", "order": 7, "color": "#EF4444", "probability_default": 0, "is_won": False, "is_lost": True},
    ]
    await db.pipeline_stages.insert_many(pipeline_stages)
    
    # Create demo accounts
    accounts = [
        {"id": str(uuid.uuid4()), "name": "TechCorp Industries", "industry": "Technology", "annual_revenue": 50000000, "employee_count": 500, "relationship_maturity": "strategic", "assigned_am_id": am1_id, "stakeholders": [{"name": "John Smith", "title": "CTO", "influence_level": "champion"}], "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "name": "Global Financial Services", "industry": "Finance", "annual_revenue": 200000000, "employee_count": 2000, "relationship_maturity": "established", "assigned_am_id": am1_id, "stakeholders": [{"name": "Mary Johnson", "title": "CISO", "influence_level": "high"}], "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "name": "Healthcare Plus", "industry": "Healthcare", "annual_revenue": 75000000, "employee_count": 800, "relationship_maturity": "developing", "assigned_am_id": am2_id, "stakeholders": [], "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "name": "Retail Dynamics", "industry": "Retail", "annual_revenue": 30000000, "employee_count": 300, "relationship_maturity": "new", "assigned_am_id": am2_id, "stakeholders": [], "created_at": now, "updated_at": now},
    ]
    await db.accounts.insert_many(accounts)
    
    # Create demo opportunities
    opportunities = [
        {"id": str(uuid.uuid4()), "name": "TechCorp MSSP Expansion", "account_id": accounts[0]["id"], "value": 250000, "stage": "negotiation", "probability": 70, "product_lines": ["MSSP"], "owner_id": am1_id, "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "name": "GFS Security Assessment", "account_id": accounts[1]["id"], "value": 150000, "stage": "proposal", "probability": 50, "product_lines": ["Application Security", "Network Security"], "owner_id": am1_id, "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "name": "Healthcare Compliance Suite", "account_id": accounts[2]["id"], "value": 180000, "stage": "discovery", "probability": 30, "product_lines": ["GRC"], "owner_id": am2_id, "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "name": "Retail POS Security", "account_id": accounts[3]["id"], "value": 80000, "stage": "qualification", "probability": 20, "product_lines": ["Network Security"], "owner_id": am2_id, "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "name": "TechCorp AppSec Bundle", "account_id": accounts[0]["id"], "value": 120000, "stage": "closed_won", "probability": 100, "product_lines": ["Application Security"], "owner_id": am1_id, "created_at": now, "updated_at": now},
    ]
    await db.opportunities.insert_many(opportunities)
    
    # Create demo activities
    activities = [
        {"id": str(uuid.uuid4()), "title": "Security Workshop - TechCorp", "activity_type": "presentation", "priority": "high", "status": "pending", "due_date": now + timedelta(days=3), "account_id": accounts[0]["id"], "opportunity_id": opportunities[0]["id"], "product_line": "MSSP", "created_by_id": am1_id, "assigned_to_id": users[1]["id"], "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "title": "Proposal Review Meeting", "activity_type": "meeting", "priority": "high", "status": "in_progress", "due_date": now + timedelta(days=1), "account_id": accounts[1]["id"], "opportunity_id": opportunities[1]["id"], "created_by_id": am1_id, "assigned_to_id": am1_id, "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "title": "Discovery Call - Healthcare", "activity_type": "call", "priority": "medium", "status": "pending", "due_date": now + timedelta(days=5), "account_id": accounts[2]["id"], "opportunity_id": opportunities[2]["id"], "created_by_id": am2_id, "assigned_to_id": am2_id, "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "title": "Technical Demo Prep", "activity_type": "task", "priority": "medium", "status": "completed", "due_date": now - timedelta(days=2), "product_line": "Application Security", "created_by_id": users[2]["id"], "assigned_to_id": users[2]["id"], "completed_at": now - timedelta(days=1), "created_at": now, "updated_at": now},
    ]
    await db.activities.insert_many(activities)
    
    # Create demo KPIs
    kpis = [
        {"id": str(uuid.uuid4()), "name": "Quarterly Revenue Target", "target_value": 1000000, "current_value": 520000, "unit": "currency", "period": "quarterly", "category": "sales", "achievement_percentage": 52, "trend": "up", "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "name": "Pipeline Value", "target_value": 2000000, "current_value": 780000, "unit": "currency", "period": "quarterly", "category": "sales", "achievement_percentage": 39, "trend": "stable", "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "name": "Activity Completion Rate", "target_value": 90, "current_value": 75, "unit": "percentage", "period": "monthly", "category": "activity", "user_id": am1_id, "achievement_percentage": 83, "trend": "up", "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "name": "Win Rate", "target_value": 30, "current_value": 25, "unit": "percentage", "period": "quarterly", "category": "sales", "achievement_percentage": 83, "trend": "stable", "created_at": now, "updated_at": now},
    ]
    await db.kpis.insert_many(kpis)
    
    # Create demo incentives
    incentives = [
        {"id": str(uuid.uuid4()), "user_id": am1_id, "name": "Q4 Sales Bonus", "target_amount": 25000, "earned_amount": 12500, "period": "quarterly", "criteria": {"closed_deals": 5, "pipeline_value": 500000}, "achievement_percentage": 50, "status": "in_progress", "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "user_id": am2_id, "name": "Q4 Sales Bonus", "target_amount": 20000, "earned_amount": 8000, "period": "quarterly", "criteria": {"closed_deals": 4, "pipeline_value": 400000}, "achievement_percentage": 40, "status": "in_progress", "created_at": now, "updated_at": now},
    ]
    await db.incentives.insert_many(incentives)
    
    # Create default integrations
    integrations = [
        {"id": str(uuid.uuid4()), "integration_type": "odoo", "enabled": False, "api_url": "", "sync_interval_minutes": 60, "settings": {}, "status": "disconnected", "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "integration_type": "office365", "enabled": False, "api_url": "", "sync_interval_minutes": 30, "settings": {}, "status": "disconnected", "created_at": now, "updated_at": now},
    ]
    await db.integrations.insert_many(integrations)
    
    return {"message": "Demo data seeded successfully", "users_created": len(users)}

# ===================== PIPELINE STAGES ROUTES =====================

@api_router.get("/pipeline-stages", response_model=List[PipelineStageResponse])
async def get_pipeline_stages(user: dict = Depends(get_current_user)):
    """Get all pipeline stages"""
    stages = await db.pipeline_stages.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    if not stages:
        # Return default stages if none configured
        default_stages = [
            {"id": "lead", "name": "Lead", "order": 1, "color": "#6366F1", "probability_default": 5, "is_won": False, "is_lost": False},
            {"id": "qualification", "name": "Qualification", "order": 2, "color": "#8B5CF6", "probability_default": 10, "is_won": False, "is_lost": False},
            {"id": "discovery", "name": "Discovery", "order": 3, "color": "#3B82F6", "probability_default": 25, "is_won": False, "is_lost": False},
            {"id": "proposal", "name": "Proposal", "order": 4, "color": "#F59E0B", "probability_default": 50, "is_won": False, "is_lost": False},
            {"id": "negotiation", "name": "Negotiation", "order": 5, "color": "#F97316", "probability_default": 75, "is_won": False, "is_lost": False},
            {"id": "closed_won", "name": "Closed Won", "order": 6, "color": "#10B981", "probability_default": 100, "is_won": True, "is_lost": False},
            {"id": "closed_lost", "name": "Closed Lost", "order": 7, "color": "#EF4444", "probability_default": 0, "is_won": False, "is_lost": True},
        ]
        return default_stages
    return stages

@api_router.post("/pipeline-stages", response_model=PipelineStageResponse)
async def create_pipeline_stage(stage_data: PipelineStageCreate, user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.CEO, UserRole.ADMIN]))):
    """Create a new pipeline stage"""
    stage_id = str(uuid.uuid4())
    stage_dict = {
        "id": stage_id,
        **stage_data.model_dump()
    }
    await db.pipeline_stages.insert_one(stage_dict)
    return PipelineStageResponse(**stage_dict)

@api_router.put("/pipeline-stages/{stage_id}", response_model=PipelineStageResponse)
async def update_pipeline_stage(stage_id: str, stage_data: PipelineStageCreate, user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.CEO, UserRole.ADMIN]))):
    """Update a pipeline stage"""
    await db.pipeline_stages.update_one({"id": stage_id}, {"$set": stage_data.model_dump()})
    updated = await db.pipeline_stages.find_one({"id": stage_id}, {"_id": 0})
    return PipelineStageResponse(**updated)

@api_router.put("/pipeline-stages/reorder")
async def reorder_pipeline_stages(stage_orders: List[Dict], user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.CEO, UserRole.ADMIN]))):
    """Reorder pipeline stages"""
    for item in stage_orders:
        await db.pipeline_stages.update_one({"id": item["id"]}, {"$set": {"order": item["order"]}})
    return {"message": "Stages reordered"}

@api_router.delete("/pipeline-stages/{stage_id}")
async def delete_pipeline_stage(stage_id: str, user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.CEO, UserRole.ADMIN]))):
    """Delete a pipeline stage"""
    await db.pipeline_stages.delete_one({"id": stage_id})
    return {"message": "Stage deleted"}

# ===================== KANBAN / OPPORTUNITY STAGE MOVE =====================

@api_router.patch("/opportunities/{opp_id}/stage")
async def move_opportunity_stage(opp_id: str, new_stage: str, user: dict = Depends(get_current_user)):
    """Move opportunity to a new stage (drag-drop support)"""
    opp = await db.opportunities.find_one({"id": opp_id})
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    # Get stage probability default
    stage = await db.pipeline_stages.find_one({"id": new_stage})
    probability = stage.get("probability_default", 50) if stage else 50
    
    update_data = {
        "stage": new_stage,
        "probability": probability,
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.opportunities.update_one({"id": opp_id}, {"$set": update_data})
    
    # Log stage change
    await db.activity_logs.insert_one({
        "id": str(uuid.uuid4()),
        "entity_type": "opportunity",
        "entity_id": opp_id,
        "action": "stage_change",
        "old_value": opp.get("stage"),
        "new_value": new_stage,
        "user_id": user["id"],
        "created_at": datetime.now(timezone.utc)
    })
    
    return {"message": "Stage updated", "new_stage": new_stage, "probability": probability}

# ===================== COMMISSION TEMPLATE ROUTES =====================

@api_router.get("/commission-templates", response_model=List[CommissionTemplateResponse])
async def get_commission_templates(user: dict = Depends(get_current_user)):
    """Get all commission templates"""
    templates = await db.commission_templates.find({}, {"_id": 0}).to_list(100)
    if not templates:
        # Return default templates if none exist
        return []
    return [CommissionTemplateResponse(**t) for t in templates]

@api_router.post("/commission-templates", response_model=CommissionTemplateResponse)
async def create_commission_template(template_data: CommissionTemplateCreate, user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.CEO, UserRole.SALES_DIRECTOR, UserRole.FINANCE_MANAGER]))):
    """Create a commission template"""
    template_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    template_dict = {
        "id": template_id,
        **template_data.model_dump(),
        "tiers": [t.model_dump() for t in template_data.tiers],
        "created_at": now,
        "updated_at": now
    }
    await db.commission_templates.insert_one(template_dict)
    return CommissionTemplateResponse(**template_dict)

@api_router.put("/commission-templates/{template_id}", response_model=CommissionTemplateResponse)
async def update_commission_template(template_id: str, template_data: CommissionTemplateCreate, user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.CEO, UserRole.SALES_DIRECTOR, UserRole.FINANCE_MANAGER]))):
    """Update a commission template"""
    update_data = template_data.model_dump()
    update_data["tiers"] = [t.model_dump() if hasattr(t, 'model_dump') else t for t in template_data.tiers]
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.commission_templates.update_one({"id": template_id}, {"$set": update_data})
    updated = await db.commission_templates.find_one({"id": template_id}, {"_id": 0})
    return CommissionTemplateResponse(**updated)

@api_router.post("/commission-templates/seed-defaults")
async def seed_default_commission_templates(user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.CEO]))):
    """Seed default commission templates"""
    now = datetime.now(timezone.utc)
    
    templates = [
        {
            "id": str(uuid.uuid4()),
            "name": "Flat Rate - 5%",
            "description": "Simple flat commission rate on all closed deals",
            "template_type": "flat",
            "base_rate": 0.05,
            "tiers": [],
            "product_weights": {},
            "new_logo_multiplier": 1.0,
            "renewal_rate": 0.05,
            "cap_multiplier": None,
            "is_active": True,
            "created_at": now,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Tiered Attainment - Standard",
            "description": "Commission multiplier based on quota attainment percentage",
            "template_type": "tiered_attainment",
            "base_rate": 0.10,
            "tiers": [
                {"min_attainment": 0, "max_attainment": 50, "multiplier": 0.25, "rate": None},
                {"min_attainment": 50, "max_attainment": 80, "multiplier": 0.50, "rate": None},
                {"min_attainment": 80, "max_attainment": 100, "multiplier": 0.80, "rate": None},
                {"min_attainment": 100, "max_attainment": 120, "multiplier": 1.00, "rate": None},
                {"min_attainment": 120, "max_attainment": 150, "multiplier": 1.50, "rate": None},
                {"min_attainment": 150, "max_attainment": 999, "multiplier": 2.00, "rate": None},
            ],
            "product_weights": {},
            "new_logo_multiplier": 1.2,
            "renewal_rate": 0.03,
            "cap_multiplier": 2.5,
            "is_active": True,
            "created_at": now,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Tiered Revenue - Cybersecurity",
            "description": "Increasing rate based on cumulative revenue bands",
            "template_type": "tiered_revenue",
            "base_rate": 0.06,
            "tiers": [
                {"min_attainment": 0, "max_attainment": 100000, "multiplier": 1.0, "rate": 0.06},
                {"min_attainment": 100000, "max_attainment": 300000, "multiplier": 1.0, "rate": 0.08},
                {"min_attainment": 300000, "max_attainment": 500000, "multiplier": 1.0, "rate": 0.10},
                {"min_attainment": 500000, "max_attainment": 999999999, "multiplier": 1.0, "rate": 0.12},
            ],
            "product_weights": {
                "MSSP": 1.0,
                "Application Security": 1.1,
                "Network Security": 0.9,
                "GRC": 1.2
            },
            "new_logo_multiplier": 1.25,
            "renewal_rate": 0.04,
            "cap_multiplier": 3.0,
            "is_active": True,
            "created_at": now,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Quota-Based Accelerator",
            "description": "Base + accelerators for exceeding quota",
            "template_type": "quota_based",
            "base_rate": 0.08,
            "tiers": [
                {"min_attainment": 100, "max_attainment": 110, "multiplier": 1.25, "rate": None},
                {"min_attainment": 110, "max_attainment": 125, "multiplier": 1.5, "rate": None},
                {"min_attainment": 125, "max_attainment": 999, "multiplier": 2.0, "rate": None},
            ],
            "product_weights": {},
            "new_logo_multiplier": 1.15,
            "renewal_rate": 0.05,
            "cap_multiplier": 2.5,
            "is_active": True,
            "created_at": now,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "New Logo Hunter",
            "description": "High commission for new customer acquisition",
            "template_type": "flat",
            "base_rate": 0.12,
            "tiers": [],
            "product_weights": {},
            "new_logo_multiplier": 1.5,
            "renewal_rate": 0.02,
            "cap_multiplier": None,
            "is_active": True,
            "created_at": now,
            "updated_at": now
        },
    ]
    
    for t in templates:
        existing = await db.commission_templates.find_one({"name": t["name"]})
        if not existing:
            await db.commission_templates.insert_one(t)
    
    return {"message": "Default templates seeded", "count": len(templates)}

@api_router.post("/users/{user_id}/assign-commission-template")
async def assign_commission_template(user_id: str, template_id: str, quota: float = 0, user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.CEO, UserRole.SALES_DIRECTOR, UserRole.FINANCE_MANAGER]))):
    """Assign a commission template to a user"""
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "commission_template_id": template_id,
            "quota": quota,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    return {"message": "Commission template assigned"}

# ===================== REFERRAL ROUTES =====================

@api_router.post("/referrals", response_model=ReferralResponse)
async def create_referral(referral_data: ReferralCreate, user: dict = Depends(get_current_user)):
    """Create a referral for an opportunity"""
    # Check if opportunity already has a referral
    existing = await db.referrals.find_one({"opportunity_id": referral_data.opportunity_id})
    if existing:
        raise HTTPException(status_code=400, detail="Opportunity already has a referral assigned")
    
    referral_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    referral_dict = {
        "id": referral_id,
        **referral_data.model_dump(),
        "earned_amount": 0,
        "status": "pending",
        "created_at": now
    }
    await db.referrals.insert_one(referral_dict)
    
    # Get names
    opp = await db.opportunities.find_one({"id": referral_data.opportunity_id})
    referrer = await db.users.find_one({"id": referral_data.referrer_user_id})
    
    return ReferralResponse(
        **referral_dict,
        opportunity_name=opp["name"] if opp else None,
        referrer_name=referrer["name"] if referrer else None
    )

@api_router.get("/referrals", response_model=List[ReferralResponse])
async def get_referrals(user: dict = Depends(get_current_user)):
    """Get referrals - filtered by role"""
    query = {}
    if user["role"] == UserRole.REFERRER:
        query["referrer_user_id"] = user["id"]
    elif user["role"] == UserRole.ACCOUNT_MANAGER:
        # Get opportunities owned by this AM
        opps = await db.opportunities.find({"owner_id": user["id"]}, {"_id": 0, "id": 1}).to_list(1000)
        opp_ids = [o["id"] for o in opps]
        query["opportunity_id"] = {"$in": opp_ids}
    
    referrals = await db.referrals.find(query, {"_id": 0}).to_list(1000)
    
    result = []
    for ref in referrals:
        opp = await db.opportunities.find_one({"id": ref["opportunity_id"]})
        referrer = await db.users.find_one({"id": ref["referrer_user_id"]})
        ref["opportunity_name"] = opp["name"] if opp else None
        ref["referrer_name"] = referrer["name"] if referrer else None
        result.append(ReferralResponse(**ref))
    
    return result

@api_router.put("/referrals/{referral_id}/incentive")
async def update_referral_incentive(referral_id: str, incentive_percentage: float, user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.CEO, UserRole.SALES_DIRECTOR, UserRole.FINANCE_MANAGER]))):
    """Update referral incentive percentage"""
    await db.referrals.update_one(
        {"id": referral_id},
        {"$set": {"incentive_percentage": incentive_percentage}}
    )
    return {"message": "Referral incentive updated"}

# ===================== BLUE SHEET PROBABILITY CALCULATION =====================

@api_router.post("/opportunities/{opp_id}/calculate-probability", response_model=BlueSheetProbabilityResponse)
async def calculate_blue_sheet_probability(opp_id: str, analysis: BlueSheetAnalysis, user: dict = Depends(get_current_user)):
    """Calculate opportunity probability using Blue Sheet methodology with LLM enhancement"""
    opp = await db.opportunities.find_one({"id": opp_id}, {"_id": 0})
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    # Base scoring
    score_breakdown = {}
    total_score = 0
    
    # Buying Influences (max 40 points)
    buying_influence_score = 0
    if analysis.economic_buyer_identified:
        buying_influence_score += 10
    if analysis.economic_buyer_favorable:
        buying_influence_score += 10
    buying_influence_score += min(analysis.user_buyers_favorable, 3) * 3  # max 9
    buying_influence_score += min(analysis.technical_buyers_favorable, 2) * 3  # max 6
    if analysis.coach_identified:
        buying_influence_score += 3
    if analysis.coach_engaged:
        buying_influence_score += 2
    score_breakdown["buying_influences"] = buying_influence_score
    total_score += buying_influence_score
    
    # Red Flags (negative points)
    red_flag_penalty = 0
    if analysis.no_access_to_economic_buyer:
        red_flag_penalty -= 15
    if analysis.reorganization_pending:
        red_flag_penalty -= 10
    if analysis.budget_not_confirmed:
        red_flag_penalty -= 12
    if analysis.competition_preferred:
        red_flag_penalty -= 15
    if analysis.timeline_unclear:
        red_flag_penalty -= 8
    score_breakdown["red_flags"] = red_flag_penalty
    total_score += red_flag_penalty
    
    # Win Results (max 20 points)
    win_results_score = 0
    if analysis.clear_business_results:
        win_results_score += 12
    if analysis.quantifiable_value:
        win_results_score += 8
    score_breakdown["win_results"] = win_results_score
    total_score += win_results_score
    
    # Action Plan (max 15 points)
    action_score = 0
    if analysis.next_steps_defined:
        action_score += 8
    if analysis.mutual_action_plan:
        action_score += 7
    score_breakdown["action_plan"] = action_score
    total_score += action_score
    
    # Calculate probability (scale to 0-100)
    max_possible = 75  # 40 + 20 + 15
    calculated_probability = max(0, min(100, int((total_score / max_possible) * 100)))
    
    # Determine confidence level
    confidence = "low"
    if analysis.economic_buyer_identified and analysis.coach_identified:
        confidence = "medium"
    if analysis.economic_buyer_favorable and analysis.quantifiable_value and analysis.mutual_action_plan:
        confidence = "high"
    
    # Generate recommendations using LLM
    recommendations = []
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        
        if api_key:
            context = f"""
            Opportunity: {opp.get('name')}
            Value: ${opp.get('value', 0):,.0f}
            Current Stage: {opp.get('stage')}
            Calculated Probability: {calculated_probability}%
            
            Blue Sheet Analysis:
            - Economic Buyer Identified: {analysis.economic_buyer_identified}
            - Economic Buyer Favorable: {analysis.economic_buyer_favorable}
            - Coach Engaged: {analysis.coach_engaged}
            - Budget Confirmed: {not analysis.budget_not_confirmed}
            - Competition Preferred: {analysis.competition_preferred}
            - Clear Business Results: {analysis.clear_business_results}
            - Mutual Action Plan: {analysis.mutual_action_plan}
            
            For a cybersecurity consulting firm (services: MSSP, Application Security, Network Security, GRC),
            provide 3 specific actionable recommendations to improve win probability.
            """
            
            chat = LlmChat(
                api_key=api_key,
                session_id=f"bluesheet-{opp_id}-{datetime.now().timestamp()}",
                system_message="You are a sales strategy expert specializing in B2B enterprise cybersecurity sales using Miller Heiman Blue Sheet methodology. Provide brief, actionable recommendations."
            ).with_model("openai", "gpt-4o")
            
            message = UserMessage(text=context)
            response = await chat.send_message(message)
            recommendations = [line.strip() for line in response.split("\n") if line.strip() and len(line) > 10][:3]
    except Exception as e:
        logger.error(f"LLM recommendation error: {e}")
        # Fallback recommendations
        if not analysis.economic_buyer_identified:
            recommendations.append("Identify and engage the Economic Buyer - the person with final budget authority")
        if not analysis.coach_identified:
            recommendations.append("Develop a Coach inside the organization who can guide your strategy")
        if analysis.budget_not_confirmed:
            recommendations.append("Confirm budget allocation and funding timeline")
        if not analysis.mutual_action_plan:
            recommendations.append("Create a mutual action plan with clear milestones and commitments")
    
    # Update opportunity probability
    await db.opportunities.update_one(
        {"id": opp_id},
        {"$set": {
            "probability": calculated_probability,
            "blue_sheet_analysis": analysis.model_dump(),
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    # Generate summary
    summary = f"Based on Blue Sheet analysis, this opportunity has a {calculated_probability}% probability of closing. "
    if calculated_probability >= 70:
        summary += "Strong position with key buying influences engaged."
    elif calculated_probability >= 40:
        summary += "Moderate position - address red flags to improve odds."
    else:
        summary += "Weak position - significant gaps in sales strategy need attention."
    
    return BlueSheetProbabilityResponse(
        opportunity_id=opp_id,
        calculated_probability=calculated_probability,
        confidence_level=confidence,
        analysis_summary=summary,
        recommendations=recommendations,
        score_breakdown=score_breakdown
    )

# ===================== SALES METRICS / INCENTIVE CALCULATOR =====================

@api_router.get("/sales-metrics/{user_id}", response_model=SalesMetricsResponse)
async def get_sales_metrics(user_id: str, period: str = "quarterly", user: dict = Depends(get_current_user)):
    """Get sales metrics for a user"""
    # Determine period dates
    now = datetime.now(timezone.utc)
    if period == "monthly":
        period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif period == "quarterly":
        quarter_month = ((now.month - 1) // 3) * 3 + 1
        period_start = now.replace(month=quarter_month, day=1, hour=0, minute=0, second=0, microsecond=0)
    else:  # ytd
        period_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Get closed won opportunities
    won_opps = await db.opportunities.find({
        "owner_id": user_id,
        "stage": "closed_won"
    }, {"_id": 0}).to_list(10000)
    
    # Calculate metrics (in real scenario, this would come from Odoo)
    orders_won = sum(o.get("value", 0) for o in won_opps)
    orders_booked = orders_won  # Simplified
    orders_invoiced = orders_won * 0.8  # Simplified estimate
    orders_collected = orders_won * 0.6  # Simplified estimate
    
    # Get user quota
    target_user = await db.users.find_one({"id": user_id})
    quota = target_user.get("quota", 500000) if target_user else 500000
    
    attainment = (orders_won / quota * 100) if quota > 0 else 0
    
    # Calculate commission
    commission_earned = await calculate_commission(user_id, orders_won, attainment)
    
    return SalesMetricsResponse(
        user_id=user_id,
        period=period,
        period_start=period_start,
        period_end=now,
        orders_won=orders_won,
        orders_booked=orders_booked,
        orders_invoiced=orders_invoiced,
        orders_collected=orders_collected,
        quota=quota,
        attainment_percentage=round(attainment, 1),
        commission_earned=commission_earned,
        commission_projected=commission_earned * (100 / max(attainment, 1)) if attainment < 100 else commission_earned
    )

async def calculate_commission(user_id: str, revenue: float, attainment: float) -> float:
    """Calculate commission based on user's assigned template"""
    user = await db.users.find_one({"id": user_id})
    if not user or not user.get("commission_template_id"):
        # Default 5% flat
        return revenue * 0.05
    
    template = await db.commission_templates.find_one({"id": user["commission_template_id"]})
    if not template:
        return revenue * 0.05
    
    if template["template_type"] == "flat":
        commission = revenue * template["base_rate"]
    
    elif template["template_type"] == "tiered_attainment":
        base_commission = revenue * template["base_rate"]
        multiplier = 1.0
        for tier in template.get("tiers", []):
            if tier["min_attainment"] <= attainment < tier["max_attainment"]:
                multiplier = tier["multiplier"]
                break
        commission = base_commission * multiplier
    
    elif template["template_type"] == "tiered_revenue":
        commission = 0
        remaining = revenue
        for tier in sorted(template.get("tiers", []), key=lambda x: x["min_attainment"]):
            tier_max = tier["max_attainment"] - tier["min_attainment"]
            tier_revenue = min(remaining, tier_max)
            commission += tier_revenue * tier.get("rate", template["base_rate"])
            remaining -= tier_revenue
            if remaining <= 0:
                break
    
    elif template["template_type"] == "quota_based":
        commission = revenue * template["base_rate"]
        if attainment >= 100:
            for tier in template.get("tiers", []):
                if tier["min_attainment"] <= attainment < tier["max_attainment"]:
                    commission *= tier["multiplier"]
                    break
    
    else:
        commission = revenue * 0.05
    
    # Apply cap if exists
    if template.get("cap_multiplier"):
        quota = user.get("quota", 500000)
        max_commission = quota * template["base_rate"] * template["cap_multiplier"]
        commission = min(commission, max_commission)
    
    return round(commission, 2)

@api_router.post("/incentive-calculator")
async def calculate_incentive_preview(
    revenue: float,
    template_id: Optional[str] = None,
    quota: float = 500000,
    is_new_logo: bool = False,
    product_line: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """Preview incentive calculation without saving"""
    attainment = (revenue / quota * 100) if quota > 0 else 0
    
    if template_id:
        template = await db.commission_templates.find_one({"id": template_id})
    else:
        template = None
    
    if not template:
        # Default calculation
        base_commission = revenue * 0.05
        return {
            "revenue": revenue,
            "quota": quota,
            "attainment": round(attainment, 1),
            "base_commission": base_commission,
            "multipliers_applied": [],
            "final_commission": base_commission
        }
    
    multipliers = []
    base_commission = revenue * template["base_rate"]
    
    # Apply template logic
    if template["template_type"] == "tiered_attainment":
        for tier in template.get("tiers", []):
            if tier["min_attainment"] <= attainment < tier["max_attainment"]:
                multipliers.append({"type": "attainment_tier", "value": tier["multiplier"]})
                base_commission *= tier["multiplier"]
                break
    
    # Apply new logo multiplier
    if is_new_logo and template.get("new_logo_multiplier", 1.0) > 1.0:
        multipliers.append({"type": "new_logo", "value": template["new_logo_multiplier"]})
        base_commission *= template["new_logo_multiplier"]
    
    # Apply product weight
    if product_line and template.get("product_weights", {}).get(product_line):
        weight = template["product_weights"][product_line]
        multipliers.append({"type": "product_weight", "value": weight})
        base_commission *= weight
    
    # Apply cap
    if template.get("cap_multiplier"):
        max_commission = quota * template["base_rate"] * template["cap_multiplier"]
        if base_commission > max_commission:
            multipliers.append({"type": "cap_applied", "value": template["cap_multiplier"]})
            base_commission = max_commission
    
    return {
        "revenue": revenue,
        "quota": quota,
        "attainment": round(attainment, 1),
        "template_name": template["name"],
        "base_rate": template["base_rate"],
        "base_commission": revenue * template["base_rate"],
        "multipliers_applied": multipliers,
        "final_commission": round(base_commission, 2)
    }

# ===================== GLOBAL SEARCH =====================

@api_router.get("/search")
async def global_search(q: str, user: dict = Depends(get_current_user)):
    """Global search across CRM, Sales, and Incentives"""
    if len(q) < 2:
        return {"results": []}
    
    results = []
    search_regex = {"$regex": q, "$options": "i"}
    
    # Search accounts
    accounts = await db.accounts.find(
        {"$or": [{"name": search_regex}, {"industry": search_regex}]},
        {"_id": 0, "id": 1, "name": 1}
    ).limit(5).to_list(5)
    for a in accounts:
        results.append({"type": "account", "id": a["id"], "name": a["name"], "icon": "building"})
    
    # Search opportunities
    opps = await db.opportunities.find(
        {"name": search_regex},
        {"_id": 0, "id": 1, "name": 1}
    ).limit(5).to_list(5)
    for o in opps:
        results.append({"type": "opportunity", "id": o["id"], "name": o["name"], "icon": "target"})
    
    # Search activities
    activities = await db.activities.find(
        {"title": search_regex},
        {"_id": 0, "id": 1, "title": 1}
    ).limit(5).to_list(5)
    for a in activities:
        results.append({"type": "activity", "id": a["id"], "name": a["title"], "icon": "list"})
    
    # Search users
    if user["role"] in [UserRole.SUPER_ADMIN, UserRole.CEO, UserRole.ADMIN]:
        users_found = await db.users.find(
            {"$or": [{"name": search_regex}, {"email": search_regex}]},
            {"_id": 0, "id": 1, "name": 1}
        ).limit(5).to_list(5)
        for u in users_found:
            results.append({"type": "user", "id": u["id"], "name": u["name"], "icon": "user"})
    
    return {"query": q, "results": results[:15]}

# ===================== APP SETUP =====================

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
