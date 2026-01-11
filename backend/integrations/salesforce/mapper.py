"""
Salesforce Data Mappers
=======================
Transform Salesforce data to Canonical models.

IMPORTANT: This is where you define how Salesforce fields map to your 
canonical (standard) fields. Each source system has different field names,
but they all map to the SAME canonical model.

Example:
- Salesforce: "FirstName" + "LastName" → Canonical: "name"
- Odoo: "name" → Canonical: "name"
- HubSpot: "firstname" + "lastname" → Canonical: "name"

This allows the platform to work with data from ANY source uniformly.
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional
import logging

from sync_engine.base_components import BaseMapper
from core.base import RawRecord
from core.enums import IntegrationSource, Priority, OpportunityStage
from data_lake.models import (
    CanonicalContact,
    CanonicalAccount,
    CanonicalOpportunity,
    CanonicalActivity,
    CanonicalUser,
)


logger = logging.getLogger(__name__)


class SalesforceContactMapper(BaseMapper):
    """
    Maps Salesforce Contact → CanonicalContact
    
    Salesforce Contact Fields:
    - Id, FirstName, LastName, Name, Email, Phone, MobilePhone
    - Title, Department, AccountId, Account.Name
    - MailingStreet, MailingCity, MailingState, etc.
    - OwnerId, CreatedDate, LastModifiedDate
    """
    
    def __init__(self, field_mappings: Optional[Dict[str, str]] = None):
        super().__init__(IntegrationSource.SALESFORCE, field_mappings)
    
    def _extract_source_id(self, source_data: Dict[str, Any]) -> str:
        """Salesforce uses 'Id' as the primary key"""
        return source_data.get("Id", "")
    
    def map_to_canonical(self, raw_record: RawRecord) -> CanonicalContact:
        """
        Transform Salesforce Contact to Canonical Contact.
        
        This is the KEY mapping function - it defines how Salesforce
        fields translate to our standard model.
        """
        data = raw_record.raw_data
        
        # Build full name (Salesforce has FirstName + LastName separately)
        name = data.get("Name") or f"{data.get('FirstName', '')} {data.get('LastName', '')}".strip()
        
        # Extract nested Account name if present
        account_name = None
        if isinstance(data.get("Account"), dict):
            account_name = data["Account"].get("Name")
        
        # Extract owner name
        owner_name = None
        if isinstance(data.get("Owner"), dict):
            owner_name = data["Owner"].get("Name")
        
        contact = CanonicalContact(
            # Core fields
            name=name,
            email=data.get("Email"),
            phone=data.get("Phone"),
            mobile=data.get("MobilePhone"),
            
            # Company association
            account_id=data.get("AccountId"),  # Will be resolved to canonical ID later
            company_name=account_name,
            job_title=data.get("Title"),
            department=data.get("Department"),
            
            # Address (Salesforce uses "Mailing" prefix)
            street=data.get("MailingStreet"),
            city=data.get("MailingCity"),
            state=data.get("MailingState"),
            country=data.get("MailingCountry"),
            postal_code=data.get("MailingPostalCode"),
            
            # Ownership
            owner_id=data.get("OwnerId"),  # Will be resolved later
            
            # Status
            is_active=not data.get("IsDeleted", False),
        )
        
        # Add source reference - CRITICAL for traceability
        contact.add_source(
            source=IntegrationSource.SALESFORCE.value,
            source_id=data.get("Id"),
            source_model="Contact"
        )
        
        # Set timestamps from Salesforce
        if data.get("CreatedDate"):
            contact.created_at = self._parse_sf_datetime(data["CreatedDate"])
        if data.get("LastModifiedDate"):
            contact.updated_at = self._parse_sf_datetime(data["LastModifiedDate"])
        
        return contact
    
    def _parse_sf_datetime(self, value: str) -> datetime:
        """Parse Salesforce datetime format (ISO 8601)"""
        try:
            if value:
                return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except:
            pass
        return datetime.now(timezone.utc)


class SalesforceAccountMapper(BaseMapper):
    """
    Maps Salesforce Account → CanonicalAccount
    
    Salesforce Account Fields:
    - Id, Name, Website, Industry, Type
    - NumberOfEmployees, AnnualRevenue
    - BillingStreet, BillingCity, etc.
    - OwnerId, CreatedDate, LastModifiedDate
    """
    
    def __init__(self, field_mappings: Optional[Dict[str, str]] = None):
        super().__init__(IntegrationSource.SALESFORCE, field_mappings)
    
    def _extract_source_id(self, source_data: Dict[str, Any]) -> str:
        return source_data.get("Id", "")
    
    def map_to_canonical(self, raw_record: RawRecord) -> CanonicalAccount:
        """Transform Salesforce Account to Canonical Account"""
        data = raw_record.raw_data
        
        # Map Salesforce Account Type to our account_type
        account_type = self._map_account_type(data.get("Type"))
        
        account = CanonicalAccount(
            # Core fields
            name=data.get("Name", ""),
            website=data.get("Website"),
            industry=data.get("Industry"),
            employee_count=data.get("NumberOfEmployees"),
            annual_revenue=data.get("AnnualRevenue"),
            
            # Address (Salesforce uses "Billing" prefix)
            street=data.get("BillingStreet"),
            city=data.get("BillingCity"),
            state=data.get("BillingState"),
            country=data.get("BillingCountry"),
            postal_code=data.get("BillingPostalCode"),
            
            # Classification
            account_type=account_type,
            
            # Ownership
            owner_id=data.get("OwnerId"),
            
            # Status
            is_active=not data.get("IsDeleted", False),
        )
        
        account.add_source(
            source=IntegrationSource.SALESFORCE.value,
            source_id=data.get("Id"),
            source_model="Account"
        )
        
        if data.get("CreatedDate"):
            account.created_at = self._parse_sf_datetime(data["CreatedDate"])
        if data.get("LastModifiedDate"):
            account.updated_at = self._parse_sf_datetime(data["LastModifiedDate"])
        
        return account
    
    def _map_account_type(self, sf_type: Optional[str]) -> str:
        """Map Salesforce Account Type to canonical type"""
        if not sf_type:
            return "prospect"
        
        type_lower = sf_type.lower()
        if "customer" in type_lower:
            return "customer"
        elif "partner" in type_lower:
            return "partner"
        elif "prospect" in type_lower:
            return "prospect"
        elif "churned" in type_lower or "former" in type_lower:
            return "churned"
        
        return "prospect"
    
    def _parse_sf_datetime(self, value: str) -> datetime:
        try:
            if value:
                return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except:
            pass
        return datetime.now(timezone.utc)


class SalesforceOpportunityMapper(BaseMapper):
    """
    Maps Salesforce Opportunity → CanonicalOpportunity
    
    Salesforce Opportunity Fields:
    - Id, Name, AccountId, ContactId
    - Amount, Probability, StageName
    - CloseDate, IsClosed, IsWon
    - Type, LeadSource, NextStep
    - OwnerId, CreatedDate, LastModifiedDate
    """
    
    # Salesforce Stage → Canonical Stage mapping
    # Customize this based on your Salesforce stage names!
    STAGE_MAP = {
        "prospecting": OpportunityStage.LEAD,
        "qualification": OpportunityStage.QUALIFICATION,
        "needs analysis": OpportunityStage.DISCOVERY,
        "value proposition": OpportunityStage.DISCOVERY,
        "id. decision makers": OpportunityStage.DISCOVERY,
        "perception analysis": OpportunityStage.PROPOSAL,
        "proposal/price quote": OpportunityStage.PROPOSAL,
        "negotiation/review": OpportunityStage.NEGOTIATION,
        "closed won": OpportunityStage.CLOSED_WON,
        "closed lost": OpportunityStage.CLOSED_LOST,
    }
    
    def __init__(self, field_mappings: Optional[Dict[str, str]] = None):
        super().__init__(IntegrationSource.SALESFORCE, field_mappings)
    
    def _extract_source_id(self, source_data: Dict[str, Any]) -> str:
        return source_data.get("Id", "")
    
    def map_to_canonical(self, raw_record: RawRecord) -> CanonicalOpportunity:
        """Transform Salesforce Opportunity to Canonical Opportunity"""
        data = raw_record.raw_data
        
        # Map stage
        stage = self._map_stage(data.get("StageName"), data.get("IsClosed"), data.get("IsWon"))
        
        # Parse close date
        close_date = None
        if data.get("CloseDate"):
            try:
                close_date = datetime.strptime(data["CloseDate"], "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except:
                pass
        
        opportunity = CanonicalOpportunity(
            # Core fields
            name=data.get("Name", ""),
            account_id=data.get("AccountId"),
            contact_id=data.get("ContactId"),
            
            # Deal info
            stage=stage.value,
            probability=int(data.get("Probability", 0) or 0),
            amount=float(data.get("Amount", 0) or 0),
            
            # Dates
            expected_close_date=close_date,
            actual_close_date=close_date if data.get("IsClosed") else None,
            
            # Classification
            opportunity_type=self._map_opp_type(data.get("Type")),
            lead_source=data.get("LeadSource"),
            
            # Tracking
            next_step=data.get("NextStep"),
            
            # Ownership
            owner_id=data.get("OwnerId"),
            
            # Status
            is_closed=data.get("IsClosed", False),
            is_won=data.get("IsWon", False),
        )
        
        opportunity.add_source(
            source=IntegrationSource.SALESFORCE.value,
            source_id=data.get("Id"),
            source_model="Opportunity"
        )
        
        if data.get("CreatedDate"):
            opportunity.created_at = self._parse_sf_datetime(data["CreatedDate"])
        if data.get("LastModifiedDate"):
            opportunity.updated_at = self._parse_sf_datetime(data["LastModifiedDate"])
        
        return opportunity
    
    def _map_stage(self, stage_name: Optional[str], is_closed: bool, is_won: bool) -> OpportunityStage:
        """Map Salesforce stage to canonical stage"""
        # Check closed status first
        if is_closed:
            return OpportunityStage.CLOSED_WON if is_won else OpportunityStage.CLOSED_LOST
        
        if not stage_name:
            return OpportunityStage.LEAD
        
        stage_lower = stage_name.lower()
        
        # Check direct mapping
        if stage_lower in self.STAGE_MAP:
            return self.STAGE_MAP[stage_lower]
        
        # Fuzzy matching
        for key, canonical_stage in self.STAGE_MAP.items():
            if key in stage_lower:
                return canonical_stage
        
        return OpportunityStage.LEAD
    
    def _map_opp_type(self, sf_type: Optional[str]) -> str:
        """Map Salesforce Opportunity Type"""
        if not sf_type:
            return "new_business"
        
        type_lower = sf_type.lower()
        if "existing" in type_lower or "upsell" in type_lower:
            return "upsell"
        elif "renewal" in type_lower:
            return "renewal"
        
        return "new_business"
    
    def _parse_sf_datetime(self, value: str) -> datetime:
        try:
            if value:
                return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except:
            pass
        return datetime.now(timezone.utc)


class SalesforceLeadMapper(BaseMapper):
    """
    Maps Salesforce Lead → CanonicalOpportunity (treated as early-stage opportunity)
    
    Note: Leads can also be mapped to Contacts if you prefer.
    This example treats unconverted leads as opportunities in LEAD stage.
    """
    
    def __init__(self, field_mappings: Optional[Dict[str, str]] = None):
        super().__init__(IntegrationSource.SALESFORCE, field_mappings)
    
    def _extract_source_id(self, source_data: Dict[str, Any]) -> str:
        return source_data.get("Id", "")
    
    def map_to_canonical(self, raw_record: RawRecord) -> CanonicalOpportunity:
        """Transform Salesforce Lead to Canonical Opportunity"""
        data = raw_record.raw_data
        
        # Skip converted leads (they become Contacts/Accounts/Opportunities)
        if data.get("IsConverted"):
            logger.debug(f"Skipping converted lead: {data.get('Id')}")
        
        name = data.get("Name") or f"{data.get('FirstName', '')} {data.get('LastName', '')}".strip()
        
        opportunity = CanonicalOpportunity(
            name=f"Lead: {name} - {data.get('Company', 'Unknown')}",
            
            # Leads don't have amount typically
            stage=OpportunityStage.LEAD.value,
            probability=10,
            amount=0,
            
            # Classification
            opportunity_type="lead",
            lead_source=data.get("LeadSource"),
            
            # Ownership
            owner_id=data.get("OwnerId"),
            
            # Not closed
            is_closed=False,
            is_won=False,
        )
        
        opportunity.add_source(
            source=IntegrationSource.SALESFORCE.value,
            source_id=data.get("Id"),
            source_model="Lead"
        )
        
        return opportunity


class SalesforceUserMapper(BaseMapper):
    """Maps Salesforce User → CanonicalUser"""
    
    def __init__(self, field_mappings: Optional[Dict[str, str]] = None):
        super().__init__(IntegrationSource.SALESFORCE, field_mappings)
    
    def _extract_source_id(self, source_data: Dict[str, Any]) -> str:
        return source_data.get("Id", "")
    
    def map_to_canonical(self, raw_record: RawRecord) -> CanonicalUser:
        """Transform Salesforce User to Canonical User"""
        from core.enums import UserRole
        
        data = raw_record.raw_data
        
        name = data.get("Name") or f"{data.get('FirstName', '')} {data.get('LastName', '')}".strip()
        
        user = CanonicalUser(
            email=data.get("Email") or data.get("Username", ""),
            name=name,
            
            # Auth
            auth_provider="salesforce",
            external_id=data.get("Id"),
            
            # Role (default, should be mapped based on Profile/Role in production)
            role=UserRole.SALES_REP,
            
            # Profile
            job_title=data.get("Title"),
            
            # Status
            is_active=data.get("IsActive", True),
        )
        
        user.add_source(
            source=IntegrationSource.SALESFORCE.value,
            source_id=data.get("Id"),
            source_model="User"
        )
        
        return user
