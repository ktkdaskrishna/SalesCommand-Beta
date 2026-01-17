"""
Microservices architecture endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException

from core.config import settings
from microservices.clickhouse_client import ClickHouseClient
from microservices.data_lake_service import DataLakeService
from microservices.streaming_service import StreamingService

router = APIRouter(prefix="/microservices", tags=["Microservices"])


def get_clickhouse_client() -> ClickHouseClient:
    if not settings.CLICKHOUSE_URL:
        raise HTTPException(status_code=503, detail="ClickHouse is not configured")
    return ClickHouseClient(
        settings.CLICKHOUSE_URL,
        settings.CLICKHOUSE_DATABASE,
        user=settings.CLICKHOUSE_USER,
        password=settings.CLICKHOUSE_PASSWORD,
    )


def get_data_lake_service(
    client: ClickHouseClient = Depends(get_clickhouse_client),
) -> DataLakeService:
    return DataLakeService(client)


def get_streaming_service(
    data_lake: DataLakeService = Depends(get_data_lake_service),
) -> StreamingService:
    return StreamingService(data_lake)


@router.get("/health")
def microservices_health(
    data_lake: DataLakeService = Depends(get_data_lake_service),
):
    return {"services": {"data_lake": data_lake.health()}}


@router.post("/ingest/{source}/{entity_type}")
def ingest_event(
    source: str,
    entity_type: str,
    payload: dict,
    streaming: StreamingService = Depends(get_streaming_service),
):
    source_id = streaming.ingest_event(source, entity_type, payload)
    return {"status": "accepted", "source_id": source_id}
