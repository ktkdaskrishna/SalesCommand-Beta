/**
 * Activity Timeline
 * Track all actions and updates across your organization with a beautiful timeline view
 * Design: Timeline grouped by date with icons, descriptions, timestamps, and type badges
 */
import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { formatDate, cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import ActivityDashboard from '../components/ActivityDashboard';
import ActivityDetailCard from '../components/ActivityDetailCard';
import {
  Activity,
  Plus,
  Loader2,
  X,
  Search,
  Filter,
  Clock,
  UserPlus,
  FileText,
  Phone,
  TrendingUp,
  Mail,
  Calendar,
  CheckCircle,
  AlertCircle,
  Target,
  DollarSign,
  Building2,
  ChevronDown,
} from 'lucide-react';

// Activity type configurations
const ACTIVITY_TYPES = {
  lead_created: { icon: UserPlus, color: 'bg-green-100 text-green-600', label: 'Lead' },
  opportunity_created: { icon: Target, color: 'bg-blue-100 text-blue-600', label: 'Opportunity' },
  opportunity_won: { icon: DollarSign, color: 'bg-emerald-100 text-emerald-600', label: 'Won' },
  opportunity_lost: { icon: AlertCircle, color: 'bg-red-100 text-red-600', label: 'Lost' },
  call: { icon: Phone, color: 'bg-purple-100 text-purple-600', label: 'Call' },
  email: { icon: Mail, color: 'bg-amber-100 text-amber-600', label: 'Email' },
  meeting: { icon: Calendar, color: 'bg-indigo-100 text-indigo-600', label: 'Meeting' },
  task: { icon: CheckCircle, color: 'bg-teal-100 text-teal-600', label: 'Task' },
  audit: { icon: FileText, color: 'bg-slate-100 text-slate-600', label: 'Audit' },
  proposal: { icon: FileText, color: 'bg-cyan-100 text-cyan-600', label: 'Proposal' },
  demo: { icon: TrendingUp, color: 'bg-pink-100 text-pink-600', label: 'Demo' },
  account_created: { icon: Building2, color: 'bg-orange-100 text-orange-600', label: 'Account' },
  default: { icon: Activity, color: 'bg-slate-100 text-slate-600', label: 'Activity' },
};

// Activity Item Component
const ActivityItem = ({ activity, onClick }) => {
  const config = ACTIVITY_TYPES[activity.activity_type] || ACTIVITY_TYPES.default;
  const Icon = config.icon;
  
  return (
    <div 
      className="flex gap-4 py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 px-2 -mx-2 rounded-lg transition-colors cursor-pointer"
      data-testid={`activity-item-${activity.id}`}
      onClick={onClick}
    >
      {/* Icon */}
      <div className={cn(
        "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
        config.color
      )}>
        <Icon className="w-5 h-5" />
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-slate-900 font-medium">{activity.title}</p>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-xs text-slate-500">
            {new Date(activity.timestamp || activity.created_at).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })}
          </span>
          <span className={cn(
            "px-2 py-0.5 rounded text-xs font-medium",
            config.color
          )}>
            {activity.type_label || config.label}
          </span>
        </div>
      </div>
    </div>
  );
};

// Date Group Component
const DateGroup = ({ date, activities }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Format date nicely
  const formatGroupDate = (dateStr) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    
    return d.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  return (
    <div className="mb-6">
      {/* Date Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-3 mb-4 w-full group"
      >
        <span className="px-3 py-1.5 bg-slate-100 rounded-lg text-sm font-semibold text-slate-700">
          {formatGroupDate(date)}
        </span>
        <div className="flex-1 h-px bg-slate-200" />
        <ChevronDown className={cn(
          "w-4 h-4 text-slate-400 transition-transform",
          !isExpanded && "-rotate-90"
        )} />
      </button>
      
      {/* Activities */}
      {isExpanded && (
        <div className="space-y-1">
          {activities.map((activity, idx) => (
            <ActivityItem key={activity.id || idx} activity={activity} />
          ))}
        </div>
      )}
    </div>
  );
};

// Main Activity Timeline Component
const ActivityTimeline = () => {
  const { user } = useAuth();
  const [activities, setActivities] = useState([]);
  const [stats, setStats] = useState(null); // FIXED: Add missing stats state
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      // FIXED: Use correct endpoint /activities (not /v2/activities/)
      const response = await api.get('/activities');
      
      // DEFENSIVE: Ensure activities is always an array
      let activitiesData = response.data;
      
      // Handle different response structures
      if (activitiesData && typeof activitiesData === 'object') {
        if (Array.isArray(activitiesData)) {
          activitiesData = activitiesData;
        } else if (activitiesData.activities && Array.isArray(activitiesData.activities)) {
          activitiesData = activitiesData.activities;
        } else if (activitiesData.data && Array.isArray(activitiesData.data)) {
          activitiesData = activitiesData.data;
        } else {
          console.warn('Unexpected activities response shape:', activitiesData);
          activitiesData = [];
        }
      } else {
        activitiesData = [];
      }
      
      // FIXED: Fetch stats from correct endpoint /activities/stats
      try {
        const statsResponse = await api.get('/activities/stats');
        setStats(statsResponse.data);
        console.log('Activity stats:', statsResponse.data);
      } catch (e) {
        console.warn('Could not fetch activity stats:', e.message);
        setStats(null);
      }
      
      // If no business activities, show helpful message
      if (activitiesData.length === 0) {
        setActivities([
          {
            id: 'placeholder-1',
            title: 'No business activities yet',
            activity_type: 'info',
            description: 'Business activities like opportunity updates, deal confidence analysis, and goal creation will appear here.',
            timestamp: new Date().toISOString(),
            type_label: 'Info',
            user_name: 'System',
          }
        ]);
      } else {
        setActivities(activitiesData);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
      console.error('Response data:', error.response?.data);
      // Use helpful placeholder on error
      setActivities([
        {
          id: 'error-1',
          title: 'Could not load activities',
          activity_type: 'error',
          description: `Please refresh the page to try again. Error: ${error.message}`,
          timestamp: new Date().toISOString(),
          type_label: 'Error',
          user_name: 'System',
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Filter activities
  const filteredActivities = useMemo(() => {
    // DEFENSIVE: Ensure activities is always an array
    if (!Array.isArray(activities)) {
      console.warn('activities is not an array:', activities);
      return [];
    }
    
    let result = activities;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(a => 
        a.title?.toLowerCase().includes(query) ||
        a.activity_type?.toLowerCase().includes(query)
      );
    }
    
    if (typeFilter) {
      result = result.filter(a => a.activity_type === typeFilter);
    }
    
    return result;
  }, [activities, searchQuery, typeFilter]);

  // Group activities by date
  const groupedActivities = useMemo(() => {
    const groups = {};
    
    // DEFENSIVE: Ensure filteredActivities is an array before forEach
    if (!Array.isArray(filteredActivities)) {
      console.warn('filteredActivities is not an array:', filteredActivities);
      return groups;
    }
    
    filteredActivities.forEach(activity => {
      const date = new Date(activity.timestamp || activity.created_at).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(activity);
    });
    
    // Sort groups by date (newest first)
    const sortedGroups = Object.entries(groups)
      .sort(([a], [b]) => new Date(b) - new Date(a))
      .map(([date, activities]) => ({
        date,
        activities: activities.sort((a, b) => 
          new Date(b.timestamp || b.created_at) - new Date(a.timestamp || a.created_at)
        ),
      }));
    
    return sortedGroups;
  }, [filteredActivities]);

  // Count today's activities
  const todaysCount = useMemo(() => {
    const today = new Date().toDateString();
    return activities.filter(a => 
      new Date(a.timestamp || a.created_at).toDateString() === today
    ).length;
  }, [activities]);

  // Get unique activity types for filter
  const activityTypeOptions = useMemo(() => {
    const types = [...new Set(activities.map(a => a.activity_type))];
    return types.map(type => ({
      value: type,
      label: ACTIVITY_TYPES[type]?.label || type,
    }));
  }, [activities]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="animate-in space-y-6" data-testid="activity-timeline-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Activity</h1>
          <p className="text-slate-500 mt-1">
            Track all actions and updates across your organization
          </p>
        </div>
        
        {/* Today's Activity Badge */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Today's Activity</p>
            <p className="text-2xl font-bold text-slate-900">{todaysCount} <span className="text-sm font-normal text-slate-500">actions</span></p>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search activities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
            data-testid="activity-search"
          />
        </div>
        
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="input pl-10 min-w-[160px] appearance-none bg-white"
            data-testid="activity-type-filter"
          >
            <option value="">All types</option>
            {activityTypeOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Activity Dashboard - Summary with Risk Indicators */}
      <ActivityDashboard stats={stats} />

      {/* Activity Timeline */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-6">Activity Timeline</h2>
        
        {groupedActivities.length > 0 ? (
          groupedActivities.map(group => (
            <DateGroup 
              key={group.date} 
              date={group.date} 
              activities={group.activities} 
            />
          ))
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Activity className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Activities Found</h3>
            <p className="text-slate-500">
              {searchQuery || typeFilter 
                ? 'Try adjusting your filters' 
                : 'Activities will appear here as your team works'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityTimeline;
