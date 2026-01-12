# Data Lake Architecture - Complete Guide

## Overview

Your Sales Intelligence Platform uses a **Medallion Architecture** (also known as Bronze-Silver-Gold) to progressively refine and optimize data quality.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   ODOO ERP  │────▶│  RAW ZONE   │────▶│   MAPPING   │────▶│  CANONICAL  │────▶│  SERVING    │
│   (Source)  │     │  (Bronze)   │     │ (Transform) │     │   (Silver)  │     │   (Gold)    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                          │                    │                    │                    │
                    Original Odoo        Field Mapping        Standardized         Dashboard
                    JSON format          Odoo→Canonical       Schema              Ready Data
```

---

## Zone Details

### 1. Raw Zone (Bronze Layer)
**Collection:** `data_lake_raw`

**Purpose:** Store exact copy of source data for audit trail and reprocessing

**What's Stored:**
- Original Odoo field names (`partner_id`, `expected_revenue`, `stage_id`)
- Exact data types from source
- Timestamp of ingestion
- Source system identifier
- Checksum for change detection

**Example Record:**
```json
{
  "id": "276c0572-9513-4b7f-a2c5-02ede05f5b7d",
  "source": "odoo",
  "source_id": "3",
  "entity_type": "opportunity",
  "raw_data": {
    "id": 3,
    "name": "DAM OPE",
    "partner_id": false,
    "user_id": [2, "krishna@securado.net"],
    "expected_revenue": 0,
    "probability": 0,
    "stage_id": [1, "New"],
    "create_date": "2024-12-14 07:40:53",
    "write_date": "2025-01-01 00:00:00"
  },
  "ingested_at": "2026-01-12T15:16:43.123Z",
  "sync_batch_id": "52adfca6-6ab2-4b3d-823d-ed7a56af0ea2"
}
```

---

### 2. Field Mapping (Transform Layer)
**File:** `/app/backend/services/sync/service.py`

**Purpose:** Convert source-specific field names to a standard canonical schema

**How It Works:**

```
ODOO FORMAT                    →    CANONICAL FORMAT
─────────────────────────────────────────────────────
partner_id                     →    account_id
expected_revenue               →    value
stage_id                       →    stage
user_id                        →    owner_id, owner_name
create_date                    →    created_date
write_date                     →    modified_date
```

**The Mapping Code:**
```python
def _normalize_odoo_record(self, record, entity_type):
    if entity_type == EntityType.OPPORTUNITY:
        return {
            "name": record.get("name", ""),
            "account_id": self._extract_id(record.get("partner_id")),
            "account_name": self._extract_name(record.get("partner_id")),
            "value": record.get("expected_revenue") or 0,
            "probability": record.get("probability") or 0,
            "stage": self._extract_name(record.get("stage_id")),
            "owner_id": self._extract_id(record.get("user_id")),
            "owner_name": self._extract_name(record.get("user_id")),
            "created_date": record.get("create_date"),
            "modified_date": record.get("write_date"),
        }
```

**AI-Powered Mapping (Phase 3):**
- GPT-5.2 analyzes source fields and target schema
- Suggests mappings with confidence scores
- Human approves/rejects suggestions
- System learns from approved mappings

---

### 3. Canonical Zone (Silver Layer)
**Collection:** `data_lake_canonical`

**Purpose:** Single source of truth with validated, standardized data

**What's Stored:**
- Standardized field names (`account_id`, `value`, `stage`)
- Validation status (valid/invalid)
- Quality score (0-100%)
- Source references for lineage
- First seen / last updated timestamps

**Example Record:**
```json
{
  "canonical_id": "opp-3-odoo",
  "entity_type": "opportunity",
  "data": {
    "name": "DAM OPE",
    "account_id": null,
    "account_name": "",
    "value": 0,
    "probability": 0,
    "stage": "New",
    "owner_id": "2",
    "owner_name": "krishna@securado.net",
    "created_date": "2024-12-14 07:40:53",
    "modified_date": "2025-01-01 00:00:00"
  },
  "source_refs": [
    {"source": "odoo", "source_id": "3"}
  ],
  "validation_status": "valid",
  "quality_score": 1.0,
  "first_seen": "2026-01-12T15:16:43.123Z",
  "last_updated": "2026-01-12T15:16:43.123Z"
}
```

---

### 4. Serving Zone (Gold Layer)
**Collection:** `data_lake_serving`

**Purpose:** Optimized for fast dashboard queries

**What's Stored:**
- Aggregated, denormalized data
- Indexed for common queries
- Cache-friendly structure
- Links to canonical records

**Example Record:**
```json
{
  "serving_id": "3",
  "entity_type": "opportunity",
  "data": {
    "id": "3",
    "name": "DAM OPE",
    "value": 0,
    "probability": 0,
    "stage": "New",
    "owner_name": "krishna@securado.net"
  },
  "canonical_refs": ["3"],
  "aggregation_type": "single",
  "last_aggregated": "2026-01-12T15:16:43.123Z"
}
```

---

## Sync Flow (Step by Step)

When you click **"Sync Now"**:

```
1. CONNECT TO ODOO
   └── Authenticate via JSON-RPC
   └── Get user ID (uid)

2. FETCH DATA
   └── Call search_read on crm.lead model
   └── Get all opportunities with fields
   └── Paginate if > 100 records

3. INGEST TO RAW ZONE
   └── Save exact Odoo JSON
   └── Add source metadata
   └── Calculate checksum
   └── Detect if record changed

4. TRANSFORM (MAPPING)
   └── Apply field mappings
   └── Extract IDs from many2one fields
   └── Convert dates to ISO format

5. LOAD TO CANONICAL
   └── Validate required fields
   └── Calculate quality score
   └── Update or insert record

6. AGGREGATE TO SERVING
   └── Denormalize for queries
   └── Update indexes
   └── Mark as fresh

7. UPDATE JOB STATUS
   └── Record counts
   └── Mark as completed
   └── Update last_sync timestamp
```

---

## Why Three Zones?

| Concern | Raw | Canonical | Serving |
|---------|-----|-----------|---------|
| **Audit Trail** | ✅ Original data preserved | ❌ | ❌ |
| **Reprocessing** | ✅ Can re-run transforms | ❌ | ❌ |
| **Multi-Source Merge** | ❌ | ✅ Same schema | ❌ |
| **Data Quality** | ❌ | ✅ Validated | ❌ |
| **Dashboard Speed** | ❌ | ❌ | ✅ Indexed |
| **Historical Tracking** | ✅ | ✅ first_seen | ❌ |

---

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/data-lake/health` | Zone counts and quality metrics |
| `GET /api/data-lake/raw` | Query raw zone (admin only) |
| `GET /api/data-lake/canonical` | Query canonical zone |
| `GET /api/data-lake/serving` | Query serving zone (dashboard) |
| `GET /api/data-lake/serving/{entity_type}` | Get accounts/opportunities |

---

## Future Enhancements

1. **AI Field Mapping (Phase 3)**
   - GPT-5.2 suggests mappings
   - Confidence scores
   - Learning from approvals

2. **Multi-Source Merge**
   - Odoo + Salesforce → Unified accounts
   - Deduplication logic
   - Master data management

3. **Incremental Sync**
   - Only sync changed records
   - Use Odoo's `write_date` filter
   - Reduce API calls

4. **Data Quality Rules**
   - Required field validation
   - Format validation (email, phone)
   - Business rule validation
