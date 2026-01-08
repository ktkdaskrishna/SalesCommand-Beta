# SalesCommand Enterprise - Product Requirements Document

## Project Overview
**Name:** SalesCommand Enterprise  
**Version:** 1.0 MVP  
**Date:** January 8, 2026  
**Tech Stack:** FastAPI (Python) + React + MongoDB

## Original Problem Statement
Build an Enterprise Sales KPI, Incentive & Activity Management Platform with:
1. Role-based dashboards (CEO, Product Directors, Account Managers, Strategy Team)
2. Account & Opportunity Management
3. Activity Management using Blue Sheet methodology
4. KPI & Incentive tracking
5. Configurable integrations for Odoo ERP and Office 365
6. AI-powered sales insights
7. JWT authentication with role management
8. Notifications & workflow alerts

## User Personas

### 1. CEO / Executive
- Company-wide visibility
- Strategic task assignment
- Performance monitoring across teams, products, and regions

### 2. Product Directors (PDs)
- MSSP, Application Security, Network Security, GRC
- On-time delivery and execution of product-related activities
- Product pipeline contribution tracking

### 3. Account Managers (AMs)
- Own customer relationships and account strategy
- Opportunity creation and progression
- Personal KPI and incentive tracking

### 4. Strategy Team
- Trust-building and executive relationships
- Long-term opportunity health activities

## Core Requirements (Static)

### Authentication & Authorization
- [x] JWT-based authentication
- [x] Role-based access control (CEO, PD, AM, Strategy)
- [x] Protected routes with role checking

### Account Management
- [x] CRUD operations for accounts
- [x] Stakeholder mapping
- [x] Relationship maturity tracking (New, Developing, Established, Strategic)
- [x] Industry and revenue tracking

### Opportunity Management
- [x] CRUD operations for opportunities
- [x] Stage tracking (Qualification → Discovery → Proposal → Negotiation → Closed)
- [x] Product line association
- [x] Blue Sheet fields (SSO, Competition, etc.)
- [x] Probability and value tracking

### Activity Management
- [x] CRUD operations for activities
- [x] Activity types (Task, Meeting, Call, Email, Presentation, Demo)
- [x] Priority levels (Low, Medium, High, Critical)
- [x] Status management with inline updates
- [x] Due date tracking with overdue alerts
- [x] Account/Opportunity/Product association

### KPI Management
- [x] KPI creation and tracking
- [x] Categories (Sales, Activity, Relationship, Execution)
- [x] Target vs actual tracking
- [x] Achievement percentage calculation
- [x] Trend indicators

### Incentive Management
- [x] Incentive plan creation
- [x] Target amount tracking
- [x] Earned amount tracking
- [x] Achievement percentage

### Dashboard System
- [x] Role-specific dashboards
- [x] KPI cards with progress bars
- [x] Pipeline by stage chart
- [x] Activities by status pie chart
- [x] Revenue trend line chart
- [x] Pending activities table
- [x] Top opportunities table

### AI-Powered Insights
- [x] GPT integration via Emergent LLM key
- [x] Automated sales insights generation
- [x] Recommendations based on pipeline data

### Integrations (Configurable/MOCKED)
- [x] Odoo ERP configuration panel
- [x] Office 365 configuration panel
- [x] Toggle enable/disable
- [x] API credentials storage (ready for future implementation)

## What's Been Implemented

### Backend (FastAPI)
- Complete REST API with 25+ endpoints
- JWT authentication system
- Role-based middleware
- MongoDB integration with Motor async driver
- AI insights using emergentintegrations library
- Demo data seeding

### Frontend (React)
- Modern UI with Tailwind CSS + shadcn patterns
- Manrope/Inter typography
- Swiss & High-Contrast design aesthetic
- Responsive sidebar navigation
- Dashboard with Recharts visualizations
- CRUD modals for all entities
- Role-based navigation

### Pages Implemented
1. Login - Demo accounts, authentication
2. Dashboard - KPIs, charts, tables
3. Accounts - List, create, search
4. Opportunities - Pipeline, stages, Blue Sheet
5. Activities - Status management, priorities
6. KPIs - Categories, charts, progress
7. Incentives - Earnings tracking
8. Integrations - Odoo, Office 365 config
9. AI Insights - GPT-powered analysis
10. Users - Team management (admin)

## Prioritized Backlog

### P0 - Critical (MVP Complete)
- [x] Authentication
- [x] Dashboard
- [x] Accounts CRUD
- [x] Opportunities CRUD
- [x] Activities CRUD
- [x] KPIs display

### P1 - High Priority
- [ ] Account detail page with full stakeholder management
- [ ] Opportunity detail page with full Blue Sheet view
- [ ] Real-time notifications system
- [ ] Dashboard widget customization
- [ ] Email notifications for overdue activities

### P2 - Medium Priority
- [ ] Odoo ERP actual integration
- [ ] Office 365 actual integration
- [ ] Calendar sync for meetings
- [ ] Email thread association
- [ ] Advanced reporting/exports
- [ ] Mobile responsive improvements

### P3 - Nice to Have
- [ ] Dark mode support
- [ ] Multi-language support
- [ ] Advanced analytics
- [ ] Custom dashboard layouts
- [ ] Audit trail viewing

## Next Tasks List

1. **Account Detail Page** - Full view with opportunities, activities, stakeholders
2. **Opportunity Detail Page** - Blue Sheet methodology view
3. **Notification System** - Real-time alerts for overdue/critical items
4. **Dashboard Customization** - Drag-drop widget arrangement
5. **Integration Implementation** - Connect Odoo/O365 when credentials provided

## Technical Notes

### API Base URL
- Backend: `/api/*` prefix
- Uses REACT_APP_BACKEND_URL from frontend .env

### Demo Accounts
| Role | Email | Password |
|------|-------|----------|
| CEO | ceo@salescommand.com | demo123 |
| Product Director | pd.mssp@salescommand.com | demo123 |
| Account Manager | am1@salescommand.com | demo123 |
| Strategy | strategy@salescommand.com | demo123 |

### MOCKED Integrations
- Odoo ERP and Office 365 integrations are configurable but not connected
- Configuration panels ready for future implementation with actual API credentials
