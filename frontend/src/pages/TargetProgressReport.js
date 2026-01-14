/**
 * Target Progress Report Page
 * Displays team-wide sales target progress with individual salesperson breakdown
 * Features: Summary cards, team metrics, individual progress cards with status indicators
 */
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { formatCurrency, cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import {
  Target,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  BarChart3,
  Filter,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

// Status configuration with colors and icons
const STATUS_CONFIG = {
  achieved: {
    label: 'Achieved',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    bgColor: 'bg-emerald-500',
    icon: CheckCircle2,
  },
  on_track: {
    label: 'On Track',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    bgColor: 'bg-blue-500',
    icon: TrendingUp,
  },
  at_risk: {
    label: 'At Risk',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    bgColor: 'bg-amber-500',
    icon: AlertTriangle,
  },
  behind: {
    label: 'Behind',
    color: 'bg-red-50 text-red-700 border-red-200',
    bgColor: 'bg-red-500',
    icon: Clock,
  },
};

// Summary Stat Card
const SummaryCard = ({ title, value, subtitle, icon: Icon, trend, trendValue, color = 'slate' }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-all">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
        <p className={cn("text-3xl font-bold mt-1", `text-${color}-600`)}>{value}</p>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      <div className={cn("p-2 rounded-lg", `bg-${color}-50`)}>
        <Icon className={cn("w-5 h-5", `text-${color}-600`)} />
      </div>
    </div>
    {trend !== undefined && (
      <div className="flex items-center gap-1 mt-3 text-sm">
        {trend >= 0 ? (
          <ArrowUpRight className="w-4 h-4 text-emerald-500" />
        ) : (
          <ArrowDownRight className="w-4 h-4 text-red-500" />
        )}
        <span className={trend >= 0 ? 'text-emerald-600' : 'text-red-600'}>
          {Math.abs(trend)}%
        </span>
        <span className="text-slate-500">{trendValue || 'vs target'}</span>
      </div>
    )}
  </div>
);

// Progress Bar Component
const ProgressBar = ({ value, max = 100, color = 'blue', showLabel = true, size = 'md' }) => {
  const percentage = Math.min(Math.round((value / max) * 100), 100);
  const heightClass = size === 'sm' ? 'h-1.5' : size === 'md' ? 'h-2' : 'h-3';
  
  return (
    <div className="w-full">
      <div className={cn("w-full bg-slate-100 rounded-full overflow-hidden", heightClass)}>
        <div
          className={cn("rounded-full transition-all duration-500", heightClass, `bg-${color}-500`)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-xs text-slate-500 mt-1">{percentage}% of target</p>
      )}
    </div>
  );
};

// Individual Progress Card
const UserProgressCard = ({ user }) => {
  const statusConfig = STATUS_CONFIG[user.status] || STATUS_CONFIG.behind;
  const StatusIcon = statusConfig.icon;
  
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-all" data-testid={`user-progress-${user.user_id}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-800">{user.user_name}</h3>
          <p className="text-sm text-slate-500">{user.role_name}</p>
        </div>
        <span className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
          statusConfig.color
        )}>
          <StatusIcon className="w-3.5 h-3.5" />
          {statusConfig.label}
        </span>
      </div>
      
      {/* Overall Progress */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-medium text-slate-700">Overall Progress</span>
          <span className="text-lg font-bold text-slate-800">{user.progress.overall}%</span>
        </div>
        <ProgressBar 
          value={user.progress.overall} 
          color={user.status === 'achieved' ? 'emerald' : user.status === 'on_track' ? 'blue' : user.status === 'at_risk' ? 'amber' : 'red'}
          showLabel={false}
          size="lg"
        />
      </div>
      
      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-3">
        {/* Revenue */}
        <div className="text-center p-3 bg-slate-50 rounded-lg">
          <DollarSign className="w-4 h-4 mx-auto text-emerald-600 mb-1" />
          <p className="text-xs text-slate-500 mb-1">Revenue</p>
          <p className="text-sm font-semibold text-slate-800">
            {formatCurrency(user.actual.revenue)}
          </p>
          <p className="text-xs text-slate-400">
            / {formatCurrency(user.target.revenue)}
          </p>
          <p className={cn(
            "text-xs font-medium mt-1",
            user.variance.revenue >= 0 ? 'text-emerald-600' : 'text-red-600'
          )}>
            {user.progress.revenue}%
          </p>
        </div>
        
        {/* Deals */}
        <div className="text-center p-3 bg-slate-50 rounded-lg">
          <Target className="w-4 h-4 mx-auto text-blue-600 mb-1" />
          <p className="text-xs text-slate-500 mb-1">Deals</p>
          <p className="text-sm font-semibold text-slate-800">{user.actual.deals}</p>
          <p className="text-xs text-slate-400">/ {user.target.deals}</p>
          <p className={cn(
            "text-xs font-medium mt-1",
            user.variance.deals >= 0 ? 'text-emerald-600' : 'text-red-600'
          )}>
            {user.progress.deals}%
          </p>
        </div>
        
        {/* Activities */}
        <div className="text-center p-3 bg-slate-50 rounded-lg">
          <Activity className="w-4 h-4 mx-auto text-purple-600 mb-1" />
          <p className="text-xs text-slate-500 mb-1">Activities</p>
          <p className="text-sm font-semibold text-slate-800">{user.actual.activities}</p>
          <p className="text-xs text-slate-400">/ {user.target.activities}</p>
          <p className={cn(
            "text-xs font-medium mt-1",
            user.variance.activities >= 0 ? 'text-emerald-600' : 'text-red-600'
          )}>
            {user.progress.activities}%
          </p>
        </div>
      </div>
    </div>
  );
};

// Main Component
export default function TargetProgressReport() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [periodFilter, setPeriodFilter] = useState('');
  const [roles, setRoles] = useState([]);
  const [roleFilter, setRoleFilter] = useState('');

  // Fetch roles for filter
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await api.get('/config/roles');
        setRoles(response.data || []);
      } catch (err) {
        console.error('Failed to fetch roles:', err);
      }
    };
    fetchRoles();
  }, []);

  // Fetch report data
  const fetchReport = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      const params = new URLSearchParams();
      if (periodFilter) params.append('period_type', periodFilter);
      if (roleFilter) params.append('role_id', roleFilter);
      
      const response = await api.get(`/config/target-progress-report?${params.toString()}`);
      setReportData(response.data);
    } catch (err) {
      console.error('Failed to fetch target progress report:', err);
      setError('Failed to load target progress report');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodFilter, roleFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-slate-600">Loading target progress report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-slate-600">{error}</p>
          <Button onClick={() => fetchReport()} className="mt-4">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const { summary, team_totals, team_progress, individual_progress } = reportData || {};

  return (
    <div className="min-h-screen bg-slate-50 p-6" data-testid="target-progress-report">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-blue-600" />
            Target Progress Report
          </h1>
          <p className="text-slate-500 mt-1">
            Track team performance against sales targets
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Period Filter */}
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-36 bg-white">
              <Filter className="w-4 h-4 mr-2 text-slate-400" />
              <SelectValue placeholder="All Periods" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Periods</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
          
          {/* Role Filter */}
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-40 bg-white">
              <Users className="w-4 h-4 mr-2 text-slate-400" />
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Roles</SelectItem>
              {roles.map(role => (
                <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Refresh Button */}
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => fetchReport(true)}
            disabled={refreshing}
          >
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard
          title="Total Salespeople"
          value={summary?.total_salespeople || 0}
          subtitle={`${summary?.achieved || 0} achieved target`}
          icon={Users}
          color="blue"
        />
        <SummaryCard
          title="Team Revenue"
          value={formatCurrency(team_totals?.actual_revenue || 0)}
          subtitle={`Target: ${formatCurrency(team_totals?.target_revenue || 0)}`}
          icon={DollarSign}
          color="emerald"
          trend={team_progress?.revenue ? team_progress.revenue - 100 : undefined}
        />
        <SummaryCard
          title="Total Deals"
          value={team_totals?.actual_deals || 0}
          subtitle={`Target: ${team_totals?.target_deals || 0}`}
          icon={Target}
          color="purple"
          trend={team_progress?.deals ? team_progress.deals - 100 : undefined}
        />
        <SummaryCard
          title="Total Activities"
          value={team_totals?.actual_activities || 0}
          subtitle={`Target: ${team_totals?.target_activities || 0}`}
          icon={Activity}
          color="amber"
          trend={team_progress?.activities ? team_progress.activities - 100 : undefined}
        />
      </div>

      {/* Status Distribution */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Status Distribution</h2>
        <div className="grid grid-cols-4 gap-4">
          {Object.entries(STATUS_CONFIG).map(([key, config]) => {
            const count = summary?.[key] || 0;
            const total = summary?.total_salespeople || 1;
            const percentage = Math.round((count / total) * 100);
            const Icon = config.icon;
            
            return (
              <div key={key} className="text-center">
                <div className={cn("inline-flex items-center justify-center w-12 h-12 rounded-full mb-2", config.color)}>
                  <Icon className="w-6 h-6" />
                </div>
                <p className="text-2xl font-bold text-slate-800">{count}</p>
                <p className="text-sm text-slate-500">{config.label}</p>
                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                  <div 
                    className={cn("h-1.5 rounded-full", config.bgColor)}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Individual Progress Grid */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Individual Performance</h2>
        {individual_progress && individual_progress.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {individual_progress.map(userProgress => (
              <UserProgressCard key={userProgress.user_id} user={userProgress} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
            <Target className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">No salespeople with active targets</p>
            <p className="text-slate-400 text-sm mt-1">
              Configure role-based targets in Admin Panel to see progress
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
