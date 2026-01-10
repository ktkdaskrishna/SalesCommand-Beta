# Securado Enterprise Sales Platform - Product Requirements Document

## Project Overview
**Name:** Securado Enterprise Sales Platform  
**Version:** 3.1 (Configuration-Driven Enterprise Architecture)  
**Last Updated:** January 10, 2026  
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

### Version 3.1 - Latest Updates (January 10, 2026)

#### User-Department Assignment ✅ NEW
- Department column added to User Management table
- Department dropdown in Create/Edit User forms
- Department color-coded badges in user list
- Backend support for `department_id` field on users
- Nullable field handling for removing department assignments

#### AI Agent → LLM Provider Mapping ✅ NEW
- AI Agents tab shows which LLM provider each agent uses
- Edit Agent modal includes LLM Provider dropdown
- Provider selection from configured LLM providers (OpenAI, Google, Ollama)
- Visual indicators for API key status (configured/not configured)
- Warning when provider API key not configured
- Test button disabled when API key missing
- Model dropdown organized by provider (OpenAI, Google Gemini, Ollama)

---

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
- Qualification requirements

#### 6. Multi-Provider LLM Configuration ✅
- **OpenAI** (default, enabled)
- **Google Gemini** (configurable)
- **Ollama** (for local/private models)
- Cost tracking and rate limiting
- Test connection functionality

#### 7. AI Chatbot ✅
- Disabled by default
- Configurable per role access
- Name: "Securado Assistant"
- LLM provider selection
- System prompt customization

#### 8. AI Agents ✅
- Opportunity Probability Analyzer
- Sales Pipeline Insights
- Deal Coach
- Activity Suggester
- Configurable prompts and models
- **LLM Provider assignment per agent** ✅ NEW

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

---

## API Endpoints

### Configuration APIs
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/config/system` | GET | Full system configuration |
| `/api/config/organization` | GET/PUT | Organization settings |
| `/api/config/departments` | GET/POST | Department management |
| `/api/config/departments/{id}` | PUT/DELETE | Department CRUD |
| `/api/config/users` | GET/POST | User management |
| `/api/config/users/{id}` | PUT/DELETE | User CRUD with department_id |
| `/api/config/users/{id}/reset-password` | POST | Reset password |
| `/api/config/contact-roles` | GET/PUT | Blue Sheet contact roles |
| `/api/config/llm-providers` | GET/PUT | LLM providers |
| `/api/config/ai-agents` | GET/PUT/POST | AI agents |
| `/api/config/ai-agents/{id}` | PUT/DELETE | Agent CRUD |
| `/api/config/ai-agents/{id}/test` | POST | Test agent |
| `/api/config/ai-chatbot` | GET/PUT | Chatbot config |

---

## Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@salescommand.com | demo123 |

---

## Prioritized Backlog

### P0 - Critical (COMPLETED) ✅
- [x] Organization settings
- [x] Department management
- [x] User management with department assignment
- [x] Multi-provider LLM configuration
- [x] AI Agent → LLM Provider mapping
- [x] Blue Sheet contact roles
- [x] Securado branding

### P1 - High Priority (Next Phase)
- [ ] **Hierarchical Data Visibility** - Frontend filtering based on role's `data_access_level`
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
- [ ] Fix ESLint `react-hooks/exhaustive-deps` warnings

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
│   ├── SuperAdminConfig.js  # ~2100 lines - Admin configuration UI
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
- `users` - User accounts (includes `department_id`)
- `accounts` - Customer/organization accounts
- `opportunities` - Sales opportunities
- `activities` - Tasks and activities
- `organization_contacts` - Blue Sheet contacts per org
- `user_invitations` - Pending user invitations
- `system_config` - Master configuration document
- `audit_log` - Configuration change history

---

## MOCKED Integrations (Pending Implementation)
- **Odoo ERP** - Settings exist, no actual sync
- **Microsoft 365 Email** - Settings exist, email sending not implemented
- **Microsoft 365 Calendar** - Not implemented

---

## Test Reports
- `/app/test_reports/iteration_5.json` - User-Department Assignment testing (92% pass rate)
- `/app/tests/test_user_department_assignment.py` - Comprehensive test suite

---

## Recent Changes (January 10, 2026)
1. Added Department column to User Management table
2. Added Department dropdown in Create/Edit User modals
3. Updated backend to handle `department_id` field properly
4. Fixed nullable field handling for removing department assignments
5. Added AI Agent → LLM Provider mapping in Edit Agent modal
6. Added visual indicators for LLM provider API key status
7. Organized model dropdown by provider type
