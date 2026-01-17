/**
 * Activity Dashboard - Overview with Risk Indicators
 * Shows activity status and presales KPI progress
 */
import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, CheckCircle, TrendingUp, Target } from 'lucide-react';
import api from '../services/api';

const ActivityDashboard = ({ stats }) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If stats are passed as prop, use them
    if (stats) {
      setSummary(stats);
      setLoading(false);
    } else {
      fetchSummary();
    }
  }, [stats]);

  const fetchSummary = async () => {
    try {
      const response = await api.get('/v2/activities/dashboard-summary');
      setSummary(response.data);
    } catch (error) {
      console.error('Failed to fetch activity summary:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !summary) return null;

  // DEFENSIVE: Safely access stats properties with defaults
  const total = summary.total || 0;
  const overdue = summary.overdue || 0;
  const dueToday = summary.due_today || 0;
  const upcoming = summary.upcoming || 0;
  const completed = summary.completed || 0;
  const byType = summary.by_type || {};
  const byStatus = summary.by_status || {};

  return (
    <div className="space-y-4 mb-6">
      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatusCard
          title="Overdue"
          count={overdue}
          icon={AlertTriangle}
          color="red"
          subtitle={`${overdue} need attention`}
        />
        <StatusCard
          title="Due Today"
          count={dueToday}
          icon={Clock}
          color="orange"
          subtitle="Urgent"
        />
        <StatusCard
          title="Upcoming"
          count={upcoming}
          icon={TrendingUp}
          color="blue"
          subtitle="On track"
        />
        <StatusCard
          title="Completed"
          count={completed}
          icon={CheckCircle}
          color="emerald"
          subtitle="Done"
        />
      </div>

      {/* Activity Type Breakdown */}
      {Object.keys(byType).length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-slate-900">Activity Types</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(byType).map(([type, count]) => (
              <div key={type} className="text-center p-3 bg-slate-50 rounded-lg">
                <p className="text-2xl font-bold text-slate-900">{count}</p>
                <p className="text-xs text-slate-600 font-medium mt-1">{type}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Total Summary */}
      <div className="card p-4 bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-indigo-700 font-medium">Total Activities</p>
            <p className="text-3xl font-bold text-indigo-900">{total}</p>
          </div>
          <Target className="w-12 h-12 text-indigo-400" />
        </div>
      </div>
    </div>
  );
};

const StatusCard = ({ title, count, icon: Icon, color, subtitle }) => {
  const colorClasses = {
    red: 'bg-red-50 border-red-200',
    orange: 'bg-orange-50 border-orange-200',
    blue: 'bg-blue-50 border-blue-200',
    emerald: 'bg-emerald-50 border-emerald-200'
  };

  const iconColors = {
    red: 'text-red-600',
    orange: 'text-orange-600',
    blue: 'text-blue-600',
    emerald: 'text-emerald-600'
  };

  return (
    <div className={`card p-4 border-2 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <Icon className={`w-6 h-6 ${iconColors[color]}`} />
        <span className="text-3xl font-bold text-slate-900">{count}</span>
      </div>
      <p className="font-semibold text-slate-900 text-sm">{title}</p>
      <p className={`text-xs ${iconColors[color]} opacity-75 mt-1`}>{subtitle}</p>
    </div>
  );
};

export default ActivityDashboard;
