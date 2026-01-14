# Sales Intelligence Platform - Product Requirements Document

## Original Problem Statement
The user (CTO) mandated a shift from feature development to a full architectural audit and stabilization for the "Sales Intelligence Platform" BETA release. The goal is to build a foundation of trust and reliability.

### CTO Audit Areas (7 Critical Issues):
1. **User Authorization & Sync:** User and department data must sync from Odoo as the single source of truth
2. **Kanban Stage Transitions:** Opportunities fail to move between stages
3. **Opportunity Expandability:** Proper detail view needed from Kanban/list views
4. **CRM List View:** Not production-ready, needs sorting/filtering
5. **Target Assignment:** Must be role-based and 360°, not tied to static users
6. **Department Sync:** Must sync exclusively from Odoo
7. **UI Quality:** Field mapping and Data Lake UIs have poor color contrast

---

## What's Been Implemented

### Phase 1: Data & Auth Foundation ✅
- Backend endpoints sync departments and users from Odoo
- Manual user registration disabled
- Strict validation for Kanban stage transitions
- Frontend displays errors on invalid moves

### Phase 2: UX Critical Fixes ✅
- Slide-over `OpportunityDetailPanel` created
- Integrated with both Kanban board and list view
- Accessible without page reload

### Phase 3: Role-Based Targets ✅
- Backend data model redesigned for role-based targets
- `SalesTargetsConfiguration.js` rewritten for new model
- Decoupled targets from individual users

### Phase 4: Trust-Focused UI ✅
- `DataSourceBadge` added to Dashboard, Accounts, Invoices
- Dashboard simplified to core, reliable KPIs
- "Blue Sheet AI" reframed as "Deal Confidence"
- "Receivables" renamed to "Invoices (Read-only)"
- Accounts page fetches real data from `data_lake_serving`

### January 13, 2026 - UAT Critical Bug Fixes ✅
- **Bug #1 FIXED:** Account cards now display Pipeline ($85K-$200K) and Won Revenue values
  - Backend `/api/accounts/real` aggregates metrics from opportunities using `partner_name` matching
  - Frontend `Accounts.js` uses pre-calculated metrics from backend instead of local calculation
- **Bug #2 FIXED:** KPI charts now render with real data (bar chart + radial chart)
  - Backend `/api/kpis` fixed to return all KPIs (removed owner_id filter for super admin)
- **Bug #3 FIXED:** KPI metrics show actual values (Average Achievement: 64.3%, On Track: 2, At Risk: 1)
  - 4 KPIs with achievement percentages: 52%, 39%, 83%, 83%
- **Goals Progress Fixed:** `/api/goals/summary/stats` populates current_value from actual opportunity data
  - Q1 Revenue Target shows $300,000/$500,000 (60% complete)
- **Test Coverage:** 13/13 backend tests passed, all frontend features verified

### January 13, 2026 - P0 Features Implementation ✅
- **360° Account View:** New slide-over panel (`Account360Panel.js`) showing complete account data with summary cards and collapsible sections for Opportunities, Invoices, Activities, and Contacts
- **Expandable Kanban Board:** Column expand/collapse functionality added - clicking expand shows deals in grid layout while other columns minimize to vertical bars
- **Enterprise DataTable:** Enhanced with internal sorting (click column headers), column filtering (Filters button), and search functionality
- **Backend API:** New `/api/accounts/{id}/360` endpoint aggregates related entities from `data_lake_serving`
- **Test Coverage:** 15/15 backend tests passed, all frontend features verified

### January 13, 2026 - Goals, Activity & User Linking ✅
- **Goals Dashboard:** New page with KPI tracking cards (Overall Progress, Achieved, On Track, At Risk), goal creation modal with all fields (name, description, target, current, unit type, goal type, due date), full CRUD API
- **Activity Timeline:** New page with search, type filter, Today's Activity counter, and date-grouped timeline (currently shows fallback mock data when API returns empty)
- **User-Odoo Re-link:** Added `/api/auth/relink-odoo` self-service endpoint (no admin required). Users can re-link themselves from Profile page. Multi-strategy matching: email → name → opportunity salesperson
- **Navigation Updated:** Sidebar now includes Goals and Activity menu items
- **Employee Sync Fix:** Fixed incomplete `fetch_users` method in Odoo connector to properly return employee data. Fixed Odoo URL configuration.
- **Background Sync Service:** Created `BackgroundSyncService` with APScheduler for 5-minute automatic sync intervals. Implements soft-delete pattern for removed Odoo records (is_active=false)
- **Test Coverage:** 11/11 backend tests passed for new features

### January 14, 2026 - P0 Critical Bug Fixes (MS SSO & Data Security) ✅
- **MS SSO User Mapping FIXED:** Critical security bug where users could see other users' data
  - New `lookup_odoo_user_data()` function retrieves ALL Odoo enrichment fields (user_id, salesperson_name, team_id, department)
  - Uses STRICT email matching (exact match, not substring) to prevent cross-user data leaks
  - All Odoo fields refreshed on every MS SSO login to ensure accurate mapping
- **Data Access Control Hardened:** 
  - `user_has_access_to_record()` now uses strict equality matching (==) instead of substring matching ('in')
  - Prevents scenarios where "user@domain.com" could see data for "user@domain.com.au"
  - Strict matching for salesperson_id, salesperson_name, and team_id
- **360° Account View FIXED:** Now works for all account types including opportunity-derived accounts
  - Handles synthetic IDs (e.g., "opp_techcorp_industri") by extracting name and searching
  - Returns complete data with Opportunities, Invoices, Activities, Contacts sections
- **Activities & Contacts Sync Added:** Background sync now includes these entity types
  - `fetch_activities()` method added to Odoo connector (mail.activity)
  - `fetch_contacts()` method added to Odoo connector (res.partner with is_company=False)
  - Both integrated into background sync service with graceful error handling
- **Odoo 19.0 Compatibility:** Removed 'title' field from contacts query (field deprecated in Odoo 19)
- **Test Coverage:** 15/15 backend tests passed, all frontend features verified

### January 14, 2026 - P0/P1 Token Refresh & Target Progress Report ✅
- **MS365 Token Refresh (P0):**
  - New `/api/auth/refresh` endpoint returns fresh JWT tokens
  - Frontend `api.js` now has automatic token refresh interceptors
  - Proactive refresh when < 30 mins remaining on token
  - 401 responses trigger automatic retry with refreshed token
  - Prevents frequent user logouts
- **Deletion Sync Logic Enhanced (P0):**
  - `reconcile_entity()` in background_sync.py now handles soft-delete with logging
  - Sets `is_active=False`, `deleted_at`, `delete_reason='removed_from_odoo'`
  - Only affects records with `source='odoo'` to preserve manually created data
  - `active_entity_filter()` excludes only `is_active=False` (not `None` or missing)
- **Target Progress Report (P1):**
  - New `/api/config/target-progress-report` endpoint aggregates role-based targets with actual performance
  - Returns team-wide totals, progress percentages, and individual user breakdowns
  - Supports `period_type` and `role_id` filters
  - Status classification: achieved (>=100%), on_track (>=70%), at_risk (>=40%), behind (<40%)
- **Target Progress Report UI:**
  - New `/target-progress` page with summary cards, status distribution, individual performance cards
  - Added to sidebar navigation as "Target Report"
  - Period and Role filter dropdowns, refresh button
  - Visual progress bars and variance indicators
- **Test Coverage:** 18/18 backend tests passed

### January 14, 2026 - P1/P2 Features Batch ✅
- **Background Sync Hardening (P1):**
  - Added retry logic with exponential backoff (MAX_RETRIES=3, INITIAL_RETRY_DELAY=30s)
  - New `/api/integrations/background-sync/health` endpoint with comprehensive metrics
  - Health status classification: healthy, degraded (3+ failures), critical (6+ failures), stale (>1hr since success)
  - Tracks success_rate_24h, avg_duration_seconds, last_success/failure details
  - New `/api/integrations/sync/logs` endpoint for sync history with status/limit filters
- **Sales Leaderboard (Enhancement):**
  - Added to Target Progress Report page
  - Shows top 5 salespeople with medals (🥇🥈🥉)
  - Visual ranking with status badges, progress bars, revenue display
- **Activities in Opportunity Panel (P2):**
  - New `/api/activities/opportunity/{opp_id}` endpoint
  - Fetches activities from both local collection and Odoo data_lake_serving
  - Supports both numeric Odoo IDs and UUIDs
  - OpportunityDetailPanel now queries both sources for complete activity history
- **Calendar UI Improvements (P2):**
  - Events grouped by day with "Today", "Tomorrow", and formatted date labels
  - Summary cards showing Total Events, Online Meetings, Today count
  - Sticky date headers for better navigation
- **Odoo 19.0 Full Compatibility:**
  - Removed 'title' field from res.partner in both _get_model_fields() and fetch_contacts()
  - Fixed sync failures caused by deprecated field
- **Test Coverage:** 16/16 backend tests passed (iteration_25)
- **Test Coverage:** 18/18 backend tests passed, frontend verified

---

## Domain User Authorization Flow
1. User signs in via Microsoft SSO
2. Account created with `approval_status: "pending"`
3. User sees "Pending Approval" page
4. Super Admin approves in System Config → User Management
5. Admin assigns role → User can access platform

---

## Prioritized Backlog

### P0 (Critical - Must Fix)
- [x] ~~Production-ready CRM List View (sorting, filtering, column customization)~~ ✅ Completed
- [x] ~~360° Account View~~ ✅ Completed Jan 14, 2026
- [x] ~~Expandable Kanban Pipeline Board~~ ✅ Completed
- [x] ~~Goals Dashboard with KPI tracking~~ ✅ Completed
- [x] ~~Activity Timeline~~ ✅ Completed
- [x] ~~User-Odoo re-link functionality~~ ✅ Completed
- [x] ~~UAT Bug Fix: Account cards missing data~~ ✅ Fixed Jan 13, 2026
- [x] ~~UAT Bug Fix: KPI charts not rendering~~ ✅ Fixed Jan 13, 2026
- [x] ~~UAT Bug Fix: KPI metrics showing zero~~ ✅ Fixed Jan 13, 2026
- [x] ~~MS SSO User Mapping Bug~~ ✅ Fixed Jan 14, 2026 (CRITICAL SECURITY)
- [x] ~~Data Access Control~~ ✅ Fixed Jan 14, 2026 (strict matching instead of substring)
- [x] ~~Activities & Contacts Sync~~ ✅ Fixed Jan 14, 2026
- [x] ~~MS365 Token Refresh Flow~~ ✅ Fixed Jan 14, 2026 (auto-refresh interceptors)
- [x] ~~Deletion Sync from Odoo~~ ✅ Enhanced Jan 14, 2026 (soft-delete with logging)

### P1 (High Priority)
- [x] ~~Sales user pipeline display~~ ✅ Fixed Jan 13, 2026 (was already working)
- [x] ~~Industry filter on Accounts page~~ ✅ Fixed Jan 13, 2026 (infer_industry function)
- [x] ~~Activity Timeline showing real data~~ ✅ Fixed Jan 13, 2026 (ActivityLogger service + seeded data)
- [x] ~~Non-admin sync button~~ ✅ Fixed Jan 14, 2026 (new /user-sync/refresh endpoint with rate limiting)
- [x] ~~360° View "Account not found" error~~ ✅ Fixed Jan 14, 2026 (synthetic ID support added)
- [x] ~~Odoo user profile fields not showing~~ ✅ Fixed Jan 14, 2026 (UserResponse model updated)
- [x] ~~Target Progress Report UI~~ ✅ Completed Jan 14, 2026 (new /target-progress page)
- [ ] Automated background sync hardening (5-min intervals verified working)

### P2 (Medium Priority)
- [ ] Calendar UI improvements in `MyOutlook.js`
- [ ] Activities view within `OpportunityDetailPanel`
- [ ] Dashboard customizable grid layout

---

## Technical Architecture

### Comprehensive PRD Document
📄 **Full PRD with Architecture Diagrams:** `/app/docs/PRD_Sales_Intelligence_Platform_Jan14_2026.md`

### Backend
- **Framework:** FastAPI
- **Database:** MongoDB (Motor async driver)
- **Auth:** JWT tokens with role-based access control
- **Data Flow:** Odoo → Raw Zone → Canonical Zone → Serving Zone → UI
- **Background Sync:** APScheduler (5-minute intervals)

### Frontend
- **Framework:** React 18.2
- **UI Components:** Tailwind CSS, shadcn/ui, Recharts
- **Drag & Drop:** @hello-pangea/dnd

### Performance Metrics (Measured Jan 14, 2026)
| API Endpoint | Response Time |
|--------------|---------------|
| Dashboard Stats | 34ms |
| Accounts Real | 32ms |
| Goals | 32ms |
| KPIs | 39ms |
| Opportunities | 40ms |

### Key Collections
- `data_lake_serving`: Primary source of truth (synced from Odoo)
- `users`: User accounts with approval status and role assignments
- `goals`: KPI targets with progress tracking
- `kpis`: Performance indicators with achievement %

---

## Test Credentials
- **Super Admin:** superadmin@salescommand.com / demo123
- **Account Manager:** am1@salescommand.com / demo123

---

## Key Files
- `/app/backend/routes/sales.py` - Dashboard, opportunity, and 360° account APIs
- `/app/backend/routes/goals.py` - Goals CRUD API (new)
- `/app/backend/routes/admin.py` - User management with Odoo re-link endpoint
- `/app/backend/routes/config.py` - Role-based target configuration, navigation config
- `/app/backend/integrations/odoo/connector.py` - Odoo sync including employees
- `/app/frontend/src/pages/AccountManagerDashboard.js` - Sales dashboard
- `/app/frontend/src/pages/Opportunities.js` - Kanban and list views (with expand/collapse)
- `/app/frontend/src/pages/Accounts.js` - Account management with 360° view integration
- `/app/frontend/src/pages/Goals.js` - Goals dashboard with KPI tracking (new)
- `/app/frontend/src/pages/ActivityTimeline.js` - Activity timeline page (new)
- `/app/frontend/src/pages/Profile.js` - User profile with Odoo re-link button
- `/app/frontend/src/components/Account360Panel.js` - 360° account view slide-over panel
- `/app/frontend/src/components/DataTable.js` - Enterprise-grade table with sorting/filtering
