# Sales Intelligence Platform - RBAC & Data Security Architecture

## Executive Summary

This document outlines the architecture and deployment plan for implementing enterprise-grade Role-Based Access Control (RBAC) with proper Microsoft 365 integration following security best practices.

---

## 1. Current State Analysis

### Problems Identified
1. **Privacy Violation**: MS365 sync pulls one user's personal emails accessible to all users
2. **No Data Isolation**: CRM data visible to all authenticated users regardless of role
3. **Missing RBAC**: No permission enforcement on data access
4. **Serving Zone Gap**: MS365 data not promoted to Serving zone

### Security Principles to Implement
- **Principle of Least Privilege**: Users access only what they need
- **Data Isolation**: Personal data scoped to owner
- **Delegated vs Application Permissions**: Use appropriate MS365 permission types
- **Audit Trail**: Log all data access for compliance

---

## 2. Target Architecture

### 2.1 Permission Types (Microsoft Graph API)

| Permission Type | Use Case | Consent | Data Scope |
|-----------------|----------|---------|------------|
| **Delegated** | User actions (view own email) | User or Admin | User's own data only |
| **Application** | Admin sync (user directory) | Admin only | Tenant-wide (controlled) |

### 2.2 Data Classification

| Data Type | Owner | Access Level | Storage |
|-----------|-------|--------------|---------|
| **User Directory** | Organization | Super Admin | `users` collection |
| **Personal Emails** | Individual User | Owner only | `user_emails` (user-scoped) |
| **Personal Calendar** | Individual User | Owner only | `user_calendar` (user-scoped) |
| **CRM Accounts** | Organization | Role-based | `data_lake_*` |
| **CRM Opportunities** | Organization | Role-based (assigned_to) | `data_lake_*` |

### 2.3 Role Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                      SUPER ADMIN                            │
│  - Full system access                                       │
│  - User management (CRUD)                                   │
│  - Role & permission configuration                          │
│  - System configuration                                     │
│  - User directory sync (identity only)                      │
│  - CANNOT access other users' personal emails               │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│     CEO       │    │ Sales Director│    │Product Director│
│  All CRM data │    │  All CRM data │    │  All CRM data │
│  Read-only    │    │  Team manage  │    │  Read-only    │
└───────────────┘    └───────────────┘    └───────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│ Account Mgr   │    │   Presales    │    │   Strategy    │
│ Own accounts  │    │ Assigned opps │    │  View all     │
│ Own contacts  │    │ View accounts │    │  Analytics    │
└───────────────┘    └───────────────┘    └───────────────┘
```

---

## 3. Database Schema Updates

### 3.1 Users Collection (Enhanced)
```javascript
{
  "id": "uuid",
  "email": "user@company.com",
  "name": "John Doe",
  "role": "account_manager",           // Business role
  "department": "Sales",
  "is_super_admin": false,             // Admin privilege flag (separate)
  "is_active": true,
  "ms_id": "azure-ad-object-id",       // Microsoft identity
  "manager_id": "uuid",                // Reporting hierarchy
  "team_id": "uuid",                   // Team assignment
  "permissions": {                     // Computed from role + custom
    "crm.accounts.view": true,
    "crm.accounts.edit": true,
    "crm.opportunities.view_own": true,
    "crm.opportunities.view_all": false
  }
}
```

### 3.2 Roles Collection (New)
```javascript
{
  "id": "uuid",
  "name": "Account Manager",
  "code": "account_manager",
  "description": "Customer account and opportunity management",
  "is_system": true,                   // Cannot delete system roles
  "permissions": [
    "crm.accounts.view_own",
    "crm.accounts.create",
    "crm.accounts.edit_own",
    "crm.opportunities.view_own",
    "crm.opportunities.create",
    "crm.contacts.view_own",
    "crm.contacts.create",
    "personal.emails.view",            // Own emails only
    "personal.calendar.view"           // Own calendar only
  ],
  "data_scope": "own"                  // own | team | department | all
}
```

### 3.3 Permissions Collection (New)
```javascript
{
  "id": "uuid",
  "code": "crm.accounts.view_own",
  "name": "View Own Accounts",
  "module": "crm",
  "resource": "accounts",
  "action": "view",
  "scope": "own",
  "description": "View accounts assigned to the user"
}
```

### 3.4 User Personal Data Collections (New)
```javascript
// user_emails - Personal email storage (user-scoped)
{
  "id": "uuid",
  "owner_user_id": "uuid",             // CRITICAL: Owner isolation
  "email_id": "ms-graph-email-id",
  "subject": "...",
  "from": {...},
  "received_at": "datetime",
  "synced_at": "datetime"
}

// user_calendar - Personal calendar (user-scoped)
{
  "id": "uuid",
  "owner_user_id": "uuid",             // CRITICAL: Owner isolation
  "event_id": "ms-graph-event-id",
  "subject": "...",
  "start": "datetime",
  "end": "datetime",
  "synced_at": "datetime"
}
```

---

## 4. API Security Layer

### 4.1 Middleware: Permission Check
```python
async def check_permission(
    user: User,
    resource: str,      # e.g., "accounts"
    action: str,        # e.g., "view"
    resource_id: str = None
) -> bool:
    """
    Check if user has permission to perform action on resource.
    For "own" scoped permissions, also verify ownership.
    """
    permission_code = f"crm.{resource}.{action}"
    
    if permission_code not in user.permissions:
        return False
    
    # Check data scope
    scope = user.role.data_scope
    if scope == "all":
        return True
    elif scope == "own" and resource_id:
        return await verify_ownership(user.id, resource, resource_id)
    elif scope == "team":
        return await verify_team_access(user.team_id, resource, resource_id)
    
    return False
```

### 4.2 Query Filters by Role
```python
def get_data_filter(user: User, entity_type: str) -> dict:
    """
    Return MongoDB query filter based on user's role/permissions.
    """
    scope = user.role.data_scope
    
    if scope == "all" or user.is_super_admin:
        return {}  # No filter - see everything
    
    elif scope == "own":
        return {"assigned_to": user.id}
    
    elif scope == "team":
        team_members = get_team_member_ids(user.team_id)
        return {"assigned_to": {"$in": team_members}}
    
    elif scope == "department":
        dept_members = get_department_member_ids(user.department)
        return {"assigned_to": {"$in": dept_members}}
```

---

## 5. Microsoft 365 Integration Architecture

### 5.1 Two Sync Modes

#### Mode A: User Directory Sync (Super Admin Only)
- **Purpose**: Populate user list from Azure AD
- **Permission Type**: Application (Admin Consent)
- **Scopes**: `User.Read.All`, `Directory.Read.All`
- **Data Synced**: 
  - Display Name, Email, Department, Job Title
  - Manager, Office Location
  - NO personal emails, calendar, files

```
Azure AD  ────────▶  Application Permission  ────────▶  users collection
(Directory)           (User.Read.All)                   (Identity only)
```

#### Mode B: Personal Data Fetch (User's Own)
- **Purpose**: User views their own emails/calendar
- **Permission Type**: Delegated (User Consent)
- **Scopes**: `Mail.Read`, `Calendars.Read`
- **Data Synced**: Only to that user's personal collections

```
User logs in  ────▶  Delegated Permission  ────────▶  user_emails (owner=user)
via MS SSO           (Mail.Read)                      user_calendar (owner=user)
```

### 5.2 Azure AD App Registration Config

```
App Registration: "Sales Intelligence Platform"
├── Authentication
│   ├── Platform: Single-Page Application
│   ├── Redirect URIs: https://app.domain.com/login
│   └── Allow public client flows: No
│
├── API Permissions
│   ├── Delegated (User-scoped)
│   │   ├── openid, profile, email (Sign-in)
│   │   ├── User.Read (Read own profile)
│   │   ├── Mail.Read (Read own emails)
│   │   ├── Calendars.Read (Read own calendar)
│   │   └── Contacts.Read (Read own contacts)
│   │
│   └── Application (Admin-consented)
│       ├── User.Read.All (Sync user directory)
│       └── Directory.Read.All (Read org structure)
│
└── Token Configuration
    └── Optional claims: email, preferred_username
```

---

## 6. Deployment Plan

### Phase 1: Security Foundation (Week 1)
**Goal**: Fix privacy issues, implement basic RBAC

| Day | Task | Details |
|-----|------|---------|
| 1 | Delete exposed data | Remove incorrectly synced emails from data lake |
| 1 | Create roles collection | Add system roles with permissions |
| 2 | Update user schema | Add role, department, is_super_admin fields |
| 2 | Create permissions collection | Define all permission codes |
| 3 | Implement permission middleware | Check permissions on API calls |
| 3 | Add query filters | Filter data by user's scope |
| 4 | Update MS365 sync | Separate directory sync from personal data |
| 5 | Testing & validation | Verify data isolation works |

### Phase 2: Admin Panel (Week 2)
**Goal**: Super Admin can manage users, roles, permissions

| Day | Task | Details |
|-----|------|---------|
| 1 | Admin Panel layout | Navigation, settings page structure |
| 2 | User Management UI | List, create, edit, delete users |
| 2 | Role assignment | Assign roles and departments to users |
| 3 | Roles & Permissions UI | View/edit role permissions matrix |
| 4 | User Directory Sync | Sync Azure AD users (identity only) |
| 5 | Testing & UAT | Admin functions verification |

### Phase 3: Personal Data Features (Week 3)
**Goal**: Users can view their own MS365 data

| Day | Task | Details |
|-----|------|---------|
| 1 | My Outlook page | UI for personal emails/calendar |
| 2 | Personal data fetch API | Delegated permission calls |
| 3 | User-scoped storage | Store with owner_user_id |
| 4 | Access control | Enforce owner-only access |
| 5 | Testing & polish | End-to-end verification |

### Phase 4: Data Lake Enhancement (Week 4)
**Goal**: Proper data flow with RBAC

| Day | Task | Details |
|-----|------|---------|
| 1 | Serving zone promotion | Add MS365 identity to serving |
| 2 | Role-based filtering | Apply filters in Data Lake UI |
| 3 | Entity type filters | Filter by email, calendar, CRM |
| 4 | Dashboard updates | Role-aware dashboard widgets |
| 5 | Final testing | Full regression testing |

---

## 7. UI Navigation Structure

### Regular Users (AM, Presales, etc.)
```
MAIN MENU
├── Dashboard           (Role-filtered KPIs)
├── Accounts            (Own/Team based on role)
├── Contacts            (Own/Team based on role)
├── Opportunities       (Own/Team based on role)
├── My Outlook          (Personal emails & calendar)
└── Data Lake           (Role-filtered view)
```

### Super Admin Users
```
MAIN MENU
├── Dashboard
├── Accounts
├── Contacts
├── Opportunities
├── My Outlook
└── Data Lake

ADMINISTRATION
├── Users               (CRUD all users)
└── Integrations        (Odoo, MS365 config)

SYSTEM
└── System Config       (Opens Admin Panel)
    ├── Organization
    ├── Departments
    ├── User Management
    ├── Roles & Permissions
    └── Integrations
```

---

## 8. Security Checklist

### Data Protection
- [ ] Personal emails stored with owner_user_id
- [ ] Query filters enforce data scope
- [ ] No cross-user data leakage
- [ ] Audit log for sensitive access

### Authentication
- [ ] JWT tokens with role claims
- [ ] MS SSO with proper scopes
- [ ] Token refresh handling
- [ ] Session timeout

### Authorization
- [ ] Permission check on all API endpoints
- [ ] Role-based UI rendering
- [ ] Admin-only routes protected
- [ ] Data scope enforcement

### Compliance
- [ ] GDPR: Data minimization
- [ ] GDPR: Right to access (export own data)
- [ ] GDPR: Right to deletion
- [ ] Audit trail for all actions

---

## 9. Testing Strategy

### Unit Tests
- Permission check logic
- Query filter generation
- Role inheritance

### Integration Tests
- API endpoint authorization
- Data isolation verification
- MS365 sync (both modes)

### E2E Tests
- AM can only see own accounts
- Super Admin can manage users
- Personal email access restricted
- Cross-user access denied

---

## 10. Rollback Plan

If issues arise during deployment:

1. **Phase 1**: Revert to current state (no RBAC)
2. **Phase 2**: Keep Phase 1, disable Admin Panel
3. **Phase 3**: Keep Admin, disable personal data
4. **Phase 4**: Keep all, revert Data Lake changes

Each phase is independently deployable and reversible.

---

## Document Info
- **Version**: 1.0
- **Created**: January 12, 2026
- **Author**: Sales Intelligence Platform Team
