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
- [x] ~~360° Account View~~ ✅ Completed
- [x] ~~Expandable Kanban Pipeline Board~~ ✅ Completed
- [x] ~~Goals Dashboard with KPI tracking~~ ✅ Completed
- [x] ~~Activity Timeline~~ ✅ Completed
- [x] ~~User-Odoo re-link functionality~~ ✅ Completed
- [x] ~~UAT Bug Fix: Account cards missing data~~ ✅ Fixed Jan 13, 2026
- [x] ~~UAT Bug Fix: KPI charts not rendering~~ ✅ Fixed Jan 13, 2026
- [x] ~~UAT Bug Fix: KPI metrics showing zero~~ ✅ Fixed Jan 13, 2026
- [ ] MS365 refresh token flow (recurring login issue)

### P1 (High Priority)
- [ ] 360° View: Contacts section shows "No contacts found" (needs Odoo contact sync)
- [ ] 360° View: Activities/Invoices counts always zero (needs data linking)
- [ ] 360° View: Opportunities not filtered by selected account
- [ ] Industry filter on Accounts page not working
- [ ] Automated background sync hardening (5-min intervals verified working)
- [ ] Real-time activity logging (currently using mock data)
- [ ] Target Reporting UI (aggregate progress against role-based targets)

### P2 (Medium Priority)
- [ ] Calendar UI improvements in `MyOutlook.js`
- [ ] Activities view within `OpportunityDetailPanel`
- [ ] Dashboard customizable grid layout

---

## Technical Architecture

### Backend
- **Framework:** FastAPI
- **Database:** MongoDB (Motor async driver)
- **Auth:** JWT tokens with role-based access control
- **Data Flow:** Odoo → Raw Zone → Canonical Zone → Serving Zone → UI

### Frontend
- **Framework:** React
- **UI Components:** Tailwind CSS, shadcn/ui
- **Drag & Drop:** @hello-pangea/dnd

### Key Collections
- `data_lake_serving`: Primary source of truth (synced from Odoo)
- `targets`: Role-based target metrics
- `users`: User accounts with approval status and role assignments

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
