import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { dashboardAPI, activitiesAPI, opportunitiesAPI } from "../services/api";
import { StageBadge, PriorityBadge } from "../components/Badge";
import { formatCurrency, formatDate, isOverdue, cn } from "../lib/utils";
import {
  DollarSign,
  Target,
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  ArrowUpRight,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  BarChart3,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from "recharts";

const COLORS = {
  primary: "#4F46E5",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  muted: "#64748B",
  stages: ["#4F46E5", "#8B5CF6", "#06B6D4", "#10B981", "#F59E0B", "#64748B"],
};

// ========================================
// KPI CARD COMPONENT
// ========================================

const KPICard = ({ title, value, change, changeType, icon: Icon, subtitle, color = "slate" }) => {
  const colorClasses = {
    indigo: "from-indigo-500 to-indigo-600",
    emerald: "from-emerald-500 to-emerald-600",
    amber: "from-amber-500 to-amber-600",
    rose: "from-rose-500 to-rose-600",
    slate: "from-slate-600 to-slate-700",
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
          <p className="text-3xl font-bold text-slate-900 tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
          )}
          {change !== undefined && (
            <div className={cn(
              "flex items-center gap-1 mt-2 text-sm font-medium",
              changeType === "up" ? "text-emerald-600" : changeType === "down" ? "text-red-600" : "text-slate-500"
            )}>
              {changeType === "up" ? (
                <TrendingUp className="w-4 h-4" />
              ) : changeType === "down" ? (
                <TrendingDown className="w-4 h-4" />
              ) : null}
              <span>{change}</span>
            </div>
          )}
        </div>
        <div className={cn(
          "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center",
          colorClasses[color]
        )}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
};

// ========================================
// MINI CHART COMPONENT
// ========================================

const MiniAreaChart = ({ data, dataKey, color }) => (
  <ResponsiveContainer width="100%" height={60}>
    <AreaChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
      <defs>
        <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <Area
        type="monotone"
        dataKey={dataKey}
        stroke={color}
        strokeWidth={2}
        fill={`url(#gradient-${dataKey})`}
      />
    </AreaChart>
  </ResponsiveContainer>
);

// ========================================
// ACTIVITY ITEM COMPONENT
// ========================================

const ActivityItem = ({ activity }) => {
  const isOverdueItem = isOverdue(activity.due_date, activity.status);
  
  return (
    <div className="flex items-center gap-4 py-3 border-b border-slate-100 last:border-0">
      <div className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
        isOverdueItem ? "bg-red-50" : "bg-slate-100"
      )}>
        {activity.activity_type === "meeting" ? (
          <Calendar className={cn("w-5 h-5", isOverdueItem ? "text-red-600" : "text-slate-600")} />
        ) : activity.activity_type === "call" ? (
          <Users className={cn("w-5 h-5", isOverdueItem ? "text-red-600" : "text-slate-600")} />
        ) : (
          <CheckCircle2 className={cn("w-5 h-5", isOverdueItem ? "text-red-600" : "text-slate-600")} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">{activity.title}</p>
        <p className="text-xs text-slate-500">{activity.account_name || "No account"}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={cn(
          "text-xs font-medium",
          isOverdueItem ? "text-red-600" : "text-slate-600"
        )}>
          {formatDate(activity.due_date)}
        </p>
        <PriorityBadge priority={activity.priority} />
      </div>
    </div>
  );
};

// ========================================
// OPPORTUNITY ROW COMPONENT
// ========================================

const OpportunityRow = ({ opportunity }) => (
  <Link 
    to={`/opportunities/${opportunity.id}`}
    className="flex items-center gap-4 py-3 px-4 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
  >
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-slate-900 truncate">{opportunity.name}</p>
      <p className="text-xs text-slate-500">{opportunity.account_name || "No account"}</p>
    </div>
    <div className="text-right">
      <p className="text-sm font-bold text-slate-900">{formatCurrency(opportunity.value)}</p>
      <StageBadge stage={opportunity.stage} />
    </div>
    <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
  </Link>
);

// ========================================
// MAIN DASHBOARD COMPONENT
// ========================================

const Dashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [pipelineData, setPipelineData] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [topOpportunities, setTopOpportunities] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, pipelineRes, revenueRes, activitiesRes, oppsRes] =
        await Promise.all([
          dashboardAPI.getStats(),
          dashboardAPI.getPipelineByStage(),
          dashboardAPI.getRevenueTrend(),
          activitiesAPI.getAll({ status: "pending" }),
          opportunitiesAPI.getAll(),
        ]);

      setStats(statsRes.data);
      setPipelineData(pipelineRes.data);
      setRevenueData(revenueRes.data);
      setRecentActivities(activitiesRes.data.slice(0, 5));
      setTopOpportunities(
        oppsRes.data
          .filter((o) => !["closed_won", "closed_lost"].includes(o.stage))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5)
      );
    } catch (error) {
      console.error("Dashboard error:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const winRate = stats?.total_opportunities > 0 
    ? ((stats?.won_opportunities / stats?.total_opportunities) * 100).toFixed(1)
    : 0;

  return (
    <div className="space-y-6 animate-in" data-testid="dashboard-page">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome back, {user?.name?.split(" ")[0]}
          </h1>
          <p className="text-slate-500 mt-0.5">
            Here&apos;s what&apos;s happening with your sales today.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/opportunities/new" className="btn-primary">
            <Target className="w-4 h-4" />
            New Opportunity
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Pipeline Value"
          value={formatCurrency(stats?.total_pipeline_value || 0)}
          change="+12% from last month"
          changeType="up"
          icon={DollarSign}
          color="indigo"
        />
        <KPICard
          title="Won Revenue"
          value={formatCurrency(stats?.won_revenue || 0)}
          change="+8% from last month"
          changeType="up"
          icon={TrendingUp}
          color="emerald"
        />
        <KPICard
          title="Active Opportunities"
          value={stats?.active_opportunities || 0}
          subtitle={`${stats?.total_opportunities || 0} total`}
          icon={Target}
          color="amber"
        />
        <KPICard
          title="Win Rate"
          value={`${winRate}%`}
          subtitle={`${stats?.won_opportunities || 0} won`}
          icon={BarChart3}
          color="slate"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline by Stage Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Pipeline by Stage</h3>
              <p className="text-sm text-slate-500">Distribution of opportunities</p>
            </div>
            <Link to="/opportunities" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
              View all <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <XAxis type="number" hide />
                <YAxis 
                  type="category" 
                  dataKey="stage" 
                  width={100}
                  tick={{ fontSize: 12, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                  formatter={(value) => [formatCurrency(value), 'Value']}
                />
                <Bar 
                  dataKey="value" 
                  radius={[0, 4, 4, 0]}
                  maxBarSize={24}
                >
                  {pipelineData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS.stages[index % COLORS.stages.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Opportunities */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Top Opportunities</h3>
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
              {topOpportunities.length} deals
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {topOpportunities.length > 0 ? (
              topOpportunities.map((opp) => (
                <OpportunityRow key={opp.id} opportunity={opp} />
              ))
            ) : (
              <div className="p-8 text-center">
                <Target className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No active opportunities</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trend */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Revenue Trend</h3>
              <p className="text-sm text-slate-500">Monthly closed deals</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="month" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748B' }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748B' }}
                  tickFormatter={(value) => `$${value / 1000}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                  formatter={(value) => [formatCurrency(value), 'Revenue']}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke={COLORS.primary}
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Upcoming Activities */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Upcoming Activities</h3>
            <Link to="/activities" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
              View all
            </Link>
          </div>
          <div className="p-4">
            {recentActivities.length > 0 ? (
              recentActivities.map((activity) => (
                <ActivityItem key={activity.id} activity={activity} />
              ))
            ) : (
              <div className="py-8 text-center">
                <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No upcoming activities</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats Footer */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{stats?.total_accounts || 0}</p>
            <p className="text-xs text-slate-500">Total Accounts</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{stats?.completed_activities || 0}</p>
            <p className="text-xs text-slate-500">Completed Tasks</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{stats?.pending_activities || 0}</p>
            <p className="text-xs text-slate-500">Pending Tasks</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{stats?.overdue_activities || 0}</p>
            <p className="text-xs text-slate-500">Overdue Tasks</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
