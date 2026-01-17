"""
Universal Field Mapper for Odoo Integration
Handles field extraction across different Odoo versions (v16, v17, v18, v19+)
Normalizes Many2One, Many2Many, and other field types
"""
from typing import Optional, Dict, Any, List
import logging

logger = logging.getLogger(__name__)


# Known Many2One fields in Odoo that return [id, "name"] format
MANY2ONE_FIELDS = {
    "partner_id", "user_id", "stage_id", "country_id", "state_id", 
    "team_id", "parent_id", "company_id", "currency_id", "pricelist_id",
    "invoice_user_id", "account_id", "partner_shipping_id", "partner_invoice_id",
    "activity_type_id", "res_id", "salesperson_id"
}


class UniversalFieldMapper:
    """
    Universal field mapper that works across Odoo versions.
    Handles different data formats returned by different Odoo versions.
    """
    
    def extract_many2one_id(self, field_value) -> Optional[Any]:
        """
        Extract ID from Odoo Many2One field (version-agnostic).
        
        Supports:
        - Array format (v17+): [12, "Account Name"]
        - Object format (custom): {"id": 12, "name": "Account Name"}
        - Direct ID (legacy): 12
        - False/None: None
        
        Args:
            field_value: Raw Odoo field value
        
        Returns:
            Extracted ID or None
        """
        # Array format [id, name] - Most common in v17+
        if isinstance(field_value, (list, tuple)) and len(field_value) >= 1:
            return field_value[0] if field_value[0] is not False else None
        
        # Object format {"id": 12, "name": "Name"}
        elif isinstance(field_value, dict):
            val = field_value.get("id")
            return val if val is not False else None
        
        # Direct ID (int or string)
        elif isinstance(field_value, (int, str)):
            return field_value
        
        # False or None
        return None
    
    def extract_many2one_name(self, field_value) -> str:
        """
        Extract display name from Odoo Many2One field (version-agnostic).
        
        Args:
            field_value: Raw Odoo field value
        
        Returns:
            Extracted name or empty string
        """
        # Array format [id, name]
        if isinstance(field_value, (list, tuple)) and len(field_value) >= 2:
            return str(field_value[1]) if field_value[1] is not False else ""
        
        # Object format {"id": 12, "name": "Name"}
        elif isinstance(field_value, dict):
            name = field_value.get("name") or field_value.get("display_name")
            return str(name) if name and name is not False else ""
        
        # No name available
        return ""
    
    def extract_many2one(self, field_value) -> Dict[str, Any]:
        """
        Extract both ID and name from Many2One field.
        
        Returns:
            Dictionary with 'id' and 'name' keys
        """
        return {
            "id": self.extract_many2one_id(field_value),
            "name": self.extract_many2one_name(field_value)
        }
    
    def extract_many2many(self, field_value) -> List[Any]:
        """
        Extract IDs from Odoo Many2Many field.
        
        Formats:
        - Array of IDs: [5, 12, 18]
        - Empty: []
        - False: []
        
        Returns:
            List of IDs
        """
        if isinstance(field_value, (list, tuple)):
            return [id for id in field_value if id is not False and id is not None]
        return []
    
    def clean_odoo_value(self, value, default=""):
        """
        Handle Odoo's False/None/Empty string quirks.
        
        Odoo returns:
        - False for empty Many2One fields
        - False for empty text fields
        - None for truly null values
        - "" for explicitly empty strings
        
        Args:
            value: Raw Odoo value
            default: Default value if empty
        
        Returns:
            Cleaned value
        """
        if value is False or value is None:
            return default
        return value
    
    def map_opportunity(self, odoo_record: Dict[str, Any]) -> Dict[str, Any]:
        """
        Map Odoo crm.lead record to canonical opportunity format.
        
        Args:
            odoo_record: Raw Odoo opportunity/lead record
        
        Returns:
            Canonically formatted opportunity
        """
        # Extract account (partner_id)
        account = self.extract_many2one(odoo_record.get("partner_id"))
        account_name_fallback = self.clean_odoo_value(odoo_record.get("partner_name"))
        
        # Extract owner/salesperson (user_id)
        owner = self.extract_many2one(odoo_record.get("user_id"))
        owner_name_fallback = self.clean_odoo_value(odoo_record.get("salesperson_name"))
        
        # Extract stage
        stage = self.extract_many2one(odoo_record.get("stage_id"))
        stage_name_fallback = self.clean_odoo_value(odoo_record.get("stage_name"))
        
        # Extract team
        team = self.extract_many2one(odoo_record.get("team_id"))
        
        # Extract country (for partner address)
        country = self.extract_many2one(odoo_record.get("country_id"))
        
        return {
            # Basic fields
            "id": odoo_record.get("id"),
            "odoo_id": odoo_record.get("id"),
            "name": self.clean_odoo_value(odoo_record.get("name"), "Untitled"),
            
            # Account (properly extracted)
            "account_id": account["id"],
            "account_name": account["name"] or account_name_fallback,
            "account_linked": account["id"] is not None,
            
            # Owner/Salesperson (properly extracted)
            "owner_id": owner["id"],
            "owner_name": owner["name"] or owner_name_fallback or "Unassigned",
            "owner_assigned": owner["id"] is not None,
            
            # Stage (properly extracted)
            "stage_id": stage["id"],
            "stage_name": stage["name"] or stage_name_fallback or "New",
            
            # Team (properly extracted)
            "team_id": team["id"],
            "team_name": team["name"],
            
            # Financial
            "value": float(self.clean_odoo_value(odoo_record.get("expected_revenue"), 0) or 0),
            "probability": float(self.clean_odoo_value(odoo_record.get("probability"), 0) or 0),
            
            # Dates
            "close_date": self.clean_odoo_value(odoo_record.get("date_deadline")),
            "created_date": self.clean_odoo_value(odoo_record.get("create_date")),
            
            # Other
            "description": self.clean_odoo_value(odoo_record.get("description")),
            "product_lines": self.extract_many2many(odoo_record.get("product_ids")),
            
            # Source tracking
            "source": "odoo",
            "odoo_version": odoo_record.get("__odoo_version__", "unknown"),
        }
    
    def map_account(self, odoo_record: Dict[str, Any]) -> Dict[str, Any]:
        """
        Map Odoo res.partner record to canonical account format.
        
        Args:
            odoo_record: Raw Odoo partner record
        
        Returns:
            Canonically formatted account
        """
        # Extract country
        country = self.extract_many2one(odoo_record.get("country_id"))
        
        # Extract state
        state = self.extract_many2one(odoo_record.get("state_id"))
        
        # Extract parent company
        parent = self.extract_many2one(odoo_record.get("parent_id"))
        
        return {
            "id": odoo_record.get("id"),
            "odoo_id": odoo_record.get("id"),
            "name": self.clean_odoo_value(odoo_record.get("name"), "Unnamed"),
            
            # Contact info
            "email": self.clean_odoo_value(odoo_record.get("email")),
            "phone": self.clean_odoo_value(odoo_record.get("phone")),
            "mobile": self.clean_odoo_value(odoo_record.get("mobile")),
            "website": self.clean_odoo_value(odoo_record.get("website")),
            
            # Address
            "street": self.clean_odoo_value(odoo_record.get("street")),
            "city": self.clean_odoo_value(odoo_record.get("city")),
            "zip": self.clean_odoo_value(odoo_record.get("zip")),
            "state_id": state["id"],
            "state_name": state["name"],
            "country_id": country["id"],
            "country_name": country["name"] or self.clean_odoo_value(odoo_record.get("country_name")),
            
            # Company info
            "is_company": odoo_record.get("is_company", False),
            "parent_id": parent["id"],
            "parent_name": parent["name"],
            
            # Financial
            "credit_limit": float(self.clean_odoo_value(odoo_record.get("credit_limit"), 0) or 0),
            
            # Source
            "source": "odoo",
        }
    
    def map_activity(self, odoo_record: Dict[str, Any]) -> Dict[str, Any]:
        """Map Odoo mail.activity record"""
        # Extract assignee
        user = self.extract_many2one(odoo_record.get("user_id"))
        
        # Extract activity type
        activity_type = self.extract_many2one(odoo_record.get("activity_type_id"))
        
        return {
            "id": odoo_record.get("id"),
            "summary": self.clean_odoo_value(odoo_record.get("summary")) or self.clean_odoo_value(odoo_record.get("note")),
            "activity_type": activity_type["name"] or "task",
            "state": odoo_record.get("state", "planned"),
            "date_deadline": odoo_record.get("date_deadline"),
            "res_model": odoo_record.get("res_model"),
            "res_id": odoo_record.get("res_id"),
            "user_id": user["id"],
            "user_name": user["name"],
            "source": "odoo",
        }


# Singleton instance
_mapper_instance = None

def get_field_mapper() -> UniversalFieldMapper:
    """Get singleton field mapper instance"""
    global _mapper_instance
    if _mapper_instance is None:
        _mapper_instance = UniversalFieldMapper()
    return _mapper_instance
