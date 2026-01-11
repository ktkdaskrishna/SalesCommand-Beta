"""
Unit Tests for Data Lake Models
"""

import pytest
from datetime import datetime, timezone

from data_lake.models import (
    CanonicalContact,
    CanonicalAccount,
    CanonicalOpportunity,
    CanonicalActivity,
    CanonicalUser,
)
from core.enums import (
    EntityType,
    OpportunityStage,
    ActivityType,
    ActivityStatus,
    UserRole,
    Priority,
)


class TestCanonicalContact:
    """Tests for CanonicalContact model"""
    
    def test_contact_creation(self):
        """Test contact creation with required fields"""
        contact = CanonicalContact(name="John Doe", email="john@example.com")
        
        assert contact.name == "John Doe"
        assert contact.email == "john@example.com"
        assert contact.entity_type == EntityType.CONTACT
        assert contact.is_active is True
    
    def test_contact_with_address(self):
        """Test contact with full address"""
        contact = CanonicalContact(
            name="Jane Smith",
            email="jane@example.com",
            street="123 Main St",
            city="New York",
            state="NY",
            country="USA",
            postal_code="10001"
        )
        
        assert contact.city == "New York"
        assert contact.country == "USA"


class TestCanonicalAccount:
    """Tests for CanonicalAccount model"""
    
    def test_account_creation(self):
        """Test account creation"""
        account = CanonicalAccount(name="Acme Corp", industry="Technology")
        
        assert account.name == "Acme Corp"
        assert account.industry == "Technology"
        assert account.entity_type == EntityType.ACCOUNT
    
    def test_account_with_revenue(self):
        """Test account with financial data"""
        account = CanonicalAccount(
            name="Big Corp",
            annual_revenue=1000000.0,
            employee_count=500
        )
        
        assert account.annual_revenue == 1000000.0
        assert account.employee_count == 500


class TestCanonicalOpportunity:
    """Tests for CanonicalOpportunity model"""
    
    def test_opportunity_creation(self):
        """Test opportunity creation"""
        opp = CanonicalOpportunity(
            name="Big Deal",
            amount=50000.0,
            probability=75
        )
        
        assert opp.name == "Big Deal"
        assert opp.amount == 50000.0
        assert opp.probability == 75
        assert opp.entity_type == EntityType.OPPORTUNITY
        assert opp.is_closed is False
    
    def test_stage_change(self):
        """Test recording stage changes"""
        opp = CanonicalOpportunity(
            name="Test Opp",
            stage=OpportunityStage.LEAD
        )
        
        opp.add_stage_change(OpportunityStage.QUALIFICATION, "user-1")
        
        assert opp.stage == OpportunityStage.QUALIFICATION
        assert len(opp.stage_history) == 1
        assert opp.stage_history[0]["from_stage"] == OpportunityStage.LEAD
        assert opp.stage_history[0]["to_stage"] == OpportunityStage.QUALIFICATION


class TestCanonicalActivity:
    """Tests for CanonicalActivity model"""
    
    def test_activity_creation(self):
        """Test activity creation"""
        activity = CanonicalActivity(
            subject="Follow up call",
            activity_type=ActivityType.CALL
        )
        
        assert activity.subject == "Follow up call"
        assert activity.activity_type == ActivityType.CALL
        assert activity.status == ActivityStatus.PENDING


class TestCanonicalUser:
    """Tests for CanonicalUser model"""
    
    def test_user_creation(self):
        """Test user creation"""
        user = CanonicalUser(
            email="user@example.com",
            name="Test User",
            role=UserRole.SALES_REP
        )
        
        assert user.email == "user@example.com"
        assert user.name == "Test User"
        assert user.role == UserRole.SALES_REP
        assert user.auth_provider == "local"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
