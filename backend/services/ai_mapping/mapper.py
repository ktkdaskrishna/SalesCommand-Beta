"""
AI Field Mapping Service
Uses LLM to intelligently map source fields to target schema
"""
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from models.base import FieldMapping, EntityType, IntegrationType

logger = logging.getLogger(__name__)


# Standard canonical schema for each entity type
CANONICAL_SCHEMAS = {
    EntityType.ACCOUNT: {
        "name": {"type": "string", "required": True, "description": "Company/Account name"},
        "email": {"type": "string", "required": False, "description": "Primary email"},
        "phone": {"type": "string", "required": False, "description": "Primary phone"},
        "website": {"type": "string", "required": False, "description": "Company website"},
        "industry": {"type": "string", "required": False, "description": "Industry sector"},
        "address_street": {"type": "string", "required": False, "description": "Street address"},
        "address_city": {"type": "string", "required": False, "description": "City"},
        "address_state": {"type": "string", "required": False, "description": "State/Province"},
        "address_country": {"type": "string", "required": False, "description": "Country"},
        "address_zip": {"type": "string", "required": False, "description": "ZIP/Postal code"},
        "annual_revenue": {"type": "number", "required": False, "description": "Annual revenue"},
        "employee_count": {"type": "integer", "required": False, "description": "Number of employees"},
        "owner_id": {"type": "string", "required": False, "description": "Account owner/manager ID"},
        "owner_name": {"type": "string", "required": False, "description": "Account owner name"},
        "created_date": {"type": "datetime", "required": False, "description": "Creation date"},
        "modified_date": {"type": "datetime", "required": False, "description": "Last modified date"},
    },
    EntityType.OPPORTUNITY: {
        "name": {"type": "string", "required": True, "description": "Opportunity name"},
        "account_id": {"type": "string", "required": False, "description": "Related account ID"},
        "account_name": {"type": "string", "required": False, "description": "Related account name"},
        "value": {"type": "number", "required": False, "description": "Expected revenue/value"},
        "probability": {"type": "integer", "required": False, "description": "Win probability (0-100)"},
        "stage": {"type": "string", "required": False, "description": "Sales stage"},
        "close_date": {"type": "datetime", "required": False, "description": "Expected close date"},
        "description": {"type": "string", "required": False, "description": "Description"},
        "owner_id": {"type": "string", "required": False, "description": "Opportunity owner ID"},
        "owner_name": {"type": "string", "required": False, "description": "Opportunity owner name"},
        "created_date": {"type": "datetime", "required": False, "description": "Creation date"},
        "modified_date": {"type": "datetime", "required": False, "description": "Last modified date"},
    },
    EntityType.CONTACT: {
        "name": {"type": "string", "required": True, "description": "Contact full name"},
        "first_name": {"type": "string", "required": False, "description": "First name"},
        "last_name": {"type": "string", "required": False, "description": "Last name"},
        "email": {"type": "string", "required": False, "description": "Email address"},
        "phone": {"type": "string", "required": False, "description": "Phone number"},
        "mobile": {"type": "string", "required": False, "description": "Mobile number"},
        "title": {"type": "string", "required": False, "description": "Job title"},
        "account_id": {"type": "string", "required": False, "description": "Related account ID"},
        "account_name": {"type": "string", "required": False, "description": "Related account name"},
        "created_date": {"type": "datetime", "required": False, "description": "Creation date"},
        "modified_date": {"type": "datetime", "required": False, "description": "Last modified date"},
    },
    EntityType.ORDER: {
        "name": {"type": "string", "required": True, "description": "Order name/reference"},
        "order_number": {"type": "string", "required": True, "description": "Order number"},
        "account_id": {"type": "string", "required": False, "description": "Customer account ID"},
        "account_name": {"type": "string", "required": False, "description": "Customer name"},
        "total_amount": {"type": "number", "required": False, "description": "Total order amount"},
        "subtotal": {"type": "number", "required": False, "description": "Subtotal before tax"},
        "tax_amount": {"type": "number", "required": False, "description": "Tax amount"},
        "status": {"type": "string", "required": False, "description": "Order status"},
        "order_date": {"type": "datetime", "required": False, "description": "Order date"},
        "delivery_date": {"type": "datetime", "required": False, "description": "Expected delivery date"},
        "invoice_status": {"type": "string", "required": False, "description": "Invoice status"},
        "owner_id": {"type": "string", "required": False, "description": "Sales person ID"},
        "owner_name": {"type": "string", "required": False, "description": "Sales person name"},
        "created_date": {"type": "datetime", "required": False, "description": "Creation date"},
        "modified_date": {"type": "datetime", "required": False, "description": "Last modified date"},
    },
    EntityType.INVOICE: {
        "name": {"type": "string", "required": True, "description": "Invoice name"},
        "invoice_number": {"type": "string", "required": True, "description": "Invoice number"},
        "account_id": {"type": "string", "required": False, "description": "Customer account ID"},
        "account_name": {"type": "string", "required": False, "description": "Customer name"},
        "total_amount": {"type": "number", "required": False, "description": "Total invoice amount"},
        "amount_due": {"type": "number", "required": False, "description": "Amount still due"},
        "amount_paid": {"type": "number", "required": False, "description": "Amount paid"},
        "status": {"type": "string", "required": False, "description": "Invoice status"},
        "payment_status": {"type": "string", "required": False, "description": "Payment status"},
        "invoice_date": {"type": "datetime", "required": False, "description": "Invoice date"},
        "due_date": {"type": "datetime", "required": False, "description": "Payment due date"},
        "owner_id": {"type": "string", "required": False, "description": "Responsible person ID"},
        "owner_name": {"type": "string", "required": False, "description": "Responsible person name"},
        "created_date": {"type": "datetime", "required": False, "description": "Creation date"},
        "modified_date": {"type": "datetime", "required": False, "description": "Last modified date"},
    },
}


class AIFieldMapper:
    """
    AI-powered field mapping service.
    Supports BYOK (Bring Your Own Key) configuration.
    """
    
    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4o"):
        self.api_key = api_key
        self.model = model
        self._chat = None
    
    async def _get_chat(self):
        """Initialize LLM chat client lazily"""
        if not self._chat and self.api_key:
            try:
                from emergentintegrations.llm.chat import LlmChat
                self._chat = LlmChat(
                    api_key=self.api_key,
                    session_id=f"field-mapper-{datetime.now().timestamp()}",
                    system_message="""You are a data integration expert specializing in field mapping.
                    Your task is to map source fields to a standard canonical schema.
                    Provide accurate, confident mappings based on field names, types, and descriptions.
                    Return mappings as JSON array."""
                ).with_model("openai", self.model)
            except ImportError:
                logger.warning("emergentintegrations not available")
        return self._chat
    
    async def auto_map_fields(
        self,
        source_fields: Dict[str, Any],
        entity_type: EntityType,
        integration_type: IntegrationType
    ) -> List[FieldMapping]:
        """
        Automatically map source fields to canonical schema using AI.
        Falls back to rule-based mapping if AI unavailable.
        """
        target_schema = CANONICAL_SCHEMAS.get(entity_type, {})
        
        # Try AI mapping first
        if self.api_key:
            try:
                ai_mappings = await self._ai_map_fields(source_fields, target_schema, entity_type)
                if ai_mappings:
                    return ai_mappings
            except Exception as e:
                logger.warning(f"AI mapping failed, using rule-based: {e}")
        
        # Fallback to rule-based mapping
        return self._rule_based_mapping(source_fields, target_schema, integration_type)
    
    async def _ai_map_fields(
        self,
        source_fields: Dict[str, Any],
        target_schema: Dict[str, Any],
        entity_type: EntityType
    ) -> List[FieldMapping]:
        """Use LLM to intelligently map fields"""
        chat = await self._get_chat()
        if not chat:
            return []
        
        from emergentintegrations.llm.chat import UserMessage
        
        prompt = f"""Map these source fields to the target canonical schema for {entity_type.value}:

SOURCE FIELDS:
{self._format_source_fields(source_fields)}

TARGET SCHEMA:
{self._format_target_schema(target_schema)}

Return a JSON array of mappings. Each mapping should have:
- source_field: the original field name
- target_field: the matching canonical field name
- confidence: 0.0-1.0 confidence score
- transform: optional transformation (e.g., "uppercase", "date_parse", "boolean_to_string")

Only include mappings where you're confident (>0.6). Example:
[{{"source_field": "partner_name", "target_field": "name", "confidence": 0.95, "transform": null}}]
"""
        
        try:
            response = await chat.send_message(UserMessage(text=prompt))
            
            # Parse JSON from response
            import json
            import re
            
            # Extract JSON array from response
            json_match = re.search(r'\[[\s\S]*\]', response)
            if json_match:
                mappings_data = json.loads(json_match.group())
                
                return [
                    FieldMapping(
                        source_field=m["source_field"],
                        target_field=m["target_field"],
                        confidence=m.get("confidence", 0.8),
                        transform=m.get("transform"),
                        is_ai_suggested=True,
                        is_confirmed=False
                    )
                    for m in mappings_data
                    if m.get("confidence", 0) > 0.5
                ]
        except Exception as e:
            logger.error(f"AI field mapping error: {e}")
        
        return []
    
    def _rule_based_mapping(
        self,
        source_fields: Dict[str, Any],
        target_schema: Dict[str, Any],
        integration_type: IntegrationType
    ) -> List[FieldMapping]:
        """Rule-based field mapping fallback"""
        mappings = []
        
        # Common field name mappings per integration
        FIELD_MAPPINGS = {
            IntegrationType.ODOO: {
                # Account mappings
                "name": "name",
                "email": "email",
                "phone": "phone",
                "mobile": "phone",
                "website": "website",
                "street": "address_street",
                "city": "address_city",
                "zip": "address_zip",
                "country_id": "address_country",
                "state_id": "address_state",
                "industry_id": "industry",
                "user_id": "owner_id",
                "create_date": "created_date",
                "write_date": "modified_date",
                # Opportunity mappings
                "expected_revenue": "value",
                "probability": "probability",
                "stage_id": "stage",
                "date_deadline": "close_date",
                "partner_id": "account_id",
                "description": "description",
            }
        }
        
        integration_mappings = FIELD_MAPPINGS.get(integration_type, {})
        
        for source_field in source_fields.keys():
            # Direct mapping
            if source_field in integration_mappings:
                target = integration_mappings[source_field]
                if target in target_schema:
                    mappings.append(FieldMapping(
                        source_field=source_field,
                        target_field=target,
                        confidence=0.9,
                        is_ai_suggested=False,
                        is_confirmed=True
                    ))
            # Exact match
            elif source_field in target_schema:
                mappings.append(FieldMapping(
                    source_field=source_field,
                    target_field=source_field,
                    confidence=1.0,
                    is_ai_suggested=False,
                    is_confirmed=True
                ))
        
        return mappings
    
    def _format_source_fields(self, fields: Dict[str, Any]) -> str:
        """Format source fields for prompt"""
        lines = []
        for name, info in fields.items():
            if isinstance(info, dict):
                field_type = info.get("type", "unknown")
                desc = info.get("string", name)
                lines.append(f"- {name} ({field_type}): {desc}")
            else:
                lines.append(f"- {name}: {info}")
        return "\n".join(lines)
    
    def _format_target_schema(self, schema: Dict[str, Any]) -> str:
        """Format target schema for prompt"""
        lines = []
        for name, info in schema.items():
            field_type = info.get("type", "string")
            desc = info.get("description", name)
            required = "required" if info.get("required") else "optional"
            lines.append(f"- {name} ({field_type}, {required}): {desc}")
        return "\n".join(lines)


def get_canonical_schema(entity_type: EntityType) -> Dict[str, Any]:
    """Get canonical schema for entity type"""
    return CANONICAL_SCHEMAS.get(entity_type, {})
