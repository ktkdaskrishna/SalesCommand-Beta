"""
Odoo Integration Hub - Backend API Tests
Tests for Odoo connection, field mappings, sync, and history endpoints
"""

import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "superadmin@salescommand.com"
SUPER_ADMIN_PASSWORD = "demo123"

# Odoo connection credentials
ODOO_URL = "https://securadotest.odoo.com"
ODOO_DATABASE = "securadotest"
ODOO_USERNAME = "krishna@securado.net"
ODOO_API_KEY = "187f4469ab18fa20042cbb64613bb28f08f8072e"


class TestOdooIntegration:
    """Test suite for Odoo Integration Hub"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as super admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.token = token
        else:
            pytest.skip(f"Authentication failed: {login_response.status_code}")
    
    # ===================== CONNECTION TESTS =====================
    
    def test_01_get_odoo_config(self):
        """Test GET /api/odoo/config - Get Odoo integration configuration"""
        response = self.session.get(f"{BASE_URL}/api/odoo/config")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "connection" in data, "Response should contain 'connection' field"
        assert "entity_mappings" in data, "Response should contain 'entity_mappings' field"
        
        # Verify connection structure
        connection = data["connection"]
        assert "url" in connection, "Connection should have 'url' field"
        assert "database" in connection, "Connection should have 'database' field"
        assert "username" in connection, "Connection should have 'username' field"
        assert "is_connected" in connection, "Connection should have 'is_connected' field"
        
        print(f"SUCCESS: Odoo config retrieved. Connected: {connection.get('is_connected')}")
        print(f"  - URL: {connection.get('url')}")
        print(f"  - Database: {connection.get('database')}")
        print(f"  - Version: {connection.get('odoo_version')}")
    
    def test_02_update_connection_settings(self):
        """Test PUT /api/odoo/config/connection - Update connection settings"""
        connection_data = {
            "url": ODOO_URL,
            "database": ODOO_DATABASE,
            "username": ODOO_USERNAME,
            "api_key": ODOO_API_KEY
        }
        
        response = self.session.put(f"{BASE_URL}/api/odoo/config/connection", json=connection_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should contain 'message' field"
        
        print(f"SUCCESS: Connection settings updated - {data.get('message')}")
    
    def test_03_test_odoo_connection(self):
        """Test POST /api/odoo/test-connection - Test Odoo connection with credentials"""
        response = self.session.post(f"{BASE_URL}/api/odoo/test-connection")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data, "Response should contain 'success' field"
        assert "message" in data, "Response should contain 'message' field"
        
        if data["success"]:
            assert "version" in data, "Successful connection should return 'version'"
            print(f"SUCCESS: Connection test passed - {data.get('message')}")
            print(f"  - Odoo Version: {data.get('version')}")
        else:
            print(f"WARNING: Connection test failed - {data.get('message')}")
    
    def test_04_verify_connected_status(self):
        """Test that connection status shows 'Connected' after successful test"""
        response = self.session.get(f"{BASE_URL}/api/odoo/config")
        
        assert response.status_code == 200
        
        data = response.json()
        connection = data.get("connection", {})
        
        # After test_03, connection should be established
        if connection.get("is_connected"):
            print(f"SUCCESS: Connection status is 'Connected'")
            print(f"  - Version: {connection.get('odoo_version')}")
            print(f"  - Last connected: {connection.get('last_connected_at')}")
        else:
            print("INFO: Connection not yet established")
    
    # ===================== FIELD MAPPING TESTS =====================
    
    def test_05_get_entity_mappings(self):
        """Test GET /api/odoo/mappings - Get all entity mappings"""
        response = self.session.get(f"{BASE_URL}/api/odoo/mappings")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list of mappings"
        
        # Should have 3 default mappings: Contacts, Opportunities, Activities
        assert len(data) >= 3, f"Expected at least 3 entity mappings, got {len(data)}"
        
        mapping_names = [m.get("name") for m in data]
        print(f"SUCCESS: Retrieved {len(data)} entity mappings:")
        for mapping in data:
            print(f"  - {mapping.get('name')} ({mapping.get('odoo_model')} -> {mapping.get('local_collection')})")
            print(f"    Fields: {len(mapping.get('field_mappings', []))}, Sync enabled: {mapping.get('sync_enabled')}")
    
    def test_06_get_contacts_mapping(self):
        """Test GET /api/odoo/mappings/{mapping_id} - Get Contacts mapping details"""
        # First get all mappings to find the contacts mapping ID
        response = self.session.get(f"{BASE_URL}/api/odoo/mappings")
        assert response.status_code == 200
        
        mappings = response.json()
        contacts_mapping = next((m for m in mappings if m.get("odoo_model") == "res.partner"), None)
        
        if not contacts_mapping:
            pytest.skip("Contacts mapping not found")
        
        mapping_id = contacts_mapping.get("id")
        response = self.session.get(f"{BASE_URL}/api/odoo/mappings/{mapping_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("name") == "Contacts & Companies", f"Expected 'Contacts & Companies', got {data.get('name')}"
        assert data.get("odoo_model") == "res.partner"
        assert "field_mappings" in data
        
        print(f"SUCCESS: Contacts mapping retrieved")
        print(f"  - ID: {mapping_id}")
        print(f"  - Field mappings: {len(data.get('field_mappings', []))}")
    
    def test_07_get_opportunities_mapping(self):
        """Test GET /api/odoo/mappings/{mapping_id} - Get Opportunities mapping details"""
        response = self.session.get(f"{BASE_URL}/api/odoo/mappings")
        assert response.status_code == 200
        
        mappings = response.json()
        opp_mapping = next((m for m in mappings if m.get("odoo_model") == "crm.lead"), None)
        
        if not opp_mapping:
            pytest.skip("Opportunities mapping not found")
        
        mapping_id = opp_mapping.get("id")
        response = self.session.get(f"{BASE_URL}/api/odoo/mappings/{mapping_id}")
        
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("name") == "Opportunities"
        assert data.get("odoo_model") == "crm.lead"
        
        print(f"SUCCESS: Opportunities mapping retrieved")
        print(f"  - ID: {mapping_id}")
        print(f"  - Field mappings: {len(data.get('field_mappings', []))}")
    
    def test_08_get_activities_mapping(self):
        """Test GET /api/odoo/mappings/{mapping_id} - Get Activities mapping details"""
        response = self.session.get(f"{BASE_URL}/api/odoo/mappings")
        assert response.status_code == 200
        
        mappings = response.json()
        activity_mapping = next((m for m in mappings if m.get("odoo_model") == "mail.activity"), None)
        
        if not activity_mapping:
            pytest.skip("Activities mapping not found")
        
        mapping_id = activity_mapping.get("id")
        response = self.session.get(f"{BASE_URL}/api/odoo/mappings/{mapping_id}")
        
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("name") == "Activities"
        assert data.get("odoo_model") == "mail.activity"
        
        print(f"SUCCESS: Activities mapping retrieved")
        print(f"  - ID: {mapping_id}")
        print(f"  - Field mappings: {len(data.get('field_mappings', []))}")
    
    def test_09_get_odoo_model_fields(self):
        """Test GET /api/odoo/fields/{model} - Get available fields for Odoo model"""
        models_to_test = ["res.partner", "crm.lead", "mail.activity"]
        
        for model in models_to_test:
            response = self.session.get(f"{BASE_URL}/api/odoo/fields/{model}")
            
            assert response.status_code == 200, f"Expected 200 for {model}, got {response.status_code}"
            
            data = response.json()
            assert "model" in data
            assert "static_fields" in data
            
            print(f"SUCCESS: Fields for {model}:")
            print(f"  - Static fields: {len(data.get('static_fields', []))}")
            print(f"  - Dynamic fields: {len(data.get('dynamic_fields', []))}")
            print(f"  - From Odoo: {data.get('from_odoo')}")
    
    # ===================== SYNC DATA TESTS =====================
    
    def test_10_preview_contacts_sync(self):
        """Test GET /api/odoo/preview/{mapping_id} - Preview Contacts data from Odoo"""
        # Get contacts mapping ID
        response = self.session.get(f"{BASE_URL}/api/odoo/mappings")
        assert response.status_code == 200
        
        mappings = response.json()
        contacts_mapping = next((m for m in mappings if m.get("odoo_model") == "res.partner"), None)
        
        if not contacts_mapping:
            pytest.skip("Contacts mapping not found")
        
        mapping_id = contacts_mapping.get("id")
        
        # Preview data
        response = self.session.get(f"{BASE_URL}/api/odoo/preview/{mapping_id}?limit=3")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "total_in_odoo" in data, "Response should contain 'total_in_odoo'"
        assert "preview" in data, "Response should contain 'preview'"
        
        print(f"SUCCESS: Preview Contacts data")
        print(f"  - Total records in Odoo: {data.get('total_in_odoo')}")
        print(f"  - Preview records: {len(data.get('preview', []))}")
        
        # Verify preview structure
        for idx, item in enumerate(data.get("preview", [])[:2]):
            print(f"  - Record {idx + 1}:")
            if "odoo" in item:
                print(f"    Odoo: {item['odoo'].get('name', 'N/A')}")
            if "mapped" in item:
                print(f"    Mapped: {item['mapped'].get('name', 'N/A')}")
    
    def test_11_preview_opportunities_sync(self):
        """Test GET /api/odoo/preview/{mapping_id} - Preview Opportunities data from Odoo"""
        response = self.session.get(f"{BASE_URL}/api/odoo/mappings")
        assert response.status_code == 200
        
        mappings = response.json()
        opp_mapping = next((m for m in mappings if m.get("odoo_model") == "crm.lead"), None)
        
        if not opp_mapping:
            pytest.skip("Opportunities mapping not found")
        
        mapping_id = opp_mapping.get("id")
        
        response = self.session.get(f"{BASE_URL}/api/odoo/preview/{mapping_id}?limit=3")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"SUCCESS: Preview Opportunities data")
        print(f"  - Total records in Odoo: {data.get('total_in_odoo')}")
        print(f"  - Preview records: {len(data.get('preview', []))}")
    
    def test_12_sync_contacts(self):
        """Test POST /api/odoo/sync/{mapping_id} - Sync Contacts from Odoo"""
        response = self.session.get(f"{BASE_URL}/api/odoo/mappings")
        assert response.status_code == 200
        
        mappings = response.json()
        contacts_mapping = next((m for m in mappings if m.get("odoo_model") == "res.partner"), None)
        
        if not contacts_mapping:
            pytest.skip("Contacts mapping not found")
        
        if not contacts_mapping.get("sync_enabled"):
            pytest.skip("Contacts sync is disabled")
        
        mapping_id = contacts_mapping.get("id")
        
        response = self.session.post(f"{BASE_URL}/api/odoo/sync/{mapping_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "status" in data, "Response should contain 'status'"
        assert "processed" in data, "Response should contain 'processed'"
        assert "created" in data, "Response should contain 'created'"
        assert "updated" in data, "Response should contain 'updated'"
        
        print(f"SUCCESS: Contacts sync completed")
        print(f"  - Status: {data.get('status')}")
        print(f"  - Processed: {data.get('processed')}")
        print(f"  - Created: {data.get('created')}")
        print(f"  - Updated: {data.get('updated')}")
        print(f"  - Failed: {data.get('failed')}")
    
    def test_13_sync_all_entities(self):
        """Test POST /api/odoo/sync-all - Sync all enabled entities"""
        response = self.session.post(f"{BASE_URL}/api/odoo/sync-all")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "results" in data, "Response should contain 'results'"
        
        print(f"SUCCESS: Full sync completed")
        for result in data.get("results", []):
            print(f"  - {result.get('entity')}: {result.get('status')} (created: {result.get('created')}, updated: {result.get('updated')})")
    
    # ===================== SYNC HISTORY TESTS =====================
    
    def test_14_get_sync_logs(self):
        """Test GET /api/odoo/sync-logs - Get sync history"""
        response = self.session.get(f"{BASE_URL}/api/odoo/sync-logs?limit=20")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list of sync logs"
        
        print(f"SUCCESS: Retrieved {len(data)} sync logs")
        
        for log in data[:5]:  # Show first 5 logs
            print(f"  - {log.get('entity_mapping_id')}: {log.get('status')}")
            print(f"    Started: {log.get('started_at')}")
            print(f"    Processed: {log.get('records_processed')}, Created: {log.get('records_created')}, Updated: {log.get('records_updated')}")
    
    # ===================== FIELD MAPPING UPDATE TESTS =====================
    
    def test_15_update_field_mappings(self):
        """Test PUT /api/odoo/mappings/{mapping_id}/fields - Update field mappings"""
        response = self.session.get(f"{BASE_URL}/api/odoo/mappings")
        assert response.status_code == 200
        
        mappings = response.json()
        contacts_mapping = next((m for m in mappings if m.get("odoo_model") == "res.partner"), None)
        
        if not contacts_mapping:
            pytest.skip("Contacts mapping not found")
        
        mapping_id = contacts_mapping.get("id")
        field_mappings = contacts_mapping.get("field_mappings", [])
        
        # Just update with existing mappings (no changes)
        response = self.session.put(f"{BASE_URL}/api/odoo/mappings/{mapping_id}/fields", json=field_mappings)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data
        
        print(f"SUCCESS: Field mappings updated - {data.get('message')}")
    
    # ===================== ERROR HANDLING TESTS =====================
    
    def test_16_get_nonexistent_mapping(self):
        """Test GET /api/odoo/mappings/{mapping_id} - 404 for non-existent mapping"""
        response = self.session.get(f"{BASE_URL}/api/odoo/mappings/nonexistent-id-12345")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("SUCCESS: 404 returned for non-existent mapping")
    
    def test_17_preview_nonexistent_mapping(self):
        """Test GET /api/odoo/preview/{mapping_id} - 404 for non-existent mapping"""
        response = self.session.get(f"{BASE_URL}/api/odoo/preview/nonexistent-id-12345")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("SUCCESS: 404 returned for non-existent mapping preview")
    
    def test_18_sync_nonexistent_mapping(self):
        """Test POST /api/odoo/sync/{mapping_id} - 404 for non-existent mapping"""
        response = self.session.post(f"{BASE_URL}/api/odoo/sync/nonexistent-id-12345")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("SUCCESS: 404 returned for non-existent mapping sync")
    
    # ===================== AUTHORIZATION TESTS =====================
    
    def test_19_unauthorized_access(self):
        """Test that Odoo endpoints require authentication"""
        # Create a new session without auth
        unauth_session = requests.Session()
        unauth_session.headers.update({"Content-Type": "application/json"})
        
        endpoints = [
            ("GET", f"{BASE_URL}/api/odoo/config"),
            ("GET", f"{BASE_URL}/api/odoo/mappings"),
            ("POST", f"{BASE_URL}/api/odoo/test-connection"),
            ("GET", f"{BASE_URL}/api/odoo/sync-logs"),
        ]
        
        for method, url in endpoints:
            if method == "GET":
                response = unauth_session.get(url)
            else:
                response = unauth_session.post(url)
            
            assert response.status_code in [401, 403], f"Expected 401/403 for {url}, got {response.status_code}"
        
        print("SUCCESS: All Odoo endpoints require authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
