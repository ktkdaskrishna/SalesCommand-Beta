# 🗄️ Technical Reference - Database & API Endpoints

**Last Updated:** 2025-01-15
**Maintainer:** Development Team
**Status:** Active

---

## 📊 DATABASE CONFIGURATION

### Current Database
- **Database Name:** `test_database`
- **Connection:** `mongodb://localhost:27017`
- **Engine:** MongoDB
- **Environment File:** `/app/backend/.env`

### Environment Variables
```bash
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
```

---

## 🗃️ DATABASE COLLECTIONS

### Core Collections

#### 1. `users`
**Purpose:** Local user accounts with authentication and Odoo enrichment

**Key Fields:**
```javascript
{
  id: String,                    // UUID - Primary key
  email: String,                  // Unique email
  password_hash: String,          // Hashed password (empty for SSO)
  name: String,
  role: String,
  role_id: String,
  
  // Odoo Enrichment
  odoo_user_id: Number,           // res.users ID from Odoo
  odoo_employee_id: Number,       // hr.employee ID from Odoo
  odoo_salesperson_name: String,
  odoo_department_id: Number,
  odoo_team_id: Number,
  manager_odoo_id: Number,        // Employee ID of manager
  odoo_matched: Boolean,
  
  // Microsoft SSO
  ms_id: String,
  ms_access_token: String,
  auth_provider: String,
  
  // Metadata
  is_super_admin: Boolean,
  is_active: Boolean,
  approval_status: String,
  created_at: Date,
  updated_at: Date,
  last_login: Date
}
```

**Indexes:**
```javascript
db.users.createIndex({ "email": 1 }, { unique: true })
db.users.createIndex({ "odoo_employee_id": 1 })
db.users.createIndex({ "manager_odoo_id": 1 })
db.users.createIndex({ "odoo_user_id": 1 })
```

---

#### 2. `data_lake_serving`
**Purpose:** Aggregated data from Odoo ready for serving to APIs

**Key Fields:**
```javascript
{
  entity_type: String,            // "opportunity", "account", "user", etc.
  serving_id: String,             // Unique ID for this entity
  data: Object,                   // Full entity data from Odoo
  
  // Soft Delete Support
  is_active: Boolean,             // false = soft deleted
  deleted_at: Date,
  delete_reason: String,
  
  // Metadata
  source: String,                 // "odoo"
  last_aggregated: Date,
  created_at: Date,
  updated_at: Date
}
```

**Entity Types:**
- `opportunity` - CRM leads/deals
- `account` - Companies/partners (is_company=true)
- `contact` - Individual contacts (is_company=false)
- `user` - Odoo employees (hr.employee)
- `activity` - Business activities
- `invoice` - Customer invoices

**Indexes:**
```javascript
db.data_lake_serving.createIndex({ "entity_type": 1, "serving_id": 1 }, { unique: true })
db.data_lake_serving.createIndex({ "entity_type": 1, "is_active": 1 })
db.data_lake_serving.createIndex({ "entity_type": 1, "data.id": 1 })
```

---

#### 3. `integrations`
**Purpose:** Configuration for external integrations

**Key Fields:**
```javascript
{
  id: String,
  integration_type: String,       // "odoo", "ms365"
  enabled: Boolean,
  config: Object,                 // Integration-specific config
  last_sync: Date,
  sync_status: String,
  error_message: String,
  created_at: Date,
  updated_at: Date
}
```

**Integration Types:**
- `odoo` - Odoo ERP integration
- `ms365` - Microsoft 365 integration

---

#### 4. `sync_logs`
**Purpose:** Track sync job history and status

**Key Fields:**
```javascript
{
  id: String,
  started_at: Date,
  completed_at: Date,
  status: String,                 // "running", "completed", "failed"
  trigger: String,                // "scheduled", "manual", "webhook"
  triggered_by: String,           // User ID (for manual triggers)
  duration_seconds: Number,
  stats: Object,                  // Per-entity sync stats
  error_message: String
}
```

---

## 🌐 API ENDPOINTS

### Authentication Endpoints
**Base Path:** `/api/auth`

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| POST | `/auth/login` | Login with email/password | No |
| POST | `/auth/register` | Register (DISABLED) | No |
| POST | `/auth/refresh` | Refresh JWT token | Yes |
| GET | `/auth/me` | Get current user | Yes |
| GET | `/auth/users` | List all users | Yes (Admin) |
| GET | `/auth/microsoft/config` | Get MS365 config | No |
| POST | `/auth/microsoft/complete` | Complete MS SSO | No |
| POST | `/auth/relink-odoo` | Self-service Odoo linking | Yes |

**Files:**
- `/app/backend/routes/auth.py`

---

### Sales & Dashboard Endpoints
**Base Path:** `/api`

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | `/opportunities` | List opportunities | Yes |
| POST | `/opportunities` | Create opportunity | Yes |
| GET | `/opportunities/{id}` | Get opportunity details | Yes |
| GET | `/sales/dashboard/real` | Get dashboard (Odoo data) | Yes |
| GET | `/receivables` | Get invoices | Yes |
| GET | `/accounts/real` | Get accounts | Yes |
| GET | `/activities` | List activities | Yes |
| GET | `/activities/opportunity/{id}` | Get activities for opp | Yes |

**Files:**
- `/app/backend/routes/sales.py`

---

### Integration Endpoints
**Base Path:** `/api/integrations`

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | `/integrations/` | List integrations | Yes (Admin) |
| POST | `/integrations/odoo/configure` | Configure Odoo | Yes (Admin) |
| POST | `/integrations/odoo/test` | Test Odoo connection | Yes (Admin) |
| POST | `/integrations/odoo/sync-users` | Sync users from Odoo | Yes (Admin) |
| POST | `/integrations/odoo/sync/trigger` | **[PHASE 2]** Manual sync | Yes (Admin) |
| GET | `/integrations/sync/{sync_id}` | **[PHASE 2]** Get sync status | Yes (Admin) |
| GET | `/integrations/sync/logs` | Get sync logs | Yes (Admin) |
| GET | `/integrations/background-sync/status` | Get background sync status | Yes (Admin) |
| GET | `/integrations/background-sync/health` | Get sync health metrics | Yes (Admin) |

**Files:**
- `/app/backend/routes/integrations.py`
- `/app/backend/services/sync/background_sync.py`

---

### Webhook Endpoints
**Base Path:** `/api/webhooks`

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| POST | `/webhooks/odoo` | Receive Odoo webhooks | No (HMAC) |
| GET | `/webhooks/status` | Get webhook config | Yes (Admin) |

**Security:** HMAC-SHA256 signature validation (Phase 3)

**Files:**
- `/app/backend/routes/webhooks.py`

---

## 🔐 AUTHENTICATION

### JWT Token Structure
```javascript
{
  id: String,          // User ID
  email: String,
  role: String,
  exp: Number,         // Expiration timestamp
  iat: Number          // Issued at timestamp
}
```

### Token Configuration
- **Secret Key:** `JWT_SECRET` (from .env)
- **Algorithm:** HS256
- **Expiration:** 24 hours (default)
- **Refresh:** Available via `/auth/refresh`

---

## 🔄 SYNC ARCHITECTURE

### Background Sync Service
- **Interval:** 5 minutes
- **Scheduler:** APScheduler
- **Entities Synced:**
  - Accounts (res.partner, is_company=true)
  - Opportunities (crm.lead)
  - Invoices (account.move)
  - Users (hr.employee)
  - Activities (mail.activity)
  - Contacts (res.partner, is_company=false)

### Soft Delete Pattern
- Records deleted in Odoo are marked `is_active: false`
- Not physically deleted from database
- Filtered out by `active_entity_filter()` helper

---

## 📁 KEY FILE LOCATIONS

### Backend
```
/app/backend/
├── routes/
│   ├── auth.py                 # Authentication endpoints
│   ├── sales.py                # Sales & dashboard APIs
│   ├── integrations.py         # Integration management
│   └── webhooks.py             # Webhook receivers
├── services/
│   └── sync/
│       └── background_sync.py  # Background sync service
├── integrations/
│   └── odoo/
│       └── connector.py        # Odoo API connector
├── core/
│   ├── database.py             # MongoDB connection
│   └── config.py               # Settings
└── .env                        # Environment variables
```

### Frontend
```
/app/frontend/
├── src/
│   ├── pages/
│   │   ├── Dashboard.js
│   │   ├── Integrations.js     # Integration management UI
│   │   └── Accounts.js
│   ├── services/
│   │   └── api.js              # API client with auth
│   └── components/
│       └── ui/                 # Shadcn components
└── .env                        # Frontend config
```

---

## 🔧 CONFIGURATION FILES

### Backend Environment
**File:** `/app/backend/.env`
```bash
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
JWT_SECRET="your-secret-key"
ODOO_WEBHOOK_SECRET=""  # [PHASE 3] To be added
BACKEND_URL="http://localhost:8001"
REACT_APP_BACKEND_URL="https://your-domain.com"
```

### Frontend Environment
**File:** `/app/frontend/.env`
```bash
REACT_APP_BACKEND_URL="https://your-domain.com"
```

---

## 📝 UPDATE LOG

| Date | Change | Updated By |
|------|--------|------------|
| 2025-01-15 | Initial documentation created | E1 Agent |
| 2025-01-15 | Phase 1 implementation started | E1 Agent |

---

**Note:** This document should be updated whenever:
- New endpoints are added
- Database schema changes
- Collections are added/modified
- Environment variables change
- API authentication changes
