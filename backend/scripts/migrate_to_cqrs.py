"""
Migrate to CQRS Architecture
One-time migration script to move from old to new architecture
"""
import asyncio
import hashlib
import json
from datetime import datetime, timezone
import uuid
import logging
from motor.motor_asyncio import AsyncIOMotorClient
import sys
import os

sys.path.append('/app/backend')

from event_store.store import EventStore
from event_store.models import Event, EventType, AggregateType, EventMetadata
from event_store.publisher import event_bus
from projections.user_profile_projection import UserProfileProjection
from projections.opportunity_projection import OpportunityProjection
from projections.access_matrix_projection import AccessMatrixProjection
from projections.dashboard_metrics_projection import DashboardMetricsProjection

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def migrate_to_cqrs():
    """
    Migrate existing data to CQRS architecture.
    
    Steps:
    1. Backup old collections
    2. Create new collections with indexes
    3. Migrate raw Odoo data
    4. Generate synthetic events
    5. Run projections
    6. Validate
    7. Switch traffic
    """
    client = AsyncIOMotorClient(os.getenv('MONGO_URL', 'mongodb://localhost:27017'))
    db = client[os.getenv('DB_NAME', 'test_database')]
    
    print("="  * 80)
    print("CQRS MIGRATION - Sales Intelligence Platform")
    print("=" * 80)
    print()
    
    # Step 0: Pre-flight checks
    print("Step 0: Pre-flight checks...")
    await preflight_checks(db)
    
    # Step 1: Backup
    print("\nStep 1: Creating backups...")
    await create_backups(db)
    
    # Step 2: Create indexes
    print("\nStep 2: Creating indexes for new collections...")
    await create_indexes(db)
    
    # Step 3: Migrate raw data
    print("\nStep 3: Migrating raw Odoo data...")
    await migrate_raw_data(db)
    
    # Step 4: Generate events
    print("\nStep 4: Generating historical events...")
    event_store = EventStore(db)
    await generate_historical_events(db, event_store)
    
    # Step 5: Build projections
    print("\nStep 5: Building materialized views...")
    await build_projections(db, event_store)
    
    # Step 6: Validate
    print("\nStep 6: Validating migration...")
    await validate_migration(db)
    
    # Step 7: Summary
    print("\n" + "=" * 80)
    print("✅ MIGRATION COMPLETE")
    print("=" * 80)
    await print_summary(db)
    
    client.close()


async def preflight_checks(db):
    """Verify system is ready for migration"""
    # Check collections exist
    collections = await db.list_collection_names()
    
    required = ['users', 'data_lake_serving']
    for col in required:
        if col in collections:
            count = await db[col].count_documents({})
            print(f"  ✅ {col}: {count} records")
        else:
            print(f"  ❌ {col}: NOT FOUND")
            raise RuntimeError(f"Missing required collection: {col}")


async def create_backups(db):
    """Backup existing collections"""
    backup_suffix = f"_backup_{int(datetime.now().timestamp())}"
    
    collections_to_backup = ['users', 'data_lake_serving']
    
    for col_name in collections_to_backup:
        backup_name = f"{col_name}{backup_suffix}"
        
        # Copy collection
        pipeline = [{"$out": backup_name}]
        await db[col_name].aggregate(pipeline).to_list(None)
        
        count = await db[backup_name].count_documents({})
        print(f"  ✅ Backed up {col_name} → {backup_name} ({count} records)")


async def create_indexes(db):
    """Create indexes for new CQRS collections"""
    # Event store indexes
    await db.events.create_index([("aggregate_type", 1), ("aggregate_id", 1), ("version", 1)], name="aggregate_events")
    await db.events.create_index([("event_type", 1), ("timestamp", 1)], name="event_type_time")
    await db.events.create_index("timestamp", name="event_timestamp")
    await db.events.create_index("id", unique=True, name="event_id")
    print("  ✅ Event store indexes created")
    
    # Odoo raw data indexes
    await db.odoo_raw_data.create_index([("entity_type", 1), ("odoo_id", 1), ("is_latest", 1)], name="entity_odoo_latest")
    await db.odoo_raw_data.create_index("checksum", name="checksum")
    print("  ✅ Odoo raw data indexes created")
    
    # User profiles indexes
    await db.user_profiles.create_index("email", unique=True, name="email")
    await db.user_profiles.create_index("id", unique=True, name="user_id")
    await db.user_profiles.create_index("odoo.user_id", name="odoo_user_id")
    await db.user_profiles.create_index("odoo.employee_id", name="odoo_employee_id")
    await db.user_profiles.create_index("odoo.manager_employee_id", name="manager_id")
    print("  ✅ User profiles indexes created")
    
    # Opportunity view indexes
    await db.opportunity_view.create_index("odoo_id", unique=True, name="odoo_id")
    await db.opportunity_view.create_index("id", unique=True, name="opportunity_id")
    await db.opportunity_view.create_index("visible_to_user_ids", name="visible_to")
    await db.opportunity_view.create_index([("salesperson.odoo_user_id", 1), ("is_active", 1)], name="salesperson_active")
    print("  ✅ Opportunity view indexes created")
    
    # Access matrix indexes
    await db.user_access_matrix.create_index("user_id", unique=True, name="user_id")
    await db.user_access_matrix.create_index("computed_at", expireAfterSeconds=600, name="ttl")  # TTL index
    print("  ✅ Access matrix indexes created (with TTL)")
    
    # Dashboard metrics indexes
    await db.dashboard_metrics.create_index("user_id", unique=True, name="user_id")
    await db.dashboard_metrics.create_index("computed_at", expireAfterSeconds=600, name="ttl")  # TTL index
    print("  ✅ Dashboard metrics indexes created (with TTL)")


async def migrate_raw_data(db):
    """Copy data_lake_serving to odoo_raw_data with checksums"""
    entities = await db.data_lake_serving.find({}).to_list(10000)
    
    migrated = 0
    skipped = 0
    
    for entity in entities:
        entity_type = entity.get("entity_type")
        serving_id = entity.get("serving_id")
        data = entity.get("data", {})
        
        # Calculate checksum
        data_str = json.dumps(data, sort_keys=True)
        checksum = hashlib.sha256(data_str.encode()).hexdigest()
        
        # Check if already exists
        existing = await db.odoo_raw_data.find_one({
            "entity_type": entity_type,
            "odoo_id": serving_id,
            "checksum": checksum
        })
        
        if existing:
            skipped += 1
            continue
        
        # Insert
        await db.odoo_raw_data.insert_one({
            "id": str(uuid.uuid4()),
            "entity_type": entity_type,
            "odoo_id": serving_id,
            "raw_data": data,
            "fetched_at": entity.get("last_aggregated") or datetime.now(timezone.utc),
            "sync_job_id": "migration-initial",
            "is_latest": True,
            "checksum": checksum
        })
        
        migrated += 1
    
    print(f"  ✅ Migrated {migrated} records to odoo_raw_data (skipped {skipped} duplicates)")


async def generate_historical_events(db, event_store: EventStore):
    """Generate events for all existing data"""
    # Generate user events
    users = await db.odoo_raw_data.find({"entity_type": "user", "is_latest": True}).to_list(1000)
    
    user_events_created = 0
    for user_doc in users:
        user_data = user_doc["raw_data"]
        
        event = Event(
            event_type=EventType.ODOO_USER_SYNCED,
            aggregate_type=AggregateType.USER,
            aggregate_id=f"user-{user_data.get('odoo_employee_id')}",
            payload=user_data,
            metadata=EventMetadata(
                source="migration",
                correlation_id="migration-initial"
            )
        )
        
        await event_store.append(event)
        user_events_created += 1
    
    print(f"  ✅ Generated {user_events_created} OdooUserSynced events")
    
    # Generate opportunity events
    opps = await db.odoo_raw_data.find({"entity_type": "opportunity", "is_latest": True}).to_list(10000)
    
    opp_events_created = 0
    for opp_doc in opps:
        opp_data = opp_doc["raw_data"]
        
        event = Event(
            event_type=EventType.ODOO_OPPORTUNITY_SYNCED,
            aggregate_type=AggregateType.OPPORTUNITY,
            aggregate_id=f"opportunity-{opp_data.get('id')}",
            payload=opp_data,
            metadata=EventMetadata(
                source="migration",
                correlation_id="migration-initial"
            )
        )
        
        await event_store.append(event)
        opp_events_created += 1
    
    print(f"  ✅ Generated {opp_events_created} OdooOpportunitySynced events")
    
    return user_events_created + opp_events_created


async def build_projections(db, event_store: EventStore):
    """Run all projections to build materialized views"""
    projections = [
        UserProfileProjection(db),
        OpportunityProjection(db),
        AccessMatrixProjection(db),
        DashboardMetricsProjection(db)
    ]
    
    for projection in projections:
        projection.event_store = event_store
        print(f"\n  Building {projection.projection_name}...")
        
        result = await projection.rebuild_from_events()
        print(f"    ✅ Processed {result['processed']} events, {result['errors']} errors")
        
        # Check status
        status = await projection.get_rebuild_status()
        if status.get("is_up_to_date"):
            print(f"    ✅ Projection is up-to-date")
        else:
            print(f"    ⚠️  Behind by {status.get('behind')} events")


async def validate_migration(db):
    """Validate migrated data"""
    print("\n  Validating data integrity...")
    
    # Count records
    old_users = await db.users.count_documents({})
    new_users = await db.user_profiles.count_documents({})
    
    old_opps = await db.data_lake_serving.count_documents({"entity_type": "opportunity"})
    new_opps = await db.opportunity_view.count_documents({})
    
    print(f"\n  Users: {old_users} (old) → {new_users} (new)")
    print(f"  Opportunities: {old_opps} (old) → {new_opps} (new)")
    
    # Test specific users
    print("\n  Testing Vinsha's profile...")
    vinsha = await db.user_profiles.find_one({"email": "vinsha.nair@securado.net"})
    if vinsha:
        print(f"    ✅ Found Vinsha")
        print(f"       odoo_user_id: {vinsha.get('odoo', {}).get('user_id')}")
        print(f"       odoo_employee_id: {vinsha.get('odoo', {}).get('employee_id')}")
        print(f"       manager: {vinsha.get('hierarchy', {}).get('manager', {}).get('name') if vinsha.get('hierarchy', {}).get('manager') else 'None'}")
        print(f"       subordinates: {len(vinsha.get('hierarchy', {}).get('subordinates', []))}")
        
        # Test access matrix
        access = await db.user_access_matrix.find_one({"user_id": vinsha["id"]})
        if access:
            print(f"       accessible_opps: {len(access.get('accessible_opportunities', []))}")
            print(f"       is_manager: {access.get('is_manager')}")
        else:
            print(f"    ⚠️  No access matrix found")
    else:
        print(f"    ❌ Vinsha not found!")
    
    print("\n  Testing Zakariya's profile...")
    zak = await db.user_profiles.find_one({"email": "z.albaloushi@securado.net"})
    if zak:
        print(f"    ✅ Found Zakariya")
        print(f"       manager: {zak.get('hierarchy', {}).get('manager', {}).get('name')}")
        
        # Should have Vinsha as manager
        manager = zak.get('hierarchy', {}).get('manager')
        if manager and manager.get('email') == 'vinsha.nair@securado.net':
            print(f"    ✅ Hierarchy correct: Reports to Vinsha")
        else:
            print(f"    ❌ Hierarchy issue: Manager is {manager}")
    
    # Test opportunity visibility
    print("\n  Testing opportunity visibility...")
    if vinsha:
        vinsha_opps = await db.opportunity_view.find({
            "visible_to_user_ids": vinsha["id"],
            "is_active": True
        }).to_list(100)
        
        print(f"    Vinsha can see {len(vinsha_opps)} opportunities")
        
        # Check if includes Zakariya's
        zak_opps = [o for o in vinsha_opps if o.get("salesperson", {}).get("email") == "z.albaloushi@securado.net"]
        if zak_opps:
            print(f"    ✅ Includes {len(zak_opps)} opportunities from subordinate Zakariya")
        else:
            print(f"    ⚠️  No subordinate opportunities visible")


async def print_summary(db):
    """Print migration summary"""
    events_count = await db.events.count_documents({})
    users_count = await db.user_profiles.count_documents({})
    opps_count = await db.opportunity_view.count_documents({})
    access_count = await db.user_access_matrix.count_documents({})
    metrics_count = await db.dashboard_metrics.count_documents({})
    
    print(f"\nNew Collections:")
    print(f"  • events: {events_count} events")
    print(f"  • user_profiles: {users_count} users")
    print(f"  • opportunity_view: {opps_count} opportunities")
    print(f"  • user_access_matrix: {access_count} matrices")
    print(f"  • dashboard_metrics: {metrics_count} metric sets")
    
    print(f"\nNext Steps:")
    print(f"  1. Test new v2 API endpoints")
    print(f"  2. Update frontend to use v2 endpoints")
    print(f"  3. Verify user experience")
    print(f"  4. Delete old backups after 1 week")


if __name__ == "__main__":
    asyncio.run(migrate_to_cqrs())
