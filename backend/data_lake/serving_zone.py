"""
Serving Zone Handler for Sales Intelligence Platform
Manages dashboard-optimized, pre-aggregated views.
"""

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging

from core.enums import (
    EntityType,
    VisibilityScope,
    UserRole,
    OpportunityStage,
    ActivityStatus,
)
from .models import (
    ServingDashboardStats,
    ServingPipelineSummary,
    ServingKPISnapshot,
    ServingActivityFeed,
)


logger = logging.getLogger(__name__)


class ServingZoneHandler:
    """
    Handles all operations for the Serving Zone of the Data Lake.
    
    Principles:
    - Optimized for dashboard reads
    - Pre-aggregated data
    - Role-scoped views
    - Updated on canonical zone changes
    """
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
    
    async def refresh_user_stats(
        self,
        user_id: str,
        period: str = "daily"
    ) -> ServingDashboardStats:
        """
        Refresh dashboard statistics for a user.
        
        Args:
            user_id: User ID to compute stats for
            period: Time period (daily, weekly, monthly, quarterly, yearly)
            
        Returns:
            Updated dashboard stats
        """
        # Calculate period boundaries
        now = datetime.now(timezone.utc)
        period_start, period_end = self._get_period_boundaries(now, period)
        
        # Aggregate accounts
        accounts_stats = await self._aggregate_accounts(user_id, period_start, period_end)
        
        # Aggregate opportunities
        opps_stats = await self._aggregate_opportunities(user_id, period_start, period_end)
        
        # Aggregate activities
        activities_stats = await self._aggregate_activities(user_id, period_start, period_end)
        
        # Calculate performance metrics
        win_rate = 0.0
        if opps_stats["closed_total"] > 0:
            win_rate = (opps_stats["won"] / opps_stats["closed_total"]) * 100
        
        avg_deal_size = 0.0
        if opps_stats["won"] > 0:
            avg_deal_size = opps_stats["won_value"] / opps_stats["won"]
        
        conversion_rate = 0.0
        if opps_stats["total"] > 0:
            conversion_rate = (opps_stats["won"] / opps_stats["total"]) * 100
        
        # Build stats object
        stats = ServingDashboardStats(
            user_id=user_id,
            period=period,
            period_start=period_start,
            period_end=period_end,
            # Accounts
            total_accounts=accounts_stats["total"],
            new_accounts=accounts_stats["new"],
            active_accounts=accounts_stats["active"],
            # Opportunities
            total_opportunities=opps_stats["total"],
            open_opportunities=opps_stats["open"],
            won_opportunities=opps_stats["won"],
            lost_opportunities=opps_stats["lost"],
            pipeline_value=opps_stats["pipeline_value"],
            won_value=opps_stats["won_value"],
            # Activities
            total_activities=activities_stats["total"],
            completed_activities=activities_stats["completed"],
            overdue_activities=activities_stats["overdue"],
            upcoming_activities=activities_stats["upcoming"],
            # Performance
            conversion_rate=round(conversion_rate, 2),
            average_deal_size=round(avg_deal_size, 2),
            win_rate=round(win_rate, 2),
        )
        
        # Upsert to serving zone
        await self.db["serving_dashboard_stats"].update_one(
            {"user_id": user_id, "period": period},
            {"$set": stats.to_mongo_dict()},
            upsert=True
        )
        
        logger.debug(f"Refreshed {period} stats for user {user_id}")
        return stats
    
    async def refresh_pipeline_summary(
        self,
        user_id: str,
        scope: VisibilityScope = VisibilityScope.OWN,
        team_ids: Optional[List[str]] = None,
        department_id: Optional[str] = None
    ) -> ServingPipelineSummary:
        """
        Refresh pipeline summary for a user with visibility scope.
        """
        # Build visibility query
        visibility_query = self._build_visibility_query(
            user_id, scope, team_ids, department_id
        )
        
        # Only open opportunities
        query = {
            **visibility_query,
            "is_closed": False
        }
        
        # Aggregate by stage
        pipeline = [
            {"$match": query},
            {
                "$group": {
                    "_id": "$stage",
                    "count": {"$sum": 1},
                    "value": {"$sum": "$amount"},
                    "weighted_value": {
                        "$sum": {"$multiply": ["$amount", {"$divide": ["$probability", 100]}]}
                    }
                }
            },
            {"$sort": {"_id": 1}}
        ]
        
        cursor = self.db["canonical_opportunities"].aggregate(pipeline)
        stage_results = await cursor.to_list(length=None)
        
        # Build stages list
        stages = []
        total_value = 0
        total_count = 0
        weighted_total = 0
        
        for result in stage_results:
            stages.append({
                "stage": result["_id"],
                "count": result["count"],
                "value": result["value"],
                "weighted_value": result["weighted_value"]
            })
            total_value += result["value"]
            total_count += result["count"]
            weighted_total += result["weighted_value"]
        
        # Calculate average age
        avg_age = await self._calculate_average_opportunity_age(query)
        
        # Count stalled opportunities (no activity in 14 days)
        stalled = await self._count_stalled_opportunities(query)
        
        summary = ServingPipelineSummary(
            user_id=user_id,
            scope=scope,
            stages=stages,
            total_pipeline_value=total_value,
            total_opportunities=total_count,
            weighted_pipeline=weighted_total,
            average_age_days=avg_age,
            stalled_count=stalled
        )
        
        # Upsert
        await self.db["serving_pipeline_summary"].update_one(
            {"user_id": user_id, "scope": scope.value},
            {"$set": summary.to_mongo_dict()},
            upsert=True
        )
        
        return summary
    
    async def get_dashboard_stats(
        self,
        user_id: str,
        period: str = "daily"
    ) -> Optional[Dict[str, Any]]:
        """Get cached dashboard stats for a user"""
        return await self.db["serving_dashboard_stats"].find_one(
            {"user_id": user_id, "period": period},
            {"_id": 0}
        )
    
    async def get_pipeline_summary(
        self,
        user_id: str,
        scope: VisibilityScope = VisibilityScope.OWN
    ) -> Optional[Dict[str, Any]]:
        """Get cached pipeline summary for a user"""
        return await self.db["serving_pipeline_summary"].find_one(
            {"user_id": user_id, "scope": scope.value},
            {"_id": 0}
        )
    
    async def add_activity_feed(
        self,
        user_id: str,
        activity_type: str,
        title: str,
        description: Optional[str] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        entity_name: Optional[str] = None,
        actor_id: Optional[str] = None,
        actor_name: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """Add an entry to the activity feed"""
        feed_entry = ServingActivityFeed(
            user_id=user_id,
            activity_type=activity_type,
            title=title,
            description=description,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_name=entity_name,
            actor_id=actor_id,
            actor_name=actor_name,
            metadata=metadata or {}
        )
        
        await self.db["serving_activity_feed"].insert_one(feed_entry.to_mongo_dict())
        return feed_entry.id
    
    async def get_activity_feed(
        self,
        user_id: str,
        limit: int = 50,
        skip: int = 0
    ) -> List[Dict[str, Any]]:
        """Get activity feed for a user"""
        cursor = self.db["serving_activity_feed"].find(
            {"user_id": user_id},
            {"_id": 0}
        ).sort("timestamp", -1).skip(skip).limit(limit)
        
        return await cursor.to_list(length=None)
    
    async def record_kpi_snapshot(
        self,
        user_id: str,
        kpis: Dict[str, float],
        goals: Optional[Dict[str, float]] = None
    ) -> str:
        """Record a KPI snapshot for trend analysis"""
        achievement = {}
        if goals:
            for key, goal in goals.items():
                if goal > 0 and key in kpis:
                    achievement[key] = round((kpis[key] / goal) * 100, 2)
        
        snapshot = ServingKPISnapshot(
            user_id=user_id,
            date=datetime.now(timezone.utc),
            kpis=kpis,
            goals=goals or {},
            achievement_pct=achievement
        )
        
        await self.db["serving_kpi_snapshots"].insert_one(snapshot.to_mongo_dict())
        return snapshot.id
    
    async def get_kpi_trend(
        self,
        user_id: str,
        days: int = 30
    ) -> List[Dict[str, Any]]:
        """Get KPI trend data for charts"""
        start_date = datetime.now(timezone.utc) - timedelta(days=days)
        
        cursor = self.db["serving_kpi_snapshots"].find(
            {"user_id": user_id, "date": {"$gte": start_date}},
            {"_id": 0}
        ).sort("date", 1)
        
        return await cursor.to_list(length=None)
    
    # ==================== HELPER METHODS ====================
    
    def _get_period_boundaries(
        self,
        reference: datetime,
        period: str
    ) -> tuple[datetime, datetime]:
        """Calculate period start and end dates"""
        if period == "daily":
            start = reference.replace(hour=0, minute=0, second=0, microsecond=0)
            end = start + timedelta(days=1)
        elif period == "weekly":
            start = reference - timedelta(days=reference.weekday())
            start = start.replace(hour=0, minute=0, second=0, microsecond=0)
            end = start + timedelta(days=7)
        elif period == "monthly":
            start = reference.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            if reference.month == 12:
                end = start.replace(year=reference.year + 1, month=1)
            else:
                end = start.replace(month=reference.month + 1)
        elif period == "quarterly":
            quarter = (reference.month - 1) // 3
            start = reference.replace(month=quarter * 3 + 1, day=1, hour=0, minute=0, second=0, microsecond=0)
            if quarter == 3:
                end = start.replace(year=reference.year + 1, month=1)
            else:
                end = start.replace(month=(quarter + 1) * 3 + 1)
        else:  # yearly
            start = reference.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
            end = start.replace(year=reference.year + 1)
        
        return start, end
    
    def _build_visibility_query(
        self,
        user_id: str,
        scope: VisibilityScope,
        team_ids: Optional[List[str]] = None,
        department_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Build MongoDB query for visibility scope"""
        if scope == VisibilityScope.ALL:
            return {}
        elif scope == VisibilityScope.OWN:
            return {"$or": [{"owner_id": user_id}, {"assigned_to": user_id}]}
        elif scope == VisibilityScope.TEAM and team_ids:
            return {"$or": [{"owner_id": user_id}, {"team_id": {"$in": team_ids}}]}
        elif scope == VisibilityScope.DEPARTMENT and department_id:
            return {"$or": [{"owner_id": user_id}, {"department_id": department_id}]}
        else:
            return {"$or": [{"owner_id": user_id}, {"assigned_to": user_id}]}
    
    async def _aggregate_accounts(
        self,
        user_id: str,
        period_start: datetime,
        period_end: datetime
    ) -> Dict[str, int]:
        """Aggregate account statistics"""
        collection = self.db["canonical_accounts"]
        
        total = await collection.count_documents({
            "$or": [{"owner_id": user_id}, {"assigned_to": user_id}]
        })
        
        new = await collection.count_documents({
            "$or": [{"owner_id": user_id}, {"assigned_to": user_id}],
            "created_at": {"$gte": period_start, "$lt": period_end}
        })
        
        active = await collection.count_documents({
            "$or": [{"owner_id": user_id}, {"assigned_to": user_id}],
            "is_active": True
        })
        
        return {"total": total, "new": new, "active": active}
    
    async def _aggregate_opportunities(
        self,
        user_id: str,
        period_start: datetime,
        period_end: datetime
    ) -> Dict[str, Any]:
        """Aggregate opportunity statistics"""
        collection = self.db["canonical_opportunities"]
        base_query = {"$or": [{"owner_id": user_id}, {"assigned_to": user_id}]}
        
        total = await collection.count_documents(base_query)
        
        open_opps = await collection.count_documents({
            **base_query,
            "is_closed": False
        })
        
        won = await collection.count_documents({
            **base_query,
            "is_closed": True,
            "is_won": True
        })
        
        lost = await collection.count_documents({
            **base_query,
            "is_closed": True,
            "is_won": False
        })
        
        # Pipeline value (open opportunities)
        pipeline_agg = await collection.aggregate([
            {"$match": {**base_query, "is_closed": False}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(length=1)
        pipeline_value = pipeline_agg[0]["total"] if pipeline_agg else 0
        
        # Won value
        won_agg = await collection.aggregate([
            {"$match": {**base_query, "is_closed": True, "is_won": True}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(length=1)
        won_value = won_agg[0]["total"] if won_agg else 0
        
        return {
            "total": total,
            "open": open_opps,
            "won": won,
            "lost": lost,
            "closed_total": won + lost,
            "pipeline_value": pipeline_value,
            "won_value": won_value
        }
    
    async def _aggregate_activities(
        self,
        user_id: str,
        period_start: datetime,
        period_end: datetime
    ) -> Dict[str, int]:
        """Aggregate activity statistics"""
        collection = self.db["canonical_activities"]
        base_query = {"$or": [{"owner_id": user_id}, {"assigned_to": user_id}]}
        now = datetime.now(timezone.utc)
        
        total = await collection.count_documents(base_query)
        
        completed = await collection.count_documents({
            **base_query,
            "status": ActivityStatus.COMPLETED.value
        })
        
        overdue = await collection.count_documents({
            **base_query,
            "status": {"$ne": ActivityStatus.COMPLETED.value},
            "due_date": {"$lt": now}
        })
        
        upcoming = await collection.count_documents({
            **base_query,
            "status": {"$ne": ActivityStatus.COMPLETED.value},
            "due_date": {"$gte": now, "$lt": now + timedelta(days=7)}
        })
        
        return {
            "total": total,
            "completed": completed,
            "overdue": overdue,
            "upcoming": upcoming
        }
    
    async def _calculate_average_opportunity_age(
        self,
        query: Dict[str, Any]
    ) -> float:
        """Calculate average age of opportunities in days"""
        now = datetime.now(timezone.utc)
        
        pipeline = [
            {"$match": query},
            {
                "$project": {
                    "age_ms": {"$subtract": [now, "$created_at"]}
                }
            },
            {
                "$group": {
                    "_id": None,
                    "avg_age_ms": {"$avg": "$age_ms"}
                }
            }
        ]
        
        result = await self.db["canonical_opportunities"].aggregate(pipeline).to_list(length=1)
        
        if result and result[0]["avg_age_ms"]:
            # Convert milliseconds to days
            return round(result[0]["avg_age_ms"] / (1000 * 60 * 60 * 24), 1)
        return 0.0
    
    async def _count_stalled_opportunities(
        self,
        query: Dict[str, Any]
    ) -> int:
        """Count opportunities with no activity in 14 days"""
        stale_date = datetime.now(timezone.utc) - timedelta(days=14)
        
        stalled_query = {
            **query,
            "$or": [
                {"updated_at": {"$lt": stale_date}},
                {"updated_at": {"$exists": False}}
            ]
        }
        
        return await self.db["canonical_opportunities"].count_documents(stalled_query)
