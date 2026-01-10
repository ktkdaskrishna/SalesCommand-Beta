# SalesCommand Enterprise - Product Requirements Document

## Project Overview
**Name:** SalesCommand Enterprise  
**Version:** 1.2 (Super Admin Configuration Architecture)  
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
- UI theme and branding customization
- LLM/AI prompt configuration

### 2. CEO / Executive
- Company-wide visibility
- Strategic task assignment
- Performance monitoring across teams, products, and regions
- Can view roles configuration

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

## What's Been Implemented

### Version 1.2 - Super Admin Configuration Architecture (COMPLETED)
- [x] **System Configuration Backend**
  - Modular configuration storage in MongoDB
  - Default configuration initialization
  - Audit logging for config changes

- [x] **Roles & Permissions Management**
  - 8 predefined system roles with permissions
  - Custom role creation capability
  - Feature-to-role permission assignment
  - Role-based access control (RBAC)

- [x] **Blue Sheet Configuration**
  - Configurable scoring elements
  - Element weight customization
  - Pipeline stages configuration
  - Probability formula settings
  - AI enhancement toggle

- [x] **AI/LLM Configuration**
  - Provider configuration (OpenAI)
  - Model selection and parameters
  - Prompt template management
  - Response caching settings

- [x] **UI & Branding Configuration**
  - Theme mode (Light/Dark/System)
  - Color palette customization
  - Typography settings
  - Branding (App name, tagline, logos)
  - UI options (sidebar, animations)

- [x] **Integrations Configuration**
  - Odoo ERP settings (MOCKED)
  - Microsoft 365 settings (MOCKED)

### New API Endpoints (v1.2)
- `GET /api/config/system` - Full system configuration (Super Admin only)
- `GET /api/config/user-config` - User's filtered configuration
- `GET /api/config/user-permissions` - User's permissions
- `GET /api/config/modules` - All module definitions
- `GET /api/config/roles` - All role definitions
- `POST /api/config/roles` - Create new role
- `PUT /api/config/roles/{id}` - Update role
- `DELETE /api/config/roles/{id}` - Delete role
- `PUT /api/config/roles/{id}/permissions` - Update role permissions
- `GET /api/config/blue-sheet` - Blue Sheet configuration
- `PUT /api/config/blue-sheet` - Update Blue Sheet config
- `GET /api/config/llm` - LLM configuration
- `PUT /api/config/llm` - Update LLM config
- `GET /api/config/ui` - UI configuration
- `PUT /api/config/ui` - Update UI config
- `POST /api/config/reset-defaults` - Reset to defaults
- `GET /api/config/audit-log` - Configuration audit log

### Version 1.1 - Account Manager Dashboard Enhanced (COMPLETED)
- [x] **CRM Module - Kanban Board**
- [x] **Blue Sheet Probability Calculator with AI**
- [x] **Sales Metrics Module**
- [x] **Incentive Calculator**
- [x] **Global Search**
- [x] **Referral System**

### Version 1.0 - MVP (COMPLETED)
- [x] JWT Authentication
- [x] Role-based dashboards
- [x] Account & Opportunity Management
- [x] Activity Management
- [x] KPI & Incentive tracking

## Demo Accounts
| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@salescommand.com | demo123 |
| CEO | ceo@salescommand.com | demo123 |
| Sales Director | sales.director@salescommand.com | demo123 |
| Account Manager | am1@salescommand.com | demo123 |
| Finance Manager | finance@salescommand.com | demo123 |
| Referrer | referrer@salescommand.com | demo123 |

## Prioritized Backlog

### P0 - Critical (COMPLETED)
- [x] Account Manager enhanced dashboard
- [x] Kanban board with drag-drop
- [x] Blue Sheet probability calculation
- [x] Commission templates
- [x] Incentive calculator
- [x] Sales metrics display
- [x] **Super Admin configuration panel**

### P1 - High Priority (Next Phase)
- [ ] **Dynamic Frontend Rendering** - Render UI based on role permissions from config
- [ ] CEO/Executive dashboard enhancement
- [ ] Product Director dashboard enhancement
- [ ] Real-time notifications

### P2 - Medium Priority
- [ ] **Odoo ERP actual integration** - Implement data sync
- [ ] **Office 365 actual integration** - Email/calendar sync with LLM analysis
- [ ] Auto-update suggestions from email analysis
- [ ] Referrer portal with full tracking

### P3 - Nice to Have
- [ ] Dark mode support (UI config ready)
- [ ] Advanced reporting/exports
- [ ] Mobile responsive improvements
- [ ] API documentation Help button
- [ ] Dashboard widget customization per user

## Technical Architecture

### Backend Modules
- `/app/backend/server.py` - Main FastAPI application
- `/app/backend/config_models.py` - Pydantic models for configuration
- `/app/backend/config_routes.py` - Configuration API routes

### Frontend Pages
- `/app/frontend/src/pages/SuperAdminConfig.js` - Admin configuration UI
- `/app/frontend/src/pages/AccountManagerDashboard.js` - AM dashboard
- `/app/frontend/src/pages/Dashboard.js` - Generic dashboard

### Database Collections
- `users` - User accounts
- `accounts` - Customer accounts
- `opportunities` - Sales opportunities
- `activities` - Tasks and activities
- `pipeline_stages` - Pipeline stage definitions
- `commission_templates` - Commission structures
- `system_config` - System configuration (roles, modules, UI, etc.)
- `audit_log` - Configuration change audit trail

## MOCKED Integrations
- **Odoo ERP** - Settings pages exist, no actual data sync
- **Microsoft 365** - Settings pages exist, no actual email/calendar sync
- **Sales metrics** - Calculated from local closed opportunities

## Test Reports
- `/app/test_reports/iteration_1.json` - MVP testing
- `/app/test_reports/iteration_2.json` - AM Dashboard testing
- `/app/test_reports/iteration_3.json` - Super Admin Config testing (100% pass)
