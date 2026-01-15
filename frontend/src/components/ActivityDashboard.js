/**
 * Activity Dashboard - Overview with Risk Indicators
 * Shows activity status and presales KPI progress
 */
import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, CheckCircle, TrendingUp, Target } from 'lucide-react';
import api from '../services/api';

const ActivityDashboard = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummary();
  }, []);

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

  const { overview, at_risk, by_presales_category } = summary;

  return (
    <div className="space-y-4 mb-6">
      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatusCard
          title="Overdue"
          count={overview.overdue.count}
          icon={AlertTriangle}
          color="red"
          subtitle={`${overview.overdue.count} need attention`}
        />
        <StatusCard
          title="Due Today"
          count={overview.due_today.count}
          icon={Clock}
          color="orange"
          subtitle="Urgent"
        />
        <StatusCard
          title="In Progress"
          count={overview.in_progress.count}
          icon={TrendingUp}
          color="blue"
          subtitle="On track"
        />
        <StatusCard
          title="Completed"
          count={overview.completed.count}
          icon={CheckCircle}
          color="emerald"
          subtitle="Done"
        />
      </div>

      {/* At Risk Activities */}
      {at_risk.count > 0 && (
        <div className="card border-l-4 border-red-500 bg-red-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-red-900">
              At Risk Activities ({at_risk.count})
            </h3>
          </div>
          <div className="space-y-2">
            {at_risk.activities.map((act, idx) => (
              <div key={idx} className="flex items-start justify-between text-sm bg-white p-2 rounded">
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{act.summary}</p>
                  <p className="text-xs text-slate-600">{act.opportunity_name}</p>
                </div>
                <span className="text-xs text-red-600 font-medium">
                  {act.due_date ? new Date(act.due_date).toLocaleDateString() : 'No date'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Presales Category Breakdown */}
      {Object.keys(by_presales_category).length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-slate-900">Presales Activities Breakdown</h3>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
            {Object.entries(by_presales_category).map(([category, stats]) => (
              <div key={category} className="text-center p-3 bg-slate-50 rounded-lg">
                <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                <p className="text-xs text-slate-600 font-medium mt-1">{category}</p>
                <div className="flex items-center justify-center gap-1 mt-2">
                  <span className="text-xs text-emerald-600">{stats.completed} ✓</span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs text-orange-600">{stats.pending} pending</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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
