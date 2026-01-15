"""
Odoo Sync Handler (CQRS Command Side)
Replaces old background_sync.py with event-driven approach
"""
from typing import Dict, Any, List
from datetime import datetime, timezone
import uuid
import logging
import hashlib
import json

from event_store.store import EventStore
from event_store.models import Event, EventType, AggregateType, EventMetadata
from event_store.publisher import event_bus
from core.database import Database

logger = logging.getLogger(__name__)


class OdooSyncHandler:
    """
    CQRS Command Handler for Odoo sync.
    
    Responsibilities:
    1. Fetch data from Odoo
    2. Store in odoo_raw_data (immutable)
    3. Detect changes (compare checksums)
    4. Generate domain events
    5. Publish events to event bus
    6. Projections update materialized views
    """
    
    def __init__(self, db=None):
        # Use proper None check for MongoDB database objects
        if db is not None:
            self._db = db
        else:
            self._db = None
    
    @property
    def db(self):
        if self._db is None:
            from core.database import Database
            self._db = Database.get_db()
        return self._db
    
    @property
    def event_store(self):
        if not hasattr(self, '_event_store'):
            from event_store.store import EventStore
            self._event_store = EventStore(self.db)
        return self._event_store
    
    async def handle_sync_command(self, sync_job_id: str, odoo_config: dict):
        """
        Execute full Odoo sync.
        
        Args:
            sync_job_id: Unique sync job identifier
            odoo_config: Odoo connection config
        
        Returns:
            Sync stats
        """
        from integrations.odoo.connector import OdooConnector
        
        logger.info(f"Starting Odoo sync (job {sync_job_id})")
        started_at = datetime.now(timezone.utc)
        
        connector = OdooConnector(odoo_config)
        
        stats = {
            "users": 0,
            "opportunities": 0,
            "accounts": 0,
            "total_events": 0
        }
        
        try:
            # Sync users
            logger.info("Syncing users...")
            user_events = await self._sync_users(connector, sync_job_id)
            stats["users"] = len(user_events)
            stats["total_events"] += len(user_events)
            
            # Sync opportunities
            logger.info("Syncing opportunities...")
            opp_events = await self._sync_opportunities(connector, sync_job_id)
            stats["opportunities"] = len(opp_events)
            stats["total_events"] += len(opp_events)
            
            # Sync accounts
            logger.info("Syncing accounts...")
            acc_events = await self._sync_accounts(connector, sync_job_id)
            stats["accounts"] = len(acc_events)
            stats["total_events"] += len(acc_events)
            
            logger.info(f"Sync complete: {stats['total_events']} events generated in {(datetime.now(timezone.utc) - started_at).total_seconds():.1f}s")
            
            return stats
            
        finally:
            await connector.disconnect()
    
    async def _sync_users(self, connector, sync_job_id: str) -> List[Event]:
        """Sync users and generate events"""
        users = await connector.fetch_users()
        events = []
        
        for user_data in users:
            odoo_employee_id = user_data.get("odoo_employee_id")
            if not odoo_employee_id:
                continue
            
            # Store raw
            checksum = self._calculate_checksum(user_data)
            
            # Check if changed
            existing = await self.db.odoo_raw_data.find_one({
                "entity_type": "user",
                "odoo_id": odoo_employee_id,
                "is_latest": True
            })
            
            if existing and existing.get("checksum") == checksum:
                # No change, skip
                continue
            
            # Mark old versions as not latest
            await self.db.odoo_raw_data.update_many(
                {
                    "entity_type": "user",
                    "odoo_id": odoo_employee_id,
                    "is_latest": True
                },
                {"$set": {"is_latest": False}}
            )
            
            # Store new version
            await self.db.odoo_raw_data.insert_one({
                "id": str(uuid.uuid4()),
                "entity_type": "user",
                "odoo_id": odoo_employee_id,
                "raw_data": user_data,
                "fetched_at": datetime.now(timezone.utc),
                "sync_job_id": sync_job_id,
                "is_latest": True,
                "checksum": checksum
            })
            
            # Generate event
            event = Event(
                event_type=EventType.ODOO_USER_SYNCED,
                aggregate_type=AggregateType.USER,
                aggregate_id=f"user-{odoo_employee_id}",
                payload=user_data,
                metadata=EventMetadata(
                    source="odoo_sync",
                    correlation_id=sync_job_id
                )
            )
            
            # Append to event store
            await self.event_store.append(event)
            
            # Publish to event bus (triggers projections)
            await event_bus.publish(event)
            
            events.append(event)
        
        return events
    
    async def _sync_opportunities(self, connector, sync_job_id: str) -> List[Event]:
        """Sync opportunities and generate events"""
        opportunities = await connector.fetch_opportunities()
        events = []
        
        for opp_data in opportunities:
            odoo_id = opp_data.get("id")
            if not odoo_id:
                continue
            
            # Check if changed
            checksum = self._calculate_checksum(opp_data)
            existing = await self.db.odoo_raw_data.find_one({
                "entity_type": "opportunity",
                "odoo_id": odoo_id,
                "is_latest": True
            })
            
            if existing and existing.get("checksum") == checksum:
                continue  # No change
            
            # Mark old as not latest
            await self.db.odoo_raw_data.update_many(
                {"entity_type": "opportunity", "odoo_id": odoo_id, "is_latest": True},
                {"$set": {"is_latest": False}}
            )
            
            # Store new
            await self.db.odoo_raw_data.insert_one({
                "id": str(uuid.uuid4()),
                "entity_type": "opportunity",
                "odoo_id": odoo_id,
                "raw_data": opp_data,
                "fetched_at": datetime.now(timezone.utc),
                "sync_job_id": sync_job_id,
                "is_latest": True,
                "checksum": checksum
            })
            
            # Generate event
            event = Event(
                event_type=EventType.ODOO_OPPORTUNITY_SYNCED,
                aggregate_type=AggregateType.OPPORTUNITY,
                aggregate_id=f"opportunity-{odoo_id}",
                payload=opp_data,
                metadata=EventMetadata(
                    source="odoo_sync",
                    correlation_id=sync_job_id
                )
            )
            
            await self.event_store.append(event)
            await event_bus.publish(event)
            events.append(event)
        
        return events
    
    async def _sync_accounts(self, connector, sync_job_id: str) -> List[Event]:
        """Sync accounts (similar pattern)"""
        accounts = await connector.fetch_accounts()
        events = []
        
        for acc_data in accounts:
            odoo_id = acc_data.get("id")
            if not odoo_id:
                continue
            
            checksum = self._calculate_checksum(acc_data)
            
            # Store raw
            await self.db.odoo_raw_data.update_one(
                {"entity_type": "account", "odoo_id": odoo_id},
                {
                    "$set": {
                        "raw_data": acc_data,
                        "fetched_at": datetime.now(timezone.utc),
                        "sync_job_id": sync_job_id,
                        "is_latest": True,
                        "checksum": checksum
                    },
                    "$setOnInsert": {
                        "id": str(uuid.uuid4()),
                        "entity_type": "account",
                        "odoo_id": odoo_id
                    }
                },
                upsert=True
            )
            
            event = Event(
                event_type=EventType.ODOO_ACCOUNT_SYNCED,
                aggregate_type=AggregateType.ACCOUNT,
                aggregate_id=f"account-{odoo_id}",
                payload=acc_data,
                metadata=EventMetadata(
                    source="odoo_sync",
                    correlation_id=sync_job_id
                )
            )
            
            await self.event_store.append(event)
            events.append(event)
        
        return events
    
    def _calculate_checksum(self, data: dict) -> str:
        """Calculate SHA-256 checksum of data"""
        data_str = json.dumps(data, sort_keys=True)
        return hashlib.sha256(data_str.encode()).hexdigest()
