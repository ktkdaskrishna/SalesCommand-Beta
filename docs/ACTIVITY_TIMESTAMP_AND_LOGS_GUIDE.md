# 📅 Activity Timestamp & Odoo Logs Sync Guide

**Date:** January 17, 2026  
**Topic:** Activity Due Dates & Chatter Log Synchronization

---

## 🎯 TIMESTAMP ISSUE EXPLAINED

### Problem You're Experiencing

**Dashboard shows all 0s:**
- Overdue: 0
- Due Today: 0
- Upcoming: 0
- Completed: 0

**Root Cause:** Activities in Odoo have **NO due dates set** (`date_deadline: null`)

### Verification

**From Database:**
```
Activity: "Document"
  date_deadline (Odoo): None
  state: overdue  ← But can't be overdue if no due date!

Activity: "SUPREME JUDICIARY COUNCIL's opportunity"  
  date_deadline (Odoo): None
  state: today  ← But no date to calculate "today"
```

**The Issue:**
- Activities exist in Odoo (mail.activity records)
- But `date_deadline` field is NULL
- Dashboard can't categorize by date if no dates exist
- All counts show 0 because grouping logic requires due_date

---

## 🔧 HOW TO FIX IN ODOO

### Set Due Dates for Activities

**In Odoo UI:**
1. Go to the opportunity (e.g., "TEST VM")
2. Click "Activity" button (top right)
3. When creating/editing activity:
   - ✅ Set "Due Date" field
   - ✅ Choose date (e.g., "Jan 20, 2026")
4. Save activity

**Result:**
```javascript
// Activity with due date
{
  id: 1,
  summary: "Follow up call",
  date_deadline: "2026-01-20",  // ← Now has date!
  state: "planned"
}
```

**After Sync:**
- Our app will calculate:
  - If date < today → Overdue
  - If date == today → Due Today
  - If date > today → Upcoming
- Dashboard counts will populate

---

## 📊 ODOO COMMUNICATION TYPES

### 1. Activities (mail.activity) - Scheduled Tasks

**What:** Future-oriented tasks with due dates
**Examples:** 
- "Follow up call on Jan 20"
- "Send proposal by Friday"
- "Schedule demo next week"

**Odoo Model:** `mail.activity`

**Key Fields:**
- `summary`: Task title
- `date_deadline`: **Due date** (required for dashboard grouping)
- `state`: planned/done/overdue
- `res_model`: crm.lead (opportunity)
- `res_id`: Opportunity ID

**Current Sync:** ✅ **WORKING** (synced to data_lake_serving)

---

### 2. Chatter Logs (mail.message) - Communication History

**What:** Past communication and events
**Examples:**
- "Lead/Opportunity created" (Jan 12, 2:09 AM)
- "VM → TEST 123 (Company Name)" (Jan 13, 11:26 PM)
- Email sent/received
- Notes logged
- Status changes

**Odoo Model:** `mail.message`

**Key Fields:**
- `body`: Message content (HTML)
- `date`: When posted
- `message_type`: email, comment, notification
- `author_id`: Who posted
- `res_model`: crm.lead
- `res_id`: Opportunity ID

**Current Sync:** ❌ **NOT IMPLEMENTED** (not syncing yet)

---

## 🔄 HOW TO SYNC ODOO CHATTER LOGS

### Step 1: Add Connector Method

**File:** `backend/integrations/odoo/connector.py`

```python
async def fetch_messages(self, res_model: str = None, res_ids: List[int] = None) -> List[Dict[str, Any]]:
    """
    Fetch chatter messages/logs from Odoo.
    
    Args:
        res_model: Filter by model (e.g., 'crm.lead')
        res_ids: Filter by specific record IDs
    
    Returns:
        List of mail.message records
    """
    fields = [
        'id', 'body', 'date', 'message_type', 'subtype_id',
        'author_id', 'email_from', 'subject',
        'res_model', 'res_id', 'record_name'
    ]
    
    # Build domain
    domain = []
    if res_model:
        domain.append(('model', '=', res_model))
    if res_ids:
        domain.append(('res_id', 'in', res_ids))
    
    # Fetch messages
    records = await self.models.execute_kw(
        'mail.message',
        'search_read',
        [domain],
        {'fields': fields, 'limit': 10000, 'order': 'date desc'}
    )
    
    logger.info(f"Fetched {len(records)} messages from Odoo")
    return records
```

### Step 2: Add to Sync Pipeline

**File:** `backend/services/odoo/sync_pipeline.py`

```python
async def sync_data_lake(self, user_id: str):
    """Enhanced sync including chatter logs"""
    
    # ... existing sync code ...
    
    # NEW: Sync chatter messages
    try:
        # Fetch messages for opportunities
        messages = await connector.fetch_messages(
            res_model='crm.lead'
        )
        
        for msg in messages:
            serving_doc = {
                "entity_type": "message",  # NEW entity type
                "serving_id": f"odoo_message_{msg.get('id')}",
                "source": "odoo",
                "last_aggregated": datetime.now(timezone.utc).isoformat(),
                "data": msg,
                "is_active": True
            }
            
            await self.db.data_lake_serving.update_one(
                {"serving_id": serving_doc["serving_id"]},
                {"$set": serving_doc},
                upsert=True
            )
        
        synced_entities["messages"] = len(messages)
        logger.info(f"Synced {len(messages)} chatter messages")
        
    except Exception as e:
        error_msg = f"Message sync error: {str(e)}"
        errors.append(error_msg)
        logger.error(error_msg)
```

### Step 3: Create API Endpoint

**File:** `backend/routes/sales.py`

```python
@router.get("/opportunities/{opp_id}/messages")
async def get_opportunity_messages(
    opp_id: str,
    token_data: dict = Depends(require_approved())
):
    """
    Get chatter messages for an opportunity.
    Shows communication history, notes, emails.
    """
    db = Database.get_db()
    
    # Convert to int for Odoo ID matching
    try:
        opp_odoo_id = int(opp_id)
    except:
        opp_odoo_id = opp_id
    
    # Query messages from data_lake_serving
    message_docs = await db.data_lake_serving.find({
        "entity_type": "message",
        "is_active": True,
        "data.res_model": "crm.lead",
        "data.res_id": opp_odoo_id
    }).sort([("data.date", -1)]).to_list(100)
    
    messages = []
    for doc in message_docs:
        msg = doc.get("data", {})
        
        # Extract author
        author = msg.get("author_id")
        author_name = author[1] if isinstance(author, list) and len(author) > 1 else "System"
        
        messages.append({
            "id": msg.get("id"),
            "body": msg.get("body", ""),  # HTML content
            "date": msg.get("date"),
            "message_type": msg.get("message_type"),
            "author_name": author_name,
            "email_from": msg.get("email_from"),
            "subject": msg.get("subject"),
        })
    
    return {
        "messages": messages,
        "count": len(messages)
    }
```

### Step 4: Display in Frontend

**Component:** `frontend/src/components/OpportunityDetailPanel.js`

**Add new tab:**
```javascript
<Tab active={activeTab === 'chatter'} onClick={() => setActiveTab('chatter')}>
  Communication History
</Tab>

{/* Chatter Tab */}
{activeTab === 'chatter' && (
  <div className="space-y-3">
    {messages.map(msg => (
      <div key={msg.id} className="border-l-4 border-indigo-300 bg-slate-50 p-4 rounded">
        <div className="flex items-center gap-2 mb-2">
          <User className="w-4 h-4 text-slate-500" />
          <span className="font-medium">{msg.author_name}</span>
          <span className="text-xs text-slate-400">
            {formatDate(msg.date)}
          </span>
        </div>
        <div 
          className="text-sm text-slate-700"
          dangerouslySetInnerHTML={{ __html: msg.body }}
        />
      </div>
    ))}
  </div>
)}
```

---

## 🎯 DASHBOARD DATE GROUPING LOGIC

### Current Implementation

**File:** `backend/api/v2_activities.py` - `get_activity_dashboard_summary()`

```python
for activity in activities:
    due_date_str = activity.get("due_date")
    
    if due_date_str and status != "done":
        due_date = datetime.fromisoformat(due_date_str)
        now = datetime.now(timezone.utc)
        
        if due_date < now:
            summary["overdue"] += 1      # Past due
        elif due_date.date() == now.date():
            summary["due_today"] += 1    # Today
        else:
            summary["upcoming"] += 1     # Future
```

**Why All Counts Are 0:**
- ✅ Activities exist (2 activities)
- ❌ But `due_date` is NULL for both
- ❌ `if due_date_str` check fails
- ❌ Nothing gets counted

**Solution:**
- Set due dates in Odoo for activities
- OR display activities without dates in a separate category

---

## 🔧 RECOMMENDED FIXES

### Fix 1: Handle Activities Without Due Dates

**File:** `backend/api/v2_activities.py`

```python
summary = {
    "total": len(activities),
    "overdue": 0,
    "due_today": 0,
    "upcoming": 0,
    "completed": 0,
    "no_due_date": 0,  # NEW: Activities without dates
    "by_type": {},
    "by_status": {}
}

for activity in activities:
    # Count completed
    if activity.get("state") == "done":
        summary["completed"] += 1
        continue
    
    due_date_str = activity.get("due_date")
    
    if not due_date_str:
        summary["no_due_date"] += 1  # NEW: Track dateless activities
        continue
    
    # Existing date grouping logic
    due_date = datetime.fromisoformat(due_date_str)
    now = datetime.now(timezone.utc)
    
    if due_date < now:
        summary["overdue"] += 1
    elif due_date.date() == now.date():
        summary["due_today"] += 1
    else:
        summary["upcoming"] += 1
```

### Fix 2: Display "No Due Date" Category

**Frontend:** Add card for dateless activities

```javascript
<div className="card p-4 border-2 bg-slate-50 border-slate-200">
  <div className="flex items-center justify-between mb-2">
    <Calendar className="w-6 h-6 text-slate-600" />
    <span className="text-3xl font-bold">{stats.no_due_date}</span>
  </div>
  <p className="font-semibold text-sm">No Due Date</p>
  <p className="text-xs text-slate-500">Set dates in Odoo</p>
</div>
```

---

## 📊 ODOO ACTIVITY vs MESSAGE COMPARISON

| Feature | mail.activity (Tasks) | mail.message (Chatter) |
|---------|----------------------|------------------------|
| **Purpose** | Future tasks/to-dos | Past communication |
| **Direction** | Forward-looking | Historical |
| **Examples** | "Call customer Mon" | "Email sent Jan 12" |
| **Has Due Date** | Yes (date_deadline) | No (only posted date) |
| **Model** | mail.activity | mail.message |
| **Odoo UI** | "Activity" button | Chatter timeline |
| **Our Sync** | ✅ Synced | ❌ Not synced yet |
| **Display In** | Activity page | Not displayed yet |

---

## 🚀 QUICK WIN: Sync Odoo Chatter Logs

### Implementation Steps (30 minutes)

**1. Add fetch_messages to connector** (10 min)
**2. Add to sync_pipeline** (10 min)
**3. Create API endpoint** (10 min)

**Estimated Total:** 30 minutes

**Result:**
- Full communication history visible
- See "Lead created", state changes, emails
- Complete audit trail from Odoo

---

## 🎯 RECOMMENDATIONS

### Short-Term (Immediate):

**Option A: Fix in Odoo (Recommended)**
1. Go to each activity in Odoo
2. Click "Activity" button
3. Set "Due Date" for each task
4. Sync will pick up dates
5. Dashboard will populate

**Option B: Handle NULL Dates**
1. Add "No Due Date" category to dashboard
2. Show these activities separately
3. Remind users to set dates

### Medium-Term:

**Implement Chatter Sync:**
1. Sync mail.message records
2. Display in opportunity detail panel
3. Show full communication timeline
4. Better context for sales decisions

---

## 📋 CURRENT STATE SUMMARY

**What's Working:**
- ✅ Activities syncing from Odoo (mail.activity)
- ✅ Linked to opportunities (res_model/res_id)
- ✅ Showing on Activity page (Document, Meeting)
- ✅ System events filtered out
- ✅ Full details visible (assignee, opportunity, notes)

**What's Missing:**
- ❌ Due dates (NULL in Odoo data)
- ❌ Dashboard date grouping (needs due dates)
- ❌ Chatter logs (mail.message not synced yet)

**Impact:**
- Activities display but can't be grouped by urgency
- No historical communication trail

---

## 🎓 UNDERSTANDING THE STRUCTURE

### Activity Lifecycle in Odoo:

```
1. USER CREATES ACTIVITY
   Odoo UI: Click "Activity" button → Schedule task
   Fields: Summary, Due Date, Type, Assignee
   
2. SAVED AS mail.activity
   {
     summary: "Follow up call",
     date_deadline: "2026-01-20",  ← Due date
     user_id: [7, "Zakariya"],
     res_model: "crm.lead",
     res_id: 9
   }

3. SYNCED TO OUR APP
   OdooConnector → data_lake_serving → activity_view
   
4. DISPLAYED IN UI
   - Activity page: Shows all activities
   - Opportunity card: Shows count
   - Dashboard: Groups by due date (if exists)
```

### Message Lifecycle in Odoo:

```
1. USER POSTS MESSAGE
   Odoo UI: Chatter → "Send message" or "Log note"
   Content: Free text, can include HTML
   
2. SAVED AS mail.message
   {
     body: "Customer interested in premium package",
     date: "2026-01-15 14:30:00",
     author_id: [7, "Zakariya"],
     res_model: "crm.lead",
     res_id: 9
   }

3. NOT YET SYNCED TO OUR APP
   Would need: connector method + sync pipeline update
   
4. WOULD DISPLAY IN
   Opportunity detail panel → "Communication History" tab
```

---

## 🔍 TROUBLESHOOTING

### Q: "Why is dashboard showing all 0s?"

**A:** Activities have no due dates in Odoo. 

**Check:**
```sql
SELECT id, summary, date_deadline 
FROM mail_activity 
WHERE res_model = 'crm.lead';
```

**If date_deadline is NULL:** Set dates in Odoo or handle NULL in code.

---

### Q: "How to see Odoo chatter history in app?"

**A:** Not implemented yet. Need to:
1. Add `fetch_messages()` to OdooConnector
2. Sync mail.message to data_lake_serving
3. Create API endpoint
4. Display in opportunity detail panel

**Estimated effort:** 1-2 hours

---

### Q: "Why do some activities show 'overdue' state but due_date is NULL?"

**A:** State mismatch between Odoo and our calculation:
- Odoo sets state based on its own logic
- Our app calculates based on due_date
- If due_date is NULL, can't calculate properly

**Fix:** Use Odoo's state field or ensure due_date exists

---

## ✅ IMMEDIATE ACTION ITEMS

### To Fix Dashboard Counts:

**1. Set Due Dates in Odoo** (5 minutes)
- Open each activity
- Set date_deadline field
- Sync again

**2. OR Handle NULL Dates in Code** (15 minutes)
- Add "no_due_date" category
- Display separately
- Don't fail on NULL

### To Add Chatter Logs:

**1. Implement fetch_messages** (30 minutes)
- Add to OdooConnector
- Add to sync pipeline
- Create API endpoint

**2. Display in UI** (30 minutes)
- Add tab to OpportunityDetailPanel
- Show message timeline
- Format HTML content

---

**Document End**

**Next Steps:** Choose one approach and I'll implement it immediately!
