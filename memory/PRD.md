# SalesCommand Enterprise - Product Requirements Document

## Project Overview
**Name:** SalesCommand Enterprise  
**Version:** 1.1 (Account Manager Dashboard Enhanced)  
**Date:** January 10, 2026  
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

### 1. Super Admin
- Full system configuration access
- Pipeline stage customization
- Commission template management
- Role and permission management

### 2. CEO / Executive
- Company-wide visibility
- Strategic task assignment
- Performance monitoring across teams, products, and regions

### 3. Sales Director
- Configure commission templates
- Manage incentive structures
- Team performance oversight

### 4. Finance Manager
- Commission template management
- Incentive verification
- Financial reporting

### 5. Product Directors (PDs)
- MSSP, Application Security, Network Security, GRC
- On-time delivery and execution of product-related activities
- Product pipeline contribution tracking

### 6. Account Managers (AMs)
- **Enhanced Dashboard with CRM Module**
- Kanban board for opportunity management
- Blue Sheet probability calculation with AI
- Incentive calculator
- Sales metrics tracking

### 7. Strategy Team
- Trust-building and executive relationships
- Long-term opportunity health activities

### 8. Referrer
- Track referred opportunities
- View referral incentive credits

## What's Been Implemented - Version 1.1

### Account Manager Enhanced Dashboard
- [x] **CRM Module - Kanban Board**
  - Drag-and-drop opportunity management
  - 7 configurable pipeline stages
  - Stage-based value totals
  - Activity count per opportunity
  - Product line display

- [x] **Blue Sheet Probability Calculator**
  - AI-powered probability calculation using GPT
  - Buying Influences assessment (Economic Buyer, Coach, User/Technical Buyers)
  - Red Flags identification (Budget, Competition, Timeline)
  - Win Results & Action Plan evaluation
  - Personalized AI recommendations

- [x] **Sales Metrics Module**
  - Orders Won tracking
  - Orders Booked
  - Orders Invoiced
  - Orders Collected
  - Commission Earned display

- [x] **Incentive Calculator**
  - Multiple commission templates:
    1. Flat Rate (5%)
    2. Tiered Attainment - Standard
    3. Tiered Revenue - Cybersecurity
    4. Quota-Based Accelerator
    5. New Logo Hunter
  - Product line weights
  - New logo multipliers
  - Cap calculations

- [x] **Global Search**
  - Search across accounts, opportunities, activities, users

- [x] **Referral System**
  - Single referral per opportunity
  - Configurable incentive percentage
  - Referrer tracking

### New API Endpoints (v1.1)
- `GET /api/opportunities/kanban` - Kanban board data
- `PATCH /api/opportunities/{id}/stage` - Drag-drop stage update
- `POST /api/opportunities/{id}/calculate-probability` - Blue Sheet AI
- `GET /api/pipeline-stages` - Get stages
- `POST /api/pipeline-stages` - Create stage
- `PUT /api/pipeline-stages/{id}` - Update stage
- `PUT /api/pipeline-stages/reorder` - Reorder stages
- `GET /api/commission-templates` - Get templates
- `POST /api/commission-templates` - Create template
- `POST /api/commission-templates/seed-defaults` - Seed default templates
- `POST /api/users/{id}/assign-commission-template` - Assign template
- `GET /api/sales-metrics/{user_id}` - Sales metrics
- `POST /api/incentive-calculator` - Calculate incentive preview
- `GET /api/referrals` - Get referrals
- `POST /api/referrals` - Create referral
- `GET /api/search` - Global search

### Demo Accounts (v1.1)
| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@salescommand.com | demo123 |
| CEO | ceo@salescommand.com | demo123 |
| Sales Director | sales.director@salescommand.com | demo123 |
| Account Manager | am1@salescommand.com | demo123 |
| Finance Manager | finance@salescommand.com | demo123 |
| Referrer | referrer@salescommand.com | demo123 |

## Prioritized Backlog

### P0 - Critical (Completed in v1.1)
- [x] Account Manager enhanced dashboard
- [x] Kanban board with drag-drop
- [x] Blue Sheet probability calculation
- [x] Commission templates
- [x] Incentive calculator
- [x] Sales metrics display

### P1 - High Priority (Next Phase)
- [ ] CEO/Executive dashboard enhancement
- [ ] Product Director dashboard enhancement
- [ ] Super Admin configuration panel
- [ ] Pipeline stage drag-drop customization
- [ ] Real-time notifications

### P2 - Medium Priority
- [ ] Odoo ERP actual integration
- [ ] Office 365 actual integration with LLM email analysis
- [ ] Auto-update suggestions from email analysis
- [ ] Referrer portal with full tracking

### P3 - Nice to Have
- [ ] Dark mode support
- [ ] Advanced reporting/exports
- [ ] Mobile responsive improvements
- [ ] API documentation Help button

## Technical Notes

### Commission Template Types
1. **Flat** - Simple percentage on all revenue
2. **Tiered Attainment** - Multipliers based on quota %
3. **Tiered Revenue** - Different rates at revenue bands
4. **Quota Based** - Base rate + accelerators above 100%

### Blue Sheet Scoring (Max 75 points)
- Buying Influences: Up to 40 points
- Red Flags: -5 to -15 points each
- Win Results: Up to 20 points
- Action Plan: Up to 15 points

### MOCKED Integrations
- Odoo ERP - Configuration panel ready
- Office 365 - Configuration panel ready
- Sales metrics calculated from local closed opportunities
