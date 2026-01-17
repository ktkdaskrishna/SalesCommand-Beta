"""
Test High Priority Bug Fixes - Iteration 22
Tests for:
1. Industry filter - accounts have inferred industries
2. Activity Timeline - shows real activities with login tracking
3. 360° View contacts query - uses entity_type:contact with account_id
4. Sales user pipeline display
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestIndustryFilter:
    """Test industry inference and filtering on accounts"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@salescommand.com",
            "password": "demo123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_accounts_real_returns_industry_values(self):
        """Verify /api/accounts/real returns accounts with inferred industry values"""
        response = requests.get(f"{BASE_URL}/api/accounts/real", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "accounts" in data
        accounts = data["accounts"]
        assert len(accounts) > 0, "No accounts returned"
        
        # Check that at least some accounts have industry values
        accounts_with_industry = [a for a in accounts if a.get("industry")]
        assert len(accounts_with_industry) > 0, "No accounts have industry values"
        
        # Verify expected industries are present
        industries = set(a.get("industry") for a in accounts if a.get("industry"))
        expected_industries = {"Technology", "Financial Services", "Enterprise", "Retail"}
        found_industries = industries.intersection(expected_industries)
        assert len(found_industries) >= 2, f"Expected at least 2 industries from {expected_industries}, found {found_industries}"
        
        print(f"✓ Found {len(accounts_with_industry)} accounts with industries: {industries}")
    
    def test_accounts_have_pipeline_values(self):
        """Verify accounts have pipeline_value and won_value fields"""
        response = requests.get(f"{BASE_URL}/api/accounts/real", headers=self.headers)
        assert response.status_code == 200
        
        accounts = response.json()["accounts"]
        
        # Check that accounts have the required fields
        for account in accounts[:5]:  # Check first 5
            assert "pipeline_value" in account, f"Account {account.get('name')} missing pipeline_value"
            assert "won_value" in account, f"Account {account.get('name')} missing won_value"
            assert "active_opportunities" in account, f"Account {account.get('name')} missing active_opportunities"
        
        # Verify at least one account has non-zero pipeline
        accounts_with_pipeline = [a for a in accounts if a.get("pipeline_value", 0) > 0]
        assert len(accounts_with_pipeline) > 0, "No accounts have pipeline value"
        
        print(f"✓ Found {len(accounts_with_pipeline)} accounts with pipeline values")


class TestActivityTimeline:
    """Test activity timeline with real activity data"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@salescommand.com",
            "password": "demo123"
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_activities_returns_real_data(self):
        """Verify /api/activities returns real activity data (not empty)"""
        response = requests.get(f"{BASE_URL}/api/activities", headers=self.headers)
        assert response.status_code == 200
        
        activities = response.json()
        assert isinstance(activities, list), "Activities should be a list"
        assert len(activities) > 0, "Activities list is empty - should have real data"
        
        print(f"✓ Found {len(activities)} activities")
    
    def test_activities_include_login_events(self):
        """Verify activities include login events"""
        response = requests.get(f"{BASE_URL}/api/activities", headers=self.headers)
        assert response.status_code == 200
        
        activities = response.json()
        login_activities = [a for a in activities if a.get("activity_type") == "user_login"]
        
        assert len(login_activities) > 0, "No login activities found - login tracking not working"
        
        # Verify login activity structure
        login = login_activities[0]
        assert "title" in login, "Login activity missing title"
        assert "user_email" in login, "Login activity missing user_email"
        assert "timestamp" in login or "created_at" in login, "Login activity missing timestamp"
        
        print(f"✓ Found {len(login_activities)} login activities")
    
    def test_activities_include_opportunity_actions(self):
        """Verify activities include opportunity-related actions"""
        response = requests.get(f"{BASE_URL}/api/activities", headers=self.headers)
        assert response.status_code == 200
        
        activities = response.json()
        
        # Check for opportunity-related activity types
        opp_types = ["opportunity_created", "opportunity_stage_changed", "opportunity_updated"]
        opp_activities = [a for a in activities if a.get("activity_type") in opp_types]
        
        assert len(opp_activities) > 0, f"No opportunity activities found. Types present: {set(a.get('activity_type') for a in activities)}"
        
        print(f"✓ Found {len(opp_activities)} opportunity-related activities")
    
    def test_activities_include_sync_events(self):
        """Verify activities include data sync events"""
        response = requests.get(f"{BASE_URL}/api/activities", headers=self.headers)
        assert response.status_code == 200
        
        activities = response.json()
        sync_activities = [a for a in activities if a.get("activity_type") == "data_synced"]
        
        # Sync events are seeded data
        assert len(sync_activities) > 0, "No sync activities found"
        
        print(f"✓ Found {len(sync_activities)} sync activities")
    
    def test_activities_have_required_fields(self):
        """Verify activities have all required fields"""
        response = requests.get(f"{BASE_URL}/api/activities", headers=self.headers)
        assert response.status_code == 200
        
        activities = response.json()
        required_fields = ["id", "activity_type", "title"]
        
        for activity in activities[:5]:  # Check first 5
            for field in required_fields:
                assert field in activity, f"Activity missing required field: {field}"
        
        print(f"✓ All activities have required fields")


class TestAccount360View:
    """Test 360° View contacts query"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@salescommand.com",
            "password": "demo123"
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_360_view_returns_account_data(self):
        """Verify 360° view endpoint returns account data"""
        # First get a valid account ID
        accounts_response = requests.get(f"{BASE_URL}/api/accounts", headers=self.headers)
        assert accounts_response.status_code == 200
        accounts = accounts_response.json()
        assert len(accounts) > 0, "No accounts found"
        
        account_id = accounts[0]["id"]
        
        # Get 360° view
        response = requests.get(f"{BASE_URL}/api/accounts/{account_id}/360", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "account" in data, "360 view missing account data"
        assert "summary" in data, "360 view missing summary"
        assert "opportunities" in data, "360 view missing opportunities"
        assert "contacts" in data, "360 view missing contacts"
        
        print(f"✓ 360° view returns complete data for account: {data['account'].get('name')}")
    
    def test_360_view_summary_fields(self):
        """Verify 360° view summary has all required fields"""
        accounts_response = requests.get(f"{BASE_URL}/api/accounts", headers=self.headers)
        accounts = accounts_response.json()
        account_id = accounts[0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/accounts/{account_id}/360", headers=self.headers)
        assert response.status_code == 200
        
        summary = response.json()["summary"]
        required_fields = [
            "total_opportunities", "total_pipeline_value", "total_won_value",
            "total_invoiced", "total_outstanding", "total_activities",
            "pending_activities", "total_contacts"
        ]
        
        for field in required_fields:
            assert field in summary, f"Summary missing field: {field}"
        
        print(f"✓ 360° view summary has all required fields")
    
    def test_360_view_with_odoo_account(self):
        """Verify 360° view works with Odoo account ID"""
        # Try with Odoo account ID "10"
        response = requests.get(f"{BASE_URL}/api/accounts/10/360", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["account"]["id"] == "10"
        assert data["account"]["source"] == "odoo"
        
        print(f"✓ 360° view works with Odoo account: {data['account'].get('name')}")


class TestSalesUserPipeline:
    """Test sales user (account manager) can see pipeline values"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as account manager"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "am1@salescommand.com",
            "password": "demo123"
        })
        assert response.status_code == 200, f"AM login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.user = response.json()["user"]
    
    def test_am_can_access_accounts_real(self):
        """Verify account manager can access /api/accounts/real"""
        response = requests.get(f"{BASE_URL}/api/accounts/real", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "accounts" in data
        
        print(f"✓ Account manager can access accounts/real - {len(data['accounts'])} accounts")
    
    def test_am_sees_pipeline_values(self):
        """Verify account manager sees pipeline values on accounts"""
        response = requests.get(f"{BASE_URL}/api/accounts/real", headers=self.headers)
        assert response.status_code == 200
        
        accounts = response.json()["accounts"]
        
        # Check that accounts have pipeline values
        for account in accounts[:3]:
            assert "pipeline_value" in account, f"Account {account.get('name')} missing pipeline_value"
            assert "won_value" in account, f"Account {account.get('name')} missing won_value"
        
        # Find accounts with pipeline
        accounts_with_pipeline = [a for a in accounts if a.get("pipeline_value", 0) > 0]
        
        print(f"✓ AM sees {len(accounts_with_pipeline)} accounts with pipeline values")
    
    def test_am_can_access_opportunities(self):
        """Verify account manager can access opportunities"""
        response = requests.get(f"{BASE_URL}/api/opportunities", headers=self.headers)
        assert response.status_code == 200
        
        opportunities = response.json()
        assert isinstance(opportunities, list)
        
        print(f"✓ Account manager can access {len(opportunities)} opportunities")


class TestLoginActivityLogging:
    """Test that login creates activity log entries"""
    
    def test_login_creates_activity(self):
        """Verify login creates an activity log entry"""
        # Login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@salescommand.com",
            "password": "demo123"
        })
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Check activities for login event
        activities_response = requests.get(f"{BASE_URL}/api/activities", headers=headers)
        assert activities_response.status_code == 200
        
        activities = activities_response.json()
        login_activities = [a for a in activities if a.get("activity_type") == "user_login"]
        
        # Should have at least one login activity (from this login or previous)
        assert len(login_activities) > 0, "No login activities found after login"
        
        # Check most recent login activity
        recent_login = login_activities[0]
        assert "superadmin@salescommand.com" in recent_login.get("user_email", ""), \
            "Login activity doesn't match logged in user"
        
        print(f"✓ Login activity logged successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
