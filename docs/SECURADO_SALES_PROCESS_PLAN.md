# 📋 Securado Sales Process - Implementation Plan
## Multi-Level Target Distribution & Dual KPI System

**Date:** 2025-01-15  
**Status:** PLANNING PHASE  
**Integration:** Odoo ERP Sync

---

## 🎯 BUSINESS REQUIREMENTS ANALYSIS

### Current System (What We Have)
✅ CQRS architecture with event sourcing  
✅ Manager hierarchy (working)  
✅ Odoo integration (syncing opportunities, invoices, activities)  
✅ Basic dashboard with metrics  
✅ Role-based access control  

### New Requirements (Securado Sales Process)

**1. Multi-Level Target Distribution:**
```
CEO/CFO
  ↓ Sets GP Targets
Product Directors (PD)
  ↓ Assigns Project Targets
Account Managers (AM)
  ↓ Executes & Tracks
```

**2. Dual KPI Tracking:**

**Presales KPIs (Activity-Based):**
- POC count
- Demo count
- Presentation count
- RFP Influence count
- Lead numbers

**Sales KPIs (Transaction-Based):**
- Revenue (from Odoo opportunities)
- PO Status (from Odoo)
- Invoiced Amount (from Odoo account.move)
- Collection Status (with due date flag)
- Collection within Due Date (special flag)

**3. Data Source:**
- ✅ Single Source of Truth: Odoo ERP
- ✅ No manual data entry
- ✅ Existing integrator service
- ✅ Field mapping logic

---

## 🏗️ PROPOSED ARCHITECTURE

### Enhanced Data Model

#### 1. **gp_targets** Collection (New)
```javascript
{
  id: \"uuid\",
  target_level: \"ceo_to_pd\" | \"pd_to_am\",
  
  // CEO → PD target
  set_by_user_id: \"ceo_uuid\",  // CEO/CFO
  assigned_to_user_id: \"pd_uuid\",  // Product Director
  
  product_line: \"MSSP\" | \"Network Security\" | \"GRC\" | \"App Security\",
  gp_target_amount: 500000,  // Gross Profit target
  period: \"Q1 2026\",
  period_start: Date,
  period_end: Date,
  
  status: \"active\" | \"completed\" | \"revised\",
  created_at: Date,
  updated_at: Date
}
```

#### 2. **am_project_targets** Collection (New)
```javascript
{
  id: \"uuid\",
  pd_user_id: \"pd_uuid\",  // Product Director who assigned
  am_user_id: \"am_uuid\",  // Account Manager
  
  // Link to Odoo account/opportunity
  account_odoo_id: 123,
  opportunity_odoo_id: 456,
  
  // Presales Activity Targets
  presales_targets: {
    poc_target: 2,
    demo_target: 3,
    presentation_target: 5,
    rfp_influence_target: 1,
    lead_target: 10
  },
  
  // Sales Number Targets
  sales_targets: {
    revenue_target: 100000,
    po_required: true,
    invoice_target: 100000
  },
  
  assigned_date: Date,
  target_completion_date: Date,
  status: \"assigned\" | \"in_progress\" | \"completed\"
}
```

#### 3. **presales_activities** Collection (New)
```javascript
{
  id: \"uuid\",
  am_project_target_id: \"uuid\",  // Links to project
  
  activity_type: \"POC\" | \"Demo\" | \"Presentation\" | \"RFP_Influence\" | \"Lead\",
  activity_date: Date,
  
  // Synced from Odoo or manual entry
  odoo_activity_id: 789,  // If from Odoo mail.activity
  description: \"POC for firewall solution\",
  status: \"completed\" | \"pending\",
  
  logged_by: \"am_uuid\",
  logged_at: Date,
  source: \"odoo\" | \"manual\"
}
```

#### 4. Enhanced **opportunity_view** (Extend CQRS)
```javascript
{
  // Existing CQRS fields...
  
  // Add KPI tracking fields
  kpi_tracking: {
    // Presales
    poc_completed: 2,
    demos_completed: 1,
    presentations_completed: 3,
    
    // Sales
    po_received: true,
    po_date: Date,
    po_amount: 100000,
    
    // Invoice tracking (from Odoo)
    invoice_generated: true,
    invoice_amount: 100000,
    invoice_date: Date,
    
    // Collection tracking
    amount_collected: 80000,
    collection_date: Date,
    collected_within_due_date: true,  // SPECIAL FLAG
    due_date: Date,
    days_overdue: 0
  }
}
```

---

## 📊 PROPOSED UI STRUCTURE

### For CEO/CFO

**Page: GP Target Management**
```
┌─────────────────────────────────────────────────┐
│ Set Gross Profit Targets                       │
├─────────────────────────────────────────────────┤
│ Product Line      PD Assigned    GP Target     │
│ MSSP              Krishna        $500,000      │
│ Network Security  Ravi           $400,000      │
│ GRC               Vinsha         $300,000      │
│                                                 │
│ [+ Add New Target]                             │
└─────────────────────────────────────────────────┘
```

### For Product Director

**Page: PD Dashboard**
```
┌─────────────────────────────────────────────────┐
│ My GP Target: $500,000 (MSSP)                   │
│ Current Achievement: $200,000 (40%)             │
├─────────────────────────────────────────────────┤
│ Account Managers:                               │
│                                                 │
│ Zakariya                                        │
│   Ministry of Information - $100,000            │
│   [Assign Presales Targets] [Assign Sales KPIs]│
│                                                 │
│ Active Projects: 5                             │
│ Qualified Pipeline: $350,000                    │
└─────────────────────────────────────────────────┘
```

**Modal: Assign Project Targets**
```
┌─────────────────────────────────────────────────┐
│ Assign Targets to: Zakariya                    │
│ Project: Ministry of Information ($100K)        │
├─────────────────────────────────────────────────┤
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

### For Account Manager

**Page: AM KPI Dashboard**
```
┌─────────────────────────────────────────────────┐
│ My Projects with Targets                        │
├─────────────────────────────────────────────────┤
│ Ministry of Information - $100,000              │
│                                                 │
│ Presales Progress:                              │
│   POC:          2/2 ✅  Demos:        1/3 🟡   │
│   Presentations: 3/5 🟡  RFP Influence: 0/1 🔴│
│   Leads:        8/10 🟡                        │
│                                                 │
│ Sales Progress:                                 │
│   Revenue:      $100,000 ✅                     │
│   PO:           Received ✅                      │
│   Invoice:      Generated $100,000 ✅          │
│   Collection:   $80,000 (Within Due Date ✅)    │
│                                                 │
│ Overall Score: 75/100 🟡                       │
└─────────────────────────────────────────────────┘
```

---

## 🔄 DATA SYNC STRATEGY

### From Odoo to SalesCommand

**Entities to Sync:**
1. **Opportunities** (`crm.lead`) → Pipeline tracking
2. **Invoices** (`account.move`) → Revenue & collection
3. **Activities** (`mail.activity`) → Presales actions
4. **Payment Terms** → Due date calculation
5. **Collection Status** → Payment tracking

### Mapping Logic

**Presales Activities:**
```python
# Map Odoo activity types to Presales KPIs
ACTIVITY_TYPE_MAPPING = {
    \"POC\": [\"poc\", \"proof of concept\", \"pilot\"],
    \"Demo\": [\"demo\", \"demonstration\", \"product demo\"],
    \"Presentation\": [\"presentation\", \"pitch\"],
    \"RFP_Influence\": [\"rfp\", \"tender\", \"proposal\"],
    \"Lead\": [\"lead\", \"qualification\", \"discovery\"]
}

# When syncing mail.activity:
for activity in odoo_activities:
    activity_summary = activity.get('summary', '').lower()
    
    # Match to presales type
    for kpi_type, keywords in ACTIVITY_TYPE_MAPPING.items():
        if any(kw in activity_summary for kw in keywords):
            # Log as presales activity
            await log_presales_activity(
                opportunity_id=activity.res_id,
                type=kpi_type,
                completed=activity.state == 'done'
            )
```

**Collection Within Due Date:**
```python
# For each invoice from Odoo:
invoice = odoo_invoice  # account.move

payment_state = invoice.get('payment_state')  # 'paid', 'partial', 'not_paid'
invoice_date_due = invoice.get('invoice_date_due')
payment_date = invoice.get('payment_date')  # When it was paid

if payment_state == 'paid' and payment_date and invoice_date_due:
    # Calculate if paid within due date
    collected_within_due = payment_date <= invoice_date_due
    days_difference = (payment_date - invoice_date_due).days
    
    # Store in opportunity KPI tracking
    kpi_flags = {
        \"collected_within_due_date\": collected_within_due,
        \"collection_efficiency\": \"on_time\" if collected_within_due else \"overdue\",
        \"days_overdue\": max(0, days_difference)
    }
```

---

## 🛠️ IMPLEMENTATION PHASES

### Phase 1: Target Management (Week 1)

**Backend:**
1. Create `gp_targets` and `am_project_targets` collections
2. API endpoints:
   - `POST /api/targets/gp` - CEO sets GP target for PD
   - `GET /api/targets/gp/my-targets` - PD sees their targets
   - `POST /api/targets/projects/assign` - PD assigns to AM
   - `GET /api/targets/projects/my-projects` - AM sees assignments

**Frontend:**
3. CEO Target Setting page
4. PD Dashboard with target assignment
5. AM Project view with targets

**Testing:**
- CEO assigns $500K to Krishna (PD)
- Krishna assigns project targets to Zakariya (AM)
- Zakariya sees targets on dashboard

### Phase 2: Presales KPI Tracking (Week 2)

**Backend:**
1. Create `presales_activities` collection
2. Odoo activity sync enhancement:
   - Map mail.activity to presales types
   - Extract POC, Demo, Presentation from summaries
3. KPI calculation engine:
   - Aggregate activities per project
   - Compare vs targets
   - Calculate completion %

**Frontend:**
4. Presales KPI cards for AM
5. Activity logging interface (if Odoo doesn't have it)
6. PD view of team presales performance

**Testing:**
- Log 2 POCs for Ministry project
- Verify shows as 2/2 complete
- Check PD dashboard shows team rollup

### Phase 3: Sales KPI Tracking (Week 3)

**Backend:**
1. Enhance invoice sync from Odoo:
   - Capture payment_state
   - Calculate collection efficiency
   - Flag on-time vs overdue
2. Link invoices to opportunities
3. KPI aggregation:
   - PO status from opportunity
   - Invoice amount from account.move
   - Collection tracking

**Frontend:**
4. Sales KPI cards for AM
5. Collection dashboard
6. Due date indicators

**Testing:**
- Sync invoice with payment
- Check collection within due date flag
- Verify KPI score calculation

### Phase 4: PD Review & Assignment Workflow (Week 4)

**Backend:**
1. Project assignment API
2. Target revision API
3. Bulk assignment support

**Frontend:**
4. PD account review interface
5. Drag-and-drop target assignment
6. Target revision workflow

---

## 📐 TECHNICAL DESIGN

### Database Schema Extensions

**New Collections:**
```javascript
// 1. gp_targets
createIndex({ \"assigned_to_user_id\": 1, \"period_start\": 1 })

// 2. am_project_targets
createIndex({ \"am_user_id\": 1, \"status\": 1 })
createIndex({ \"pd_user_id\": 1 })
createIndex({ \"opportunity_odoo_id\": 1 })

// 3. presales_activities
createIndex({ \"am_project_target_id\": 1, \"activity_type\": 1 })
createIndex({ \"activity_date\": 1 })
```

**Modified Collections:**
- opportunity_view: Add kpi_tracking nested object
- dashboard_metrics: Add presales_kpi and sales_kpi sections

### API Endpoints Design

**CEO Endpoints:**
```
POST   /api/targets/gp/set             # Set GP target for PD
GET    /api/targets/gp/overview        # All GP targets overview
PUT    /api/targets/gp/{id}            # Revise target
DELETE /api/targets/gp/{id}            # Remove target
```

**PD Endpoints:**
```
GET    /api/targets/pd/my-target       # My GP target from CEO
GET    /api/targets/pd/accounts        # Odoo accounts for assignment
POST   /api/targets/pd/assign-project  # Assign targets to AM
GET    /api/targets/pd/team-dashboard  # Team KPI overview
```

**AM Endpoints:**
```
GET    /api/targets/am/my-projects     # My assigned projects
GET    /api/targets/am/kpi-dashboard   # My KPI progress
POST   /api/activities/presales/log    # Log presales activity
GET    /api/activities/presales        # Get my activities
```

**Admin Endpoints:**
```
GET    /api/admin/kpi/health           # KPI system health
GET    /api/admin/kpi/audit-trail      # All target assignments
```

---

## 🔄 ODOO INTEGRATION ENHANCEMENTS

### Additional Fields to Sync

**From `crm.lead` (Opportunities):**
```python
# Current fields + New:
fields = [
    # ... existing fields
    'planned_revenue',     # For revenue target tracking
    'date_closed',         # Actual close date
    'stage_id',           # Track sales stage
    'activities_count',   # Activity count from Odoo
    'next_activity_id',   # Next planned activity
]
```

**From `account.move` (Invoices) - ENHANCED:**
```python
fields = [
    # ... existing fields
    'payment_state',      # 'paid', 'partial', 'not_paid'
    'invoice_date_due',   # Due date for collection tracking
    'invoice_payment_term_id',  # Payment terms
    'amount_residual',    # Remaining amount
    'payment_id',         # Payment record
    'invoice_date',       # Invoice generation date
    
    # NEW: Calculate collection efficiency
    'payment_date': payment_id.date if payment_id else None,
]
```

**From `mail.activity` - ENHANCED:**
```python
# Extract presales activities
fields = [
    'activity_type_id',   # Type of activity
    'summary',            # Keywords for KPI mapping
    'res_model',          # Should be 'crm.lead'
    'res_id',             # Opportunity ID
    'date_deadline',      # When it's due
    'state',              # 'done', 'today', 'planned', 'overdue'
    'user_id',            # AM who did it
]
```

### Collection Tracking Logic

```python
async def calculate_collection_efficiency(invoice_data):
    \"\"\"
    Calculate if payment was received within due date.
    This is a KEY metric for Securado.
    \"\"\"
    payment_state = invoice_data.get('payment_state')
    invoice_due_date = invoice_data.get('invoice_date_due')
    payment_date = invoice_data.get('payment_date')
    
    if payment_state != 'paid' or not invoice_due_date:
        return {
            \"collected\": False,
            \"within_due_date\": None,
            \"days_overdue\": None
        }
    
    # Parse dates
    due = parse_date(invoice_due_date)
    paid = parse_date(payment_date) if payment_date else datetime.now()
    
    # Calculate difference
    days_diff = (paid - due).days
    within_due = days_diff <= 0  # Paid on or before due date
    
    return {
        \"collected\": True,
        \"within_due_date\": within_due,
        \"days_overdue\": max(0, days_diff),
        \"collection_efficiency\": \"excellent\" if within_due else \"delayed\"
    }
```

---

## 📋 IMPLEMENTATION ROADMAP

### Week 1: Foundation (Database & APIs)

**Day 1-2: Target Management Backend**
- [ ] Create collections (gp_targets, am_project_targets)
- [ ] CEO API: Set GP targets
- [ ] PD API: Get targets & assign projects
- [ ] AM API: View assigned projects

**Day 3-4: Target Management Frontend**
- [ ] CEO page: GP Target Setting
- [ ] PD page: Project Assignment
- [ ] AM page: My Projects view

**Day 5: Testing & Integration**
- [ ] Test full flow: CEO → PD → AM
- [ ] Verify target cascade
- [ ] Document API usage

### Week 2: Presales KPI System

**Day 1-2: Activity Tracking Backend**
- [ ] Create presales_activities collection
- [ ] Enhance Odoo mail.activity sync
- [ ] Activity type mapping logic
- [ ] KPI aggregation engine

**Day 3-4: Presales Frontend**
- [ ] Activity logging UI for AM
- [ ] Presales KPI cards
- [ ] PD team presales dashboard

**Day 5: Testing**
- [ ] Log activities manually
- [ ] Verify sync from Odoo
- [ ] Test KPI calculations

### Week 3: Sales KPI System

**Day 1-2: Invoice & Collection Backend**
- [ ] Enhance invoice sync
- [ ] Collection efficiency calculation
- [ ] Link invoices to opportunities
- [ ] Sales KPI aggregation

**Day 3-4: Sales KPI Frontend**
- [ ] Sales KPI cards
- [ ] Collection tracking dashboard
- [ ] Due date indicators

**Day 5: Testing**
- [ ] Test collection flag logic
- [ ] Verify invoice linkage
- [ ] End-to-end KPI flow

### Week 4: PD Workflow & Polish

**Day 1-2: PD Tools**
- [ ] Account review interface
- [ ] Bulk assignment
- [ ] Target revision

**Day 3-4: Reporting**
- [ ] CEO rollup dashboard
- [ ] PD performance reports
- [ ] AM scorecard

**Day 5: UAT & Documentation**
- [ ] User acceptance testing
- [ ] Training documentation
- [ ] Deployment

---

## 🎯 SUCCESS CRITERIA

### Functional Requirements

**CEO Can:**
- ✅ Set GP targets per PD per product line
- ✅ View company-wide achievement
- ✅ Revise targets mid-period

**PD Can:**
- ✅ See their GP target
- ✅ Review all AM accounts (from Odoo)
- ✅ Assign project-specific targets
- ✅ Track team presales & sales KPIs
- ✅ View qualified pipeline

**AM Can:**
- ✅ See all assigned projects
- ✅ View presales targets (POC, Demo, etc.)
- ✅ View sales targets (Revenue, Invoice, Collection)
- ✅ Log presales activities
- ✅ See KPI achievement %
- ✅ View collection efficiency

### Technical Requirements

- ✅ All data from Odoo (no manual entry)
- ✅ Real-time sync (event-driven)
- ✅ Collection within due date flag working
- ✅ Activity type auto-detection from Odoo
- ✅ Performance <500ms per dashboard

---

## 💡 DESIGN DECISIONS

### 1. Use Existing CQRS Architecture

**Benefits:**
- Leverage event sourcing for audit trail
- Pre-computed KPI aggregations in materialized views
- Fast dashboard performance
- Clear separation of concerns

**Implementation:**
- Add new events: GPTargetSet, ProjectTargetAssigned, PresalesActivityLogged
- Create new projections: kpi_dashboard_projection
- Extend opportunity_projection with KPI fields

### 2. Presales Activity Source

**Option A: Odoo-Only (Recommended)**
- Use mail.activity from Odoo
- Map by keywords in summary
- Pros: Single source of truth, no dual entry
- Cons: Requires keyword discipline

**Option B: Hybrid**
- Primary: Odoo activities
- Fallback: Manual logging in app
- Pros: Flexibility
- Cons: Data fragmentation

**Recommendation:** Start with Option A, add manual logging in Phase 2 if needed

### 3. Collection Tracking

**Source:** Odoo `account.move.payment_id`
- payment_state: 'paid' confirms collection
- invoice_date_due: Due date
- payment_date: Actual payment date

**Flag Logic:**
```python
collected_within_due = (payment_date <= invoice_date_due) if both_exist else None
```

---

## 📊 KPI CALCULATION FORMULAS

### Presales KPI Score
```python
presales_score = (
    (poc_completed / poc_target * 20) +
    (demos_completed / demo_target * 20) +
    (presentations_completed / presentation_target * 20) +
    (rfp_influence / rfp_target * 20) +
    (leads_generated / lead_target * 20)
) # Out of 100
```

### Sales KPI Score
```python
sales_score = (
    (revenue_achieved / revenue_target * 30) +
    (po_received ? 20 : 0) +
    (invoice_generated ? 20 : 0) +
    (amount_collected / invoice_target * 20) +
    (collected_within_due_date ? 10 : 0)
) # Out of 100
```

### Overall Project Score
```python
overall_score = (presales_score * 0.4) + (sales_score * 0.6)
# Presales = 40%, Sales = 60% weighting
```

---

## 🚀 NEXT STEPS

### Immediate Actions Required:

**1. Stakeholder Alignment (You)**
- [ ] Review this plan
- [ ] Confirm target structure matches Securado process
- [ ] Approve KPI weightings (40/60 split)
- [ ] Provide sample Odoo activity keywords

**2. Odoo Access Review**
- [ ] Verify we can access payment_date from account.move
- [ ] Confirm mail.activity has sufficient data
- [ ] Test invoice payment_state field

**3. Development Priority**
- Start with Phase 1 (Target Management)?
- Or build Presales tracking first?
- Your preference?

---

## 📄 DOCUMENTATION TO CREATE

Once approved, I'll create:
1. **Target Management User Guide** (CEO/PD/AM)
2. **KPI Calculation Reference** (formulas & logic)
3. **Odoo Field Mapping Document** (what syncs where)
4. **API Documentation** (all new endpoints)
5. **Database Schema** (ERD diagrams)

---

## 💬 QUESTIONS FOR YOU

Before implementation:

1. **Target Periods:** Quarterly? Annually? Monthly?
2. **Presales Activity Keywords:** What terms do your team use in Odoo activity summaries?
3. **Collection Priority:** Is \"within due date\" the most critical metric?
4. **PD Assignment:** Can PD assign same opportunity to multiple AMs? Or 1:1?
5. **Mid-Period Changes:** Can targets be revised? What happens to progress?
6. **Reporting Schedule:** Weekly? Monthly? Real-time?

---

**Should I proceed with Phase 1 (Target Management) implementation?**
