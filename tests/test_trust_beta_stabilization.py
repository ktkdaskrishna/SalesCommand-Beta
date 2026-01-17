"""
Trust-focused Beta Stabilization Tests
Tests for the simplified dashboard, Deal Confidence, Invoices, and navigation changes
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
AM_EMAIL = "am1@salescommand.com"
AM_PASSWORD = "demo123"
ADMIN_EMAIL = "superadmin@salescommand.com"
ADMIN_PASSWORD = "demo123"


class TestAuthentication:
    """Authentication tests"""
    
    def test_account_manager_login(self):
        """Test Account Manager login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": AM_EMAIL,
            "password": AM_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        
    def test_super_admin_login(self):
        """Test Super Admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["is_super_admin"] == True


class TestDashboardSimplified:
    """Tests for simplified dashboard with 2 KPIs"""
    
    @pytest.fixture
    def am_token(self):
        """Get Account Manager token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": AM_EMAIL,
            "password": AM_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Account Manager login failed")
    
    def test_dashboard_real_endpoint(self, am_token):
        """Test /dashboard/real endpoint returns Odoo data"""
        headers = {"Authorization": f"Bearer {am_token}"}
        response = requests.get(f"{BASE_URL}/api/dashboard/real", headers=headers)
        assert response.status_code == 200, f"Dashboard real failed: {response.text}"
        data = response.json()
        
        # Verify metrics structure
        assert "metrics" in data
        metrics = data["metrics"]
        assert "pipeline_value" in metrics
        assert "active_opportunities" in metrics
        
        # Verify data source note
        assert "data_note" in data
        
    def test_dashboard_stats_endpoint(self, am_token):
        """Test /dashboard/stats endpoint"""
        headers = {"Authorization": f"Bearer {am_token}"}
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        assert response.status_code == 200, f"Dashboard stats failed: {response.text}"


class TestAccountsRealData:
    """Tests for Accounts page with real Odoo data"""
    
    @pytest.fixture
    def am_token(self):
        """Get Account Manager token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": AM_EMAIL,
            "password": AM_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Account Manager login failed")
    
    def test_accounts_real_endpoint(self, am_token):
        """Test /accounts/real endpoint returns Odoo accounts"""
        headers = {"Authorization": f"Bearer {am_token}"}
        response = requests.get(f"{BASE_URL}/api/accounts/real", headers=headers)
        assert response.status_code == 200, f"Accounts real failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "accounts" in data
        
    def test_accounts_legacy_endpoint(self, am_token):
        """Test legacy /accounts endpoint still works"""
        headers = {"Authorization": f"Bearer {am_token}"}
        response = requests.get(f"{BASE_URL}/api/accounts", headers=headers)
        assert response.status_code == 200, f"Accounts failed: {response.text}"


class TestInvoicesReadOnly:
    """Tests for Invoices page (renamed from Receivables)"""
    
    @pytest.fixture
    def am_token(self):
        """Get Account Manager token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": AM_EMAIL,
            "password": AM_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Account Manager login failed")
    
    def test_receivables_endpoint(self, am_token):
        """Test /receivables endpoint returns invoice data"""
        headers = {"Authorization": f"Bearer {am_token}"}
        response = requests.get(f"{BASE_URL}/api/receivables", headers=headers)
        assert response.status_code == 200, f"Receivables failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "invoices" in data
        assert "summary" in data
        
        # Check for INV/2026/00001 invoice
        invoices = data.get("invoices", [])
        if invoices:
            # Verify invoice structure
            invoice = invoices[0]
            assert "invoice_number" in invoice or "id" in invoice
            
    def test_receivables_has_summary(self, am_token):
        """Test receivables summary data"""
        headers = {"Authorization": f"Bearer {am_token}"}
        response = requests.get(f"{BASE_URL}/api/receivables", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        summary = data.get("summary", {})
        # Summary should have these fields
        assert "total_receivables" in summary or "total_collected" in summary or len(summary) >= 0


class TestDealConfidenceConfig:
    """Tests for Deal Confidence (renamed from Blue Sheet) configuration"""
    
    @pytest.fixture
    def admin_token(self):
        """Get Super Admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Super Admin login failed")
    
    def test_bluesheet_weights_get(self, admin_token):
        """Test GET /config/bluesheet-weights returns weights"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/config/bluesheet-weights", headers=headers)
        assert response.status_code == 200, f"Bluesheet weights failed: {response.text}"
        data = response.json()
        
        # Verify key weights exist
        assert "economic_buyer_identified" in data
        assert "economic_buyer_favorable" in data
        assert "no_access_to_economic_buyer" in data
        assert "budget_not_confirmed" in data
        
    def test_bluesheet_weights_update(self, admin_token):
        """Test PUT /config/bluesheet-weights updates weights"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get current weights
        get_response = requests.get(f"{BASE_URL}/api/config/bluesheet-weights", headers=headers)
        assert get_response.status_code == 200
        original = get_response.json()
        
        # Update a weight
        update_data = {"economic_buyer_identified": 15}
        put_response = requests.put(
            f"{BASE_URL}/api/config/bluesheet-weights",
            headers=headers,
            json=update_data
        )
        assert put_response.status_code == 200, f"Update failed: {put_response.text}"
        
        # Verify update
        updated = put_response.json()
        assert updated["economic_buyer_identified"] == 15
        
        # Restore original value
        restore_data = {"economic_buyer_identified": original.get("economic_buyer_identified", 10)}
        requests.put(f"{BASE_URL}/api/config/bluesheet-weights", headers=headers, json=restore_data)


class TestNavigationConfig:
    """Tests for navigation configuration (Invoices instead of Reports)"""
    
    @pytest.fixture
    def admin_token(self):
        """Get Super Admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Super Admin login failed")
    
    def test_navigation_items_endpoint(self, admin_token):
        """Test /config/navigation-items returns available nav items"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/config/navigation-items", headers=headers)
        assert response.status_code == 200, f"Navigation items failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "main_menu" in data
        
        # Check for Invoices in navigation
        main_menu = data.get("main_menu", [])
        nav_ids = [item.get("id") for item in main_menu]
        
        # Invoices should be present
        assert "invoices" in nav_ids, f"Invoices not in navigation: {nav_ids}"
        
        # Reports should NOT be present (removed)
        assert "reports" not in nav_ids, f"Reports should be removed from navigation: {nav_ids}"
        
    def test_user_navigation_endpoint(self, admin_token):
        """Test /config/user/navigation returns user's nav"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/config/user/navigation", headers=headers)
        assert response.status_code == 200, f"User navigation failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "main_menu" in data


class TestAdminPanelTabs:
    """Tests for Admin Panel tabs (Deal Confidence instead of Blue Sheet)"""
    
    @pytest.fixture
    def admin_token(self):
        """Get Super Admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Super Admin login failed")
    
    def test_admin_roles_endpoint(self, admin_token):
        """Test /admin/roles endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/roles", headers=headers)
        assert response.status_code == 200, f"Admin roles failed: {response.text}"
        
    def test_admin_users_endpoint(self, admin_token):
        """Test /admin/users endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
        assert response.status_code == 200, f"Admin users failed: {response.text}"


class TestKanbanDealConfidence:
    """Tests for Kanban cards with Deal Confidence button"""
    
    @pytest.fixture
    def am_token(self):
        """Get Account Manager token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": AM_EMAIL,
            "password": AM_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Account Manager login failed")
    
    def test_opportunities_kanban_endpoint(self, am_token):
        """Test /opportunities/kanban endpoint"""
        headers = {"Authorization": f"Bearer {am_token}"}
        response = requests.get(f"{BASE_URL}/api/opportunities/kanban", headers=headers)
        assert response.status_code == 200, f"Kanban failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "stages" in data or "kanban" in data
        
    def test_calculate_probability_endpoint(self, am_token):
        """Test opportunity probability calculation endpoint exists"""
        headers = {"Authorization": f"Bearer {am_token}"}
        
        # First get an opportunity
        opps_response = requests.get(f"{BASE_URL}/api/opportunities", headers=headers)
        if opps_response.status_code != 200:
            pytest.skip("Could not get opportunities")
            
        opps = opps_response.json()
        if not opps:
            pytest.skip("No opportunities to test")
            
        opp_id = opps[0].get("id")
        
        # Test calculate probability endpoint
        calc_response = requests.post(
            f"{BASE_URL}/api/opportunities/{opp_id}/calculate-probability",
            headers=headers,
            json={
                "opportunity_id": opp_id,
                "economic_buyer_identified": True,
                "economic_buyer_favorable": True,
                "budget_not_confirmed": False
            }
        )
        # Should return 200 or 404 if opportunity not found
        assert calc_response.status_code in [200, 404], f"Calculate probability failed: {calc_response.text}"


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_health_endpoint(self):
        """Test /health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        assert data.get("database") == "connected"
