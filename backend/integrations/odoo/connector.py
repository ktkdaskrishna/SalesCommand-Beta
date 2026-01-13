"""
Odoo Connector
Handles connection and data fetching from Odoo ERP via JSON-RPC/XML-RPC
"""

import xmlrpc.client
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, AsyncIterator
import asyncio
import logging

from sync_engine.base_components import BaseConnector
from core.enums import IntegrationSource


logger = logging.getLogger(__name__)


class OdooConnector(BaseConnector):
    """
    Connector for Odoo ERP systems.
    Supports Odoo v17, v18, and v19.
    Uses XML-RPC for compatibility.
    """
    
    # Odoo model mappings
    MODEL_MAP = {
        "contact": "res.partner",
        "account": "res.partner",  # Companies are also partners in Odoo
        "opportunity": "crm.lead",
        "activity": "mail.activity",
        "user": "res.users",
        "employee": "hr.employee",
        "department": "hr.department",
    }
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.url = config.get("url", "").rstrip("/")
        self.database = config.get("database")
        self.username = config.get("username")
        self.api_key = config.get("api_key")
        
        self._uid = None
        self._common = None
        self._models = None
        self._version_info = None
    
    @property
    def source_name(self) -> str:
        return IntegrationSource.ODOO.value
    
    async def connect(self) -> bool:
        """Establish connection to Odoo"""
        try:
            # Run XML-RPC calls in thread pool (they're blocking)
            loop = asyncio.get_event_loop()
            
            # Connect to common endpoint
            self._common = xmlrpc.client.ServerProxy(
                f"{self.url}/xmlrpc/2/common",
                allow_none=True
            )
            
            # Get version info
            self._version_info = await loop.run_in_executor(
                None, self._common.version
            )
            
            # Authenticate
            self._uid = await loop.run_in_executor(
                None,
                lambda: self._common.authenticate(
                    self.database,
                    self.username,
                    self.api_key,
                    {}
                )
            )
            
            if not self._uid:
                logger.error("Odoo authentication failed")
                return False
            
            # Connect to models endpoint
            self._models = xmlrpc.client.ServerProxy(
                f"{self.url}/xmlrpc/2/object",
                allow_none=True
            )
            
            self._connected = True
            logger.info(f"Connected to Odoo {self._version_info.get('server_version', 'unknown')}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to Odoo: {e}")
            self._connected = False
            return False
    
    async def disconnect(self) -> None:
        """Close Odoo connection"""
        self._uid = None
        self._common = None
        self._models = None
        self._connected = False
    
    async def test_connection(self) -> Dict[str, Any]:
        """Test connection and return status"""
        try:
            connected = await self.connect()
            return {
                "connected": connected,
                "source": self.source_name,
                "version": self._version_info.get("server_version") if self._version_info else None,
                "database": self.database,
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
        Fetch records from Odoo with pagination.
        
        Args:
            entity_type: Type of entity (contact, opportunity, etc.)
            since: Only fetch records modified since this time
            batch_size: Number of records per batch
            
        Yields:
            Individual records from Odoo
        """
        if not self._connected:
            raise RuntimeError("Not connected to Odoo")
        
        model = self.MODEL_MAP.get(entity_type)
        if not model:
            raise ValueError(f"Unknown entity type: {entity_type}")
        
        # Build domain filter
        domain = self._build_domain(entity_type, since)
        
        # Get fields to fetch
        fields = self._get_fields_for_model(model, entity_type)
        
        # Get total count
        loop = asyncio.get_event_loop()
        total = await loop.run_in_executor(
            None,
            lambda: self._models.execute_kw(
                self.database, self._uid, self.api_key,
                model, 'search_count', [domain]
            )
        )
        
        logger.info(f"Fetching {total} {entity_type} records from Odoo")
        
        # Fetch in batches
        offset = 0
        while offset < total:
            records = await loop.run_in_executor(
                None,
                lambda o=offset: self._models.execute_kw(
                    self.database, self._uid, self.api_key,
                    model, 'search_read',
                    [domain],
                    {
                        'fields': fields,
                        'limit': batch_size,
                        'offset': o,
                        'order': 'write_date asc'
                    }
                )
            )
            
            for record in records:
                yield record
            
            offset += batch_size
    
    async def fetch_record(
        self,
        entity_type: str,
        record_id: Any
    ) -> Optional[Dict[str, Any]]:
        """Fetch a single record by ID"""
        if not self._connected:
            raise RuntimeError("Not connected to Odoo")
        
        model = self.MODEL_MAP.get(entity_type)
        if not model:
            raise ValueError(f"Unknown entity type: {entity_type}")
        
        fields = self._get_fields_for_model(model, entity_type)
        
        loop = asyncio.get_event_loop()
        records = await loop.run_in_executor(
            None,
            lambda: self._models.execute_kw(
                self.database, self._uid, self.api_key,
                model, 'read',
                [[int(record_id)]],
                {'fields': fields}
            )
        )
        
        return records[0] if records else None
    
    async def get_record_count(
        self,
        entity_type: str,
        since: Optional[datetime] = None
    ) -> int:
        """Get count of records"""
        if not self._connected:
            raise RuntimeError("Not connected to Odoo")
        
        model = self.MODEL_MAP.get(entity_type)
        if not model:
            raise ValueError(f"Unknown entity type: {entity_type}")
        
        domain = self._build_domain(entity_type, since)
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self._models.execute_kw(
                self.database, self._uid, self.api_key,
                model, 'search_count', [domain]
            )
        )
    
    async def get_available_fields(self, model: str) -> Dict[str, Any]:
        """Get field definitions for a model"""
        if not self._connected:
            raise RuntimeError("Not connected to Odoo")
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self._models.execute_kw(
                self.database, self._uid, self.api_key,
                model, 'fields_get',
                [],
                {'attributes': ['string', 'type', 'required', 'relation']}
            )
        )
    
    def _build_domain(
        self,
        entity_type: str,
        since: Optional[datetime] = None
    ) -> List[Any]:
        """Build Odoo domain filter"""
        domain = []
        
        # Entity-specific filters
        if entity_type == "contact":
            domain.append(('is_company', '=', False))
        elif entity_type == "account":
            domain.append(('is_company', '=', True))
        elif entity_type == "opportunity":
            # Include both leads and opportunities
            pass
        
        # Incremental filter
        if since:
            domain.append(('write_date', '>=', since.strftime('%Y-%m-%d %H:%M:%S')))
        
        # Exclude archived/inactive
        domain.append(('active', '=', True))
        
        return domain
    
    def _get_fields_for_model(self, model: str, entity_type: str) -> List[str]:
        """Get list of fields to fetch for a model"""
        base_fields = ['id', 'name', 'create_date', 'write_date', 'active']
        
        if model == 'res.partner':
            return base_fields + [
                'email', 'phone', 'mobile', 'website',
                'street', 'city', 'state_id', 'country_id', 'zip',
                'is_company', 'parent_id', 'function', 'title',
                'user_id', 'team_id', 'category_id',
                'comment', 'industry_id', 'employee'
            ]
        
        elif model == 'crm.lead':
            return base_fields + [
                'email_from', 'phone', 'mobile',
                'partner_id', 'contact_name',
                'expected_revenue', 'probability',
                'stage_id', 'type', 'priority',
                'date_deadline', 'date_closed',
                'user_id', 'team_id',
                'description', 'tag_ids',
                'lost_reason_id', 'won_status'
            ]
        
        elif model == 'mail.activity':
            return base_fields + [
                'activity_type_id', 'summary', 'note',
                'date_deadline', 'res_model', 'res_id',
                'user_id', 'state'
            ]
        
        elif model == 'res.users':
            return base_fields + [
                'login', 'email', 'partner_id',
                'groups_id', 'company_id'
            ]
        
        elif model == 'hr.department':
            return base_fields + [
                'complete_name', 'parent_id', 'manager_id',
                'company_id', 'member_ids', 'note'
            ]
        
        elif model == 'hr.employee':
            return base_fields + [
                'work_email', 'work_phone', 'mobile_phone',
                'department_id', 'job_id', 'job_title',
                'parent_id', 'coach_id', 'user_id',
                'company_id', 'resource_calendar_id'
            ]
        
        return base_fields

    async def fetch_departments(self) -> List[Dict[str, Any]]:
        """
        Fetch all departments from Odoo hr.department model.
        Departments are the source of truth from Odoo.
        """
        if not self._connected:
            await self.connect()
        
        if not self._connected:
            raise RuntimeError("Cannot connect to Odoo")
        
        model = 'hr.department'
        fields = self._get_fields_for_model(model, 'department')
        domain = [('active', '=', True)]
        
        loop = asyncio.get_event_loop()
        
        try:
            records = await loop.run_in_executor(
                None,
                lambda: self._models.execute_kw(
                    self.database, self._uid, self.api_key,
                    model, 'search_read',
                    [domain],
                    {'fields': fields}
                )
            )
            
            departments = []
            for rec in records:
                departments.append({
                    'odoo_id': rec.get('id'),
                    'name': rec.get('name'),
                    'complete_name': rec.get('complete_name'),
                    'parent_id': rec.get('parent_id')[0] if rec.get('parent_id') else None,
                    'parent_name': rec.get('parent_id')[1] if rec.get('parent_id') else None,
                    'manager_id': rec.get('manager_id')[0] if rec.get('manager_id') else None,
                    'manager_name': rec.get('manager_id')[1] if rec.get('manager_id') else None,
                    'active': rec.get('active', True),
                    'source': 'odoo',
                    'synced_at': datetime.now(timezone.utc).isoformat(),
                })
            
            logger.info(f"Fetched {len(departments)} departments from Odoo")
            return departments
            
        except Exception as e:
            logger.error(f"Failed to fetch departments from Odoo: {e}")
            raise

    async def fetch_users(self) -> List[Dict[str, Any]]:
        """
        Fetch all users from Odoo hr.employee model (preferred) or res.users.
        Users in CRM must originate from Odoo.
        """
        if not self._connected:
            await self.connect()
        
        if not self._connected:
            raise RuntimeError("Cannot connect to Odoo")
        
        # Try hr.employee first (richer data), fallback to res.users
        model = 'hr.employee'
        fields = self._get_fields_for_model(model, 'employee')
        domain = [('active', '=', True)]
        
        loop = asyncio.get_event_loop()
        
        try:
            records = await loop.run_in_executor(
                None,
                lambda: self._models.execute_kw(
                    self.database, self._uid, self.api_key,
                    model, 'search_read',
                    [domain],
                    {'fields': fields}
                )
            )
            
            users = []
            for rec in records:
                users.append({
                    'odoo_employee_id': rec.get('id'),
                    'odoo_user_id': rec.get('user_id')[0] if rec.get('user_id') else None,
                    'name': rec.get('name'),
                    'email': rec.get('work_email'),
                    'phone': rec.get('work_phone') or rec.get('mobile_phone'),
                    'job_title': rec.get('job_title') or (rec.get('job_id')[1] if rec.get('job_id') else None),
                    'department_odoo_id': rec.get('department_id')[0] if rec.get('department_id') else None,

    async def _fetch_users_fallback(self) -> List[Dict[str, Any]]:
        """Fallback to res.users if hr.employee is not available"""
        model = 'res.users'
        fields = ['id', 'name', 'login', 'email', 'partner_id', 'active', 'company_id']
        domain = [('active', '=', True)]
        
        loop = asyncio.get_event_loop()
        
        records = await loop.run_in_executor(
            None,
            lambda: self._models.execute_kw(
                self.database, self._uid, self.api_key,
                model, 'search_read',
                [domain],
                {'fields': fields}
            )
        )
        
        users = []
        for rec in records:
            users.append({
                'odoo_employee_id': None,
                'odoo_user_id': rec.get('id'),
                'name': rec.get('name'),
                'email': rec.get('email') or rec.get('login'),
                'phone': None,
                'job_title': None,
                'department_odoo_id': None,
                'department_name': None,
                'manager_odoo_id': None,
                'manager_name': None,
                'active': rec.get('active', True),
                'source': 'odoo',
                'synced_at': datetime.now(timezone.utc).isoformat(),
            })
        
        logger.info(f"Fetched {len(users)} users from Odoo (fallback)")
        return users

                    'department_name': rec.get('department_id')[1] if rec.get('department_id') else None,
                    'manager_odoo_id': rec.get('parent_id')[0] if rec.get('parent_id') else None,
                    'manager_name': rec.get('parent_id')[1] if rec.get('parent_id') else None,
                    'active': rec.get('active', True),
                    'source': 'odoo',
                    'synced_at': datetime.now(timezone.utc).isoformat(),
                })
            
            logger.info(f"Fetched {len(users)} employees from Odoo")
            return users
            
        except Exception as e:
            logger.error(f"Failed to fetch employees from Odoo: {e}")
            # Fallback to res.users if hr.employee fails
            logger.info("Falling back to res.users model")
            return await self._fetch_users_fallback()
