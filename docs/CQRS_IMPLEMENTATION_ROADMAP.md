# 🚀 CQRS Implementation Roadmap
## Step-by-Step Execution Plan

**Architecture:** CQRS + Event Sourcing + Materialized Views
**Timeline:** 3 Days (24 hours)
**Status:** IN PROGRESS
**Started:** 2025-01-15

---

## 📅 DETAILED IMPLEMENTATION SCHEDULE

### DAY 1: Event Store & Core Infrastructure (8 hours)

#### ✅ COMPLETED STEPS
- [x] Architecture research & design
- [x] Documentation created
- [ ] Event store implementation

#### 🔨 Step 1.1: Event Store Core (1 hour)
**Status:** PENDING
**Files to Create:**
- `/app/backend/event_store/__init__.py`
- `/app/backend/event_store/store.py`
- `/app/backend/event_store/models.py`

**Implementation:**
```python
# Event model with versioning
# EventStore class with append/query
# Optimistic locking support
```

**Testing:**
- Create event
- Append to store
- Query by aggregate_id
- Verify immutability

**Success Criteria:**
- Can store events
- Can retrieve by aggregate
- Events are immutable
- Version tracking works

---

#### 🔨 Step 1.2: Event Bus (1 hour)
**Status:** PENDING
**Files to Create:**
- `/app/backend/event_store/publisher.py`
- `/app/backend/event_store/subscriber.py`

**Implementation:**
```python
# EventBus with subscribe/publish
# Async handler support
# Error handling & retries
```

**Testing:**
- Subscribe handler to event
- Publish event
- Verify handler called
- Test parallel execution

**Success Criteria:**
- Multiple subscribers work
- Async execution
- Error isolation

---

#### 🔨 Step 1.3: Base Projection Framework (1.5 hours)
**Status:** PENDING
**Files to Create:**
- `/app/backend/projections/__init__.py`
- `/app/backend/projections/base.py`

**Implementation:**
```python
# BaseProjection abstract class
# Event handler registration
# Rebuild from events support
# Mark event as processed
```

**Testing:**
- Create test projection
- Subscribe to event
- Process event
- Rebuild from history

**Success Criteria:**
- Can subscribe to events
- Can rebuild from scratch
- Tracks processed events

---

#### 🔨 Step 1.4: User Profile Projection (2 hours)
**Status:** PENDING
**Files to Create:**
- `/app/backend/projections/user_profile_projection.py`

**New Collection Created:** `user_profiles`

**Implementation:**
```python
# Handle OdooUserSynced event
# Build denormalized user with:
#   - All Odoo fields
#   - Pre-computed hierarchy (manager + subordinates)
#   - Team information
# Upsert to user_profiles collection
```

**Testing:**
- Sync Odoo users
- Generate OdooUserSynced events
- Verify user_profiles populated
- Check hierarchy computed correctly

**Success Criteria:**
- Vinsha's subordinates array contains Zakariya
- All Odoo IDs present (user_id, employee_id, manager_id)
- No duplicates

---

#### 🔨 Step 1.5: Database Migrations (1.5 hours)
**Status:** PENDING
**Files to Create:**
- `/app/backend/migrations/001_create_event_store.py`
- `/app/backend/migrations/002_create_projections.py`

**Implementation:**
```python
# Create indexes for events collection
# Create TTL indexes for cache collections
# Create unique constraints
# Create initial collections
```

**Testing:**
- Run migrations
- Verify indexes created
- Test unique constraints

**Success Criteria:**
- All collections exist
- Indexes optimal
- Constraints enforced

---

#### 🔨 Step 1.6: Day 1 Integration Testing (1 hour)
**Status:** PENDING

**Tests:**
- Create user event → Check user_profiles updated
- Update user event → Check version incremented
- Test hierarchy computation
- Verify no data loss

**Success Criteria:**
- All projections working
- Events flowing correctly
- No errors in logs

---

### DAY 2: Opportunity Projections & Sync (8 hours)

#### 🔨 Step 2.1: Opportunity Projection (2 hours)
**Status:** PENDING
**Files to Create:**
- `/app/backend/projections/opportunity_projection.py`

**New Collection:** `opportunity_view`

**Implementation:**
```python
# Handle OdooOpportunitySynced event
# Denormalize:
#   - Salesperson info (from user_profiles)
#   - Account info (from accounts)
#   - Pre-compute visible_to_user_ids
# Include manager in visibility
```

**Testing:**
- Sync opportunities
- Verify salesperson lookup works
- Check visible_to_user_ids includes manager
- Test with Vinsha/Zakariya data

**Success Criteria:**
- Opportunities have salesperson denormalized
- visible_to_user_ids = [owner_id, manager_id, admin_ids]
- No orphaned opportunities

---

#### 🔨 Step 2.2: Access Matrix Projection (1.5 hours)
**Status:** PENDING
**Files to Create:**
- `/app/backend/projections/access_matrix_projection.py`

**New Collection:** `user_access_matrix`

**Implementation:**
```python
# Pre-compute what each user can see
# accessible_opportunities: [list of IDs]
# accessible_accounts: [list of IDs]
# Cache with TTL (5 min)
```

**Testing:**
- Build matrix for Vinsha
- Verify includes her opps + Zakariya's opps
- Build for Zakariya
- Verify only his opps

**Success Criteria:**
- Vinsha's accessible_opportunities = [her 2 + Zak's 2]
- Zakariya's accessible_opportunities = [his 2 only]
- TTL auto-refresh works

---

#### 🔨 Step 2.3: Dashboard Metrics Projection (1.5 hours)
**Status:** PENDING
**Files to Create:**
- `/app/backend/projections/dashboard_metrics_projection.py`

**New Collection:** `dashboard_metrics`

**Implementation:**
```python
# Pre-compute KPIs per user:
#   - pipeline_value
#   - won_revenue
#   - active_opportunities
#   - by_stage breakdown
# TTL cache (5 min)
```

**Success Criteria:**
- Metrics computed correctly
- Includes team metrics for managers
- Auto-refresh on TTL expiry

---

#### 🔨 Step 2.4: Sync Command Handler (2 hours)
**Status:** PENDING
**Files to Create:**
- `/app/backend/domain/commands/sync_odoo.py`
- `/app/backend/domain/handlers/sync_handler.py`

**Implementation:**
```python
# Replace background_sync.py
# Fetch from Odoo
# Store in odoo_raw_data
# Compare with previous (detect changes)
# Generate events (Created/Updated/Deleted)
# Publish to event bus
```

**Testing:**
- Trigger sync
- Verify events generated
- Check projections updated
- Validate data in views

**Success Criteria:**
- Sync generates correct events
- All projections update
- No data loss

---

#### 🔨 Step 2.5: Day 2 Integration Testing (1 hour)
**Status:** PENDING

**Tests:**
- Full sync flow
- Event → Projection → View
- Manager visibility
- Access control

---

### DAY 3: API, Migration & Deployment (8 hours)

#### 🔨 Step 3.1: New Query APIs (2 hours)
**Status:** PENDING
**Files to Create:**
- `/app/backend/api/queries/dashboard_api.py`
- `/app/backend/api/queries/opportunity_api.py`
- `/app/backend/api/queries/user_api.py`

**Endpoints:**
```
GET /api/v2/dashboard          # Read from dashboard_metrics
GET /api/v2/opportunities      # Read from opportunity_view
GET /api/v2/users/profile      # Read from user_profiles
GET /api/v2/users/hierarchy    # Read from user_profiles.hierarchy
```

**Testing:**
- Test as Vinsha → See 4 opportunities
- Test as Zakariya → See 2 opportunities
- Test metrics accuracy

**Success Criteria:**
- APIs return in <200ms
- Data accurate
- Access control works

---

#### 🔨 Step 3.2: Data Migration Script (2 hours)
**Status:** PENDING
**Files to Create:**
- `/app/backend/scripts/migrate_to_cqrs.py`

**Implementation:**
```python
# 1. Copy data_lake_serving → odoo_raw_data
# 2. Copy users → events (synthetic OdooUserSynced)
# 3. Run all projections
# 4. Validate counts match
# 5. Create backup of old collections
```

**Testing:**
- Dry run on test DB
- Validate data integrity
- Compare old vs new

**Success Criteria:**
- All data migrated
- Counts match (23 opps, 7 users, etc.)
- Relationships preserved

---

#### 🔨 Step 3.3: Frontend Updates (2 hours)
**Status:** PENDING
**Files to Modify:**
- `/app/frontend/src/services/api.js`
- `/app/frontend/src/pages/Dashboard.js`
- `/app/frontend/src/pages/Opportunities.js`

**Changes:**
```javascript
// Update API endpoints
const dashboardAPI = {
  get: () => apiClient.get('/v2/dashboard'),  // New endpoint
  // ...
}

// Response structure changed (denormalized)
opportunities.map(opp => ({
  name: opp.name,
  salesperson: opp.salesperson.name,  // Already joined!
  manager: opp.salesperson.manager.name,  // Manager included!
}))
```

**Testing:**
- Login as Vinsha
- View dashboard
- Verify sees 4 opportunities
- Check UI renders correctly

**Success Criteria:**
- Dashboard loads fast
- Shows correct data
- Manager hierarchy visible

---

#### 🔨 Step 3.4: End-to-End Testing (1.5 hours)
**Status:** PENDING

**Test Matrix:**
| User | Expected Opps | Access Check | UI Check |
|------|---------------|--------------|----------|
| Vinsha | 4 (own + Zak's) | ✅ | ✅ |
| Zakariya | 2 (own only) | ✅ | ✅ |
| Superadmin | 23 (all) | ✅ | ✅ |

**Performance Tests:**
- Dashboard load time < 300ms
- Opportunity list < 200ms
- 1000 opportunities load test

**Success Criteria:**
- All users see correct data
- Performance targets met
- No errors in logs

---

#### 🔨 Step 3.5: Documentation & Handoff (30 min)
**Status:** PENDING

**Documents to Create/Update:**
- API documentation (new endpoints)
- Architecture diagrams
- Deployment guide
- Troubleshooting guide

---

## 📊 PROGRESS TRACKING

### Overall Progress: 5% (Planning Complete)

| Day | Phase | Progress | Status |
|-----|-------|----------|--------|
| Day 1 | Event Store & Infrastructure | 0/6 steps | PENDING |
| Day 2 | Projections & Sync | 0/5 steps | PENDING |
| Day 3 | APIs & Migration | 0/5 steps | PENDING |

### Completed Steps: 0/16
### Current Step: 1.1 - Event Store Core
### Blocked: No
### ETA to Completion: 24 hours

---

## 🎯 MILESTONES

- [ ] **Milestone 1:** Event store working (End of Day 1)
- [ ] **Milestone 2:** All projections building (End of Day 2)
- [ ] **Milestone 3:** Migration complete (Day 3 midpoint)
- [ ] **Milestone 4:** Production ready (End of Day 3)

---

## 🧪 TESTING CHECKPOINTS

### After Day 1:
- [ ] Event store persistence
- [ ] Event bus pub/sub
- [ ] User profile projection
- [ ] Hierarchy computation

### After Day 2:
- [ ] Opportunity denormalization
- [ ] Access matrix computation
- [ ] Dashboard metrics
- [ ] Full sync flow

### After Day 3:
- [ ] API endpoints functional
- [ ] Frontend integrated
- [ ] Performance benchmarks
- [ ] User acceptance testing

---

## 📝 CHANGE LOG

| Timestamp | Step | Status | Notes |
|-----------|------|--------|-------|
| 2025-01-15 10:00 | Planning | Complete | CQRS design approved |
| 2025-01-15 10:30 | Step 1.1 | Starting | Event store implementation |

---

**Next Step:** Implement Event Store Core (Step 1.1)
