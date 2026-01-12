"""
Database Module
MongoDB connection and Data Lake zone management
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class Database:
    """MongoDB Database Manager with Data Lake Zones"""
    
    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None
    
    # Data Lake Zone Collections
    RAW_ZONE = "data_lake_raw"           # Bronze - Raw data as-is
    CANONICAL_ZONE = "data_lake_canonical"  # Silver - Normalized, validated
    SERVING_ZONE = "data_lake_serving"   # Gold - Aggregated, dashboard-ready
    
    @classmethod
    async def connect(cls, mongo_url: str, db_name: str):
        """Initialize MongoDB connection"""
        try:
            cls.client = AsyncIOMotorClient(mongo_url)
            cls.db = cls.client[db_name]
            
            # Verify connection
            await cls.client.admin.command('ping')
            logger.info(f"Connected to MongoDB: {db_name}")
            
            # Initialize Data Lake indexes
            await cls._init_data_lake_indexes()
            
            return cls.db
        except Exception as e:
            logger.error(f"MongoDB connection failed: {e}")
            raise
    
    @classmethod
    async def disconnect(cls):
        """Close MongoDB connection"""
        if cls.client:
            cls.client.close()
            logger.info("MongoDB connection closed")
    
    @classmethod
    async def _init_data_lake_indexes(cls):
        """Initialize indexes for Data Lake collections"""
        if cls.db is None:
            return
            
        # Raw Zone indexes
        await cls.db[cls.RAW_ZONE].create_index([("source", 1), ("entity_type", 1)])
        await cls.db[cls.RAW_ZONE].create_index([("ingested_at", -1)])
        await cls.db[cls.RAW_ZONE].create_index([("source_id", 1), ("source", 1)], unique=True, sparse=True)
        
        # Canonical Zone indexes
        await cls.db[cls.CANONICAL_ZONE].create_index([("entity_type", 1)])
        await cls.db[cls.CANONICAL_ZONE].create_index([("canonical_id", 1)], unique=True)
        await cls.db[cls.CANONICAL_ZONE].create_index([("source_refs.source", 1), ("source_refs.source_id", 1)])
        
        # Serving Zone indexes
        await cls.db[cls.SERVING_ZONE].create_index([("entity_type", 1)])
        await cls.db[cls.SERVING_ZONE].create_index([("serving_id", 1)], unique=True)
        await cls.db[cls.SERVING_ZONE].create_index([("last_aggregated", -1)])
        
        logger.info("Data Lake indexes initialized")
    
    @classmethod
    def get_db(cls) -> AsyncIOMotorDatabase:
        """Get database instance"""
        if not cls.db:
            raise RuntimeError("Database not connected. Call connect() first.")
        return cls.db
    
    # Convenience methods for Data Lake zones
    @classmethod
    def raw(cls):
        """Get Raw Zone collection"""
        return cls.get_db()[cls.RAW_ZONE]
    
    @classmethod
    def canonical(cls):
        """Get Canonical Zone collection"""
        return cls.get_db()[cls.CANONICAL_ZONE]
    
    @classmethod
    def serving(cls):
        """Get Serving Zone collection"""
        return cls.get_db()[cls.SERVING_ZONE]


# Dependency for FastAPI
async def get_database() -> AsyncIOMotorDatabase:
    """FastAPI dependency to get database"""
    return Database.get_db()
