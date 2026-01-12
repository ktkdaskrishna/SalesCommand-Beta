# Sales Intelligence Platform - Product Requirements Document

## Overview
Enterprise-grade Sales CRM with ERP Integration, designed with a microservices architecture and three-zone Data Lake.

## Version
**v2.0.0** - Clean Rebuild (Phase 1 Complete)

---

## Original Problem Statement
The user has mandated a complete architectural rebuild of the application, transforming it into an enterprise-grade "Sales Intelligence Platform" with:

1. **Core Integrations:** Odoo ERP (v16+), with Microsoft 365 / Azure AD for SSO
2. **Data Lake Architecture:** Three-zone MongoDB Data Lake (Raw, Canonical, Serving)
3. **Modular Sync Engine:** Connector -> Mapper -> Validator -> Normalizer -> Loader -> Logger
4. **AI-Powered Features:** GPT-5.2 for intelligent field mapping with BYOK support
5. **Microservices Architecture:** Each integration as a separate service for scalability
6. **Docker-First Deployment:** Single `docker-compose up` command

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
│   └── integrations.py    # Integration management
└── services/
    ├── auth/
    │   └── jwt_handler.py # Token management
    ├── data_lake/
    │   └── manager.py     # Three-zone operations
    ├── odoo/
    │   └── connector.py   # REST API connector (v16+)
    └── ai_mapping/
        └── mapper.py      # LLM-powered field mapping
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
│   ├── Integrations.js    # Integration management
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
- [x] Odoo REST API connector (v16+ compatible)
- [x] AI field mapping service (with fallback rule-based)
- [x] Integration configuration endpoints
- [x] Modern dark-themed React frontend shell
- [x] Login page with demo credentials
- [x] Dashboard with Data Lake health visualization
- [x] Integrations page with Odoo configuration modal
- [x] Data Lake exploration page with zone tabs

---

## Upcoming Phases

### Phase 2: Odoo Sync Pipeline 🔜
- [ ] Complete ETL pipeline implementation
- [ ] Incremental sync with `write_date` tracking
- [ ] Field mapping persistence
- [ ] Sync job queue and status tracking
- [ ] Data validation rules

### Phase 3: AI Field Mapping
- [ ] GPT-5.2 integration for intelligent mapping
- [ ] Confidence scoring UI
- [ ] Human approval workflow
- [ ] Learning from confirmed mappings

### Phase 4: Dashboard & Serving Layer
- [ ] Aggregate accounts/opportunities to Serving Zone
- [ ] Sales dashboard from gold zone
- [ ] Role-based data visibility (RBAC)

### Phase 5: Additional Integrations
- [ ] Salesforce connector
- [ ] Microsoft 365 / Azure AD SSO
- [ ] HubSpot connector

### Phase 6: Production Hardening
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
- `POST /api/integrations/mappings/{type}/auto-map` - AI auto-mapping
- `POST /api/integrations/sync/{type}` - Trigger sync

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
