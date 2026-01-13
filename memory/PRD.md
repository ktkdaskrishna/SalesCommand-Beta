# Sales Intelligence Platform - Product Requirements Document

## Overview
Enterprise-grade Sales CRM with ERP Integration, designed for Securado's cybersecurity business.

## Version
**v2.5.0** - Role Configuration Engine & Incentive Management (Jan 13, 2026)

---

## Original Problem Statement
Build a scalable Sales Intelligence Platform with:
1. Role-based customizable dashboards and navigation
2. Configurable incentive/commission management
3. Opportunity-centric workflow (activities expand from opportunities)
4. Service line specific commission weights for cybersecurity SI

---

## Completed Work

### Phase 0: Role Configuration Engine ✅ (Jan 13, 2026)

#### Backend APIs Created (`/app/backend/routes/config.py`)
- `GET /api/config/widgets` - Widget registry (17 widgets available)
- `GET /api/config/navigation-items` - Available navigation items
- `GET /api/config/user/navigation` - User's role-based navigation
- `GET/POST /api/config/roles` - Role CRUD with navigation & dashboard config
- `PUT /api/config/roles/{id}` - Update role configuration
- `GET/PUT/DELETE /api/config/user/dashboard` - User dashboard layout persistence
- `GET/POST/PUT /api/config/service-lines` - Service line management
- `GET/POST/PUT /api/config/pipeline-stages` - Pipeline stage management

#### Frontend Components Created
- `RoleConfigurationPanel.js` - Visual role configuration with:
  - Basic info (name, description, data scope)
  - Navigation tab builder (toggle main/admin menu items)
  - Dashboard widget drag-drop builder (react-grid-layout)
  - Incentive settings per role
- `IncentiveConfiguration.js` - Commission template & service line management
  - Commission template CRUD with tier builder
  - Service line CRUD with weights

#### Admin Panel Enhancements
- New "Role Configuration" tab
- New "Incentive Config" tab with sub-tabs:
  - Commission Templates (Flat, Tiered Attainment, Tiered Revenue, Quota-Based)
  - Service Lines (MCD 1.3x, ACS 1.2x, GRC 1.1x, Consulting 1.0x, MSSP 1.25x, Academy 0.8x)

#### Securado Service Lines Pre-configured
| Code | Name | Weight | Recurring |
|------|------|--------|-----------|
| MCD | Managed Cyber Defense | 1.3x | Yes |
| ACS | Adaptive Cloud Security | 1.2x | Yes |
| GRC | IT GRC Services | 1.1x | No |
| CONSULTING | Security Consulting | 1.0x | No |
| MSSP | Managed Security Services | 1.25x | Yes |
| ACADEMY | Securado Academy | 0.8x | No |

### Dashboard Widget Registry (17 Widgets)
**KPI Cards:** pipeline_value, won_revenue, quota_gauge, active_opportunities, activity_completion, win_rate
**Charts:** pipeline_by_stage, revenue_by_product, win_rate_trend, forecast_vs_actual, monthly_revenue
**Lists:** upcoming_activities, recent_emails, team_leaderboard, collection_aging, recent_opportunities
**Kanban:** pipeline_kanban

---

## Role-Based Architecture

### How New Roles Work:
1. Super Admin → System Config → Role Configuration
2. Create new role (e.g., "Product Director")
3. Configure:
   - Navigation tabs (which menu items are visible)
   - Default dashboard layout (drag-drop widgets)
   - Data scope (own/team/department/all)
   - Commission template assignment
4. Assign users to the role
5. Users automatically get the configured navigation and dashboard

### User Customization:
- Users can customize their own dashboard layout
- Saved to `user_preferences` collection
- "Reset to Default" returns to role's default layout

---

## Pending Implementation

### Phase 1: Foundation Restructure 🔜
- [ ] Role-based routing (sales users → sales dashboard by default)
- [ ] Update Layout.js to use `/api/config/user/navigation`
- [ ] Hide Data Lake, Integrations for non-admin roles

### Phase 3: Core Sales Pages 🔜
- [ ] Accounts List Page with CRUD
- [ ] Account Detail Page (contacts, opportunities, timeline)
- [ ] Opportunities List/Kanban (already exists, enhance)
- [ ] Opportunity Detail with expandable activities
- [ ] KPIs Page (personal targets, attainment)
- [ ] Email Page (MS365 integration enhancement)

### Phase 4: Customizable Dashboard 🔜
- [ ] Implement dashboard widget renderer
- [ ] Connect widgets to real data APIs
- [ ] Add layout editing mode toggle
- [ ] Layout persistence (save/load)

### Phase 5: Financial Tracking 🔜
- [ ] Invoice Management
- [ ] Collection Tracking
- [ ] Revenue Reports

---

## Technology Stack
- **Backend:** FastAPI, Pydantic v2, Motor (async MongoDB)
- **Frontend:** React 19, Tailwind CSS, Shadcn/UI, react-grid-layout, @hello-pangea/dnd, Recharts
- **Database:** MongoDB
- **AI:** GPT-4o via Emergent LLM Key

---

## Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@salescommand.com | demo123 |
| Account Manager | am1@salescommand.com | demo123 |

---

## API Endpoints Summary

### Configuration APIs
- `GET /api/config/widgets` - Widget registry
- `GET /api/config/navigation-items` - Available nav items
- `GET /api/config/user/navigation` - User's nav based on role
- `GET/POST /api/config/roles` - Role management
- `PUT /api/config/roles/{id}` - Update role
- `GET/PUT/DELETE /api/config/user/dashboard` - User dashboard layout
- `GET/POST/PUT /api/config/service-lines` - Service lines
- `GET/POST/PUT /api/config/pipeline-stages` - Pipeline stages

### Sales APIs
- `GET/POST /api/opportunities` - Opportunities CRUD
- `GET /api/opportunities/kanban` - Kanban view
- `PATCH /api/opportunities/{id}/stage` - Drag-drop stage update
- `POST /api/opportunities/{id}/calculate-probability` - Blue Sheet
- `GET /api/dashboard/stats` - Dashboard KPIs
- `POST /api/incentive-calculator` - Commission calculation
- `GET /api/commission-templates` - Templates list
- `GET /api/search?q=` - Global search
