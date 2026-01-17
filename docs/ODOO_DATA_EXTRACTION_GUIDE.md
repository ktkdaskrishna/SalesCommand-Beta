# 🔄 Odoo Data Extraction & Serving Architecture

**Complete Guide for Future Developers**  
**Date:** January 17, 2026  
**Version:** 2.0

---

## 📊 OVERVIEW - THE COMPLETE DATA JOURNEY

```
┌─────────────────────────────────────────────────────────────────┐
│                    STEP 1: ODOO ERP (Source)                     │
│  External system with business data                              │
│  Models: crm.lead, res.partner, mail.activity, account.move     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ OdooConnector.fetch_*()
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│              STEP 2: RAW DATA STORAGE (data_lake_serving)        │
│  MongoDB collection with raw Odoo records                        │
│  Structure: {entity_type, serving_id, data, is_active}          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ UniversalFieldMapper.map_*()
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│              STEP 3: CANONICAL FORMAT (API Layer)                │
│  Normalized, version-agnostic data structure                     │
│  Clean IDs, proper field types, relationships extracted         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ API Endpoints (/opportunities, /activities)
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│              STEP 4: FRONTEND DISPLAY                            │
│  React components render business data                           │
│  Opportunity cards, Activity timelines, Account views           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔌 STEP 1: ODOO EXTRACTION

### Connector Layer

**File:** `backend/integrations/odoo/connector.py`

**Purpose:** Fetch raw data from Odoo ERP via XML-RPC

### Example: Fetching Opportunities (crm.lead)

```python
class OdooConnector:
    async def fetch_opportunities(self) -> List[Dict[str, Any]]:
        """
        Fetch opportunities from Odoo crm.lead model
        
        Returns RAW Odoo data - no transformation at this layer
        """
        # Fields to fetch from Odoo
        fields = [
            'id', 'name', 'partner_id', 'user_id', 'team_id',
            'stage_id', 'expected_revenue', 'probability',
            'date_deadline', 'create_date', 'description',
            'product_ids', 'tag_ids'
        ]
        
        # Search all active opportunities
        domain = [('active', '=', True)]
        
        # Execute Odoo search_read
        records = await self.models.execute_kw(
            'crm.lead',
            'search_read',
            [domain],
            {'fields': fields, 'limit': 10000}
        )
        
        return records  # Returns RAW Odoo format
```

**What Odoo Returns (Example):**
```python
{
    'id': 9,
    'name': "SUPREME JUDICIARY COUNCIL's opportunity",
    'partner_id': [22, "MINISTRY OF INFORMATION, Zack"],  # ← Array format
    'user_id': [7, "Zakariya Al Baloushi"],              # ← Array format
    'team_id': False,                                     # ← False for empty
    'stage_id': [3, "Qualified"],
    'expected_revenue': 100000.0,
    'probability': 0.0,
    'date_deadline': '2026-02-15',
    'create_date': '2026-01-10 10:30:00',
    'description': False,                                 # ← False for empty
    'product_ids': [5, 12],                              # ← Array of IDs
    'tag_ids': []
}
```

### Example: Fetching Activities (mail.activity)

```python
async def fetch_activities(self) -> List[Dict[str, Any]]:
    """
    Fetch activities from Odoo mail.activity model
    
    CRITICAL: Activities are tasks/to-dos linked to opportunities, accounts, etc.
    NOT system audit logs!
    """
    fields = [
        'id', 'summary', 'note', 'activity_type_id', 'state',
        'date_deadline', 'user_id', 'res_model', 'res_id',
        'create_date'
    ]
    
    domain = [
        ('res_model', 'in', ['crm.lead', 'res.partner']),  # Only CRM activities
        ('active', '=', True)
    ]
    
    records = await self.models.execute_kw(
        'mail.activity',
        'search_read',
        [domain],
        {'fields': fields, 'limit': 10000}
    )
    
    return records
```

**What Odoo Returns (Example):**
```python
{
    'id': 15,
    'summary': 'Follow up call',
    'note': 'Discuss pricing and timeline',
    'activity_type_id': [1, "Call"],
    'state': 'planned',              # planned, done, overdue, cancel
    'date_deadline': '2026-01-20',
    'user_id': [7, "Zakariya"],      # Assigned to
    'res_model': 'crm.lead',         # ← Links to opportunity!
    'res_id': 9,                     # ← Opportunity ID
    'create_date': '2026-01-15 14:20:00'
}
```

**Key Fields for Activity-Opportunity Linking:**
- `res_model`: Which Odoo model (crm.lead = opportunity, res.partner = account)
- `res_id`: The ID of that record (e.g., opportunity ID 9)

---

## 💾 STEP 2: RAW DATA STORAGE

### Data Lake Serving Collection

**MongoDB Collection:** `data_lake_serving`

**Structure:**
```javascript
{
    "_id": ObjectId("..."),
    "entity_type": "activity",           // Entity classification
    "serving_id": "odoo_activity_15",    // Unique identifier
    "source": "odoo",                    // Data source
    "is_active": true,                   // Soft-delete flag
    "last_aggregated": "2026-01-17T...", // Last sync timestamp
    "data": {                            // ← RAW Odoo record (unchanged)
        "id": 15,
        "summary": "Follow up call",
        "res_model": "crm.lead",
        "res_id": 9,
        ...
    }
}
```

### Sync Process

**File:** `backend/services/odoo/sync_pipeline.py`

```python
async def sync_data_lake(self, user_id: str):
    """Sync all Odoo data to data_lake_serving"""
    
    connector = await self._create_connector()
    
    # 1. Fetch opportunities from Odoo
    opportunities = await connector.fetch_opportunities()
    
    for opp in opportunities:
        # Store RAW Odoo data (no transformation)
        serving_doc = {
            "entity_type": "opportunity",
            "serving_id": f"odoo_opportunity_{opp.get('id')}",
            "source": "odoo",
            "last_aggregated": datetime.now(timezone.utc).isoformat(),
            "is_active": True,
            "data": opp  # ← Complete RAW Odoo record
        }
        
        await self.db.data_lake_serving.update_one(
            {"serving_id": serving_doc["serving_id"]},
            {"$set": serving_doc},
            upsert=True
        )
    
    # 2. Fetch activities from Odoo
    activities = await connector.fetch_activities()
    
    for activity in activities:
        # Store RAW activity data
        serving_doc = {
            "entity_type": "activity",
            "serving_id": f"odoo_activity_{activity.get('id')}",
            "source": "odoo",
            "last_aggregated": datetime.now(timezone.utc).isoformat(),
            "is_active": True,
            "data": activity  # ← Complete RAW activity record
        }
        
        await self.db.data_lake_serving.update_one(
            {"serving_id": serving_doc["serving_id"]},
            {"$set": serving_doc},
            upsert=True
        )
    
    # 3. Soft-delete records not in current sync
    activity_ids = [a.get('id') for a in activities]
    await self.db.data_lake_serving.update_many(
        {
            "entity_type": "activity",
            "source": "odoo",
            "is_active": True,
            "data.id": {"$nin": activity_ids}
        },
        {
            "$set": {
                "is_active": False,
                "deleted_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
```

---

## 🎨 STEP 3: FIELD NORMALIZATION

### Universal Field Mapper

**File:** `backend/services/field_mapper.py`

**Purpose:** Transform RAW Odoo data → Clean canonical format

### Handling Odoo Many2One Fields

**The Challenge:**
```python
# Odoo v19: Array format
partner_id: [22, "MINISTRY OF INFORMATION, Zack"]

# Odoo v16: Just ID
partner_id: 22

# Custom Odoo: Object format
partner_id: {"id": 22, "name": "MINISTRY OF INFORMATION"}
```

**The Solution:**
```python
class UniversalFieldMapper:
    def extract_many2one_id(self, field_value):
        """Extract ID from any Odoo format"""
        if isinstance(field_value, (list, tuple)) and len(field_value) >= 1:
            return field_value[0]  # Array: [22, "Name"] → 22
        elif isinstance(field_value, dict):
            return field_value.get("id")  # Object: {"id": 22} → 22
        elif isinstance(field_value, (int, str)):
            return field_value  # Direct: 22 → 22
        return None  # False, None → None
    
    def extract_many2one_name(self, field_value):
        """Extract name from any Odoo format"""
        if isinstance(field_value, (list, tuple)) and len(field_value) >= 2:
            return str(field_value[1])  # [22, "Name"] → "Name"
        elif isinstance(field_value, dict):
            return str(field_value.get("name") or "")
        return ""
```

### Opportunity Mapping

```python
def map_opportunity(self, odoo_record: Dict) -> Dict:
    """Transform RAW Odoo opportunity → Canonical format"""
    
    # Extract account (partner_id)
    account = self.extract_many2one(odoo_record.get("partner_id"))
    
    # Extract owner (user_id)
    owner = self.extract_many2one(odoo_record.get("user_id"))
    
    # Extract stage
    stage = self.extract_many2one(odoo_record.get("stage_id"))
    
    # Extract team
    team = self.extract_many2one(odoo_record.get("team_id"))
    
    return {
        # Identifiers
        "id": odoo_record.get("id"),
        "odoo_id": odoo_record.get("id"),
        "name": self.clean_odoo_value(odoo_record.get("name"), "Untitled"),
        
        # Account (Cleaned)
        "account_id": account["id"],           # Clean int: 22
        "account_name": account["name"],        # Clean string: "MINISTRY..."
        "account_linked": account["id"] is not None,  # Boolean flag
        
        # Owner/Salesperson (Cleaned)
        "owner_id": owner["id"],               # Clean int: 7
        "owner_name": owner["name"] or "Unassigned",  # Clean string
        "owner_assigned": owner["id"] is not None,
        
        # Stage
        "stage_id": stage["id"],
        "stage_name": stage["name"] or "New",
        
        # Team
        "team_id": team["id"],
        "team_name": team["name"],
        
        # Financial
        "value": float(odoo_record.get("expected_revenue", 0) or 0),
        "probability": float(odoo_record.get("probability", 0) or 0),
        
        # Dates
        "close_date": odoo_record.get("date_deadline"),
        "created_date": odoo_record.get("create_date"),
        
        # Other
        "description": self.clean_odoo_value(odoo_record.get("description")),
        "product_lines": self.extract_many2many(odoo_record.get("product_ids")),
        
        # Metadata
        "source": "odoo"
    }
```

---

## 🎯 ACTIVITY MAPPING LOGIC (CRITICAL)

### What Are Activities?

**Activities in Odoo** (`mail.activity` model):
- **NOT system audit logs**
- Business tasks/to-dos linked to CRM records
- Examples: "Follow-up call", "Send proposal", "Schedule demo"
- Linked to opportunities, accounts, or other records
- Have assignees, due dates, and status

### How Activities Link to Opportunities

**The Link:**
```python
# Odoo activity record
{
    'id': 15,
    'summary': 'Follow up call',
    'res_model': 'crm.lead',    # ← Links to opportunity model
    'res_id': 9,                 # ← Links to opportunity ID 9
    'user_id': [7, "Zakariya"],  # ← Assigned to
    'state': 'planned'
}

# This activity belongs to Opportunity ID 9
```

**Relationship:**
```
Opportunity ID 9 (SUPREME JUDICIARY COUNCIL)
    ↓
    Activities where res_model='crm.lead' AND res_id=9
        • Activity 15: "Follow up call" (planned)
        • Activity 16: "Send proposal" (done)
        • Activity 17: "Schedule meeting" (overdue)
```

### Activity Mapping Function

```python
def map_activity(self, odoo_record: Dict) -> Dict:
    """Transform RAW Odoo activity → Canonical format"""
    
    # Extract assignee (user_id)
    user = self.extract_many2one(odoo_record.get("user_id"))
    
    # Extract activity type
    activity_type = self.extract_many2one(odoo_record.get("activity_type_id"))
    
    return {
        # Identifiers
        "id": odoo_record.get("id"),
        "odoo_id": odoo_record.get("id"),
        
        # Activity Info
        "summary": self.clean_odoo_value(odoo_record.get("summary")) or \
                  self.clean_odoo_value(odoo_record.get("note")),
        "activity_type": activity_type["name"] or "task",
        "activity_type_id": activity_type["id"],
        
        # Status & Dates
        "state": odoo_record.get("state", "planned"),  # planned, done, overdue, cancel
        "date_deadline": odoo_record.get("date_deadline"),
        "created_date": odoo_record.get("create_date"),
        
        # Assignment
        "user_id": user["id"],                # Who it's assigned to
        "user_name": user["name"],
        
        # Linkage to Other Records
        "res_model": odoo_record.get("res_model"),  # crm.lead, res.partner, etc.
        "res_id": odoo_record.get("res_id"),        # ID of linked record
        
        # Metadata
        "source": "odoo"
    }
```

**Canonical Activity Example:**
```python
{
    "id": 15,
    "summary": "Follow up call",
    "activity_type": "Call",
    "state": "planned",
    "date_deadline": "2026-01-20",
    "user_id": 7,
    "user_name": "Zakariya",
    "res_model": "crm.lead",     # ← Links to opportunity
    "res_id": 9,                  # ← Opportunity ID 9
    "source": "odoo"
}
```

---

## 📡 STEP 4: SERVING DATA TO FRONTEND

### Opportunity Endpoint with Activity Aggregation

**File:** `backend/routes/sales.py`

**Endpoint:** `GET /api/opportunities`

```python
@router.get("/opportunities")
async def get_opportunities(token_data: dict):
    """
    Serve opportunities with:
    1. Proper field mapping (via UniversalFieldMapper)
    2. Access control (via CQRS access matrix)
    3. Activity counts aggregated
    """
    from services.field_mapper import get_field_mapper
    
    db = Database.get_db()
    mapper = get_field_mapper()
    
    # Get user's access matrix (includes team opportunities)
    user_profile = await db.user_profiles.find_one({"email": user_email})
    access_matrix = await db.user_access_matrix.find_one({"user_id": user_profile["id"]})
    accessible_opp_ids = access_matrix.get("accessible_opportunities", [])
    
    opportunities = []
    
    # Fetch raw opportunities from data_lake_serving
    opp_docs = await db.data_lake_serving.find({
        "entity_type": "opportunity",
        "is_active": True
    }).to_list(1000)
    
    for doc in opp_docs:
        raw_opp = doc.get("data", {})
        
        # STEP 1: Use mapper to normalize Odoo fields
        canonical_opp = mapper.map_opportunity(raw_opp)
        
        # STEP 2: Check access control
        if not is_super_admin:
            if canonical_opp["odoo_id"] not in accessible_opp_ids:
                continue  # Skip - user can't see this
        
        # STEP 3: Aggregate activities for this opportunity
        canonical_opp = await aggregate_activities(db, canonical_opp)
        
        opportunities.append(canonical_opp)
    
    return opportunities
```

### Activity Aggregation Logic

```python
async def aggregate_activities(db, opportunity: Dict) -> Dict:
    """
    Aggregate activity counts for an opportunity
    
    CRITICAL: This links activities to opportunities!
    
    Args:
        db: Database connection
        opportunity: Canonical opportunity dict
    
    Returns:
        Opportunity with activity counts added
    """
    opp_id = opportunity.get("odoo_id")
    
    # Convert to int for matching with Odoo res_id
    try:
        opp_id_int = int(opp_id)
    except (ValueError, TypeError):
        opp_id_int = None
    
    # Query activities from data_lake_serving
    # WHERE res_model = 'crm.lead' AND res_id = opportunity_id
    activity_query = {
        "entity_type": "activity",
        "$or": [{"is_active": True}, {"is_active": {"$exists": False}}],
        "data.res_model": "crm.lead",  # ← Only opportunity activities
        "data.res_id": opp_id_int       # ← Match by opportunity ID
    }
    
    activity_docs = await db.data_lake_serving.find(activity_query).to_list(100)
    
    # Extract activity data
    activities = [doc.get("data", {}) for doc in activity_docs]
    
    # Count by status
    completed = len([a for a in activities if a.get("state") == "done"])
    pending = len([a for a in activities if a.get("state") not in ["done", "cancel", "cancelled"]])
    overdue = 0
    
    # Calculate overdue
    now = datetime.now(timezone.utc)
    for a in activities:
        if a.get("state") != "done" and a.get("date_deadline"):
            try:
                due_date = datetime.fromisoformat(a["date_deadline"])
                if due_date < now:
                    overdue += 1
            except:
                pass
    
    # Add to opportunity
    opportunity["completed_activities"] = completed
    opportunity["pending_activities"] = pending
    opportunity["overdue_activities"] = overdue
    opportunity["total_activities"] = len(activities)
    
    return opportunity
```

**Example Result:**
```python
{
    "id": 9,
    "name": "SUPREME JUDICIARY COUNCIL's opportunity",
    "owner_name": "Zakariya",
    "account_name": "MINISTRY OF INFORMATION",
    
    # Activity counts (aggregated from mail.activity)
    "completed_activities": 1,   # 1 activity with state='done'
    "pending_activities": 2,      # 2 activities with state='planned'
    "overdue_activities": 1,      # 1 activity past due_date
    "total_activities": 4
}
```

---

## 🔗 ACTIVITY-OPPORTUNITY RELATIONSHIP

### Database Query Example

**Find all activities for Opportunity ID 9:**
```python
# Query data_lake_serving
activities = await db.data_lake_serving.find({
    "entity_type": "activity",
    "is_active": True,
    "data.res_model": "crm.lead",   # Opportunity activities
    "data.res_id": 9                 # For opportunity ID 9
}).to_list(100)

# Result: All activities linked to that opportunity
```

**Find all activities for Account ID 22:**
```python
activities = await db.data_lake_serving.find({
    "entity_type": "activity",
    "is_active": True,
    "data.res_model": "res.partner", # Account activities
    "data.res_id": 22                # For account ID 22
}).to_list(100)
```

---

## 📊 COMPLETE DATA FLOW EXAMPLE

### Example: "SUPREME JUDICIARY COUNCIL" Opportunity

**1. In Odoo ERP:**
```
Opportunity ID 9:
  Name: "SUPREME JUDICIARY COUNCIL's opportunity"
  Account: [22, "MINISTRY OF INFORMATION"]
  Owner: [7, "Zakariya Al Baloushi"]
  
Activities for this opportunity:
  Activity 15: "Follow up call" → res_model='crm.lead', res_id=9
  Activity 16: "Send proposal" → res_model='crm.lead', res_id=9
```

**2. Sync to data_lake_serving:**
```javascript
// Opportunity document
{
    "entity_type": "opportunity",
    "serving_id": "odoo_opportunity_9",
    "data": {
        "id": 9,
        "partner_id": [22, "MINISTRY OF INFORMATION"],
        "user_id": [7, "Zakariya"]
    }
}

// Activity document 1
{
    "entity_type": "activity",
    "serving_id": "odoo_activity_15",
    "data": {
        "id": 15,
        "summary": "Follow up call",
        "res_model": "crm.lead",
        "res_id": 9  // ← Links to opportunity 9
    }
}

// Activity document 2
{
    "entity_type": "activity",
    "serving_id": "odoo_activity_16",
    "data": {
        "id": 16,
        "summary": "Send proposal",
        "res_model": "crm.lead",
        "res_id": 9  // ← Links to opportunity 9
    }
}
```

**3. API Normalization:**
```python
# Get opportunity
opp = mapper.map_opportunity(raw_data)
# Result: Clean fields with account_id=22, owner_id=7

# Aggregate activities
activities = query where res_model='crm.lead' AND res_id=9
# Found: 2 activities

opp["total_activities"] = 2
```

**4. Frontend Display:**
```javascript
// Opportunity Card shows:
{
  name: "SUPREME JUDICIARY COUNCIL's opportunity",
  owner_name: "Zakariya",
  account_name: "MINISTRY OF INFORMATION",
  completed_activities: 0,
  pending_activities: 2  // ← Shows the 2 activities!
}
```

---

## 🔍 QUERYING ACTIVITIES FOR DIFFERENT ENTITIES

### For Opportunities:
```python
# Get all activities for opportunity with odoo_id=9
activities = await db.data_lake_serving.find({
    "entity_type": "activity",
    "is_active": True,
    "data.res_model": "crm.lead",  # Opportunity model
    "data.res_id": 9               # Opportunity ID
}).to_list(100)
```

### For Accounts:
```python
# Get all activities for account with odoo_id=22
activities = await db.data_lake_serving.find({
    "entity_type": "activity",
    "is_active": True,
    "data.res_model": "res.partner",  # Account/Partner model
    "data.res_id": 22                  # Account ID
}).to_list(100)
```

### Activity States in Odoo:
- `planned`: Activity is scheduled
- `done`: Activity completed
- `overdue`: Past due date and not done
- `cancel`: Activity cancelled

---

## 📋 FIELD MAPPING REFERENCE TABLE

### Opportunity (crm.lead) Fields

| Canonical Field | Odoo Field | Type | Extraction Logic |
|----------------|------------|------|------------------|
| `id` | `id` | Integer | Direct |
| `name` | `name` | String | Direct |
| `account_id` | `partner_id` | Many2One | Extract ID from array: `[22, "Name"]` → `22` |
| `account_name` | `partner_id` | Many2One | Extract name from array: `[22, "MINISTRY"]` → `"MINISTRY"` |
| `account_linked` | `partner_id` | Boolean | `True` if `partner_id` is not False/None |
| `owner_id` | `user_id` | Many2One | Extract ID: `[7, "Zakariya"]` → `7` |
| `owner_name` | `user_id` | Many2One | Extract name: `[7, "Zakariya"]` → `"Zakariya"` |
| `stage_id` | `stage_id` | Many2One | Extract ID |
| `stage_name` | `stage_id` | Many2One | Extract name |
| `value` | `expected_revenue` | Float | Convert to float, handle None |
| `probability` | `probability` | Float | Convert to float |
| `close_date` | `date_deadline` | Date | Direct |
| `product_lines` | `product_ids` | Many2Many | Array of product IDs |

### Activity (mail.activity) Fields

| Canonical Field | Odoo Field | Type | Extraction Logic |
|----------------|------------|------|------------------|
| `id` | `id` | Integer | Direct |
| `summary` | `summary` or `note` | String | Fallback to note if summary empty |
| `activity_type` | `activity_type_id` | Many2One | Extract name: `[1, "Call"]` → `"Call"` |
| `state` | `state` | String | Direct: planned/done/overdue/cancel |
| `date_deadline` | `date_deadline` | Date | Direct |
| `user_id` | `user_id` | Many2One | Extract ID (assignee) |
| `user_name` | `user_id` | Many2One | Extract name |
| **`res_model`** | **`res_model`** | **String** | **Links to entity type** |
| **`res_id`** | **`res_id`** | **Integer** | **Links to entity ID** |

### Account (res.partner) Fields

| Canonical Field | Odoo Field | Type | Extraction Logic |
|----------------|------------|------|------------------|
| `id` | `id` | Integer | Direct |
| `name` | `name` | String | Direct |
| `email` | `email` | String | Clean (handle False) |
| `phone` | `phone` | String | Clean (handle False) |
| `country_id` | `country_id` | Many2One | Extract ID |
| `country_name` | `country_id` | Many2One | Extract name |
| `parent_id` | `parent_id` | Many2One | Extract ID (parent company) |

---

## 🔄 SYNC FREQUENCY & DATA FRESHNESS

### Background Sync

**File:** `backend/services/sync/background_sync.py`

**Frequency:** Every 5 minutes (configurable)

**What Gets Synced:**
1. Accounts (res.partner)
2. Opportunities (crm.lead)
3. Activities (mail.activity)
4. Invoices (account.move)
5. Users (hr.employee)

**Sync Flow:**
```
Every 5 minutes:
  1. Fetch from Odoo
  2. Store in data_lake_serving (raw)
  3. Mark old records as is_active=False
  4. Trigger CQRS projections (if enabled)
  5. Log sync statistics
```

---

## 🎯 FRONTEND DATA CONSUMPTION

### How Frontend Gets Activity Counts

**Component:** `frontend/src/pages/Opportunities.js`

```javascript
// 1. Fetch opportunities from API
const response = await opportunitiesAPI.getAll();
const opportunities = response.data;

// 2. Each opportunity includes activity counts
{
  id: 9,
  name: "SUPREME JUDICIARY COUNCIL",
  owner_name: "Zakariya",
  account_name: "MINISTRY OF INFORMATION",
  
  // Activity counts (pre-aggregated by backend)
  completed_activities: 1,
  pending_activities: 2,
  overdue_activities: 1,
  total_activities: 4
}

// 3. Display on Kanban card
<div className="activity-summary">
  <span className="text-emerald-600">
    ✅ {opportunity.completed_activities} done
  </span>
  <span className="text-amber-600">
    ⏰ {opportunity.pending_activities} pending
  </span>
</div>
```

---

## 🧪 TESTING ACTIVITY LINKAGE

### Verify Activity-Opportunity Link

```python
# 1. Find an opportunity
opp = await db.data_lake_serving.find_one({
    "entity_type": "opportunity",
    "data.id": 9
})

print(f"Opportunity ID: {opp['data']['id']}")
print(f"Opportunity Name: {opp['data']['name']}")

# 2. Find activities for this opportunity
activities = await db.data_lake_serving.find({
    "entity_type": "activity",
    "data.res_model": "crm.lead",
    "data.res_id": 9  # ← Links to opportunity 9
}).to_list(100)

print(f"\nActivities for this opportunity: {len(activities)}")
for act_doc in activities:
    act = act_doc["data"]
    print(f"  - {act['summary']} ({act['state']})")
```

**Expected Output:**
```
Opportunity ID: 9
Opportunity Name: SUPREME JUDICIARY COUNCIL's opportunity

Activities for this opportunity: 2
  - Follow up call (planned)
  - Send proposal (done)
```

---

## 🎨 DATA TRANSFORMATION DIAGRAM

```
┌──────────────────────────────────────────────────────────────┐
│ ODOO (Raw)                                                    │
├──────────────────────────────────────────────────────────────┤
│ Opportunity:                                                  │
│   id: 9                                                       │
│   partner_id: [22, "MINISTRY OF INFORMATION, Zack"]  ← Array │
│   user_id: [7, "Zakariya Al Baloushi"]               ← Array │
│                                                               │
│ Activity:                                                     │
│   id: 15                                                      │
│   res_model: "crm.lead"                                      │
│   res_id: 9  ← Links to opportunity                         │
│   user_id: [7, "Zakariya"]                                   │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         │ OdooConnector.fetch_*()
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ data_lake_serving (MongoDB)                                   │
├──────────────────────────────────────────────────────────────┤
│ {                                                             │
│   entity_type: "opportunity",                                │
│   data: { id: 9, partner_id: [22, "MINISTRY..."], ... }     │
│ }                                                             │
│                                                               │
│ {                                                             │
│   entity_type: "activity",                                   │
│   data: { id: 15, res_model: "crm.lead", res_id: 9, ... }   │
│ }                                                             │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         │ UniversalFieldMapper.map_*()
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ CANONICAL FORMAT (API Response)                              │
├──────────────────────────────────────────────────────────────┤
│ Opportunity:                                                  │
│   id: 9                                                       │
│   account_id: 22              ← Clean integer                │
│   account_name: "MINISTRY OF INFORMATION, Zack"              │
│   account_linked: true        ← Boolean                      │
│   owner_id: 7                 ← Clean integer                │
│   owner_name: "Zakariya"                                     │
│   owner_assigned: true                                        │
│   completed_activities: 1     ← Aggregated                   │
│   pending_activities: 2       ← Aggregated                   │
│   total_activities: 3                                         │
└──────────────────────────────────────────────────────────────┘
```

---

## 🚀 FOR FUTURE DEVELOPERS

### Adding a New Entity Type

**Example: Adding Invoices**

**Step 1: Add to Connector**
```python
# backend/integrations/odoo/connector.py
async def fetch_invoices(self):
    fields = ['id', 'name', 'partner_id', 'amount_total', 'state']
    return await self.models.execute_kw('account.move', 'search_read', ...)
```

**Step 2: Add to Sync Pipeline**
```python
# backend/services/odoo/sync_pipeline.py
invoices = await connector.fetch_invoices()
for inv in invoices:
    await db.data_lake_serving.update_one(
        {"serving_id": f"odoo_invoice_{inv['id']}"},
        {"$set": {"entity_type": "invoice", "data": inv}},
        upsert=True
    )
```

**Step 3: Add Mapper Method**
```python
# backend/services/field_mapper.py
def map_invoice(self, odoo_record):
    partner = self.extract_many2one(odoo_record["partner_id"])
    return {
        "id": odoo_record["id"],
        "customer_id": partner["id"],
        "customer_name": partner["name"],
        ...
    }
```

**Step 4: Create API Endpoint**
```python
# backend/routes/sales.py
@router.get("/invoices")
async def get_invoices():
    mapper = get_field_mapper()
    inv_docs = await db.data_lake_serving.find({"entity_type": "invoice"})
    return [mapper.map_invoice(doc["data"]) for doc in inv_docs]
```

---

## 📝 KEY CONCEPTS

### 1. **res_model & res_id**
- **Purpose:** Link activities (and other records) to parent records
- **res_model:** The Odoo model name (`crm.lead`, `res.partner`)
- **res_id:** The ID of that record

### 2. **Many2One Fields**
- **Format:** `[id, "Display Name"]` in Odoo v17+
- **Extraction:** Use `UniversalFieldMapper.extract_many2one()`
- **Never** use raw value directly

### 3. **is_active Flag**
- **Purpose:** Soft-delete tracking
- **Usage:** Filter all queries with `is_active: True`
- **Set to False:** When record deleted in Odoo

### 4. **entity_type**
- **Purpose:** Classify records in data_lake_serving
- **Values:** "opportunity", "activity", "account", "invoice", "user"
- **Usage:** Filter queries by entity type

---

## 🎯 CRITICAL ACTIVITY CONCEPTS

### Activities Are NOT System Logs

**Wrong Understanding:**
- ❌ System activity logs (user_login, data_synced)
- ❌ Audit trail

**Correct Understanding:**
- ✅ Business tasks/to-dos from Odoo
- ✅ "Call customer on Monday"
- ✅ "Send proposal by Friday"
- ✅ Linked to opportunities/accounts via res_model + res_id

### Activity Aggregation Formula

```python
For opportunity with odoo_id = X:

completed_activities = COUNT(
    WHERE entity_type = 'activity'
    AND data.res_model = 'crm.lead'
    AND data.res_id = X
    AND data.state = 'done'
)

pending_activities = COUNT(
    WHERE entity_type = 'activity'
    AND data.res_model = 'crm.lead'
    AND data.res_id = X
    AND data.state IN ('planned', 'overdue')
    AND data.state NOT IN ('done', 'cancel')
)
```

---

**Document End**  
**For Questions:** Refer to `/app/docs/DATA_MAPPING_ARCHITECTURE.md`
