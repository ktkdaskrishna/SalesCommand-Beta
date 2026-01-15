# 📋 UAT Tracker - SalesCommand-Beta (Securado)
## User Acceptance Testing & Issue Management

**Project:** Sales Intelligence Platform  
**Phase:** UAT & Logic Refinement  
**Created:** 2025-01-15  
**Status:** ACTIVE  
**Last Updated:** 2025-01-15

---

## 🎯 SYSTEM STATUS

### ✅ Confirmed Working
- ✅ Login system (email/password authentication)
- ✅ CQRS v2 dashboard with manager visibility
- ✅ Odoo integration (accounts, opportunities, invoices syncing)
- ✅ Manager hierarchy (subordinate visibility working)
- ✅ Data Lake (Raw → Canonical → Serving zones operational)

---

## 📊 UAT ITEMS TRACKER

### Priority Legend
- 🔴 **P0** - Critical (blocks users)
- 🟡 **P1** - High (important for UX)
- 🟢 **P2** - Medium (enhancement)
- 🔵 **P3** - Low (nice-to-have)

---

### 🟡 UAT-001: UI Cleanup - Remove CQRS Technical Banner

**Priority:** P1  
**Status:** 📝 LOGGED  
**Assigned To:** TBD  
**Estimated Effort:** 15 minutes

**Description:**
Remove the technical architecture notice "CQRS v2 Architecture Active | Event Sourcing + Materialized Views | Sub-second performance | Pre-computed access control" from the main dashboard. This is internal architecture information not needed by end-users.

**Current Location:**
- File: `/app/frontend/src/pages/SalesDashboard.js`
- Lines: ~110-122 (architecture badge section)

**Acceptance Criteria:**
- [ ] Technical banner removed from user-facing dashboard
- [ ] Dashboard still displays business metrics
- [ ] No visual layout shifts after removal
- [ ] Architecture info moved to developer docs only

**Technical Notes:**
- Remove the `{useV2 &&` conditional block with the purple banner
- Keep all other UI elements intact
- This is purely cosmetic, no business logic affected

**Related Files:**
- `frontend/src/pages/SalesDashboard.js`

---

### 🟡 UAT-002: Notification System Re-positioning

**Priority:** P1  
**Status:** 📝 LOGGED  
**Assigned To:** TBD  
**Estimated Effort:** 30 minutes

**Description:**
Move application notifications (toasts) from the current right-side position to the **bottom-right corner**. Add a functional **Close Button** (X) to each notification for user control.

**Current Implementation:**
- Using Sonner toast library
- Position configured in `App.js`: `<Toaster position="top-right" />`

**Required Changes:**
1. Update toast position to "bottom-right"
2. Ensure close button is visible and functional
3. Test with success, error, and warning notifications

**Acceptance Criteria:**
- [ ] Notifications appear in bottom-right corner
- [ ] Each notification has visible close (X) button
- [ ] Close button dismisses notification immediately
- [ ] Multiple notifications stack correctly
- [ ] Auto-dismiss timing unchanged (default behavior)

**Technical Notes:**
- Sonner library supports bottom-right position
- Close button should be built-in with Sonner
- May need custom styling if not default

**Related Files:**
- `frontend/src/App.js` (Toaster position)
- `frontend/src/pages/SalesDashboard.js` (toast usage)
- All components using `toast.success()`, `toast.error()`, etc.

---

### 🟢 UAT-003: Manual Data Refresh Feature

**Priority:** P2  
**Status:** 📝 LOGGED  
**Assigned To:** TBD  
**Estimated Effort:** 3-4 hours

**Description:**
Add a "Refresh" button to all views displaying Odoo-sourced data (Accounts, Opportunities, Invoices, Activities). This button must trigger the **Integrator Service** to fetch the latest data from Odoo API, following the Three-Zone Data Lake pattern (Raw → Canonical → Serving).

**Affected Views:**
1. Accounts page (`/accounts`)
2. Opportunities page (`/opportunities`)
3. Invoices page (`/invoices`)
4. Activity Timeline page (`/activity`)

**Implementation Requirements:**

**Backend:**
1. Create endpoint: `POST /api/integrations/odoo/refresh/{entity_type}`
   - entity_type: 'accounts', 'opportunities', 'invoices', 'activities'
2. Endpoint must:
   - Fetch fresh data from Odoo API
   - Write to Raw Zone first (data_lake_raw or odoo_raw_data)
   - Trigger canonical transformation
   - Update Serving Zone (data_lake_serving or opportunity_view)
   - Generate CQRS events if using event-driven architecture
3. Return refresh job ID for status tracking

**Frontend:**
1. Add "Refresh from Odoo" button to each view (top-right corner)
2. Show loading state during refresh
3. Display success/error notification
4. Auto-reload view after successful refresh

**Acceptance Criteria:**
- [ ] Refresh button visible on Accounts, Opportunities, Invoices, Activities pages
- [ ] Button triggers Odoo API fetch
- [ ] Data flows through Raw → Canonical → Serving zones
- [ ] UI updates with fresh data after refresh
- [ ] Loading indicator shown during refresh
- [ ] Error handling if Odoo API fails
- [ ] Maintains data lake integrity

**Technical Constraints:**
- ✅ MUST write to Raw Zone first (maintain audit trail)
- ✅ MUST use existing Integrator Service (OdooConnector)
- ✅ MUST maintain Three-Zone Data Lake pattern
- ✅ MUST generate events for CQRS projections

**Related Files:**
- `backend/routes/integrations.py` (add refresh endpoint)
- `backend/integrations/odoo/connector.py` (use existing fetch methods)
- `frontend/src/pages/Accounts.js`
- `frontend/src/pages/Opportunities.js`
- `frontend/src/pages/Invoices.js`
- `frontend/src/pages/ActivityTimeline.js`

---

### 🟢 UAT-004: Configurable Auto-Sync Interval

**Priority:** P2  
**Status:** 📝 LOGGED  
**Assigned To:** TBD  
**Estimated Effort:** 2 hours

**Description:**
Make the auto-sync interval configurable through System Config (Super Admin only). Currently hard-coded to 5 minutes in the background sync service.

**Current Implementation:**
- File: `/app/backend/services/sync/background_sync.py`
- Hard-coded: `interval_minutes=5` (line ~44 in server.py startup)
- Scheduler: APScheduler with IntervalTrigger

**Required Changes:**

**Backend:**
1. Create `system_config` collection (if doesn't exist)
2. Add setting: `auto_sync_interval_minutes` (default: 5)
3. API endpoints:
   - `GET /api/admin/config/sync` - Get current interval
   - `PUT /api/admin/config/sync` - Update interval (admin only)
4. Modify background sync service to:
   - Read interval from database on startup
   - Support dynamic interval updates (restart scheduler)

**Frontend:**
1. Add "Auto-Sync Settings" section to System Config page
2. Dropdown/input for interval selection (15, 30, 60 minutes)
3. Show current interval and next sync time
4. Restart notification when interval changed

**Acceptance Criteria:**
- [ ] Current auto-sync interval visible in System Config
- [ ] Super Admin can change interval (15/30/60 min options)
- [ ] Background sync service respects new interval
- [ ] Scheduler restarts with new interval
- [ ] Next sync time displayed on dashboard
- [ ] Changes persist across server restarts
- [ ] Non-admin users cannot modify (permission check)

**Technical Notes:**
- Use APScheduler's `reschedule_job()` for dynamic updates
- Store config in `system_config` collection
- Add validation: interval must be between 5-120 minutes

**Related Files:**
- `backend/services/sync/background_sync.py`
- `backend/server.py` (startup code)
- `backend/routes/admin.py` (or create `routes/system_config.py`)
- `frontend/src/pages/AdminPanel.js` or System Config page

---

### 🔴 UAT-005: Granular RBAC for Contacts & Companies

**Priority:** P0 (Security & Data Visibility)  
**Status:** 📝 LOGGED  
**Assigned To:** TBD  
**Estimated Effort:** 4-6 hours

**Description:**
Implement role-based data filtering for Contacts and Companies with specific visibility rules per role.

**Business Rules:**

**Sales/Account Manager Role:**
- ✅ Can ONLY see Contacts assigned to them in Odoo (res.partner.user_id matches their odoo_user_id)
- ✅ Can ONLY see Companies/Accounts assigned to them
- ✅ Filter: `odoo_data.user_id == current_user.odoo_user_id`

**Product Director (PD) Role:**
- ✅ Can see ALL Companies (no company filter)
- ✅ Can ONLY see Opportunities belonging to their department/product line
- ✅ Can ONLY see Presales Activities for their department
- ✅ Filter: `opportunity.product_line == PD.assigned_product_line`

**Implementation Strategy:**

**Backend - Access Control Logic:**

```python
# In routes/sales.py or routes/accounts.py

async def get_accounts_filtered_by_role(user_doc, user_role):
    \"\"\"
    Apply role-based filtering for accounts/companies.
    \"\"\"
    db = Database.get_db()
    
    # Super Admin sees all
    if user_doc.get('is_super_admin'):
        query = {}
    
    # Sales/AM sees only assigned
    elif user_role in ['account_manager', 'sales']:
        odoo_user_id = user_doc.get('odoo_user_id')
        query = {
            \"$or\": [
                {\"data.user_id\": odoo_user_id},  # Assigned to them
                {\"data.salesperson_id\": odoo_user_id}
            ]
        }
    
    # Product Director sees all companies, but filtered opps
    elif user_role == 'product_director':
        # For companies: no filter
        query = {}
        # For opportunities: apply in opportunity endpoint
    
    else:
        # Default: assigned only
        query = {\"data.user_id\": user_doc.get('odoo_user_id')}
    
    return query
```

**Product Director Opportunity Filtering:**

```python
async def get_opportunities_for_pd(user_doc):
    \"\"\"
    PD sees opportunities from their product line/department only.
    \"\"\"
    # Get PD's assigned product line
    product_line = user_doc.get('assigned_product_line')  # e.g., \"MSSP\", \"Network Security\"
    department_id = user_doc.get('odoo_department_id')
    
    query = {
        \"$or\": [
            {\"data.product_line\": product_line},  # Match product line
            {\"data.team_id\": user_doc.get('odoo_team_id')},  # Or team
            {\"salesperson.odoo_department_id\": department_id}  # Or department
        ]
    }
    
    return query
```

**CQRS Integration:**
- Update `opportunity_projection.py` to include product_line in denormalization
- Update `access_matrix_projection.py` to compute PD-specific access based on department
- Add product_line filter to visible_to_user_ids calculation

**Acceptance Criteria:**
- [ ] Account Manager sees ONLY assigned contacts/companies
- [ ] Account Manager cannot access other users' accounts
- [ ] Product Director sees ALL companies
- [ ] Product Director sees ONLY opportunities from their product line/department
- [ ] Product Director cannot see other product lines
- [ ] Super Admin sees everything (no restrictions)
- [ ] Security verified (no data leaks between roles)

**Testing Requirements:**
- Test with AM role (limited access)
- Test with PD role (selective access)
- Test cross-product-line isolation
- Verify with multiple PDs in different departments

**Related Files:**
- `backend/routes/sales.py` (opportunities filtering)
- `backend/routes/accounts.py` or sales.py (accounts filtering)
- `backend/projections/opportunity_projection.py` (CQRS)
- `backend/projections/access_matrix_projection.py` (CQRS)
- `backend/middleware/rbac.py` (role checks)

**Dependencies:**
- Requires: Product line/department assignment for PD users
- Requires: Odoo sync includes product_line field
- Requires: User model has `assigned_product_line` field

---

### 🔴 UAT-006: Odoo Activity Sync - Comprehensive Investigation & Fix

**Priority:** P0 (Functionality Broken)  
**Status:** 📝 LOGGED → 🔍 INVESTIGATED  
**Assigned To:** TBD  
**Estimated Effort:** 4-6 hours (not 2-3, needs deep fix)

**Description:**
Activity tab is not displaying data. Investigation reveals activities ARE syncing from Odoo (2 activities confirmed) but they're not appearing in the UI due to ID mismatch and incomplete integration with CQRS.

---

#### 🔍 INVESTIGATION FINDINGS

**✅ What's Working:**
- Odoo connector `fetch_activities()` - Working ✅
- Background sync calling activity sync - Working ✅
- Activities written to odoo_raw_data - 2 records ✅
- Activities written to data_lake_serving - 2 records ✅

**❌ What's Broken:**
1. **CQRS Integration:** No OdooActivitySynced events (0 events in event store)
2. **ID Mismatch:** Activities link to Odoo opportunity IDs (e.g., res_id=3, res_id=9) but opportunity_view uses different IDs (UUIDs or mixed format)
3. **Frontend API:** Activity endpoint returns only 1 activity (should return 2+)
4. **Linking Logic:** Activities not properly linked to opportunities due to ID format differences

**Current Activity Data (Confirmed):**
```javascript
Activity 1:
  - id: 1
  - type: "Document"
  - summary: "Document"
  - res_model: "crm.lead" (linked to opportunity)
  - res_id: 3 (Odoo opportunity ID)
  - user: krishna@securado.net
  - state: "planned"

Activity 2:
  - id: 2
  - type: "Meeting"
  - summary: "SUPREME JUDICIARY COUNCIL's opportunity"
  - res_model: "crm.lead"
  - res_id: 9 (Odoo opportunity ID)
  - user: vinsha.nair@securado.net
  - state: "today"
```

**Opportunity ID Formats in System:**
```javascript
// In data_lake_serving (old):
opportunity.serving_id = "3", "9", etc. (numeric strings)

// In opportunity_view (CQRS):
opportunity.odoo_id = 6, 9, etc. (integers or UUIDs)

// Problem: Activities use res_id=3,9 but need to match opportunity_view.odoo_id
```

---

#### 🛠️ ROOT CAUSE ANALYSIS

**Problem 1: CQRS Event Missing**
- Background sync updates data_lake_serving
- But doesn't generate CQRS events for activities
- Result: No activity projection exists
- Impact: Activities not integrated with CQRS architecture

**Problem 2: ID Mapping Inconsistency**
```
Odoo mail.activity.res_id (3) 
  ↓ Should link to
Opportunity with odoo_id=3
  ↓ But opportunity_view might have
Different ID format (UUID or compound key)
```

**Problem 3: No Activity Projection**
- We have: UserProfileProjection, OpportunityProjection
- Missing: ActivityProjection
- Result: Activities not denormalized with user/opportunity info

**Problem 4: Frontend Endpoint**
```
GET /api/activities
Returns: 1 activity (filtered by role/assignment)
Should return: All activities linked to accessible opportunities
```

---

#### 🎯 REQUIRED FIXES

**Fix 1: Create Activity Projection (CQRS)**

**New File:** `/app/backend/projections/activity_projection.py`

```python
class ActivityProjection(BaseProjection):
    \"\"\"
    Builds activity_view collection with:
    - Denormalized user info (who created activity)
    - Denormalized opportunity info (which opportunity)
    - Pre-computed visibility (same as linked opportunity)
    \"\"\"
    
    def subscribes_to(self):
        return [EventType.ODOO_ACTIVITY_SYNCED]
    
    async def handle(self, event: Event):
        payload = event.payload
        activity_id = payload.get('id')
        res_id = payload.get('res_id')  # Opportunity ID
        res_model = payload.get('res_model')
        
        # Only process crm.lead activities
        if res_model != 'crm.lead':
            return
        
        # Find linked opportunity
        opportunity = await self.db.opportunity_view.find_one({
            \"odoo_id\": res_id
        })
        
        if not opportunity:
            logger.warning(f\"Activity {activity_id} links to unknown opportunity {res_id}\")
            return
        
        # Find user who created activity
        user_odoo_id = payload.get('user_id')
        user = await self.db.user_profiles.find_one({
            \"odoo.user_id\": user_odoo_id
        })
        
        # Create denormalized activity
        activity_doc = {
            \"id\": str(uuid.uuid4()),
            \"odoo_id\": activity_id,
            \"activity_type\": payload.get('activity_type'),
            \"summary\": payload.get('summary'),
            \"note\": payload.get('note'),
            \"due_date\": payload.get('date_deadline'),
            \"state\": payload.get('state'),
            
            # Denormalized opportunity
            \"opportunity\": {
                \"id\": opportunity[\"id\"],
                \"odoo_id\": opportunity[\"odoo_id\"],
                \"name\": opportunity[\"name\"]
            },
            
            # Denormalized user
            \"assigned_to\": {
                \"user_id\": user[\"id\"] if user else None,
                \"name\": user[\"name\"] if user else payload.get('user_name'),
                \"email\": user[\"email\"] if user else None
            },
            
            # Inherit visibility from opportunity
            \"visible_to_user_ids\": opportunity.get(\"visible_to_user_ids\", []),
            
            \"is_active\": True,
            \"last_synced\": datetime.now(timezone.utc),
            \"source\": \"odoo\"
        }
        
        await self.collection.update_one(
            {\"odoo_id\": activity_id},
            {\"$set\": activity_doc},
            upsert=True
        )
```

**Fix 2: Generate Activity Events in Sync Handler**

**File:** `/app/backend/domain/sync_handler.py`

Add method:
```python
async def _sync_activities(self, connector, sync_job_id: str) -> List[Event]:
    \"\"\"Sync activities and generate events\"\"\"
    activities = await connector.fetch_activities()
    events = []
    
    for activity_data in activities:
        activity_id = activity_data.get('id')
        
        # Store raw
        # ... (similar to opportunities)
        
        # Generate event
        event = Event(
            event_type=EventType.ODOO_ACTIVITY_SYNCED,
            aggregate_type=AggregateType.ACTIVITY,
            aggregate_id=f\"activity-{activity_id}\",
            payload=activity_data,
            metadata=EventMetadata(source=\"odoo_sync\", correlation_id=sync_job_id)
        )
        
        await self.event_store.append(event)
        await event_bus.publish(event)
        events.append(event)
    
    return events
```

**Fix 3: Enhanced Activity Fetch from Odoo**

**File:** `/app/backend/integrations/odoo/connector.py`

Current fetch is basic. Need to enrich:
```python
async def fetch_activities(self) -> List[Dict[str, Any]]:
    # ... existing fetch code ...
    
    for rec in records:
        # Extract activity type name
        activity_type_name = None
        if rec.get('activity_type_id'):
            activity_type_name = rec['activity_type_id'][1]  # [ID, "Name"]
        
        # Extract user name
        user_name = None
        if rec.get('user_id'):
            user_name = rec['user_id'][1]
        
        activities.append({
            'id': rec.get('id'),
            'odoo_activity_id': rec.get('id'),
            'activity_type_id': rec['activity_type_id'][0] if rec.get('activity_type_id') else None,
            'activity_type': activity_type_name,  # ADD: Type name
            'summary': rec.get('summary'),
            'note': rec.get('note'),
            'date_deadline': rec.get('date_deadline'),
            'user_id': rec['user_id'][0] if rec.get('user_id') else None,
            'user_name': user_name,  # ADD: User name
            'res_model': rec.get('res_model'),
            'res_id': rec.get('res_id'),  # Opportunity ID
            'res_name': rec.get('res_name'),
            'state': rec.get('state'),
            'create_date': rec.get('create_date'),
            'write_date': rec.get('write_date'),
            'source': 'odoo',
            'synced_at': datetime.now(timezone.utc).isoformat()
        })
    
    return activities
```

**Fix 4: Activity API Endpoint Enhancement**

**File:** `/app/backend/routes/sales.py`

Current endpoint filters by user. Need to:
1. Use CQRS activity_view if exists
2. Apply visibility based on linked opportunity
3. Include activities from subordinate opportunities for managers

```python
@router.get(\"/activities\")
async def get_activities(
    opportunity_id: Optional[str] = None,
    token_data: dict = Depends(require_approved())
):
    \"\"\"
    Get activities with CQRS support.
    Shows activities from:
    - User's own opportunities
    - Subordinate opportunities (for managers)
    \"\"\"
    db = Database.get_db()
    user_id = token_data[\"id\"]
    
    # Check if CQRS activity_view exists
    if 'activity_view' in await db.list_collection_names():
        # Use CQRS
        query = {
            \"visible_to_user_ids\": user_id,
            \"is_active\": True
        }
        
        if opportunity_id:
            query[\"opportunity.odoo_id\"] = opportunity_id
        
        activities = await db.activity_view.find(query).to_list(1000)
    else:
        # Fallback to data_lake_serving
        # Get accessible opportunity IDs
        access = await db.user_access_matrix.find_one({\"user_id\": user_id})
        accessible_opp_ids = access.get('accessible_opportunities', []) if access else []
        
        activities = await db.data_lake_serving.find({
            \"entity_type\": \"activity\",
            \"data.res_id\": {\"$in\": accessible_opp_ids}
        }).to_list(1000)
    
    return activities
```

**Fix 5: Frontend Activity Timeline**

**File:** `/app/frontend/src/pages/ActivityTimeline.js`

Update to use new endpoint and handle CQRS structure.

---

#### 📋 COMPLETE FIX CHECKLIST

**Backend Tasks:**
- [ ] Add OdooActivitySynced to EventType enum (event_store/models.py)
- [ ] Create ActivityProjection class (projections/activity_projection.py)
- [ ] Add activity sync to sync_handler.py (_sync_activities method)
- [ ] Register ActivityProjection with event bus (cqrs_init.py)
- [ ] Create activity_view collection with indexes
- [ ] Update GET /api/activities endpoint for CQRS
- [ ] Generate historical events for existing 2 activities
- [ ] Test activity visibility with manager hierarchy

**Frontend Tasks:**
- [ ] Update ActivityTimeline.js to call correct endpoint
- [ ] Handle CQRS activity structure (denormalized)
- [ ] Display linked opportunity name
- [ ] Show activity owner (user)
- [ ] Filter by date/status
- [ ] Show team activities for managers

**Data Migration:**
- [ ] Run migration to generate activity events
- [ ] Build activity_view from events
- [ ] Verify 2 activities appear
- [ ] Link activities to correct opportunities

**Testing:**
- [ ] Verify Activity 1 (res_id=3) links to Firewall opportunity
- [ ] Verify Activity 2 (res_id=9) links to Supreme Judiciary opportunity
- [ ] Test manager sees team activities
- [ ] Test subordinate sees only own
- [ ] Verify activity count API

---

#### 🎯 WHY ACTIVITIES NOT SHOWING IN UI

**Root Cause Chain:**
1. Activities sync to data_lake_serving ✅
2. But NOT integrated with CQRS (no events) ❌
3. Frontend calls `/api/activities` endpoint
4. Endpoint returns 1 activity (filtered heavily)
5. Activity Timeline page shows "No activities" due to filtering ❌

**ID Mismatch Issue:**
```
Activity in data_lake_serving:
  - res_id: 3 (Odoo opportunity ID)

Opportunity in opportunity_view:
  - odoo_id: 3 (should match!)

Current API:
  - Tries to match res_id to opportunity_id (UUID)
  - Match fails → activity not linked → filtered out
```

**Solution:**
- Match activities by `res_id` to `opportunity_view.odoo_id` (not UUID)
- Use CQRS activity_view with pre-computed links
- Apply same visibility rules as opportunities

---

#### 📊 ENHANCED SYNC STRATEGY

**Current Flow (Incomplete):**
```
Odoo mail.activity
  ↓ fetch_activities()
odoo_raw_data (entity_type='activity')
  ↓ reconcile_entity()
data_lake_serving (entity_type='activity')
  ↓ ??? NO CQRS INTEGRATION ???
Frontend (empty)
```

**Required Flow (Complete):**
```
Odoo mail.activity
  ↓ fetch_activities()
odoo_raw_data (entity_type='activity')
  ↓ Generate OdooActivitySynced event
CQRS Event Store
  ↓ ActivityProjection processes event
activity_view (denormalized with opportunity + user)
  ↓ Apply visibility (same as linked opportunity)
Frontend displays activities
```

---

#### 🔄 ACTIVITY TO OPPORTUNITY LINKING

**Odoo Structure:**
```
mail.activity:
  - res_model: "crm.lead" (model name)
  - res_id: 9 (Odoo opportunity ID)
  
crm.lead (opportunity):
  - id: 9
```

**App Structure (Must Match):**
```
activity_view:
  - odoo_id: 2 (activity ID in Odoo)
  - linked_opportunity_odoo_id: 9 (opportunity ID in Odoo)
  
opportunity_view:
  - odoo_id: 9 (matches!)
```

**Linking Query:**
```python
# Find opportunity for activity
opportunity = await db.opportunity_view.find_one({
    \"odoo_id\": activity.res_id  # Match by Odoo ID, not UUID
})
```

---

#### 🎨 ACTIVITY TYPE MAPPING (Presales KPI)

**Odoo Activity Types → Presales Categories:**
```python
PRESALES_ACTIVITY_MAPPING = {
    # Odoo activity type → Securado presales KPI
    \"POC\": [\"poc\", \"proof of concept\", \"pilot\", \"trial\"],
    \"Demo\": [\"demo\", \"demonstration\", \"product demo\", \"walkthrough\"],
    \"Presentation\": [\"presentation\", \"pitch\", \"deck\", \"slides\"],
    \"RFP_Influence\": [\"rfp\", \"tender\", \"proposal\", \"bid\"],
    \"Lead\": [\"lead\", \"qualification\", \"discovery\", \"prospecting\"],
    \"Meeting\": [\"meeting\", \"call\", \"discussion\"],
    \"Follow_up\": [\"follow up\", \"follow-up\", \"check in\"]
}

def categorize_activity(activity_summary: str) -> str:
    \"\"\"
    Map Odoo activity to presales category by keywords.
    \"\"\"
    summary_lower = (activity_summary or \"\").lower()
    
    for category, keywords in PRESALES_ACTIVITY_MAPPING.items():
        if any(keyword in summary_lower for keyword in keywords):
            return category
    
    return \"Other\"
```

**Usage for UAT-007:**
- When syncing activities, categorize them
- Store category in activity_view.presales_category
- Count by category for KPI dashboard
- Example: POC count = activities where presales_category='POC'

---

#### 📋 DETAILED IMPLEMENTATION PLAN

**Phase 1: CQRS Integration (2 hours)**
1. Add OdooActivitySynced event type
2. Create ActivityProjection
3. Update sync_handler to generate activity events
4. Create activity_view collection
5. Run migration for existing 2 activities

**Phase 2: ID Linking (1 hour)**
1. Verify opportunity ID matching (res_id → odoo_id)
2. Test linking logic
3. Ensure all activities link correctly

**Phase 3: API Enhancement (1 hour)**
1. Update /api/activities endpoint
2. Use activity_view if exists
3. Apply manager visibility (see team activities)
4. Return denormalized structure

**Phase 4: Frontend Integration (1.5 hours)**
1. Update ActivityTimeline.js
2. Handle CQRS structure
3. Display linked opportunity
4. Show presales category badges
5. Filter by user/date/status

**Phase 5: Testing (1 hour)**
1. Verify 2 activities appear
2. Test manager sees team activities
3. Test linking to opportunities
4. Verify presales categorization

---

#### 🧪 TESTING REQUIREMENTS

**Data Verification:**
```python
# After fixes:
activity_view = await db.activity_view.find({}).to_list(100)
# Should have 2+ activities

# Each activity should have:
assert activity['opportunity']  # Linked opportunity
assert activity['assigned_to']  # User info
assert activity['visible_to_user_ids']  # Visibility
assert activity['presales_category']  # KPI category
```

**UI Testing:**
```bash
# Navigate to /activity
# Should show 2+ activities
# Each activity should display:
- Activity type/summary
- Linked opportunity name (clickable)
- Assigned user
- Due date
- Status (planned, today, overdue, done)
- Presales category badge (POC, Demo, etc.)
```

**Manager Visibility Test:**
```
Login as Vinsha:
- Should see Activity 2 (her own, res_id=9)
- Should see Activity 1 if it's Zakariya's (subordinate)

Login as Zakariya:
- Should see only activities linked to his opportunities
```

---

#### 📊 EXPECTED OUTCOME AFTER FIX

**activity_view Collection:**
```javascript
{
  id: \"uuid\",
  odoo_id: 2,
  activity_type: \"Meeting\",
  summary: \"SUPREME JUDICIARY COUNCIL's opportunity\",
  presales_category: \"Meeting\",
  
  opportunity: {
    id: \"opp-uuid\",
    odoo_id: 9,
    name: \"SUPREME JUDICIARY COUNCIL's opportunity\"
  },
  
  assigned_to: {
    user_id: \"vinsha-uuid\",
    name: \"vinsha Nair\",
    email: \"vinsha.nair@securado.net\"
  },
  
  visible_to_user_ids: [
    \"vinsha-uuid\",
    \"admin-uuid\"
  ],
  
  state: \"today\",
  due_date: \"2026-01-20\",
  is_active: true
}
```

**Activity Timeline Page:**
- Shows 2+ activities in timeline
- Grouped by date
- Linked to opportunities (clickable)
- Presales category badges
- Team activities visible to managers

---

**Acceptance Criteria:**
- [ ] Activities sync from Odoo mail.activity to activity_view
- [ ] CQRS events generated (OdooActivitySynced)
- [ ] Activities linked to opportunities by odoo_id
- [ ] Activity projection builds activity_view
- [ ] Activities visible in Activity Timeline page
- [ ] Manager sees team activities
- [ ] Presales categories assigned (POC, Demo, etc.)
- [ ] Data flows through Three-Zone Data Lake
- [ ] No ID mismatch issues
- [ ] All 2+ activities displaying correctly

**Technical Constraints:**
- ✅ Must use CQRS projection pattern
- ✅ Must inherit visibility from linked opportunity
- ✅ Must write to Raw Zone first
- ✅ Must categorize for presales KPIs
- ✅ Must support manager hierarchy

**Related Files:**
- `backend/integrations/odoo/connector.py`
- `backend/services/sync/background_sync.py`
- `backend/domain/sync_handler.py` (NEW: activity sync)
- `backend/projections/activity_projection.py` (NEW)
- `backend/routes/sales.py` (activities endpoint)
- `backend/event_store/models.py` (add event type)
- `frontend/src/pages/ActivityTimeline.js`

**Dependencies:**
- Requires: CQRS infrastructure (already built ✅)
- Requires: Opportunity_view with odoo_id (already exists ✅)
- Requires: Event bus registration (cqrs_init.py)

---

### 🟢 UAT-007: Subordinate Target Assignment Interface (PD → AM)

**Priority:** P2  
**Status:** 📝 LOGGED  
**Assigned To:** TBD  
**Estimated Effort:** 8-12 hours (full feature)

**Description:**
Implement interface for Product Directors to assign Goals and Activities (POCs, Demos, RFP Influence, Leads) to Account Managers. This aligns with Securado Sales Process where CEO/CFO sets GP targets, and PDs break them down into actionable presales KPIs for AMs.

**Business Process Flow:**
```
1. CEO/CFO sets Gross Profit target for Product Director
   └─> Stored in: gp_targets collection
   
2. Product Director reviews AM accounts (from Odoo)
   └─> Views: Accounts, Opportunities synced from Odoo
   
3. PD assigns project-specific targets to AM:
   a. Presales Activity Targets:
      - POC target: e.g., 2
      - Demo target: e.g., 3
      - Presentation target: e.g., 5
      - RFP Influence: e.g., 1
      - Lead generation: e.g., 10
   
   b. Sales Number Targets:
      - Revenue target: e.g., $100,000
      - PO required: Yes/No
      - Invoice target: e.g., $100,000
   
   └─> Stored in: am_project_targets collection
   
4. AM tracks progress against assigned targets
   └─> Displayed in: AM KPI Dashboard
```

**Database Schema Required:**

**1. gp_targets Collection:**
```javascript
{
  id: \"uuid\",
  set_by_user_id: \"ceo_uuid\",
  assigned_to_user_id: \"pd_uuid\",


---

## 🆕 NEW UAT ITEMS - Activity Enhancements (User Request)

### 🟢 UAT-013: Activity Detail Expansion View

**Priority:** P2 (Enhancement)  
**Status:** 📝 LOGGED  
**Assigned To:** TBD  
**Estimated Effort:** 4-6 hours  
**Added:** 2025-01-15

**Description:**
Implement click-to-expand functionality for activities in the Activity Timeline. When user clicks an activity, show a detailed expansion view with complete information.

**Business Value:**
- Better activity tracking
- Quick access to full context
- Supports presales KPI workflow
- Improves user productivity

---

#### 🎯 REQUIRED FEATURES

**Activity Detail Panel (Expandable Card)**

When user clicks an activity in the timeline, expand to show:

**1. Activity Metadata:**
```
┌─────────────────────────────────────────────────┐
│ 🗓️  Meeting: SUPREME JUDICIARY Follow-up        │
├─────────────────────────────────────────────────┤
│ Status: Today                                   │
│ Presales Category: Meeting                      │
│ Priority: High                                  │
└─────────────────────────────────────────────────┘
```

**2. Assignment Information:**
```
Created By:    Product Director (PD)
Assigned To:   vinsha Nair (Account Manager)
Department:    Sales - MSSP
Team:          Enterprise Sales
```

**3. Dates & Timeline:**
```
Created:       Jan 10, 2026 2:30 PM
Due Date:      Jan 20, 2026 5:00 PM
Last Updated:  Jan 15, 2026 3:10 PM

Status:        ⚠️  Due in 5 days
```

**4. Linked Opportunity:**
```
Related Opportunity:
┌─────────────────────────────────────────────────┐
│ SUPREME JUDICIARY COUNCIL's opportunity         │
│ Value: $0                                       │
│ Stage: Won                                      │
│ Probability: 100%                               │
│ [View Opportunity →]                           │
└─────────────────────────────────────────────────┘
```

**5. Activity Notes/Description:**
```
Notes:
─────────────────────────────────────
Follow up on POC results from last week.
Discuss next steps for deployment.
Confirm budget allocation timeline.
─────────────────────────────────────
```

**6. Action Buttons:**
```
[Mark as Complete]  [Edit]  [Delete]  [Close]
```

---

#### 🎨 UI/UX DESIGN

**Expansion Type:** Inline expandable card (not slide-over panel)

**Interaction:**
```
Activity Timeline (Collapsed):
┌─────────────────────────────────────────────────┐
│ 🗓️  Meeting - SUPREME JUDICIARY    Today 3:10PM │
│ vinsha Nair                         Meeting     │
└─────────────────────────────────────────────────┘
        ↓ CLICK ↓
Activity Detail (Expanded):
┌─────────────────────────────────────────────────┐
│ 🗓️  Meeting: SUPREME JUDICIARY Follow-up        │
├─────────────────────────────────────────────────┤
│ ✓ Status: Today | Priority: High               │
│                                                 │
│ 👤 Assigned To: vinsha Nair                     │
│ 📧 Email: vinsha.nair@securado.net              │
│ 🏢 Department: Sales - MSSP                     │
│                                                 │
│ 📅 Due: Jan 20, 2026 (in 5 days)               │
│ 🔗 Created: Jan 10, 2026                        │
│                                                 │
│ 🎯 Related Opportunity:                         │
│ ┌─────────────────────────────────────────┐   │
│ │ SUPREME JUDICIARY - $0 - Won (100%)     │   │
│ │ [View Details →]                        │   │
│ └─────────────────────────────────────────┘   │
│                                                 │
│ 📝 Notes:                                       │
│ Follow up on POC results...                    │
│                                                 │
│ [✓ Mark Complete] [Edit] [× Close]             │
└─────────────────────────────────────────────────┘
```

**Animation:**
- Smooth height transition (300ms ease)
- Fade in content
- Highlight border when expanded

---

#### 💻 TECHNICAL IMPLEMENTATION

**Frontend Component:**

**File:** `/app/frontend/src/components/ActivityDetailCard.js` (NEW)

```jsx
import React, { useState } from 'react';
import { X, CheckCircle, Edit, ArrowRight, Calendar, User, Building2 } from 'lucide-react';
import { Button } from './ui/button';

const ActivityDetailCard = ({ activity, onClose, onMarkComplete }) => {
  const { opportunity, assigned_to, state, due_date, note, presales_category } = activity;
  
  // Calculate days until due
  const daysUntilDue = due_date 
    ? Math.ceil((new Date(due_date) - new Date()) / (1000 * 60 * 60 * 24))
    : null;
  
  const statusColor = 
    state === 'done' ? 'text-emerald-600 bg-emerald-50' :
    state === 'overdue' ? 'text-red-600 bg-red-50' :
    state === 'today' ? 'text-orange-600 bg-orange-50' :
    'text-blue-600 bg-blue-50';
  
  return (
    <div className="border-l-4 border-indigo-500 bg-gradient-to-r from-indigo-50 to-white p-6 rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
              {state.toUpperCase()}
            </span>
            {presales_category && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                {presales_category}
              </span>
            )}
          </div>
          <h3 className="text-xl font-bold text-slate-900">{activity.summary}</h3>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Assignment Info */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-slate-500" />
          <div>
            <p className="text-xs text-slate-500">Assigned To</p>
            <p className="font-medium text-slate-900">{assigned_to?.name || 'Unassigned'}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-500" />
          <div>
            <p className="text-xs text-slate-500">Due Date</p>
            <p className="font-medium text-slate-900">
              {due_date ? new Date(due_date).toLocaleDateString() : 'Not set'}
              {daysUntilDue !== null && (
                <span className={`ml-2 text-xs ${daysUntilDue < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                  ({daysUntilDue < 0 ? `${Math.abs(daysUntilDue)} days overdue` : `in ${daysUntilDue} days`})
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Linked Opportunity */}
      {opportunity && (
        <div className="card p-4 bg-white mb-4">
          <p className="text-xs text-slate-500 mb-2">Related Opportunity</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-900">{opportunity.name}</p>
              <p className="text-sm text-slate-600">
                ${opportunity.value?.toLocaleString() || '0'} • {opportunity.stage}
              </p>
            </div>
            <Button variant="ghost" size="sm">
              View <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Notes */}
      {note && note !== false && (
        <div className="mb-4">
          <p className="text-xs text-slate-500 mb-1">Notes</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded">
            {note}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {state !== 'done' && (
          <Button 
            onClick={() => onMarkComplete(activity.id)}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Mark Complete
          </Button>
        )}
        <Button variant="outline">
          <Edit className="w-4 h-4 mr-2" />
          Edit
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
};

export default ActivityDetailCard;
```

**Integration with ActivityTimeline.js:**
```jsx
const [expandedActivityId, setExpandedActivityId] = useState(null);

// In timeline rendering:
{filteredActivities.map(activity => (
  <div key={activity.id}>
    {/* Collapsed view */}
    <ActivityItem 
      activity={activity}
      onClick={() => setExpandedActivityId(activity.id)}
    />
    
    {/* Expanded detail */}
    {expandedActivityId === activity.id && (
      <ActivityDetailCard
        activity={activity}
        onClose={() => setExpandedActivityId(null)}
        onMarkComplete={handleMarkComplete}
      />
    )}
  </div>
))}
```

---

### 🟢 UAT-014: Activity Dashboard with Risk Indicators

**Priority:** P2  
**Status:** 📝 LOGGED  
**Estimated Effort:** 3-4 hours  

**Description:**
Add activity summary dashboard showing overdue, in-progress, at-risk activities with visual indicators.

**Location:** Top of Activity Timeline page (above timeline)

**Dashboard Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Activity Overview                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🔴 Overdue        🟡 Due Today       🟢 In Progress   ✅ Done   │
│      3                  2                  8              15     │
│   (-2 days)         (urgent)          (on track)     (this week) │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│ At Risk Activities: 2                                           │
│  • POC for Ministry - Due 2 days ago                           │
│  • RFP Response - Due tomorrow (not started)                   │
└─────────────────────────────────────────────────────────────────┘
```

**Metrics to Display:**

**1. By Status:**
- Overdue (state='overdue' OR due_date < today)
- Due Today (due_date = today)
- In Progress (state='today' OR state='planned')
- Completed (state='done')

**2. By Risk Level:**
```python
# Risk calculation
def calculate_risk(activity):
    if activity.state == 'overdue':
        return 'high'
    
    days_until_due = (activity.due_date - datetime.now()).days
    
    if days_until_due < 0:
        return 'high'  # Overdue
    elif days_until_due <= 1:
        return 'high'  # Due today/tomorrow
    elif days_until_due <= 3:
        return 'medium'  # Due soon
    else:
        return 'low'  # On track
```

**3. By Presales Category:**
```
POC Activities: 3 (2 complete, 1 pending)
Demos: 5 (3 complete, 2 pending)
Presentations: 2 (1 complete, 1 pending)
RFP: 1 (overdue!)
```

**Implementation:**

**Backend API:**
```python
# File: backend/api/v2_activities.py

@router.get("/dashboard-summary")
async def get_activity_dashboard_summary(
    token_data: dict = Depends(require_approved())
):
    """
    Get activity dashboard summary with risk indicators.
    """
    db = Database.get_db()
    user_id = token_data["id"]
    
    # Get all accessible activities
    activities = await db.activity_view.find({
        "visible_to_user_ids": user_id,
        "is_active": True
    }).to_list(10000)
    
    # Calculate metrics
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0)
    today_end = now.replace(hour=23, minute=59, second=59)
    
    overdue = []
    due_today = []
    in_progress = []
    completed = []
    at_risk = []
    
    for activity in activities:
        due_date = activity.get('due_date')
        state = activity.get('state')
        
        # Parse due date
        if due_date and isinstance(due_date, str):
            try:
                due_dt = datetime.fromisoformat(due_date.replace('Z', '+00:00'))
            except:
                due_dt = None
        else:
            due_dt = None
        
        # Categorize
        if state == 'done':
            completed.append(activity)
        elif state == 'overdue' or (due_dt and due_dt < now):
            overdue.append(activity)
            at_risk.append(activity)
        elif due_dt and today_start <= due_dt <= today_end:
            due_today.append(activity)
            if state != 'done':
                at_risk.append(activity)
        else:
            in_progress.append(activity)
        
        # Risk assessment
        if due_dt and state != 'done':
            days_until = (due_dt - now).days
            if days_until <= 1:
                at_risk.append(activity)
    
    # Group by presales category
    by_presales = {}
    for activity in activities:
        category = activity.get('presales_category', 'Other')
        if category not in by_presales:
            by_presales[category] = {'total': 0, 'completed': 0, 'pending': 0}
        
        by_presales[category]['total'] += 1
        if activity.get('state') == 'done':
            by_presales[category]['completed'] += 1
        else:
            by_presales[category]['pending'] += 1
    
    return {
        "overview": {
            "overdue": {
                "count": len(overdue),
                "activities": [format_activity_summary(a) for a in overdue[:5]]
            },
            "due_today": {
                "count": len(due_today),
                "activities": [format_activity_summary(a) for a in due_today]
            },
            "in_progress": {
                "count": len(in_progress)
            },
            "completed": {
                "count": len(completed)
            }
        },
        "at_risk": {
            "count": len(at_risk),
            "activities": [format_activity_summary(a) for a in at_risk[:10]]
        },
        "by_presales_category": by_presales,
        "total_activities": len(activities)
    }

def format_activity_summary(activity):
    return {
        "id": activity.get("id"),
        "summary": activity.get("summary"),
        "due_date": activity.get("due_date"),
        "opportunity_name": activity.get("opportunity", {}).get("name"),
        "state": activity.get("state")
    }
```

**Frontend Component:**

**File:** `/app/frontend/src/components/ActivityDashboard.js` (NEW)

```jsx
import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, CheckCircle, TrendingUp } from 'lucide-react';
import api from '../services/api';

const ActivityDashboard = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      const response = await api.get('/v2/activities/dashboard-summary');
      setSummary(response.data);
    } catch (error) {
      console.error('Failed to fetch activity summary:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !summary) return null;

  const { overview, at_risk, by_presales_category } = summary;

  return (
    <div className="space-y-4 mb-6">
      {/* Status Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatusCard
          title="Overdue"
          count={overview.overdue.count}
          icon={AlertTriangle}
          color="red"
          subtitle={`${overview.overdue.count} need attention`}
        />
        <StatusCard
          title="Due Today"
          count={overview.due_today.count}
          icon={Clock}
          color="orange"
          subtitle="Urgent"
        />
        <StatusCard
          title="In Progress"
          count={overview.in_progress.count}
          icon={TrendingUp}
          color="blue"
          subtitle="On track"
        />
        <StatusCard
          title="Completed"
          count={overview.completed.count}
          icon={CheckCircle}
          color="emerald"
          subtitle="This week"
        />
      </div>

      {/* At Risk Activities */}
      {at_risk.count > 0 && (
        <div className="card p-4 border-l-4 border-red-500 bg-red-50">
          <h3 className="font-semibold text-red-900 mb-2">
            ⚠️ At Risk Activities ({at_risk.count})
          </h3>
          <div className="space-y-2">
            {at_risk.activities.map((act, idx) => (
              <div key={idx} className="text-sm">
                <span className="font-medium text-slate-900">{act.summary}</span>
                <span className="text-slate-600"> - </span>
                <span className="text-red-600">
                  {act.due_date ? `Due ${new Date(act.due_date).toLocaleDateString()}` : 'No due date'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Presales Category Breakdown */}
      <div className="card p-4">
        <h3 className="font-semibold text-slate-900 mb-3">Presales Activities</h3>
        <div className="grid grid-cols-5 gap-3">
          {Object.entries(by_presales_category).map(([category, stats]) => (
            <div key={category} className="text-center">
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-xs text-slate-600">{category}</p>
              <p className="text-xs text-emerald-600">{stats.completed} done</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const StatusCard = ({ title, count, icon: Icon, color, subtitle }) => {
  const colorClasses = {
    red: 'bg-red-50 text-red-600 border-red-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200',
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200'
  };

  return (
    <div className={`card p-4 border ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-6 h-6" />
        <span className="text-3xl font-bold text-slate-900">{count}</span>
      </div>
      <p className="font-medium text-slate-900">{title}</p>
      <p className="text-xs opacity-75">{subtitle}</p>
    </div>
  );
};

export default ActivityDashboard;
```

**Integration with ActivityTimeline.js:**
```jsx
import ActivityDashboard from '../components/ActivityDashboard';

// Add at top of timeline (after header, before timeline):
<ActivityDashboard />

{/* Activity Timeline section continues below */}
```

---

#### 📋 IMPLEMENTATION CHECKLIST

**Phase 1: Activity Detail Expansion (3 hours)**
- [ ] Create ActivityDetailCard.js component
- [ ] Add expandedActivityId state to ActivityTimeline
- [ ] Update ActivityItem to be clickable
- [ ] Integrate expansion animation
- [ ] Test expand/collapse
- [ ] Add Mark Complete functionality

**Phase 2: Activity Dashboard (2 hours)**
- [ ] Create ActivityDashboard.js component
- [ ] Add dashboard-summary endpoint
- [ ] Calculate overdue/due today/in progress
- [ ] Implement risk assessment logic
- [ ] Display presales category breakdown
- [ ] Integrate into ActivityTimeline page

**Phase 3: Testing (1 hour)**
- [ ] Test expansion on click
- [ ] Verify all activity details display
- [ ] Test Mark Complete action
- [ ] Verify dashboard calculations
- [ ] Test manager sees team activities
- [ ] Performance check

---

#### 🎯 ACCEPTANCE CRITERIA

**Activity Detail Expansion:**
- [ ] Click activity → Expands inline with smooth animation
- [ ] Shows: Assigned to, Due date, Status, Priority
- [ ] Shows: Linked opportunity (clickable)
- [ ] Shows: Notes/description
- [ ] "Mark Complete" button works
- [ ] Close button collapses detail
- [ ] Clicking another activity switches expansion

**Activity Dashboard:**
- [ ] Shows 4 status cards (Overdue, Due Today, In Progress, Done)
- [ ] Displays at-risk activities list
- [ ] Shows presales category breakdown
- [ ] Counts are accurate
- [ ] Updates in real-time
- [ ] Risk indicators (red/orange/green) working

**Manager Visibility:**
- [ ] Manager sees subordinate activities in dashboard
- [ ] Overdue count includes team activities
- [ ] At-risk list includes team items

---

#### 📊 DATA FLOW

**Activity Detail Data:**
```
activity_view collection:
  ↓
{
  id, summary, note, due_date, state,
  presales_category,
  
  opportunity: {
    id, name, value, stage  // Pre-joined!
  },
  
  assigned_to: {
    user_id, name, email  // Pre-joined!
  },
  
  visible_to_user_ids: [...]  // Authorization
}
  ↓
API: GET /v2/activities/
  ↓
Frontend: Activity with all details (no additional queries needed)
```

---

#### 🎨 DESIGN MOCKUPS

**Collapsed Activity (Current):**
```
┌────────────────────────────────────────┐
│ 🗓️  Meeting 3:10 PM      Meeting      │
│ SUPREME JUDICIARY                      │
└────────────────────────────────────────┘
```

**Expanded Activity (New):**
```
┌────────────────────────────────────────┐
│ 🗓️  Meeting - SUPREME JUDICIARY        │
│ ┌─ Status: Today | Category: Meeting ─┐│
│ │                                      ││
│ │ 👤 Assigned: vinsha Nair             ││
│ │ 📧 vinsha.nair@securado.net          ││
│ │                                      ││
│ │ 📅 Due: Jan 20 (in 5 days)          ││
│ │ 🎯 Opportunity: SUPREME JUDICIARY    ││
│ │    $0 • Won • 100%                   ││
│ │    [View Details →]                  ││
│ │                                      ││
│ │ 📝 Follow up on deployment timeline  ││
│ │                                      ││
│ │ [✓ Mark Complete] [Edit] [Close]    ││
│ └──────────────────────────────────────┘│
└────────────────────────────────────────┘
```

---

**Related Files:**
- `frontend/src/components/ActivityDetailCard.js` (NEW)
- `frontend/src/components/ActivityDashboard.js` (NEW)
- `frontend/src/pages/ActivityTimeline.js` (integrate components)
- `backend/api/v2_activities.py` (add dashboard-summary endpoint)

**Dependencies:**
- Requires: activity_view with complete data (already exists ✅)
- Requires: Presales categorization (already working ✅)
- Requires: Opportunity linking (already implemented ✅)

---

## 📊 UPDATED UAT TRACKER

| UAT ID | Title | Priority | Status | Effort |
|--------|-------|----------|--------|--------|
| UAT-013 | Activity Detail Expansion | P2 | 📝 Logged | 4-6 hrs |
| UAT-014 | Activity Dashboard | P2 | 📝 Logged | 3-4 hrs |

**Total UAT Items:** 14  
**Completed:** 6/14 (43%)  
**Remaining Effort:** ~40-45 hours

---

## 🎯 UPDATED PRIORITY PLAN

### Phase 1: Critical Fixes (P0) - 14-17 hours
1. ✅ UAT-006: Activity sync (COMPLETE)
2. ✅ UAT-009: Toast fix (COMPLETE)
3. **UAT-011:** Opportunity detail panel (needs browser refresh verification)
4. **UAT-010:** Team opportunities filter (8 hrs)
5. **UAT-005:** Granular RBAC (6 hrs)

### Phase 2: Activity Enhancements (P2) - 7-10 hours
6. **UAT-013:** Activity detail expansion (4-6 hrs)
7. **UAT-014:** Activity dashboard with risk (3-4 hrs)

### Phase 3: Other Enhancements (P1-P2) - 19 hours
8. UAT-012: Probability calculation (4 hrs)
9. UAT-004: Configurable sync (2 hrs)
10. UAT-003: Refresh buttons (4 hrs)
11. UAT-007: Target assignment (12 hrs)

**Total Remaining:** ~40-45 hours (5-6 days)

---

## 📄 DOCUMENTATION UPDATES

**Will Update:**
1. `/app/docs/UAT_TRACKER.md` - Added UAT-013, UAT-014
2. `/app/docs/TECHNICAL_REFERENCE.md` - Activity detail view architecture
3. `/app/docs/ACTIVITY_AUTHORIZATION_STRATEGY.md` - Risk calculation logic
4. `/app/docs/SECURADO_SALES_PROCESS_PLAN.md` - Activity tracking integration

---


---

## 🔴 NEW UAT ITEMS - User Feedback (2025-01-15)

### 🟡 UAT-009: Remove Repetitive Success Toast

**Priority:** P1  
**Status:** ✅ COMPLETE  
**Assigned To:** E1  
**Effort:** 5 minutes  
**Completed:** 2025-01-15

**Description:**
"Dashboard loaded successfully" toast appears every time dashboard loads (on navigation, refresh, etc.). This is repetitive and annoying for users.

**Solution Implemented:**
- Removed `toast.success('Dashboard loaded successfully')` from fetchDashboard()
- Toast only shows on:
  - Manual refresh (user clicks Refresh button)
  - Manual sync (user clicks Sync Now)
  - Errors (always show error toasts)

**File Changed:**
- `/app/frontend/src/pages/SalesDashboard.js` (line 45)

**Status:** ✅ FIXED

---

### 🔴 UAT-010: Opportunities Tab - Team View & Filtering

**Priority:** P0 (Manager Feature Broken)  
**Status:** 📝 LOGGED  
**Assigned To:** TBD  
**Estimated Effort:** 6-8 hours

**Description:**
The Opportunities page (`/opportunities`) shows only individual opportunities. Missing critical manager features:
1. No team opportunities visible (manager should see subordinate opportunities)
2. No filtering mechanism (My Opportunities vs Team Opportunities)
3. Different from dashboard which correctly shows team data

**Current State:**
- Dashboard: Shows 4 opportunities (2 own + 2 team) ✅
- Opportunities page: Shows unknown count (needs investigation) ❌
- No filter dropdown to switch between "My Opps" and "Team Opps" ❌

**Required Features:**

**1. Filter Dropdown (Top-Right):**
```jsx
<Select value={filter} onChange={setFilter}>
  <Option value="all">All Opportunities ({total})</Option>
  <Option value="mine">My Opportunities ({own_count})</Option>
  {isManager && (
    <Option value="team">Team Opportunities ({team_count})</Option>
  )}
</Select>
```

**2. Backend API Enhancement:**
```python
# File: backend/routes/sales.py or api/v2_dashboard.py

@router.get("/v2/opportunities")
async def get_opportunities_v2(
    filter: str = Query(default="all"),  # "all", "mine", "team"
    token_data: dict = Depends(require_approved())
):
    db = Database.get_db()
    user_id = token_data["id"]
    
    # Get user profile for hierarchy info
    user_profile = await db.user_profiles.find_one({"id": user_id})
    
    if filter == "mine":
        # Only own opportunities
        opportunities = await db.opportunity_view.find({
            "salesperson.user_id": user_id,
            "is_active": True
        }).to_list(1000)
    
    elif filter == "team":
        # Only subordinate opportunities (for managers)
        subordinate_ids = [
            s["user_id"] 
            for s in user_profile.get("hierarchy", {}).get("subordinates", [])
        ]
        
        opportunities = await db.opportunity_view.find({
            "salesperson.user_id": {"$in": subordinate_ids},
            "is_active": True
        }).to_list(1000)
    
    else:  # "all"
        # All accessible (own + team)
        opportunities = await db.opportunity_view.find({
            "visible_to_user_ids": user_id,
            "is_active": True
        }).to_list(1000)
    
    return {
        "opportunities": opportunities,
        "filter": filter,
        "counts": {
            "all": len(opportunities),
            "mine": count_mine,
            "team": count_team
        }
    }
```

**3. Frontend Updates:**
```jsx
// File: frontend/src/pages/Opportunities.js

const [filter, setFilter] = useState('all');
const [opportunities, setOpportunities] = useState([]);

const fetchOpportunities = async () => {
  const response = await dashboardAPI.getV2Opportunities({ filter });
  setOpportunities(response.data.opportunities);
  setCounts(response.data.counts);
};

// Add filter UI
<div className="flex justify-between mb-4">
  <h1>Opportunities</h1>
  
  {isManager && (
    <Select value={filter} onValueChange={setFilter}>
      <SelectTrigger className="w-[200px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">
          All ({counts.all})
        </SelectItem>
        <SelectItem value="mine">
          My Opportunities ({counts.mine})
        </SelectItem>
        <SelectItem value="team">
          Team Opportunities ({counts.team})
        </SelectItem>
      </SelectContent>
    </Select>
  )}
</div>
```

**Acceptance Criteria:**
- [ ] Manager sees filter dropdown with 3 options
- [ ] "All" shows own + team opportunities
- [ ] "My Opportunities" shows only own
- [ ] "Team Opportunities" shows only subordinates'
- [ ] Non-managers don't see team option
- [ ] Filter persists during session
- [ ] Counts are accurate

**Related Files:**
- `frontend/src/pages/Opportunities.js`
- `backend/api/v2_dashboard.py` (add getV2Opportunities endpoint)
- `frontend/src/services/api.js` (add API method)

---

### 🔴 UAT-011: Opportunity Card Click - Detail Panel Not Opening

**Priority:** P0 (Broken Navigation)  
**Status:** 📝 LOGGED  
**Assigned To:** TBD  
**Estimated Effort:** 2-3 hours

**Description:**
Clicking on an opportunity card in the dashboard does NOT open the detail panel. Previously, expansion click would show opportunity details in a slide-over panel.

**Previous Behavior (Working):**
```
Click opportunity card
  ↓
OpportunityDetailPanel slides in from right
  ↓
Shows: Opportunity details, activities, contacts, notes
  ↓
User can edit or close panel
```

**Current Behavior (Broken):**
```
Click opportunity card
  ↓
Nothing happens (no navigation, no panel)
```

**Investigation Required:**

**1. Check Dashboard Card Click Handler:**
```jsx
// File: frontend/src/pages/SalesDashboard.js

// Current (around line 175):
<div
  className="..."
  onClick={() => navigate(`/opportunities/${opp.id}`)}  // Does this work?
>
```

**2. Check if OpportunityDetailPanel Component Exists:**
```bash
# Find component
find /app/frontend/src -name "*OpportunityDetail*"

# Expected: OpportunityDetailPanel.js or similar
```

**3. Check Route Configuration:**
```jsx
// File: frontend/src/App.js

// Should have:
<Route path="/opportunities/:id" element={<OpportunityDetail />} />
// OR use slide-over panel (no route change)
```

**Required Fix:**

**Option A: Restore Slide-Over Panel (Recommended)**
```jsx
// In SalesDashboard.js

const [selectedOpportunity, setSelectedOpportunity] = useState(null);

// Card onClick:
onClick={() => setSelectedOpportunity(opp)}

// Render panel:
{selectedOpportunity && (
  <OpportunityDetailPanel
    opportunity={selectedOpportunity}
    onClose={() => setSelectedOpportunity(null)}
  />
)}
```

**Option B: Navigation to Detail Page**
```jsx
// Ensure route exists and ID is correct
onClick={() => navigate(`/opportunities/${opp.odoo_id}`)}  // Use odoo_id not UUID
```

**Acceptance Criteria:**
- [ ] Clicking opportunity card opens detail view
- [ ] Detail panel/page shows opportunity information
- [ ] Can close panel or navigate back
- [ ] Works for both own and team opportunities
- [ ] Previous functionality restored

**Files to Check:**
- `frontend/src/pages/SalesDashboard.js`
- `frontend/src/components/OpportunityDetailPanel.js` (if exists)
- `frontend/src/App.js` (routes)
- `frontend/src/pages/OpportunityDetail.js` (if route-based)

---

### 🟡 UAT-012: Probability Calculation Not Working

**Priority:** P1 (Missing Feature)  
**Status:** 📝 LOGGED  
**Assigned To:** TBD  
**Estimated Effort:** 3-4 hours

**Description:**
Opportunity probability calculation feature is not working. This is the Blue Sheet probability calculation that was previously implemented.

**Expected Feature:**
```
Opportunity Detail View:
  ↓
"Calculate Probability" button
  ↓
Blue Sheet Analysis Form:
  - Economic Buyer Identified: [Yes/No]
  - Coach Engaged: [Yes/No]
  - Budget Confirmed: [Yes/No]
  - etc.
  ↓
Submit
  ↓
Calculated Probability: 75%
AI Recommendations: [List of suggestions]
```

**Current State:**
- Endpoint exists: `POST /api/opportunities/{id}/calculate-probability`
- Backend logic exists in `routes/sales.py`
- But: Not integrated with CQRS opportunity_view
- But: Frontend may not have button/form

**Investigation Required:**

**1. Backend Endpoint Check:**
```bash
# Test endpoint
curl -X POST /api/opportunities/{opp_id}/calculate-probability \
  -H "Authorization: Bearer {token}" \
  -d '{
    "economic_buyer_identified": true,
    "coach_engaged": false,
    ...
  }'

# Expected: Returns calculated probability
```

**2. Frontend Integration:**
```jsx
// Check if exists in OpportunityDetailPanel or OpportunityDetail page

// Should have:
<Button onClick={openBlueSheetForm}>
  Calculate Probability
</Button>

<BlueSheetAnalysisModal
  opportunity={opportunity}
  onCalculate={handleCalculate}
/>
```

**3. CQRS Integration:**
```python
# After calculation, update opportunity_view:
await db.opportunity_view.update_one(
    {"odoo_id": opp_id},
    {
        "$set": {
            "probability": calculated_probability,
            "blue_sheet_analysis": analysis_data,
            "last_calculated": datetime.now(timezone.utc)
        }
    }
)

# Also update Odoo if needed (write-back)
```

**Required Implementation:**

**Backend:**
- [ ] Verify calculate-probability endpoint working
- [ ] Update endpoint to work with CQRS opportunity_view (odoo_id)
- [ ] Persist calculation results to opportunity_view
- [ ] Generate event: OpportunityProbabilityCalculated

**Frontend:**
- [ ] Add "Calculate Probability" button to opportunity detail
- [ ] Create/restore Blue Sheet form modal
- [ ] Submit calculation to backend
- [ ] Display results (probability % + AI recommendations)
- [ ] Show probability on opportunity cards

**Acceptance Criteria:**
- [ ] "Calculate Probability" button visible on opportunity detail
- [ ] Blue Sheet form opens with all fields
- [ ] Calculation returns probability %
- [ ] AI recommendations generated (if LLM configured)
- [ ] Probability saved and displayed on cards
- [ ] Works with CQRS opportunity_view

**Related Files:**
- `backend/routes/sales.py` (calculate-probability endpoint)
- `backend/api/v2_dashboard.py` (may need v2 endpoint)
- `frontend/src/components/BlueSheetModal.js` (if exists)
- `frontend/src/pages/OpportunityDetail.js`

---

## 📊 UPDATED PROGRESS TRACKING

| UAT ID | Title | Priority | Status | Effort | Assignee |
|--------|-------|----------|--------|--------|----------|
| UAT-001 | Remove CQRS Banner | P1 | ✅ COMPLETE | 15min | E1 |
| UAT-002 | Notification Position | P1 | ✅ COMPLETE | 30min | E1 |
| UAT-003 | Manual Refresh | P2 | 📝 Logged | 3-4hrs | TBD |
| UAT-004 | Configurable Sync | P2 | 📝 Logged | 2hrs | TBD |
| UAT-005 | Granular RBAC | P0 | 📝 Logged | 4-6hrs | TBD |
| UAT-006 | Activity Sync Fix | P0 | 🔄 80% Done | 4-6hrs | E1 |
| UAT-007 | Target Assignment | P2 | 📝 Logged | 8-12hrs | TBD |
| UAT-008 | System Config Menu | P2 | ✅ COMPLETE | 1hr | E1 |
| **UAT-009** | **Remove Success Toast** | **P1** | **✅ COMPLETE** | **5min** | **E1** |
| **UAT-010** | **Team Opportunities Filter** | **P0** | **📝 Logged** | **6-8hrs** | **TBD** |
| **UAT-011** | **Opportunity Click Broken** | **P0** | **📝 Logged** | **2-3hrs** | **TBD** |
| **UAT-012** | **Probability Calculation** | **P1** | **📝 Logged** | **3-4hrs** | **TBD** |

**Total Items:** 12  
**Completed:** 4/12 (33%)  
**In Progress:** 1/12 (UAT-006)  
**Remaining:** 7/12  
**Total Effort Remaining:** ~30-40 hours

---

## 🎯 PRIORITY IMPLEMENTATION ORDER (UPDATED)

### Phase 1: Critical Fixes (P0 Items) - 10-17 hours
1. ✅ UAT-009: Success toast removed (DONE)
2. **UAT-010:** Team opportunities filter (6-8 hrs) - NEXT
3. **UAT-011:** Opportunity detail panel (2-3 hrs)
4. **UAT-006:** Complete activity sync (1 hr remaining)
5. **UAT-005:** Granular RBAC (4-6 hrs)

### Phase 2: UX Improvements (P1 Items) - 3-4 hours
6. **UAT-012:** Probability calculation (3-4 hrs)

### Phase 3: Enhancements (P2 Items) - 9-16 hours
7. UAT-004: Configurable auto-sync (2 hrs)
8. UAT-003: Manual refresh buttons (3-4 hrs)
9. UAT-007: Target assignment system (8-12 hrs)

---

## 📝 INVESTIGATION NOTES - UAT-010

### Current Opportunities Page Issues

**What We Know:**
- Dashboard correctly uses v2 API (`/api/v2/dashboard/`)
- Dashboard shows 4 opportunities for manager (2 own + 2 team)
- Opportunities page likely uses old API (`/api/opportunities`)
- Old API may not have team filtering

**Files to Investigate:**
- `frontend/src/pages/Opportunities.js` - Current implementation
- Which API endpoint is it calling?
- Does it use v1 or v2?
- Does it have filter logic?

**Likely Issue:**
```javascript
// Opportunities.js probably calls:
await api.get('/opportunities')  // Old v1 endpoint

// Should call:
await api.get('/v2/dashboard/opportunities?filter=all')  // v2 with filtering
```

**Required Changes:**
1. Update Opportunities.js to use v2 API
2. Add filter dropdown UI
3. Implement filter logic (all/mine/team)
4. Show team badge on team opportunities
5. Display subordinate name on team opps

---

## 📝 INVESTIGATION NOTES - UAT-011

### Opportunity Card Click Issue

**Observed Behavior:**
- Opportunity cards have arrow icon (suggests clickable)
- onClick handler exists: `onClick={() => navigate(\`/opportunities/${opp.id}\`)}`
- But: Nothing happens when clicked

**Possible Causes:**
1. **Route doesn't exist:** No `/opportunities/:id` route in App.js
2. **ID format wrong:** Using opp.id (UUID) but should use opp.odoo_id
3. **Component doesn't exist:** OpportunityDetail page missing
4. **Panel component missing:** OpportunityDetailPanel not imported

**Previous Implementation (From Handoff):**
- Had OpportunityDetailPanel component
- Slide-over panel from right side
- Showed: Details, activities, contacts, edit button

**Required Investigation:**
```bash
# Check if component exists
ls /app/frontend/src/components/*Opportunity*Detail*

# Check if route exists
grep "opportunities/:id" /app/frontend/src/App.js

# Check current card onClick
grep -A 5 "onClick.*navigate.*opportunities" /app/frontend/src/pages/SalesDashboard.js
```

**Fix Strategy:**
- Option A: Restore OpportunityDetailPanel (slide-over)
- Option B: Create OpportunityDetail page with route
- Option C: Navigate to existing opportunities page with selected opp highlighted

---

## 🎯 NEXT ACTIONS

**Immediate (Now):**
1. ✅ Remove success toast (DONE)
2. Investigate Opportunities.js current implementation
3. Check if OpportunityDetailPanel exists
4. Document findings for UAT-010 and UAT-011

**Short-term (Next 2-3 hours):**
1. Fix UAT-011 (opportunity click)
2. Implement UAT-010 (team filter)
3. Complete UAT-006 (activity sync frontend)

**Medium-term (Tomorrow):**
1. UAT-005: Granular RBAC
2. UAT-012: Probability calculation
3. UAT-004: Configurable sync

---
  product_line: \"MSSP\" | \"Network Security\" | \"GRC\" | \"App Security\",
  gp_target_amount: 500000,
  period: \"Q1 2026\",
  period_start: Date,
  period_end: Date,
  status: \"active\",
  created_at: Date
}
```

**2. am_project_targets Collection:**
```javascript
{
  id: \"uuid\",
  pd_user_id: \"pd_uuid\",
  am_user_id: \"am_uuid\",
  
  // Link to Odoo entities
  account_odoo_id: 123,
  opportunity_odoo_id: 456,
  
  // Presales targets
  presales_targets: {
    poc_target: 2,
    demo_target: 3,
    presentation_target: 5,
    rfp_influence_target: 1,
    lead_target: 10
  },
  
  // Sales targets
  sales_targets: {
    revenue_target: 100000,
    po_required: true,
    invoice_target: 100000
  },
  
  assigned_date: Date,
  target_completion_date: Date,
  status: \"assigned\"
}
```

**3. presales_activities Collection:**
```javascript
{
  id: \"uuid\",
  am_project_target_id: \"uuid\",
  
  activity_type: \"POC\" | \"Demo\" | \"Presentation\" | \"RFP_Influence\" | \"Lead\",
  activity_date: Date,
  
  // Synced from Odoo or manual
  odoo_activity_id: 789,
  description: \"POC demonstration\",
  status: \"completed\",
  
  logged_by: \"am_uuid\",
  source: \"odoo\" | \"manual\"
}
```

**UI Components Required:**

**PD Dashboard:**
1. "My GP Target" card (shows CEO-assigned target)
2. "Team Performance" section
3. "Assign Targets" button per AM/project

**PD Assignment Modal:**
```
┌─────────────────────────────────────────────────┐
│ Assign Targets to Account Manager              │
├─────────────────────────────────────────────────┤
│ AM: Zakariya                                    │
│ Project: Ministry of Information ($100K)        │
│                                                 │
│ Presales Activity Targets:                     │
│   POC:              [2]                        │
│   Demos:            [3]                        │
│   Presentations:    [5]                        │
│   RFP Influence:    [1]                        │
│   Leads:            [10]                       │
│                                                 │
│ Sales Number Targets:                           │
│   Revenue Target:   [$100,000]                 │
│   PO Required:      [✓]                        │
│   Invoice Target:   [$100,000]                 │
│                                                 │
│ [Cancel] [Assign Targets]                      │
└─────────────────────────────────────────────────┘
```

**AM KPI Dashboard:**
```
┌─────────────────────────────────────────────────┐
│ My Projects with Targets                        │
├─────────────────────────────────────────────────┤
│ Ministry of Information - $100,000              │
│                                                 │
│ Presales Progress:                              │
│   POC:          2/2 ✅ (100%)                   │
│   Demos:        1/3 🟡 (33%)                    │
│   Presentations: 3/5 🟡 (60%)                   │
│   RFP Influence: 0/1 🔴 (0%)                   │
│   Leads:        8/10 🟡 (80%)                   │
│                                                 │
│ Sales Progress:                                 │
│   Revenue:      $100,000/$100,000 ✅            │
│   PO:           Received ✅                      │
│   Invoice:      $100,000 ✅                     │
│   Collection:   $80,000 🟡                      │
│   Due Date:     On Time ✅                      │
│                                                 │
│ Overall Score: 75/100 🟡                       │
└─────────────────────────────────────────────────┘
```

**API Endpoints:**
```
# CEO Endpoints
POST   /api/targets/gp/set
GET    /api/targets/gp/overview
PUT    /api/targets/gp/{id}

# PD Endpoints
GET    /api/targets/pd/my-target
POST   /api/targets/pd/assign-project
GET    /api/targets/pd/team-dashboard

# AM Endpoints
GET    /api/targets/am/my-projects
GET    /api/targets/am/kpi-dashboard
POST   /api/activities/presales/log
```

**Acceptance Criteria:**
- [ ] CEO can set GP targets for PDs
- [ ] PD sees their GP target
- [ ] PD can assign presales + sales targets to AMs
- [ ] AM sees all assigned project targets
- [ ] AM can view KPI progress
- [ ] Progress calculated from Odoo data + manual logs
- [ ] Score calculation working (presales 40%, sales 60%)

**Technical Notes:**
- Leverage existing CQRS projections for KPI calculations
- Create new projection: kpi_dashboard_projection
- Activity mapping from Odoo mail.activity (keyword-based)
- Collection efficiency from invoice payment_date vs due_date

**Dependencies:**
- Requires: Product line field in opportunities (from Odoo)
- Requires: User model extended with assigned_product_line
- Requires: Activity type keyword mapping
- Requires: Invoice payment tracking from Odoo

**Related Files:**
- `backend/routes/targets.py` (new file)
- `backend/projections/kpi_dashboard_projection.py` (new file)
- `frontend/src/pages/PDDashboard.js` (new file)
- `frontend/src/pages/AMKPIDashboard.js` (new file)
- `frontend/src/components/AssignTargetsModal.js` (new file)

**Reference Documentation:**
- See: `/app/docs/SECURADO_SALES_PROCESS_PLAN.md`

---

## 🔧 IMPLEMENTATION SCHEDULE

### Week 1: Quick Wins (UAT-001, UAT-002, UAT-004)
- [ ] Day 1: UAT-001 (Remove banner) + UAT-002 (Notification position)
- [ ] Day 2-3: UAT-004 (Configurable auto-sync)
- [ ] Day 4: Testing
- [ ] Day 5: UAT feedback

**Effort:** ~1 day development + 1 day testing

### Week 2: Data Refresh & RBAC (UAT-003, UAT-005)
- [ ] Day 1-2: UAT-003 (Manual refresh buttons)
- [ ] Day 3-4: UAT-005 (Granular RBAC)
- [ ] Day 5: Security testing

**Effort:** 2-3 days development + 1 day testing

### Week 3: Activity Sync Fix (UAT-006)
- [ ] Day 1-2: Debug activity sync
- [ ] Day 3: Fix and test
- [ ] Day 4-5: Verification

**Effort:** 2-3 days investigation + fixes

### Week 4: Target Assignment System (UAT-007)
- [ ] Day 1-2: Database schema + Backend APIs
- [ ] Day 3-4: Frontend components
- [ ] Day 5: Integration testing

**Effort:** Full week (complex feature)

---

### 🟢 UAT-008: System Config Access from User Menu

**Priority:** P2  
**Status:** 📝 LOGGED  
**Assigned To:** TBD  
**Estimated Effort:** 1 hour

**Description:**
All privileged users (those with system config permissions) should be able to access System Config view from the left-bottom user display area (user menu dropdown).

**Current State:**
- User menu exists in Layout.js (left-bottom profile section)
- Shows: My Profile, Settings, System Health (admin only)
- System Config page exists but not accessible from user menu

**Required Changes:**

**Backend:**
- No backend changes required
- Permission check already exists: `require_permission("system.config.view")`

**Frontend:**

**File:** `/app/frontend/src/components/Layout.js`

Update user dropdown menu (around line 295-310):
```javascript
{/* Menu Items */}
<div className="py-1">
  <Link to="/profile" ...>
    <User className="w-4 h-4" />
    My Profile
  </Link>
  
  <Link to="/system-config" ...>
    <Settings className="w-4 h-4" />
    Settings
  </Link>
  
  {/* NEW: System Config for privileged users */}
  {(user?.is_super_admin || user?.permissions?.includes('system.config.view')) && (
    <Link to="/system-config" ...>
      <Cog className="w-4 h-4" />
      System Config
    </Link>
  )}
  
  {user?.is_super_admin && (
    <Link to="/admin-dashboard" ...>
      <Database className="w-4 h-4" />
      System Health
    </Link>
  )}
</div>
```

**Role-Based Visibility:**
- Super Admin: Always sees System Config
- Product Directors: See if granted system.config.view permission
- CEO/CFO: See if granted permission
- Sales/AM: Hidden (no system config access)

**Acceptance Criteria:**
- [ ] System Config link visible to Super Admin (always)
- [ ] System Config link visible to users with system.config.view permission
- [ ] System Config link hidden from regular users (AM, Sales)
- [ ] Clicking link navigates to /system-config page
- [ ] Page shows relevant config options based on role
- [ ] Non-privileged users get 403 if they try direct URL

**UI/UX Requirements:**
- Icon: Settings/Cog icon
- Label: "System Config" or "Configuration"
- Position: Between "Settings" and "System Health" in dropdown
- Styling: Consistent with other menu items

**Testing:**
- [ ] Login as Super Admin → See System Config in menu
- [ ] Login as PD with permission → See System Config
- [ ] Login as AM without permission → Don't see System Config
- [ ] Click link → Navigate to config page
- [ ] Direct URL without permission → 403 error

**Related Files:**
- `frontend/src/components/Layout.js` (user dropdown menu)
- `backend/routes/config.py` or similar (permission check)
- `frontend/src/pages/SystemConfig.js` (if exists, or create)

**Dependencies:**
- Requires: Permission system supporting system.config.view
- Requires: User object has permissions array in JWT/context

**Nice to Have:**
- Badge showing "Admin" next to System Config link
- Tooltip explaining what System Config contains
- Keyboard shortcut (Ctrl+,) for power users

---

## 📊 PROGRESS TRACKING (UPDATED)

| UAT ID | Title | Priority | Status | Effort | Assignee |
|--------|-------|----------|--------|--------|----------|
| UAT-001 | Remove CQRS Banner | P1 | 📝 Logged | 15min | TBD |
| UAT-002 | Notification Position | P1 | 📝 Logged | 30min | TBD |
| UAT-003 | Manual Refresh | P2 | 📝 Logged | 3-4hrs | TBD |
| UAT-004 | Configurable Sync | P2 | 📝 Logged | 2hrs | TBD |
| UAT-005 | Granular RBAC | P0 | 📝 Logged | 4-6hrs | TBD |
| UAT-006 | Activity Sync Fix | P0 | 🔍 Investigated | 4-6hrs | TBD |
| UAT-007 | Target Assignment | P2 | 📝 Logged | 8-12hrs | TBD |
| UAT-008 | System Config Menu | P2 | 📝 Logged | 1hr | TBD |

**Total Estimated Effort:** ~24-32 hours (3-4 days)

---

## 🎯 ACCEPTANCE WORKFLOW

### For Each UAT Item:

**1. LOGGED (Current State)**
- Issue documented
- Requirements defined
- Acceptance criteria listed

**2. IN PROGRESS**
- Development started
- Regular updates in this tracker
- Blockers documented

**3. IN REVIEW**
- Code complete
- Self-testing done
- Ready for UAT

**4. UAT TESTING**
- User testing
- Feedback collected
- Issues logged

**5. RESOLVED**
- Accepted by stakeholders
- Deployed to production
- Documentation updated

---

## 📝 TECHNICAL CONSTRAINTS

### Must Follow for All UAT Items:

**1. Three-Zone Data Lake Pattern:**
```
Odoo API → Raw Zone → Canonical Zone → Serving Zone → UI
```
- ✅ All Odoo data must write to Raw Zone first
- ✅ Transformations happen in Canonical Zone
- ✅ UI reads from Serving Zone only
- ✅ Maintains audit trail and reproducibility

**2. CQRS Architecture:**
- ✅ Commands (writes) generate events
- ✅ Events update projections (materialized views)
- ✅ Queries read from projections (no complex joins)
- ✅ Event store maintains complete audit trail

**3. Role-Based Access Control:**
- ✅ All endpoints check permissions
- ✅ Data filtered by role before response
- ✅ No data leaks between roles
- ✅ Middleware enforces security

**4. Odoo as Single Source of Truth:**
- ✅ No manual data entry for core entities
- ✅ All accounts, opportunities, invoices from Odoo
- ✅ Manual activities logged locally but flagged as source='manual'
- ✅ Sync maintains data integrity

---

## 🔍 INVESTIGATION NOTES

### Activity Sync - Preliminary Findings

**Background Sync Logs (Last Run):**
```
2026-01-15 07:37:30 - INFO - Syncing activities...
2026-01-15 07:37:30 - INFO - Fetched 2 activities from Odoo
2026-01-15 07:37:30 - INFO - Activities: {'inserted': 0, 'updated': 2, 'soft_deleted': 0, 'errors': 0}
```

**Observation:**
- Connector IS fetching activities (2 activities)
- Sync IS working (0 errors)
- Data SHOULD be in data_lake_serving

**Hypothesis:**
- Activities ARE syncing
- Problem might be:
  1. Frontend not calling correct endpoint
  2. Activities filtered out by role/permissions
  3. UI not rendering activities
  4. Wrong entity_type in query

**Next Steps:**
- Check data_lake_serving for entity_type='activity'
- Verify frontend API call
- Check if activities linked to opportunities correctly

---

## 📚 RELATED DOCUMENTATION

**Architecture:**
- `/app/docs/DATA_ARCHITECTURE_ANALYSIS.md` - CQRS design
- `/app/docs/TECHNICAL_REFERENCE.md` - Database schema

**Implementation Guides:**
- `/app/docs/SECURADO_SALES_PROCESS_PLAN.md` - New features roadmap
- `/app/docs/CQRS_IMPLEMENTATION_ROADMAP.md` - CQRS development

**Testing:**
- `/app/test_result.md` - Test results (38/38 passed)

---

## ✅ READY FOR EXECUTION

**Status:** All UAT items logged and prioritized  
**Next Action:** Await approval to proceed with implementation  
**Recommended Order:** 
1. UAT-001, UAT-002 (Quick wins, 45 min total)
2. UAT-006 (P0 - Activity sync)
3. UAT-005 (P0 - RBAC)
4. UAT-004 (Configurable sync)
5. UAT-003 (Refresh buttons)
6. UAT-007 (Target assignment - complex feature)

**Question for Stakeholder:**
- Proceed with quick wins (UAT-001, UAT-002) first?
- Or prioritize P0 items (UAT-005, UAT-006)?
- Or implement in numerical order?

---

**Document Owner:** Development Team  
**Review Frequency:** Daily during UAT phase  
**Escalation:** Critical bugs to be flagged immediately
