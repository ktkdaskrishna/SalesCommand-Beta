"""
Salesforce Integration API Routes
=================================
Example API routes for managing Salesforce integration.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Any, Dict, List, Optional
from datetime import datetime
from pydantic import BaseModel

from core.enums import EntityType


router = APIRouter(prefix="/salesforce", tags=["Salesforce Integration"])


class SalesforceConfig(BaseModel):
    """Configuration for Salesforce connection"""
    instance_url: str  # e.g., https://yourcompany.salesforce.com
    access_token: str  # OAuth 2.0 access token
    api_version: str = "v58.0"


class SyncRequest(BaseModel):
    """Request to trigger sync"""
    entity_types: Optional[List[str]] = None  # None = all
    mode: str = "incremental"  # full or incremental


@router.post("/config")
async def save_salesforce_config(
    config: SalesforceConfig,
    # db = Depends(get_db),
    # current_user = Depends(require_admin)
):
    """
    Save Salesforce integration configuration.
    
    You need:
    1. Salesforce Connected App (Setup → App Manager → New Connected App)
    2. OAuth 2.0 access token from the authorization flow
    """
    # In production: encrypt and store config
    return {
        "status": "saved",
        "instance_url": config.instance_url,
        "api_version": config.api_version
    }


@router.get("/config")
async def get_salesforce_config(
    # db = Depends(get_db),
    # current_user = Depends(require_admin)
):
    """Get current Salesforce configuration"""
    return {
        "configured": False,
        "instance_url": None,
        "api_version": "v58.0"
    }


@router.post("/test-connection")
async def test_salesforce_connection(
    config: SalesforceConfig,
):
    """
    Test connection to Salesforce.
    
    Returns org info if successful.
    """
    from integrations.salesforce import SalesforceConnector
    
    connector = SalesforceConnector({
        "instance_url": config.instance_url,
        "access_token": config.access_token,
        "api_version": config.api_version
    })
    
    result = await connector.test_connection()
    return result


@router.post("/sync")
async def trigger_salesforce_sync(
    request: SyncRequest,
    background_tasks: BackgroundTasks,
    # db = Depends(get_db),
    # current_user = Depends(require_admin)
):
    """
    Trigger Salesforce sync.
    
    This will:
    1. Fetch data from Salesforce API
    2. Store raw data in Raw Zone
    3. Transform to canonical models
    4. Update Serving Zone for dashboards
    """
    # In production: Load config from DB, queue background job
    return {
        "status": "queued",
        "entity_types": request.entity_types or ["user", "account", "contact", "opportunity"],
        "mode": request.mode,
        "message": "Sync job queued. Check /api/sync/jobs for status."
    }


@router.get("/objects")
async def list_salesforce_objects(
    # db = Depends(get_db),
    # current_user = Depends(require_admin)
):
    """
    List available Salesforce objects that can be synced.
    """
    return {
        "objects": [
            {
                "name": "User",
                "entity_type": "user",
                "description": "Salesforce users (sales reps, managers)",
                "sync_order": 1
            },
            {
                "name": "Account",
                "entity_type": "account",
                "description": "Companies/organizations",
                "sync_order": 2
            },
            {
                "name": "Contact",
                "entity_type": "contact",
                "description": "Individual people at accounts",
                "sync_order": 3
            },
            {
                "name": "Opportunity",
                "entity_type": "opportunity",
                "description": "Sales deals/opportunities",
                "sync_order": 4
            },
            {
                "name": "Lead",
                "entity_type": "lead",
                "description": "Unqualified prospects (becomes opportunity)",
                "sync_order": 5
            },
            {
                "name": "Task",
                "entity_type": "activity",
                "description": "Activities and tasks",
                "sync_order": 6
            }
        ]
    }


@router.get("/field-mappings/{entity_type}")
async def get_field_mappings(entity_type: str):
    """
    Show how Salesforce fields map to canonical fields.
    
    This helps understand the data transformation.
    """
    mappings = {
        "contact": {
            "salesforce_fields": [
                "Id", "FirstName", "LastName", "Name", "Email", "Phone",
                "MobilePhone", "Title", "AccountId", "MailingCity"
            ],
            "canonical_fields": [
                "id (generated)", "name (FirstName + LastName)", "email",
                "phone", "mobile", "job_title", "account_id", "city"
            ],
            "example_transform": {
                "salesforce": {
                    "Id": "003xx000004TMV1AAO",
                    "FirstName": "John",
                    "LastName": "Smith",
                    "Email": "john@acme.com"
                },
                "canonical": {
                    "id": "uuid-generated",
                    "name": "John Smith",
                    "email": "john@acme.com",
                    "_sources": [{"source": "salesforce", "source_id": "003xx000004TMV1AAO"}]
                }
            }
        },
        "account": {
            "salesforce_fields": [
                "Id", "Name", "Website", "Industry", "NumberOfEmployees",
                "AnnualRevenue", "BillingCity"
            ],
            "canonical_fields": [
                "id", "name", "website", "industry", "employee_count",
                "annual_revenue", "city"
            ]
        },
        "opportunity": {
            "salesforce_fields": [
                "Id", "Name", "Amount", "Probability", "StageName",
                "CloseDate", "IsClosed", "IsWon", "AccountId"
            ],
            "canonical_fields": [
                "id", "name", "amount", "probability", "stage",
                "expected_close_date", "is_closed", "is_won", "account_id"
            ],
            "stage_mapping": {
                "Prospecting": "lead",
                "Qualification": "qualification",
                "Needs Analysis": "discovery",
                "Proposal/Price Quote": "proposal",
                "Negotiation/Review": "negotiation",
                "Closed Won": "closed_won",
                "Closed Lost": "closed_lost"
            }
        }
    }
    
    return mappings.get(entity_type, {"error": f"Unknown entity type: {entity_type}"})
