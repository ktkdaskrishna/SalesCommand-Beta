"""
ClickHouse client for the data lake microservice.
Uses HTTP interface via requests.
"""
from typing import Any, Dict, Iterable, List, Optional
import logging
import json

import requests

logger = logging.getLogger(__name__)


class ClickHouseClient:
    """Simple ClickHouse HTTP client for query and DDL execution."""

    def __init__(
        self,
        base_url: str,
        database: str,
        user: Optional[str] = None,
        password: Optional[str] = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.database = database
        self.user = user
        self.password = password

    def _request(self, sql: str) -> str:
        params = {"database": self.database, "query": sql}
        auth = (self.user, self.password) if self.user else None
        response = requests.post(self.base_url, params=params, timeout=10, auth=auth)
        response.raise_for_status()
        return response.text

    def execute(self, sql: str) -> None:
        """Execute DDL/DML statements."""
        self._request(sql)

    def query_json(self, sql: str) -> List[Dict[str, Any]]:
        """Query ClickHouse and return JSON rows."""
        query = f"{sql} FORMAT JSON"
        response = self._request(query)
        data = json.loads(response)
        return data.get("data", [])

    def ping(self) -> bool:
        try:
            self._request("SELECT 1")
            return True
        except Exception as exc:
            logger.warning("ClickHouse ping failed: %s", exc)
            return False

    def insert_json_each_row(self, table: str, rows: Iterable[Dict[str, Any]]) -> None:
        payload = "\n".join(json.dumps(row) for row in rows)
        if not payload:
            return
        sql = f"INSERT INTO {table} FORMAT JSONEachRow"
        params = {"database": self.database, "query": sql}
        auth = (self.user, self.password) if self.user else None
        response = requests.post(
            self.base_url,
            params=params,
            data=payload,
            timeout=10,
            auth=auth,
        )
        response.raise_for_status()

    def ensure_tables(self) -> None:
        """Ensure core data lake tables exist."""
        self.execute(
            """
            CREATE TABLE IF NOT EXISTS raw_events (
                source String,
                entity_type String,
                source_id String,
                payload JSON,
                ingested_at DateTime
            )
            ENGINE = MergeTree
            ORDER BY (entity_type, source_id, ingested_at)
            """
        )
        self.execute(
            """
            CREATE TABLE IF NOT EXISTS canonical_records (
                canonical_id String,
                entity_type String,
                payload JSON,
                quality_score Float64,
                validated_at DateTime
            )
            ENGINE = MergeTree
            ORDER BY (entity_type, canonical_id, validated_at)
            """
        )
        self.execute(
            """
            CREATE TABLE IF NOT EXISTS serving_views (
                view_id String,
                entity_type String,
                payload JSON,
                refreshed_at DateTime
            )
            ENGINE = MergeTree
            ORDER BY (entity_type, view_id, refreshed_at)
            """
        )
