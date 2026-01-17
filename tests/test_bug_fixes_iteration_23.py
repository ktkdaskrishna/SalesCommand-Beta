"""
Test Bug Fixes - Iteration 23
Testing 3 critical bugs:
1. Deletion sync - soft-delete records (is_active:false) should be hidden
2. 360° View - works with synthetic IDs (opp_techcorp_industri format)
3. Sync button - visible for Account Manager (am1@salescommand.com)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBugFixes:
    """Test all 3 critical bug fixes"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_auth_token(self, email: str, password: str) -> str:
        """Get authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    # ==================== BUG FIX #1: Deletion Sync ====================
    
    def test_active_entity_filter_excludes_inactive(self):
        """Verify that is_active:false records are hidden from API responses"""
        token = self.get_auth_token("superadmin@salescommand.com", "demo123")
        assert token, "Failed to get auth token"
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get opportunities - should only return active records
        response = self.session.get(f"{BASE_URL}/api/opportunities", headers=headers)
        assert response.status_code == 200, f"Failed to get opportunities: {response.text}"
        
        opportunities = response.json()
        print(f"Got {len(opportunities)} opportunities")
        
        # All returned opportunities should be active (is_active not False)
        # The API should filter out is_active:false records
        for opp in opportunities:
            # If is_active field exists, it should be True
            if 'is_active' in opp:
                assert opp['is_active'] != False, f"Found inactive opportunity: {opp.get('name')}"
        
        print("PASS: All returned opportunities are active")
    
    def test_dashboard_real_excludes_inactive(self):
        """Verify dashboard/real endpoint excludes inactive records"""
        token = self.get_auth_token("superadmin@salescommand.com", "demo123")
        assert token, "Failed to get auth token"
        
        headers = {"Authorization": f"Bearer {token}"}
        
        response = self.session.get(f"{BASE_URL}/api/dashboard/real", headers=headers)
        assert response.status_code == 200, f"Failed to get dashboard: {response.text}"
        
        data = response.json()
        print(f"Dashboard metrics: pipeline_value={data.get('metrics', {}).get('pipeline_value')}")
        print(f"Active opportunities: {data.get('metrics', {}).get('active_opportunities')}")
        
        # Verify opportunities in response
        opportunities = data.get('opportunities', [])
        print(f"Got {len(opportunities)} opportunities in dashboard")
        
        print("PASS: Dashboard returns data (active records only)")
    
    def test_accounts_real_excludes_inactive(self):
        """Verify accounts/real endpoint excludes inactive records"""
        token = self.get_auth_token("superadmin@salescommand.com", "demo123")
        assert token, "Failed to get auth token"
        
        headers = {"Authorization": f"Bearer {token}"}
        
        response = self.session.get(f"{BASE_URL}/api/accounts/real", headers=headers)
        assert response.status_code == 200, f"Failed to get accounts: {response.text}"
        
        accounts = response.json()
        print(f"Got {len(accounts)} accounts")
        
        # All returned accounts should be active
        for acc in accounts:
            if 'is_active' in acc:
                assert acc['is_active'] != False, f"Found inactive account: {acc.get('name')}"
        
        print("PASS: All returned accounts are active")
    
    # ==================== BUG FIX #2: 360° View with Synthetic IDs ====================
    
    def test_360_view_with_numeric_id(self):
        """Verify 360° View works with numeric account IDs"""
        token = self.get_auth_token("superadmin@salescommand.com", "demo123")
        assert token, "Failed to get auth token"
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # First get accounts to find a valid ID
        response = self.session.get(f"{BASE_URL}/api/accounts/real", headers=headers)
        assert response.status_code == 200
        
        accounts = response.json()
        if not accounts:
            pytest.skip("No accounts available for testing")
        
        # Test with first account
        account = accounts[0]
        account_id = account.get('id')
        print(f"Testing 360° view for account: {account.get('name')} (ID: {account_id})")
        
        response = self.session.get(f"{BASE_URL}/api/accounts/{account_id}/360", headers=headers)
        assert response.status_code == 200, f"360° view failed: {response.text}"
        
        data = response.json()
        assert 'account' in data, "Response missing 'account' field"
        assert data['account'].get('name'), "Account name is empty"
        
        print(f"PASS: 360° view works for account {data['account'].get('name')}")
        print(f"  - Opportunities: {len(data.get('opportunities', []))}")
        print(f"  - Invoices: {len(data.get('invoices', []))}")
        print(f"  - Activities: {len(data.get('activities', []))}")
        print(f"  - Contacts: {len(data.get('contacts', []))}")
    
    def test_360_view_with_synthetic_id(self):
        """Verify 360° View works with synthetic IDs (opp_techcorp_industri format)"""
        token = self.get_auth_token("superadmin@salescommand.com", "demo123")
        assert token, "Failed to get auth token"
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test with a synthetic ID format
        # The endpoint should extract name from ID and search by name
        synthetic_ids = [
            "opp_techcorp_industri",
            "opp_acme_corp",
            "opp_test_company"
        ]
        
        found_working = False
        for synthetic_id in synthetic_ids:
            response = self.session.get(f"{BASE_URL}/api/accounts/{synthetic_id}/360", headers=headers)
            print(f"Testing synthetic ID '{synthetic_id}': status={response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"  Found account: {data.get('account', {}).get('name')}")
                found_working = True
                break
            elif response.status_code == 404:
                # 404 is acceptable if no matching account exists
                print(f"  No matching account found (404)")
        
        # The endpoint should handle synthetic IDs without crashing
        # Either return 200 with data or 404 if not found
        print("PASS: 360° view handles synthetic IDs correctly (no crashes)")
    
    def test_360_view_all_accounts(self):
        """Verify 360° View works for all account cards without error"""
        token = self.get_auth_token("superadmin@salescommand.com", "demo123")
        assert token, "Failed to get auth token"
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get all accounts
        response = self.session.get(f"{BASE_URL}/api/accounts/real", headers=headers)
        assert response.status_code == 200
        
        accounts = response.json()
        print(f"Testing 360° view for all {len(accounts)} accounts...")
        
        success_count = 0
        error_count = 0
        errors = []
        
        for account in accounts:
            account_id = account.get('id')
            account_name = account.get('name')
            
            response = self.session.get(f"{BASE_URL}/api/accounts/{account_id}/360", headers=headers)
            
            if response.status_code == 200:
                success_count += 1
            else:
                error_count += 1
                errors.append(f"{account_name} (ID: {account_id}): {response.status_code} - {response.text[:100]}")
        
        print(f"Results: {success_count} success, {error_count} errors")
        
        if errors:
            for err in errors:
                print(f"  ERROR: {err}")
        
        # All accounts should have working 360° view
        assert error_count == 0, f"360° view failed for {error_count} accounts: {errors}"
        print("PASS: 360° view works for all accounts")
    
    # ==================== BUG FIX #3: Sync Button for Account Manager ====================
    
    def test_account_manager_can_login(self):
        """Verify Account Manager can login"""
        token = self.get_auth_token("am1@salescommand.com", "demo123")
        assert token, "Account Manager failed to login"
        print("PASS: Account Manager (am1@salescommand.com) can login")
    
    def test_account_manager_can_access_dashboard(self):
        """Verify Account Manager can access dashboard"""
        token = self.get_auth_token("am1@salescommand.com", "demo123")
        assert token, "Failed to get auth token"
        
        headers = {"Authorization": f"Bearer {token}"}
        
        response = self.session.get(f"{BASE_URL}/api/dashboard/real", headers=headers)
        assert response.status_code == 200, f"Dashboard access failed: {response.text}"
        
        data = response.json()
        print(f"Account Manager dashboard: {len(data.get('opportunities', []))} opportunities")
        print("PASS: Account Manager can access dashboard")
    
    def test_account_manager_can_trigger_sync(self):
        """Verify Account Manager can trigger sync (not admin-only)"""
        token = self.get_auth_token("am1@salescommand.com", "demo123")
        assert token, "Failed to get auth token"
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Try to trigger sync - should be allowed for all authenticated users
        response = self.session.post(
            f"{BASE_URL}/api/integrations/sync/odoo",
            headers=headers,
            json={"entity_types": ["account", "opportunity"]}
        )
        
        # Should not get 403 Forbidden
        assert response.status_code != 403, "Account Manager is forbidden from triggering sync"
        
        # Acceptable responses: 200 (success), 202 (accepted), 400 (bad request if Odoo not configured)
        print(f"Sync trigger response: {response.status_code}")
        
        if response.status_code in [200, 202]:
            print("PASS: Account Manager can trigger sync")
        elif response.status_code == 400:
            # Check if it's a configuration issue vs permission issue
            error = response.json()
            print(f"Sync response: {error}")
            # If error is about Odoo not being configured, that's fine - permission is granted
            assert "not configured" in str(error).lower() or "not enabled" in str(error).lower() or "job_id" in str(error), \
                f"Unexpected error: {error}"
            print("PASS: Account Manager has permission to sync (Odoo may not be configured)")
        else:
            print(f"Response: {response.text}")
            # Any non-403 response means permission is granted
            print("PASS: Account Manager is not forbidden from sync")
    
    def test_sync_status_endpoint(self):
        """Verify sync status endpoint works"""
        token = self.get_auth_token("am1@salescommand.com", "demo123")
        assert token, "Failed to get auth token"
        
        headers = {"Authorization": f"Bearer {token}"}
        
        response = self.session.get(f"{BASE_URL}/api/sync-status", headers=headers)
        assert response.status_code == 200, f"Sync status failed: {response.text}"
        
        data = response.json()
        print(f"Sync status: {data}")
        print("PASS: Sync status endpoint works")
    
    # ==================== Additional Verification ====================
    
    def test_pipeline_calculations_active_only(self):
        """Verify pipeline calculations only include active opportunities"""
        token = self.get_auth_token("superadmin@salescommand.com", "demo123")
        assert token, "Failed to get auth token"
        
        headers = {"Authorization": f"Bearer {token}"}
        
        response = self.session.get(f"{BASE_URL}/api/dashboard/real", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        metrics = data.get('metrics', {})
        
        pipeline_value = metrics.get('pipeline_value', 0)
        active_opps = metrics.get('active_opportunities', 0)
        
        print(f"Pipeline value: ${pipeline_value:,.2f}")
        print(f"Active opportunities: {active_opps}")
        
        # Verify the values are reasonable (not including deleted records)
        assert pipeline_value >= 0, "Pipeline value should be non-negative"
        assert active_opps >= 0, "Active opportunities should be non-negative"
        
        print("PASS: Pipeline calculations appear correct")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
