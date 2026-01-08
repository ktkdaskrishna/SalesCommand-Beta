import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { dashboardAPI, activitiesAPI, opportunitiesAPI } from "../services/api";
import KPICard from "../components/KPICard";
import DataTable from "../components/DataTable";
import { StageBadge, StatusBadge, PriorityBadge } from "../components/Badge";
import { formatCurrency, formatDate, isOverdue } from "../lib/utils";
import {
  DollarSign,
  Target,
  ListTodo,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";

const CHART_COLORS = ["#2563EB", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#6B7280"];

const Dashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [pipelineData, setPipelineData] = useState([]);
  const [activityData, setActivityData] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [topOpportunities, setTopOpportunities] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, pipelineRes, activityRes, revenueRes, activitiesRes, oppsRes] =
        await Promise.all([
          dashboardAPI.getStats(),
          dashboardAPI.getPipelineByStage(),
          dashboardAPI.getActivitiesByStatus(),
          dashboardAPI.getRevenueTrend(),
          activitiesAPI.getAll({ status: "pending" }),
          opportunitiesAPI.getAll(),
        ]);

      setStats(statsRes.data);
      setPipelineData(pipelineRes.data);
      setActivityData(activityRes.data);
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
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const activityColumns = [
    { key: "title", label: "Activity" },
    {
      key: "priority",
      label: "Priority",
      render: (val) => <PriorityBadge priority={val} />,
    },
    {
      key: "due_date",
      label: "Due Date",
      render: (val, row) => (
        <span className={isOverdue(val, row.status) ? "text-red-600 font-medium" : ""}>
          {formatDate(val)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (val) => <StatusBadge status={val} />,
    },
  ];

  const opportunityColumns = [
    { key: "name", label: "Opportunity" },
    { key: "account_name", label: "Account" },
    {
      key: "value",
      label: "Value",
      render: (val) => formatCurrency(val),
    },
    {
      key: "stage",
      label: "Stage",
      render: (val) => <StageBadge stage={val} />,
    },
  ];

  return (
    <div className="animate-in space-y-8" data-testid="dashboard-page">
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          Welcome back, {user?.name?.split(" ")[0]}
        </h1>
        <p className="text-slate-600 mt-1">
          Here's what's happening with your sales today.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Pipeline Value"
          value={stats?.total_pipeline_value || 0}
          target={2000000}
          unit="currency"
          trend="up"
          icon={DollarSign}
        />
        <KPICard
          title="Won Revenue"
          value={stats?.won_revenue || 0}
          target={1000000}
          unit="currency"
          trend="up"
          icon={TrendingUp}
        />
        <KPICard
          title="Active Opportunities"
          value={stats?.active_opportunities || 0}
          unit="number"
          trend="stable"
          icon={Target}
        />
        <KPICard
          title="Activity Completion"
          value={stats?.activity_completion_rate || 0}
          target={90}
          unit="percentage"
          trend={stats?.activity_completion_rate >= 75 ? "up" : "down"}
          icon={CheckCircle2}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline by Stage */}
        <div className="card p-6" data-testid="pipeline-chart">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Pipeline by Stage</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineData} layout="vertical">
                <XAxis type="number" tickFormatter={(v) => `$${v / 1000}k`} />
                <YAxis dataKey="stage" type="category" width={100} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(v) => formatCurrency(v)}
                  contentStyle={{
                    background: "white",
                    border: "1px solid #E2E8F0",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="value" fill="#2563EB" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Activities by Status */}
        <div className="card p-6" data-testid="activities-chart">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Activities by Status</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={activityData}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {activityData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Revenue Trend */}
      <div className="card p-6" data-testid="revenue-chart">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Revenue Trend</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `$${v / 1000}k`} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(v) => formatCurrency(v)}
                contentStyle={{
                  background: "white",
                  border: "1px solid #E2E8F0",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#2563EB"
                strokeWidth={2}
                dot={{ fill: "#2563EB" }}
                name="Actual"
              />
              <Line
                type="monotone"
                dataKey="target"
                stroke="#10B981"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name="Target"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Activities */}
        <div className="card" data-testid="pending-activities">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              Pending Activities
            </h3>
            {stats?.overdue_activities > 0 && (
              <span className="badge-error flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {stats.overdue_activities} overdue
              </span>
            )}
          </div>
          <DataTable
            columns={activityColumns}
            data={recentActivities}
            emptyMessage="No pending activities"
          />
        </div>

        {/* Top Opportunities */}
        <div className="card" data-testid="top-opportunities">
          <div className="p-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-500" />
              Top Opportunities
            </h3>
          </div>
          <DataTable
            columns={opportunityColumns}
            data={topOpportunities}
            emptyMessage="No active opportunities"
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
