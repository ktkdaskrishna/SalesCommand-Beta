# Securado Enterprise Sales Platform - Product Requirements Document

## Project Overview
**Name:** Securado Enterprise Sales Platform  
**Version:** 3.2 (ERP-Style Account Management)  
**Last Updated:** January 10, 2026  
**Tech Stack:** FastAPI (Python) + React + MongoDB

## Original Problem Statement
Build an Enterprise Sales KPI, Incentive & Activity Management Platform with configuration-driven architecture where only Super Admin is hardcoded.

## Core Principle
- **Only Super Admin login is hardcoded**
- All other user experiences are 100% driven by configuration
- Account/Organization uses single data model - managed by Admin only
- Sales users can only view accounts assigned to them

---

## What's Been Implemented

### Version 3.2 - ERP-Style Account Management (January 10, 2026) ✅ NEW

#### Phase 1: Account Field Definitions ✅
- **22 configurable fields** across 6 sections
- Field types: text, textarea, number, currency, date, dropdown, multi-select, checkbox, URL, email, phone, file, rich_text, relationship, computed
- System fields (non-deletable): Company Name, Industry, Relationship Status, Account Manager
- Custom field creation with validation rules
- Show in List / Show in Card toggles

#### Phase 2: Account Layout Builder ✅
- 6 default sections: Basic Info, Financial, ERP Summary, Primary Contact, Address, Notes
- Configurable column layouts (1-4 columns per section)
- Drag-ready interface for field arrangement
- Add/edit sections with icons

#### Phase 3: Account Management (Admin Only) ✅
- **"Create Account" button only visible to super_admin and ceo**
- Sales users cannot create accounts
- Account creation with all configurable fields
- Account assignment to Account Managers

#### Phase 4: Enrich Button (Odoo Integration) ✅ MOCKED
- **"Enrich" button** on each account row
- Fetches mock data from Odoo (orders, invoices)
- Auto-calculates: Total Orders, Total Invoiced, Total Paid, Outstanding
- Stores enrichment data on account record
- Separate API endpoints for /accounts/{id}/orders and /accounts/{id}/invoices

#### Summary Cards ✅
- Total Accounts count
- Total Budget (aggregated)
- Total Orders (from Odoo enrichment)
- Outstanding Amount (calculated)

---

### Previous Implementations

#### User-Department Assignment ✅
- Department column in User Management table
- Department dropdown in Create/Edit User modals

#### AI Agent → LLM Provider Mapping ✅
- Edit Agent modal includes LLM Provider dropdown
- Visual indicators for API key status

#### Phase 2 Super Admin Configuration ✅
- Organization settings
- Department management
- Multi-provider LLM configuration
- AI Agents and Chatbot
- Blue Sheet contact roles
- Securado branding

---

## API Endpoints

### Account Fields Configuration
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/config/account-fields` | GET | Get field definitions |
| `/api/config/account-fields` | PUT | Update all fields |
| `/api/config/account-fields/field` | POST | Add custom field |
| `/api/config/account-fields/field/{id}` | PUT | Update field |
| `/api/config/account-fields/field/{id}` | DELETE | Delete field |
| `/api/config/account-fields/layout` | PUT | Update layout |
| `/api/config/account-fields/section` | POST | Add section |

### Account Enrich (Odoo)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/accounts/{id}/enrich` | POST | Fetch Odoo data (MOCKED) |
| `/api/accounts/{id}/orders` | GET | Get orders |
| `/api/accounts/{id}/invoices` | GET | Get invoices |

### Accounts (Permission Protected)
| Endpoint | Method | Permission |
|----------|--------|------------|
| `/api/accounts` | POST | super_admin, ceo only |
| `/api/accounts` | GET | All (filtered by assignment) |

---

## Default Account Field Sections

| Section | Fields | Columns |
|---------|--------|---------|
| Basic Information | Company Name, Industry, Website, Employee Count, Relationship Status, Account Manager | 2 |
| Financial | Total Budget, Annual Revenue, Contract Value, Renewal Date | 2 |
| ERP Summary | Total Orders, Total Invoiced, Total Paid, Outstanding (computed) | 4 |
| Primary Contact | Name, Email, Phone | 3 |
| Address | Address, City, Country | 3 |
| Notes | Business Overview, Strategic Notes | 1 |

---

## Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@salescommand.com | demo123 |

---

## Prioritized Backlog

### P0 - Completed ✅
- [x] Account Field Definitions
- [x] Account Layout Builder
- [x] Admin-only Account Creation
- [x] Enrich Button (Mocked Odoo)
- [x] User-Department Assignment
- [x] AI Agent-LLM Provider Mapping

### P1 - High Priority (Next)
- [ ] **Real Odoo Integration** - Replace mock with actual Odoo API calls
- [ ] **Account Detail Page** - Full ERP view with tabs (Overview, Orders, Invoices, Activities, Blue Sheet, Documents)
- [ ] **Hierarchical Data Visibility** - Frontend filtering based on role's data_access_level
- [ ] **User Invitation Flow** - Email-based password setup

### P2 - Medium Priority
- [ ] **Drag-and-drop field reordering** in layout builder
- [ ] **Document upload** to accounts
- [ ] **Microsoft 365 Calendar/Email Integration**
- [ ] **CEO Dashboard** - Cross-department visibility

### P3 - Future
- [ ] Dashboard widget customization
- [ ] Advanced reporting/exports
- [ ] Active Directory Integration

---

## Technical Architecture

### Backend Structure
```
/app/backend/
├── server.py              # Main FastAPI application
├── config_models.py       # ~1800 lines - All configuration models including AccountFieldsConfig
├── config_routes.py       # ~1600 lines - Configuration API routes including account fields
└── .env
```

### Frontend Structure
```
/app/frontend/src/
├── pages/
│   ├── SuperAdminConfig.js  # ~3100 lines - Admin config with AccountFieldsTab
│   ├── Accounts.js          # Updated with Enrich, permission controls
│   └── ...
└── ...
```

### Database Collections
- `users` - User accounts with department_id
- `accounts` - Customer accounts (enriched with orders, invoices from Odoo)
- `system_config` - Master configuration including account_fields

---

## MOCKED Integrations
- **Odoo ERP** - Enrich endpoint generates random mock orders/invoices
- **Microsoft 365** - Settings exist, no actual sync

---

## Workflow Summary

### Account Lifecycle
```
1. Super Admin defines fields (System Config → Account Fields)
2. Super Admin creates account (Accounts → Create Account)
3. Super Admin assigns Account Manager
4. AM or Admin clicks "Enrich" to sync from Odoo
5. Sales users view assigned accounts (read-only)
6. Orders/Invoices populate from Odoo
7. Calculated fields auto-update (Outstanding, Totals)
```

### Permission Matrix
| Action | Super Admin | CEO | HOD | AM | Sales |
|--------|-------------|-----|-----|----|----|
| Create Account | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit Account | ✅ | ✅ | ❌ | ❌ | ❌ |
| View Account | ✅ | ✅ | ✅* | ✅* | ✅* |
| Enrich Account | ✅ | ✅ | ❌ | ✅* | ❌ |
| Configure Fields | ✅ | ❌ | ❌ | ❌ | ❌ |

*Filtered to assigned accounts only
