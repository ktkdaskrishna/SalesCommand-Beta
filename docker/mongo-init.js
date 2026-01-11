// MongoDB Initialization Script for Sales Intelligence Platform
// Creates the database structure with Data Lake zones

db = db.getSiblingDB('salesintel');

// Create collections for each Data Lake zone

// ===================== RAW ZONE =====================
// Immutable, timestamped copies of source data

db.createCollection('raw_odoo_partners', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['_raw_id', '_source', '_ingested_at', '_raw_data'],
      properties: {
        _raw_id: { bsonType: 'string', description: 'Unique raw record ID' },
        _source: { bsonType: 'string', description: 'Source system identifier' },
        _source_id: { bsonType: ['int', 'string'], description: 'ID in source system' },
        _ingested_at: { bsonType: 'date', description: 'Ingestion timestamp' },
        _sync_batch_id: { bsonType: 'string', description: 'Batch ID for replay' },
        _raw_data: { bsonType: 'object', description: 'Original unmodified data' }
      }
    }
  }
});

db.createCollection('raw_odoo_leads');
db.createCollection('raw_odoo_activities');
db.createCollection('raw_odoo_users');
db.createCollection('raw_ms365_users');

// ===================== CANONICAL ZONE =====================
// Normalized, unified data models

db.createCollection('canonical_contacts', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'name', '_sources'],
      properties: {
        id: { bsonType: 'string', description: 'Canonical entity ID' },
        name: { bsonType: 'string' },
        email: { bsonType: ['string', 'null'] },
        phone: { bsonType: ['string', 'null'] },
        company_name: { bsonType: ['string', 'null'] },
        _sources: { bsonType: 'array', description: 'Source system references' },
        _created_at: { bsonType: 'date' },
        _updated_at: { bsonType: 'date' },
        _version: { bsonType: 'int' }
      }
    }
  }
});

db.createCollection('canonical_accounts');
db.createCollection('canonical_opportunities');
db.createCollection('canonical_activities');
db.createCollection('canonical_users');

// ===================== SERVING ZONE =====================
// Dashboard-optimized, pre-aggregated views

db.createCollection('serving_dashboard_stats');
db.createCollection('serving_pipeline_summary');
db.createCollection('serving_kpi_snapshots');
db.createCollection('serving_activity_feed');
db.createCollection('serving_user_metrics');

// ===================== SYSTEM COLLECTIONS =====================

db.createCollection('sync_logs');
db.createCollection('sync_batches');
db.createCollection('audit_trail');
db.createCollection('system_config');
db.createCollection('users');
db.createCollection('sessions');

// ===================== CREATE INDEXES =====================

// Raw Zone Indexes
db.raw_odoo_partners.createIndex({ '_source_id': 1 });
db.raw_odoo_partners.createIndex({ '_ingested_at': -1 });
db.raw_odoo_partners.createIndex({ '_sync_batch_id': 1 });

db.raw_odoo_leads.createIndex({ '_source_id': 1 });
db.raw_odoo_leads.createIndex({ '_ingested_at': -1 });

db.raw_odoo_activities.createIndex({ '_source_id': 1 });
db.raw_odoo_activities.createIndex({ '_ingested_at': -1 });

// Canonical Zone Indexes
db.canonical_contacts.createIndex({ 'email': 1 });
db.canonical_contacts.createIndex({ '_sources.source': 1, '_sources.source_id': 1 });

db.canonical_accounts.createIndex({ 'name': 1 });
db.canonical_accounts.createIndex({ 'assigned_to': 1 });
db.canonical_accounts.createIndex({ '_sources.source': 1, '_sources.source_id': 1 });

db.canonical_opportunities.createIndex({ 'account_id': 1 });
db.canonical_opportunities.createIndex({ 'owner_id': 1 });
db.canonical_opportunities.createIndex({ 'stage': 1 });
db.canonical_opportunities.createIndex({ '_sources.source': 1, '_sources.source_id': 1 });

db.canonical_activities.createIndex({ 'owner_id': 1 });
db.canonical_activities.createIndex({ 'due_date': 1 });
db.canonical_activities.createIndex({ 'status': 1 });

db.canonical_users.createIndex({ 'email': 1 }, { unique: true });
db.canonical_users.createIndex({ '_sources.source': 1, '_sources.source_id': 1 });

// Serving Zone Indexes
db.serving_dashboard_stats.createIndex({ 'user_id': 1, 'period': 1 });
db.serving_pipeline_summary.createIndex({ 'user_id': 1 });
db.serving_kpi_snapshots.createIndex({ 'user_id': 1, 'date': -1 });
db.serving_activity_feed.createIndex({ 'user_id': 1, 'timestamp': -1 });

// System Indexes
db.sync_logs.createIndex({ 'batch_id': 1 });
db.sync_logs.createIndex({ 'started_at': -1 });
db.sync_logs.createIndex({ 'status': 1 });

db.audit_trail.createIndex({ 'entity_type': 1, 'entity_id': 1 });
db.audit_trail.createIndex({ 'user_id': 1 });
db.audit_trail.createIndex({ 'timestamp': -1 });

db.users.createIndex({ 'email': 1 }, { unique: true });
db.sessions.createIndex({ 'token': 1 });
db.sessions.createIndex({ 'expires_at': 1 }, { expireAfterSeconds: 0 });

print('Sales Intelligence Platform database initialized successfully!');
