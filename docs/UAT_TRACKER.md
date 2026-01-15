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
