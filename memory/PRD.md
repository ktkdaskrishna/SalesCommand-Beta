# Enterprise Sales KPI, Incentive & Activity Management Platform - PRD

## Original Problem Statement
Build a highly configurable Enterprise Sales KPI, Incentive & Activity Management Platform driven by a Super Admin role. The platform integrates with Odoo ERP (versions 17, 18, 19) for bi-directional data synchronization with a user-friendly visual data flow interface.

## Core Architecture
- **Frontend:** React + Tailwind CSS + Shadcn/UI
- **Backend:** FastAPI (Python) + MongoDB
- **Integration:** Odoo ERP via JSON-RPC API
- **Drag & Drop:** @hello-pangea/dnd

## What's Been Implemented

### 1. Visual Data Flow Hub (Completed - Jan 11, 2026)
A simplified, user-friendly Odoo integration replacing complex field mapping:

**Features:**
- Visual canvas showing Odoo ↔ Platform data flow
- Drag-and-drop entity cards for sync enablement
- One-click Sync All button
- Conflict Resolution Policy (Odoo Master / Last Updated / Smart Merge)
- Real-time webhook endpoint for incoming Odoo data
- Sync history and logs panel
- Connection settings with auto-test

**Entities Supported:**
- Contacts & Companies (res.partner → accounts)
- Opportunities (crm.lead → opportunities)
- Activities (mail.activity → activities)

### 2. Expand to Full Window Feature (Completed - Jan 11, 2026)
Added expandable/fullscreen capability to:
- Visual Data Flow Hub
- Account Form Builder
- CRM Pipeline Kanban Board

Component: `/app/frontend/src/components/ExpandableContainer.js`

### 3. Odoo ERP Integration (Completed)
- JSON-RPC client for Odoo 17/18/19
- Authentication via API key
- Bi-directional sync support
- Webhook endpoint: `/api/webhooks/odoo` (for Odoo → Platform)
- Field mapping with auto-suggestions

### 4. Dynamic Account Entity (Completed)
- Odoo-style drag-and-drop form builder
- Configurable fields and layout by Super Admin
- Dynamic rendering on Account pages

### 5. Role-Based Access Control (Completed)
- Super Admin with full configuration access
- Account Manager role with limited data visibility
- Dynamic role creation with permission management

## Database Schema

### Collections:
- `users` - User accounts with roles
- `accounts` - Customer/company records (synced from Odoo res.partner)
- `opportunities` - Sales pipeline (synced from Odoo crm.lead)
- `activities` - Tasks/meetings (synced from Odoo mail.activity)
- `system_config` - Platform configuration including Odoo integration settings

### Odoo Integration Config:
```json
{
  "connection": {
    "url": "https://your-odoo.com",
    "database": "db_name",
    "username": "user@email.com",
    "api_key": "***",
    "is_connected": true,
    "odoo_version": "19.0+e"
  },
  "entity_mappings": [...],
  "conflict_policy": "odoo_master"
}
```

## API Endpoints

### Odoo Integration:
- `GET /api/odoo/config` - Get integration configuration
- `PUT /api/odoo/config/connection` - Update connection settings
- `POST /api/odoo/test-connection` - Test Odoo connectivity
- `GET /api/odoo/mappings` - Get all entity mappings
- `PUT /api/odoo/mappings/{id}/toggle` - Enable/disable sync for entity
- `GET /api/odoo/preview/{mapping_id}` - Preview data before sync
- `POST /api/odoo/sync/{mapping_id}` - Sync a single entity
- `POST /api/odoo/sync-all` - Sync all enabled entities
- `GET /api/odoo/sync-logs` - Get sync history
- `POST /api/odoo/webhook/incoming` - Receive webhooks from Odoo

## Current Status

### Working:
- ✅ Visual Data Flow Hub with entity cards
- ✅ Expand to full window feature
- ✅ Real Odoo connection (v19.0+e tested)
- ✅ Bi-directional sync with webhook support
- ✅ Account Form Builder
- ✅ CRM Pipeline Kanban
- ✅ Role-based access control

### Testing Credentials:
- Super Admin: `superadmin@salescommand.com` / `demo123`
- Odoo Instance: `https://securadotest.odoo.com`
- Odoo Database: `securadotest`
- Odoo User: `krishna@securado.net`

## Prioritized Backlog

### P0 (Critical):
- [x] Visual Data Flow Hub
- [x] Expand to full window feature
- [ ] Real-time webhook configuration in Odoo (user action required)

### P1 (High):
- [ ] Hierarchical data visibility (HOD, CEO roles)
- [ ] User invitation & password reset flow
- [ ] Microsoft 365 integration

### P2 (Medium):
- [ ] Active Directory/M365 login support
- [ ] Dashboard customization widgets
- [ ] In-app help & documentation
- [ ] Fix ESLint warnings

## Files of Reference

### Backend:
- `/app/backend/odoo_routes.py` - Odoo API routes
- `/app/backend/odoo_models.py` - Odoo Pydantic models
- `/app/backend/server.py` - Main FastAPI application

### Frontend:
- `/app/frontend/src/components/VisualDataFlowHub.js` - Visual sync UI
- `/app/frontend/src/components/ExpandableContainer.js` - Fullscreen wrapper
- `/app/frontend/src/components/AccountFormBuilder.js` - Form builder
- `/app/frontend/src/pages/AccountManagerDashboard.js` - CRM Kanban
- `/app/frontend/src/pages/SuperAdminConfig.js` - Admin panel

## Webhook Setup for Real-Time Sync

To enable real-time sync from Odoo to this platform:

1. Open Odoo Studio → Automations
2. Create automation for each model (res.partner, crm.lead, mail.activity)
3. Set trigger: On Creation / On Update
4. Add action: "Send Webhook" to: `{PLATFORM_URL}/api/webhooks/odoo`
5. Payload format:
```json
{
  "model": "res.partner",
  "event": "create|update|delete",
  "record_id": 123,
  "data": { ... }
}
```
