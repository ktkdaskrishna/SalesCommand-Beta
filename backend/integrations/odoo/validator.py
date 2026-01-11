"""
Odoo Data Validator
Validates Odoo data before processing
"""

from typing import Any, Dict, List

from sync_engine.base_components import BaseValidator
from core.base import RawRecord, BaseEntity
from data_lake.models import (
    CanonicalContact,
    CanonicalAccount,
    CanonicalOpportunity,
    CanonicalActivity,
    CanonicalUser,
)


class OdooValidator(BaseValidator):
    """
    Validator for Odoo data.
    Implements business rules for Odoo entities.
    """
    
    def __init__(self):
        super().__init__({
            "contact": {
                "required": ["name"],
                "email_fields": ["email"],
            },
            "account": {
                "required": ["name"],
            },
            "opportunity": {
                "required": ["name"],
                "numeric_fields": ["probability", "amount"],
            },
            "activity": {
                "required": ["subject"],
            },
            "user": {
                "required": ["email", "name"],
                "email_fields": ["email"],
            },
        })
    
    def validate_raw(self, record: RawRecord) -> List[str]:
        """Validate raw Odoo record"""
        errors = super().validate_raw(record)
        
        data = record.raw_data
        
        # Must have Odoo ID
        if not data.get("id"):
            errors.append("Missing Odoo ID")
        
        # Must have name for most entities
        if not data.get("name"):
            errors.append("Missing name field")
        
        return errors
    
    def validate_canonical(self, entity: BaseEntity) -> List[str]:
        """Validate canonical entity from Odoo"""
        errors = super().validate_canonical(entity)
        
        if isinstance(entity, CanonicalContact):
            errors.extend(self._validate_contact(entity))
        elif isinstance(entity, CanonicalAccount):
            errors.extend(self._validate_account(entity))
        elif isinstance(entity, CanonicalOpportunity):
            errors.extend(self._validate_opportunity(entity))
        elif isinstance(entity, CanonicalActivity):
            errors.extend(self._validate_activity(entity))
        elif isinstance(entity, CanonicalUser):
            errors.extend(self._validate_user(entity))
        
        return errors
    
    def _validate_contact(self, contact: CanonicalContact) -> List[str]:
        """Validate contact entity"""
        errors = []
        
        if not contact.name or len(contact.name.strip()) == 0:
            errors.append("Contact name is required")
        
        if contact.email and not self._validate_email(contact.email):
            errors.append(f"Invalid email format: {contact.email}")
        
        return errors
    
    def _validate_account(self, account: CanonicalAccount) -> List[str]:
        """Validate account entity"""
        errors = []
        
        if not account.name or len(account.name.strip()) == 0:
            errors.append("Account name is required")
        
        if account.employee_count is not None and account.employee_count < 0:
            errors.append("Employee count cannot be negative")
        
        if account.annual_revenue is not None and account.annual_revenue < 0:
            errors.append("Annual revenue cannot be negative")
        
        return errors
    
    def _validate_opportunity(self, opp: CanonicalOpportunity) -> List[str]:
        """Validate opportunity entity"""
        errors = []
        
        if not opp.name or len(opp.name.strip()) == 0:
            errors.append("Opportunity name is required")
        
        if opp.probability < 0 or opp.probability > 100:
            errors.append(f"Probability must be 0-100, got {opp.probability}")
        
        if opp.amount < 0:
            errors.append("Amount cannot be negative")
        
        return errors
    
    def _validate_activity(self, activity: CanonicalActivity) -> List[str]:
        """Validate activity entity"""
        errors = []
        
        if not activity.subject or len(activity.subject.strip()) == 0:
            errors.append("Activity subject is required")
        
        return errors
    
    def _validate_user(self, user: CanonicalUser) -> List[str]:
        """Validate user entity"""
        errors = []
        
        if not user.email:
            errors.append("User email is required")
        elif not self._validate_email(user.email):
            errors.append(f"Invalid email format: {user.email}")
        
        if not user.name or len(user.name.strip()) == 0:
            errors.append("User name is required")
        
        return errors
