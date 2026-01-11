"""
Salesforce Data Validator
=========================
Validates Salesforce data before it enters the Data Lake.

The validator ensures:
1. Required fields are present
2. Data types are correct
3. Business rules are satisfied
4. Data quality standards are met

If validation fails, the record is logged but not loaded,
preserving data integrity.
"""

from typing import List
import re

from sync_engine.base_components import BaseValidator
from core.base import RawRecord, BaseEntity
from data_lake.models import (
    CanonicalContact,
    CanonicalAccount,
    CanonicalOpportunity,
)


class SalesforceValidator(BaseValidator):
    """
    Validator for Salesforce data.
    
    Validates:
    - Required fields are present
    - Email format is valid
    - Numeric fields are non-negative
    - Salesforce IDs are valid format
    """
    
    # Salesforce ID pattern (15 or 18 character alphanumeric)
    SF_ID_PATTERN = re.compile(r'^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$')
    
    def __init__(self):
        super().__init__({
            "contact": {
                "required": ["Id", "LastName"],  # Salesforce minimum requirements
                "email_fields": ["Email"],
            },
            "account": {
                "required": ["Id", "Name"],
            },
            "opportunity": {
                "required": ["Id", "Name"],
                "numeric_fields": ["Amount", "Probability"],
            },
        })
    
    def validate_raw(self, record: RawRecord) -> List[str]:
        """
        Validate raw Salesforce record.
        
        Checks:
        - Has valid Salesforce ID
        - Has required fields for the object type
        """
        errors = super().validate_raw(record)
        
        data = record.raw_data
        
        # Must have Salesforce ID
        sf_id = data.get("Id")
        if not sf_id:
            errors.append("Missing Salesforce Id")
        elif not self.SF_ID_PATTERN.match(sf_id):
            errors.append(f"Invalid Salesforce Id format: {sf_id}")
        
        # Check for deleted records (optional - could be valid for audit)
        if data.get("IsDeleted"):
            # Not an error, but we track it
            pass
        
        return errors
    
    def validate_canonical(self, entity: BaseEntity) -> List[str]:
        """
        Validate canonical entity created from Salesforce data.
        """
        errors = super().validate_canonical(entity)
        
        if isinstance(entity, CanonicalContact):
            errors.extend(self._validate_contact(entity))
        elif isinstance(entity, CanonicalAccount):
            errors.extend(self._validate_account(entity))
        elif isinstance(entity, CanonicalOpportunity):
            errors.extend(self._validate_opportunity(entity))
        
        return errors
    
    def _validate_contact(self, contact: CanonicalContact) -> List[str]:
        """Validate contact entity"""
        errors = []
        
        # Name is required
        if not contact.name or len(contact.name.strip()) == 0:
            errors.append("Contact name is required")
        
        # Email format (if provided)
        if contact.email and not self._validate_email(contact.email):
            errors.append(f"Invalid email format: {contact.email}")
        
        # Must have at least one source reference
        if not contact.sources:
            errors.append("Contact must have at least one source reference")
        
        return errors
    
    def _validate_account(self, account: CanonicalAccount) -> List[str]:
        """Validate account entity"""
        errors = []
        
        if not account.name or len(account.name.strip()) == 0:
            errors.append("Account name is required")
        
        if account.employee_count is not None and account.employee_count < 0:
            errors.append(f"Employee count cannot be negative: {account.employee_count}")
        
        if account.annual_revenue is not None and account.annual_revenue < 0:
            errors.append(f"Annual revenue cannot be negative: {account.annual_revenue}")
        
        return errors
    
    def _validate_opportunity(self, opp: CanonicalOpportunity) -> List[str]:
        """Validate opportunity entity"""
        errors = []
        
        if not opp.name or len(opp.name.strip()) == 0:
            errors.append("Opportunity name is required")
        
        if opp.probability < 0 or opp.probability > 100:
            errors.append(f"Probability must be 0-100: {opp.probability}")
        
        if opp.amount < 0:
            errors.append(f"Amount cannot be negative: {opp.amount}")
        
        # Closed deals should have close date
        if opp.is_closed and not opp.actual_close_date:
            # Warning, not error
            pass
        
        return errors
