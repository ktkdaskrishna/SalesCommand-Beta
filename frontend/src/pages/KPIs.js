import React, { useState, useEffect } from "react";
import { kpisAPI } from "../services/api";
import KPICard from "../components/KPICard";
import { useAuth } from "../context/AuthContext";
import { formatCurrency } from "../lib/utils";
import {
  BarChart3,
  Plus,
  Loader2,
  X,
  TrendingUp,
  DollarSign,
  Target,
  Users,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  Legend,
} from "recharts";

const CATEGORIES = [
  { value: "sales", label: "Sales", icon: DollarSign },
  { value: "activity", label: "Activity", icon: Target },
  { value: "relationship", label: "Relationship", icon: Users },
  { value: "execution", label: "Execution", icon: TrendingUp },
];

const UNITS = [
  { value: "currency", label: "Currency ($)" },
  { value: "percentage", label: "Percentage (%)" },
  { value: "count", label: "Count (#)" },
];

const PERIODS = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

const KPIs = () => {
  const { isExecutive } = useAuth();
  const [kpis, setKpis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    target_value: "",
    current_value: "0",
    unit: "currency",
    period: "monthly",
    category: "sales",
    product_line: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchKPIs();
  }, [categoryFilter]);

  const fetchKPIs = async () => {
    try {
      const response = await kpisAPI.getAll({ category: categoryFilter || undefined });
      setKpis(response.data);
    } catch (error) {
      console.error("Error fetching KPIs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await kpisAPI.create({
        ...formData,
        target_value: parseFloat(formData.target_value),
        current_value: parseFloat(formData.current_value),
        product_line: formData.product_line || null,
      });
      setShowModal(false);
      setFormData({
        name: "",
        target_value: "",
        current_value: "0",
        unit: "currency",
        period: "monthly",
        category: "sales",
        product_line: "",
      });
      fetchKPIs();
    } catch (error) {
      console.error("Error creating KPI:", error);
    } finally {
      setSaving(false);
    }
  };

  // Prepare chart data
  const chartData = kpis.map((kpi) => ({
    name: kpi.name.length > 15 ? kpi.name.substring(0, 15) + "..." : kpi.name,
    achievement: kpi.achievement_percentage,
    target: 100,
  }));

  const radialData = kpis.slice(0, 4).map((kpi, index) => ({
    name: kpi.name,
    value: Math.min(kpi.achievement_percentage, 100),
    fill: ["#2563EB", "#10B981", "#F59E0B", "#8B5CF6"][index],
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  // Calculate overall stats
  const avgAchievement = kpis.length > 0
    ? kpis.reduce((sum, k) => sum + k.achievement_percentage, 0) / kpis.length
    : 0;
  const onTrack = kpis.filter((k) => k.achievement_percentage >= 75).length;
  const atRisk = kpis.filter((k) => k.achievement_percentage < 50).length;

  return (
    <div className="animate-in space-y-6" data-testid="kpis-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            KPIs
          </h1>
          <p className="text-slate-500 mt-1">
            Track performance against targets
          </p>
        </div>
        {isExecutive() && (
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary flex items-center gap-2"
            data-testid="add-kpi-btn"
          >
            <Plus className="w-4 h-4" />
            Add KPI
          </button>
        )}
      </div>

      {/* Category Tabs */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategoryFilter("")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              categoryFilter === ""
                ? "bg-slate-900 text-white shadow-lg"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
            data-testid="filter-all"
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategoryFilter(cat.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                categoryFilter === cat.value
                  ? "bg-slate-900 text-white shadow-lg"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
              data-testid={`filter-${cat.value}`}
            >
              <cat.icon className="w-4 h-4" />
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6">
          <p className="label">Average Achievement</p>
          <p className="text-4xl font-bold text-slate-900 mt-2">
            {avgAchievement.toFixed(1)}%
          </p>
          <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${Math.min(avgAchievement, 100)}%` }}
            />
          </div>
        </div>
        <div className="card p-6">
          <p className="label">On Track</p>
          <p className="text-4xl font-bold text-emerald-600 mt-2">{onTrack}</p>
          <p className="text-sm text-slate-500 mt-1">
            KPIs at 75%+ achievement
          </p>
        </div>
        <div className="card p-6">
          <p className="label">At Risk</p>
          <p className="text-4xl font-bold text-red-600 mt-2">{atRisk}</p>
          <p className="text-sm text-slate-500 mt-1">
            KPIs below 50% achievement
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6" data-testid="achievement-chart">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            KPI Achievement
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="achievement" fill="#2563EB" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-6" data-testid="radial-chart">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Top KPIs Progress
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="20%"
                outerRadius="90%"
                data={radialData}
                startAngle={90}
                endAngle={-270}
              >
                <RadialBar
                  background
                  dataKey="value"
                  cornerRadius={5}
                />
                <Legend
                  iconSize={10}
                  layout="horizontal"
                  verticalAlign="bottom"
                />
                <Tooltip formatter={(v) => `${v}%`} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {kpis.map((kpi) => (
          <KPICard
            key={kpi.id}
            title={kpi.name}
            value={kpi.current_value}
            target={kpi.target_value}
            unit={kpi.unit}
            trend={kpi.trend}
          />
        ))}
      </div>

      {kpis.length === 0 && (
        <div className="card p-12 text-center">
          <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            No KPIs Found
          </h3>
          <p className="text-slate-500 mb-4">
            {categoryFilter
              ? "No KPIs in this category."
              : "Get started by creating your first KPI."}
          </p>
          {isExecutive() && (
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary"
            >
              Create KPI
            </button>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full" data-testid="kpi-modal">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Add New KPI</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  KPI Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  required
                  placeholder="e.g., Quarterly Revenue Target"
                  data-testid="kpi-name-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Target Value *
                  </label>
                  <input
                    type="number"
                    value={formData.target_value}
                    onChange={(e) => setFormData({ ...formData, target_value: e.target.value })}
                    className="input"
                    required
                    data-testid="kpi-target-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Current Value
                  </label>
                  <input
                    type="number"
                    value={formData.current_value}
                    onChange={(e) => setFormData({ ...formData, current_value: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Unit
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="input"
                  >
                    {UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Period
                  </label>
                  <select
                    value={formData.period}
                    onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                    className="input"
                  >
                    {PERIODS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="input"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex items-center gap-2"
                  data-testid="save-kpi-btn"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create KPI
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default KPIs;
