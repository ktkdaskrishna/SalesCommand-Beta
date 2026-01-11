"""
Microsoft 365 Connector
Fetches data from Microsoft Graph API
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, AsyncIterator
import httpx
import logging

from sync_engine.base_components import BaseConnector
from core.enums import IntegrationSource


logger = logging.getLogger(__name__)


class MS365Connector(BaseConnector):
    """
    Connector for Microsoft 365 / Graph API.
    
    Supports syncing:
    - Users from Azure AD
    - Contacts from Outlook
    - Calendar events
    """
    
    GRAPH_API = "https://graph.microsoft.com/v1.0"
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.access_token = config.get("access_token")
        self._client: Optional[httpx.AsyncClient] = None
    
    @property
    def source_name(self) -> str:
        return IntegrationSource.MICROSOFT365.value
    
    async def connect(self) -> bool:
        """Initialize HTTP client"""
        if not self.access_token:
            logger.error("No access token provided")
            return False
        
        self._client = httpx.AsyncClient(
            headers={"Authorization": f"Bearer {self.access_token}"},
            timeout=30.0
        )
        
        # Test connection
        try:
            response = await self._client.get(f"{self.GRAPH_API}/me")
            if response.status_code == 200:
                self._connected = True
                return True
            else:
                logger.error(f"Connection test failed: {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"Connection failed: {e}")
            return False
    
    async def disconnect(self) -> None:
        """Close HTTP client"""
        if self._client:
            await self._client.aclose()
            self._client = None
        self._connected = False
    
    async def test_connection(self) -> Dict[str, Any]:
        """Test Graph API connection"""
        try:
            connected = await self.connect()
            user_info = None
            
            if connected and self._client:
                response = await self._client.get(f"{self.GRAPH_API}/me")
                if response.status_code == 200:
                    user_info = response.json()
            
            return {
                "connected": connected,
                "source": self.source_name,
                "user": user_info.get("displayName") if user_info else None,
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
        batch_size: int = 100
    ) -> AsyncIterator[Dict[str, Any]]:
        """
        Fetch records from Graph API with pagination.
        """
        if not self._connected or not self._client:
            raise RuntimeError("Not connected to Microsoft Graph")
        
        endpoint = self._get_endpoint(entity_type)
        params = {"$top": batch_size}
        
        # Add filter for incremental sync
        if since:
            params["$filter"] = f"lastModifiedDateTime ge {since.isoformat()}"
        
        url = f"{self.GRAPH_API}{endpoint}"
        
        while url:
            response = await self._client.get(url, params=params if '?' not in url else None)
            
            if response.status_code != 200:
                logger.error(f"Graph API error: {response.text}")
                break
            
            data = response.json()
            
            for record in data.get("value", []):
                yield record
            
            # Handle pagination
            url = data.get("@odata.nextLink")
            params = {}  # Params are in the nextLink URL
    
    async def fetch_record(
        self,
        entity_type: str,
        record_id: Any
    ) -> Optional[Dict[str, Any]]:
        """Fetch a single record by ID"""
        if not self._connected or not self._client:
            raise RuntimeError("Not connected")
        
        endpoint = self._get_endpoint(entity_type)
        url = f"{self.GRAPH_API}{endpoint}/{record_id}"
        
        response = await self._client.get(url)
        
        if response.status_code == 200:
            return response.json()
        return None
    
    async def get_record_count(
        self,
        entity_type: str,
        since: Optional[datetime] = None
    ) -> int:
        """Get count of records"""
        if not self._connected or not self._client:
            raise RuntimeError("Not connected")
        
        endpoint = self._get_endpoint(entity_type)
        params = {"$count": "true", "$top": 0}
        
        if since:
            params["$filter"] = f"lastModifiedDateTime ge {since.isoformat()}"
        
        response = await self._client.get(
            f"{self.GRAPH_API}{endpoint}",
            params=params,
            headers={"ConsistencyLevel": "eventual"}
        )
        
        if response.status_code == 200:
            return response.json().get("@odata.count", 0)
        return 0
    
    def _get_endpoint(self, entity_type: str) -> str:
        """Get Graph API endpoint for entity type"""
        endpoints = {
            "user": "/users",
            "contact": "/me/contacts",
            "event": "/me/events",
            "mail": "/me/messages",
        }
        
        if entity_type not in endpoints:
            raise ValueError(f"Unknown entity type: {entity_type}")
        
        return endpoints[entity_type]
