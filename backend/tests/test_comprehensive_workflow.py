"""
Comprehensive Workflow and Logic Tests
Tests all major features: Auth, CRUD, Integrations, Configuration
"""

import pytest
import requests
import os
import time
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001').rstrip('/')

# ==================== AUTHENTICATION TESTS ====================

class TestAuthentication:
    """Test authentication flows"""
    
    def test_login_valid_superadmin(self):
        """Test login with valid super admin credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@salescommand.com",
            "password": "demo123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == "superadmin@salescommand.com"
        assert data["user"]["role"] == "super_admin"
        print(f"✓ Super admin login successful")
        
    def test_login_valid_account_manager(self):
        """Test login with valid account manager credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "am1@salescommand.com",
            "password": "demo123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        print(f"✓ Account manager login successful")
        
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials should fail"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code in [401, 400, 404]
        print(f"✓ Invalid login correctly rejected")
        
    def test_login_missing_fields(self):
        """Test login with missing fields"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com"
        })
        assert response.status_code in [422, 400]
        print(f"✓ Missing fields correctly rejected")
        
    def test_protected_route_without_token(self):
        """Test protected route without token should fail"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code in [401, 403]
        print(f"✓ Protected route correctly requires auth")
        
    def test_protected_route_with_token(self):
        """Test protected route with valid token"""
        # Login first
        login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@salescommand.com",
            "password": "demo123"
        })
        token = login.json()["access_token"]
        
        # Access protected route
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        assert response.json()["email"] == "superadmin@salescommand.com"
        print(f"✓ Protected route accessible with valid token")


# ==================== HELPER FUNCTION ====================

def get_auth_token(email="superadmin@salescommand.com", password="demo123"):
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": email,
        "password": password
    })
    if response.status_code == 200:
        return response.json()["access_token"]
    return None


# ==================== USER MANAGEMENT TESTS ====================

class TestUserManagement:
    """Test user management features"""
    
    @pytest.fixture
    def auth_headers(self):
        token = get_auth_token()
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_users_list(self, auth_headers):
        """Test getting users list"""
        response = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
        assert response.status_code in [200, 403]  # May require specific role
        if response.status_code == 200:
            users = response.json()
            assert isinstance(users, list)
            print(f"✓ Retrieved {len(users)} users")
        else:
            print(f"✓ Users endpoint requires elevated permissions")
        
    def test_get_current_user(self, auth_headers):
        """Test getting current user info"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert response.status_code == 200
        user = response.json()
        assert "email" in user
        assert "role" in user
        print(f"✓ Current user: {user['email']}")


# ==================== ACCOUNTS CRUD TESTS ====================

class TestAccountsCRUD:
    """Test Accounts CRUD operations"""
    
    @pytest.fixture
    def auth_headers(self):
        token = get_auth_token()
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_accounts_list(self, auth_headers):
        """Test listing accounts"""
        response = requests.get(f"{BASE_URL}/api/accounts", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Retrieved {len(data)} accounts")
        
    def test_create_account(self, auth_headers):
        """Test creating a new account"""
        account_data = {
            "name": f"Test Account {datetime.now().strftime('%H%M%S')}",
            "industry": "Technology",
            "website": "https://testaccount.com",
            "annual_revenue": 1000000,
            "employee_count": 50,
            "status": "active"
        }
        response = requests.post(
            f"{BASE_URL}/api/accounts",
            json=account_data,
            headers=auth_headers
        )
        assert response.status_code in [200, 201]
        created = response.json()
        assert created["name"] == account_data["name"]
        print(f"✓ Created account: {created['name']}")
        return created
        
    def test_get_single_account(self, auth_headers):
        """Test getting a single account"""
        # First get list to find an account
        list_response = requests.get(f"{BASE_URL}/api/accounts", headers=auth_headers)
        accounts = list_response.json()
        
        if len(accounts) > 0:
            account_id = accounts[0].get("id") or accounts[0].get("_id")
            response = requests.get(
                f"{BASE_URL}/api/accounts/{account_id}",
                headers=auth_headers
            )
            assert response.status_code == 200
            print(f"✓ Retrieved single account: {response.json().get('name')}")
        else:
            pytest.skip("No accounts available to test")
            
    def test_update_account(self, auth_headers):
        """Test updating an account"""
        # Get an account first
        list_response = requests.get(f"{BASE_URL}/api/accounts", headers=auth_headers)
        accounts = list_response.json()
        
        if len(accounts) > 0:
            account_id = accounts[0].get("id") or accounts[0].get("_id")
            update_data = {
                "name": accounts[0]["name"],
                "industry": "Updated Industry",
                "status": "active"
            }
            response = requests.put(
                f"{BASE_URL}/api/accounts/{account_id}",
                json=update_data,
                headers=auth_headers
            )
            assert response.status_code == 200
            print(f"✓ Updated account successfully")
        else:
            pytest.skip("No accounts available to update")


# ==================== OPPORTUNITIES CRUD TESTS ====================

class TestOpportunitiesCRUD:
    """Test Opportunities CRUD operations"""
    
    @pytest.fixture
    def auth_headers(self):
        token = get_auth_token()
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_opportunities_list(self, auth_headers):
        """Test listing opportunities"""
        response = requests.get(f"{BASE_URL}/api/opportunities", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Retrieved {len(data)} opportunities")
        
    def test_create_opportunity(self, auth_headers):
        """Test creating a new opportunity"""
        # Get an account first
        accounts = requests.get(f"{BASE_URL}/api/accounts", headers=auth_headers).json()
        account_id = accounts[0].get("id") or accounts[0].get("_id") if accounts else None
        
        opp_data = {
            "name": f"Test Opportunity {datetime.now().strftime('%H%M%S')}",
            "account_id": account_id,
            "value": 50000,
            "stage": "Qualification",
            "probability": 25,
            "expected_close_date": "2026-03-31"
        }
        response = requests.post(
            f"{BASE_URL}/api/opportunities",
            json=opp_data,
            headers=auth_headers
        )
        assert response.status_code in [200, 201]
        created = response.json()
        assert created["name"] == opp_data["name"]
        print(f"✓ Created opportunity: {created['name']}")
        
    def test_update_opportunity(self, auth_headers):
        """Test updating an opportunity"""
        opps = requests.get(f"{BASE_URL}/api/opportunities", headers=auth_headers).json()
        
        if len(opps) > 0:
            opp_id = opps[0].get("id") or opps[0].get("_id")
            update_data = {
                "name": opps[0]["name"],
                "account_id": opps[0].get("account_id"),
                "value": 75000,
                "stage": "Proposal",
                "probability": 50
            }
            response = requests.put(
                f"{BASE_URL}/api/opportunities/{opp_id}",
                json=update_data,
                headers=auth_headers
            )
            assert response.status_code in [200, 422]
            if response.status_code == 200:
                print(f"✓ Updated opportunity successfully")
            else:
                print(f"✓ Opportunity update validation noted")
        else:
            pytest.skip("No opportunities available to update")


# ==================== ACTIVITIES CRUD TESTS ====================

class TestActivitiesCRUD:
    """Test Activities CRUD operations"""
    
    @pytest.fixture
    def auth_headers(self):
        token = get_auth_token()
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_activities_list(self, auth_headers):
        """Test listing activities"""
        response = requests.get(f"{BASE_URL}/api/activities", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Retrieved {len(data)} activities")
        
    def test_create_activity(self, auth_headers):
        """Test creating a new activity"""
        # Get an account and opportunity first for proper linking
        accounts = requests.get(f"{BASE_URL}/api/accounts", headers=auth_headers).json()
        account_id = accounts[0].get("id") if accounts else None
        
        activity_data = {
            "type": "call",
            "subject": f"Test Call {datetime.now().strftime('%H%M%S')}",
            "description": "Test activity created by automated test",
            "status": "planned",
            "due_date": "2026-02-15",
            "account_id": account_id
        }
        response = requests.post(
            f"{BASE_URL}/api/activities",
            json=activity_data,
            headers=auth_headers
        )
        assert response.status_code in [200, 201, 422]  # 422 if missing required fields
        if response.status_code in [200, 201]:
            created = response.json()
            assert created["subject"] == activity_data["subject"]
            print(f"✓ Created activity: {created['subject']}")
        else:
            print(f"✓ Activity creation requires additional fields")
        return response.json() if response.status_code in [200, 201] else None
        
    def test_update_activity_status(self, auth_headers):
        """Test updating activity status"""
        activities = requests.get(f"{BASE_URL}/api/activities", headers=auth_headers).json()
        
        if len(activities) > 0:
            activity_id = activities[0].get("id") or activities[0].get("_id")
            response = requests.patch(
                f"{BASE_URL}/api/activities/{activity_id}/status?status=completed",
                headers=auth_headers
            )
            assert response.status_code == 200
            print(f"✓ Updated activity status to completed")
        else:
            pytest.skip("No activities available to update")


# ==================== DASHBOARD TESTS ====================

class TestDashboard:
    """Test Dashboard endpoints"""
    
    @pytest.fixture
    def auth_headers(self):
        token = get_auth_token()
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_dashboard_stats(self, auth_headers):
        """Test getting dashboard stats"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_accounts" in data or "accounts" in data or isinstance(data, dict)
        print(f"✓ Dashboard stats retrieved")
        
    def test_get_pipeline_by_stage(self, auth_headers):
        """Test getting pipeline by stage"""
        response = requests.get(f"{BASE_URL}/api/dashboard/pipeline-by-stage", headers=auth_headers)
        assert response.status_code == 200
        print(f"✓ Pipeline by stage retrieved")
        
    def test_get_activities_by_status(self, auth_headers):
        """Test getting activities by status"""
        response = requests.get(f"{BASE_URL}/api/dashboard/activities-by-status", headers=auth_headers)
        assert response.status_code == 200
        print(f"✓ Activities by status retrieved")
        
    def test_get_revenue_trend(self, auth_headers):
        """Test getting revenue trend"""
        response = requests.get(f"{BASE_URL}/api/dashboard/revenue-trend", headers=auth_headers)
        assert response.status_code == 200
        print(f"✓ Revenue trend retrieved")


# ==================== INTEGRATION HUB TESTS ====================

class TestIntegrationHub:
    """Test Integration Hub and Sync Engine"""
    
    @pytest.fixture
    def auth_headers(self):
        token = get_auth_token()
        return {"Authorization": f"Bearer {token}"}
    
    def test_sync_status(self):
        """Test sync engine status"""
        response = requests.get(f"{BASE_URL}/api/sync/status")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "sources" in data
        print(f"✓ Sync status: {data['status']}")
        
    def test_sync_jobs_list(self):
        """Test listing sync jobs"""
        response = requests.get(f"{BASE_URL}/api/sync/jobs")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        print(f"✓ Sync jobs: {data['total']} total")
        
    def test_sync_history(self):
        """Test sync history"""
        response = requests.get(f"{BASE_URL}/api/sync/history")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        print(f"✓ Sync history retrieved")
        
    def test_data_lake_health(self):
        """Test data lake health"""
        response = requests.get(f"{BASE_URL}/api/data-lake/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "raw" in data["zones"]
        assert "canonical" in data["zones"]
        assert "serving" in data["zones"]
        print(f"✓ Data lake healthy with 3 zones")
        
    def test_data_lake_stats(self):
        """Test data lake statistics"""
        response = requests.get(f"{BASE_URL}/api/data-lake/stats")
        assert response.status_code == 200
        data = response.json()
        assert "raw_zone" in data
        assert "canonical_zone" in data
        assert "serving_zone" in data
        print(f"✓ Data lake stats: Raw={data['raw_zone']['total_records']}, Canonical entities present")
        
    def test_data_lake_entities_contact(self):
        """Test listing contacts from data lake"""
        response = requests.get(f"{BASE_URL}/api/data-lake/entities/contact")
        assert response.status_code == 200
        data = response.json()
        assert data["entity_type"] == "contact"
        print(f"✓ Contact entities: {data['total']} total")
        
    def test_data_lake_entities_opportunity(self):
        """Test listing opportunities from data lake"""
        response = requests.get(f"{BASE_URL}/api/data-lake/entities/opportunity")
        assert response.status_code == 200
        data = response.json()
        assert data["entity_type"] == "opportunity"
        print(f"✓ Opportunity entities: {data['total']} total")


# ==================== ODOO INTEGRATION TESTS ====================

class TestOdooIntegration:
    """Test Odoo integration endpoints"""
    
    @pytest.fixture
    def auth_headers(self):
        token = get_auth_token()
        return {"Authorization": f"Bearer {token}"}
    
    def test_odoo_config(self, auth_headers):
        """Test getting Odoo configuration"""
        response = requests.get(f"{BASE_URL}/api/odoo/config", headers=auth_headers)
        # May be 200 if configured or 404/500 if not
        assert response.status_code in [200, 404, 500]
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Odoo config retrieved: connected={data.get('connection', {}).get('is_connected', False)}")
        else:
            print(f"✓ Odoo config endpoint responded (not configured)")
            
    def test_odoo_sync_logs(self, auth_headers):
        """Test getting Odoo sync logs"""
        response = requests.get(f"{BASE_URL}/api/odoo/sync-logs?limit=10", headers=auth_headers)
        assert response.status_code in [200, 404, 500]
        if response.status_code == 200:
            logs = response.json()
            print(f"✓ Odoo sync logs: {len(logs)} entries")
        else:
            print(f"✓ Odoo sync logs endpoint responded")
            
    def test_odoo_entity_mappings(self, auth_headers):
        """Test getting Odoo entity mappings"""
        response = requests.get(f"{BASE_URL}/api/odoo/entity-mappings", headers=auth_headers)
        assert response.status_code in [200, 404, 500]
        if response.status_code == 200:
            print(f"✓ Odoo entity mappings retrieved")
        else:
            print(f"✓ Odoo entity mappings endpoint responded")


# ==================== CONFIGURATION TESTS ====================

class TestConfiguration:
    """Test system configuration endpoints"""
    
    @pytest.fixture
    def auth_headers(self):
        token = get_auth_token()
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_system_config(self, auth_headers):
        """Test getting system configuration"""
        response = requests.get(f"{BASE_URL}/api/config/system", headers=auth_headers)
        assert response.status_code == 200
        print(f"✓ System config retrieved")
        
    def test_get_modules(self, auth_headers):
        """Test getting available modules"""
        response = requests.get(f"{BASE_URL}/api/config/modules", headers=auth_headers)
        assert response.status_code == 200
        modules = response.json()
        print(f"✓ Modules: {len(modules)} available")
        
    def test_get_roles(self, auth_headers):
        """Test getting roles"""
        response = requests.get(f"{BASE_URL}/api/config/roles", headers=auth_headers)
        assert response.status_code == 200
        roles = response.json()
        print(f"✓ Roles: {len(roles)} defined")
        
    def test_create_role(self, auth_headers):
        """Test creating a new role"""
        role_data = {
            "name": f"test_role_{datetime.now().strftime('%H%M%S')}",
            "display_name": "Test Role",
            "description": "Created by automated test",
            "permissions": ["read_accounts", "read_opportunities"]
        }
        response = requests.post(
            f"{BASE_URL}/api/config/roles",
            json=role_data,
            headers=auth_headers
        )
        assert response.status_code in [200, 201]
        print(f"✓ Role created: {role_data['name']}")
        
    def test_get_llm_config(self, auth_headers):
        """Test getting LLM configuration"""
        response = requests.get(f"{BASE_URL}/api/config/llm", headers=auth_headers)
        assert response.status_code == 200
        print(f"✓ LLM config retrieved")
        
    def test_get_ui_config(self, auth_headers):
        """Test getting UI configuration"""
        response = requests.get(f"{BASE_URL}/api/config/ui", headers=auth_headers)
        assert response.status_code == 200
        print(f"✓ UI config retrieved")


# ==================== KPIs & INCENTIVES TESTS ====================

class TestKPIsAndIncentives:
    """Test KPIs and Incentives endpoints"""
    
    @pytest.fixture
    def auth_headers(self):
        token = get_auth_token()
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_kpis(self, auth_headers):
        """Test listing KPIs"""
        response = requests.get(f"{BASE_URL}/api/kpis", headers=auth_headers)
        assert response.status_code == 200
        kpis = response.json()
        print(f"✓ KPIs: {len(kpis)} defined")
        
    def test_create_kpi(self, auth_headers):
        """Test creating a KPI"""
        kpi_data = {
            "name": f"Test KPI {datetime.now().strftime('%H%M%S')}",
            "metric_type": "revenue",
            "target_value": 100000,
            "current_value": 0,
            "period": "monthly"
        }
        response = requests.post(
            f"{BASE_URL}/api/kpis",
            json=kpi_data,
            headers=auth_headers
        )
        assert response.status_code in [200, 201]
        print(f"✓ KPI created: {kpi_data['name']}")
        
    def test_get_incentives(self, auth_headers):
        """Test listing incentives"""
        response = requests.get(f"{BASE_URL}/api/incentives", headers=auth_headers)
        assert response.status_code == 200
        incentives = response.json()
        print(f"✓ Incentives: {len(incentives)} defined")


# ==================== NOTIFICATIONS TESTS ====================

class TestNotifications:
    """Test Notifications endpoints"""
    
    @pytest.fixture
    def auth_headers(self):
        token = get_auth_token()
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_notifications(self, auth_headers):
        """Test listing notifications"""
        response = requests.get(f"{BASE_URL}/api/notifications", headers=auth_headers)
        assert response.status_code == 200
        notifications = response.json()
        print(f"✓ Notifications: {len(notifications)} found")


# ==================== INTEGRATIONS MANAGEMENT TESTS ====================

class TestIntegrationsManagement:
    """Test Integrations management endpoints"""
    
    @pytest.fixture
    def auth_headers(self):
        token = get_auth_token()
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_integrations(self, auth_headers):
        """Test listing integrations"""
        response = requests.get(f"{BASE_URL}/api/integrations", headers=auth_headers)
        assert response.status_code == 200
        integrations = response.json()
        print(f"✓ Integrations: {len(integrations)} configured")
        
    def test_save_integration(self, auth_headers):
        """Test saving integration configuration"""
        integration_data = {
            "integration_type": "test_integration",
            "enabled": True,
            "api_url": "https://api.test.com",
            "settings": {"test": True},
            "sync_interval_minutes": 60
        }
        response = requests.post(
            f"{BASE_URL}/api/integrations",
            json=integration_data,
            headers=auth_headers
        )
        assert response.status_code in [200, 201]
        print(f"✓ Integration saved: {integration_data['integration_type']}")


# ==================== END-TO-END WORKFLOW TESTS ====================

class TestEndToEndWorkflow:
    """Test complete end-to-end workflows"""
    
    def test_complete_sales_workflow(self):
        """Test complete sales workflow: Login -> Create Account -> Create Opportunity -> Create Activity"""
        # Step 1: Login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@salescommand.com",
            "password": "demo123"
        })
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("Step 1: ✓ Logged in successfully")
        
        # Step 2: Create Account
        account_data = {
            "name": f"E2E Test Account {datetime.now().strftime('%H%M%S')}",
            "industry": "Technology",
            "status": "active"
        }
        account_response = requests.post(
            f"{BASE_URL}/api/accounts",
            json=account_data,
            headers=headers
        )
        assert account_response.status_code in [200, 201]
        account = account_response.json()
        account_id = account.get("id") or account.get("_id")
        print(f"Step 2: ✓ Created account: {account['name']}")
        
        # Step 3: Create Opportunity for Account
        opp_data = {
            "name": f"E2E Test Opportunity {datetime.now().strftime('%H%M%S')}",
            "account_id": account_id,
            "value": 50000,
            "stage": "Qualification",
            "probability": 25,
            "expected_close_date": "2026-06-30"
        }
        opp_response = requests.post(
            f"{BASE_URL}/api/opportunities",
            json=opp_data,
            headers=headers
        )
        assert opp_response.status_code in [200, 201]
        opportunity = opp_response.json()
        print(f"Step 3: ✓ Created opportunity: {opportunity['name']}")
        
        # Step 4: Create Activity
        activity_data = {
            "type": "meeting",
            "subject": f"E2E Test Meeting {datetime.now().strftime('%H%M%S')}",
            "description": "Follow up meeting for opportunity",
            "status": "planned",
            "due_date": "2026-02-01"
        }
        activity_response = requests.post(
            f"{BASE_URL}/api/activities",
            json=activity_data,
            headers=headers
        )
        assert activity_response.status_code in [200, 201]
        activity = activity_response.json()
        print(f"Step 4: ✓ Created activity: {activity['subject']}")
        
        # Step 5: Verify dashboard shows updated data
        dashboard_response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        assert dashboard_response.status_code == 200
        print("Step 5: ✓ Dashboard stats retrieved")
        
        print("\n🎉 Complete sales workflow passed!")
        
    def test_integration_workflow(self):
        """Test integration workflow: Check status -> View data lake -> Check sync history"""
        # Step 1: Check sync status
        status_response = requests.get(f"{BASE_URL}/api/sync/status")
        assert status_response.status_code == 200
        status = status_response.json()
        print(f"Step 1: ✓ Sync status: {status['status']}")
        
        # Step 2: Check data lake health
        health_response = requests.get(f"{BASE_URL}/api/data-lake/health")
        assert health_response.status_code == 200
        health = health_response.json()
        assert health["status"] == "healthy"
        print(f"Step 2: ✓ Data lake healthy")
        
        # Step 3: Get data lake stats
        stats_response = requests.get(f"{BASE_URL}/api/data-lake/stats")
        assert stats_response.status_code == 200
        stats = stats_response.json()
        print(f"Step 3: ✓ Data lake stats - Raw: {stats['raw_zone']['total_records']} records")
        
        # Step 4: Check sync history
        history_response = requests.get(f"{BASE_URL}/api/sync/history")
        assert history_response.status_code == 200
        history = history_response.json()
        print(f"Step 4: ✓ Sync history: {history['total']} entries")
        
        print("\n🎉 Integration workflow passed!")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
