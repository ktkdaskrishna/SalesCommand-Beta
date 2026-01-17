# 🏗️ OPTION C: Full CQRS Architecture Redesign
## Modern Sales Intelligence Platform - Production-Grade Design

**Architecture Pattern:** CQRS + Event Sourcing + Materialized Views  
**Estimated Implementation:** 2-3 days  
**Status:** DESIGN PHASE  
**Last Updated:** 2025-01-15

---

## 📐 ARCHITECTURE OVERVIEW

### CQRS Pattern for Sales Intelligence

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        COMMAND SIDE (Write Model)                        │
├─────────────────────────────────────────────────────────────────────────┤
│  User Actions → Commands → Handlers → Events → Event Store             │
│                                                                          │
│  Examples:                                                               │
│   • UpdateUserCommand                                                   │
│   • SyncOdooDataCommand                                                │
│   • AssignOpportunityCommand                                            │
│                                                                          │
│  Collections:                                                            │
│   • events (immutable event log)                                        │
│   • commands_in_progress (idempotency)                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Event Processors
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                        QUERY SIDE (Read Model)                          │
├─────────────────────────────────────────────────────────────────────────┤
│  Materialized Views ← Event Projections ← Events                       │
│                                                                          │
│  Optimized Collections:                                                  │
│   • user_profiles (denormalized user + hierarchy)                      │
│   • opportunity_view (with relationships pre-joined)                   │
│   • dashboard_metrics (pre-computed KPIs)                              │
│   • user_access_matrix (what each user can see)                       │
│                                                                          │
│  APIs read ONLY from these optimized views                             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ NEW DATABASE SCHEMA

### Write Side Collections

#### 1. `events` (Event Store - Source of Truth)
```javascript
{
  id: "uuid",
  event_type: "OdooUserSynced",           // Event name
  aggregate_type: "User",                  // Entity type
  aggregate_id: "user-123",                // Entity ID
  
  payload: {                               // Event data
    odoo_user_id: 10,
    odoo_employee_id: 4,
    manager_odoo_id: 1,
    email: "vinsha.nair@securado.net",
    name: "Vinsha Nair"
  },
  
  metadata: {
    user_id: "admin-uuid",                 // Who triggered
    source: "odoo_sync",                   // Where from
    correlation_id: "sync-job-456",        // For tracing
  },
  
  timestamp: Date,                         // When
  version: 1,                              // For optimistic locking
  
  processed_by: ["UserProfileProjection", "AccessMatrixProjection"]  // Track projections
}

// Indexes
createIndex({ "aggregate_type": 1, "aggregate_id": 1, "version": 1 })
createIndex({ "event_type": 1, "timestamp": 1 })
createIndex({ "timestamp": 1 })  // For event replay
```

**Event Types:**
- `OdooUserSynced` - User data from Odoo
- `OdooOpportunitySynced` - Opportunity data
- `UserLoggedIn` - Login event
- `ManagerAssigned` - Hierarchy change
- `OpportunityAssigned` - Salesperson change

#### 2. `odoo_raw_data` (Immutable Source Data)
```javascript
{
  id: "uuid",
  entity_type: "opportunity",
  odoo_id: 123,                            // Original Odoo ID
  raw_data: { ...complete Odoo record },   // Unmodified
  fetched_at: Date,
  sync_job_id: "sync-456",
  is_latest: true,                         // Only latest = true
  checksum: "sha256hash"                   // Detect changes
}

// Indexes
createIndex({ "entity_type": 1, "odoo_id": 1, "is_latest": 1 })
```

### Read Side Collections (Materialized Views)

#### 3. `user_profiles` (Denormalized User View)
```javascript
{
  // PRIMARY IDENTITY
  id: "uuid",                              // App UUID
  email: "vinsha.nair@securado.net",
  
  // AUTHENTICATION
  password_hash: "...",
  ms_id: "...",
  auth_provider: "microsoft",
  
  // PROFILE
  name: "Vinsha Nair",
  job_title: "Sales Director",
  department: {
    id: "dept-uuid",
    name: "Sales",
    odoo_id: 2
  },
  
  // ODOO LINKAGE (denormalized)
  odoo: {
    user_id: 10,                           // res.users ID
    employee_id: 4,                        // hr.employee ID
    salesperson_name: "vinsha Nair",
    team_id: 5,
    team_name: "Enterprise Sales"
  },
  
  // HIERARCHY (denormalized)
  hierarchy: {
    manager: {
      odoo_employee_id: 1,
      name: "Manager Name",
      email: "manager@domain.com"
    },
    subordinates: [                        // Pre-computed!
      {
        odoo_employee_id: 3,
        odoo_user_id: 7,
        name: "Zakariya",
        email: "z.albaloushi@securado.net"
      }
    ],
    reports_count: 1,
    is_manager: true
  },
  
  // PERMISSIONS (pre-computed)
  permissions: {
    can_see_opportunity_ids: [123, 456, 789],  // Pre-computed list!
    can_see_account_ids: [10, 20],
    data_scope: "team"
  },
  
  // METADATA
  last_login: Date,
  last_sync: Date,
  version: 5                               // For optimistic locking
}

// Indexes
createIndex({ "email": 1 }, { unique: true })
createIndex({ "odoo.user_id": 1 })
createIndex({ "odoo.employee_id": 1 })
createIndex({ "hierarchy.manager.odoo_employee_id": 1 })
```

#### 4. `opportunity_view` (Denormalized Opportunity)
```javascript
{
  id: "uuid",                              // App UUID
  odoo_id: 123,                            // Original Odoo ID
  
  // BASIC INFO
  name: "Ministry of Information Deal",
  stage: "negotiation",
  value: 100000,
  probability: 75,
  expected_close_date: Date,
  
  // RELATIONSHIPS (denormalized - no joins needed!)
  salesperson: {
    user_id: "uuid",                       // App user UUID
    odoo_user_id: 7,
    odoo_employee_id: 3,
    name: "Zakariya",
    email: "z.albaloushi@securado.net",
    
    // Include manager for hierarchy queries
    manager: {
      odoo_employee_id: 4,
      name: "Vinsha Nair",
      email: "vinsha.nair@securado.net"
    }
  },
  
  account: {
    odoo_id: 456,
    name: "Ministry of Information",
    city: "Muscat"
  },
  
  // ACCESS CONTROL (pre-computed!)
  visible_to_user_ids: [                   // Pre-calculated visibility!
    "zakariya-uuid",                       // Owner
    "vinsha-uuid",                         // Manager
    "admin-uuid"                           // Admin
  ],
  
  // METADATA
  source: "odoo",
  last_synced: Date,
  version: 3
}

// Indexes
createIndex({ "odoo_id": 1 }, { unique: true })
createIndex({ "salesperson.odoo_user_id": 1 })
createIndex({ "visible_to_user_ids": 1 })  // Fast access control!
createIndex({ "stage": 1, "salesperson.user_id": 1 })
```

#### 5. `dashboard_metrics` (Pre-computed KPIs)
```javascript
{
  user_id: "uuid",
  computed_at: Date,
  
  // Pre-calculated metrics
  pipeline_value: 250000,
  won_revenue: 50000,
  active_opportunities: 4,
  
  // By stage
  by_stage: {
    "negotiation": { count: 2, value: 200000 },
    "proposal": { count: 1, value: 50000 }
  },
  
  // Team metrics (for managers)
  team_metrics: {
    team_pipeline: 500000,
    team_won: 100000,
    top_performers: [...]
  },
  
  ttl: 300  // Refresh every 5 minutes
}

// TTL Index (auto-delete old metrics)
createIndex({ "computed_at": 1 }, { expireAfterSeconds: 600 })
```

#### 6. `user_access_matrix` (Security Cache)
```javascript
{
  user_id: "uuid",
  
  // What this user can access
  accessible_opportunities: [123, 456, 789],
  accessible_accounts: [10, 20, 30],
  accessible_users: ["uuid1", "uuid2"],  // For manager views
  
  // Hierarchy context
  is_manager: true,
  subordinate_count: 5,
  managed_team_ids: [5],
  
  // Refresh metadata
  computed_at: Date,
  ttl: 300
}

// TTL Index
createIndex({ "computed_at": 1 }, { expireAfterSeconds: 600 })
createIndex({ "user_id": 1 }, { unique: true })
```

---

## 🔄 DATA FLOW WITH CQRS

### Sync Flow (Command Side)

```
1. TRIGGER: Background job runs every 5 minutes
    ↓
2. FETCH: OdooConnector.fetch_opportunities()
    ↓
3. STORE RAW: Save to odoo_raw_data (immutable)
    ↓
4. COMPARE: Check against previous version (by checksum)
    ↓
5. GENERATE EVENTS:
   - If new: OdooOpportunityCreated
   - If changed: OdooOpportunityUpdated
   - If missing: OdooOpportunityDeleted
    ↓
6. PERSIST EVENTS: Save to events collection
    ↓
7. PUBLISH: Send to event bus
    ↓
8. PROJECTIONS: Update materialized views
```

### Query Flow (Query Side)

```
User requests dashboard
    ↓
GET /api/sales/dashboard
    ↓
Read from dashboard_metrics (pre-computed!)
    ↓
Read from opportunity_view WHERE visible_to_user_ids contains user_id
    ↓
Return in <200ms
```

---

## 💻 NEW CODE STRUCTURE

### Directory Layout

```
/app/backend/
├── domain/                          # Business logic (write side)
│   ├── commands/
│   │   ├── sync_odoo.py            # SyncOdooCommand
│   │   ├── assign_opportunity.py   # AssignOpportunityCommand
│   │   └── update_hierarchy.py     # UpdateHierarchyCommand
│   ├── events/
│   │   ├── user_events.py          # OdooUserSynced, etc.
│   │   ├── opportunity_events.py
│   │   └── hierarchy_events.py
│   ├── handlers/
│   │   ├── sync_handler.py         # Process sync commands
│   │   └── assignment_handler.py
│   └── aggregates/
│       ├── user.py                  # User aggregate root
│       └── opportunity.py
│
├── projections/                     # Read side builders
│   ├── user_profile_projection.py  # Builds user_profiles
│   ├── opportunity_projection.py   # Builds opportunity_view
│   ├── access_matrix_projection.py # Builds user_access_matrix
│   └── metrics_projection.py       # Builds dashboard_metrics
│
├── queries/                         # Read side queries
│   ├── user_queries.py             # Query user_profiles
│   ├── dashboard_queries.py        # Query dashboard_metrics
│   └── opportunity_queries.py
│
├── event_store/
│   ├── store.py                    # Event persistence
│   ├── publisher.py                # Event bus
│   └── replay.py                   # Rebuild projections
│
├── sync/                           # Odoo integration
│   ├── odoo_connector.py          # Fetch from Odoo
│   ├── sync_coordinator.py        # Orchestrate sync
│   └── change_detector.py         # Detect what changed
│
└── api/                            # FastAPI routes
    ├── commands/
    │   └── sync_api.py            # POST endpoints (writes)
    └── queries/
        └── dashboard_api.py       # GET endpoints (reads)
```

---

## 🔨 IMPLEMENTATION PLAN

### DAY 1: Event Store & Core Infrastructure

#### 1.1 Event Store Implementation
**File:** `/app/backend/event_store/store.py`

```python
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import uuid

class Event:
    def __init__(self, event_type: str, aggregate_id: str, payload: dict):
        self.id = str(uuid.uuid4())
        self.event_type = event_type
        self.aggregate_type = payload.get('_aggregate_type', 'Unknown')
        self.aggregate_id = aggregate_id
        self.payload = payload
        self.timestamp = datetime.now(timezone.utc)
        self.version = 1
        self.processed_by = []
    
    def to_dict(self):
        return {
            "id": self.id,
            "event_type": self.event_type,
            "aggregate_type": self.aggregate_type,
            "aggregate_id": self.aggregate_id,
            "payload": self.payload,
            "timestamp": self.timestamp,
            "version": self.version,
            "processed_by": self.processed_by
        }


class EventStore:
    def __init__(self, db):
        self.db = db
        self.collection = db.events
    
    async def append(self, event: Event) -> str:
        """Append event to store (immutable)"""
        doc = event.to_dict()
        await self.collection.insert_one(doc)
        return event.id
    
    async def get_events_for_aggregate(
        self, 
        aggregate_type: str, 
        aggregate_id: str
    ) -> List[Event]:
        """Get all events for an aggregate (for rebuilding state)"""
        cursor = self.collection.find({
            "aggregate_type": aggregate_type,
            "aggregate_id": aggregate_id
        }).sort("version", 1)
        
        events = []
        async for doc in cursor:
            events.append(Event(
                event_type=doc["event_type"],
                aggregate_id=doc["aggregate_id"],
                payload=doc["payload"]
            ))
        return events
    
    async def get_events_since(self, since: datetime) -> List[Event]:
        """Get all events after timestamp (for projections)"""
        cursor = self.collection.find({
            "timestamp": {"$gte": since}
        }).sort("timestamp", 1)
        
        events = []
        async for doc in cursor:
            events.append(doc)
        return events
    
    async def mark_event_processed(
        self, 
        event_id: str, 
        projection_name: str
    ):
        """Mark event as processed by a projection"""
        await self.collection.update_one(
            {"id": event_id},
            {"$addToSet": {"processed_by": projection_name}}
        )
```

#### 1.2 Event Publisher
**File:** `/app/backend/event_store/publisher.py`

```python
from typing import Callable, List, Dict
import asyncio
import logging

logger = logging.getLogger(__name__)

class EventBus:
    def __init__(self):
        self._subscribers: Dict[str, List[Callable]] = {}
    
    def subscribe(self, event_type: str, handler: Callable):
        """Subscribe to an event type"""
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(handler)
        logger.info(f"Subscribed {handler.__name__} to {event_type}")
    
    async def publish(self, event: Event):
        """Publish event to all subscribers"""
        handlers = self._subscribers.get(event.event_type, [])
        
        logger.info(f"Publishing {event.event_type} to {len(handlers)} handlers")
        
        # Call all handlers in parallel
        tasks = [handler(event) for handler in handlers]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Log any errors
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Handler {handlers[i].__name__} failed: {result}")
        
        return results

# Global event bus
event_bus = EventBus()
```

#### 1.3 Base Projection
**File:** `/app/backend/projections/base.py`

```python
from abc import ABC, abstractmethod
from datetime import datetime, timezone

class BaseProjection(ABC):
    def __init__(self, db, projection_name: str):
        self.db = db
        self.projection_name = projection_name
        self.event_store = None  # Set by framework
    
    @abstractmethod
    async def handle(self, event: Event):
        """Process an event and update read model"""
        pass
    
    @abstractmethod
    def subscribes_to(self) -> List[str]:
        """List of event types this projection handles"""
        pass
    
    async def mark_processed(self, event_id: str):
        """Mark event as processed"""
        if self.event_store:
            await self.event_store.mark_event_processed(
                event_id, 
                self.projection_name
            )
    
    async def rebuild_from_events(
        self, 
        since: Optional[datetime] = None
    ):
        """Rebuild projection from event store"""
        if not self.event_store:
            raise RuntimeError("EventStore not set")
        
        events = await self.event_store.get_events_since(
            since or datetime.min.replace(tzinfo=timezone.utc)
        )
        
        for event in events:
            if event["event_type"] in self.subscribes_to():
                await self.handle(Event.from_dict(event))
```

---

### DAY 2: Projections & Materialized Views

#### 2.1 User Profile Projection
**File:** `/app/backend/projections/user_profile_projection.py`

```python
from projections.base import BaseProjection

class UserProfileProjection(BaseProjection):
    def __init__(self, db):
        super().__init__(db, "UserProfileProjection")
        self.collection = db.user_profiles
    
    def subscribes_to(self) -> List[str]:
        return [
            "OdooUserSynced",
            "UserLoggedIn",
            "ManagerAssigned",
            "UserRoleChanged"
        ]
    
    async def handle(self, event: Event):
        """Update user_profiles materialized view"""
        if event.event_type == "OdooUserSynced":
            await self._handle_odoo_user_synced(event)
        elif event.event_type == "ManagerAssigned":
            await self._handle_manager_assigned(event)
    
    async def _handle_odoo_user_synced(self, event: Event):
        """Process OdooUserSynced event"""
        payload = event.payload
        email = payload.get("email")
        
        if not email:
            return
        
        # Build hierarchy (find subordinates)
        subordinates = await self.db.user_profiles.find({
            "hierarchy.manager.odoo_employee_id": payload.get("odoo_employee_id")
        }, {
            "id": 1, 
            "email": 1, 
            "name": 1,
            "odoo.user_id": 1,
            "odoo.employee_id": 1
        }).to_list(100)
        
        # Build manager info
        manager = None
        if payload.get("manager_odoo_id"):
            manager_doc = await self.db.user_profiles.find_one({
                "odoo.employee_id": payload.get("manager_odoo_id")
            })
            if manager_doc:
                manager = {
                    "odoo_employee_id": manager_doc["odoo"]["employee_id"],
                    "name": manager_doc["name"],
                    "email": manager_doc["email"]
                }
        
        # Upsert user profile
        await self.collection.update_one(
            {"email": email},
            {
                "$set": {
                    "name": payload.get("name"),
                    "odoo": {
                        "user_id": payload.get("odoo_user_id"),
                        "employee_id": payload.get("odoo_employee_id"),
                        "salesperson_name": payload.get("name"),
                        "team_id": payload.get("team_id"),
                        "team_name": payload.get("team_name")
                    },
                    "hierarchy": {
                        "manager": manager,
                        "subordinates": [
                            {
                                "odoo_employee_id": s.get("odoo", {}).get("employee_id"),
                                "odoo_user_id": s.get("odoo", {}).get("user_id"),
                                "name": s.get("name"),
                                "email": s.get("email")
                            }
                            for s in subordinates
                        ],
                        "reports_count": len(subordinates),
                        "is_manager": len(subordinates) > 0
                    },
                    "last_sync": datetime.now(timezone.utc),
                    "version": {"$inc": 1}
                },
                "$setOnInsert": {
                    "id": str(uuid.uuid4()),
                    "email": email,
                    "created_at": datetime.now(timezone.utc)
                }
            },
            upsert=True
        )
        
        await self.mark_processed(event.id)
```

#### 2.2 Opportunity Projection
**File:** `/app/backend/projections/opportunity_projection.py`

```python
class OpportunityProjection(BaseProjection):
    def __init__(self, db):
        super().__init__(db, "OpportunityProjection")
        self.collection = db.opportunity_view
    
    def subscribes_to(self) -> List[str]:
        return [
            "OdooOpportunitySynced",
            "OpportunityAssigned",
            "OpportunityStageChanged"
        ]
    
    async def handle(self, event: Event):
        if event.event_type == "OdooOpportunitySynced":
            await self._handle_opportunity_synced(event)
    
    async def _handle_opportunity_synced(self, event: Event):
        """Build denormalized opportunity with all relationships"""
        payload = event.payload
        odoo_id = payload.get("id")
        
        # Find salesperson
        salesperson = None
        visible_to = []
        
        sp_odoo_id = payload.get("salesperson_id")
        if sp_odoo_id:
            # Find user by odoo_user_id
            sp_user = await self.db.user_profiles.find_one({
                "odoo.user_id": sp_odoo_id
            })
            
            if sp_user:
                salesperson = {
                    "user_id": sp_user["id"],
                    "odoo_user_id": sp_user["odoo"]["user_id"],
                    "odoo_employee_id": sp_user["odoo"]["employee_id"],
                    "name": sp_user["name"],
                    "email": sp_user["email"],
                    "manager": sp_user.get("hierarchy", {}).get("manager")
                }
                
                # Owner can see
                visible_to.append(sp_user["id"])
                
                # Manager can see
                if salesperson["manager"]:
                    manager_user = await self.db.user_profiles.find_one({
                        "odoo.employee_id": salesperson["manager"]["odoo_employee_id"]
                    })
                    if manager_user:
                        visible_to.append(manager_user["id"])
        
        # Add all admins to visible_to
        admins = await self.db.user_profiles.find(
            {"is_super_admin": True}
        ).to_list(100)
        visible_to.extend([a["id"] for a in admins])
        
        # Find account info
        account = None
        partner_id = payload.get("partner_id")
        if partner_id:
            acc_doc = await self.db.odoo_raw_data.find_one({
                "entity_type": "account",
                "odoo_id": partner_id,
                "is_latest": True
            })
            if acc_doc:
                acc_data = acc_doc.get("raw_data", {})
                account = {
                    "odoo_id": partner_id,
                    "name": acc_data.get("name"),
                    "city": acc_data.get("city")
                }
        
        # Upsert opportunity view
        await self.collection.update_one(
            {"odoo_id": odoo_id},
            {
                "$set": {
                    "name": payload.get("name"),
                    "stage": payload.get("stage_name"),
                    "value": payload.get("expected_revenue", 0),
                    "probability": payload.get("probability", 0),
                    "expected_close_date": payload.get("date_deadline"),
                    "salesperson": salesperson,
                    "account": account,
                    "visible_to_user_ids": list(set(visible_to)),  # Dedupe
                    "source": "odoo",
                    "last_synced": datetime.now(timezone.utc),
                    "version": {"$inc": 1}
                },
                "$setOnInsert": {
                    "id": str(uuid.uuid4()),
                    "odoo_id": odoo_id,
                    "created_at": datetime.now(timezone.utc)
                }
            },
            upsert=True
        )
        
        await self.mark_processed(event.id)
```

#### 2.3 Access Matrix Projection
**File:** `/app/backend/projections/access_matrix_projection.py`

```python
class AccessMatrixProjection(BaseProjection):
    """
    Pre-computes what each user can access.
    Rebuilds when hierarchy or assignments change.
    """
    
    def subscribes_to(self) -> List[str]:
        return [
            "OdooUserSynced",
            "ManagerAssigned",
            "OpportunityAssigned"
        ]
    
    async def rebuild_for_user(self, user_id: str):
        """Rebuild access matrix for one user"""
        user = await self.db.user_profiles.find_one({"id": user_id})
        if not user:
            return
        
        # Find all opportunities this user can access
        accessible_opps = await self.db.opportunity_view.find({
            "visible_to_user_ids": user_id
        }, {"odoo_id": 1}).to_list(10000)
        
        opp_ids = [o["odoo_id"] for o in accessible_opps]
        
        # Find subordinates
        subordinate_ids = [
            s["user_id"] 
            for s in user.get("hierarchy", {}).get("subordinates", [])
        ]
        
        # Store access matrix
        await self.db.user_access_matrix.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "accessible_opportunities": opp_ids,
                    "is_manager": user.get("hierarchy", {}).get("is_manager", False),
                    "subordinate_count": len(subordinate_ids),
                    "managed_user_ids": subordinate_ids,
                    "computed_at": datetime.now(timezone.utc)
                }
            },
            upsert=True
        )
```

---

### DAY 2: Command Handlers & Sync

#### 2.1 Odoo Sync Command Handler
**File:** `/app/backend/domain/handlers/sync_handler.py`

```python
class OdooSyncHandler:
    def __init__(self, db, event_store, event_bus):
        self.db = db
        self.event_store = event_store
        self.event_bus = event_bus
    
    async def handle_sync_command(self, command: SyncOdooCommand):
        """
        Process Odoo sync command.
        
        Flow:
        1. Fetch from Odoo
        2. Store in odoo_raw_data
        3. Detect changes (compare with previous)
        4. Generate events for changes
        5. Publish events
        6. Projections update materialized views
        """
        from sync.odoo_connector import OdooConnector
        
        connector = OdooConnector(command.odoo_config)
        
        # Fetch users
        odoo_users = await connector.fetch_users()
        
        for user_data in odoo_users:
            odoo_employee_id = user_data.get("odoo_employee_id")
            
            # Store raw
            await self.db.odoo_raw_data.update_one(
                {
                    "entity_type": "user",
                    "odoo_id": odoo_employee_id
                },
                {
                    "$set": {
                        "raw_data": user_data,
                        "fetched_at": datetime.now(timezone.utc),
                        "sync_job_id": command.sync_job_id,
                        "is_latest": True
                    }
                },
                upsert=True
            )
            
            # Set all previous versions to is_latest=false
            await self.db.odoo_raw_data.update_many(
                {
                    "entity_type": "user",
                    "odoo_id": odoo_employee_id,
                    "sync_job_id": {"$ne": command.sync_job_id}
                },
                {"$set": {"is_latest": False}}
            )
            
            # Generate event
            event = Event(
                event_type="OdooUserSynced",
                aggregate_id=f"user-{odoo_employee_id}",
                payload={
                    "_aggregate_type": "User",
                    "odoo_user_id": user_data.get("odoo_user_id"),
                    "odoo_employee_id": odoo_employee_id,
                    "manager_odoo_id": user_data.get("manager_odoo_id"),
                    "email": user_data.get("email"),
                    "name": user_data.get("name"),
                    "team_id": user_data.get("team_id"),
                    "sync_job_id": command.sync_job_id
                }
            )
            
            # Persist event
            await self.event_store.append(event)
            
            # Publish for projections
            await self.event_bus.publish(event)
        
        # Similar for opportunities, accounts, etc.
```

---

### DAY 3: Query APIs & Migration

#### 3.1 Dashboard Query API
**File:** `/app/backend/api/queries/dashboard_api.py`

```python
from fastapi import APIRouter, Depends

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard Queries"])

@router.get("/")
async def get_dashboard(
    token_data: dict = Depends(require_approved())
):
    """
    Get dashboard data (CQRS Query Side).
    Reads from pre-computed materialized views - blazing fast!
    """
    db = Database.get_db()
    user_id = token_data["id"]
    
    # Read from access matrix (pre-computed!)
    access = await db.user_access_matrix.find_one({"user_id": user_id})
    
    if not access:
        # Rebuild if missing
        from projections.access_matrix_projection import AccessMatrixProjection
        projection = AccessMatrixProjection(db)
        await projection.rebuild_for_user(user_id)
        access = await db.user_access_matrix.find_one({"user_id": user_id})
    
    # Get accessible opportunity IDs
    accessible_opp_ids = access.get("accessible_opportunities", [])
    
    # Fetch opportunities (already denormalized!)
    opportunities = await db.opportunity_view.find({
        "odoo_id": {"$in": accessible_opp_ids},
        "is_active": True
    }, {"_id": 0}).to_list(1000)
    
    # Get pre-computed metrics
    metrics = await db.dashboard_metrics.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )
    
    if not metrics:
        # Compute on-demand if cache miss
        metrics = await compute_metrics(user_id, opportunities)
    
    return {
        "opportunities": opportunities,
        "metrics": metrics,
        "hierarchy": {
            "is_manager": access.get("is_manager"),
            "subordinate_count": access.get("subordinate_count")
        },
        "data_freshness": {
            "last_sync": metrics.get("computed_at"),
            "next_sync": "in 3 minutes"  # Based on schedule
        }
    }
```

#### 3.2 Migration Script
**File:** `/app/backend/scripts/migrate_to_cqrs.py`

```python
async def migrate_to_cqrs():
    """
    Migrate existing data to new CQRS architecture.
    
    Steps:
    1. Copy data_lake_serving → odoo_raw_data
    2. Generate synthetic events for existing data
    3. Run all projections to build materialized views
    4. Validate data integrity
    5. Switch traffic to new endpoints
    """
    db = Database.get_db()
    
    print("Starting CQRS migration...")
    
    # Step 1: Migrate raw data
    print("1. Migrating raw data...")
    await migrate_raw_data(db)
    
    # Step 2: Generate events
    print("2. Generating historical events...")
    await generate_historical_events(db)
    
    # Step 3: Build projections
    print("3. Building materialized views...")
    await build_all_projections(db)
    
    # Step 4: Validate
    print("4. Validating...")
    await validate_migration(db)
    
    print("✅ Migration complete!")


async def migrate_raw_data(db):
    """Copy data_lake_serving to odoo_raw_data"""
    entities = await db.data_lake_serving.find({}).to_list(10000)
    
    for entity in entities:
        await db.odoo_raw_data.insert_one({
            "id": str(uuid.uuid4()),
            "entity_type": entity["entity_type"],
            "odoo_id": entity.get("serving_id"),
            "raw_data": entity.get("data"),
            "fetched_at": entity.get("last_aggregated"),
            "sync_job_id": "migration-initial",
            "is_latest": True,
            "checksum": hash_data(entity.get("data"))
        })


async def generate_historical_events(db):
    """Generate OdooXXXSynced events for all existing data"""
    event_store = EventStore(db)
    
    # For each entity in odoo_raw_data
    users = await db.odoo_raw_data.find({"entity_type": "user"}).to_list(1000)
    
    for user_doc in users:
        user_data = user_doc["raw_data"]
        
        event = Event(
            event_type="OdooUserSynced",
            aggregate_id=f"user-{user_data.get('odoo_employee_id')}",
            payload={
                "_aggregate_type": "User",
                **user_data,
                "sync_job_id": "migration-initial"
            }
        )
        
        await event_store.append(event)
    
    # Similar for opportunities, accounts, etc.


async def build_all_projections(db):
    """Run all projections to build materialized views"""
    from projections.user_profile_projection import UserProfileProjection
    from projections.opportunity_projection import OpportunityProjection
    from projections.access_matrix_projection import AccessMatrixProjection
    
    event_store = EventStore(db)
    
    projections = [
        UserProfileProjection(db),
        OpportunityProjection(db),
        AccessMatrixProjection(db)
    ]
    
    for projection in projections:
        projection.event_store = event_store
        print(f"Building {projection.projection_name}...")
        await projection.rebuild_from_events()
```

---

## 📊 BENEFITS OF CQRS ARCHITECTURE

### Performance
- ✅ **Dashboard loads in <200ms** (vs 3-5s current)
- ✅ **No complex joins** at query time
- ✅ **Pre-computed access control** (O(1) instead of O(n))
- ✅ **Optimized indexes** per query pattern

### Data Integrity
- ✅ **Single source of truth** (event store)
- ✅ **No data loss** (all changes logged)
- ✅ **Reproducible state** (replay events)
- ✅ **Audit trail** (who did what, when)

### Scalability
- ✅ **Independent scaling** (read vs write)
- ✅ **Cache-friendly** (materialized views)
- ✅ **Event-driven** (decouple sync from queries)
- ✅ **Testable** (replay events in test env)

### Maintainability
- ✅ **Clear separation** (commands vs queries)
- ✅ **Explicit relationships** (visible_to_user_ids)
- ✅ **Version tracking** (detect concurrent updates)
- ✅ **Easy debugging** (trace event history)

---

## ⚡ MIGRATION STRATEGY

### Phase 1: Parallel Run (Week 1)
- Deploy new CQRS endpoints at `/api/v2/`
- Keep old endpoints at `/api/`
- Run both in parallel
- Compare results for validation

### Phase 2: Traffic Switch (Week 2)
- Frontend uses v2 endpoints
- Monitor for issues
- Keep v1 as fallback

### Phase 3: Deprecation (Week 3)
- Remove old endpoints
- Clean up legacy code
- Full CQRS only

---

## 🎯 IMPLEMENTATION TIMELINE

### Day 1: Foundation (8 hours)
- ✅ Event store implementation
- ✅ Event bus & publisher
- ✅ Base projection class
- ✅ UserProfileProjection
- ✅ Testing infrastructure

### Day 2: Projections (8 hours)
- ✅ OpportunityProjection
- ✅ AccessMatrixProjection
- ✅ DashboardMetricsProjection
- ✅ Sync handler with events
- ✅ Migration scripts

### Day 3: Integration (8 hours)
- ✅ New API endpoints
- ✅ Run migration
- ✅ Frontend updates
- ✅ Comprehensive testing
- ✅ Documentation

---

## 📝 CHECKLIST BEFORE STARTING

Before I begin this major refactor, please confirm:

- [ ] **Downtime acceptable?** (30 min for migration)
- [ ] **Backup exists?** (in case rollback needed)
- [ ] **Team aligned?** (all stakeholders aware)
- [ ] **Testing plan approved?** (v1 vs v2 comparison)
- [ ] **Timeline OK?** (3 days full-time work)

---

**Shall I proceed with the CQRS rewrite?** This will fundamentally improve the system but requires significant time investment.

