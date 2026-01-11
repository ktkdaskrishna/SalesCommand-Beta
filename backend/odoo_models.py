# ===================== ODOO INTEGRATION MODULE =====================
# Comprehensive Odoo 17/18 compatible integration with field mapping
# Uses JSON-RPC (native Odoo API) for maximum compatibility

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime

# ===================== ENUMS =====================

class OdooModel(str, Enum):
    """Supported Odoo models for sync"""
    PARTNER = "res.partner"          # Contacts/Companies
    LEAD = "crm.lead"                # Opportunities
    ACTIVITY = "mail.activity"       # Activities
    USER = "res.users"               # Users
    STAGE = "crm.stage"              # Pipeline stages
    ACTIVITY_TYPE = "mail.activity.type"  # Activity types

class SyncDirection(str, Enum):
    """Sync direction options"""
    ODOO_TO_APP = "odoo_to_app"      # One-way: Odoo is master
    APP_TO_ODOO = "app_to_odoo"      # One-way: App is master
    BIDIRECTIONAL = "bidirectional"  # Two-way sync

class SyncFrequency(str, Enum):
    """Sync frequency options"""
    MANUAL = "manual"
    REALTIME = "realtime"            # Webhook-based
    EVERY_5_MIN = "5min"
    EVERY_15_MIN = "15min"
    EVERY_HOUR = "hourly"
    EVERY_DAY = "daily"

class ConflictResolution(str, Enum):
    """How to handle conflicts"""
    ODOO_WINS = "odoo_wins"
    APP_WINS = "app_wins"
    LATEST_WINS = "latest_wins"
    MANUAL = "manual"

class FieldTransformType(str, Enum):
    """Field transformation types"""
    DIRECT = "direct"                # Direct copy
    LOOKUP = "lookup"                # Lookup in mapping table
    FORMAT = "format"                # Apply format (date, currency)
    COMPUTE = "compute"              # Compute from multiple fields
    DEFAULT = "default"              # Use default if null
    CONCATENATE = "concatenate"      # Join multiple fields

# ===================== MODELS =====================

class OdooConnectionConfig(BaseModel):
    """Odoo connection configuration"""
    id: str = "odoo_connection"
    name: str = "Odoo ERP"
    url: str = ""                    # e.g., https://company.odoo.com
    database: str = ""               # Database name
    username: str = ""               # Login email
    api_key: str = ""                # API key (stored encrypted)
    is_connected: bool = False
    last_connected_at: Optional[datetime] = None
    odoo_version: Optional[str] = None  # Auto-detected: "17.0", "18.0"
    
class FieldMapping(BaseModel):
    """Individual field mapping configuration"""
    id: str
    source_field: str                # Odoo field name
    source_field_type: str = "char"  # Odoo field type
    target_field: str                # Our field name
    target_field_type: str = "text"  # Our field type
    transform_type: FieldTransformType = FieldTransformType.DIRECT
    transform_config: Dict[str, Any] = {}  # Transform parameters
    is_required: bool = False
    is_key_field: bool = False       # Used for matching records
    default_value: Optional[Any] = None
    enabled: bool = True

class EntityMapping(BaseModel):
    """Mapping configuration for an entity type"""
    id: str
    name: str                        # Display name
    odoo_model: OdooModel            # Odoo model
    local_collection: str            # MongoDB collection
    description: str = ""
    field_mappings: List[FieldMapping] = []
    key_fields: List[str] = []       # Fields used to match records
    sync_enabled: bool = True
    sync_direction: SyncDirection = SyncDirection.ODOO_TO_APP
    sync_frequency: SyncFrequency = SyncFrequency.MANUAL
    conflict_resolution: ConflictResolution = ConflictResolution.ODOO_WINS
    last_sync_at: Optional[datetime] = None
    sync_filter: Dict[str, Any] = {} # Odoo domain filter
    
class SyncLog(BaseModel):
    """Sync operation log entry"""
    id: str
    entity_mapping_id: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    status: str = "running"          # running, success, failed, partial
    records_processed: int = 0
    records_created: int = 0
    records_updated: int = 0
    records_failed: int = 0
    errors: List[Dict[str, Any]] = []
    triggered_by: str = "manual"     # manual, scheduled, webhook

class OdooIntegrationConfig(BaseModel):
    """Complete Odoo integration configuration"""
    id: str = "odoo_integration"
    connection: OdooConnectionConfig = OdooConnectionConfig()
    entity_mappings: List[EntityMapping] = []
    global_settings: Dict[str, Any] = {
        "sync_batch_size": 100,
        "retry_attempts": 3,
        "retry_delay_seconds": 5,
        "enable_webhooks": False,
        "log_retention_days": 30,
    }
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

# ===================== DEFAULT MAPPINGS =====================

def get_default_partner_mapping() -> EntityMapping:
    """Default mapping for res.partner -> accounts"""
    return EntityMapping(
        id="partner_to_accounts",
        name="Contacts & Companies",
        odoo_model=OdooModel.PARTNER,
        local_collection="accounts",
        description="Sync Odoo partners (contacts/companies) to accounts",
        key_fields=["odoo_id", "email"],
        field_mappings=[
            FieldMapping(
                id="partner_name",
                source_field="name",
                source_field_type="char",
                target_field="name",
                target_field_type="text",
                is_required=True,
                is_key_field=False
            ),
            FieldMapping(
                id="partner_email",
                source_field="email",
                source_field_type="char",
                target_field="primary_contact_email",
                target_field_type="email",
                is_key_field=True
            ),
            FieldMapping(
                id="partner_phone",
                source_field="phone",
                source_field_type="char",
                target_field="primary_contact_phone",
                target_field_type="phone"
            ),
            FieldMapping(
                id="partner_website",
                source_field="website",
                source_field_type="char",
                target_field="website",
                target_field_type="url"
            ),
            FieldMapping(
                id="partner_industry",
                source_field="industry_id",
                source_field_type="many2one",
                target_field="industry",
                target_field_type="dropdown",
                transform_type=FieldTransformType.LOOKUP,
                transform_config={"lookup_field": "name"}
            ),
            FieldMapping(
                id="partner_country",
                source_field="country_id",
                source_field_type="many2one",
                target_field="country",
                target_field_type="dropdown",
                transform_type=FieldTransformType.LOOKUP,
                transform_config={"lookup_field": "code"}
            ),
            FieldMapping(
                id="partner_city",
                source_field="city",
                source_field_type="char",
                target_field="city",
                target_field_type="text"
            ),
            FieldMapping(
                id="partner_street",
                source_field="street",
                source_field_type="char",
                target_field="address",
                target_field_type="textarea"
            ),
            FieldMapping(
                id="partner_employee_count",
                source_field="employee",
                source_field_type="integer",
                target_field="employee_count",
                target_field_type="number",
                enabled=False  # May not exist in all Odoo versions
            ),
            FieldMapping(
                id="partner_revenue",
                source_field="annual_revenue",
                source_field_type="float",
                target_field="annual_revenue",
                target_field_type="currency",
                enabled=False  # May not exist in all Odoo versions
            ),
            FieldMapping(
                id="partner_odoo_id",
                source_field="id",
                source_field_type="integer",
                target_field="odoo_id",
                target_field_type="text",
                is_key_field=True
            ),
        ],
        sync_filter={"is_company": True}  # Only sync companies, not individual contacts
    )

def get_default_lead_mapping() -> EntityMapping:
    """Default mapping for crm.lead -> opportunities"""
    return EntityMapping(
        id="lead_to_opportunities",
        name="Opportunities",
        odoo_model=OdooModel.LEAD,
        local_collection="opportunities",
        description="Sync Odoo CRM leads/opportunities",
        key_fields=["odoo_id"],
        field_mappings=[
            FieldMapping(
                id="lead_name",
                source_field="name",
                source_field_type="char",
                target_field="name",
                target_field_type="text",
                is_required=True
            ),
            FieldMapping(
                id="lead_partner",
                source_field="partner_id",
                source_field_type="many2one",
                target_field="account_id",
                target_field_type="relationship",
                transform_type=FieldTransformType.LOOKUP,
                transform_config={"lookup_collection": "accounts", "lookup_field": "odoo_id"}
            ),
            FieldMapping(
                id="lead_email",
                source_field="email_from",
                source_field_type="char",
                target_field="contact_email",
                target_field_type="email"
            ),
            FieldMapping(
                id="lead_phone",
                source_field="phone",
                source_field_type="char",
                target_field="contact_phone",
                target_field_type="phone"
            ),
            FieldMapping(
                id="lead_revenue",
                source_field="expected_revenue",
                source_field_type="monetary",
                target_field="value",
                target_field_type="currency"
            ),
            FieldMapping(
                id="lead_probability",
                source_field="probability",
                source_field_type="float",
                target_field="probability",
                target_field_type="percentage"
            ),
            FieldMapping(
                id="lead_stage",
                source_field="stage_id",
                source_field_type="many2one",
                target_field="stage",
                target_field_type="dropdown",
                transform_type=FieldTransformType.LOOKUP,
                transform_config={"lookup_field": "name", "value_mapping": {
                    "New": "discovery",
                    "Qualified": "qualification",
                    "Proposition": "proposal",
                    "Won": "closed_won",
                    "Lost": "closed_lost"
                }}
            ),
            FieldMapping(
                id="lead_user",
                source_field="user_id",
                source_field_type="many2one",
                target_field="owner_id",
                target_field_type="relationship",
                transform_type=FieldTransformType.LOOKUP,
                transform_config={"lookup_collection": "users", "lookup_field": "odoo_user_id"}
            ),
            FieldMapping(
                id="lead_close_date",
                source_field="date_deadline",
                source_field_type="date",
                target_field="expected_close_date",
                target_field_type="date"
            ),
            FieldMapping(
                id="lead_description",
                source_field="description",
                source_field_type="html",
                target_field="notes",
                target_field_type="textarea",
                transform_type=FieldTransformType.FORMAT,
                transform_config={"strip_html": True}
            ),
            FieldMapping(
                id="lead_odoo_id",
                source_field="id",
                source_field_type="integer",
                target_field="odoo_id",
                target_field_type="text",
                is_key_field=True
            ),
        ],
        sync_filter={"type": "opportunity"}  # Only opportunities, not leads
    )

def get_default_activity_mapping() -> EntityMapping:
    """Default mapping for mail.activity -> activities"""
    return EntityMapping(
        id="activity_to_activities",
        name="Activities",
        odoo_model=OdooModel.ACTIVITY,
        local_collection="activities",
        description="Sync Odoo activities (calls, meetings, tasks)",
        key_fields=["odoo_id"],
        field_mappings=[
            FieldMapping(
                id="activity_summary",
                source_field="summary",
                source_field_type="char",
                target_field="title",
                target_field_type="text"
            ),
            FieldMapping(
                id="activity_type",
                source_field="activity_type_id",
                source_field_type="many2one",
                target_field="activity_type",
                target_field_type="dropdown",
                transform_type=FieldTransformType.LOOKUP,
                transform_config={"lookup_field": "name", "value_mapping": {
                    "Email": "email",
                    "Call": "call",
                    "Meeting": "meeting",
                    "To-Do": "task"
                }}
            ),
            FieldMapping(
                id="activity_note",
                source_field="note",
                source_field_type="html",
                target_field="description",
                target_field_type="textarea",
                transform_type=FieldTransformType.FORMAT,
                transform_config={"strip_html": True}
            ),
            FieldMapping(
                id="activity_deadline",
                source_field="date_deadline",
                source_field_type="date",
                target_field="due_date",
                target_field_type="date"
            ),
            FieldMapping(
                id="activity_user",
                source_field="user_id",
                source_field_type="many2one",
                target_field="assigned_to",
                target_field_type="relationship",
                transform_type=FieldTransformType.LOOKUP,
                transform_config={"lookup_collection": "users", "lookup_field": "odoo_user_id"}
            ),
            FieldMapping(
                id="activity_res_model",
                source_field="res_model",
                source_field_type="char",
                target_field="related_model",
                target_field_type="text"
            ),
            FieldMapping(
                id="activity_res_id",
                source_field="res_id",
                source_field_type="integer",
                target_field="related_record_odoo_id",
                target_field_type="text"
            ),
            FieldMapping(
                id="activity_odoo_id",
                source_field="id",
                source_field_type="integer",
                target_field="odoo_id",
                target_field_type="text",
                is_key_field=True
            ),
        ]
    )

def get_default_odoo_integration() -> OdooIntegrationConfig:
    """Get default Odoo integration configuration"""
    return OdooIntegrationConfig(
        connection=OdooConnectionConfig(),
        entity_mappings=[
            get_default_partner_mapping(),
            get_default_lead_mapping(),
            get_default_activity_mapping(),
        ]
    )

# ===================== ODOO FIELD DEFINITIONS =====================
# Used for the field mapper UI to show available Odoo fields

ODOO_PARTNER_FIELDS = [
    {"name": "id", "type": "integer", "label": "ID", "required": True},
    {"name": "name", "type": "char", "label": "Name", "required": True},
    {"name": "display_name", "type": "char", "label": "Display Name"},
    {"name": "email", "type": "char", "label": "Email"},
    {"name": "phone", "type": "char", "label": "Phone"},
    {"name": "mobile", "type": "char", "label": "Mobile"},
    {"name": "website", "type": "char", "label": "Website"},
    {"name": "street", "type": "char", "label": "Street"},
    {"name": "street2", "type": "char", "label": "Street 2"},
    {"name": "city", "type": "char", "label": "City"},
    {"name": "zip", "type": "char", "label": "ZIP"},
    {"name": "country_id", "type": "many2one", "label": "Country", "relation": "res.country"},
    {"name": "state_id", "type": "many2one", "label": "State", "relation": "res.country.state"},
    {"name": "industry_id", "type": "many2one", "label": "Industry", "relation": "res.partner.industry"},
    {"name": "company_type", "type": "selection", "label": "Company Type", "options": ["person", "company"]},
    {"name": "is_company", "type": "boolean", "label": "Is Company"},
    {"name": "employee", "type": "integer", "label": "Employee Count"},
    {"name": "annual_revenue", "type": "float", "label": "Annual Revenue"},
    {"name": "user_id", "type": "many2one", "label": "Salesperson", "relation": "res.users"},
    {"name": "create_date", "type": "datetime", "label": "Created On"},
    {"name": "write_date", "type": "datetime", "label": "Last Updated"},
]

ODOO_LEAD_FIELDS = [
    {"name": "id", "type": "integer", "label": "ID", "required": True},
    {"name": "name", "type": "char", "label": "Opportunity Name", "required": True},
    {"name": "partner_id", "type": "many2one", "label": "Customer", "relation": "res.partner"},
    {"name": "email_from", "type": "char", "label": "Email"},
    {"name": "phone", "type": "char", "label": "Phone"},
    {"name": "expected_revenue", "type": "monetary", "label": "Expected Revenue"},
    {"name": "probability", "type": "float", "label": "Probability (%)"},
    {"name": "stage_id", "type": "many2one", "label": "Stage", "relation": "crm.stage"},
    {"name": "user_id", "type": "many2one", "label": "Salesperson", "relation": "res.users"},
    {"name": "team_id", "type": "many2one", "label": "Sales Team", "relation": "crm.team"},
    {"name": "date_deadline", "type": "date", "label": "Expected Closing"},
    {"name": "date_closed", "type": "datetime", "label": "Closed Date"},
    {"name": "type", "type": "selection", "label": "Type", "options": ["lead", "opportunity"]},
    {"name": "priority", "type": "selection", "label": "Priority", "options": ["0", "1", "2", "3"]},
    {"name": "description", "type": "html", "label": "Notes"},
    {"name": "contact_name", "type": "char", "label": "Contact Name"},
    {"name": "create_date", "type": "datetime", "label": "Created On"},
    {"name": "write_date", "type": "datetime", "label": "Last Updated"},
]

ODOO_ACTIVITY_FIELDS = [
    {"name": "id", "type": "integer", "label": "ID", "required": True},
    {"name": "summary", "type": "char", "label": "Summary"},
    {"name": "activity_type_id", "type": "many2one", "label": "Activity Type", "relation": "mail.activity.type"},
    {"name": "note", "type": "html", "label": "Note"},
    {"name": "date_deadline", "type": "date", "label": "Due Date"},
    {"name": "user_id", "type": "many2one", "label": "Assigned To", "relation": "res.users"},
    {"name": "res_model", "type": "char", "label": "Related Model"},
    {"name": "res_id", "type": "integer", "label": "Related Record ID"},
    {"name": "res_name", "type": "char", "label": "Related Record Name"},
    {"name": "create_date", "type": "datetime", "label": "Created On"},
]

def get_odoo_fields_for_model(model: OdooModel) -> List[Dict]:
    """Get available fields for an Odoo model"""
    mapping = {
        OdooModel.PARTNER: ODOO_PARTNER_FIELDS,
        OdooModel.LEAD: ODOO_LEAD_FIELDS,
        OdooModel.ACTIVITY: ODOO_ACTIVITY_FIELDS,
    }
    return mapping.get(model, [])
