# Sales Intelligence Platform - Session Documentation
**Date:** January 13, 2026  
**Session Type:** Fork Session - CTO Audit & Stabilization  
**Status:** In Progress

---

## 📋 Executive Summary

This session focused on implementing critical fixes identified in a CTO audit for the Sales Intelligence Platform BETA release. The primary goal was building a foundation of trust and reliability by fixing architectural issues, ensuring proper data flow from Odoo (source of truth), and implementing role-based access control.

---

## 🏗️ Architecture Overview

### Tech Stack
- **Frontend:** React + Tailwind CSS + shadcn/ui
- **Backend:** FastAPI (Python)
- **Database:** MongoDB
- **Integrations:** Odoo ERP (source of truth), Microsoft 365 (SSO + Calendar/Email)

### Data Flow Architecture
```
┌─────────────────────────────────────────────────────────────────────────┐
│                           DATA FLOW                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ODOO ERP (Source of Truth)                                            │
│       │                                                                  │
│       ▼                                                                  │
│   /api/integrations/sync/odoo  ──►  Sync Service                        │
│       │                                                                  │
│       ▼                                                                  │
│   data_lake_serving (MongoDB Collection)                                │
│       │                                                                  │
│       ├── entity_type: "opportunity"                                    │
│       ├── entity_type: "account"                                        │
│       ├── entity_type: "invoice"                                        │
│       └── entity_type: "user"                                           │
│       │                                                                  │
│       ▼                                                                  │
│   API Endpoints (with role-based filtering)                             │
│       │                                                                  │
│       ▼                                                                  │
│   Frontend Dashboard / CRM Views                                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### User Authorization Flow
```
┌─────────────────────────────────────────────────────────────────────────┐
│                    USER AUTHORIZATION FLOW                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. USER LOGS IN VIA MICROSOFT SSO                                      │
│     └── Azure AD provides: email, name, job_title, department           │
│                                                                          │
│  2. ACCOUNT CREATED (PENDING APPROVAL)                                  │
│     └── Stored: email, name, AD profile data                            │
│     └── approval_status = "pending"                                     │
│                                                                          │
│  3. SUPER ADMIN APPROVES USER                                           │
│     └── System automatically:                                            │
│         ├── Searches Odoo users by email (case-insensitive)             │
│         ├── If found → Enriches with Odoo data:                         │
│         │   • odoo_user_id                                               │
│         │   • odoo_department_id / odoo_department_name                 │
│         │   • odoo_team_id / odoo_team_name                             │
│         │   • odoo_salesperson_name                                      │
│         └── Stores: odoo_matched = true                                 │
│                                                                          │
│  4. ACCESS CONTROL (ODOO IS SOURCE OF TRUTH)                            │
│     └── When fetching Opportunities/Accounts:                           │
│         ├── Check user's odoo_salesperson_name                          │
│         ├── Check user's odoo_user_id                                   │
│         ├── Check user's odoo_team_id                                   │
│         └── Show only records where user is assigned in Odoo            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## ✅ Completed Work This Session

### 1. Backend Server Fixes
- Fixed Python import errors in `/app/backend/routes/config.py`
  - Added missing imports: `require_role`, `UserRole`, `TargetCreate`
- Fixed class definition order (TargetCreate was used before defined)

### 2. User Profile & Authentication
- **Microsoft SSO Enhanced:** Now fetches extended profile from Azure AD
  - Fields: name, email, job_title, department, company, mobile_phone, office_location
- **User-Odoo Linking:** On approval, system matches user email with Odoo
- **Profile Page Created:** `/profile` route shows user info including Odoo link status
- **User Dropdown Enhanced:** Shows role badge, profile link, system health link

### 3. Dashboard Consolidation
- **All users now see CRM Dashboard** (AccountManagerDashboard)
- **Super Admin** gets additional "System Health" link for technical monitoring
- **Removed duplicate dashboard routing** that caused confusion

### 4. Sync Status Indicators Fixed
| Status | Icon | Color | Meaning |
|--------|------|-------|---------|
| `connected` | ✓ | Green | Integration working |
| `syncing` | ↻ | Blue | Sync in progress |
| `warning` | ⚠ | Amber | Partial issues |
| `needs_refresh` | ⚠ | Amber | Token expired |
| `error` | ✕ | Red | Sync failed |
| `not_configured` | ⚠ | Gray | Not set up |

### 5. Odoo Sync Endpoint Consolidation
- **Correct endpoint:** `/api/integrations/sync/odoo`
- **Fixed components using wrong endpoint:**
  - AccountManagerDashboard.js ✅
  - OdooIntegrationHub.js ✅
  - VisualDataFlowHub.js ✅
  - IntegrationHub.js (pending)

### 6. Role-Based UI Controls
- **"Sync from Odoo" button:** Only visible to admins
- **Non-admins:** See data but can't trigger syncs
- **Permission check:** `canTriggerSync = user.is_super_admin || user.role === 'admin'`

### 7. User Management
- **Permanent Delete:** Added `?permanent=true` option to completely remove users
- **Soft Delete:** Default behavior (sets `is_active=false`)
- **Delete Button:** Now visible in Admin Panel for all users

### 8. UI/UX Improvements
- **Deal Confidence UI Unified:** Same modal for all users
- **Field Mapping Contrast Fixed:** `text-zinc-400` instead of `text-zinc-500`
- **Search Functionality:** Works on both Kanban and Table views

---

## 🔴 Known Issues / Pending Fixes

### Critical
1. **IntegrationHub.js** still uses wrong sync endpoint (`/odoo/sync-all`)
2. **Domain user sync button** shows but fails (permission issue) - FIXED by hiding button
3. **Odoo user sync to data_lake_serving** not fully tested

### High Priority
1. **360° Account View** - Contact cards with expandable details (invoices, opportunities)
2. **Expandable Kanban Cards** - Full opportunity details in slide-over
3. **MS365 Refresh Token** - Silent background refresh not implemented

### Medium Priority
1. **Blue Sheet/Deal Confidence UI** - User preferred previous detailed version
2. **Production-ready List View** - Sorting, filtering, custom columns
3. **Target Reporting UI** - Aggregated progress against role-based targets

---

## 📁 Key Files Reference

### Backend Routes
| File | Purpose |
|------|---------|
| `/app/backend/routes/auth.py` | Authentication, Microsoft SSO, User creation |
| `/app/backend/routes/admin.py` | User management, approval, Odoo enrichment |
| `/app/backend/routes/sales.py` | Opportunities, Dashboard, Sync status |
| `/app/backend/routes/integrations.py` | Odoo/MS365 sync endpoints |
| `/app/backend/routes/config.py` | Role-based targets, navigation config |

### Backend Services
| File | Purpose |
|------|---------|
| `/app/backend/services/odoo/connector.py` | Odoo API connector (WORKING) |
| `/app/backend/integrations/odoo/connector.py` | Alternative connector (NOT USED) |
| `/app/backend/services/sync/service.py` | Main sync job runner |

### Frontend Pages
| File | Purpose |
|------|---------|
| `/app/frontend/src/pages/AccountManagerDashboard.js` | Main CRM Dashboard (for all users) |
| `/app/frontend/src/pages/Dashboard.js` | Technical/Admin Dashboard |
| `/app/frontend/src/pages/Opportunities.js` | Kanban + Table view |
| `/app/frontend/src/pages/AdminPanel.js` | User management, System config |
| `/app/frontend/src/pages/Profile.js` | User profile page |

### Frontend Components
| File | Purpose |
|------|---------|
| `/app/frontend/src/components/Layout.js` | Main layout, navigation, user dropdown |
| `/app/frontend/src/components/OpportunityDetailPanel.js` | Slide-over opportunity details |
| `/app/frontend/src/components/OdooIntegrationHub.js` | Odoo sync management |

---

## 🔑 API Endpoints

### Authentication
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/login` | Email/password login | No |
| POST | `/api/auth/microsoft/complete` | Complete MS SSO | No |
| GET | `/api/auth/me` | Get current user | Yes |

### User Management (Admin Only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | List all users |
| POST | `/api/admin/users/{id}/approve` | Approve + Odoo enrich |
| DELETE | `/api/admin/users/{id}?permanent=true` | Hard delete user |

### Data (Role-Based Filtering)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/opportunities` | List opportunities (filtered by user) |
| GET | `/api/dashboard/real` | Dashboard KPIs (filtered) |
| GET | `/api/sync-status` | Integration health status |

### Sync (Admin Only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/integrations/sync/odoo` | Trigger Odoo sync |
| POST | `/api/integrations/odoo/sync-departments` | Sync departments |
| POST | `/api/integrations/odoo/sync-users` | Sync users |

---

## 🗄️ Database Collections

### users
```javascript
{
  id: "uuid",
  email: "user@domain.com",
  name: "Full Name",
  role: "account_manager",
  approval_status: "approved",
  is_super_admin: false,
  // Azure AD fields
  auth_provider: "microsoft",
  job_title: "Sales Manager",
  ad_department: "Sales",
  company_name: "Company",
  // Odoo enrichment (set on approval)
  odoo_matched: true,
  odoo_user_id: 123,
  odoo_department_id: 5,
  odoo_department_name: "Sales",
  odoo_salesperson_name: "user@domain.com",
  odoo_team_id: 2,
  odoo_team_name: "Sales Team"
}
```

### data_lake_serving
```javascript
{
  entity_type: "opportunity", // or "account", "invoice", "user"
  serving_id: "odoo_opportunity_123",
  source: "odoo",
  last_aggregated: "2026-01-13T19:00:00Z",
  data: {
    id: 123,
    name: "Deal Name",
    expected_revenue: 50000,
    stage_name: "Proposal",
    salesperson_name: "user@domain.com", // Used for filtering
    partner_name: "Account Name",
    // ... other Odoo fields
  }
}
```

### integrations
```javascript
{
  integration_type: "odoo",
  enabled: true,
  config: {
    url: "https://company.odoo.com",
    database: "company_db"
  },
  sync_status: "success", // or "failed", "partial", "in_progress"
  last_sync: "2026-01-13T19:00:00Z",
  error_message: null
}
```

---

## 🧪 Test Credentials

| User | Email | Password | Role |
|------|-------|----------|------|
| Super Admin | superadmin@salescommand.com | demo123 | Super Admin |
| Account Manager | am1@salescommand.com | demo123 | Account Manager |
| Domain User | krishna@securado.net | (MS SSO) | Account Manager |

---

## 🔄 Testing Workflow

### Test User Authorization Flow
1. Delete existing user (Admin Panel → User Management → Delete)
2. Click "Sync Odoo Users" to pull Odoo user data
3. Login via Microsoft SSO with domain user
4. See "Pending Approval" page
5. Approve as Super Admin
6. Check user's Profile page for Odoo link status
7. Verify data filtering (user should only see their assigned opportunities)

### Test Sync Flow
1. Login as Super Admin
2. Click "Sync from Odoo" on Dashboard
3. Wait for sync completion
4. Verify data in data_lake_serving collection
5. Check sync status indicators (should show green)

---

## 🚨 Important Notes for Next Session

1. **Two Odoo Connectors Exist:**
   - `/app/backend/services/odoo/connector.py` ← USE THIS ONE
   - `/app/backend/integrations/odoo/connector.py` ← NOT USED

2. **Sync Endpoint:**
   - Correct: `/api/integrations/sync/odoo`
   - Wrong (broken): `/api/integrations/odoo/sync-all`

3. **Dashboard Routing:**
   - All users now see `AccountManagerDashboard`
   - Technical dashboard at `/admin-dashboard` (admins only)

4. **User Data Filtering:**
   - Based on `salesperson_name` field in Odoo data
   - Matches against user's email or `odoo_salesperson_name`

5. **Permission Model:**
   - Sync operations: Admin only
   - View data: All approved users (filtered by Odoo assignment)
   - User management: Super Admin only

---

## 📊 Session Metrics

- **Issues Identified:** 9 (from CTO audit)
- **Issues Fixed:** 6
- **Issues Pending:** 3
- **New Features Added:** Profile page, Enhanced user dropdown, Permanent delete
- **Components Modified:** 15+
- **Test Coverage:** Manual testing completed

---

## 📝 Handoff Notes

The next session should prioritize:
1. **Fix remaining IntegrationHub.js** sync endpoint
2. **Implement 360° Account View** with expandable contact cards
3. **MS365 Silent Refresh** token flow
4. **Comprehensive testing** with testing_agent_v3_fork

The codebase is now more stable with proper Odoo-based access control. The key architectural decision is that **Odoo is the source of truth** - all data flows from Odoo through the data lake to the UI, and user access is determined by their Odoo salesperson assignment.
