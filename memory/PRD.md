# Securado Enterprise Sales Platform - Product Requirements Document

## Project Overview
**Name:** Securado Enterprise Sales Platform  
**Version:** 3.0 (CEO-Grade Enterprise Architecture)  
**Date:** January 10, 2026  
**Tech Stack:** FastAPI (Python) + React + MongoDB

## Original Problem Statement
Build an Enterprise Sales KPI, Incentive & Activity Management Platform with:
- Role-based dashboards (CEO, Product Directors, Account Managers, Strategy Team)
- Account & Opportunity Management with Blue Sheet methodology
- Activity Management and KPI tracking
- Configurable integrations for Odoo ERP and Office 365
- AI-powered sales insights
- **Phase 3: CEO-Grade configuration-driven architecture where only Super Admin is hardcoded**

## Core Principle (Phase 3)
- **Only Super Admin login is hardcoded**
- All other user experiences are 100% driven by configuration
- When Super Admin assigns a role, all features, data visibility, AI access auto-activate
- System functions as a real enterprise SaaS product

## Brand Identity (Securado)
- **Primary Colors:** Maroon (#800000), Dark Gray (#333333)
- **Accent Colors:** Asparagus (#86c881), Orange Soda (#ee6543), Grayish Yellow (#e0dfd4)
- **Typography:** Proxima Nova
- **Tagline:** "Digital Vaccine for Cyber Immunity"

---

## What's Been Implemented

### Version 3.0 - CEO-Grade Enterprise Architecture (COMPLETED)

#### 1. Organization Configuration ✅
- Company-wide settings management
- Timezone, currency, fiscal year configuration
- Quota period settings (monthly/quarterly/yearly)
- Default commission rate configuration
- Feature toggles (AI features, referral program)

#### 2. Department Management ✅
- Create/edit/delete departments
- Department hierarchy support
- Team structure within departments
- HOD assignment capability
- Department-based data access control

**Default Departments:**
- Sales (SALES)
- Strategy (STRATEGY)
- Product (PRODUCT)
- Finance (FINANCE)

#### 3. Hierarchical Data Access ✅
- CEO → All data across all departments
- HOD → Department-level data only
- Team Members → Self-owned data only
- Configurable per role via data_access settings

#### 4. User Management ✅
- Full CRUD operations for users
- Role assignment
- Department/team mapping
- Quota configuration per user
- Password reset functionality
- User invitation system (token-based)

#### 5. Blue Sheet Contact Roles ✅
- Economic Buyer, User Buyer, Technical Buyer
- Coach, Champion, Influencer, Decision Maker
- Configurable importance weights (1-10)
- Qualification requirements:
  - Require Economic Buyer: ✅
  - Require Coach: ✅
  - Min contacts for qualification: 3

#### 6. Multi-Provider LLM Configuration ✅
- **OpenAI** (default, enabled)
  - Model: gpt-4o
  - Uses Emergent LLM Key
- **Google Gemini** (configurable)
  - Model: gemini-1.5-pro
- **Ollama** (for local/private models)
  - Self-hosted option
- Cost tracking and rate limiting
- Test connection functionality

#### 7. AI Chatbot ✅
- Disabled by default
- Configurable per role access
- Name: "Securado Assistant"
- LLM provider selection
- System prompt customization
- Rate limiting per user

#### 8. AI Agents ✅
- Opportunity Probability Analyzer
- Sales Pipeline Insights
- Deal Coach
- Activity Suggester
- Configurable prompts and models
- Test functionality with sample data

#### 9. Email Configuration ✅
- Office 365 as primary provider
- User invitation emails
- Password reset emails
- Template customization

#### 10. UI & Branding (Securado) ✅
- Securado brand colors as default
- Proxima Nova typography
- Dark sidebar theme
- Logo upload support
- Theme customization

---

## API Endpoints (Phase 3)

### Configuration
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/config/system` | GET | Full system configuration |
| `/api/config/organization` | GET/PUT | Organization settings |
| `/api/config/departments` | GET/PUT/POST | Department management |
| `/api/config/departments/{id}` | PUT/DELETE | Department CRUD |
| `/api/config/departments/{id}/teams` | POST | Create team |
| `/api/config/users` | GET | All users (admin) |
| `/api/config/users` | POST | Create user |
| `/api/config/users/{id}` | PUT/DELETE | Update/deactivate user |
| `/api/config/users/{id}/role` | PUT | Assign role |
| `/api/config/users/{id}/reset-password` | POST | Reset password |
| `/api/config/users/invite` | POST | Send invitation |
| `/api/config/users/invitations` | GET | Pending invitations |
| `/api/config/contact-roles` | GET/PUT | Blue Sheet contact roles |
| `/api/config/llm-providers` | GET/PUT | LLM providers |
| `/api/config/llm-providers/{id}` | PUT/DELETE | Provider CRUD |
| `/api/config/llm/test-connection` | POST | Test LLM connection |
| `/api/config/ai-chatbot` | GET/PUT | Chatbot config |
| `/api/config/ai-chatbot/toggle` | POST | Enable/disable chatbot |
| `/api/config/ai-agents` | GET/PUT/POST | AI agents |
| `/api/config/ai-agents/{id}` | PUT/DELETE | Agent CRUD |
| `/api/config/ai-agents/{id}/test` | POST | Test agent |
| `/api/config/email` | GET/PUT | Email config |
| `/api/config/data-access/{role}` | GET/PUT | Role data access |

### Organization Contacts
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/organizations/{id}/contacts` | GET/POST | List/create contacts |
| `/api/organizations/{id}/contacts/{cid}` | PUT/DELETE | Update/delete contact |

---

## Demo Accounts
| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@salescommand.com | demo123 |
| CEO | ceo@salescommand.com | demo123 |
| Sales Director | sales.director@salescommand.com | demo123 |
| Account Manager | am1@salescommand.com | demo123 |
| Finance Manager | finance@salescommand.com | demo123 |
| Referrer | referrer@salescommand.com | demo123 |

---

## Prioritized Backlog

### P0 - Critical (COMPLETED) ✅
- [x] Organization settings
- [x] Department management
- [x] User management with invitations
- [x] Multi-provider LLM configuration
- [x] AI Chatbot framework
- [x] Blue Sheet contact roles
- [x] Data access hierarchy
- [x] Securado branding

### P1 - High Priority (Next Phase)
- [ ] **Dynamic Frontend Rendering** - Render UI based on role's assigned features
- [ ] **Implement Office 365 email sending** - Complete user invitation flow
- [ ] **Organization contacts UI** - Visual contact cards linked to accounts
- [ ] **CEO Dashboard** - Cross-department visibility and AI insights

### P2 - Medium Priority
- [ ] **Odoo ERP Integration** - Orders, invoices, collections sync
- [ ] **Microsoft 365 Calendar/Email Integration**
- [ ] **MFA Support** - Configurable multi-factor authentication
- [ ] **Active Directory Integration**

### P3 - Nice to Have
- [ ] Dashboard widget customization
- [ ] Advanced reporting/exports
- [ ] Mobile responsive improvements

---

## Technical Architecture

### Backend
```
/app/backend/
├── server.py              # Main FastAPI application
├── config_models.py       # ~1400 lines - All configuration models
├── config_routes.py       # ~1400 lines - Configuration API routes
└── .env                   # Environment variables
```

### Frontend
```
/app/frontend/src/
├── pages/
│   ├── SuperAdminConfig.js  # ~2000 lines - Admin configuration UI
│   ├── AccountManagerDashboard.js
│   ├── Dashboard.js
│   └── ...
├── components/
│   └── Layout.js
├── context/
│   └── AuthContext.js
└── services/
    └── api.js
```

### Database Collections
- `users` - User accounts
- `accounts` - Customer/organization accounts
- `opportunities` - Sales opportunities
- `activities` - Tasks and activities
- `organization_contacts` - Blue Sheet contacts per org
- `user_invitations` - Pending user invitations
- `system_config` - Master configuration document
- `audit_log` - Configuration change history
- `commission_templates` - Commission structures
- `pipeline_stages` - Pipeline stage definitions

---

## MOCKED Integrations (Pending Implementation)
- **Odoo ERP** - Settings exist, no actual sync
- **Microsoft 365 Email** - Settings exist, email sending not implemented
- **Microsoft 365 Calendar** - Not implemented

---

## Test Reports
- `/app/test_reports/iteration_1.json` - MVP testing
- `/app/test_reports/iteration_2.json` - AM Dashboard testing
- `/app/test_reports/iteration_3.json` - Super Admin Config testing
- `/app/test_reports/iteration_4.json` - Phase 2 Enhanced testing
