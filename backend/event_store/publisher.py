"""
Event Publisher & Subscriber
Event bus for pub/sub pattern in CQRS
"""
from typing import Callable, List, Dict, Any
import asyncio
import logging
from .models import Event

logger = logging.getLogger(__name__)


class EventBus:
    """
    Event Bus - Pub/Sub system for domain events.
    Decouples event producers from consumers.
    """
    
    def __init__(self):
        self._subscribers: Dict[str, List[Callable]] = {}
        self._global_subscribers: List[Callable] = []  # Subscribe to all events
    
    def subscribe(self, event_type: str, handler: Callable):
        """
        Subscribe a handler to a specific event type.
        
        Args:
            event_type: Event type to listen for
            handler: Async callable that handles the event
        """
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        
        self._subscribers[event_type].append(handler)
        logger.info(f"Subscribed {handler.__name__} to {event_type}")
    
    def subscribe_all(self, handler: Callable):
        """
        Subscribe to all events (useful for logging/auditing).
        
        Args:
            handler: Async callable that handles any event
        """
        self._global_subscribers.append(handler)
        logger.info(f"Subscribed {handler.__name__} to ALL events")
    
    async def publish(self, event: Event) -> List[Any]:
        """
        Publish event to all subscribers.
        Handlers run in parallel for performance.
        
        Args:
            event: Event to publish
        
        Returns:
            List of handler results
        """
        # Get type-specific subscribers
        type_handlers = self._subscribers.get(event.event_type.value, [])
        
        # Combine with global subscribers
        all_handlers = type_handlers + self._global_subscribers
        
        if not all_handlers:
            logger.debug(f"No subscribers for {event.event_type}")
            return []
        
        logger.info(f"Publishing {event.event_type} to {len(all_handlers)} handlers")
        
        # Execute all handlers in parallel
        tasks = [handler(event) for handler in all_handlers]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Log any failures (but don't stop processing)
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                handler_name = all_handlers[i].__name__
                logger.error(f"Handler {handler_name} failed for {event.event_type}: {result}")
        
        return results
    
    def get_subscriber_count(self, event_type: Optional[str] = None) -> int:
        """
        Get count of subscribers.
        
        Args:
            event_type: Specific event type (None for all)
        
        Returns:
            Number of subscribers
        """
        if event_type:
            return len(self._subscribers.get(event_type, []))
        return sum(len(handlers) for handlers in self._subscribers.values())


# Global singleton event bus
event_bus = EventBus()
