# 🔐 Activity Authorization & Linking Strategy
## How Activities are Filtered by Authorized Odoo Users

**Date:** 2025-01-15  
**Related UAT:** UAT-006 (Activity Sync)

---

## 🎯 CORE CONCEPT: Inherit Visibility from Opportunities

### The Key Principle

**Activities don't have their own authorization rules.**  
**They inherit visibility from the opportunities they're linked to.**

```
If user can see Opportunity → User can see its Activities
If user cannot see Opportunity → Activities are hidden
```

---

## 🔄 COMPLETE LINKING FLOW

### Step 1: Odoo Links Activity to Opportunity

**In Odoo:**
```javascript
mail.activity {
  id: 2,
  summary: "Follow up call",
  res_model: "crm.lead",  // Links to opportunity model
  res_id: 9,              // Opportunity ID in Odoo
  user_id: 10,            // User assigned (Vinsha)
  state: "today"
}

crm.lead {
  id: 9,
  name: "SUPREME JUDICIARY COUNCIL's opportunity",
  user_id: 10  // Salesperson (Vinsha)
}
```

**Link:** `activity.res_id (9)` = `opportunity.id (9)`

---

### Step 2: Sync to Our System

**Current Sync (Working but Incomplete):**
```
Odoo API → fetch_activities()
  ↓
odoo_raw_data: {
  entity_type: "activity",
  raw_data: {
    id: 2,
    res_id: 9,  // Opportunity ID
    user_id: 10  // Vinsha's Odoo user ID
  }
}
  ↓
data_lake_serving: {
  entity_type: "activity",
  data: {
    id: 2,
    res_id: 9,
    user_id: 10
  }
}
```

**Problem:** res_id (9) needs to link to our opportunity_view

---

### Step 3: Build Activity View with Inherited Visibility (CQRS)

**New Collection:** `activity_view`

```javascript
{
  id: "activity-uuid",
  odoo_id: 2,
  
  // Activity info
  activity_type: "Meeting",
  summary: "Follow up call",
  due_date: "2026-01-20",
  state: "today",
  
  // LINKED OPPORTUNITY (by odoo_id)
  opportunity: {
    id: "opp-uuid",
    odoo_id: 9,  // ← Matches activity.res_id
    name: "SUPREME JUDICIARY COUNCIL's opportunity"
  },
  
  // ASSIGNED USER
  assigned_to: {
    user_id: "vinsha-uuid",
    odoo_user_id: 10,  // ← Matches activity.user_id
    name: "vinsha Nair",
    email: "vinsha.nair@securado.net"
  },
  
  // CRITICAL: INHERIT VISIBILITY FROM OPPORTUNITY
  visible_to_user_ids: [
    "vinsha-uuid",      // Opportunity owner
    "krishna-uuid",     // Vinsha's manager
    "admin-uuid"        // Admins
  ]
}
```

**Key Fields:**
1. `opportunity.odoo_id` = Links to which opportunity
2. `assigned_to.odoo_user_id` = Who is responsible
3. `visible_to_user_ids` = **Copied from linked opportunity!**

---

## 🔐 AUTHORIZATION LOGIC

### Rule 1: Activity Visibility = Opportunity Visibility

**Code Example:**
```python
# In ActivityProjection.handle()

# Find linked opportunity
opportunity = await db.opportunity_view.find_one({
    "odoo_id": activity.res_id  # Match Odoo IDs
})

if not opportunity:
    # Activity links to unknown opportunity
    # Hide it (don't create activity_view record)
    return

# Inherit visibility from opportunity
activity_doc = {
    # ... activity fields ...
    
    "visible_to_user_ids": opportunity.get("visible_to_user_ids", [])
    # ↑ CRITICAL: Copy visibility from opportunity!
}

await db.activity_view.insert_one(activity_doc)
```

**Result:**
- Vinsha can see opportunity #9 → She can see activities on opportunity #9
- Zakariya cannot see opportunity #9 → Activities hidden from him
- Krishna (Vinsha's manager) sees opportunity #9 → He sees activities too

---

### Rule 2: Manager Hierarchy Applies to Activities

**Example:**

**Opportunity #6 (Zakariya's):**
```javascript
opportunity_view: {
  odoo_id: 6,
  name: "Ministry of Information",
  salesperson: {
    email: "z.albaloushi@securado.net",
    manager: {
      email: "vinsha.nair@securado.net"  // Vinsha is manager
    }
  },
  visible_to_user_ids: [
    "zakariya-uuid",  // Owner
    "vinsha-uuid"     // Manager can see!
  ]
}
```

**Activity on this Opportunity:**
```javascript
activity_view: {
  odoo_id: 1,
  summary: "Document",
  opportunity: {
    odoo_id: 6,  // Links to Zakariya's opportunity
    name: "Ministry of Information"
  },
  assigned_to: {
    email: "z.albaloushi@securado.net"
  },
  // INHERITED VISIBILITY
  visible_to_user_ids: [
    "zakariya-uuid",  // Zakariya (owner)
    "vinsha-uuid"     // Vinsha (MANAGER) can see this activity!
  ]
}
```

**Result:** Vinsha sees activities on her subordinate's opportunities!

---

## 🔍 AUTHORIZATION CHECK IN API

### API Endpoint Logic

```python
@router.get("/activities")
async def get_activities(
    opportunity_id: Optional[str] = None,
    token_data: dict = Depends(require_approved())
):
    """
    Get activities with proper authorization.
    Users only see activities on opportunities they can access.
    """
    db = Database.get_db()
    user_id = token_data["id"]
    
    # Method 1: Use CQRS activity_view (Fast - O(1))
    if await collection_exists(db, 'activity_view'):
        query = {
            "visible_to_user_ids": user_id,  # Pre-computed!
            "is_active": True
        }
        
        if opportunity_id:
            # Filter by opportunity
            query["opportunity.odoo_id"] = parse_opp_id(opportunity_id)
        
        activities = await db.activity_view.find(query).to_list(1000)
        
        return {
            "activities": activities,
            "count": len(activities),
            "source": "cqrs_activity_view"
        }
    
    # Method 2: Fallback - Use access matrix (Medium)
    else:
        # Get user's accessible opportunities
        access = await db.user_access_matrix.find_one({"user_id": user_id})
        
        if not access:
            return {"activities": [], "count": 0}
        
        accessible_opp_ids = access.get("accessible_opportunities", [])
        
        # Get activities linked to these opportunities
        activities = await db.data_lake_serving.find({
            "entity_type": "activity",
            "data.res_model": "crm.lead",
            "data.res_id": {"$in": accessible_opp_ids}  # Only accessible opps
        }).to_list(1000)
        
        return {
            "activities": [a.get("data") for a in activities],
            "count": len(activities),
            "source": "data_lake_serving"
        }
```

**Key Points:**
1. Never filter activities by `activity.user_id` directly
2. Always filter by linked opportunity visibility
3. Use pre-computed `visible_to_user_ids` for speed

---

## 🔗 DETAILED LINKING MECHANISM

### Scenario 1: Activity on Own Opportunity

**Data:**
```
User: Vinsha (odoo_user_id=10, uuid=172a163f...)
Opportunity: "Supreme Judiciary" (odoo_id=9, salesperson=Vinsha)
Activity: "Meeting" (odoo_id=2, res_id=9, user_id=10)
```

**Linking:**
```python
# 1. Find opportunity by res_id
opportunity = await db.opportunity_view.find_one({
    "odoo_id": 9  # activity.res_id
})

# 2. Check opportunity visibility
visible_to = opportunity["visible_to_user_ids"]
# = ["172a163f...", "admin-uuid"]

# 3. Create activity with same visibility
activity_doc = {
    "opportunity": {"odoo_id": 9, "name": "Supreme Judiciary"},
    "assigned_to": {"odoo_user_id": 10, "email": "vinsha.nair@securado.net"},
    "visible_to_user_ids": visible_to  # INHERITED!
}
```

**Result:** Vinsha sees this activity (she's in visible_to_user_ids)

---

### Scenario 2: Activity on Subordinate's Opportunity (Manager Visibility)

**Data:**
```
Manager: Vinsha (uuid=172a163f...)
Subordinate: Zakariya (odoo_user_id=7, manager=Vinsha)
Opportunity: "Ministry of Information" (odoo_id=6, salesperson=Zakariya)
Activity: "Document" (odoo_id=1, res_id=6, user_id=7)
```

**Opportunity Visibility (Already Computed):**
```javascript
opportunity_view: {
  odoo_id: 6,
  salesperson: {
    odoo_user_id: 7,
    email: "z.albaloushi@securado.net",
    manager: {
      email: "vinsha.nair@securado.net"
    }
  },
  visible_to_user_ids: [
    "55bdf33e...",  // Zakariya (owner)
    "172a163f..."   // Vinsha (MANAGER)
  ]
}
```

**Activity Linking:**
```python
# 1. Find opportunity
opportunity = await db.opportunity_view.find_one({
    "odoo_id": 6  # activity.res_id
})

# 2. Copy visibility
activity_doc = {
    "opportunity": {
        "odoo_id": 6,
        "name": "Ministry of Information"
    },
    "assigned_to": {
        "odoo_user_id": 7,
        "email": "z.albaloushi@securado.net"
    },
    "visible_to_user_ids": [
        "55bdf33e...",  # Zakariya
        "172a163f..."   // Vinsha (INHERITED FROM OPPORTUNITY!)
    ]
}
```

**Result:** Vinsha sees Zakariya's activities because she's his manager!

---

### Scenario 3: Unlinked Activity (No Opportunity)

**Data:**
```
Activity: "General task" (res_model="res.partner", res_id=10)
```

**Handling:**
```python
# Check res_model
if activity.res_model != "crm.lead":
    # Not an opportunity activity
    # Option A: Skip (don't import)
    # Option B: Create with user-only visibility
    
    # Get user
    user = await db.user_profiles.find_one({
        "odoo.user_id": activity.user_id
    })
    
    # Visible only to assigned user and their manager
    visible_to = [user["id"]]
    
    # Add manager
    if user.get("hierarchy", {}).get("manager"):
        visible_to.append(user["hierarchy"]["manager"]["user_id"])
    
    activity_doc = {
        "opportunity": None,  # Not linked
        "visible_to_user_ids": visible_to
    }
```

---

## 📊 AUTHORIZATION MATRIX

### Who Sees Which Activities

| Activity On | Assigned To | Visible To |
|-------------|-------------|------------|
| Vinsha's Opportunity #9 | Vinsha | Vinsha, Krishna (her manager), Admins |
| Zakariya's Opportunity #6 | Zakariya | Zakariya, Vinsha (his manager), Admins |
| Krishna's Opportunity #3 | Krishna | Krishna, His manager (if any), Admins, His subordinates' managers? No* |

*Note: Subordinates don't see their manager's activities unless explicitly assigned to them.

---

## 🛠️ IMPLEMENTATION CODE

### Complete ActivityProjection

```python
# File: /app/backend/projections/activity_projection.py

from projections.base import BaseProjection
from event_store.models import Event, EventType
from datetime import datetime, timezone
import uuid
import logging

logger = logging.getLogger(__name__)


class ActivityProjection(BaseProjection):
    """
    Builds activity_view with proper authorization.
    
    Authorization Strategy:
    1. Find linked opportunity (by res_id → odoo_id)
    2. Copy visible_to_user_ids from opportunity
    3. Result: Activity has same visibility as opportunity
    
    This ensures:
    - Managers see subordinate activities
    - Users only see their accessible activities
    - No manual authorization logic needed
    """
    
    def __init__(self, db):
        super().__init__(db, "ActivityProjection")
        self.collection = db.activity_view
        self.opportunity_view = db.opportunity_view
        self.user_profiles = db.user_profiles
    
    def subscribes_to(self):
        return [EventType.ODOO_ACTIVITY_SYNCED.value]
    
    async def handle(self, event: Event):
        payload = event.payload
        activity_id = payload.get("id")
        res_model = payload.get("res_model")
        res_id = payload.get("res_id")
        
        # Only process opportunity activities
        if res_model != "crm.lead":
            logger.debug(f"Skipping non-opportunity activity: {res_model}")
            return
        
        # STEP 1: Find linked opportunity
        opportunity = await self.opportunity_view.find_one({
            "odoo_id": res_id  # Match by Odoo ID
        })
        
        if not opportunity:
            logger.warning(
                f"Activity {activity_id} links to unknown opportunity {res_id}. "
                f"Activity will not be visible."
            )
            # Don't create activity_view record for orphaned activities
            return
        
        # STEP 2: Find assigned user
        user_odoo_id = payload.get("user_id")
        assigned_user = None
        
        if user_odoo_id:
            user_profile = await self.user_profiles.find_one({
                "odoo.user_id": user_odoo_id
            })
            
            if user_profile:
                assigned_user = {
                    "user_id": user_profile["id"],
                    "odoo_user_id": user_profile["odoo"]["user_id"],
                    "name": user_profile["name"],
                    "email": user_profile["email"]
                }
            else:
                # User not in CQRS system, use raw data
                assigned_user = {
                    "user_id": None,
                    "odoo_user_id": user_odoo_id,
                    "name": payload.get("user_name"),
                    "email": None
                }
        
        # STEP 3: Categorize for Presales KPI
        presales_category = self._categorize_for_presales(
            payload.get("summary", ""),
            payload.get("activity_type")
        )
        
        # STEP 4: Create activity_view record
        activity_doc = {
            "id": str(uuid.uuid4()),
            "odoo_id": activity_id,
            
            # Activity details
            "activity_type": payload.get("activity_type"),
            "summary": payload.get("summary"),
            "note": payload.get("note"),
            "due_date": payload.get("date_deadline"),
            "state": payload.get("state"),
            "presales_category": presales_category,
            
            # Denormalized opportunity
            "opportunity": {
                "id": opportunity["id"],
                "odoo_id": opportunity["odoo_id"],
                "name": opportunity["name"],
                "salesperson": opportunity.get("salesperson")
            },
            
            # Denormalized user
            "assigned_to": assigned_user,
            
            # CRITICAL: INHERIT VISIBILITY FROM OPPORTUNITY
            "visible_to_user_ids": opportunity.get("visible_to_user_ids", []),
            
            # Metadata
            "is_active": True,
            "last_synced": datetime.now(timezone.utc),
            "source": "odoo",
            "version": 1
        }
        
        # Upsert to activity_view
        await self.collection.update_one(
            {"odoo_id": activity_id},
            {
                "$set": activity_doc,
                "$setOnInsert": {
                    "id": str(uuid.uuid4()),
                    "created_at": datetime.now(timezone.utc)
                }
            },
            upsert=True
        )
        
        logger.info(
            f"Activity {activity_id} linked to opportunity {res_id}, "
            f"visible to {len(activity_doc['visible_to_user_ids'])} users"
        )
        
        await self.mark_processed(event.id)
    
    def _categorize_for_presales(self, summary: str, activity_type: str) -> str:
        """
        Categorize activity for Presales KPI tracking.
        Maps keywords to KPI categories.
        """
        summary_lower = (summary or "").lower()
        type_lower = (activity_type or "").lower()
        
        # POC
        if any(kw in summary_lower for kw in ["poc", "proof of concept", "pilot", "trial"]):
            return "POC"
        
        # Demo
        if any(kw in summary_lower for kw in ["demo", "demonstration", "walkthrough"]):
            return "Demo"
        
        # Presentation
        if any(kw in summary_lower for kw in ["presentation", "pitch", "deck", "slides"]):
            return "Presentation"
        
        # RFP
        if any(kw in summary_lower for kw in ["rfp", "tender", "proposal", "bid"]):
            return "RFP_Influence"
        
        # Lead
        if any(kw in summary_lower for kw in ["lead", "qualification", "discovery", "prospect"]):
            return "Lead"
        
        # Default by activity type
        if "meeting" in type_lower:
            return "Meeting"
        if "call" in type_lower:
            return "Call"
        
        return "Other"
```

---

## 📋 API QUERY EXAMPLES

### Example 1: Get All My Activities

**Request:**
```bash
GET /api/v2/activities
Authorization: Bearer {vinsha_token}
```

**Backend Logic:**
```python
# Get Vinsha's user_id from JWT
user_id = "172a163f-e3be-4815-8759-235b84412ffb"

# Query activity_view
activities = await db.activity_view.find({
    "visible_to_user_ids": user_id,  # Vinsha is in this array
    "is_active": True
}).to_list(1000)

# Returns:
# - Activity #2 (on her opportunity #9)
# - Activity #1 (on Zakariya's opportunity #6) ← MANAGER VISIBILITY!
```

**Response:**
```json
{
  "activities": [
    {
      "id": "act-uuid-1",
      "summary": "Document",
      "opportunity": {
        "name": "Ministry of Information",
        "salesperson": "z.albaloushi@securado.net"
      },
      "assigned_to": {
        "name": "Zakariya"
      },
      "presales_category": "Lead",
      "state": "planned"
    },
    {
      "id": "act-uuid-2",
      "summary": "Follow up call",
      "opportunity": {
        "name": "Supreme Judiciary",
        "salesperson": "vinsha.nair@securado.net"
      },
      "assigned_to": {
        "name": "vinsha Nair"
      },
      "presales_category": "Call",
      "state": "today"
    }
  ],
  "count": 2
}
```

---

### Example 2: Get Activities for Specific Opportunity

**Request:**
```bash
GET /api/activities/opportunity/9
Authorization: Bearer {vinsha_token}
```

**Backend Logic:**
```python
# Find opportunity first (check access)
opportunity = await db.opportunity_view.find_one({
    "odoo_id": 9,
    "visible_to_user_ids": user_id  # Verify user can see this opp
})

if not opportunity:
    raise HTTPException(403, "Access denied")

# Get activities for this opportunity
activities = await db.activity_view.find({
    "opportunity.odoo_id": 9,
    "visible_to_user_ids": user_id  # Double-check visibility
}).to_list(100)

return activities
```

---

## 🔐 SECURITY CONSIDERATIONS

### Prevent Data Leaks

**❌ WRONG Approach:**
```python
# BAD: Filter by activity.user_id only
activities = await db.activity_view.find({
    "assigned_to.odoo_user_id": current_user.odoo_user_id
})
# Problem: Doesn't respect opportunity visibility
# Risk: User might see activities on opportunities they can't access
```

**✅ CORRECT Approach:**
```python
# GOOD: Filter by visible_to_user_ids (inherited from opportunity)
activities = await db.activity_view.find({
    "visible_to_user_ids": current_user.id
})
# Ensures: User only sees activities on accessible opportunities
# Respects: Manager hierarchy, team assignments, admin access
```

---

## 🎯 FINAL AUTHORIZATION RULES

### Summary Table

| User Type | Can See Activities On |
|-----------|----------------------|
| **Super Admin** | All activities (all opportunities) |
| **Manager** | Own opportunities + subordinate opportunities |
| **Account Manager** | Only own opportunities |
| **Product Director** | Opportunities in their product line/department |

### Inheritance Chain

```
CEO sets GP target for PD
  ↓
PD assigns project to AM
  ↓
AM creates opportunity in Odoo
  ↓
Opportunity syncs (visible to: AM, PD, AM's manager)
  ↓
Activity created on opportunity
  ↓
Activity inherits visibility: (AM, PD, AM's manager)
  ↓
Everyone who can see opportunity can see its activities
```

---

## 🔄 COMPLETE DATA FLOW WITH AUTHORIZATION

```
┌─────────────────────────────────────────────────┐
│ ODOO                                            │
│  mail.activity (res_id=9) → crm.lead (id=9)    │
└────────────────┬────────────────────────────────┘
                 │
                 │ Sync
                 ↓
┌─────────────────────────────────────────────────┐
│ RAW ZONE                                        │
│  odoo_raw_data (activity, res_id=9)            │
└────────────────┬────────────────────────────────┘
                 │
                 │ Generate Event
                 ↓
┌─────────────────────────────────────────────────┐
│ EVENT STORE                                     │
│  OdooActivitySynced (res_id=9, user_id=10)     │
└────────────────┬────────────────────────────────┘
                 │
                 │ ActivityProjection
                 ↓
┌─────────────────────────────────────────────────┐
│ SERVING ZONE (CQRS)                            │
│  opportunity_view (odoo_id=9)                   │
│    visible_to_user_ids: [vinsha, manager, admin]│
│                                                 │
│  activity_view (opportunity.odoo_id=9)          │
│    visible_to_user_ids: [vinsha, manager, admin]│
│    ↑ INHERITED FROM OPPORTUNITY! ↑              │
└────────────────┬────────────────────────────────┘
                 │
                 │ API Query
                 ↓
┌─────────────────────────────────────────────────┐
│ API ENDPOINT                                    │
│  GET /api/activities                           │
│  WHERE visible_to_user_ids contains current_user│
└────────────────┬────────────────────────────────┘
                 │
                 │ Response
                 ↓
┌─────────────────────────────────────────────────┐
│ FRONTEND                                        │
│  Activity Timeline Page                         │
│  Shows: Only authorized activities              │
└─────────────────────────────────────────────────┘
```

---

## 💡 KEY INSIGHTS

### Why This Approach Works

**1. Single Authorization Point:**
- Opportunity visibility is already solved (working perfectly)
- Activities simply reuse the same logic
- No duplicate authorization code

**2. Automatic Manager Visibility:**
- Opportunities include managers in visible_to
- Activities inherit this
- Managers automatically see team activities

**3. Performance:**
- Pre-computed visible_to_user_ids
- O(1) lookup (no complex queries)
- Fast activity filtering

**4. Maintainability:**
- Change opportunity visibility → activities update automatically
- Single place to manage access rules
- Clear inheritance chain

---

## 🧪 TESTING CHECKLIST

### After Implementation:

**1. Verify Linking:**
```python
# For each activity in activity_view:
for activity in activities:
    opp_id = activity["opportunity"]["odoo_id"]
    
    # Verify opportunity exists
    opp = await db.opportunity_view.find_one({"odoo_id": opp_id})
    assert opp is not None
    
    # Verify visibility inherited
    assert activity["visible_to_user_ids"] == opp["visible_to_user_ids"]
```

**2. Test Manager Visibility:**
```bash
# Login as Vinsha (Manager)
GET /api/activities

# Should return:
# - Her own activities
# - Zakariya's activities (subordinate)

# Login as Zakariya
GET /api/activities

# Should return:
# - Only his own activities
# - NOT Vinsha's activities
```

**3. Test Authorization:**
```python
# Attempt unauthorized access
# User A tries to access activity on User B's opportunity
# Should: Return 0 activities (filtered out by visible_to_user_ids)
```

---

## 📝 SUMMARY

**How Activities Link to Authorized Users:**

1. **Direct Link:** Activity.res_id → Opportunity.odoo_id
2. **Authorization:** Copy visible_to_user_ids from Opportunity
3. **Manager Visibility:** Automatically inherited (already in opportunity visibility)
4. **API Filter:** `WHERE visible_to_user_ids contains current_user_id`
5. **Result:** Secure, performant, maintains manager hierarchy

**This is the CQRS way:** 
- Pre-compute everything (visible_to_user_ids)
- Denormalize relationships (opportunity data in activity)
- Query is simple (single field lookup)
- Security is guaranteed (can't access without being in array)

---

**Implementation Status:** Documented in UAT-006  
**Ready to Build:** Yes (all design decisions made)  
**Estimated Effort:** 6 hours (including testing)
