# Sales Intelligence Platform - Agile Sprint Plan

## Executive Summary

This document outlines the sprint plan to address critical data synchronization challenges and user experience improvements for the Sales Intelligence Platform.

### Issues Addressed:
1. **Data Sync for Domain Users** - Domain users cannot trigger sync; stale data persists
2. **User-Odoo Linking** - Permission issue resolved; self-service enabled
3. **Automated Data Consistency** - Background sync to replace manual triggers

---

## ✅ COMPLETED (Sprint 0 - Hotfix)

### User Self-Service Linking
| Task | Status | Description |
|------|--------|-------------|
| Create `/api/auth/relink-odoo` | ✅ DONE | Self-service endpoint for any approved user |
| Update Profile.js | ✅ DONE | Uses new endpoint, shows suggestions on failure |
| Multi-strategy matching | ✅ DONE | Email → Name → Opportunity salesperson |
| Clear error messages | ✅ DONE | Shows why match failed with actionable suggestions |

**Result:** Any approved user can now click "Link to Odoo" without admin intervention.

---

## Sprint 1: Employee Sync & Enhanced Linking (3-4 days)

### Goal: Sync Odoo employees to enable proper user linking

| ID | Task | Priority | Points | Acceptance Criteria |
|----|------|----------|--------|---------------------|
| 1.1 | Add employee sync to Odoo integration flow | P0 | 3 | `hr.employee` data synced to `data_lake_serving` |
| 1.2 | Trigger employee sync on manual Odoo sync | P0 | 1 | Admin sync includes employees |
| 1.3 | Display employee count in sync status | P1 | 1 | Dashboard shows "X employees synced" |
| 1.4 | Manual link override for admins | P1 | 2 | Admin can manually select Odoo user for any user |
| 1.5 | Integration tests | P1 | 2 | All matching strategies tested |

**Sprint 1 Deliverables:**
- [ ] Odoo employees synced to data lake
- [ ] Re-link now finds matches
- [ ] Admin override for edge cases

---

## Sprint 2: Automated Background Sync (5-7 days)

### Goal: Keep data in sync automatically without manual intervention

| ID | Task | Priority | Points | Acceptance Criteria |
|----|------|----------|--------|---------------------|
| 2.1 | Create `SyncScheduler` service | P0 | 3 | APScheduler with configurable intervals |
| 2.2 | Implement `OdooReconciler` | P0 | 5 | Compare, soft-delete, update, insert |
| 2.3 | Create `sync_logs` collection | P0 | 2 | Audit trail of all sync operations |
| 2.4 | Add `/api/sync/status` endpoint | P0 | 2 | Any user can check last sync time |
| 2.5 | Dashboard sync health widget | P1 | 3 | Shows sync status, last run, errors |
| 2.6 | Email notification on failures | P1 | 2 | Admins notified after 3+ failures |
| 2.7 | Admin sync interval config | P2 | 2 | Adjustable 5-60 min interval |

### Reconciliation Logic:
```python
async def reconcile_entity(entity_type: str):
    """
    1. Fetch all IDs from Odoo
    2. Fetch all IDs from our DB (where is_active=True)
    3. For IDs in Odoo but not DB: INSERT
    4. For IDs in both: UPDATE if changed
    5. For IDs in DB but not Odoo: SOFT DELETE (is_active=False)
    """
```

**Sprint 2 Deliverables:**
- [ ] Automatic sync every 15 minutes (configurable)
- [ ] Deleted Odoo records marked inactive in our DB
- [ ] All users see "Last synced: X minutes ago"
- [ ] Admins alerted on sync failures

---

## Sprint 3: Real Activity Logging (3-4 days)

### Goal: Replace mock activity data with real tracked actions

| ID | Task | Priority | Points | Acceptance Criteria |
|----|------|----------|--------|---------------------|
| 3.1 | Create activity logging middleware | P0 | 3 | Intercepts CRM operations |
| 3.2 | Log opportunity CRUD | P0 | 2 | Create, update, stage change, close |
| 3.3 | Log account/contact actions | P0 | 2 | Create, update, 360 view access |
| 3.4 | Log user actions | P1 | 2 | Login, approval, linking |
| 3.5 | Activity API with filters | P1 | 2 | Pagination, date range, type filter |
| 3.6 | Export activities (CSV) | P2 | 1 | Admin can download activity report |

### Activity Schema:
```python
{
    "id": "uuid",
    "activity_type": "opportunity_created|call|email|meeting|...",
    "title": "Created opportunity: Cloud Migration Project",
    "entity_type": "opportunity|account|user",
    "entity_id": "opp-123",
    "user_id": "user-456",
    "user_name": "John Doe",
    "metadata": {...},
    "timestamp": "2026-01-13T21:00:00Z"
}
```

**Sprint 3 Deliverables:**
- [ ] All CRM actions automatically logged
- [ ] Activity Timeline shows real data
- [ ] Filter by type, date, user works

---

## Sprint 4: MS365 Token Refresh (2-3 days)

### Goal: Fix recurring login issue with silent token refresh

| ID | Task | Priority | Points | Acceptance Criteria |
|----|------|----------|--------|---------------------|
| 4.1 | Implement refresh token flow | P0 | 3 | Silent refresh when access token expires |
| 4.2 | Secure refresh token storage | P0 | 2 | Encrypted in database |
| 4.3 | Background pre-refresh job | P1 | 2 | Refresh tokens before they expire |
| 4.4 | Graceful re-login fallback | P1 | 1 | Clear message if refresh fails |

**Sprint 4 Deliverables:**
- [ ] Users don't need to re-login frequently
- [ ] Token refreshed silently in background
- [ ] Clear message if manual re-login needed

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SYNC ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐                                                       │
│  │    ODOO     │                                                       │
│  │   (Source)  │                                                       │
│  └──────┬──────┘                                                       │
│         │                                                               │
│         ▼ Every 15 min                                                 │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │              BACKGROUND SYNC SERVICE                     │          │
│  │  ┌─────────────────────────────────────────────────────┐ │          │
│  │  │                  OdooReconciler                     │ │          │
│  │  │                                                     │ │          │
│  │  │  1. Fetch from Odoo (accounts, opps, invoices,     │ │          │
│  │  │     employees, users)                               │ │          │
│  │  │  2. Compare with data_lake_serving                  │ │          │
│  │  │  3. INSERT new records                              │ │          │
│  │  │  4. UPDATE changed records                          │ │          │
│  │  │  5. SOFT DELETE removed records (is_active=false)   │ │          │
│  │  │  6. Log to sync_logs                                │ │          │
│  │  └─────────────────────────────────────────────────────┘ │          │
│  └──────────────────────────────────────────────────────────┘          │
│         │                                                               │
│         ▼                                                               │
│  ┌──────────────────┐    ┌──────────────────┐                         │
│  │  data_lake_      │    │    sync_logs     │                         │
│  │    serving       │    │   (audit trail)  │                         │
│  └────────┬─────────┘    └──────────────────┘                         │
│           │                                                            │
│           ▼                                                            │
│  ┌──────────────────────────────────────────────────────────┐         │
│  │                    FRONTEND                              │         │
│  │  • Opportunities (always fresh data)                     │         │
│  │  • Accounts (deleted ones hidden)                        │         │
│  │  • Dashboard (shows sync health)                         │         │
│  │  • Profile (can self-link to Odoo)                       │         │
│  └──────────────────────────────────────────────────────────┘         │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Data staleness | Unknown (manual sync) | < 15 minutes |
| User linking success rate | 0% (no employees synced) | > 90% |
| Re-login frequency | Multiple times/day | Once per week |
| Sync failure notifications | None | < 5 min response |

---

## Recommended Sprint Order

1. **Sprint 1** (Employee Sync) - Enables user linking to work
2. **Sprint 2** (Background Sync) - Solves data staleness for all users
3. **Sprint 3** (Activity Logging) - Completes the Activity page
4. **Sprint 4** (MS365 Refresh) - Improves user experience

---

## Questions for Product Owner

1. **Sync Interval**: Is 15 minutes acceptable, or do you need near-real-time (5 min)?
2. **Soft Delete Display**: Should soft-deleted records show as "Archived" or be completely hidden?
3. **Activity Retention**: How long should activity logs be retained? (30 days? 1 year?)
4. **Webhook Option**: Does your Odoo instance support webhooks? This would enable instant updates.

---

*Document created: January 13, 2026*
*Last updated: January 13, 2026*
