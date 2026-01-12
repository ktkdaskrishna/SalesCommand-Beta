"""
Microsoft 365 Connector
Handles Microsoft Graph API calls for data synchronization
"""
import logging
import aiohttp
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

GRAPH_API_BASE = "https://graph.microsoft.com/v1.0"


class MS365Connector:
    """
    Microsoft 365 connector using Microsoft Graph API.
    Supports both delegated (user) and application (admin) permissions.
    """
    
    def __init__(self, access_token: str):
        self.access_token = access_token
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        self._session: Optional[aiohttp.ClientSession] = None
    
    async def __aenter__(self):
        self._session = aiohttp.ClientSession(headers=self.headers)
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self._session:
            await self._session.close()
    
    async def _make_request(self, endpoint: str, params: Optional[Dict] = None) -> Dict[str, Any]:
        """Make a GET request to Microsoft Graph API"""
        url = f"{GRAPH_API_BASE}{endpoint}"
        
        try:
            async with self._session.get(url, params=params) as response:
                if response.status == 401:
                    raise Exception("Microsoft access token expired or invalid")
                elif response.status == 403:
                    raise Exception("Insufficient permissions for this operation")
                elif response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"Graph API error ({response.status}): {error_text}")
                
                return await response.json()
        except aiohttp.ClientError as e:
            raise Exception(f"Network error calling Graph API: {str(e)}")
    
    async def get_user_profile(self) -> Dict[str, Any]:
        """Get current user's profile"""
        return await self._make_request("/me")
    
    # ===================== USER DIRECTORY (Admin) =====================
    
    async def get_organization_users(self, top: int = 100) -> List[Dict[str, Any]]:
        """
        Get all users from the organization's Azure AD directory.
        Requires User.Read.All application permission (admin consent).
        Returns identity information only - NO personal emails/files.
        """
        users = []
        
        try:
            params = {
                "$top": top,
                "$select": "id,displayName,mail,userPrincipalName,givenName,surname,jobTitle,department,officeLocation,mobilePhone,businessPhones,employeeId,accountEnabled",
                "$filter": "accountEnabled eq true"
            }
            
            result = await self._make_request("/users", params)
            
            for user in result.get("value", []):
                user_record = {
                    "ms_id": user.get("id"),
                    "email": user.get("mail") or user.get("userPrincipalName"),
                    "display_name": user.get("displayName", ""),
                    "first_name": user.get("givenName", ""),
                    "last_name": user.get("surname", ""),
                    "job_title": user.get("jobTitle", ""),
                    "department": user.get("department", ""),
                    "office_location": user.get("officeLocation", ""),
                    "mobile_phone": user.get("mobilePhone", ""),
                    "business_phones": user.get("businessPhones", []),
                    "employee_id": user.get("employeeId", ""),
                    "is_active": user.get("accountEnabled", True)
                }
                users.append(user_record)
            
            logger.info(f"Fetched {len(users)} users from Azure AD directory")
            return users
            
        except Exception as e:
            logger.error(f"Error fetching organization users: {e}")
            raise
    
    async def get_user_manager(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get a user's manager from Azure AD"""
        try:
            result = await self._make_request(f"/users/{user_id}/manager")
            return {
                "ms_id": result.get("id"),
                "email": result.get("mail") or result.get("userPrincipalName"),
                "display_name": result.get("displayName", "")
            }
        except Exception as e:
            # User may not have a manager
            logger.debug(f"No manager found for user {user_id}: {e}")
            return None
    
    # ===================== PERSONAL DATA (User's Own) =====================
        """
        Fetch emails from user's mailbox.
        Returns list of email messages.
        """
        emails = []
        
        try:
            # Get emails from inbox
            params = {
                "$top": top,
                "$skip": skip,
                "$orderby": "receivedDateTime desc",
                "$select": "id,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,bodyPreview,hasAttachments,importance,isRead,webLink"
            }
            
            result = await self._make_request("/me/messages", params)
            
            for msg in result.get("value", []):
                email_record = {
                    "source_id": msg.get("id"),
                    "subject": msg.get("subject", ""),
                    "from_email": msg.get("from", {}).get("emailAddress", {}).get("address", ""),
                    "from_name": msg.get("from", {}).get("emailAddress", {}).get("name", ""),
                    "to_recipients": [r.get("emailAddress", {}).get("address", "") for r in msg.get("toRecipients", [])],
                    "cc_recipients": [r.get("emailAddress", {}).get("address", "") for r in msg.get("ccRecipients", [])],
                    "received_at": msg.get("receivedDateTime"),
                    "sent_at": msg.get("sentDateTime"),
                    "body_preview": msg.get("bodyPreview", ""),
                    "has_attachments": msg.get("hasAttachments", False),
                    "importance": msg.get("importance", "normal"),
                    "is_read": msg.get("isRead", False),
                    "web_link": msg.get("webLink", "")
                }
                emails.append(email_record)
            
            logger.info(f"Fetched {len(emails)} emails from MS365")
            return emails
            
        except Exception as e:
            logger.error(f"Error fetching emails: {e}")
            raise
    
    async def get_calendar_events(self, top: int = 50) -> List[Dict[str, Any]]:
        """
        Fetch calendar events from user's calendar.
        Returns list of calendar events.
        """
        events = []
        
        try:
            # Get upcoming events
            params = {
                "$top": top,
                "$orderby": "start/dateTime",
                "$select": "id,subject,organizer,attendees,start,end,location,bodyPreview,isAllDay,isCancelled,webLink,onlineMeetingUrl"
            }
            
            result = await self._make_request("/me/events", params)
            
            for event in result.get("value", []):
                event_record = {
                    "source_id": event.get("id"),
                    "subject": event.get("subject", ""),
                    "organizer_email": event.get("organizer", {}).get("emailAddress", {}).get("address", ""),
                    "organizer_name": event.get("organizer", {}).get("emailAddress", {}).get("name", ""),
                    "attendees": [
                        {
                            "email": a.get("emailAddress", {}).get("address", ""),
                            "name": a.get("emailAddress", {}).get("name", ""),
                            "response": a.get("status", {}).get("response", "")
                        }
                        for a in event.get("attendees", [])
                    ],
                    "start_time": event.get("start", {}).get("dateTime"),
                    "start_timezone": event.get("start", {}).get("timeZone"),
                    "end_time": event.get("end", {}).get("dateTime"),
                    "end_timezone": event.get("end", {}).get("timeZone"),
                    "location": event.get("location", {}).get("displayName", ""),
                    "body_preview": event.get("bodyPreview", ""),
                    "is_all_day": event.get("isAllDay", False),
                    "is_cancelled": event.get("isCancelled", False),
                    "web_link": event.get("webLink", ""),
                    "online_meeting_url": event.get("onlineMeetingUrl", "")
                }
                events.append(event_record)
            
            logger.info(f"Fetched {len(events)} calendar events from MS365")
            return events
            
        except Exception as e:
            logger.error(f"Error fetching calendar events: {e}")
            raise
    
    async def get_contacts(self, top: int = 100) -> List[Dict[str, Any]]:
        """
        Fetch contacts from user's Outlook contacts.
        Returns list of contacts.
        """
        contacts = []
        
        try:
            params = {
                "$top": top,
                "$select": "id,displayName,givenName,surname,emailAddresses,businessPhones,mobilePhone,companyName,jobTitle,department"
            }
            
            result = await self._make_request("/me/contacts", params)
            
            for contact in result.get("value", []):
                # Get primary email
                emails = contact.get("emailAddresses", [])
                primary_email = emails[0].get("address", "") if emails else ""
                
                contact_record = {
                    "source_id": contact.get("id"),
                    "display_name": contact.get("displayName", ""),
                    "first_name": contact.get("givenName", ""),
                    "last_name": contact.get("surname", ""),
                    "email": primary_email,
                    "all_emails": [e.get("address", "") for e in emails],
                    "business_phones": contact.get("businessPhones", []),
                    "mobile_phone": contact.get("mobilePhone", ""),
                    "company": contact.get("companyName", ""),
                    "job_title": contact.get("jobTitle", ""),
                    "department": contact.get("department", "")
                }
                contacts.append(contact_record)
            
            logger.info(f"Fetched {len(contacts)} contacts from MS365")
            return contacts
            
        except Exception as e:
            logger.error(f"Error fetching contacts: {e}")
            raise
    
    async def get_files(self, top: int = 50) -> List[Dict[str, Any]]:
        """
        Fetch recent files from OneDrive.
        Returns list of files.
        """
        files = []
        
        try:
            params = {
                "$top": top,
                "$orderby": "lastModifiedDateTime desc",
                "$select": "id,name,size,createdDateTime,lastModifiedDateTime,webUrl,file,folder,createdBy,lastModifiedBy"
            }
            
            result = await self._make_request("/me/drive/root/children", params)
            
            for item in result.get("value", []):
                file_record = {
                    "source_id": item.get("id"),
                    "name": item.get("name", ""),
                    "size": item.get("size", 0),
                    "created_at": item.get("createdDateTime"),
                    "modified_at": item.get("lastModifiedDateTime"),
                    "web_url": item.get("webUrl", ""),
                    "is_folder": "folder" in item,
                    "mime_type": item.get("file", {}).get("mimeType", "") if "file" in item else "",
                    "created_by": item.get("createdBy", {}).get("user", {}).get("displayName", ""),
                    "modified_by": item.get("lastModifiedBy", {}).get("user", {}).get("displayName", "")
                }
                files.append(file_record)
            
            logger.info(f"Fetched {len(files)} files from OneDrive")
            return files
            
        except Exception as e:
            logger.error(f"Error fetching files: {e}")
            raise
