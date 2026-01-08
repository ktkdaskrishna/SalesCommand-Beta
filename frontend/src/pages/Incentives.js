import React, { useState, useEffect } from "react";
import { incentivesAPI, usersAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { formatCurrency, cn } from "../lib/utils";
import {
  Gift,
  Plus,
  Loader2,
  X,
  Trophy,
  TrendingUp,
  Target,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const Incentives = () => {
  const { user, isExecutive } = useAuth();
  const [incentives, setIncentives] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    user_id: "",
    name: "",
    description: "",
    target_amount: "",
    earned_amount: "0",
    period: "quarterly",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [incentivesRes] = await Promise.all([
        incentivesAPI.getAll(),
      ]);
      setIncentives(incentivesRes.data);
      
      if (isExecutive()) {
        const usersRes = await usersAPI.getAll();
        setUsers(usersRes.data.filter((u) => u.role !== "ceo" && u.role !== "admin"));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await incentivesAPI.create({
        ...formData,
        target_amount: parseFloat(formData.target_amount),
        earned_amount: parseFloat(formData.earned_amount),
      });
      setShowModal(false);
      setFormData({
        user_id: "",
        name: "",
        description: "",
        target_amount: "",
        earned_amount: "0",
        period: "quarterly",
      });
      fetchData();
    } catch (error) {
      console.error("Error creating incentive:", error);
    } finally {
      setSaving(false);
    }
  };

  // Chart data
  const chartData = incentives.map((inc) => ({
    name: inc.user_name?.split(" ")[0] || "User",
    earned: inc.earned_amount,
    target: inc.target_amount,
    achievement: inc.achievement_percentage,
  }));

  // Stats
  const totalTarget = incentives.reduce((sum, i) => sum + i.target_amount, 0);
  const totalEarned = incentives.reduce((sum, i) => sum + i.earned_amount, 0);
  const achieved = incentives.filter((i) => i.status === "achieved").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="animate-in space-y-6" data-testid="incentives-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Gift className="w-8 h-8 text-blue-600" />
            Incentives
          </h1>
          <p className="text-slate-600 mt-1">
            Track bonuses and commission earnings
          </p>
        </div>
        {isExecutive() && (
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary flex items-center gap-2"
            data-testid="add-incentive-btn"
          >
            <Plus className="w-4 h-4" />
            Add Incentive
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Target className="w-5 h-5 text-blue-600" />
            </div>
            <p className="label">Total Target</p>
          </div>
          <p className="text-3xl font-bold text-slate-900">{formatCurrency(totalTarget)}</p>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="label">Total Earned</p>
          </div>
          <p className="text-3xl font-bold text-emerald-600">{formatCurrency(totalEarned)}</p>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-amber-600" />
            </div>
            <p className="label">Achieved</p>
          </div>
          <p className="text-3xl font-bold text-slate-900">{achieved} / {incentives.length}</p>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="card p-6" data-testid="incentives-chart">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Incentive Progress by Team Member
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => `$${v / 1000}k`} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Bar dataKey="target" fill="#E2E8F0" name="Target" />
                <Bar dataKey="earned" fill="#2563EB" name="Earned">
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.achievement >= 100 ? "#10B981" : "#2563EB"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Incentive Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {incentives.map((incentive) => (
          <div key={incentive.id} className="card p-6" data-testid="incentive-card">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-slate-900">{incentive.name}</h3>
                <p className="text-sm text-slate-500">{incentive.user_name}</p>
              </div>
              <span
                className={cn(
                  "px-2.5 py-0.5 rounded-full text-xs font-semibold border",
                  incentive.status === "achieved"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                )}
              >
                {incentive.status === "achieved" ? "Achieved" : "In Progress"}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Earned</span>
                <span className="font-semibold text-emerald-600">
                  {formatCurrency(incentive.earned_amount)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Target</span>
                <span className="font-medium text-slate-900">
                  {formatCurrency(incentive.target_amount)}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    incentive.achievement_percentage >= 100
                      ? "bg-emerald-500"
                      : incentive.achievement_percentage >= 75
                      ? "bg-amber-500"
                      : "bg-blue-500"
                  )}
                  style={{ width: `${Math.min(incentive.achievement_percentage, 100)}%` }}
                />
              </div>
              <p className="text-right text-sm font-medium text-slate-600">
                {incentive.achievement_percentage.toFixed(1)}% achieved
              </p>
            </div>

            {incentive.description && (
              <p className="mt-4 text-sm text-slate-600 border-t border-slate-100 pt-4">
                {incentive.description}
              </p>
            )}
          </div>
        ))}
      </div>

      {incentives.length === 0 && (
        <div className="card p-12 text-center">
          <Gift className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            No Incentives Found
          </h3>
          <p className="text-slate-500 mb-4">
            {isExecutive()
              ? "Create incentive plans for your team."
              : "No incentive plans assigned yet."}
          </p>
          {isExecutive() && (
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary"
            >
              Create Incentive
            </button>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full" data-testid="incentive-modal">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Add Incentive Plan</h2>
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
                  Team Member *
                </label>
                <select
                  value={formData.user_id}
                  onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                  className="input"
                  required
                  data-testid="incentive-user-select"
                >
                  <option value="">Select team member...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role.replace("_", " ")})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Incentive Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  required
                  placeholder="e.g., Q4 Sales Bonus"
                  data-testid="incentive-name-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Target Amount *
                  </label>
                  <input
                    type="number"
                    value={formData.target_amount}
                    onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
                    className="input"
                    required
                    placeholder="$"
                    data-testid="incentive-target-input"
                  />
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
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input min-h-[80px]"
                  rows={3}
                  placeholder="Criteria and conditions..."
                />
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
                  data-testid="save-incentive-btn"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Incentive
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Incentives;
