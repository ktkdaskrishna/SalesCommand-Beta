#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timezone

class SalesCommandAPITester:
    def __init__(self, base_url="https://sales-intel-beta.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.user_id = None
        self.user_role = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Response: {response.text[:200]}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_seed_data(self):
        """Test seeding demo data"""
        print("\n" + "="*50)
        print("TESTING DEMO DATA SEEDING")
        print("="*50)
        
        success, response = self.run_test(
            "Seed Demo Data",
            "POST",
            "seed",
            200
        )
        return success

    def test_login(self, email="am1@salescommand.com", password="demo123"):
        """Test login and get token"""
        print("\n" + "="*50)
        print("TESTING AUTHENTICATION")
        print("="*50)
        
        success, response = self.run_test(
            "Login as Account Manager",
            "POST",
            "auth/login",
            200,
            data={"email": email, "password": password}
        )
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            self.user_role = response['user']['role']
            print(f"   Logged in as: {response['user']['name']} ({response['user']['role']})")
            return True
        return False

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        # Test get current user
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        
        # Test get users (admin only)
        if self.user_role in ['ceo', 'admin']:
            success, response = self.run_test(
                "Get All Users",
                "GET",
                "users",
                200
            )

    def test_accounts_endpoints(self):
        """Test accounts CRUD operations"""
        print("\n" + "="*50)
        print("TESTING ACCOUNTS ENDPOINTS")
        print("="*50)
        
        # Get accounts
        success, accounts = self.run_test(
            "Get Accounts",
            "GET",
            "accounts",
            200
        )
        
        # Create account
        account_data = {
            "name": "Test Account API",
            "industry": "Technology",
            "annual_revenue": 1000000,
            "employee_count": 100,
            "relationship_maturity": "new",
            "business_overview": "Test account for API testing"
        }
        
        success, response = self.run_test(
            "Create Account",
            "POST",
            "accounts",
            200,
            data=account_data
        )
        
        if success and 'id' in response:
            account_id = response['id']
            
            # Get specific account
            success, response = self.run_test(
                "Get Specific Account",
                "GET",
                f"accounts/{account_id}",
                200
            )
            
            # Update account
            account_data['name'] = "Updated Test Account"
            success, response = self.run_test(
                "Update Account",
                "PUT",
                f"accounts/{account_id}",
                200,
                data=account_data
            )
            
            return account_id
        
        return None

    def test_opportunities_endpoints(self, account_id=None):
        """Test opportunities CRUD operations"""
        print("\n" + "="*50)
        print("TESTING OPPORTUNITIES ENDPOINTS")
        print("="*50)
        
        # Get opportunities
        success, opportunities = self.run_test(
            "Get Opportunities",
            "GET",
            "opportunities",
            200
        )
        
        if account_id:
            # Create opportunity
            opp_data = {
                "name": "Test Opportunity API",
                "account_id": account_id,
                "value": 50000,
                "stage": "qualification",
                "probability": 25,
                "product_lines": ["MSSP"],
                "description": "Test opportunity for API testing"
            }
            
            success, response = self.run_test(
                "Create Opportunity",
                "POST",
                "opportunities",
                200,
                data=opp_data
            )
            
            if success and 'id' in response:
                opp_id = response['id']
                
                # Get specific opportunity
                success, response = self.run_test(
                    "Get Specific Opportunity",
                    "GET",
                    f"opportunities/{opp_id}",
                    200
                )
                
                # Update opportunity
                opp_data['stage'] = "discovery"
                opp_data['probability'] = 40
                success, response = self.run_test(
                    "Update Opportunity",
                    "PUT",
                    f"opportunities/{opp_id}",
                    200,
                    data=opp_data
                )
                
                return opp_id
        
        return None

    def test_activities_endpoints(self, account_id=None, opp_id=None):
        """Test activities CRUD operations"""
        print("\n" + "="*50)
        print("TESTING ACTIVITIES ENDPOINTS")
        print("="*50)
        
        # Get activities
        success, activities = self.run_test(
            "Get Activities",
            "GET",
            "activities",
            200
        )
        
        # Create activity
        activity_data = {
            "title": "Test Activity API",
            "description": "Test activity for API testing",
            "activity_type": "task",
            "priority": "medium",
            "status": "pending",
            "due_date": datetime.now(timezone.utc).isoformat()
        }
        
        if account_id:
            activity_data["account_id"] = account_id
        if opp_id:
            activity_data["opportunity_id"] = opp_id
        
        success, response = self.run_test(
            "Create Activity",
            "POST",
            "activities",
            200,
            data=activity_data
        )
        
        if success and 'id' in response:
            activity_id = response['id']
            
            # Update activity status
            success, response = self.run_test(
                "Update Activity Status",
                "PATCH",
                f"activities/{activity_id}/status?status=completed",
                200
            )
            
            return activity_id
        
        return None

    def test_kpis_endpoints(self):
        """Test KPIs endpoints"""
        print("\n" + "="*50)
        print("TESTING KPIs ENDPOINTS")
        print("="*50)
        
        # Get KPIs
        success, kpis = self.run_test(
            "Get KPIs",
            "GET",
            "kpis",
            200
        )
        
        # Create KPI (admin only)
        if self.user_role in ['ceo', 'admin']:
            kpi_data = {
                "name": "Test KPI API",
                "target_value": 100000,
                "current_value": 25000,
                "unit": "currency",
                "period": "monthly",
                "category": "sales"
            }
            
            success, response = self.run_test(
                "Create KPI",
                "POST",
                "kpis",
                200,
                data=kpi_data
            )
            
            if success and 'id' in response:
                kpi_id = response['id']
                
                # Update KPI
                kpi_data['current_value'] = 50000
                success, response = self.run_test(
                    "Update KPI",
                    "PUT",
                    f"kpis/{kpi_id}",
                    200,
                    data=kpi_data
                )

    def test_incentives_endpoints(self):
        """Test incentives endpoints"""
        print("\n" + "="*50)
        print("TESTING INCENTIVES ENDPOINTS")
        print("="*50)
        
        # Get incentives
        success, incentives = self.run_test(
            "Get Incentives",
            "GET",
            "incentives",
            200
        )
        
        # Create incentive (admin only)
        if self.user_role in ['ceo', 'admin']:
            incentive_data = {
                "user_id": self.user_id,
                "name": "Test Incentive API",
                "description": "Test incentive for API testing",
                "target_amount": 10000,
                "earned_amount": 2500,
                "period": "quarterly"
            }
            
            success, response = self.run_test(
                "Create Incentive",
                "POST",
                "incentives",
                200,
                data=incentive_data
            )

    def test_integrations_endpoints(self):
        """Test integrations endpoints"""
        print("\n" + "="*50)
        print("TESTING INTEGRATIONS ENDPOINTS")
        print("="*50)
        
        # Get integrations (admin only)
        if self.user_role in ['ceo', 'admin']:
            success, integrations = self.run_test(
                "Get Integrations",
                "GET",
                "integrations",
                200
            )
            
            # Create/Update integration
            integration_data = {
                "integration_type": "odoo",
                "enabled": False,
                "api_url": "https://test-odoo.com",
                "sync_interval_minutes": 60,
                "settings": {}
            }
            
            success, response = self.run_test(
                "Create/Update Integration",
                "POST",
                "integrations",
                200,
                data=integration_data
            )

    def test_dashboard_endpoints(self):
        """Test dashboard endpoints"""
        print("\n" + "="*50)
        print("TESTING DASHBOARD ENDPOINTS")
        print("="*50)
        
        # Get dashboard stats
        success, stats = self.run_test(
            "Get Dashboard Stats",
            "GET",
            "dashboard/stats",
            200
        )
        
        # Get pipeline by stage
        success, pipeline = self.run_test(
            "Get Pipeline by Stage",
            "GET",
            "dashboard/pipeline-by-stage",
            200
        )
        
        # Get activities by status
        success, activities = self.run_test(
            "Get Activities by Status",
            "GET",
            "dashboard/activities-by-status",
            200
        )
        
        # Get revenue trend
        success, revenue = self.run_test(
            "Get Revenue Trend",
            "GET",
            "dashboard/revenue-trend",
            200
        )

    def test_kanban_endpoints(self):
        """Test Kanban board endpoints"""
        print("\n" + "="*50)
        print("TESTING KANBAN BOARD ENDPOINTS")
        print("="*50)
        
        # Get opportunities kanban view
        success, kanban = self.run_test(
            "Get Opportunities Kanban View",
            "GET",
            "opportunities/kanban",
            200
        )
        
        if success:
            print(f"   Kanban data loaded successfully")
            if 'stages' in kanban:
                print(f"   Number of stages: {len(kanban['stages'])}")
            if 'kanban' in kanban:
                print(f"   Kanban columns: {list(kanban['kanban'].keys())}")

    def test_pipeline_stages(self):
        """Test pipeline stages endpoints"""
        print("\n" + "="*50)
        print("TESTING PIPELINE STAGES")
        print("="*50)
        
        # Get pipeline stages
        success, stages = self.run_test(
            "Get Pipeline Stages",
            "GET",
            "pipeline-stages",
            200
        )
        
        if success:
            print(f"   Pipeline stages loaded successfully")
            if isinstance(stages, list):
                print(f"   Number of stages: {len(stages)}")

    def test_commission_templates(self):
        """Test commission templates endpoints"""
        print("\n" + "="*50)
        print("TESTING COMMISSION TEMPLATES")
        print("="*50)
        
        # Get commission templates
        success, templates = self.run_test(
            "Get Commission Templates",
            "GET",
            "commission-templates",
            200
        )
        
        if success:
            print(f"   Commission templates loaded successfully")
            if isinstance(templates, list):
                print(f"   Number of templates: {len(templates)}")

    def test_incentive_calculator(self):
        """Test incentive calculator endpoint"""
        print("\n" + "="*50)
        print("TESTING INCENTIVE CALCULATOR")
        print("="*50)
        
        # Test incentive calculation
        success, result = self.run_test(
            "Calculate Incentive",
            "POST",
            "incentive-calculator?revenue=100000&quota=500000&is_new_logo=true",
            200
        )
        
        if success:
            print(f"   Incentive calculation successful")
            if 'final_commission' in result:
                print(f"   Final commission: ${result['final_commission']}")

    def test_sales_metrics(self):
        """Test sales metrics endpoint"""
        print("\n" + "="*50)
        print("TESTING SALES METRICS")
        print("="*50)
        
        # Get sales metrics for current user
        success, metrics = self.run_test(
            "Get Sales Metrics",
            "GET",
            f"sales-metrics/{self.user_id}",
            200
        )
        
        if success:
            print(f"   Sales metrics loaded successfully")

    def test_blue_sheet_probability(self, opp_id=None):
        """Test Blue Sheet probability calculation"""
        print("\n" + "="*50)
        print("TESTING BLUE SHEET PROBABILITY")
        print("="*50)
        
        if opp_id:
            # Test Blue Sheet probability calculation
            analysis_data = {
                "opportunity_id": opp_id,
                "economic_buyer_identified": True,
                "economic_buyer_favorable": True,
                "user_buyers_favorable": 2,
                "technical_buyers_favorable": 1,
                "coach_identified": True,
                "coach_engaged": True,
                "clear_business_results": True,
                "quantifiable_value": True
            }
            
            success, result = self.run_test(
                "Calculate Blue Sheet Probability",
                "POST",
                f"opportunities/{opp_id}/calculate-probability",
                200,
                data=analysis_data
            )
            
            if success:
                print(f"   Blue Sheet probability calculated successfully")
                if 'calculated_probability' in result:
                    print(f"   Calculated probability: {result['calculated_probability']}%")

    def test_ai_insights(self):
        """Test AI insights endpoint"""
        print("\n" + "="*50)
        print("TESTING AI INSIGHTS")
        print("="*50)
        
        success, insights = self.run_test(
            "Get AI Insights",
            "POST",
            "ai/insights",
            200
        )
        
        if success:
            print(f"   AI Insights generated successfully")
            if 'insights' in insights:
                print(f"   Number of insights: {len(insights['insights'])}")

def main():
    print("🚀 Starting SalesCommand Enterprise API Tests")
    print("=" * 60)
    
    tester = SalesCommandAPITester()
    
    # Test sequence
    try:
        # 1. Seed demo data
        if not tester.test_seed_data():
            print("⚠️  Demo data seeding failed, but continuing with tests...")
        
        # 2. Login
        if not tester.test_login():
            print("❌ Login failed, stopping tests")
            return 1
        
        # 3. Test authentication endpoints
        tester.test_auth_endpoints()
        
        # 4. Test accounts
        account_id = tester.test_accounts_endpoints()
        
        # 5. Test opportunities
        opp_id = tester.test_opportunities_endpoints(account_id)
        
        # 6. Test activities
        tester.test_activities_endpoints(account_id, opp_id)
        
        # 7. Test KPIs
        tester.test_kpis_endpoints()
        
        # 8. Test incentives
        tester.test_incentives_endpoints()
        
        # 9. Test integrations
        tester.test_integrations_endpoints()
        
        # 10. Test Kanban board
        tester.test_kanban_endpoints()
        
        # 11. Test pipeline stages
        tester.test_pipeline_stages()
        
        # 12. Test commission templates
        tester.test_commission_templates()
        
        # 13. Test incentive calculator
        tester.test_incentive_calculator()
        
        # 14. Test sales metrics
        tester.test_sales_metrics()
        
        # 15. Test Blue Sheet probability
        tester.test_blue_sheet_probability(opp_id)
        
        # 16. Test dashboard
        tester.test_dashboard_endpoints()
        
        # 17. Test AI insights
        tester.test_ai_insights()
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n\n❌ Unexpected error: {str(e)}")
        return 1
    
    # Print results
    print("\n" + "="*60)
    print("📊 TEST RESULTS")
    print("="*60)
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())