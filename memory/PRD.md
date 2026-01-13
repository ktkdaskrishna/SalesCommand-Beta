# Sales Intelligence Platform - Product Requirements Document

## Overview
Enterprise-grade Sales CRM with ERP Integration, designed with a microservices architecture and three-zone Data Lake.

## Version
**v2.3.0** - Account Manager Dashboard & Blue Sheet (Jan 13, 2026)

---

## Original Problem Statement
The user has mandated a complete architectural rebuild of the application, transforming it into an enterprise-grade "Sales Intelligence Platform" with:

1. **Core Integrations:** Odoo ERP (v16+), with Microsoft 365 / Azure AD for SSO
2. **Data Lake Architecture:** Three-zone MongoDB Data Lake (Raw, Canonical, Serving)
3. **Modular Sync Engine:** Connector -> Mapper -> Validator -> Normalizer -> Loader -> Logger
4. **AI-Powered Features:** GPT-4o for intelligent field mapping and Blue Sheet recommendations (Emergent LLM Key)
5. **Sales Features:** Account Manager Dashboard with Kanban pipeline, Blue Sheet Probability Calculator, Incentive Calculator
6. **Microservices Architecture:** Each integration as a separate service for scalability
7. **Role-Based Access Control:** Configurable roles, permissions, and data scoping

---

## Completed Work

### Phase 2.4: Account Manager Dashboard & Blue Sheet ✅ (Jan 13, 2026)

#### Account Manager Dashboard
- [x] **KPI Cards** - Pipeline Value, Won Revenue, Active Opportunities, Activity Completion Rate
- [x] **Sales Metrics Section** - Orders Won, Booked, Invoiced, Collected, Commission Earned by period
- [x] **Kanban Pipeline Board** - Drag-drop opportunities between 7 stages with @hello-pangea/dnd
- [x] **Opportunity Cards** - Name, Account, Value, Probability, Product Line, Activity Count
- [x] **Expandable Container** - Fullscreen mode for Kanban board

#### Blue Sheet Probability Calculator
- [x] **Miller Heiman Methodology** - Buying Influences, Red Flags, Win Results, Action Plan scoring
- [x] **Buying Influences Section** - Economic Buyer, User Buyers, Technical Buyers, Coach
- [x] **Red Flags Section** - No Access to Economic Buyer, Budget Not Confirmed, Competition Preferred, Reorganization, Timeline Unclear
- [x] **Win Results Section** - Clear Business Results, Quantifiable Value
- [x] **Action Plan Section** - Next Steps Defined, Mutual Action Plan
- [x] **AI Recommendations** - GPT-4o powered recommendations via Emergent LLM Key
- [x] **Score Breakdown** - Visual breakdown of score components
- [x] **Confidence Level** - Low/Medium/High based on analysis completeness

#### Incentive Calculator (Cybersecurity SI Focus)
- [x] **Commission Templates** - Cybersecurity Standard, MSSP Recurring Revenue, etc.
- [x] **Tiered Commission Structure** - 5% base → 8% at quota → 12% over (configurable)
- [x] **Product Line Weights** - MSSP (1.2x), Application Security (1.0x), Network Security (1.0x), GRC (1.1x)
- [x] **New Logo Multiplier** - 1.5x default for new customer acquisition
- [x] **Commission Breakdown Display** - Revenue, Attainment, Base Commission, Multipliers, Final Commission

#### Supporting Features
- [x] **Global Search** - Search across Accounts, Opportunities, Activities
- [x] **Activities Management** - Create, update status, filter by opportunity/account
- [x] **Accounts Management** - Create accounts with industry, revenue, employee count
- [x] **Pipeline Stages** - 7 default stages with colors and probability defaults
- [x] **Role-Based Navigation** - Sales Dashboard link visible in sidebar

### Backend APIs Added (Phase 2.4)
- `GET /api/dashboard/stats` - KPI data for dashboard cards
- `GET /api/opportunities/kanban` - Kanban board with stages and opportunities
- `GET /api/opportunities` - List all opportunities
- `POST /api/opportunities` - Create opportunity
- `PUT /api/opportunities/{id}` - Update opportunity
- `PATCH /api/opportunities/{id}/stage` - Update stage (drag-drop)
- `POST /api/opportunities/{id}/calculate-probability` - Blue Sheet calculation with AI
- `GET /api/sales-metrics/{user_id}` - User sales metrics by period
- `POST /api/incentive-calculator` - Commission calculation
- `GET /api/commission-templates` - Available commission templates
- `POST /api/commission-templates` - Create template
- `GET /api/search?q={query}` - Global search
- `GET /api/activities` - List activities
- `POST /api/activities` - Create activity
- `PATCH /api/activities/{id}/status` - Update activity status
- `GET /api/accounts` - List accounts
- `POST /api/accounts` - Create account
- `GET /api/config/llm` - Get LLM configuration
- `PUT /api/config/llm` - Update LLM configuration

### Earlier Completed Phases

#### Phase 2.3: RBAC & Admin Panel ✅ (Jan 12, 2026)
- [x] Database-driven roles and permissions (42 permissions)
- [x] Admin Panel with User Management, Roles & Permissions, Departments
- [x] Data scoping (Own, Team, Department, All)
- [x] My Outlook page for personal email/calendar
- [x] New user approval flow for SSO users

#### Phase 2.2: Microsoft 365 SSO Integration ✅ (Jan 12, 2026)
- [x] MSAL Library Integration for SPA OAuth
- [x] Microsoft SSO button on login page
- [x] User creation/update with MS365 tokens

#### Phase 2.1: Multi-Entity Sync Modal ✅ (Jan 12, 2026)
- [x] Entity selection toggles for Odoo sync
- [x] Custom field mapping integration
- [x] Sync service with custom mappings

#### Phase 1: Foundation Shell ✅ (Jan 12, 2026)
- [x] Clean modular backend architecture
- [x] MongoDB Data Lake with 3 zones
- [x] JWT authentication
- [x] Odoo REST API connector
- [x] AI field mapping service

---

## Known Issues

### P0 - Critical
- **MS365 Email Sync Token Expiration** - MS365 access tokens expire after ~1 hour. The app now handles token expiration gracefully by prompting users to re-authenticate. A refresh token mechanism would improve UX.

### P1 - Important
- None currently

### P2 - Nice to Have
- None currently

---

## Upcoming Tasks

### Phase 3: Real-Time Sync 🔜
- [ ] Implement Odoo webhooks in `/api/webhooks/odoo/{tenant_id}`
- [ ] Scheduled polling via `/backend/services/sync/scheduler.py`
- [ ] UI options for sync method (Manual, Webhook, Scheduled)

### Phase 4: Dashboard Analytics 🔜
- [ ] Aggregate opportunities to Serving Zone
- [ ] Sales analytics charts (pipeline by stage, revenue by product line)
- [ ] Team performance dashboards

### Phase 5: Additional Integrations 🔜
- [ ] Salesforce connector
- [ ] HubSpot connector
- [ ] MS365 refresh token mechanism

---

## Technology Stack
- **Backend:** FastAPI, Pydantic v2, Motor (async MongoDB)
- **Frontend:** React 19, Tailwind CSS, Shadcn/UI, @hello-pangea/dnd, Recharts
- **Database:** MongoDB with Data Lake architecture
- **AI:** GPT-4o via Emergent LLM Key (BYOK supported)
- **Auth:** JWT with bcrypt password hashing

---

## Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@salescommand.com | demo123 |
| Account Manager | am1@salescommand.com | demo123 |

---

## Test Results (Jan 13, 2026)
- **Backend Tests:** 19/19 passed (100%)
- **Frontend Tests:** All UI flows working (100%)
- **Test Report:** `/app/test_reports/iteration_14.json`
