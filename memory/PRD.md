# Sales Intelligence Platform - Product Requirements Document

## Overview
Enterprise-grade Sales CRM for Securado's cybersecurity business with role-based experiences.

## Version
**v2.6.0** - Role-Based Navigation & Accounts Page (Jan 13, 2026)

---

## Completed Work (This Session)

### Phase 0: Role Configuration Engine ✅
- Role Configuration UI with visual builders
- Navigation tab builder (toggle menu items per role)
- Dashboard widget drag-drop builder
- Incentive settings per role
- Service lines pre-configured (MCD, ACS, GRC, Consulting, MSSP, Academy)
- 17 dashboard widgets registered

### Phase 1: Role-Based Navigation ✅
- Dynamic navigation fetched from `/api/config/user/navigation`
- Role-specific menu items (Main Menu + Admin Menu)
- Super Admin sees all navigation including Administration section
- Regular users see only Main Menu items assigned to their role
- Navigation items: Dashboard, Accounts, Opportunities, KPIs, Email, Reports

### Phase 3a: Accounts Page ✅
- Card view with health score badges (Healthy, At Risk, Critical, New)
- Table view with sortable columns
- View toggle (Card/Table)
- Search and industry filter
- Account metrics: Pipeline Value, Won Revenue, Active Opportunities, Win Rate
- New Account modal with full form
- Account creation via API

---

## Navigation Structure

### Main Menu (All Roles)
| Item | Icon | Path |
|------|------|------|
| Dashboard | LayoutDashboard | /dashboard |
| Accounts | Building2 | /accounts |
| Opportunities | Target | /opportunities |
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

---

## Pages Status

| Page | Status | Features |
|------|--------|----------|
| Dashboard | ✅ | Data Lake health, integrations status |
| Sales Dashboard | ✅ | KPIs, Kanban, Blue Sheet, Incentive Calculator |
| Accounts | ✅ | Card/Table view, health scores, CRUD |
| Opportunities | ✅ | Table view, stage badges, CRUD |
| KPIs | ✅ | Personal metrics, charts |
| Email/Calendar | ✅ | MS365 integration |
| Admin Panel | ✅ | Users, Roles, Role Config, Incentive Config |
| Integrations | ✅ | Odoo, MS365 connectors |
| Data Lake | ✅ | 3-zone data pipeline |
| Field Mapping | ✅ | AI-powered mapping |

---

## Pending Tasks

### Calendar View Enhancement
- Current: List view with date filters
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
