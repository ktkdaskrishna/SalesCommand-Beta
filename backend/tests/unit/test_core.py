"""
Unit Tests for Core Module
"""

import pytest
from datetime import datetime, timezone

from core.base import BaseEntity, RawRecord, SourceReference
from core.enums import EntityType, IntegrationSource, UserRole


class TestBaseEntity:
    """Tests for BaseEntity class"""
    
    def test_entity_creation(self):
        """Test basic entity creation"""
        entity = BaseEntity()
        
        assert entity.id is not None
        assert len(entity.id) == 36  # UUID format
        assert entity.sources == []
        assert entity.version == 1
    
    def test_add_source(self):
        """Test adding source reference"""
        entity = BaseEntity()
        entity.add_source("odoo", "123", "res.partner")
        
        assert len(entity.sources) == 1
        assert entity.sources[0].source == "odoo"
        assert entity.sources[0].source_id == "123"
        assert entity.sources[0].source_model == "res.partner"
    
    def test_get_source_id(self):
        """Test getting source ID"""
        entity = BaseEntity()
        entity.add_source("odoo", "456")
        
        assert entity.get_source_id("odoo") == "456"
        assert entity.get_source_id("ms365") is None
    
    def test_to_mongo_dict(self):
        """Test MongoDB dict conversion"""
        entity = BaseEntity()
        doc = entity.to_mongo_dict()
        
        assert "_id" not in doc
        assert "id" in doc


class TestRawRecord:
    """Tests for RawRecord class"""
    
    def test_raw_record_creation(self):
        """Test raw record creation"""
        record = RawRecord(
            source="odoo",
            source_id="123",
            raw_data={"name": "Test"},
            sync_batch_id="batch-001"
        )
        
        assert record.source == "odoo"
        assert record.source_id == "123"
        assert record.raw_data == {"name": "Test"}
        assert record.sync_batch_id == "batch-001"
        assert record.raw_id is not None


class TestEnums:
    """Tests for enum values"""
    
    def test_entity_types(self):
        """Test entity type enum"""
        assert EntityType.CONTACT.value == "contact"
        assert EntityType.ACCOUNT.value == "account"
        assert EntityType.OPPORTUNITY.value == "opportunity"
    
    def test_integration_sources(self):
        """Test integration source enum"""
        assert IntegrationSource.ODOO.value == "odoo"
        assert IntegrationSource.MICROSOFT365.value == "ms365"
    
    def test_user_roles(self):
        """Test user role enum"""
        assert UserRole.SUPER_ADMIN.value == "super_admin"
        assert UserRole.CEO.value == "ceo"
        assert UserRole.SALES_REP.value == "sales_rep"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
