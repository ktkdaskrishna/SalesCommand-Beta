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

### January 13, 2026 Updates ✅
- **Backend Server Fixed:** Import errors resolved (`require_role`, `UserRole`, `TargetCreate`)
- **Deal Confidence UI Unified:** Both user types see same clean modal
- **Field Mapping Contrast Fixed:** Improved text readability
- **Account Manager Dashboard:** Data now displays properly ($410K pipeline, 3 opportunities)
- **Dashboard Real Endpoint Fixed:** Proper `is_super_admin` detection

### January 13, 2026 - P0 Features Implementation ✅
- **360° Account View:** New slide-over panel (`Account360Panel.js`) showing complete account data with summary cards and collapsible sections for Opportunities, Invoices, Activities, and Contacts
- **Expandable Kanban Board:** Column expand/collapse functionality added - clicking expand shows deals in grid layout while other columns minimize to vertical bars
- **Enterprise DataTable:** Enhanced with internal sorting (click column headers), column filtering (Filters button), and search functionality
- **Backend API:** New `/api/accounts/{id}/360` endpoint aggregates related entities from `data_lake_serving`
- **Test Coverage:** 15/15 backend tests passed, all frontend features verified

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
- [ ] MS365 refresh token flow (recurring login issue)

### P1 (High Priority)
- [ ] Target Reporting UI (aggregate progress against role-based targets)
- [ ] Investigate "Sync Failed" issues for domain users

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
- `/app/backend/routes/config.py` - Role-based target configuration
- `/app/frontend/src/pages/AccountManagerDashboard.js` - Sales dashboard
- `/app/frontend/src/pages/Opportunities.js` - Kanban and list views (with expand/collapse)
- `/app/frontend/src/pages/Accounts.js` - Account management with 360° view integration
- `/app/frontend/src/pages/FieldMapping.js` - Field mapping configuration
- `/app/frontend/src/components/OpportunityDetailPanel.js` - Slide-over detail panel
- `/app/frontend/src/components/Account360Panel.js` - 360° account view slide-over panel
- `/app/frontend/src/components/DataTable.js` - Enterprise-grade table with sorting/filtering
