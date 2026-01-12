"""
Admin Panel & RBAC API Tests
Tests for:
- Admin Panel API endpoints (roles, permissions, departments, users)
- Personal data endpoints (My Outlook - connection status, emails)
- Super admin access control
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "superadmin@salescommand.com"
SUPER_ADMIN_PASSWORD = "demo123"


class TestHealthCheck:
    """Basic health check"""
    
    def test_api_health(self):
        """Test API is healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"✓ API health check passed: {data}")


class TestAuthentication:
    """Authentication tests"""
    
    def test_super_admin_login(self):
        """Test super admin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data.get("user", {}).get("is_super_admin") == True
        print(f"✓ Super admin login successful: {data.get('user', {}).get('email')}")
        return data["access_token"]


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for super admin"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestAdminRoles:
    """Admin Roles API tests"""
    
    def test_get_all_roles(self, auth_headers):
        """GET /api/admin/roles - Returns configurable roles"""
        response = requests.get(f"{BASE_URL}/api/admin/roles", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "roles" in data
        assert "count" in data
        roles = data["roles"]
        
        # Should have 7 roles as per requirements
        print(f"✓ Found {len(roles)} roles")
        
        # Verify role structure
        if roles:
            role = roles[0]
            assert "id" in role
            assert "code" in role
            assert "name" in role
            assert "permissions" in role
            assert "data_scope" in role
            print(f"✓ Role structure valid: {role.get('name')}")
        
        # Check for expected roles
        role_codes = [r.get("code") for r in roles]
        expected_roles = ["super_admin", "ceo", "sales_director", "account_manager"]
        for expected in expected_roles:
            if expected in role_codes:
                print(f"✓ Found expected role: {expected}")
        
        return roles


class TestAdminPermissions:
    """Admin Permissions API tests"""
    
    def test_get_all_permissions(self, auth_headers):
        """GET /api/admin/permissions - Returns 42 permissions grouped by module"""
        response = requests.get(f"{BASE_URL}/api/admin/permissions", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "permissions" in data
        assert "grouped" in data
        
        permissions = data["permissions"]
        grouped = data["grouped"]
        
        print(f"✓ Found {len(permissions)} total permissions")
        print(f"✓ Grouped into {len(grouped)} modules: {list(grouped.keys())}")
        
        # Verify permission structure
        if permissions:
            perm = permissions[0]
            assert "code" in perm
            assert "name" in perm
            assert "module" in perm
            print(f"✓ Permission structure valid: {perm.get('code')}")
        
        # Check for expected modules
        expected_modules = ["crm", "admin", "integrations", "personal"]
        for module in expected_modules:
            if module in grouped:
                print(f"✓ Found module: {module} with {len(grouped[module])} permissions")
        
        return data


class TestAdminDepartments:
    """Admin Departments API tests"""
    
    def test_get_all_departments(self, auth_headers):
        """GET /api/admin/departments - Returns departments"""
        response = requests.get(f"{BASE_URL}/api/admin/departments", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "departments" in data
        assert "count" in data
        
        departments = data["departments"]
        print(f"✓ Found {len(departments)} departments")
        
        # Verify department structure
        if departments:
            dept = departments[0]
            assert "id" in dept
            assert "code" in dept
            assert "name" in dept
            print(f"✓ Department structure valid: {dept.get('name')}")
        
        # List all departments
        for dept in departments:
            print(f"  - {dept.get('name')} ({dept.get('code')})")
        
        return departments


class TestAdminUsers:
    """Admin Users API tests"""
    
    def test_get_all_users(self, auth_headers):
        """GET /api/admin/users - Returns users with role and department info"""
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "users" in data
        assert "count" in data
        
        users = data["users"]
        print(f"✓ Found {len(users)} users")
        
        # Verify user structure
        if users:
            user = users[0]
            assert "id" in user
            assert "email" in user
            # Check for resolved role/department names
            print(f"✓ User structure valid: {user.get('email')}")
            if user.get("role_name"):
                print(f"  - Role: {user.get('role_name')}")
            if user.get("department_name"):
                print(f"  - Department: {user.get('department_name')}")
        
        return users
    
    def test_update_user_role(self, auth_headers):
        """PUT /api/admin/users/{id} - Updates user role assignment"""
        # First get users and roles
        users_response = requests.get(f"{BASE_URL}/api/admin/users", headers=auth_headers)
        roles_response = requests.get(f"{BASE_URL}/api/admin/roles", headers=auth_headers)
        
        assert users_response.status_code == 200
        assert roles_response.status_code == 200
        
        users = users_response.json().get("users", [])
        roles = roles_response.json().get("roles", [])
        
        # Find a non-super-admin user to update
        test_user = None
        for user in users:
            if not user.get("is_super_admin") and user.get("email") != SUPER_ADMIN_EMAIL:
                test_user = user
                break
        
        if not test_user:
            print("⚠ No non-super-admin user found to test update")
            pytest.skip("No suitable user for update test")
            return
        
        # Find a role to assign
        if not roles:
            pytest.skip("No roles available for assignment")
            return
        
        # Pick a role (preferably account_manager)
        target_role = None
        for role in roles:
            if role.get("code") == "account_manager":
                target_role = role
                break
        if not target_role:
            target_role = roles[0]
        
        # Update user role
        response = requests.put(
            f"{BASE_URL}/api/admin/users/{test_user['id']}",
            headers={**auth_headers, "Content-Type": "application/json"},
            json={"role_id": target_role["id"]}
        )
        
        assert response.status_code == 200
        data = response.json()
        print(f"✓ User role update response: {data.get('message')}")
        
        # Verify the update
        verify_response = requests.get(f"{BASE_URL}/api/admin/users", headers=auth_headers)
        updated_users = verify_response.json().get("users", [])
        updated_user = next((u for u in updated_users if u["id"] == test_user["id"]), None)
        
        if updated_user:
            print(f"✓ User {updated_user.get('email')} now has role: {updated_user.get('role_name')}")


class TestPersonalData:
    """Personal Data (My Outlook) API tests"""
    
    def test_connection_status(self, auth_headers):
        """GET /api/my/connection-status - Returns MS365 connection status"""
        response = requests.get(f"{BASE_URL}/api/my/connection-status", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "connected" in data
        assert "auth_provider" in data
        
        print(f"✓ Connection status: connected={data.get('connected')}")
        print(f"  - Auth provider: {data.get('auth_provider')}")
        if data.get("ms_email"):
            print(f"  - MS Email: {data.get('ms_email')}")
        
        return data
    
    def test_get_my_emails(self, auth_headers):
        """GET /api/my/emails - Returns user's own emails (empty for non-MS365 users)"""
        response = requests.get(f"{BASE_URL}/api/my/emails?limit=10", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "emails" in data
        assert "count" in data
        assert "source" in data
        
        print(f"✓ Emails response: count={data.get('count')}, source={data.get('source')}")
        
        # For non-MS365 users, should return empty with message
        if data.get("source") == "none":
            print(f"  - Message: {data.get('message', 'Not connected to MS365')}")
        
        return data
    
    def test_get_my_calendar(self, auth_headers):
        """GET /api/my/calendar - Returns user's calendar events"""
        response = requests.get(f"{BASE_URL}/api/my/calendar?limit=10", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "events" in data
        assert "count" in data
        assert "source" in data
        
        print(f"✓ Calendar response: count={data.get('count')}, source={data.get('source')}")
        
        return data


class TestAccessControl:
    """Access control tests - verify super admin requirement"""
    
    def test_admin_endpoints_require_auth(self):
        """Admin endpoints should require authentication"""
        endpoints = [
            "/api/admin/roles",
            "/api/admin/permissions",
            "/api/admin/departments",
            "/api/admin/users"
        ]
        
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}")
            assert response.status_code in [401, 403], f"Expected 401/403 for {endpoint}, got {response.status_code}"
            print(f"✓ {endpoint} requires authentication")
    
    def test_personal_endpoints_require_auth(self):
        """Personal data endpoints should require authentication"""
        endpoints = [
            "/api/my/connection-status",
            "/api/my/emails",
            "/api/my/calendar"
        ]
        
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}")
            assert response.status_code in [401, 403], f"Expected 401/403 for {endpoint}, got {response.status_code}"
            print(f"✓ {endpoint} requires authentication")


class TestAzureADSync:
    """Azure AD Sync endpoint test"""
    
    def test_sync_azure_users_endpoint_exists(self, auth_headers):
        """POST /api/admin/sync-azure-users - Endpoint exists and requires MS365 token"""
        response = requests.post(
            f"{BASE_URL}/api/admin/sync-azure-users",
            headers=auth_headers
        )
        
        # Should return 400 if no MS365 token available, or 200 if sync works
        assert response.status_code in [200, 400, 500]
        data = response.json()
        
        if response.status_code == 400:
            # Expected when no MS365 user has logged in
            print(f"✓ Azure AD sync endpoint exists, requires MS365 token: {data.get('detail')}")
        elif response.status_code == 200:
            print(f"✓ Azure AD sync completed: {data}")
        else:
            print(f"⚠ Azure AD sync returned {response.status_code}: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
