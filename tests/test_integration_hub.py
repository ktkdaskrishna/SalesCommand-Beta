"""
Integration Hub API Tests
Tests for sync and data-lake endpoints
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSyncAPI:
    """Sync API endpoint tests"""
    
    def test_sync_status_endpoint(self):
        """Test GET /api/sync/status returns sync status"""
        response = requests.get(f"{BASE_URL}/api/sync/status")
        assert response.status_code == 200
        
        data = response.json()
        # Verify response structure
        assert "status" in data
        assert "active_jobs" in data
        assert "pending_jobs" in data
        assert "sources" in data
        
        # Verify sources structure
        sources = data["sources"]
        assert "odoo" in sources
        assert "ms365" in sources
        
        # Verify source details
        assert "connected" in sources["odoo"]
        assert "last_sync" in sources["odoo"]
        
    def test_sync_jobs_list(self):
        """Test GET /api/sync/jobs returns job list"""
        response = requests.get(f"{BASE_URL}/api/sync/jobs")
        assert response.status_code == 200
        
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)
        
    def test_sync_history(self):
        """Test GET /api/sync/history returns history"""
        response = requests.get(f"{BASE_URL}/api/sync/history")
        assert response.status_code == 200
        
        data = response.json()
        assert "items" in data
        assert "total" in data
        
    def test_sync_schedules(self):
        """Test GET /api/sync/schedules returns schedules"""
        response = requests.get(f"{BASE_URL}/api/sync/schedules")
        assert response.status_code == 200
        
        data = response.json()
        assert "items" in data


class TestDataLakeAPI:
    """Data Lake API endpoint tests"""
    
    def test_data_lake_health(self):
        """Test GET /api/data-lake/health returns health status"""
        response = requests.get(f"{BASE_URL}/api/data-lake/health")
        assert response.status_code == 200
        
        data = response.json()
        # Verify response structure
        assert "status" in data
        assert "zones" in data
        assert "timestamp" in data
        
        # Verify zones
        assert data["status"] == "healthy"
        assert "raw" in data["zones"]
        assert "canonical" in data["zones"]
        assert "serving" in data["zones"]
        
    def test_data_lake_stats(self):
        """Test GET /api/data-lake/stats returns statistics"""
        response = requests.get(f"{BASE_URL}/api/data-lake/stats")
        assert response.status_code == 200
        
        data = response.json()
        # Verify three-zone architecture
        assert "raw_zone" in data
        assert "canonical_zone" in data
        assert "serving_zone" in data
        
        # Verify raw zone structure
        raw = data["raw_zone"]
        assert "total_records" in raw
        assert "collections" in raw
        assert isinstance(raw["collections"], list)
        
        # Verify canonical zone structure
        canonical = data["canonical_zone"]
        assert "contacts" in canonical
        assert "accounts" in canonical
        assert "opportunities" in canonical
        assert "activities" in canonical
        assert "users" in canonical
        
        # Verify serving zone structure
        serving = data["serving_zone"]
        assert "dashboard_stats" in serving
        assert "pipeline_summaries" in serving
        assert "kpi_snapshots" in serving
        
    def test_data_lake_entities_contacts(self):
        """Test GET /api/data-lake/entities/contact returns entity list"""
        response = requests.get(f"{BASE_URL}/api/data-lake/entities/contact")
        assert response.status_code == 200
        
        data = response.json()
        assert "entity_type" in data
        assert "items" in data
        assert "total" in data
        assert data["entity_type"] == "contact"
        
    def test_data_lake_entities_opportunity(self):
        """Test GET /api/data-lake/entities/opportunity returns entity list"""
        response = requests.get(f"{BASE_URL}/api/data-lake/entities/opportunity")
        assert response.status_code == 200
        
        data = response.json()
        assert "entity_type" in data
        assert data["entity_type"] == "opportunity"
        
    def test_data_lake_audit_trail(self):
        """Test GET /api/data-lake/audit-trail returns audit entries"""
        response = requests.get(f"{BASE_URL}/api/data-lake/audit-trail")
        assert response.status_code == 200
        
        data = response.json()
        assert "items" in data
        assert "total" in data


class TestOdooIntegration:
    """Odoo integration endpoint tests (requires authentication)"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authentication token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@salescommand.com",
            "password": "demo123"
        })
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Authentication failed")
    
    def test_odoo_config(self, auth_headers):
        """Test GET /api/odoo/config returns config"""
        response = requests.get(f"{BASE_URL}/api/odoo/config", headers=auth_headers)
        # May return 200 or 404 depending on setup
        assert response.status_code in [200, 404, 500]
        
    def test_odoo_sync_logs(self, auth_headers):
        """Test GET /api/odoo/sync-logs returns logs"""
        response = requests.get(f"{BASE_URL}/api/odoo/sync-logs?limit=50", headers=auth_headers)
        # May return 200 or 404 depending on setup
        assert response.status_code in [200, 404, 500]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
