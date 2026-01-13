# Sales Intelligence Platform - Product Requirements Document

## Overview
Enterprise-grade Sales CRM for Securado's cybersecurity business with role-based experiences.

## Version
**v3.0.0** - Trust-Focused Beta (Jan 13, 2026)

---

## Beta Philosophy

> **"A great beta CRM feels boring, stable, and honest. Not impressive. Not clever. Not dense."**

### Core Principles:
1. **Trust Subset** - Users forgive missing features, but NOT wrong numbers
2. **Narrative Dashboards** - 2-3 metrics max, clear data origin
3. **Assistive AI** - "Guidance", not "Prediction"
4. **Read-only ERP Data** - Explicit framing for finance views

---

## Completed Work (This Session - Jan 13, 2026)

### Trust-Focused Revisions ✅

#### 1. Dashboard Scope Reduction
- **Simplified to 2 KPI cards only:**
  - Pipeline Value
  - Active Opportunities
- **Removed:** Won Revenue, Activity Completion (can show misleading data)
- **Removed:** Sales Metrics Summary section
- **Added:** Data Source Badge ("Source: Odoo | Just now")

#### 2. Blue Sheet → Deal Confidence Reframing
- Renamed "Calculate Probability" → "**Get Deal Confidence**"
- Renamed "AI Probability" → "**Deal Confidence Signal**"
- Shows **High/Medium/Low** labels instead of percentages
- Added tooltip: "Based on configurable factors. Use as guidance, not prediction."
- Admin tab renamed: "Deal Confidence" (not "Blue Sheet Config")

#### 3. Finance View Reframing
- Renamed "Receivables" → "**Invoices**"
- Route changed: `/receivables` → `/invoices`
- Read-only banner: "Accounting is managed in Odoo. This view is for sales awareness."
- Simplified to essential fields: Invoice #, Account, Amount, Status, Dates

#### 4. Accounts Real Data
- Now fetches from `/accounts/real` (data_lake_serving)
- Shows real Odoo accounts: TEST, VM, amc inc, MUSCAT OVERSEAS, Securado.Test
- Data Source Badge showing sync status

#### 5. Navigation Cleanup
- Removed "Reports" (not implemented)
- Added "Invoices" to main navigation
- Fixed Email path to /my-outlook

---

## Navigation Structure

### Main Menu (All Roles)
| Item | Icon | Path |
|------|------|------|
| Dashboard | LayoutDashboard | /dashboard |
| Accounts | Building2 | /accounts |
| Opportunities | Target | /opportunities |
| **Invoices** | FileText | /invoices |
| KPIs | BarChart3 | /kpis |
| Email | Mail | /my-outlook |

### Administration (Super Admin Only)
| Item | Icon | Path |
|------|------|------|
| System Config | Settings | /admin |
| Integrations | Plug2 | /integrations |
| Data Lake | Database | /data-lake |
| Field Mapping | Wand2 | /field-mapping |

### Admin Panel Tabs
| Tab | Icon | Component |
|-----|------|-----------|
| User Management | Users | User CRUD |
| Roles & Permissions | Shield | Role management |
| Role Configuration | LayoutDashboard | Nav/dashboard config |
| Incentive Config | DollarSign | Commission templates |
| **Deal Confidence** | Brain | Weight configuration |
| Departments | Building2 | Department management |
| All Permissions | Settings | Permission list |

---

## Beta Enhancement Components

| Component | Purpose | Location |
|-----------|---------|----------|
| **DataSourceBadge** | Shows data origin + sync time | Dashboard, Accounts, Invoices |
| **EmptyStateExplainer** | Meaningful empty states | Dashboard Activities |
| **ReadOnlyBanner** | "Accounting is managed in Odoo" | Invoices page |

---

## Data Architecture

### Primary Data Source: `data_lake_serving`
- Contains synced data from Odoo ERP
- Entity types: `opportunity`, `account`, `invoice`
- Real-time sync status tracked

### API Endpoints
| Endpoint | Purpose | Data Source |
|----------|---------|-------------|
| `/api/dashboard/real` | Dashboard metrics | data_lake_serving |
| `/api/accounts/real` | Synced accounts | data_lake_serving |
| `/api/receivables` | Synced invoices | data_lake_serving |
| `/api/config/bluesheet-weights` | Deal confidence config | bluesheet_config |

---

## Pending Tasks

### P2 - Post-Beta Validation
- **Sales Targets UI** - Admin panel for assigning quotas
- **MS365 Token Refresh** - Reduce re-login frequency
- **Calendar View** - Improve MyOutlook.js UX

### Future Enhancements
- Customizable dashboard grid layout (react-grid-layout)
- Opportunity Activities drawer
- Audit log for admin config changes

---

## Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@salescommand.com | demo123 |
| Account Manager | am1@salescommand.com | demo123 |

---

## Test Reports
- `/app/test_reports/iteration_18.json` - Trust-focused beta tests (100% pass)
- Needed: Visual calendar grid with week/month view

### Opportunity Activities
- Current: Basic opportunity list
- Needed: Side drawer with expandable activities per opportunity

### Dashboard Widgets
- Connect widgets to real data APIs
- Implement drag-drop customization

---

## API Endpoints

### Configuration APIs
- `GET /api/config/widgets` - Widget registry
- `GET /api/config/user/navigation` - User's role-based navigation
- `GET/POST/PUT /api/config/roles` - Role management
- `GET/PUT/DELETE /api/config/user/dashboard` - User dashboard layout
- `GET/POST/PUT /api/config/service-lines` - Service lines

### Sales APIs
- `GET/POST /api/accounts` - Account CRUD
- `GET/POST /api/opportunities` - Opportunity CRUD
- `GET /api/opportunities/kanban` - Kanban view
- `POST /api/opportunities/{id}/calculate-probability` - Blue Sheet

---

## Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@salescommand.com | demo123 |
