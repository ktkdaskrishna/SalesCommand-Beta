"""
Initialize CQRS System
Register all projections with event bus
"""
import logging
from event_store.publisher import event_bus
from projections.user_profile_projection import UserProfileProjection
from projections.opportunity_projection import OpportunityProjection
from projections.access_matrix_projection import AccessMatrixProjection
from projections.dashboard_metrics_projection import DashboardMetricsProjection
from core.database import Database

logger = logging.getLogger(__name__)


def initialize_cqrs_system():
    """
    Initialize CQRS system - register all projections.
    Call this on application startup.
    """
    logger.info("Initializing CQRS system...")
    
    db = Database.get_db()
    
    # Create projections
    user_profile_proj = UserProfileProjection(db)
    opportunity_proj = OpportunityProjection(db)
    access_matrix_proj = AccessMatrixProjection(db)
    metrics_proj = DashboardMetricsProjection(db)
    
    # Register with event bus
    for projection in [user_profile_proj, opportunity_proj, access_matrix_proj, metrics_proj]:
        for event_type in projection.subscribes_to():
            event_bus.subscribe(event_type, projection.handle)
    
    logger.info(f"CQRS initialized: {event_bus.get_subscriber_count()} total subscriptions")
    
    return {
        "user_profile": user_profile_proj,
        "opportunity": opportunity_proj,
        "access_matrix": access_matrix_proj,
        "metrics": metrics_proj
    }
