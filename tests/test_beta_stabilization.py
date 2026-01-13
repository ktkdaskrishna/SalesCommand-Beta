"""
Beta Stabilization Tests for Sales Intelligence Platform
Tests: Dashboard, Receivables, Blue Sheet Config, Login flows
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
AM_EMAIL = "am1@salescommand.com"
AM_PASSWORD = "demo123"
SUPER_ADMIN_EMAIL = "superadmin@salescommand.com"
SUPER_ADMIN_PASSWORD = "demo123"


class TestHealthAndBasics:
    """Basic health and connectivity tests"""
    
    def test_health_endpoint(self):
        """Test health endpoint returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        print(f"✓ Health check passed: {data}")


class TestAuthentication:
    """Authentication flow tests"""
    
    def test_login_account_manager(self):
        """Test Account Manager login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": AM_EMAIL,
            "password": AM_PASSWORD
        })
        assert response.status_code == 200, f"AM login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == AM_EMAIL
        print(f"✓ Account Manager login successful: {data['user']['email']}")
        return data["access_token"]
    
    def test_login_super_admin(self):
        """Test Super Admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Super Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == SUPER_ADMIN_EMAIL
        assert data["user"].get("is_super_admin") == True
        print(f"✓ Super Admin login successful: {data['user']['email']}")
        return data["access_token"]
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code in [401, 404], f"Expected 401/404, got {response.status_code}"
        print("✓ Invalid credentials correctly rejected")


class TestDashboardReal:
    """Dashboard with real Odoo-synced data tests"""
    
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
    
    @pytest.fixture
    def admin_token(self):
        """Get Super Admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Super Admin login failed")
    
    def test_dashboard_real_endpoint_am(self, am_token):
        """Test /dashboard/real endpoint as Account Manager"""
        headers = {"Authorization": f"Bearer {am_token}"}
        response = requests.get(f"{BASE_URL}/api/dashboard/real", headers=headers)
        assert response.status_code == 200, f"Dashboard real failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "source" in data
        assert data["source"] == "data_lake_serving"
        assert "metrics" in data
        assert "opportunities" in data
        assert "accounts" in data
        assert "invoices" in data
        
        # Verify metrics structure
        metrics = data["metrics"]
        assert "pipeline_value" in metrics
        assert "won_revenue" in metrics
        assert "active_opportunities" in metrics
        assert "total_receivables" in metrics
        assert "pending_invoices" in metrics
        
        print(f"✓ Dashboard real (AM): source={data['source']}, metrics={metrics}")
        return data
    
    def test_dashboard_real_endpoint_admin(self, admin_token):
        """Test /dashboard/real endpoint as Super Admin"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/dashboard/real", headers=headers)
        assert response.status_code == 200, f"Dashboard real failed: {response.text}"
        data = response.json()
        
        # Super admin should see all data
        assert data["source"] == "data_lake_serving"
        print(f"✓ Dashboard real (Admin): {len(data['opportunities'])} opportunities, {len(data['invoices'])} invoices")
        return data


class TestReceivables:
    """Receivables/Invoices endpoint tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get Super Admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Super Admin login failed")
    
    def test_receivables_endpoint(self, admin_token):
        """Test /receivables endpoint returns invoice data"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/receivables", headers=headers)
        assert response.status_code == 200, f"Receivables failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "source" in data
        assert data["source"] == "data_lake_serving"
        assert "summary" in data
        assert "invoices" in data
        
        # Verify summary structure
        summary = data["summary"]
        assert "total_receivables" in summary
        assert "total_collected" in summary
        assert "pending_count" in summary
        assert "overdue_count" in summary
        
        print(f"✓ Receivables: {len(data['invoices'])} invoices, total_receivables=${summary['total_receivables']}")
        
        # Verify invoice structure if any exist
        if data["invoices"]:
            invoice = data["invoices"][0]
            assert "id" in invoice
            assert "invoice_number" in invoice or "name" in invoice
            assert "customer_name" in invoice
            assert "total_amount" in invoice
            assert "payment_status" in invoice
            assert "source" in invoice
            print(f"✓ Invoice structure verified: {invoice.get('invoice_number', invoice.get('id'))}")
        
        return data


class TestBlueSheetConfiguration:
    """Blue Sheet Configuration endpoint tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get Super Admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Super Admin login failed")
    
    def test_get_bluesheet_weights(self, admin_token):
        """Test GET /config/bluesheet-weights endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/config/bluesheet-weights", headers=headers)
        assert response.status_code == 200, f"Blue Sheet weights GET failed: {response.text}"
        data = response.json()
        
        # Verify structure - should have buying influence weights
        assert "economic_buyer_identified" in data
        assert "economic_buyer_favorable" in data
        assert "coach_identified" in data
        
        # Verify red flag weights
        assert "no_access_to_economic_buyer" in data
        assert "budget_not_confirmed" in data
        assert "competition_preferred" in data
        
        print(f"✓ Blue Sheet weights retrieved: {len(data)} weight configurations")
        return data
    
    def test_update_bluesheet_weights(self, admin_token):
        """Test PUT /config/bluesheet-weights endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
        
        # Get current weights first
        get_response = requests.get(f"{BASE_URL}/api/config/bluesheet-weights", headers=headers)
        current_weights = get_response.json()
        
        # Update with modified weights
        updated_weights = {
            "economic_buyer_identified": 12,  # Changed from default 10
            "economic_buyer_favorable": 10,
            "user_buyer_favorable_each": 3,
            "technical_buyer_favorable_each": 3,
            "coach_identified": 3,
            "coach_engaged": 2,
            "no_access_to_economic_buyer": -15,
            "reorganization_pending": -10,
            "budget_not_confirmed": -12,
            "competition_preferred": -15,
            "timeline_unclear": -8,
            "clear_business_results": 12,
            "quantifiable_value": 8,
            "next_steps_defined": 8,
            "mutual_action_plan": 7,
            "max_user_buyers": 3,
            "max_technical_buyers": 2,
            "max_possible_score": 75
        }
        
        response = requests.put(f"{BASE_URL}/api/config/bluesheet-weights", headers=headers, json=updated_weights)
        assert response.status_code == 200, f"Blue Sheet weights PUT failed: {response.text}"
        
        # Verify update persisted
        verify_response = requests.get(f"{BASE_URL}/api/config/bluesheet-weights", headers=headers)
        verify_data = verify_response.json()
        assert verify_data["economic_buyer_identified"] == 12
        
        print(f"✓ Blue Sheet weights updated and verified")
        
        # Restore original weights
        requests.put(f"{BASE_URL}/api/config/bluesheet-weights", headers=headers, json=current_weights)


class TestAdminPanelBlueSheetTab:
    """Admin Panel Blue Sheet Config tab tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get Super Admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Super Admin login failed")
    
    def test_admin_roles_endpoint(self, admin_token):
        """Test admin roles endpoint (used by Admin Panel)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/roles", headers=headers)
        assert response.status_code == 200, f"Admin roles failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin roles: {len(data)} roles found")
    
    def test_admin_users_endpoint(self, admin_token):
        """Test admin users endpoint (used by Admin Panel)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
        assert response.status_code == 200, f"Admin users failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin users: {len(data)} users found")


class TestIncentiveConfiguration:
    """Incentive Configuration tests (UI contrast fix verification)"""
    
    @pytest.fixture
    def admin_token(self):
        """Get Super Admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Super Admin login failed")
    
    def test_commission_templates_endpoint(self, admin_token):
        """Test commission templates endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/commission-templates", headers=headers)
        assert response.status_code == 200, f"Commission templates failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Commission templates: {len(data)} templates found")
        
        if data:
            template = data[0]
            assert "id" in template
            assert "name" in template
            assert "base_rate" in template
            print(f"✓ Template structure verified: {template['name']}")
    
    def test_incentive_calculator(self, admin_token):
        """Test incentive calculator endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        params = {
            "revenue": 100000,
            "quota": 500000,
            "is_new_logo": False
        }
        response = requests.post(f"{BASE_URL}/api/incentive-calculator", headers=headers, params=params)
        assert response.status_code == 200, f"Incentive calculator failed: {response.text}"
        data = response.json()
        
        assert "revenue" in data
        assert "final_commission" in data
        assert "attainment" in data
        print(f"✓ Incentive calculator: revenue=${data['revenue']}, commission=${data['final_commission']}")


class TestDataLakeHealth:
    """Data Lake health and connectivity tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get Super Admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Super Admin login failed")
    
    def test_data_lake_health(self, admin_token):
        """Test data lake health endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/data-lake/health", headers=headers)
        assert response.status_code == 200, f"Data lake health failed: {response.text}"
        data = response.json()
        print(f"✓ Data lake health: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
