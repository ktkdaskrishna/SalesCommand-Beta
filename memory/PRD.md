# Sales Intelligence Platform - Product Requirements Document

## Overview
An **Enterprise Sales Intelligence Platform** with multi-system integrations, Microsoft 365 SSO, a normalized extensible data lake, read-optimized Sales CRM dashboards, KPI & performance intelligence, and production-grade testing.

## Architecture Version: 2.0 (Data Lake)

---

## Core Architecture

### Data Lake (3-Zone Architecture)

```
┌─────────────────────────────────────────────────────────────────┐
│                      SOURCE SYSTEMS                              │
│  ┌─────────┐  ┌─────────────┐  ┌──────────┐  ┌─────────────┐   │
│  │  Odoo   │  │ Microsoft   │  │Salesforce│  │  HubSpot    │   │
│  │ERP v17+ │  │    365      │  │ (Future) │  │  (Future)   │   │
│  └────┬────┘  └──────┬──────┘  └────┬─────┘  └──────┬──────┘   │
└───────┼──────────────┼──────────────┼───────────────┼──────────┘
        │              │              │               │
        ▼              ▼              ▼               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SYNC ENGINE PIPELINE                          │
│  Connector → Mapper → Validator → Normalizer → Loader → Logger  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAKE                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  RAW ZONE (Immutable, Timestamped, Replayable)          │   │
│  │  - raw_odoo_partners, raw_odoo_leads, raw_odoo_activities│   │
│  │  - raw_ms365_users, raw_ms365_contacts                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  CANONICAL ZONE (Normalized, Unified Models)             │   │
│  │  - canonical_contacts, canonical_accounts                │   │
│  │  - canonical_opportunities, canonical_activities         │   │
│  │  - canonical_users                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  SERVING ZONE (Dashboard-Optimized, Pre-Aggregated)     │   │
│  │  - serving_dashboard_stats, serving_pipeline_summary    │   │
│  │  - serving_kpi_snapshots, serving_activity_feed         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SALES CRM DASHBOARD                          │
│        (Powered by Serving Zone - Role-Scoped RBAC)             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Backend Module Structure

```
/app/backend/
├── core/                       # Base classes and interfaces
│   ├── __init__.py
│   ├── base.py                 # BaseModel, BaseEntity, RawRecord
│   ├── config.py               # Settings, environment config
│   ├── enums.py                # EntityType, UserRole, SyncMode, etc.
│   ├── exceptions.py           # Custom exceptions
│   └── interfaces.py           # IConnector, IMapper, IValidator, etc.
│
├── data_lake/                  # Data Lake management
│   ├── __init__.py
│   ├── models.py               # Canonical entity models
│   ├── raw_zone.py             # Raw zone handler
│   ├── canonical_zone.py       # Canonical zone handler
│   ├── serving_zone.py         # Serving zone handler
│   └── manager.py              # DataLakeManager orchestrator
│
├── sync_engine/                # Sync pipeline
│   ├── __init__.py
│   ├── base_components.py      # Base connector, mapper, validator
│   ├── pipeline.py             # SyncPipeline orchestrator
│   └── worker.py               # Background job worker
│
├── integrations/               # External system connectors
│   ├── odoo/                   # Odoo ERP integration
│   │   ├── connector.py
│   │   ├── mapper.py
│   │   ├── validator.py
│   │   ├── normalizer.py
│   │   └── pipeline.py
│   └── microsoft365/           # Microsoft 365 SSO
│       ├── auth_provider.py
│       └── connector.py
│
├── api/                        # FastAPI routes
│   ├── data_lake.py            # /api/data-lake/*
│   ├── sync.py                 # /api/sync/*
│   ├── dashboard.py            # /api/dashboard/*
│   └── auth_ms365.py           # /api/auth/ms365/*
│
└── tests/                      # Test suite
    ├── unit/
    ├── integration/
    └── e2e/
```

---

## Implemented Features (Phase 1 Complete)

### ✅ Docker Configuration
- `docker-compose.yml` with services: frontend, backend, mongo, worker, redis
- Dockerfiles for backend and frontend
- MongoDB initialization script with Data Lake schema

### ✅ Core Module
- BaseModel, BaseEntity with source references
- Configuration management (Settings)
- Enumerations (EntityType, UserRole, SyncMode, etc.)
- Custom exceptions
- Interface definitions (IConnector, IMapper, IValidator, etc.)

### ✅ Data Lake Module
- RawZoneHandler - immutable source data storage
- CanonicalZoneHandler - normalized entity management with RBAC
- ServingZoneHandler - dashboard-optimized views
- DataLakeManager - orchestration layer

### ✅ Sync Engine
- Base pipeline components
- SyncPipeline orchestrator
- Background worker skeleton

### ✅ Odoo Integration (Refactored)
- OdooConnector (XML-RPC client)
- OdooMapper (Contact, Account, Opportunity, Activity, User)
- OdooValidator
- OdooNormalizer with reference resolution
- OdooSyncPipeline

### ✅ Microsoft 365 Integration (Skeleton)
- MS365AuthProvider (OAuth 2.0 / OpenID Connect)
- MS365Connector (Graph API client)
- SSO endpoints

### ✅ New API Routes
- `/api/data-lake/*` - Data lake operations
- `/api/sync/*` - Sync management
- `/api/dashboard/*` - Optimized dashboard endpoints
- `/api/auth/ms365/*` - Microsoft 365 SSO

### ✅ Unit Tests
- Core module tests
- Data lake model tests

---

## Pending Implementation

### Phase 2: Complete Sync Engine
- [ ] Wire OdooSyncPipeline to existing Odoo routes
- [ ] Implement incremental sync
- [ ] Background job scheduling

### Phase 3: Microsoft 365 SSO
- [ ] Complete OAuth flow integration
- [ ] User provisioning from M365
- [ ] Token refresh and session management

### Phase 4: Dashboard Migration
- [ ] Migrate existing dashboards to Serving Zone
- [ ] Implement hierarchical RBAC
- [ ] Performance optimization

### Phase 5: Testing Agent
- [ ] Comprehensive E2E test suite
- [ ] Automated test runner
- [ ] Test reports

---

## API Endpoints

### Existing (Preserved)
- `/api/auth/*` - Authentication (local)
- `/api/users/*` - User management
- `/api/accounts/*` - Account CRUD
- `/api/opportunities/*` - Opportunity CRUD
- `/api/activities/*` - Activity CRUD
- `/api/odoo/*` - Odoo integration
- `/api/config/*` - System configuration

### New (Data Lake Architecture)
- `/api/data-lake/health` - Data lake health check
- `/api/data-lake/stats` - Data lake statistics
- `/api/data-lake/entities/{type}` - Entity listing with RBAC
- `/api/sync/status` - Sync engine status
- `/api/sync/trigger` - Trigger sync job
- `/api/sync/history` - Sync history
- `/api/dashboard/overview` - Serving zone dashboard data
- `/api/auth/ms365/login` - M365 SSO login
- `/api/auth/ms365/callback` - M365 OAuth callback

---

## User Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@salescommand.com | demo123 |
| Account Manager | am1@salescommand.com | demo123 |
| Sales User (Odoo) | krishna@securado.net | password |

---

## Tech Stack

- **Frontend:** React, Tailwind CSS, Shadcn UI
- **Backend:** FastAPI, Python 3.11
- **Database:** MongoDB
- **Integrations:** Odoo (XML-RPC), Microsoft Graph API
- **Auth:** JWT (local), OAuth 2.0 (M365)
- **Deployment:** Docker, Docker Compose

---

## Last Updated
January 11, 2026 - Phase 1 (Foundation) Complete
