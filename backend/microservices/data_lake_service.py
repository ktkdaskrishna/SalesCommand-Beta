"""
Data Lake microservice powered by ClickHouse.
Handles raw, canonical, and serving layer operations.
"""
from typing import Any, Dict, Optional
from datetime import datetime, timezone
import logging

from .clickhouse_client import ClickHouseClient

logger = logging.getLogger(__name__)


class DataLakeService:
    """Encapsulates data lake operations against ClickHouse."""

    def __init__(self, client: ClickHouseClient):
        self.client = client
        self.client.ensure_tables()

    def health(self) -> Dict[str, Any]:
        return {"clickhouse": "connected" if self.client.ping() else "unavailable"}

    def ingest_raw(
        self,
        source: str,
        entity_type: str,
        source_id: str,
        payload: Dict[str, Any],
        ingested_at: Optional[datetime] = None,
    ) -> None:
        timestamp = ingested_at or datetime.now(timezone.utc)
        self.client.insert_json_each_row(
            "raw_events",
            [
                {
                    "source": source,
                    "entity_type": entity_type,
                    "source_id": source_id,
                    "payload": payload,
                    "ingested_at": timestamp.isoformat(),
                }
            ],
        )

    def upsert_canonical(
        self,
        canonical_id: str,
        entity_type: str,
        payload: Dict[str, Any],
        quality_score: float = 1.0,
        validated_at: Optional[datetime] = None,
    ) -> None:
        timestamp = validated_at or datetime.now(timezone.utc)
        self.client.insert_json_each_row(
            "canonical_records",
            [
                {
                    "canonical_id": canonical_id,
                    "entity_type": entity_type,
                    "payload": payload,
                    "quality_score": quality_score,
                    "validated_at": timestamp.isoformat(),
                }
            ],
        )

    def publish_serving_view(
        self,
        view_id: str,
        entity_type: str,
        payload: Dict[str, Any],
        refreshed_at: Optional[datetime] = None,
    ) -> None:
        timestamp = refreshed_at or datetime.now(timezone.utc)
        self.client.insert_json_each_row(
            "serving_views",
            [
                {
                    "view_id": view_id,
                    "entity_type": entity_type,
                    "payload": payload,
                    "refreshed_at": timestamp.isoformat(),
                }
            ],
        )
