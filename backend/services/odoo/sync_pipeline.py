"""
Odoo Sync Pipeline Service
Centralizes Odoo sync operations for departments, users, and data lake entities.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Dict, List, Tuple
import logging

from motor.motor_asyncio import AsyncIOMotorDatabase

from integrations.odoo.connector import OdooConnector

logger = logging.getLogger(__name__)


class OdooSyncPipelineService:
    """Single pipeline entrypoint for Odoo sync operations."""

    def __init__(self, db: AsyncIOMotorDatabase, config: Dict[str, str], actor_id: str):
        self.db = db
        self.config = config
        self.actor_id = actor_id

    async def sync_departments(self) -> Tuple[int, int, int, int, List[str]]:
        """Sync departments from Odoo hr.department."""
        connector = OdooConnector(self.config)
        try:
            departments = await connector.fetch_departments()
        except Exception as exc:
            raise RuntimeError(f"Failed to fetch from Odoo: {exc}") from exc
        finally:
            await connector.disconnect()

        created = 0
        updated = 0
        errors: List[str] = []
        odoo_ids: List[int] = []

        for dept in departments:
            odoo_ids.append(dept["odoo_id"])
            try:
                existing = await self.db.departments.find_one({"odoo_id": dept["odoo_id"]})
                payload = {
                    "name": dept["name"],
                    "complete_name": dept.get("complete_name"),
                    "parent_odoo_id": dept.get("parent_id"),
                    "manager_odoo_id": dept.get("manager_id"),
                    "active": dept.get("active", True),
                    "synced_at": datetime.now(timezone.utc),
                    "source": "odoo",
                }
                if existing:
                    await self.db.departments.update_one(
                        {"odoo_id": dept["odoo_id"]},
                        {"$set": payload},
                    )
                    updated += 1
                else:
                    payload.update(
                        {
                            "id": str(uuid.uuid4()),
                            "odoo_id": dept["odoo_id"],
                            "created_at": datetime.now(timezone.utc),
                        }
                    )
                    await self.db.departments.insert_one(payload)
                    created += 1
            except Exception as exc:
                errors.append(f"Failed to sync department {dept.get('name')}: {exc}")

        result = await self.db.departments.update_many(
            {"source": "odoo", "odoo_id": {"$nin": odoo_ids}, "active": True},
            {"$set": {"active": False, "deactivated_at": datetime.now(timezone.utc)}},
        )
        deactivated = result.modified_count

        await self._log_audit(
            action="sync_departments",
            details={
                "synced": len(departments),
                "created": created,
                "updated": updated,
                "deactivated": deactivated,
            },
        )

        return len(departments), created, updated, deactivated, errors

    async def sync_users(self) -> Tuple[int, int, int, int, List[str]]:
        """Sync users from Odoo hr.employee into users collection."""
        connector = OdooConnector(self.config)
        try:
            odoo_users = await connector.fetch_users()
        except Exception as exc:
            raise RuntimeError(f"Failed to fetch from Odoo: {exc}") from exc
        finally:
            await connector.disconnect()

        created = 0
        updated = 0
        errors: List[str] = []
        odoo_ids: List[int] = []

        for odoo_user in odoo_users:
            employee_id = odoo_user.get("odoo_employee_id")
            user_id = odoo_user.get("odoo_user_id")
            odoo_ids.append(employee_id or user_id)

            if not odoo_user.get("email"):
                errors.append(f"Skipped user {odoo_user.get('name')}: no email")
                continue

            try:
                existing = await self.db.users.find_one(
                    {"email": {"$regex": f"^{odoo_user['email']}$", "$options": "i"}}
                )
                if not existing and employee_id:
                    existing = await self.db.users.find_one({"odoo_employee_id": employee_id})
                if not existing and user_id:
                    existing = await self.db.users.find_one({"odoo_user_id": user_id})

                dept = None
                if odoo_user.get("department_odoo_id"):
                    dept = await self.db.departments.find_one(
                        {"odoo_id": odoo_user["department_odoo_id"]}
                    )

                if existing:
                    existing_email = existing.get("email", "").lower()
                    odoo_email = odoo_user["email"].lower()
                    existing_odoo_id = existing.get("odoo_employee_id") or existing.get("odoo_user_id")
                    if (
                        existing_email != odoo_email
                        and existing_odoo_id != employee_id
                        and existing_odoo_id != user_id
                    ):
                        logger.warning(
                            "Email mismatch: local=%s, odoo=%s. Creating new user instead.",
                            existing_email,
                            odoo_email,
                        )
                        existing = None

                if existing:
                    update_data = {
                        "odoo_employee_id": employee_id,
                        "odoo_user_id": user_id,
                        "job_title": odoo_user.get("job_title"),
                        "phone": odoo_user.get("phone"),
                        "department_id": dept["id"] if dept else existing.get("department_id"),
                        "department_name": odoo_user.get("department_name"),
                        "manager_odoo_id": odoo_user.get("manager_odoo_id"),
                        "synced_at": datetime.now(timezone.utc),
                        "source": "odoo",
                        "odoo_matched": True,
                    }
                    if not existing.get("is_super_admin"):
                        update_data["name"] = odoo_user["name"]
                    await self.db.users.update_one({"id": existing["id"]}, {"$set": update_data})
                    updated += 1
                else:
                    new_user = {
                        "id": str(uuid.uuid4()),
                        "email": odoo_user["email"],
                        "name": odoo_user["name"],
                        "hashed_password": None,
                        "odoo_employee_id": employee_id,
                        "odoo_user_id": user_id,
                        "job_title": odoo_user.get("job_title"),
                        "phone": odoo_user.get("phone"),
                        "department_id": dept["id"] if dept else None,
                        "department_name": odoo_user.get("department_name"),
                        "manager_odoo_id": odoo_user.get("manager_odoo_id"),
                        "role": "pending",
                        "role_id": None,
                        "is_approved": False,
                        "approval_status": "pending",
                        "is_super_admin": False,
                        "source": "odoo",
                        "synced_at": datetime.now(timezone.utc),
                        "created_at": datetime.now(timezone.utc),
                    }
                    await self.db.users.insert_one(new_user)
                    created += 1
            except Exception as exc:
                errors.append(f"Failed to sync user {odoo_user.get('name')}: {exc}")

        result = await self.db.users.update_many(
            {
                "source": "odoo",
                "$and": [
                    {
                        "odoo_employee_id": {
                            "$nin": [
                                u.get("odoo_employee_id")
                                for u in odoo_users
                                if u.get("odoo_employee_id")
                            ]
                        }
                    },
                    {
                        "odoo_user_id": {
                            "$nin": [
                                u.get("odoo_user_id") for u in odoo_users if u.get("odoo_user_id")
                            ]
                        }
                    },
                ],
                "is_approved": True,
            },
            {
                "$set": {
                    "is_approved": False,
                    "approval_status": "deactivated",
                    "deactivated_at": datetime.now(timezone.utc),
                }
            },
        )
        deactivated = result.modified_count

        await self._log_audit(
            action="sync_users",
            details={
                "synced": len(odoo_users),
                "created": created,
                "updated": updated,
                "deactivated": deactivated,
            },
        )

        return len(odoo_users), created, updated, deactivated, errors

    async def sync_data_lake(self) -> Tuple[Dict[str, int], List[str]]:
        """Sync core Odoo entities into data_lake_serving."""
        connector = OdooConnector(self.config)
        synced_entities: Dict[str, int] = {}
        errors: List[str] = []

        try:
            accounts = await connector.fetch_accounts()
            await self._sync_serving_entities("account", "odoo_account", accounts)
            synced_entities["accounts"] = len(accounts)
        except Exception as exc:
            errors.append(f"Account sync error: {exc}")

        try:
            opportunities = await connector.fetch_opportunities()
            await self._sync_serving_entities("opportunity", "odoo_opportunity", opportunities)
            synced_entities["opportunities"] = len(opportunities)
        except Exception as exc:
            errors.append(f"Opportunity sync error: {exc}")

        try:
            invoices = await connector.fetch_invoices()
            await self._sync_serving_entities("invoice", "odoo_invoice", invoices)
            synced_entities["invoices"] = len(invoices)
        except Exception as exc:
            errors.append(f"Invoice sync error: {exc}")

        try:
            activities = await connector.fetch_activities()
            await self._sync_serving_entities("activity", "odoo_activity", activities)
            synced_entities["activities"] = len(activities)
        except Exception as exc:
            errors.append(f"Activity sync error: {exc}")

        try:
            users = await connector.fetch_users()
            await self._sync_serving_users(users)
            synced_entities["users"] = len(users)
        except Exception as exc:
            errors.append(f"User sync error: {exc}")

        await connector.disconnect()

        return synced_entities, errors

    async def _sync_serving_entities(self, entity_type: str, prefix: str, records: List[Dict]):
        now_iso = datetime.now(timezone.utc).isoformat()
        for record in records:
            serving_doc = {
                "entity_type": entity_type,
                "serving_id": f"{prefix}_{record.get('id')}",
                "source": "odoo",
                "last_aggregated": now_iso,
                "data": record,
            }
            await self.db.data_lake_serving.update_one(
                {"serving_id": serving_doc["serving_id"]},
                {"$set": serving_doc},
                upsert=True,
            )

    async def _sync_serving_users(self, users: List[Dict]):
        now_iso = datetime.now(timezone.utc).isoformat()
        for usr in users:
            serving_doc = {
                "entity_type": "user",
                "serving_id": f"odoo_user_{usr.get('odoo_user_id', usr.get('id'))}",
                "source": "odoo",
                "last_aggregated": now_iso,
                "data": {
                    "id": usr.get("odoo_user_id", usr.get("id")),
                    "name": usr.get("name"),
                    "email": (usr.get("email") or "").lower(),
                    "login": (usr.get("login") or "").lower(),
                    "work_email": (usr.get("work_email") or "").lower(),
                    "job_title": usr.get("job_title"),
                    "department_id": usr.get("department_odoo_id"),
                    "department_name": usr.get("department_name"),
                    "team_id": usr.get("team_id"),
                    "team_name": usr.get("team_name"),
                    "odoo_user_id": usr.get("odoo_user_id"),
                    "odoo_employee_id": usr.get("odoo_employee_id"),
                    "manager_odoo_id": usr.get("manager_odoo_id"),
                    "active": usr.get("active", True),
                },
            }
            await self.db.data_lake_serving.update_one(
                {"serving_id": serving_doc["serving_id"]},
                {"$set": serving_doc},
                upsert=True,
            )

    async def _log_audit(self, action: str, details: Dict[str, int]) -> None:
        await self.db.audit_log.insert_one(
            {
                "id": str(uuid.uuid4()),
                "action": action,
                "source": "odoo",
                "user_id": self.actor_id,
                "details": details,
                "timestamp": datetime.now(timezone.utc),
            }
        )
