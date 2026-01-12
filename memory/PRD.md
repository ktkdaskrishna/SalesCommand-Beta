# Sales Intelligence Platform - Product Requirements Document

## Overview
Enterprise-grade Sales CRM with ERP Integration, designed with a microservices architecture and three-zone Data Lake.

## Version
**v2.2.0** - RBAC & Admin Panel (Jan 12, 2026)

---

## Original Problem Statement
The user has mandated a complete architectural rebuild of the application, transforming it into an enterprise-grade "Sales Intelligence Platform" with:

1. **Core Integrations:** Odoo ERP (v16+), with Microsoft 365 / Azure AD for SSO
2. **Data Lake Architecture:** Three-zone MongoDB Data Lake (Raw, Canonical, Serving)
3. **Modular Sync Engine:** Connector -> Mapper -> Validator -> Normalizer -> Loader -> Logger
4. **AI-Powered Features:** GPT-5.2 for intelligent field mapping with BYOK support
5. **Microservices Architecture:** Each integration as a separate service for scalability
6. **Docker-First Deployment:** Single `docker-compose up` command
7. **Role-Based Access Control:** Configurable roles, permissions, and data scoping

---

## Odoo Models Reference (v16+)
Key Odoo models used for sync:
- **res.partner** - Accounts (is_company=True) and Contacts (is_company=False)
- **crm.lead** - Opportunities/CRM Leads
- **sale.order** - Sales Orders
- **account.move** - Invoices

Odoo Field Types:
- Char, Text, Boolean, Integer, Float, Date, Datetime, Selection
- Many2one returns [id, name] tuple

Automatic Odoo Fields: id, create_date, create_uid, write_date, write_uid

---

## Architecture

### Backend Structure
```
/app/backend/
├── server.py              # Main FastAPI application
├── core/
│   ├── config.py          # Settings with BYOK support
│   └── database.py        # MongoDB + Data Lake zones
├── models/
│   └── base.py            # Pydantic models (User, DataLake, Mapping, Sync)
├── routes/
│   ├── auth.py            # JWT authentication
│   ├── data_lake.py       # Data Lake API endpoints
│   ├── integrations.py    # Integration management + Sync
│   └── webhooks.py        # Real-time sync webhooks (stub)
├── services/
│   ├── auth/
│   │   └── jwt_handler.py # Token management
│   ├── data_lake/
│   │   └── manager.py     # Three-zone operations
│   ├── odoo/
│   │   └── connector.py   # REST API connector (v16+)
│   ├── sync/
│   │   ├── service.py     # Sync service with custom mapping support
│   │   └── scheduler.py   # Scheduled sync (stub)
│   └── ai_mapping/
│       └── mapper.py      # LLM-powered field mapping
└── tests/
    └── test_sync_modal_api.py  # API tests
```

### Frontend Structure
```
/app/frontend/src/
├── App.js                 # Main routing
├── context/
│   └── AuthContext.js     # Authentication state
├── services/
│   └── api.js             # API client
├── pages/
│   ├── Login.js           # Authentication
│   ├── Dashboard.js       # Data Lake health + Integrations
│   ├── Integrations.js    # Integration management + Sync Modal
│   ├── FieldMapping.js    # AI Field Mapping UI
│   └── DataLake.js        # Data exploration
└── components/
    ├── Layout.js          # Sidebar navigation
    └── ui/                # Shadcn components
```

### Data Lake Zones
| Zone | Collection | Purpose |
|------|------------|---------|
| Raw (Bronze) | `data_lake_raw` | Unmodified source data |
| Canonical (Silver) | `data_lake_canonical` | Normalized, validated |
| Serving (Gold) | `data_lake_serving` | Aggregated, dashboard-ready |

---

## Completed Work

### Phase 1: Foundation Shell ✅ (Jan 12, 2026)
- [x] Clean modular backend architecture
- [x] Core configuration with BYOK support for AI keys
- [x] MongoDB Data Lake with 3 zones (Raw, Canonical, Serving)
- [x] JWT authentication system
- [x] Data Lake health API endpoints
- [x] Odoo REST API connector (v16+ compatible) with URL normalization
- [x] AI field mapping service (with fallback rule-based)
- [x] Integration configuration endpoints
- [x] Modern dark-themed React frontend shell
- [x] Login page with demo credentials
- [x] Dashboard with Data Lake health visualization
- [x] Integrations page with Odoo configuration modal (scrollable, user-friendly)
- [x] Data Lake exploration page with zone tabs

### Phase 2: Expanded Sync & Field Mapping UI ✅ (Jan 12, 2026)
- [x] Extended Odoo sync to support 5 entity types: Account, Contact, Opportunity, Order, Invoice
- [x] Added normalization logic for Orders and Invoices
- [x] Extended canonical schemas for all entity types
- [x] AI Field Mapping UI with 3-column layout (Source Fields | Mappings | Target Schema)
- [x] AI Auto-Map button with confidence scores
- [x] Default mappings fallback when AI unavailable
- [x] Save/Load mapping configurations
- [x] Help dialog explaining field mapping concepts

### Phase 2.1: Multi-Entity Sync Modal ✅ (Jan 12, 2026)
- [x] **Sync Modal UI** - Select specific Odoo objects to sync (Accounts, Contacts, Opportunities, Orders, Invoices)
- [x] **Entity Selection Toggles** - Interactive checkboxes with visual feedback
- [x] **Dynamic Button Count** - "Start Sync (N)" shows selected entity count
- [x] **Backend Entity Types** - Sync endpoint accepts entity_types in request body
- [x] **Custom Field Mapping Integration** - Sync service loads and uses saved field mappings
- [x] **_apply_custom_mappings()** - Transforms records using user-defined mappings with transforms

### Phase 2.2: Microsoft 365 SSO Integration ✅ (Jan 12, 2026)
- [x] **MSAL Library Integration** - Frontend uses @azure/msal-browser for proper SPA OAuth flow
- [x] **Microsoft SSO Button** - "Sign in with Microsoft" on login page
- [x] **Backend Config Endpoint** - GET /api/auth/microsoft/config returns client_id and tenant_id
- [x] **Backend Complete Endpoint** - POST /api/auth/microsoft/complete validates tokens via Microsoft Graph API
- [x] **User Creation/Update** - SSO users are created or updated in the database with ms_id
- [x] **Popup/Redirect Fallback** - MSAL popup with fallback to redirect if blocked
- [x] **Error Handling** - Proper handling for user cancellation and popup blocked scenarios

---

## Upcoming Phases

### Phase 3: Real-Time Sync 🔜
- [ ] Implement Odoo webhooks in `/api/webhooks/odoo/{tenant_id}`
- [ ] Scheduled polling via `/backend/services/sync/scheduler.py`
- [ ] UI options for sync method (Manual, Webhook, Scheduled)
- [ ] Incremental sync with `write_date` tracking

### Phase 4: GPT-5.2 AI Mapping
- [ ] Integrate GPT-5.2 via `integration_playbook_expert_v2`
- [ ] BYOK (Bring Your Own Key) functionality
- [ ] Improved confidence scoring
- [ ] Learning from confirmed mappings

### Phase 5: Dashboard & Serving Layer
- [ ] Aggregate accounts/opportunities to Serving Zone
- [ ] Sales dashboard from gold zone
- [ ] Role-based data visibility (RBAC)

### Phase 6: Additional Integrations
- [x] **Microsoft 365 SSO** - MSAL-based authentication (COMPLETED)
- [ ] Microsoft 365 Data Sync - Emails, Calendar, Contacts via Graph API
- [ ] Salesforce connector
- [ ] HubSpot connector

### Phase 7: Production Hardening
- [ ] Celery/Redis background workers
- [ ] Comprehensive E2E testing
- [ ] Monitoring and logging
- [ ] Docker compose optimization

---

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - Login & get token
- `GET /api/auth/me` - Current user info
- `GET /api/auth/users` - List users (admin)
- `GET /api/auth/microsoft/config` - Get Microsoft OAuth config for frontend MSAL
- `POST /api/auth/microsoft/complete` - Complete Microsoft SSO (validates token via Graph API)

### Data Lake
- `GET /api/data-lake/health` - Zone health stats
- `GET /api/data-lake/raw` - Raw records (admin)
- `GET /api/data-lake/canonical` - Canonical records
- `GET /api/data-lake/serving` - Serving records

### Integrations
- `GET /api/integrations/` - List all integrations
- `POST /api/integrations/odoo/configure` - Configure Odoo
- `POST /api/integrations/odoo/test` - Test connection
- `GET /api/integrations/odoo/fields/{model}` - Get Odoo model fields

### Field Mappings
- `GET /api/integrations/mappings/{type}/{entity}` - Get saved mappings
- `POST /api/integrations/mappings/{type}` - Save field mappings
- `POST /api/integrations/mappings/{type}/auto-map` - AI auto-mapping

### Sync
- `POST /api/integrations/sync/{type}` - Trigger sync with entity_types body
- `GET /api/integrations/sync/status` - Get recent sync jobs
- `GET /api/integrations/sync/{job_id}` - Get sync job details

---

## Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@salescommand.com | demo123 |
| Account Manager | am1@salescommand.com | demo123 |

---

## Technology Stack
- **Backend:** FastAPI, Pydantic v2, Motor (async MongoDB)
- **Frontend:** React 19, Tailwind CSS, Shadcn/UI
- **Database:** MongoDB with Data Lake architecture
- **AI:** GPT-5.2 via Emergent LLM Key (BYOK supported)
- **Auth:** JWT with bcrypt password hashing
