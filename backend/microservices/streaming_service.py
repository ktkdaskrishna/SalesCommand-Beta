"""
Streaming orchestrator for data lake ingestion.
"""
from typing import Any, Dict
from datetime import datetime, timezone
import logging
import uuid

from .data_lake_service import DataLakeService

logger = logging.getLogger(__name__)


class StreamingService:
    """Coordinates data ingestion events for the microservice layer."""

    def __init__(self, data_lake: DataLakeService):
        self.data_lake = data_lake

    def ingest_event(self, source: str, entity_type: str, payload: Dict[str, Any]) -> str:
        source_id = payload.get("id") or payload.get("source_id") or str(uuid.uuid4())
        ingested_at = datetime.now(timezone.utc)
        self.data_lake.ingest_raw(
            source=source,
            entity_type=entity_type,
            source_id=source_id,
            payload=payload,
            ingested_at=ingested_at,
        )
        logger.info("Ingested raw event %s/%s", entity_type, source_id)
        return source_id
