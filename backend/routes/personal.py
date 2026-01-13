"""
Personal Data Routes
API endpoints for user's own O365 data (emails, calendar)
Data is scoped to the authenticated user only
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from services.ms365.connector import MS365Connector
from services.auth.jwt_handler import get_current_user_from_token
from middleware.rbac import require_approved
from core.database import Database

router = APIRouter(prefix="/my", tags=["Personal Data"])


# ===================== HELPER =====================

async def get_user_ms_token(user_id: str) -> Optional[str]:
    """Get user's Microsoft access token"""
    db = Database.get_db()
    user = await db.users.find_one({"id": user_id}, {"ms_access_token": 1})
    return user.get("ms_access_token") if user else None


# ===================== EMAILS =====================

@router.get("/emails")
async def get_my_emails(
    limit: int = 50,
    skip: int = 0,
    token_data: dict = Depends(require_approved())
):
    """
    Get current user's emails from Microsoft 365.
    Only returns emails for the authenticated user.
    """
    user_id = token_data["id"]
    db = Database.get_db()
    
    # First check if we have cached emails
    cached_count = await db.user_emails.count_documents({"owner_user_id": user_id})
    
    if cached_count > 0:
        # Return from cache
        cursor = db.user_emails.find(
            {"owner_user_id": user_id},
            {"_id": 0}
        ).sort("received_at", -1).skip(skip).limit(limit)
        
        emails = await cursor.to_list(limit)
        return {
            "emails": emails,
            "count": len(emails),
            "total": cached_count,
            "source": "cache"
        }
    
    # Fetch fresh from MS365
    access_token = await get_user_ms_token(user_id)
    if not access_token:
        return {
            "emails": [],
            "count": 0,
            "total": 0,
            "source": "none",
            "message": "Not connected to Microsoft 365. Please sign in with Microsoft."
        }
    
    try:
        async with MS365Connector(access_token) as connector:
            emails = await connector.get_emails(top=limit)
            
            # Store in user's personal collection
            if emails:
                now = datetime.now(timezone.utc)
                for email in emails:
                    email_record = {
                        "id": str(uuid.uuid4()),
                        "owner_user_id": user_id,  # CRITICAL: Scope to user
                        "ms_email_id": email.get("source_id"),
                        "subject": email.get("subject", ""),
                        "from_email": email.get("from_email", ""),
                        "from_name": email.get("from_name", ""),
                        "to_recipients": email.get("to_recipients", []),
                        "received_at": email.get("received_at"),
                        "body_preview": email.get("body_preview", ""),
                        "has_attachments": email.get("has_attachments", False),
                        "is_read": email.get("is_read", False),
                        "importance": email.get("importance", "normal"),
                        "web_link": email.get("web_link", ""),
                        "synced_at": now
                    }
                    
                    # Upsert to avoid duplicates
                    await db.user_emails.update_one(
                        {"owner_user_id": user_id, "ms_email_id": email.get("source_id")},
                        {"$set": email_record},
                        upsert=True
                    )
            
            return {
                "emails": emails,
                "count": len(emails),
                "total": len(emails),
                "source": "microsoft"
            }
            
    except Exception as e:
        error_msg = str(e)
        # Handle token expiration specifically
        if "expired" in error_msg.lower() or "invalid" in error_msg.lower() or "401" in error_msg:
            # Clear the expired token
            await db.users.update_one(
                {"id": user_id},
                {"$unset": {"ms_access_token": ""}}
            )
            return {
                "emails": [],
                "count": 0,
                "total": 0,
                "source": "error",
                "error_type": "token_expired",
                "message": "Your Microsoft session has expired. Please sign in with Microsoft again to refresh your connection."
            }
        raise HTTPException(status_code=500, detail=f"Failed to fetch emails: {str(e)}")


@router.post("/emails/sync")
async def sync_my_emails(
    token_data: dict = Depends(require_approved())
):
    """
    Force sync emails from Microsoft 365.
    Clears cache and fetches fresh data.
    """
    user_id = token_data["id"]
    db = Database.get_db()
    
    access_token = await get_user_ms_token(user_id)
    if not access_token:
        raise HTTPException(
            status_code=400, 
            detail="Not connected to Microsoft 365. Please sign in with Microsoft."
        )
    
    try:
        # Clear existing cache
        await db.user_emails.delete_many({"owner_user_id": user_id})
        
        async with MS365Connector(access_token) as connector:
            emails = await connector.get_emails(top=100)
            
            now = datetime.now(timezone.utc)
            inserted = 0
            
            for email in emails:
                email_record = {
                    "id": str(uuid.uuid4()),
                    "owner_user_id": user_id,
                    "ms_email_id": email.get("source_id"),
                    "subject": email.get("subject", ""),
                    "from_email": email.get("from_email", ""),
                    "from_name": email.get("from_name", ""),
                    "to_recipients": email.get("to_recipients", []),
                    "received_at": email.get("received_at"),
                    "body_preview": email.get("body_preview", ""),
                    "has_attachments": email.get("has_attachments", False),
                    "is_read": email.get("is_read", False),
                    "importance": email.get("importance", "normal"),
                    "web_link": email.get("web_link", ""),
                    "synced_at": now
                }
                await db.user_emails.insert_one(email_record)
                inserted += 1
            
            return {
                "message": f"Synced {inserted} emails",
                "count": inserted
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")


# ===================== CALENDAR =====================

@router.get("/calendar")
async def get_my_calendar(
    limit: int = 50,
    token_data: dict = Depends(require_approved())
):
    """
    Get current user's calendar events from Microsoft 365.
    Only returns events for the authenticated user.
    """
    user_id = token_data["id"]
    db = Database.get_db()
    
    # Check cache first
    cached_count = await db.user_calendar.count_documents({"owner_user_id": user_id})
    
    if cached_count > 0:
        cursor = db.user_calendar.find(
            {"owner_user_id": user_id},
            {"_id": 0}
        ).sort("start_time", 1).limit(limit)
        
        events = await cursor.to_list(limit)
        return {
            "events": events,
            "count": len(events),
            "total": cached_count,
            "source": "cache"
        }
    
    # Fetch from MS365
    access_token = await get_user_ms_token(user_id)
    if not access_token:
        return {
            "events": [],
            "count": 0,
            "total": 0,
            "source": "none",
            "message": "Not connected to Microsoft 365. Please sign in with Microsoft."
        }
    
    try:
        async with MS365Connector(access_token) as connector:
            events = await connector.get_calendar_events(top=limit)
            
            # Store in user's personal collection
            if events:
                now = datetime.now(timezone.utc)
                for event in events:
                    event_record = {
                        "id": str(uuid.uuid4()),
                        "owner_user_id": user_id,
                        "ms_event_id": event.get("source_id"),
                        "subject": event.get("subject", ""),
                        "organizer_email": event.get("organizer_email", ""),
                        "organizer_name": event.get("organizer_name", ""),
                        "attendees": event.get("attendees", []),
                        "start_time": event.get("start_time"),
                        "end_time": event.get("end_time"),
                        "location": event.get("location", ""),
                        "body_preview": event.get("body_preview", ""),
                        "is_all_day": event.get("is_all_day", False),
                        "is_cancelled": event.get("is_cancelled", False),
                        "web_link": event.get("web_link", ""),
                        "online_meeting_url": event.get("online_meeting_url", ""),
                        "synced_at": now
                    }
                    
                    await db.user_calendar.update_one(
                        {"owner_user_id": user_id, "ms_event_id": event.get("source_id")},
                        {"$set": event_record},
                        upsert=True
                    )
            
            return {
                "events": events,
                "count": len(events),
                "total": len(events),
                "source": "microsoft"
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch calendar: {str(e)}")


@router.post("/calendar/sync")
async def sync_my_calendar(
    token_data: dict = Depends(require_approved())
):
    """Force sync calendar events from Microsoft 365"""
    user_id = token_data["id"]
    db = Database.get_db()
    
    access_token = await get_user_ms_token(user_id)
    if not access_token:
        raise HTTPException(
            status_code=400, 
            detail="Not connected to Microsoft 365. Please sign in with Microsoft."
        )
    
    try:
        await db.user_calendar.delete_many({"owner_user_id": user_id})
        
        async with MS365Connector(access_token) as connector:
            events = await connector.get_calendar_events(top=100)
            
            now = datetime.now(timezone.utc)
            inserted = 0
            
            for event in events:
                event_record = {
                    "id": str(uuid.uuid4()),
                    "owner_user_id": user_id,
                    "ms_event_id": event.get("source_id"),
                    "subject": event.get("subject", ""),
                    "organizer_email": event.get("organizer_email", ""),
                    "organizer_name": event.get("organizer_name", ""),
                    "attendees": event.get("attendees", []),
                    "start_time": event.get("start_time"),
                    "end_time": event.get("end_time"),
                    "location": event.get("location", ""),
                    "is_all_day": event.get("is_all_day", False),
                    "web_link": event.get("web_link", ""),
                    "synced_at": now
                }
                await db.user_calendar.insert_one(event_record)
                inserted += 1
            
            return {
                "message": f"Synced {inserted} calendar events",
                "count": inserted
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")


# ===================== CONNECTION STATUS =====================

@router.get("/connection-status")
async def get_ms365_connection_status(
    token_data: dict = Depends(require_approved())
):
    """Check if user is connected to Microsoft 365"""
    user_id = token_data["id"]
    db = Database.get_db()
    
    user = await db.users.find_one(
        {"id": user_id}, 
        {"ms_id": 1, "ms_access_token": 1, "auth_provider": 1, "email": 1}
    )
    
    is_connected = bool(user and user.get("ms_access_token"))
    
    return {
        "connected": is_connected,
        "auth_provider": user.get("auth_provider") if user else None,
        "ms_email": user.get("email") if is_connected else None
    }
