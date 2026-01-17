# SalesCommand Beta — Microservices + ClickHouse Data Lake

SalesCommand is an enterprise sales intelligence platform with a modular FastAPI backend,
React frontend, and a new microservices-ready data lake backed by ClickHouse for analytics
and high-throughput ingestion.

## Architecture Overview

### Core Services
- **Frontend**: React SPA served at `http://localhost:3000`.
- **Backend API**: FastAPI service at `http://localhost:8001`.
- **MongoDB**: Transactional store for app data and configuration.
- **Redis**: Background tasks and caching.
- **ClickHouse**: Analytical data lake for raw/canonical/serving layers.

### Data Lake (ClickHouse)
The data lake uses a three-zone layout:
- **Raw (Bronze)**: Immutable ingestion of source payloads.
- **Canonical (Silver)**: Normalized, validated entities.
- **Serving (Gold)**: Aggregated views and materialized projections.

The microservices layer exposes ingestion and health endpoints so external
integrations can push events directly into ClickHouse.

## Repository Structure

```
backend/
  microservices/        # ClickHouse-backed microservices layer
  routes/               # FastAPI routes
  services/             # Existing application services
frontend/
  src/                  # React application
docker-compose.yml      # Local orchestration
```

## Local Development

### Prerequisites
- Docker + Docker Compose
- Node.js 18+ (if running frontend outside Docker)

### Start the stack
```bash
docker compose up --build
```

### Backend API
```bash
curl http://localhost:8001/health
```

### Microservices Health
```bash
curl http://localhost:8001/api/microservices/health
```

## ClickHouse Configuration

Environment variables supported:

```
CLICKHOUSE_URL=http://clickhouse:8123
CLICKHOUSE_DATABASE=salesintel
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=
```

## ClickHouse Schema

Tables created on startup by the microservices layer:

```sql
CREATE TABLE IF NOT EXISTS raw_events (
    source String,
    entity_type String,
    source_id String,
    payload JSON,
    ingested_at DateTime
) ENGINE = MergeTree
ORDER BY (entity_type, source_id, ingested_at);

CREATE TABLE IF NOT EXISTS canonical_records (
    canonical_id String,
    entity_type String,
    payload JSON,
    quality_score Float64,
    validated_at DateTime
) ENGINE = MergeTree
ORDER BY (entity_type, canonical_id, validated_at);

CREATE TABLE IF NOT EXISTS serving_views (
    view_id String,
    entity_type String,
    payload JSON,
    refreshed_at DateTime
) ENGINE = MergeTree
ORDER BY (entity_type, view_id, refreshed_at);
```

## Microservices API

### Health
`GET /api/microservices/health`

Returns status for the ClickHouse-backed data lake.

### Ingest Event
`POST /api/microservices/ingest/{source}/{entity_type}`

Request body:
```json
{
  "id": "external-id-123",
  "name": "Acme Corp",
  "updated_at": "2025-01-01T00:00:00Z"
}
```

Response:
```json
{
  "status": "accepted",
  "source_id": "external-id-123"
}
```

## Production Notes
- Use a managed ClickHouse cluster for high availability.
- Configure authentication and network controls for ClickHouse.
- Ensure raw event payloads are validated at ingestion boundaries.
