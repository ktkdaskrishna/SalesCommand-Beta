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

### 2. Auto User Mapping from Odoo (Completed - Jan 11, 2026)
- Automatically syncs Odoo users to platform users
- Creates `account_manager` accounts for Odoo salespeople
- Auto-assigns accounts and opportunities based on Odoo's `user_id` (salesperson) field
- Maps Odoo user IDs to platform user IDs for seamless data ownership

**Sync Flow:**
1. `POST /api/odoo/sync-users` - Creates/maps Odoo users to platform
2. `POST /api/odoo/sync-all` - Syncs all data with auto-assignment

### 3. Expand to Full Window Feature (Completed - Jan 11, 2026)
Added expandable/fullscreen capability to:
- Visual Data Flow Hub
- Account Form Builder
- CRM Pipeline Kanban Board

Component: `/app/frontend/src/components/ExpandableContainer.js`

### 4. Demo Data Cleanup
- Cleared all demo/seed data
- Only real Odoo data remains in the system
- Super Admin account preserved

## Database Schema

### Collections:
- `users` - User accounts with roles + `odoo_user_id` mapping
- `accounts` - Customer/company records (synced from Odoo res.partner)
- `opportunities` - Sales pipeline (synced from Odoo crm.lead)
- `activities` - Tasks/meetings (synced from Odoo mail.activity)
- `system_config` - Platform configuration including Odoo integration settings

### User with Odoo Mapping:
```json
{
  "id": "uuid",
  "email": "krishna@securado.net",
  "name": "krishna@securado.net",
  "role": "account_manager",
  "odoo_user_id": 2  // Links to Odoo res.users
}
```

## API Endpoints

### Odoo Integration:
- `GET /api/odoo/config` - Get integration configuration
- `PUT /api/odoo/config/connection` - Update connection settings
- `POST /api/odoo/test-connection` - Test Odoo connectivity
- `POST /api/odoo/sync-users` - **NEW** Sync Odoo users to platform
- `POST /api/odoo/sync/{mapping_id}` - Sync a single entity
- `POST /api/odoo/sync-all` - Sync all enabled entities (includes user sync)
- `POST /api/odoo/webhook/incoming` - Receive webhooks from Odoo

## Current Status

### Working:
- ✅ Visual Data Flow Hub with entity cards
- ✅ Auto user mapping from Odoo salespeople
- ✅ Auto-assignment of accounts/opportunities to platform users
- ✅ Real Odoo connection (v19.0+e tested)
- ✅ Bi-directional sync with webhook support
- ✅ Expand to full window feature

### Current Data:
- **Users:** 2 (Admin Master + krishna@securado.net)
- **Accounts:** 2 (Securado.Test, MUSCAT OVERSEAS)
- **Opportunities:** 1 (Firewall → Owner: krishna@securado.net)

### Testing Credentials:
- **Super Admin:** `superadmin@salescommand.com` / `demo123`
- **Account Manager:** `krishna@securado.net` / `changeme123` (from Odoo)
- **Odoo Instance:** `https://securadotest.odoo.com`

## Prioritized Backlog

### P0 (Critical):
- [x] Visual Data Flow Hub
- [x] Auto user mapping from Odoo
- [x] Expand to full window feature
- [ ] Real-time webhook configuration in Odoo (user action required)

### P1 (High):
- [ ] Hierarchical data visibility (HOD, CEO roles)
- [ ] Bi-directional sync (Platform → Odoo)
- [ ] User invitation & password reset flow

### P2 (Medium):
- [ ] Scheduled sync (every 15 mins)
- [ ] Dashboard customization widgets
- [ ] Activity sync from Odoo
