"""
Event Store Implementation
Immutable append-only event log
"""
from typing import List, Optional
from datetime import datetime, timezone
import logging

from .models import Event, EventType, AggregateType
from core.database import Database

logger = logging.getLogger(__name__)


class EventStore:
    """
    Event Store - Immutable append-only log of all domain events.
    Source of truth for the entire system.
    """
    
    def __init__(self, db=None):
        self.db = db or Database.get_db()
        self.collection = self.db.events
    
    async def append(self, event: Event) -> str:
        """
        Append event to store (immutable operation).
        
        Args:
            event: Event to append
        
        Returns:
            Event ID
        """
        try:
            doc = event.model_dump()
            await self.collection.insert_one(doc)
            logger.info(f"Event appended: {event.event_type} for {event.aggregate_type}/{event.aggregate_id}")
            return event.id
        except Exception as e:
            logger.error(f"Failed to append event: {e}")
            raise
    
    async def append_batch(self, events: List[Event]) -> List[str]:
        """
        Append multiple events atomically.
        
        Args:
            events: List of events
        
        Returns:
            List of event IDs
        """
        if not events:
            return []
        
        docs = [e.model_dump() for e in events]
        result = await self.collection.insert_many(docs)
        logger.info(f"Batch appended: {len(events)} events")
        return [str(oid) for oid in result.inserted_ids]
    
    async def get_events_for_aggregate(
        self, 
        aggregate_type: AggregateType, 
        aggregate_id: str,
        since_version: int = 0
    ) -> List[Event]:
        """
        Get all events for a specific aggregate (for state reconstruction).
        
        Args:
            aggregate_type: Type of aggregate
            aggregate_id: Aggregate identifier
            since_version: Only get events after this version
        
        Returns:
            List of events ordered by version
        """
        cursor = self.collection.find({
            "aggregate_type": aggregate_type.value,
            "aggregate_id": aggregate_id,
            "version": {"$gt": since_version}
        }).sort("version", 1)
        
        events = []
        async for doc in cursor:
            events.append(Event.from_dict(doc))
        
        return events
    
    async def get_events_by_type(
        self,
        event_type: EventType,
        since: Optional[datetime] = None,
        limit: int = 1000
    ) -> List[Event]:
        """
        Get events by type (for projections).
        
        Args:
            event_type: Type of event
            since: Only events after this timestamp
            limit: Max events to return
        
        Returns:
            List of events ordered by timestamp
        """
        query = {"event_type": event_type.value}
        
        if since:
            query["timestamp"] = {"$gte": since}
        
        cursor = self.collection.find(query).sort("timestamp", 1).limit(limit)
        
        events = []
        async for doc in cursor:
            events.append(Event.from_dict(doc))
        
        return events
    
    async def get_all_events_since(
        self,
        since: datetime,
        limit: int = 10000
    ) -> List[Event]:
        """
        Get all events after a timestamp (for projection rebuilds).
        
        Args:
            since: Timestamp to start from
            limit: Max events
        
        Returns:
            Events ordered by timestamp
        """
        cursor = self.collection.find({
            "timestamp": {"$gte": since}
        }).sort("timestamp", 1).limit(limit)
        
        events = []
        async for doc in cursor:
            events.append(Event.from_dict(doc))
        
        return events
    
    async def mark_event_processed(
        self, 
        event_id: str, 
        projection_name: str
    ):
        """
        Mark event as processed by a projection.
        Used to track which projections have consumed each event.
        
        Args:
            event_id: Event ID
            projection_name: Name of projection that processed it
        """
        await self.collection.update_one(
            {"id": event_id},
            {"$addToSet": {"processed_by": projection_name}}
        )
    
    async def get_event_count(
        self,
        event_type: Optional[EventType] = None,
        since: Optional[datetime] = None
    ) -> int:
        """
        Get count of events.
        
        Args:
            event_type: Filter by event type (optional)
            since: Only count events after this time
        
        Returns:
            Count of events
        """
        query = {}
        if event_type:
            query["event_type"] = event_type.value
        if since:
            query["timestamp"] = {"$gte": since}
        
        return await self.collection.count_documents(query)
    
    async def create_indexes(self):
        """
        Create optimal indexes for event store.
        Run this during deployment/migration.
        """
        # Compound index for aggregate queries
        await self.collection.create_index([
            ("aggregate_type", 1),
            ("aggregate_id", 1),
            ("version", 1)
        ], name="aggregate_events")
        
        # Index for type-based queries
        await self.collection.create_index([
            ("event_type", 1),
            ("timestamp", 1)
        ], name="event_type_time")
        
        # Index for time-based queries (rebuilds)
        await self.collection.create_index(
            "timestamp",
            name="event_timestamp"
        )
        
        # Index for event ID lookups
        await self.collection.create_index(
            "id",
            unique=True,
            name="event_id"
        )
        
        logger.info("Event store indexes created")
