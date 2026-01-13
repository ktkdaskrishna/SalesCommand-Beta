"""
Sales Routes - Account Manager Dashboard APIs
Provides endpoints for opportunities, pipeline management, blue sheet analysis,
incentive calculations, and sales metrics.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime, timezone, timedelta
import uuid
import os
import logging

from core.database import Database
from services.auth.jwt_handler import get_current_user_from_token
from middleware.rbac import require_approved

router = APIRouter(tags=["Sales"])
logger = logging.getLogger(__name__)

# ===================== MODELS =====================

class OpportunityCreate(BaseModel):
    name: str
    account_id: str
    value: float = 0
    stage: str = "qualification"
    probability: int = 10
    expected_close_date: Optional[datetime] = None
    product_lines: List[str] = []
    description: Optional[str] = None
    single_sales_objective: Optional[str] = None
    competition: Optional[str] = None

class OpportunityUpdate(BaseModel):
    name: Optional[str] = None
    value: Optional[float] = None
    stage: Optional[str] = None
    probability: Optional[int] = None
    expected_close_date: Optional[datetime] = None
    product_lines: Optional[List[str]] = None
    description: Optional[str] = None
    single_sales_objective: Optional[str] = None
    competition: Optional[str] = None

class BlueSheetAnalysis(BaseModel):
    opportunity_id: str
    # Buying Influences
    economic_buyer_identified: bool = False
    economic_buyer_favorable: bool = False
    user_buyers_identified: int = 0
    user_buyers_favorable: int = 0
    technical_buyers_identified: int = 0
    technical_buyers_favorable: int = 0
    coach_identified: bool = False
    coach_engaged: bool = False
    # Red Flags
    no_access_to_economic_buyer: bool = False
    reorganization_pending: bool = False
    budget_not_confirmed: bool = False
    competition_preferred: bool = False
    timeline_unclear: bool = False
    # Win Results
    clear_business_results: bool = False
    quantifiable_value: bool = False
    # Action Plan
    next_steps_defined: bool = False
    mutual_action_plan: bool = False

class CommissionTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    template_type: str = "tiered_attainment"  # flat, tiered_attainment, tiered_revenue, gross_margin
    base_rate: float = 0.05
    tiers: List[Dict] = []
    product_weights: Dict[str, float] = {}
    new_logo_multiplier: float = 1.5

class ActivityCreate(BaseModel):
    title: str
    description: Optional[str] = None
    activity_type: str = "task"
    priority: str = "medium"
    status: str = "pending"
    due_date: Optional[datetime] = None
    account_id: Optional[str] = None
    opportunity_id: Optional[str] = None

# ===================== PIPELINE STAGES =====================

DEFAULT_STAGES = [
    {"id": "lead", "name": "Lead", "order": 1, "color": "#6366F1", "probability_default": 5},
    {"id": "qualification", "name": "Qualification", "order": 2, "color": "#8B5CF6", "probability_default": 10},
    {"id": "discovery", "name": "Discovery", "order": 3, "color": "#3B82F6", "probability_default": 25},
    {"id": "proposal", "name": "Proposal", "order": 4, "color": "#F59E0B", "probability_default": 50},
    {"id": "negotiation", "name": "Negotiation", "order": 5, "color": "#F97316", "probability_default": 75},
    {"id": "closed_won", "name": "Closed Won", "order": 6, "color": "#10B981", "probability_default": 100, "is_won": True},
    {"id": "closed_lost", "name": "Closed Lost", "order": 7, "color": "#EF4444", "probability_default": 0, "is_lost": True},
]

# Cybersecurity Product Line Weights
PRODUCT_LINE_WEIGHTS = {
    "MSSP": 1.2,  # Recurring revenue premium
    "Application Security": 1.0,
    "Network Security": 1.0,
    "GRC": 1.1,  # Consulting margin premium
}

# ===================== OPPORTUNITIES =====================

@router.post("/opportunities")
async def create_opportunity(
    data: OpportunityCreate,
    token_data: dict = Depends(require_approved())
):
    """Create a new opportunity"""
    db = Database.get_db()
    user_id = token_data["id"]
    
    # Verify account exists
    account = await db.accounts.find_one({"id": data.account_id})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    now = datetime.now(timezone.utc)
    opp_id = str(uuid.uuid4())
    
    opportunity = {
        "id": opp_id,
        "name": data.name,
        "account_id": data.account_id,
        "account_name": account.get("name", ""),
        "value": data.value,
        "stage": data.stage,
        "probability": data.probability,
        "expected_close_date": data.expected_close_date,
        "product_lines": data.product_lines,
        "description": data.description,
        "single_sales_objective": data.single_sales_objective,
        "competition": data.competition,
        "owner_id": user_id,
        "owner_name": token_data.get("name", ""),
        "blue_sheet_analysis": None,
        "created_at": now,
        "updated_at": now
    }
    
    await db.opportunities.insert_one(opportunity)
    
    # Return without _id
    opportunity.pop("_id", None)
    return opportunity

@router.get("/opportunities")
async def get_opportunities(
    stage: Optional[str] = None,
    product_line: Optional[str] = None,
    token_data: dict = Depends(require_approved())
):
    """Get opportunities with optional filters"""
    db = Database.get_db()
    user_id = token_data["id"]
    user_role = token_data.get("role", "")
    
    query = {}
    
    # Role-based filtering
    if user_role == "account_manager":
        query["owner_id"] = user_id
    
    if stage:
        query["stage"] = stage
    if product_line:
        query["product_lines"] = product_line
    
    opportunities = await db.opportunities.find(query, {"_id": 0}).to_list(1000)
    
    # Enrich with activity counts
    for opp in opportunities:
        activity_count = await db.activities.count_documents({"opportunity_id": opp["id"]})
        opp["activity_count"] = activity_count
    
    return opportunities

@router.get("/opportunities/kanban")
async def get_opportunities_kanban(
    token_data: dict = Depends(require_approved())
):
    """Get opportunities organized by stage for Kanban board"""
    db = Database.get_db()
    user_id = token_data["id"]
    user_role = token_data.get("role", "")
    
    query = {}
    if user_role == "account_manager":
        query["owner_id"] = user_id
    
    opportunities = await db.opportunities.find(query, {"_id": 0}).to_list(10000)
    
    # Get or create stages
    stages = await db.pipeline_stages.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    if not stages:
        # Insert default stages
        for stage in DEFAULT_STAGES:
            await db.pipeline_stages.insert_one(stage)
        stages = DEFAULT_STAGES
    
    # Organize by stage
    kanban_data = {}
    for stage in stages:
        stage_id = stage["id"]
        stage_opps = [o for o in opportunities if o.get("stage") == stage_id]
        
        # Enrich each opportunity
        for opp in stage_opps:
            # Get activity count
            activity_count = await db.activities.count_documents({"opportunity_id": opp["id"]})
            opp["activity_count"] = activity_count
        
        kanban_data[stage_id] = {
            "stage": stage,
            "opportunities": stage_opps,
            "total_value": sum(o.get("value", 0) for o in stage_opps),
            "count": len(stage_opps)
        }
    
    return {"stages": stages, "kanban": kanban_data}

@router.get("/opportunities/{opp_id}")
async def get_opportunity(
    opp_id: str,
    token_data: dict = Depends(require_approved())
):
    """Get a single opportunity by ID"""
    db = Database.get_db()
    
    opportunity = await db.opportunities.find_one({"id": opp_id}, {"_id": 0})
    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    return opportunity

@router.put("/opportunities/{opp_id}")
async def update_opportunity(
    opp_id: str,
    data: OpportunityUpdate,
    token_data: dict = Depends(require_approved())
):
    """Update an opportunity"""
    db = Database.get_db()
    
    opportunity = await db.opportunities.find_one({"id": opp_id})
    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.opportunities.update_one({"id": opp_id}, {"$set": update_data})
    
    updated = await db.opportunities.find_one({"id": opp_id}, {"_id": 0})
    return updated

@router.patch("/opportunities/{opp_id}/stage")
async def update_opportunity_stage(
    opp_id: str,
    new_stage: str = Query(...),
    token_data: dict = Depends(require_approved())
):
    """Update only the stage of an opportunity (for drag-drop)"""
    db = Database.get_db()
    
    opportunity = await db.opportunities.find_one({"id": opp_id})
    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    # Get stage probability default
    stage = await db.pipeline_stages.find_one({"id": new_stage})
    new_probability = stage.get("probability_default", opportunity.get("probability", 10)) if stage else opportunity.get("probability", 10)
    
    await db.opportunities.update_one(
        {"id": opp_id},
        {"$set": {
            "stage": new_stage,
            "probability": new_probability,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"message": "Stage updated", "stage": new_stage, "probability": new_probability}

# ===================== BLUE SHEET PROBABILITY =====================

@router.post("/opportunities/{opp_id}/calculate-probability")
async def calculate_blue_sheet_probability(
    opp_id: str,
    analysis: BlueSheetAnalysis,
    token_data: dict = Depends(require_approved())
):
    """Calculate opportunity probability using Blue Sheet methodology with AI recommendations"""
    db = Database.get_db()
    
    opportunity = await db.opportunities.find_one({"id": opp_id}, {"_id": 0})
    if not opportunity:
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
    max_possible = 75
    calculated_probability = max(0, min(100, int((total_score / max_possible) * 100)))
    
    # Confidence level
    confidence = "low"
    if analysis.economic_buyer_identified and analysis.coach_identified:
        confidence = "medium"
    if analysis.economic_buyer_favorable and analysis.quantifiable_value and analysis.mutual_action_plan:
        confidence = "high"
    
    # Generate AI recommendations
    recommendations = []
    try:
        # Get LLM config from database or use default
        llm_config = await db.llm_config.find_one({}, {"_id": 0})
        api_key = None
        model_provider = "openai"
        model_name = "gpt-4o"
        
        if llm_config:
            api_key = llm_config.get("api_key") or os.environ.get('EMERGENT_LLM_KEY')
            model_provider = llm_config.get("provider", "openai")
            model_name = llm_config.get("model", "gpt-4o")
        else:
            api_key = os.environ.get('EMERGENT_LLM_KEY')
        
        if api_key:
            from emergentintegrations.llm.chat import LlmChat, UserMessage
            
            context = f"""
            Opportunity: {opportunity.get('name')}
            Value: ${opportunity.get('value', 0):,.0f}
            Current Stage: {opportunity.get('stage')}
            Calculated Probability: {calculated_probability}%
            Product Lines: {', '.join(opportunity.get('product_lines', []))}
            
            Blue Sheet Analysis:
            - Economic Buyer Identified: {analysis.economic_buyer_identified}
            - Economic Buyer Favorable: {analysis.economic_buyer_favorable}
            - Coach Engaged: {analysis.coach_engaged}
            - Budget Confirmed: {not analysis.budget_not_confirmed}
            - Competition Preferred: {analysis.competition_preferred}
            - Clear Business Results: {analysis.clear_business_results}
            - Mutual Action Plan: {analysis.mutual_action_plan}
            
            For a cybersecurity consulting firm (services: MSSP, Application Security, Network Security, GRC),
            provide 3 specific actionable recommendations to improve win probability. Be concise.
            """
            
            chat = LlmChat(
                api_key=api_key,
                session_id=f"bluesheet-{opp_id}-{datetime.now().timestamp()}",
                system_message="You are a sales strategy expert specializing in B2B enterprise cybersecurity sales using Miller Heiman Blue Sheet methodology. Provide brief, actionable recommendations."
            ).with_model(model_provider, model_name)
            
            message = UserMessage(text=context)
            response = await chat.send_message(message)
            recommendations = [line.strip() for line in response.split("\n") if line.strip() and len(line) > 10][:3]
            
    except Exception as e:
        logger.warning(f"LLM recommendation error: {e}")
        # Fallback recommendations
        if not analysis.economic_buyer_identified:
            recommendations.append("Identify and engage the Economic Buyer - the person with final budget authority")
        if not analysis.coach_identified:
            recommendations.append("Develop a Coach inside the organization who can guide your strategy")
        if analysis.budget_not_confirmed:
            recommendations.append("Confirm budget allocation and funding timeline with key stakeholders")
        if not analysis.mutual_action_plan:
            recommendations.append("Create a mutual action plan with clear milestones and commitments")
    
    # Update opportunity
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
    
    return {
        "opportunity_id": opp_id,
        "calculated_probability": calculated_probability,
        "confidence_level": confidence,
        "analysis_summary": summary,
        "recommendations": recommendations,
        "score_breakdown": score_breakdown
    }

# ===================== DASHBOARD STATS =====================

@router.get("/dashboard/stats")
async def get_dashboard_stats(
    token_data: dict = Depends(require_approved())
):
    """Get dashboard statistics for KPI cards"""
    db = Database.get_db()
    user_id = token_data["id"]
    user_role = token_data.get("role", "")
    
    query = {}
    if user_role == "account_manager":
        query["owner_id"] = user_id
    
    # Get all opportunities
    opportunities = await db.opportunities.find(query, {"_id": 0}).to_list(10000)
    
    # Calculate stats
    active_opps = [o for o in opportunities if o.get("stage") not in ["closed_won", "closed_lost"]]
    won_opps = [o for o in opportunities if o.get("stage") == "closed_won"]
    
    total_pipeline_value = sum(o.get("value", 0) for o in active_opps)
    won_revenue = sum(o.get("value", 0) for o in won_opps)
    
    # Activity stats
    activity_query = {}
    if user_role == "account_manager":
        activity_query["$or"] = [{"created_by_id": user_id}, {"assigned_to_id": user_id}]
    
    total_activities = await db.activities.count_documents(activity_query)
    completed_activities = await db.activities.count_documents({**activity_query, "status": "completed"})
    
    now = datetime.now(timezone.utc)
    overdue_activities = await db.activities.count_documents({
        **activity_query,
        "status": {"$in": ["pending", "in_progress"]},
        "due_date": {"$lt": now}
    })
    
    activity_completion_rate = int((completed_activities / total_activities * 100)) if total_activities > 0 else 0
    
    return {
        "total_pipeline_value": total_pipeline_value,
        "won_revenue": won_revenue,
        "active_opportunities": len(active_opps),
        "total_opportunities": len(opportunities),
        "activity_completion_rate": activity_completion_rate,
        "overdue_activities": overdue_activities,
        "total_activities": total_activities,
        "completed_activities": completed_activities
    }

# ===================== SALES METRICS =====================

@router.get("/sales-metrics/{user_id}")
async def get_sales_metrics(
    user_id: str,
    period: str = Query(default="quarterly", regex="^(monthly|quarterly|ytd)$"),
    token_data: dict = Depends(require_approved())
):
    """Get sales metrics for a user"""
    db = Database.get_db()
    
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
    
    # Calculate metrics
    orders_won = sum(o.get("value", 0) for o in won_opps)
    orders_booked = orders_won
    orders_invoiced = orders_won * 0.8
    orders_collected = orders_won * 0.6
    
    # Get user quota
    user = await db.users.find_one({"id": user_id}, {"quota": 1})
    quota = user.get("quota", 500000) if user else 500000
    
    attainment = (orders_won / quota * 100) if quota > 0 else 0
    
    # Calculate commission
    commission_earned = await calculate_commission(db, user_id, orders_won, attainment)
    
    return {
        "user_id": user_id,
        "period": period,
        "period_start": period_start.isoformat(),
        "period_end": now.isoformat(),
        "orders_won": orders_won,
        "orders_booked": orders_booked,
        "orders_invoiced": orders_invoiced,
        "orders_collected": orders_collected,
        "quota": quota,
        "attainment_percentage": round(attainment, 1),
        "commission_earned": commission_earned,
        "commission_projected": commission_earned * (100 / max(attainment, 1)) if attainment < 100 else commission_earned
    }

async def calculate_commission(db, user_id: str, revenue: float, attainment: float) -> float:
    """Calculate commission based on user's assigned template"""
    user = await db.users.find_one({"id": user_id}, {"commission_template_id": 1})
    
    if not user or not user.get("commission_template_id"):
        # Default 5% flat
        return revenue * 0.05
    
    template = await db.commission_templates.find_one({"id": user["commission_template_id"]}, {"_id": 0})
    if not template:
        return revenue * 0.05
    
    if template["template_type"] == "flat":
        return revenue * template.get("base_rate", 0.05)
    
    elif template["template_type"] == "tiered_attainment":
        # Find applicable tier
        commission = revenue * template.get("base_rate", 0.05)
        for tier in sorted(template.get("tiers", []), key=lambda t: t.get("min_attainment", 0)):
            if tier.get("min_attainment", 0) <= attainment <= tier.get("max_attainment", 100):
                commission = revenue * template.get("base_rate", 0.05) * tier.get("multiplier", 1.0)
                break
        return commission
    
    return revenue * 0.05

# ===================== INCENTIVE CALCULATOR =====================

@router.post("/incentive-calculator")
async def calculate_incentive(
    revenue: float = Query(...),
    template_id: Optional[str] = Query(default=None),
    quota: float = Query(default=500000),
    is_new_logo: bool = Query(default=False),
    product_line: Optional[str] = Query(default=None),
    token_data: dict = Depends(require_approved())
):
    """Calculate commission/incentive for a deal"""
    db = Database.get_db()
    
    attainment = (revenue / quota * 100) if quota > 0 else 0
    base_rate = 0.05
    template_name = "Default (5% Flat)"
    multipliers_applied = []
    
    if template_id:
        template = await db.commission_templates.find_one({"id": template_id}, {"_id": 0})
        if template:
            base_rate = template.get("base_rate", 0.05)
            template_name = template.get("name", "Custom Template")
            
            # Apply tiered multiplier
            if template.get("template_type") == "tiered_attainment":
                for tier in sorted(template.get("tiers", []), key=lambda t: t.get("min_attainment", 0)):
                    if tier.get("min_attainment", 0) <= attainment <= tier.get("max_attainment", 100):
                        multipliers_applied.append({
                            "type": "attainment_tier",
                            "value": tier.get("multiplier", 1.0)
                        })
                        break
    
    base_commission = revenue * base_rate
    final_commission = base_commission
    
    # Apply multipliers
    for mult in multipliers_applied:
        final_commission *= mult["value"]
    
    # New logo multiplier (default 1.5x for cybersecurity)
    if is_new_logo:
        new_logo_mult = 1.5
        multipliers_applied.append({"type": "new_logo", "value": new_logo_mult})
        final_commission *= new_logo_mult
    
    # Product line weight
    if product_line and product_line in PRODUCT_LINE_WEIGHTS:
        weight = PRODUCT_LINE_WEIGHTS[product_line]
        if weight != 1.0:
            multipliers_applied.append({"type": f"product_{product_line.lower().replace(' ', '_')}", "value": weight})
            final_commission *= weight
    
    return {
        "revenue": revenue,
        "quota": quota,
        "attainment": round(attainment, 1),
        "template_name": template_name,
        "base_rate": base_rate,
        "base_commission": base_commission,
        "multipliers_applied": multipliers_applied,
        "final_commission": round(final_commission, 2)
    }

# ===================== COMMISSION TEMPLATES =====================

@router.get("/commission-templates")
async def get_commission_templates(
    token_data: dict = Depends(require_approved())
):
    """Get all commission templates"""
    db = Database.get_db()
    templates = await db.commission_templates.find({}, {"_id": 0}).to_list(100)
    
    # Add default templates if none exist
    if not templates:
        default_templates = [
            {
                "id": str(uuid.uuid4()),
                "name": "Cybersecurity Standard",
                "description": "Standard tiered commission for cybersecurity sales",
                "template_type": "tiered_attainment",
                "base_rate": 0.05,
                "tiers": [
                    {"min_attainment": 0, "max_attainment": 50, "multiplier": 0.5},
                    {"min_attainment": 50, "max_attainment": 100, "multiplier": 1.0},
                    {"min_attainment": 100, "max_attainment": 150, "multiplier": 1.5},
                    {"min_attainment": 150, "max_attainment": 200, "multiplier": 2.0},
                ],
                "product_weights": PRODUCT_LINE_WEIGHTS,
                "new_logo_multiplier": 1.5,
                "created_at": datetime.now(timezone.utc)
            },
            {
                "id": str(uuid.uuid4()),
                "name": "MSSP Recurring Revenue",
                "description": "Higher base rate for managed services with recurring revenue",
                "template_type": "tiered_attainment",
                "base_rate": 0.08,
                "tiers": [
                    {"min_attainment": 0, "max_attainment": 75, "multiplier": 0.8},
                    {"min_attainment": 75, "max_attainment": 100, "multiplier": 1.0},
                    {"min_attainment": 100, "max_attainment": 125, "multiplier": 1.3},
                    {"min_attainment": 125, "max_attainment": 200, "multiplier": 1.6},
                ],
                "product_weights": {"MSSP": 1.0},
                "new_logo_multiplier": 1.3,
                "created_at": datetime.now(timezone.utc)
            }
        ]
        await db.commission_templates.insert_many(default_templates)
        templates = default_templates
    
    return templates

@router.post("/commission-templates")
async def create_commission_template(
    data: CommissionTemplateCreate,
    token_data: dict = Depends(require_approved())
):
    """Create a new commission template"""
    db = Database.get_db()
    
    template = {
        "id": str(uuid.uuid4()),
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc),
        "created_by": token_data["id"]
    }
    
    await db.commission_templates.insert_one(template)
    template.pop("_id", None)
    return template

# ===================== GLOBAL SEARCH =====================

@router.get("/search")
async def global_search(
    q: str = Query(..., min_length=2),
    token_data: dict = Depends(require_approved())
):
    """Global search across accounts, opportunities, activities"""
    db = Database.get_db()
    user_id = token_data["id"]
    user_role = token_data.get("role", "")
    
    results = []
    search_regex = {"$regex": q, "$options": "i"}
    
    # Search accounts
    account_query = {"$or": [{"name": search_regex}, {"industry": search_regex}]}
    if user_role == "account_manager":
        account_query["assigned_am_id"] = user_id
    
    accounts = await db.accounts.find(account_query, {"_id": 0, "id": 1, "name": 1}).limit(10).to_list(10)
    for acc in accounts:
        results.append({"type": "account", "id": acc["id"], "name": acc["name"]})
    
    # Search opportunities
    opp_query = {"name": search_regex}
    if user_role == "account_manager":
        opp_query["owner_id"] = user_id
    
    opportunities = await db.opportunities.find(opp_query, {"_id": 0, "id": 1, "name": 1}).limit(10).to_list(10)
    for opp in opportunities:
        results.append({"type": "opportunity", "id": opp["id"], "name": opp["name"]})
    
    # Search activities
    activity_query = {"title": search_regex}
    if user_role == "account_manager":
        activity_query["$or"] = [{"created_by_id": user_id}, {"assigned_to_id": user_id}]
    
    activities = await db.activities.find(activity_query, {"_id": 0, "id": 1, "title": 1}).limit(10).to_list(10)
    for act in activities:
        results.append({"type": "activity", "id": act["id"], "name": act["title"]})
    
    return {"results": results, "query": q}

# ===================== ACTIVITIES =====================

@router.get("/activities")
async def get_activities(
    status: Optional[str] = None,
    opportunity_id: Optional[str] = None,
    account_id: Optional[str] = None,
    token_data: dict = Depends(require_approved())
):
    """Get activities with filters"""
    db = Database.get_db()
    user_id = token_data["id"]
    user_role = token_data.get("role", "")
    
    query = {}
    if user_role == "account_manager":
        query["$or"] = [{"created_by_id": user_id}, {"assigned_to_id": user_id}]
    
    if status:
        query["status"] = status
    if opportunity_id:
        query["opportunity_id"] = opportunity_id
    if account_id:
        query["account_id"] = account_id
    
    activities = await db.activities.find(query, {"_id": 0}).sort("due_date", 1).to_list(1000)
    return activities

@router.post("/activities")
async def create_activity(
    data: ActivityCreate,
    token_data: dict = Depends(require_approved())
):
    """Create a new activity"""
    db = Database.get_db()
    user_id = token_data["id"]
    
    now = datetime.now(timezone.utc)
    activity_id = str(uuid.uuid4())
    
    activity = {
        "id": activity_id,
        **data.model_dump(),
        "created_by_id": user_id,
        "created_by_name": token_data.get("name", ""),
        "assigned_to_id": data.account_id or user_id,
        "completed_at": None,
        "created_at": now,
        "updated_at": now
    }
    
    await db.activities.insert_one(activity)
    activity.pop("_id", None)
    return activity

@router.patch("/activities/{activity_id}/status")
async def update_activity_status(
    activity_id: str,
    status: str = Query(...),
    token_data: dict = Depends(require_approved())
):
    """Update activity status"""
    db = Database.get_db()
    
    update_data = {"status": status, "updated_at": datetime.now(timezone.utc)}
    if status == "completed":
        update_data["completed_at"] = datetime.now(timezone.utc)
    
    result = await db.activities.update_one({"id": activity_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    return {"message": "Status updated", "status": status}

# ===================== ACCOUNTS =====================

class AccountCreate(BaseModel):
    name: str
    industry: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    annual_revenue: Optional[float] = None
    employee_count: Optional[int] = None

@router.get("/accounts")
async def get_accounts(
    token_data: dict = Depends(require_approved())
):
    """Get accounts"""
    db = Database.get_db()
    user_id = token_data["id"]
    user_role = token_data.get("role", "")
    
    query = {}
    if user_role == "account_manager":
        query["assigned_am_id"] = user_id
    
    accounts = await db.accounts.find(query, {"_id": 0}).to_list(1000)
    return accounts

@router.post("/accounts")
async def create_account(
    data: AccountCreate,
    token_data: dict = Depends(require_approved())
):
    """Create a new account"""
    db = Database.get_db()
    user_id = token_data["id"]
    
    now = datetime.now(timezone.utc)
    account_id = str(uuid.uuid4())
    
    account = {
        "id": account_id,
        **data.model_dump(),
        "assigned_am_id": user_id,
        "assigned_am_name": token_data.get("name", ""),
        "created_at": now,
        "updated_at": now
    }
    
    await db.accounts.insert_one(account)
    account.pop("_id", None)
    return account

# ===================== LLM CONFIG =====================

@router.get("/config/llm")
async def get_llm_config(
    token_data: dict = Depends(require_approved())
):
    """Get LLM configuration"""
    db = Database.get_db()
    config = await db.llm_config.find_one({}, {"_id": 0})
    
    if not config:
        config = {
            "provider": "openai",
            "model": "gpt-4o",
            "api_key_set": bool(os.environ.get('EMERGENT_LLM_KEY')),
            "use_emergent_key": True
        }
    else:
        # Don't expose API key
        config["api_key_set"] = bool(config.get("api_key") or os.environ.get('EMERGENT_LLM_KEY'))
        config.pop("api_key", None)
    
    return config

@router.put("/config/llm")
async def update_llm_config(
    provider: str = Query(default="openai"),
    model: str = Query(default="gpt-4o"),
    api_key: Optional[str] = Query(default=None),
    use_emergent_key: bool = Query(default=True),
    token_data: dict = Depends(require_approved())
):
    """Update LLM configuration"""
    db = Database.get_db()
    
    config = {
        "provider": provider,
        "model": model,
        "use_emergent_key": use_emergent_key,
        "updated_at": datetime.now(timezone.utc),
        "updated_by": token_data["id"]
    }
    
    if api_key and not use_emergent_key:
        config["api_key"] = api_key
    
    await db.llm_config.update_one({}, {"$set": config}, upsert=True)
    
    return {"message": "LLM configuration updated", "provider": provider, "model": model}
