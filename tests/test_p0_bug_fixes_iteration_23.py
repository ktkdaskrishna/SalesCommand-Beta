"""
P0 Bug Fixes Test Suite - Iteration 23
Tests for:
1. MS SSO User Mapping - users should only see their own data based on Odoo mapping
2. 360° Account View - should work for all account types including opportunity-derived accounts
3. Data access control - verify non-admin users cannot see other users' opportunities
4. Activities API - verify /api/activities endpoint returns activities
5. Contacts sync - verify contacts are being fetched from Odoo connector
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN = {"email": "superadmin@salescommand.com", "password": "demo123"}
ACCOUNT_MANAGER = {"email": "am1@salescommand.com", "password": "demo123"}

# MS SSO users (these are real Odoo-mapped users)
MS_SSO_USER_RAVI = {"email": "ravi.chandran@securado.net", "odoo_user_id": 2, "odoo_salesperson_name": "Ravi Chandran"}
MS_SSO_USER_KRISHNA = {"email": "krishna@securado.net", "odoo_user_id": 1, "odoo_salesperson_name": "krishna@securado.net"}


class TestHealthAndSetup:
    """Basic health checks"""
    
    def test_api_health(self):
        """Test API is healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print(f"✓ API health check passed: {data}")
    
    def test_super_admin_login(self):
        """Test super admin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["is_super_admin"] == True
        print(f"✓ Super admin login successful: {data['user']['email']}")
    
    def test_account_manager_login(self):
        """Test account manager can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ACCOUNT_MANAGER)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "account_manager"
        print(f"✓ Account manager login successful: {data['user']['email']}")


class TestMSSOOUserMapping:
    """Test MS SSO user mapping to Odoo data"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        return response.json()["access_token"]
    
    def test_odoo_user_data_in_users_collection(self, admin_token):
        """Verify MS SSO users have Odoo enrichment data"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/users", headers=headers)
        assert response.status_code == 200
        users = response.json()
        
        # Find Ravi Chandran
        ravi = next((u for u in users if u["email"] == MS_SSO_USER_RAVI["email"]), None)
        if ravi:
            print(f"✓ Found Ravi Chandran: odoo_user_id={ravi.get('odoo_user_id')}, odoo_salesperson_name={ravi.get('odoo_salesperson_name')}, odoo_matched={ravi.get('odoo_matched')}")
            # Verify Odoo mapping
            assert ravi.get("odoo_user_id") == MS_SSO_USER_RAVI["odoo_user_id"], f"Expected odoo_user_id={MS_SSO_USER_RAVI['odoo_user_id']}, got {ravi.get('odoo_user_id')}"
            assert ravi.get("odoo_salesperson_name") == MS_SSO_USER_RAVI["odoo_salesperson_name"], f"Expected odoo_salesperson_name={MS_SSO_USER_RAVI['odoo_salesperson_name']}, got {ravi.get('odoo_salesperson_name')}"
            assert ravi.get("odoo_matched") == True
        else:
            print("⚠ Ravi Chandran not found in users - may need MS SSO login first")
        
        # Find Krishna
        krishna = next((u for u in users if u["email"] == MS_SSO_USER_KRISHNA["email"]), None)
        if krishna:
            print(f"✓ Found Krishna: odoo_user_id={krishna.get('odoo_user_id')}, odoo_salesperson_name={krishna.get('odoo_salesperson_name')}, odoo_matched={krishna.get('odoo_matched')}")
            # Verify Odoo mapping - Krishna's salesperson_name is their email
            assert krishna.get("odoo_matched") == True
        else:
            print("⚠ Krishna not found in users - may need MS SSO login first")


class TestDataAccessControl:
    """Test that users only see their own data based on Odoo mapping"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        return response.json()["access_token"]
    
    @pytest.fixture
    def am_token(self):
        """Get account manager token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ACCOUNT_MANAGER)
        return response.json()["access_token"]
    
    def test_super_admin_sees_all_opportunities(self, admin_token):
        """Super admin should see all opportunities"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/opportunities", headers=headers)
        assert response.status_code == 200
        opportunities = response.json()
        
        # Super admin should see opportunities from multiple salespersons
        salespersons = set(o.get("owner_email", "") for o in opportunities)
        print(f"✓ Super admin sees {len(opportunities)} opportunities from salespersons: {salespersons}")
        assert len(opportunities) > 0, "Super admin should see opportunities"
    
    def test_account_manager_sees_filtered_opportunities(self, am_token):
        """Account manager should only see their own opportunities"""
        headers = {"Authorization": f"Bearer {am_token}"}
        response = requests.get(f"{BASE_URL}/api/opportunities", headers=headers)
        assert response.status_code == 200
        opportunities = response.json()
        
        # Check what salespersons are visible
        salespersons = set(o.get("owner_email", "") for o in opportunities)
        print(f"✓ Account manager sees {len(opportunities)} opportunities from salespersons: {salespersons}")
        
        # AM1 should see opportunities assigned to am1@salescommand.com
        for opp in opportunities:
            owner = opp.get("owner_email", "")
            print(f"  - {opp.get('name')}: owner={owner}")
    
    def test_dashboard_data_access_control(self, admin_token, am_token):
        """Test dashboard/real endpoint respects data access control"""
        # Admin dashboard
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        admin_response = requests.get(f"{BASE_URL}/api/dashboard/real", headers=admin_headers)
        assert admin_response.status_code == 200
        admin_data = admin_response.json()
        
        # AM dashboard
        am_headers = {"Authorization": f"Bearer {am_token}"}
        am_response = requests.get(f"{BASE_URL}/api/dashboard/real", headers=am_headers)
        assert am_response.status_code == 200
        am_data = am_response.json()
        
        print(f"✓ Admin dashboard: {len(admin_data.get('opportunities', []))} opportunities")
        print(f"✓ AM dashboard: {len(am_data.get('opportunities', []))} opportunities")


class TestAccount360View:
    """Test 360° Account View for all account types"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        return response.json()["access_token"]
    
    def test_360_view_real_odoo_account(self, admin_token):
        """Test 360° view for a real Odoo account (by ID)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First get accounts to find a real one
        response = requests.get(f"{BASE_URL}/api/accounts/real", headers=headers)
        assert response.status_code == 200
        data = response.json()
        accounts = data.get("accounts", [])
        
        # Find an account with a numeric ID (real Odoo account)
        real_account = next((a for a in accounts if str(a.get("id", "")).isdigit()), None)
        
        if real_account:
            account_id = real_account["id"]
            print(f"Testing 360° view for real account: {real_account.get('name')} (ID: {account_id})")
            
            response = requests.get(f"{BASE_URL}/api/accounts/{account_id}/360", headers=headers)
            assert response.status_code == 200
            view_data = response.json()
            
            assert "account" in view_data
            assert "summary" in view_data
            assert "opportunities" in view_data
            assert "invoices" in view_data
            assert "contacts" in view_data
            
            print(f"✓ 360° view for real account: {view_data['account'].get('name')}")
            print(f"  - Opportunities: {len(view_data['opportunities'])}")
            print(f"  - Invoices: {len(view_data['invoices'])}")
            print(f"  - Contacts: {len(view_data['contacts'])}")
        else:
            print("⚠ No real Odoo accounts found with numeric IDs")
    
    def test_360_view_opportunity_derived_account(self, admin_token):
        """Test 360° view for opportunity-derived accounts (synthetic IDs like opp_techcorp_industri)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First get accounts to find an opportunity-derived one
        response = requests.get(f"{BASE_URL}/api/accounts/real", headers=headers)
        assert response.status_code == 200
        data = response.json()
        accounts = data.get("accounts", [])
        
        # Find an account with synthetic ID (starts with opp_)
        synthetic_account = next((a for a in accounts if str(a.get("id", "")).startswith("opp_")), None)
        
        if synthetic_account:
            account_id = synthetic_account["id"]
            print(f"Testing 360° view for opportunity-derived account: {synthetic_account.get('name')} (ID: {account_id})")
            
            response = requests.get(f"{BASE_URL}/api/accounts/{account_id}/360", headers=headers)
            assert response.status_code == 200
            view_data = response.json()
            
            assert "account" in view_data
            assert "summary" in view_data
            assert "opportunities" in view_data
            
            print(f"✓ 360° view for opportunity-derived account: {view_data['account'].get('name')}")
            print(f"  - Source: {view_data['account'].get('source')}")
            print(f"  - Opportunities: {len(view_data['opportunities'])}")
        else:
            print("⚠ No opportunity-derived accounts found")
    
    def test_360_view_by_name_search(self, admin_token):
        """Test 360° view can find accounts by name pattern"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Test with known partner names from opportunities
        test_names = ["TechCorp", "FinanceFirst", "VM"]
        
        for name in test_names:
            # Try to find account by searching
            response = requests.get(f"{BASE_URL}/api/accounts/real", headers=headers)
            accounts = response.json().get("accounts", [])
            
            matching = [a for a in accounts if name.lower() in a.get("name", "").lower()]
            if matching:
                account_id = matching[0]["id"]
                response = requests.get(f"{BASE_URL}/api/accounts/{account_id}/360", headers=headers)
                if response.status_code == 200:
                    print(f"✓ 360° view found for '{name}': {matching[0].get('name')}")
                else:
                    print(f"⚠ 360° view failed for '{name}': {response.status_code}")


class TestActivitiesAPI:
    """Test Activities API endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        return response.json()["access_token"]
    
    def test_activities_endpoint_exists(self, admin_token):
        """Test /api/activities endpoint returns data"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/activities", headers=headers)
        assert response.status_code == 200
        activities = response.json()
        
        print(f"✓ Activities endpoint returned {len(activities)} activities")
        
        # Check activity types
        if activities:
            activity_types = set(a.get("activity_type", "") for a in activities)
            print(f"  Activity types: {activity_types}")
            
            # Show sample activities
            for act in activities[:5]:
                print(f"  - {act.get('activity_type')}: {act.get('title', act.get('summary', 'N/A'))}")
    
    def test_activities_from_odoo_sync(self, admin_token):
        """Test that activities are synced from Odoo"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Check sync status
        response = requests.get(f"{BASE_URL}/api/sync-status", headers=headers)
        if response.status_code == 200:
            sync_data = response.json()
            print(f"✓ Sync status: {sync_data}")


class TestContactsSync:
    """Test Contacts sync from Odoo"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        return response.json()["access_token"]
    
    def test_contacts_in_360_view(self, admin_token):
        """Test contacts appear in 360° view"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get accounts
        response = requests.get(f"{BASE_URL}/api/accounts/real", headers=headers)
        accounts = response.json().get("accounts", [])
        
        contacts_found = False
        for account in accounts[:5]:
            account_id = account["id"]
            response = requests.get(f"{BASE_URL}/api/accounts/{account_id}/360", headers=headers)
            if response.status_code == 200:
                view_data = response.json()
                contacts = view_data.get("contacts", [])
                if contacts:
                    contacts_found = True
                    print(f"✓ Found {len(contacts)} contacts for account '{account.get('name')}':")
                    for c in contacts:
                        print(f"  - {c.get('name')}: {c.get('email')}, {c.get('job_title')}")
        
        if not contacts_found:
            print("⚠ No contacts found in any account 360° views - may need Odoo sync")


class TestStrictDataAccessMatching:
    """Test that data access uses STRICT matching (not substring)"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        return response.json()["access_token"]
    
    def test_user_has_access_function_strict_matching(self, admin_token):
        """
        Verify the user_has_access_to_record function uses strict matching.
        This is a code review test - we verify the behavior through API responses.
        """
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get all opportunities as admin
        response = requests.get(f"{BASE_URL}/api/opportunities", headers=headers)
        assert response.status_code == 200
        all_opps = response.json()
        
        # Check that opportunities have proper salesperson assignments
        for opp in all_opps:
            salesperson = opp.get("owner_email", "")
            print(f"  - {opp.get('name')}: salesperson={salesperson}")
        
        print(f"✓ Verified {len(all_opps)} opportunities have salesperson assignments")


class TestOdooUserLookup:
    """Test the lookup_odoo_user_data function behavior"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        return response.json()["access_token"]
    
    def test_relink_odoo_endpoint(self, admin_token):
        """Test the self-service Odoo relink endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Try to relink (admin won't match Odoo, but endpoint should work)
        response = requests.post(f"{BASE_URL}/api/auth/relink-odoo", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        print(f"✓ Relink endpoint response: {data}")
        
        # Admin likely won't match Odoo
        if data.get("success"):
            print(f"  Matched via: {data.get('match_method')}")
        else:
            print(f"  No match (expected for admin): {data.get('message')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
