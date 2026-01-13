# Sales Intelligence Platform - Product Requirements Document

## Overview
Enterprise-grade Sales CRM for Securado's cybersecurity business with role-based experiences.

## Version
**v2.9.0** - Beta Stabilization Complete (Jan 13, 2026)

---

## Completed Work (This Session - Jan 13, 2026)

### P0 Fixes - Critical for Beta ✅

#### 1. Dashboard Data Connection
- Connected Account Manager dashboard to `data_lake_serving` (real Odoo-synced data)
- Added **Data Source Badge** showing "Source: Odoo | Last sync time"
- Fixed KPI cards to display correct field mappings
- Added **Empty State Explainer** component with helpful messages

#### 2. UI Contrast Fix
- Fixed unreadable text on Incentive Configuration page
- All text now has proper contrast against backgrounds

### P1 Features - High Priority ✅

#### 3. Receivables/Invoices View
- New `/receivables` page displaying synced invoice data
- **Features:**
  - Data Source Badge (Source: Odoo)
  - Read-only Banner ("This data is synced from Odoo and cannot be edited here")
  - Summary cards (Total Receivables, Collected, Pending, Overdue)
  - Invoice table with search and status filter
  - Payment status badges (Paid, Pending, Partial, Overdue)
  - Empty state explainer when no invoices synced

#### 4. Blue Sheet Configuration UI
- New admin UI in System Config panel
- **Configurable Weight Categories:**
  | Category | Weights |
  |----------|---------|
  | Buying Influences | Economic Buyer, User Buyers, Technical Buyers, Coach |
  | Red Flags | No Access to EB, Reorganization, Budget, Competition, Timeline |
  | Win Results | Clear Business Results, Quantifiable Value |
  | Action Plan | Next Steps Defined, Mutual Action Plan |
- Validation warnings for misconfiguration
- Save/Reset functionality

### Beta Enhancement Components ✅

| Component | Purpose | Location |
|-----------|---------|----------|
| **DataSourceBadge** | Shows data origin and sync time | Dashboard, Receivables |
| **EmptyStateExplainer** | Meaningful empty states with context | Dashboard, Receivables |
| **ReadOnlyBanner** | Indicates ERP-synced read-only data | Receivables |

---

## Previous Work (Earlier Sessions)

### Enhanced Kanban Board ✅
- Product/Segment Tags on cards
- Activities count display
- Calculate Probability button with Blue Sheet modal
- Drag & drop between pipeline stages
- AI-powered recommendations

### Configurable Blue Sheet Weights ✅
- Backend API at `/api/config/bluesheet-weights`
- Admin-configurable scoring weights
- Frontend UI in Admin Panel

### Target Assignment System ✅
- CRUD API endpoints for sales targets

### UI/UX Modernization ✅
- Light content area with dark sidebar
- Modern gradient icons
- Consistent card styling

---

## Navigation Structure

### Main Menu (All Roles)
| Item | Icon | Path |
|------|------|------|
| Dashboard | LayoutDashboard | /dashboard |
| Accounts | Building2 | /accounts |
| Opportunities | Target | /opportunities |
| **Receivables** | FileText | /receivables |
| KPIs | BarChart3 | /kpis |
| Email | Mail | /my-outlook |
| Reports | FileText | /reports |

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
| **Blue Sheet Config** | Brain | AI weight configuration |
| Departments | Building2 | Department management |
| All Permissions | Settings | Permission list |

---

## Pages Status

| Page | Status | Features |
|------|--------|----------|
| Dashboard | ✅ | Data Lake health (Admin), Sales KPIs (Sales roles) |
| Sales Dashboard | ✅ | KPIs, Kanban, Blue Sheet, Incentive Calculator, **Data Source Badge** |
| Accounts | ✅ | Card/Table view, health scores, CRUD |
| Opportunities | ✅ | Kanban with Blue Sheet, Table view, CRUD |
| **Receivables** | ✅ | Invoice table, summary cards, filters, **Read-only Banner** |
| KPIs | ✅ | Personal metrics, charts |
| Email/Calendar | ✅ | MS365 integration |
| Admin Panel | ✅ | Users, Roles, Incentive Config, **Blue Sheet Config** |
| Integrations | ✅ | Odoo, MS365 connectors |
| Data Lake | ✅ | 3-zone data pipeline |
| Field Mapping | ✅ | AI-powered mapping |

---

## Pending Tasks (P2 and Future)

### P2 - Medium Priority
- **Sales Targets UI** - Admin panel for assigning quotas
- Better Calendar view in MyOutlook.js

### Future Enhancements
- MS365 refresh token mechanism (reduce re-login frequency)
- Customizable dashboard grid layout (react-grid-layout)
- Opportunity Activities drawer
- Audit log for admin actions

---

## Data Architecture

### Primary Data Source: `data_lake_serving`
- Contains synced data from Odoo ERP
- Entity types: `opportunity`, `account`, `invoice`
- Real-time sync status tracked

### Collections
| Collection | Purpose |
|------------|---------|
| `data_lake_serving` | Synced ERP data (source of truth) |
| `opportunities` | Legacy/demo opportunities |
| `accounts` | Account master data |
| `invoices` | Synced from Odoo |
| `bluesheet_config` | AI weight configuration |
| `users` | User accounts with roles |
| `roles` | Role definitions |

---

## Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@salescommand.com | demo123 |
| Account Manager | am1@salescommand.com | demo123 |

---

## Integrations
| Integration | Status | Purpose |
|-------------|--------|---------|
| Odoo ERP | ✅ Connected | Sales/Finance data sync |
| Emergent LLM (GPT-4o) | ✅ Active | Blue Sheet AI recommendations |
| Microsoft 365 | ⚠️ Token issues | Email/Calendar sync |

---

## Test Reports
- `/app/test_reports/iteration_17.json` - Latest beta stabilization tests (100% pass)
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
