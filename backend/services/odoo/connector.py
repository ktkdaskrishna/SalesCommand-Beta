"""
Odoo REST API Connector
Supports Odoo 16+ with REST/JSON-RPC API
"""
import httpx
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class OdooConnector:
    """
    Odoo REST API Connector for v16+
    Uses JSON-RPC for authenticated API calls
    """
    
    def __init__(
        self,
        url: str,
        database: str,
        username: str,
        api_key: str
    ):
        # Normalize URL - extract base URL without paths like /odoo, /web, etc.
        self.url = self._normalize_url(url)
        self.database = database
        self.username = username
        self.api_key = api_key
        self.uid: Optional[int] = None
        self._client: Optional[httpx.AsyncClient] = None
    
    def _normalize_url(self, url: str) -> str:
        """
        Normalize Odoo URL to base URL.
        Handles: https://example.odoo.com/odoo -> https://example.odoo.com
        """
        url = url.rstrip('/')
        # Remove common Odoo path suffixes
        suffixes_to_remove = ['/odoo', '/web', '/jsonrpc', '/xmlrpc']
        for suffix in suffixes_to_remove:
            if url.lower().endswith(suffix):
                url = url[:-len(suffix)]
        return url
    
    async def __aenter__(self):
        """Async context manager entry"""
        self._client = httpx.AsyncClient(timeout=30.0)
        await self.authenticate()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self._client:
            await self._client.aclose()
    
    async def authenticate(self) -> bool:
        """
        Authenticate with Odoo and get user ID.
        Uses JSON-RPC authentication endpoint.
        """
        try:
            endpoint = f"{self.url}/jsonrpc"
            logger.info(f"Attempting Odoo authentication at: {endpoint}")
            
            payload = {
                "jsonrpc": "2.0",
                "method": "call",
                "params": {
                    "service": "common",
                    "method": "authenticate",
                    "args": [self.database, self.username, self.api_key, {}]
                },
                "id": 1
            }
            
            response = await self._client.post(endpoint, json=payload)
            response.raise_for_status()
            result = response.json()
            
            if result.get("result"):
                self.uid = result["result"]
                logger.info(f"Odoo authentication successful. UID: {self.uid}")
                return True
            elif result.get("error"):
                error_data = result.get("error", {})
                error_msg = error_data.get("data", {}).get("message") or error_data.get("message", "Unknown error")
                logger.error(f"Odoo authentication failed: {error_msg}")
                raise Exception(f"Authentication failed: {error_msg}")
            else:
                # UID is False means invalid credentials
                logger.error("Odoo authentication failed: Invalid credentials")
                raise Exception("Invalid credentials - please check username and API key")
                
        except httpx.HTTPStatusError as e:
            logger.error(f"Odoo HTTP error: {e}")
            raise Exception(f"HTTP error {e.response.status_code}: Check if URL is correct")
        except httpx.ConnectError as e:
            logger.error(f"Odoo connection error: {e}")
            raise Exception(f"Cannot connect to Odoo server. Check the URL.")
        except Exception as e:
            logger.error(f"Odoo authentication error: {e}")
            raise
    
    async def execute(
        self,
        model: str,
        method: str,
        args: List = None,
        kwargs: Dict = None
    ) -> Any:
        """
        Execute a method on an Odoo model via JSON-RPC.
        """
        if not self.uid:
            raise RuntimeError("Not authenticated. Call authenticate() first.")
        
        args = args or []
        kwargs = kwargs or {}
        
        endpoint = f"{self.url}/jsonrpc"
        payload = {
            "jsonrpc": "2.0",
            "method": "call",
            "params": {
                "service": "object",
                "method": "execute_kw",
                "args": [
                    self.database,
                    self.uid,
                    self.api_key,
                    model,
                    method,
                    args,
                    kwargs
                ]
            },
            "id": 2
        }
        
        response = await self._client.post(endpoint, json=payload)
        response.raise_for_status()
        result = response.json()
        
        if "error" in result:
            error_msg = result["error"].get("message", str(result["error"]))
            raise Exception(f"Odoo API error: {error_msg}")
        
        return result.get("result")
    
    async def search_read(
        self,
        model: str,
        domain: List = None,
        fields: List[str] = None,
        offset: int = 0,
        limit: int = 100,
        order: str = None
    ) -> List[Dict[str, Any]]:
        """
        Search and read records from Odoo model.
        Most efficient method for data extraction.
        """
        domain = domain or []
        kwargs = {
            "offset": offset,
            "limit": limit
        }
        if fields:
            kwargs["fields"] = fields
        if order:
            kwargs["order"] = order
        
        return await self.execute(model, "search_read", [domain], kwargs)
    
    async def search_count(self, model: str, domain: List = None) -> int:
        """Count records matching domain"""
        domain = domain or []
        return await self.execute(model, "search_count", [domain])
    
    async def fields_get(
        self,
        model: str,
        attributes: List[str] = None
    ) -> Dict[str, Any]:
        """
        Get field definitions for a model.
        Essential for dynamic field mapping.
        """
        attributes = attributes or ["string", "type", "required", "readonly", "relation"]
        return await self.execute(model, "fields_get", [], {"attributes": attributes})
    
    async def read(
        self,
        model: str,
        ids: List[int],
        fields: List[str] = None
    ) -> List[Dict[str, Any]]:
        """Read specific records by ID"""
        kwargs = {}
        if fields:
            kwargs["fields"] = fields
        return await self.execute(model, "read", [ids], kwargs)
    
    # ===================== CONVENIENCE METHODS =====================
    
    async def get_partners(
        self,
        domain: List = None,
        limit: int = 100,
        offset: int = 0,
        modified_since: datetime = None
    ) -> List[Dict[str, Any]]:
        """
        Get partners (customers/companies) from Odoo.
        Maps to Accounts in our system.
        """
        domain = domain or []
        if modified_since:
            domain.append(("write_date", ">=", modified_since.isoformat()))
        
        fields = [
            "id", "name", "email", "phone", "mobile",
            "street", "street2", "city", "state_id", "country_id", "zip",
            "website", "industry_id", "company_type", "is_company",
            "parent_id", "child_ids", "user_id",
            "credit_limit", "total_invoiced", "total_due",
            "create_date", "write_date"
        ]
        
        return await self.search_read(
            "res.partner",
            domain=domain,
            fields=fields,
            offset=offset,
            limit=limit,
            order="write_date desc"
        )
    
    async def get_opportunities(
        self,
        domain: List = None,
        limit: int = 100,
        offset: int = 0,
        modified_since: datetime = None
    ) -> List[Dict[str, Any]]:
        """
        Get CRM opportunities/leads from Odoo.
        """
        domain = domain or []
        if modified_since:
            domain.append(("write_date", ">=", modified_since.isoformat()))
        
        fields = [
            "id", "name", "partner_id", "user_id",
            "expected_revenue", "probability", "stage_id",
            "date_deadline", "date_closed",
            "description", "priority", "type",
            "create_date", "write_date"
        ]
        
        return await self.search_read(
            "crm.lead",
            domain=domain,
            fields=fields,
            offset=offset,
            limit=limit,
            order="write_date desc"
        )
    
    async def get_sale_orders(
        self,
        domain: List = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get sale orders from Odoo"""
        domain = domain or []
        
        fields = [
            "id", "name", "partner_id", "user_id",
            "amount_total", "amount_untaxed", "amount_tax",
            "state", "date_order", "commitment_date",
            "invoice_status", "order_line",
            "create_date", "write_date"
        ]
        
        return await self.search_read(
            "sale.order",
            domain=domain,
            fields=fields,
            offset=offset,
            limit=limit,
            order="date_order desc"
        )
    
    async def get_invoices(
        self,
        domain: List = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get invoices from Odoo"""
        base_domain = [("move_type", "in", ["out_invoice", "out_refund"])]
        if domain:
            base_domain.extend(domain)
        
        fields = [
            "id", "name", "partner_id", "user_id",
            "amount_total", "amount_residual", "amount_paid",
            "state", "payment_state", "invoice_date", "invoice_date_due",
            "create_date", "write_date"
        ]
        
        return await self.search_read(
            "account.move",
            domain=base_domain,
            fields=fields,
            offset=offset,
            limit=limit,
            order="invoice_date desc"
        )
    
    async def test_connection(self) -> Dict[str, Any]:
        """Test connection and return server info"""
        try:
            endpoint = f"{self.url}/jsonrpc"
            payload = {
                "jsonrpc": "2.0",
                "method": "call",
                "params": {
                    "service": "common",
                    "method": "version",
                    "args": []
                },
                "id": 0
            }
            
            response = await self._client.post(endpoint, json=payload)
            response.raise_for_status()
            result = response.json()
            
            version_info = result.get("result", {})
            
            return {
                "connected": True,
                "server_version": version_info.get("server_version", "unknown"),
                "server_serie": version_info.get("server_serie", "unknown"),
                "protocol_version": version_info.get("protocol_version", 1)
            }
        except Exception as e:
            return {
                "connected": False,
                "error": str(e)
            }
