"""
Salesforce Connector
====================
Handles authentication and data fetching from Salesforce REST API.

Salesforce uses OAuth 2.0 for authentication and provides a REST API
for accessing objects like Account, Contact, Opportunity, Lead, etc.

API Documentation: https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta
"""

import httpx
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, AsyncIterator
import logging

from sync_engine.base_components import BaseConnector
from core.enums import IntegrationSource


logger = logging.getLogger(__name__)


class SalesforceConnector(BaseConnector):
    """
    Connector for Salesforce CRM.
    
    Configuration required:
    - instance_url: Your Salesforce instance URL (e.g., https://yourcompany.salesforce.com)
    - access_token: OAuth 2.0 access token
    - api_version: Salesforce API version (default: v58.0)
    
    Supports fetching:
    - Contacts
    - Accounts  
    - Opportunities
    - Leads
    - Tasks/Activities
    """
    
    # Salesforce object (sObject) mappings to our entity types
    SOBJECT_MAP = {
        "contact": "Contact",
        "account": "Account",
        "opportunity": "Opportunity",
        "lead": "Lead",
        "activity": "Task",
        "user": "User",
    }
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        
        self.instance_url = config.get("instance_url", "").rstrip("/")
        self.access_token = config.get("access_token")
        self.api_version = config.get("api_version", "v58.0")
        
        self._client: Optional[httpx.AsyncClient] = None
        self._org_info: Optional[Dict] = None
    
    @property
    def source_name(self) -> str:
        return IntegrationSource.SALESFORCE.value
    
    @property
    def base_url(self) -> str:
        return f"{self.instance_url}/services/data/{self.api_version}"
    
    async def connect(self) -> bool:
        """
        Initialize HTTP client and verify connection.
        """
        if not self.instance_url or not self.access_token:
            logger.error("Missing Salesforce credentials (instance_url or access_token)")
            return False
        
        try:
            self._client = httpx.AsyncClient(
                headers={
                    "Authorization": f"Bearer {self.access_token}",
                    "Content-Type": "application/json",
                },
                timeout=30.0
            )
            
            # Test connection by fetching org info
            response = await self._client.get(f"{self.base_url}/")
            
            if response.status_code == 200:
                self._connected = True
                logger.info(f"Connected to Salesforce: {self.instance_url}")
                return True
            elif response.status_code == 401:
                logger.error("Salesforce authentication failed - token expired or invalid")
                return False
            else:
                logger.error(f"Salesforce connection failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to connect to Salesforce: {e}")
            return False
    
    async def disconnect(self) -> None:
        """Close HTTP client"""
        if self._client:
            await self._client.aclose()
            self._client = None
        self._connected = False
    
    async def test_connection(self) -> Dict[str, Any]:
        """Test connection and return status with org info"""
        try:
            connected = await self.connect()
            org_info = None
            
            if connected and self._client:
                # Get organization info
                response = await self._client.get(
                    f"{self.instance_url}/services/data/{self.api_version}/sobjects/"
                )
                if response.status_code == 200:
                    data = response.json()
                    org_info = {
                        "encoding": data.get("encoding"),
                        "max_batch_size": data.get("maxBatchSize"),
                        "sobjects_count": len(data.get("sobjects", []))
                    }
            
            return {
                "connected": connected,
                "source": self.source_name,
                "instance_url": self.instance_url,
                "api_version": self.api_version,
                "org_info": org_info,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        except Exception as e:
            return {
                "connected": False,
                "source": self.source_name,
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        finally:
            await self.disconnect()
    
    async def fetch_records(
        self,
        entity_type: str,
        since: Optional[datetime] = None,
        batch_size: int = 200  # Salesforce max is 2000, but 200 is recommended
    ) -> AsyncIterator[Dict[str, Any]]:
        """
        Fetch records from Salesforce using SOQL queries.
        
        Args:
            entity_type: Our entity type (contact, account, opportunity)
            since: For incremental sync - fetch records modified after this time
            batch_size: Records per request (Salesforce handles pagination)
            
        Yields:
            Individual records from Salesforce
        """
        if not self._connected or not self._client:
            raise RuntimeError("Not connected to Salesforce")
        
        sobject = self.SOBJECT_MAP.get(entity_type)
        if not sobject:
            raise ValueError(f"Unknown entity type: {entity_type}")
        
        # Get fields for this object
        fields = await self._get_object_fields(sobject, entity_type)
        
        # Build SOQL query
        query = self._build_soql_query(sobject, fields, since)
        
        logger.info(f"Fetching {entity_type} from Salesforce with query: {query[:100]}...")
        
        # Execute query with pagination
        next_url = f"{self.base_url}/query?q={query}"
        total_fetched = 0
        
        while next_url:
            response = await self._client.get(next_url)
            
            if response.status_code != 200:
                logger.error(f"Salesforce query failed: {response.text}")
                break
            
            data = response.json()
            records = data.get("records", [])
            
            for record in records:
                # Remove Salesforce metadata attributes
                clean_record = {k: v for k, v in record.items() if not k.startswith("attributes")}
                yield clean_record
                total_fetched += 1
            
            # Check for more records (pagination)
            if data.get("done", True):
                next_url = None
            else:
                next_url = f"{self.instance_url}{data.get('nextRecordsUrl')}"
        
        logger.info(f"Fetched {total_fetched} {entity_type} records from Salesforce")
    
    async def fetch_record(
        self,
        entity_type: str,
        record_id: str
    ) -> Optional[Dict[str, Any]]:
        """Fetch a single record by Salesforce ID"""
        if not self._connected or not self._client:
            raise RuntimeError("Not connected to Salesforce")
        
        sobject = self.SOBJECT_MAP.get(entity_type)
        if not sobject:
            raise ValueError(f"Unknown entity type: {entity_type}")
        
        url = f"{self.base_url}/sobjects/{sobject}/{record_id}"
        response = await self._client.get(url)
        
        if response.status_code == 200:
            record = response.json()
            return {k: v for k, v in record.items() if not k.startswith("attributes")}
        elif response.status_code == 404:
            return None
        else:
            logger.error(f"Failed to fetch record {record_id}: {response.text}")
            return None
    
    async def get_record_count(
        self,
        entity_type: str,
        since: Optional[datetime] = None
    ) -> int:
        """Get count of records for planning"""
        if not self._connected or not self._client:
            raise RuntimeError("Not connected to Salesforce")
        
        sobject = self.SOBJECT_MAP.get(entity_type)
        if not sobject:
            raise ValueError(f"Unknown entity type: {entity_type}")
        
        # Build count query
        query = f"SELECT COUNT() FROM {sobject}"
        if since:
            query += f" WHERE LastModifiedDate >= {since.strftime('%Y-%m-%dT%H:%M:%SZ')}"
        
        response = await self._client.get(f"{self.base_url}/query?q={query}")
        
        if response.status_code == 200:
            return response.json().get("totalSize", 0)
        return 0
    
    async def _get_object_fields(self, sobject: str, entity_type: str) -> List[str]:
        """
        Get relevant fields for an object.
        Returns a curated list of fields based on entity type.
        """
        # Define fields we want for each entity type
        # (In production, you might fetch this dynamically or from config)
        
        field_map = {
            "contact": [
                "Id", "FirstName", "LastName", "Name", "Email", "Phone", "MobilePhone",
                "Title", "Department", "AccountId", "Account.Name",
                "MailingStreet", "MailingCity", "MailingState", "MailingPostalCode", "MailingCountry",
                "OwnerId", "Owner.Name", "CreatedDate", "LastModifiedDate", "IsDeleted"
            ],
            "account": [
                "Id", "Name", "Website", "Industry", "NumberOfEmployees", "AnnualRevenue",
                "Phone", "Type", "Description",
                "BillingStreet", "BillingCity", "BillingState", "BillingPostalCode", "BillingCountry",
                "OwnerId", "Owner.Name", "CreatedDate", "LastModifiedDate", "IsDeleted"
            ],
            "opportunity": [
                "Id", "Name", "AccountId", "Account.Name", "ContactId",
                "Amount", "Probability", "StageName", "Type", "LeadSource",
                "CloseDate", "IsClosed", "IsWon", "NextStep", "Description",
                "OwnerId", "Owner.Name", "CreatedDate", "LastModifiedDate", "IsDeleted"
            ],
            "lead": [
                "Id", "FirstName", "LastName", "Name", "Email", "Phone", "Company",
                "Title", "Industry", "Status", "Rating", "LeadSource",
                "Street", "City", "State", "PostalCode", "Country",
                "OwnerId", "Owner.Name", "CreatedDate", "LastModifiedDate", "IsDeleted", "IsConverted"
            ],
            "activity": [
                "Id", "Subject", "Description", "Status", "Priority",
                "ActivityDate", "WhoId", "WhatId", "OwnerId",
                "TaskSubtype", "CreatedDate", "LastModifiedDate", "IsDeleted"
            ],
            "user": [
                "Id", "Username", "Email", "FirstName", "LastName", "Name",
                "Title", "Department", "IsActive", "CreatedDate", "LastModifiedDate"
            ]
        }
        
        return field_map.get(entity_type, ["Id", "Name", "CreatedDate", "LastModifiedDate"])
    
    def _build_soql_query(
        self,
        sobject: str,
        fields: List[str],
        since: Optional[datetime] = None
    ) -> str:
        """Build SOQL query string"""
        import urllib.parse
        
        fields_str = ", ".join(fields)
        query = f"SELECT {fields_str} FROM {sobject}"
        
        conditions = []
        
        # Incremental sync filter
        if since:
            conditions.append(f"LastModifiedDate >= {since.strftime('%Y-%m-%dT%H:%M:%SZ')}")
        
        # Exclude deleted records (optional - could include for full audit)
        # conditions.append("IsDeleted = false")
        
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        
        query += " ORDER BY LastModifiedDate ASC"
        
        return urllib.parse.quote(query, safe='')
