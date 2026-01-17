# 🗺️ Data Mapping Architecture - Complete Guide

**Date:** January 17, 2026  
**Purpose:** Explain how Odoo data maps to the Sales Intelligence Platform  
**Audience:** Developers, System Administrators

---

## 🎯 THE CONFUSION YOU'RE EXPERIENCING

### Problem Example (From Your Screenshot):

**What You See:**
```
Opportunity: "SUPREME JUDICIARY COUNCIL's opportunity"
Owner: Unassigned
Account: "No account linked"
BUT... Account name IS displayed in the title!
```

**Why This is Confusing:**
1. Account name appears in opportunity title
2. But "No account linked" shows in Account section
3. Owner shows "Unassigned" but there might be a salesperson in Odoo
4. Some fields populate, others don't

**Root Cause:** **Inconsistent field mapping from Odoo to the app**

---

## 📊 CURRENT DATA FLOW ARCHITECTURE

### Step 1: Odoo → Data Lake (Raw Storage)

```
┌─────────────────────────────────────────────────────────────────┐
│                    ODOO ERP (Source of Truth)                    │
│                                                                  │
│  Models:                                                         │
│  • crm.lead (Opportunities)                                     │
│  • res.partner (Accounts/Contacts)                              │
│  • account.move (Invoices)                                      │
│  • mail.activity (Activities)                                   │
│  • hr.employee (Users/Salespersons)                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ OdooConnector.fetch_*()
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│              data_lake_serving (MongoDB Collection)              │
│                                                                  │
│  Structure:                                                      │
│  {                                                               │
│    "entity_type": "opportunity",                                │
│    "serving_id": "odoo_opportunity_9",                          │
│    "source": "odoo",                                            │
│    "is_active": true,                                           │
│    "data": { ... RAW Odoo record ... }                          │
│  }                                                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ Manual mapping in route handlers
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                     API Response (Frontend)                      │
│                                                                  │
│  Manually mapped fields:                                         │
│  • name ← data.name                                             │
│  • account_name ← data.partner_name  (⚠️ NOT linked!)          │
│  • value ← data.expected_revenue                                │
│  • owner ← data.salesperson_name  (⚠️ might be missing!)       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔍 CURRENT FIELD MAPPING (Problem Areas)

### Opportunity Field Mapping

**File:** `backend/routes/sales.py` - `get_opportunities()` function (Lines 256-273)

```python
opp = {
    "id": opp_data.get("id"),                          # ✅ Direct mapping
    "name": opp_data.get("name", ""),                  # ✅ Direct mapping
    
    # ⚠️ PROBLEM: Account is NOT linked, just name copied
    "account_name": opp_data.get("partner_name", ""),  # ❌ String only, no link
    "account_id": opp_data.get("partner_id"),          # ⚠️ Odoo partner ID (not linked to accounts table)
    
    "value": float(opp_data.get("expected_revenue", 0) or 0),
    "probability": float(opp_data.get("probability", 0) or 0),
    
    # ⚠️ PROBLEM: Owner/Salesperson mapping
    "owner_email": opp_data.get("salesperson_name", ""),  # ❌ Actually gets NAME, not email
    "owner_id": opp_data.get("salesperson_id"),           # ⚠️ Might be [id, "Name"] array or just id
    
    "expected_close_date": opp_data.get("date_deadline"),
    "source": "odoo",
}
```

### Why Fields Are Missing

**1. Account Linkage Issue:**

**Odoo Structure:**
```javascript
// From Odoo crm.lead
{
  "partner_id": [12, "SUPREME JUDICIARY COUNCIL"],  // Array: [id, name]
  "partner_name": "SUPREME JUDICIARY COUNCIL"        // Just string
}
```

**Current Mapping:**
```python
"account_name": opp_data.get("partner_name")  # ✅ Gets name
"account_id": opp_data.get("partner_id")      # ⚠️ Gets array [12, "Name"]
```

**Problem:**
- `account_id` should be just the numeric ID (12)
- But it's getting the full array [12, "SUPREME JUDICIARY COUNCIL"]
- Frontend displays name but can't link to actual account record

**Correct Mapping Should Be:**
```python
partner_id = opp_data.get("partner_id")
if isinstance(partner_id, list) and len(partner_id) > 0:
    account_id = partner_id[0]  # Extract just the ID
    account_name = partner_id[1] if len(partner_id) > 1 else ""
else:
    account_id = partner_id
    account_name = opp_data.get("partner_name", "")

opp["account_id"] = account_id
opp["account_name"] = account_name
```

---

**2. Owner/Salesperson Issue:**

**Odoo Structure:**
```javascript
{
  "user_id": [7, "Zakariya Al Baloushi"],      // Salesperson [id, name]
  "salesperson_name": "Zakariya Al Baloushi",   // Or might be email
  "salesperson_id": 7                            // Just ID
}
```

**Current Mapping:**
```python
"owner_email": opp_data.get("salesperson_name")  # ❌ Gets name, not email
"owner_id": opp_data.get("salesperson_id")       # Gets ID
```

**Problem:**
- Field is named `owner_email` but contains the NAME
- No actual email field mapped
- Frontend expects email in `owner_email` field

**Why "Unassigned" Shows:**
- Frontend checks for owner data
- If fields are missing or null, shows "Unassigned"

---

## 🏗️ THE PROPER ARCHITECTURE (What Should Exist)

### Ideal Data Mapping Layer

```
┌─────────────────────────────────────────────────────────────────┐
│                    1. ODOO CONNECTOR LAYER                       │
│  File: backend/integrations/odoo/connector.py                   │
│                                                                  │
│  fetch_opportunities() → Returns RAW Odoo data                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                 2. FIELD MAPPING SERVICE                         │
│  File: backend/services/ai_mapping/mapper.py (EXISTS!)          │
│                                                                  │
│  Purpose: Transform Odoo fields → Canonical schema              │
│                                                                  │
│  class OdooOpportunityMapper:                                   │
│      def map_to_canonical(self, odoo_record):                   │
│          # Handle Odoo array formats                            │
│          partner_id = self._extract_id(odoo_record.partner_id)  │
│          salesperson = self._map_user(odoo_record.user_id)      │
│                                                                  │
│          return {                                                │
│              "id": odoo_record.id,                              │
│              "name": odoo_record.name,                          │
│              "account": {                                        │
│                  "id": partner_id,                              │
│                  "name": self._extract_name(partner_id),        │
│                  "linked": True                                 │
│              },                                                  │
│              "owner": {                                          │
│                  "id": salesperson.id,                          │
│                  "name": salesperson.name,                      │
│                  "email": salesperson.email                     │
│              }                                                   │
│          }                                                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                   3. CANONICAL SCHEMA                            │
│  File: backend/models/canonical.py                              │
│                                                                  │
│  Standard structure for all entities regardless of source       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 EXISTING FIELD MAPPING SYSTEM

**Good News:** A field mapping system **ALREADY EXISTS** but isn't being used!

**Files:**
- `backend/services/ai_mapping/mapper.py` - AI-powered field mapper
- `backend/api/ai_mapping.py` - Field mapping API
- `frontend/src/pages/FieldMapping.js` - UI for mapping management

### How It Should Work

**1. Define Canonical Schema:**
```python
# backend/models/canonical.py
CANONICAL_OPPORTUNITY = {
    "id": "string",
    "name": "string",
    "account": {
        "id": "integer",
        "name": "string",
        "email": "string"
    },
    "owner": {
        "id": "integer",
        "name": "string",
        "email": "string"
    },
    "value": "float",
    "probability": "float",
    "stage": "string",
    "close_date": "date",
    "created_date": "date",
    "product_lines": ["string"],
    "activities": {
        "completed": "integer",
        "pending": "integer",
        "overdue": "integer"
    }
}
```

**2. Create Field Mappings:**
```python
# For Odoo v19
ODOO_V19_OPPORTUNITY_MAPPING = {
    "id": "id",
    "name": "name",
    "account.id": lambda rec: rec["partner_id"][0] if isinstance(rec.get("partner_id"), list) else rec.get("partner_id"),
    "account.name": lambda rec: rec["partner_id"][1] if isinstance(rec.get("partner_id"), list) and len(rec["partner_id"]) > 1 else rec.get("partner_name"),
    "owner.id": lambda rec: rec["user_id"][0] if isinstance(rec.get("user_id"), list) else rec.get("user_id"),
    "owner.name": lambda rec: rec["user_id"][1] if isinstance(rec.get("user_id"), list) and len(rec["user_id"]) > 1 else rec.get("salesperson_name"),
    "value": lambda rec: float(rec.get("expected_revenue", 0) or 0),
    "probability": lambda rec: float(rec.get("probability", 0) or 0),
    "stage": "stage_name",
    "close_date": "date_deadline",
}
```

**3. Apply Mapping:**
```python
from services.ai_mapping.mapper import AIFieldMapper

mapper = AIFieldMapper(db)
canonical_opp = await mapper.map_entity(
    entity_type="opportunity",
    source="odoo_v19",
    raw_data=odoo_record
)
```

---

## 🛠️ FIXING THE CURRENT MAPPING ISSUES

### Issue #1: Account Name Shows But Not Linked

**Current Broken Code:**
```python
# File: backend/routes/sales.py - Line 260
"account_name": opp_data.get("partner_name", ""),  # ✅ Gets name
"account_id": opp_data.get("partner_id"),          # ❌ Gets [12, "Name"] array
```

**Frontend Receives:**
```javascript
{
  account_name: "SUPREME JUDICIARY COUNCIL",
  account_id: [12, "SUPREME JUDICIARY COUNCIL"]  // ❌ Frontend can't use array
}
```

**Frontend Logic:**
```javascript
// Tries to link account by ID
if (opportunity.account_id) {
  // Link to account
} else {
  // Show "No account linked"
}
// Since account_id is an array, check fails!
```

**FIX NEEDED:**
```python
# File: backend/routes/sales.py - Line 259-261

# Extract account ID and name from Odoo format
partner_id = opp_data.get("partner_id")
if isinstance(partner_id, list) and len(partner_id) > 0:
    account_id = partner_id[0]  # Extract numeric ID
    account_name = partner_id[1] if len(partner_id) > 1 else opp_data.get("partner_name", "")
else:
    account_id = partner_id if partner_id and partner_id != False else None
    account_name = opp_data.get("partner_name", "")

opp["account_id"] = account_id
opp["account_name"] = account_name
opp["account_linked"] = account_id is not None  # NEW: Boolean flag
```

---

### Issue #2: Owner Shows "Unassigned"

**Current Broken Code:**
```python
# File: backend/routes/sales.py - Line 267-268
"owner_email": opp_data.get("salesperson_name", ""),  # ❌ Gets NAME, not email
"owner_id": opp_data.get("salesperson_id"),           # Gets ID
```

**Odoo Data Structure:**
```javascript
{
  "user_id": [7, "Zakariya Al Baloushi"],     // Main field (array)
  "salesperson_name": "Zakariya Al Baloushi", // String version
  "salesperson_id": 7                          // Just ID
}
```

**FIX NEEDED:**
```python
# Extract salesperson info properly
user_id = opp_data.get("user_id")
if isinstance(user_id, list) and len(user_id) > 0:
    owner_id = user_id[0]
    owner_name = user_id[1] if len(user_id) > 1 else ""
else:
    owner_id = opp_data.get("salesperson_id") or user_id
    owner_name = opp_data.get("salesperson_name", "")

# Get email from users table
owner_email = ""
if owner_id:
    user_doc = await db.users.find_one({"odoo_user_id": owner_id}, {"email": 1})
    if user_doc:
        owner_email = user_doc.get("email", "")

opp["owner_id"] = owner_id
opp["owner_name"] = owner_name
opp["owner_email"] = owner_email
opp["is_assigned"] = owner_id is not None  # NEW: Boolean flag
```

---

## 🎨 ODOO FIELD FORMAT PATTERNS

### Pattern 1: Many2One Fields (Returns Array)

**Odoo Format:**
```javascript
{
  "partner_id": [12, "SUPREME JUDICIARY COUNCIL"],  // [id, display_name]
  "user_id": [7, "Zakariya Al Baloushi"],
  "stage_id": [3, "Qualified"]
}
```

**How to Handle:**
```python
def extract_many2one(field_value):
    """Extract ID and name from Odoo Many2One field"""
    if isinstance(field_value, list) and len(field_value) >= 2:
        return {
            "id": field_value[0],
            "name": field_value[1]
        }
    elif isinstance(field_value, (int, str)):
        return {
            "id": field_value,
            "name": None
        }
    else:
        return {
            "id": None,
            "name": None
        }
```

### Pattern 2: Many2Many Fields (Returns Array of IDs)

**Odoo Format:**
```javascript
{
  "tag_ids": [5, 12, 18],           // Array of tag IDs
  "category_ids": [2, 4]            // Array of category IDs
}
```

**How to Handle:**
```python
def extract_many2many(field_value):
    """Extract IDs from Odoo Many2Many field"""
    if isinstance(field_value, list):
        return field_value
    else:
        return []
```

### Pattern 3: False vs None vs Empty String

**Odoo Quirk:**
```javascript
{
  "mobile": false,        // Odoo returns False for empty fields!
  "email": "",            // Some fields are empty string
  "description": null     // Some are null
}
```

**How to Handle:**
```python
def clean_odoo_value(value, default=""):
    """Handle Odoo's False/None/Empty patterns"""
    if value is False or value is None:
        return default
    return value
```

---

## 📋 COMPREHENSIVE FIELD MAPPING TABLE

### Opportunity (crm.lead) Mapping

| App Field | Odoo Field | Format | Extraction Logic |
|-----------|------------|--------|------------------|
| `id` | `id` | Integer | Direct |
| `name` | `name` | String | Direct |
| `account_id` | `partner_id` | [id, name] | Extract `partner_id[0]` |
| `account_name` | `partner_id` | [id, name] | Extract `partner_id[1]` or fallback to `partner_name` |
| `owner_id` | `user_id` | [id, name] | Extract `user_id[0]` |
| `owner_name` | `user_id` | [id, name] | Extract `user_id[1]` |
| `owner_email` | JOIN users table | N/A | Query users where `odoo_user_id = user_id[0]` |
| `value` | `expected_revenue` | Float | Convert to float, handle None |
| `probability` | `probability` | Float | Convert to float |
| `stage` | `stage_id` | [id, name] | Map stage name to internal stages |
| `close_date` | `date_deadline` | Date string | Direct or parse |
| `created_date` | `create_date` | Datetime | Parse to date |
| `description` | `description` | Text/False | Handle False → "" |
| `product_lines` | `product_ids` or custom | Array | Map product IDs to names |

---

## 🔄 HANDLING DIFFERENT ODOO VERSIONS

### Version Detection Strategy

```python
# File: backend/services/odoo/version_detector.py (TO BE CREATED)

class OdooVersionDetector:
    async def detect_version(self, connector):
        """Detect Odoo version from server info"""
        info = await connector.get_server_info()
        version = info.get("server_version", "")
        
        # Parse version: "19.0+e" → major=19, minor=0
        major = int(version.split('.')[0])
        
        if major >= 19:
            return "odoo_v19"
        elif major >= 17:
            return "odoo_v17"
        else:
            return "odoo_legacy"
    
    def get_mapping_config(self, version):
        """Get field mapping config for detected version"""
        mappings = {
            "odoo_v19": ODOO_V19_MAPPING,
            "odoo_v17": ODOO_V17_MAPPING,
            "odoo_legacy": ODOO_LEGACY_MAPPING
        }
        return mappings.get(version, ODOO_V19_MAPPING)
```

### Mapping Configuration Files

```
/app/backend/config/odoo_mappings/
├── v19_mapping.py          # Odoo 19 field mappings
├── v17_mapping.py          # Odoo 17 field mappings  
├── v16_mapping.py          # Odoo 16 field mappings
└── base_mapper.py          # Base mapping logic
```

**Example Config:**
```python
# config/odoo_mappings/v19_mapping.py

OPPORTUNITY_MAPPING = {
    "fields": {
        "id": {"odoo_field": "id", "type": "int"},
        "name": {"odoo_field": "name", "type": "string"},
        
        "account_id": {
            "odoo_field": "partner_id",
            "type": "many2one",
            "extract": "id"  # Extract ID from [id, name]
        },
        
        "account_name": {
            "odoo_field": "partner_id",
            "type": "many2one",
            "extract": "name"  # Extract name from [id, name]
        },
        
        "owner_id": {
            "odoo_field": "user_id",
            "type": "many2one",
            "extract": "id"
        },
        
        "owner_name": {
            "odoo_field": "user_id",
            "type": "many2one",
            "extract": "name"
        },
    },
    
    "transformations": {
        "stage": {
            "odoo_field": "stage_name",
            "mapping": {
                "New": "lead",
                "Qualified": "qualification",
                "Proposition": "proposal",
                "Won": "closed_won",
                "Lost": "closed_lost"
            }
        }
    }
}
```

---

## 🚀 RECOMMENDED IMPLEMENTATION

### Phase 1: Create Universal Mapper (2-3 hours)

**File:** `backend/services/field_mapper.py`

```python
class UniversalFieldMapper:
    """
    Universal field mapper for handling Odoo data transformations.
    Works with any Odoo version by detecting field formats.
    """
    
    def extract_many2one(self, value):
        """
        Handle Odoo Many2One format: [id, "Name"] or just id
        Returns: {"id": int, "name": str}
        """
        if isinstance(value, list) and len(value) >= 2:
            return {"id": value[0], "name": value[1]}
        elif isinstance(value, (int, str)) and value != False:
            return {"id": value, "name": None}
        else:
            return {"id": None, "name": None}
    
    def clean_value(self, value, default=""):
        """Handle Odoo False/None/Empty"""
        if value is False or value is None:
            return default
        return value
    
    def map_opportunity(self, odoo_record):
        """Map Odoo opportunity to canonical format"""
        # Extract account
        account = self.extract_many2one(odoo_record.get("partner_id"))
        
        # Extract owner
        owner = self.extract_many2one(odoo_record.get("user_id"))
        
        return {
            "id": odoo_record.get("id"),
            "name": odoo_record.get("name", ""),
            
            # Properly extracted account
            "account_id": account["id"],
            "account_name": account["name"] or self.clean_value(odoo_record.get("partner_name")),
            "account_linked": account["id"] is not None,
            
            # Properly extracted owner
            "owner_id": owner["id"],
            "owner_name": owner["name"] or self.clean_value(odoo_record.get("salesperson_name")),
            "owner_assigned": owner["id"] is not None,
            
            "value": float(odoo_record.get("expected_revenue", 0) or 0),
            "probability": float(odoo_record.get("probability", 0) or 0),
            "stage": odoo_record.get("stage_name", ""),
            "close_date": odoo_record.get("date_deadline"),
            "created_date": odoo_record.get("create_date"),
            "description": self.clean_value(odoo_record.get("description")),
        }
```

---

### Phase 2: Update All Endpoints to Use Mapper (1-2 hours)

```python
# File: backend/routes/sales.py

from services.field_mapper import UniversalFieldMapper

@router.get("/opportunities")
async def get_opportunities(token_data: dict):
    db = Database.get_db()
    mapper = UniversalFieldMapper()
    
    opp_docs = await db.data_lake_serving.find(
        active_entity_filter("opportunity")
    ).to_list(1000)
    
    opportunities = []
    for doc in opp_docs:
        # Use mapper instead of manual field extraction
        canonical_opp = mapper.map_opportunity(doc.get("data", {}))
        
        # Add activity counts (already working)
        canonical_opp = await add_activity_counts(db, canonical_opp)
        
        opportunities.append(canonical_opp)
    
    return opportunities
```

---

## 🌍 SUPPORTING MULTIPLE ODOO INSTANCES

### Configuration-Based Approach

**File:** `backend/config/integration_configs.py`

```python
INTEGRATION_CONFIGS = {
    "odoo_production": {
        "version": "19.0",
        "url": "https://prod.odoo.com",
        "mapping_profile": "odoo_v19",
        "custom_fields": {
            "opportunity": {
                "x_custom_field": "custom_field_mapping"
            }
        }
    },
    
    "odoo_staging": {
        "version": "17.0",
        "url": "https://staging.odoo.com",
        "mapping_profile": "odoo_v17",
        "custom_fields": {}
    }
}
```

### Dynamic Field Mapping

```python
class DynamicMapper:
    def __init__(self, integration_config):
        self.config = integration_config
        self.mapping_profile = self.load_mapping_profile(
            config["mapping_profile"]
        )
    
    def map_field(self, field_name, odoo_value):
        """Map field using configuration"""
        mapping = self.mapping_profile.get(field_name)
        
        if mapping["type"] == "many2one":
            return self.extract_many2one(odoo_value)
        elif mapping["type"] == "many2many":
            return self.extract_many2many(odoo_value)
        elif mapping.get("transform"):
            return mapping["transform"](odoo_value)
        else:
            return odoo_value
```

---

## 🎯 IMMEDIATE FIX RECOMMENDATIONS

### Fix 1: Update Opportunity Mapping (HIGH PRIORITY)

**File to Modify:** `backend/routes/sales.py` - Lines 256-273

**Current Code:**
```python
opp = {
    "account_name": opp_data.get("partner_name", ""),
    "account_id": opp_data.get("partner_id"),  # ❌ Array
    "owner_email": opp_data.get("salesperson_name", ""),  # ❌ Wrong field
}
```

**Fixed Code:**
```python
# Extract account (handle array format)
partner_id = opp_data.get("partner_id")
account_id = partner_id[0] if isinstance(partner_id, list) else partner_id
account_name = (partner_id[1] if isinstance(partner_id, list) and len(partner_id) > 1 
                else opp_data.get("partner_name", ""))

# Extract owner (handle array format)
user_id_field = opp_data.get("user_id")
owner_id = user_id_field[0] if isinstance(user_id_field, list) else opp_data.get("salesperson_id")
owner_name = (user_id_field[1] if isinstance(user_id_field, list) and len(user_id_field) > 1 
              else opp_data.get("salesperson_name", ""))

# Build properly mapped opportunity
opp = {
    "id": opp_data.get("id"),
    "name": opp_data.get("name", ""),
    
    # Properly mapped account
    "account_id": account_id if account_id and account_id != False else None,
    "account_name": account_name or "",
    "account_linked": account_id is not None,
    
    # Properly mapped owner
    "owner_id": owner_id if owner_id and owner_id != False else None,
    "owner_name": owner_name or "Unassigned",
    "owner_assigned": owner_id is not None,
    
    "value": float(opp_data.get("expected_revenue", 0) or 0),
    "probability": float(opp_data.get("probability", 0) or 0),
    "stage": mapped_stage,
    "close_date": opp_data.get("date_deadline"),
    "created_date": opp_data.get("create_date"),
    "description": "" if opp_data.get("description") == False else (opp_data.get("description") or ""),
}
```

---

### Fix 2: Update Frontend to Use New Fields

**File:** `frontend/src/components/OpportunityDetailPanel.js`

```javascript
// Use the new properly mapped fields
<InfoRow 
  icon={User} 
  label="Owner" 
  value={opportunity.owner_name || "Unassigned"}  // ✅ Uses owner_name
/>

<InfoRow 
  icon={Building2} 
  label="Account" 
  value={
    opportunity.account_linked 
      ? <a href={`/accounts/${opportunity.account_id}`}>{opportunity.account_name}</a>
      : "No account linked"
  }
/>
```

---

## 📊 TESTING THE MAPPING

### Unit Test for Field Mapper

```python
# backend/tests/test_field_mapper.py

def test_extract_many2one():
    mapper = UniversalFieldMapper()
    
    # Test array format
    result = mapper.extract_many2one([12, "Test Account"])
    assert result["id"] == 12
    assert result["name"] == "Test Account"
    
    # Test single ID
    result = mapper.extract_many2one(12)
    assert result["id"] == 12
    assert result["name"] is None
    
    # Test False
    result = mapper.extract_many2one(False)
    assert result["id"] is None
```

---

## 🎯 YOUR SPECIFIC QUESTIONS ANSWERED

### Q1: "Why does account name show but 'No account linked'?"

**Answer:**
- `account_name` field gets populated from `partner_name` (string)
- `account_id` field gets the raw array `[12, "Name"]`  
- Frontend checks if `account_id` is usable → sees array → can't link
- Shows name but says "No account linked"

**Fix:** Extract ID from array properly

---

### Q2: "Why is owner 'Unassigned'?"

**Answer:**
- Odoo field is `user_id: [7, "Zakariya"]` (array)
- Current code tries to get `salesperson_name` which might not exist
- Or gets wrong field
- Frontend sees no valid owner → shows "Unassigned"

**Fix:** Extract name from `user_id` array

---

### Q3: "How to handle different Odoo versions?"

**Answer:**

**Step 1: Version Detection**
```python
# Detect on first sync
version_info = await connector.get_server_info()
odoo_version = version_info["server_version"]  # "19.0+e"
```

**Step 2: Load Version-Specific Mapping**
```python
if odoo_version.startswith("19"):
    mapping = ODOO_V19_MAPPING
elif odoo_version.startswith("17"):
    mapping = ODOO_V17_MAPPING
```

**Step 3: Store in Integration Config**
```python
await db.integrations.update_one(
    {"integration_type": "odoo"},
    {"$set": {"odoo_version": odoo_version, "mapping_profile": "v19"}}
)
```

**Step 4: Use Correct Mapper**
```python
config = await db.integrations.find_one({"integration_type": "odoo"})
mapper = FieldMapper(config["mapping_profile"])
canonical_data = mapper.map(raw_odoo_data)
```

---

## 🛠️ IMMEDIATE ACTION PLAN

### Priority 1: Fix Opportunity Mapping (2 hours)

1. Update `backend/routes/sales.py` - `get_opportunities()`
2. Properly extract account_id and owner fields from arrays
3. Test with current data

### Priority 2: Create Universal Mapper Class (3 hours)

1. Create `backend/services/field_mapper.py`
2. Implement extraction methods
3. Add unit tests

### Priority 3: Apply to All Endpoints (2 hours)

1. Update `/opportunities` endpoint
2. Update `/api/v2/dashboard/` endpoint
3. Update `/accounts/real` endpoint

---

**Should I implement the proper field mapping fixes now to resolve the "Unassigned" and "No account linked" issues?**

This will make the system future-proof for different Odoo versions! 🚀
