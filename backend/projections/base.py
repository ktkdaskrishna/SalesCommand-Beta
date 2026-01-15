"""
Base Projection
Abstract base class for all CQRS projections
"""
from abc import ABC, abstractmethod
from typing import List, Optional
from datetime import datetime, timezone
import logging

from event_store.models import Event
from event_store.store import EventStore

logger = logging.getLogger(__name__)


class BaseProjection(ABC):
    """
    Base class for all projections (read model builders).
    
    Projections:
    1. Subscribe to domain events
    2. Update materialized views when events occur
    3. Can rebuild from event history
    4. Track which events have been processed
    """
    
    def __init__(self, db, projection_name: str):
        self.db = db
        self.projection_name = projection_name
        self.event_store: Optional[EventStore] = None
    
    @abstractmethod
    async def handle(self, event: Event):
        """
        Process an event and update the read model.
        
        Args:
            event: Domain event to process
        """
        pass
    
    @abstractmethod
    def subscribes_to(self) -> List[str]:
        """
        List of event types this projection handles.
        
        Returns:
            List of EventType values
        """
        pass
    
    async def mark_processed(self, event_id: str):
        """
        Mark event as processed by this projection.
        
        Args:
            event_id: Event ID
        """
        if self.event_store:
            await self.event_store.mark_event_processed(
                event_id, 
                self.projection_name
            )
        else:
            logger.warning(f"EventStore not set for {self.projection_name}")
    
    async def rebuild_from_events(
        self, 
        since: Optional[datetime] = None
    ):
        """
        Rebuild this projection from event history.
        Useful for:
        - Initial deployment
        - Recovering from corruption
        - Adding new projections
        - Testing
        
        Args:
            since: Only process events after this time (None = all history)
        """
        if not self.event_store:
            raise RuntimeError(f"EventStore not set for {self.projection_name}")
        
        logger.info(f"Rebuilding {self.projection_name} from events...")
        
        # Get all events we care about
        since_time = since or datetime.min.replace(tzinfo=timezone.utc)
        events = await self.event_store.get_all_events_since(since_time)
        
        # Filter to only events we subscribe to
        subscribed_types = set(self.subscribes_to())
        relevant_events = [
            e for e in events 
            if (e.event_type.value if hasattr(e.event_type, 'value') else e.event_type) in subscribed_types
        ]
        
        logger.info(f"Found {len(relevant_events)} relevant events for {self.projection_name}")
        
        # Process each event
        processed = 0
        errors = 0
        
        for event in relevant_events:
            try:
                await self.handle(event)
                await self.mark_processed(event.id)
                processed += 1
                
                if processed % 100 == 0:
                    logger.info(f"Processed {processed}/{len(relevant_events)} events")
            except Exception as e:
                logger.error(f"Error processing event {event.id}: {e}")
                errors += 1
        
        logger.info(f"Rebuild complete: {processed} processed, {errors} errors")
        
        return {"processed": processed, "errors": errors}
    
    async def get_rebuild_status(self) -> dict:
        """
        Get status of this projection.
        
        Returns:
            Dict with processed counts and timestamps
        """
        if not self.event_store:
            return {"status": "no_event_store"}
        
        # Count total events we should have processed
        total_events = 0
        for event_type in self.subscribes_to():
            count = await self.event_store.get_event_count(event_type=event_type)
            total_events += count
        
        # Count how many we've actually processed
        processed_count = await self.event_store.collection.count_documents({
            "processed_by": self.projection_name
        })
        
        return {
            "projection_name": self.projection_name,
            "total_events": total_events,
            "processed_events": processed_count,
            "behind": total_events - processed_count,
            "is_up_to_date": total_events == processed_count
        }
