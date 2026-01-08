import React, { useState, useEffect } from "react";
import { activitiesAPI, accountsAPI, opportunitiesAPI, usersAPI } from "../services/api";
import DataTable from "../components/DataTable";
import { StatusBadge, PriorityBadge } from "../components/Badge";
import { formatDate, isOverdue, cn } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import {
  ListTodo,
  Plus,
  Search,
  Filter,
  Loader2,
  X,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";

const ACTIVITY_TYPES = [
  { value: "task", label: "Task" },
  { value: "meeting", label: "Meeting" },
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "presentation", label: "Presentation" },
  { value: "demo", label: "Demo" },
];

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const PRODUCT_LINES = ["MSSP", "Application Security", "Network Security", "GRC"];

const Activities = () => {
  const { isExecutive } = useAuth();
  const [activities, setActivities] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    activity_type: "task",
    priority: "medium",
    status: "pending",
    due_date: "",
    account_id: "",
    opportunity_id: "",
    product_line: "",
    assigned_to_id: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const fetchData = async () => {
    try {
      const [activitiesRes, accountsRes, oppsRes] = await Promise.all([
        activitiesAPI.getAll({ status: statusFilter || undefined }),
        accountsAPI.getAll(),
        opportunitiesAPI.getAll(),
      ]);
      setActivities(activitiesRes.data);
      setAccounts(accountsRes.data);
      setOpportunities(oppsRes.data);
      
      if (isExecutive()) {
        const usersRes = await usersAPI.getAll();
        setUsers(usersRes.data);
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
      await activitiesAPI.create({
        ...formData,
        due_date: formData.due_date || null,
        account_id: formData.account_id || null,
        opportunity_id: formData.opportunity_id || null,
        assigned_to_id: formData.assigned_to_id || null,
        product_line: formData.product_line || null,
      });
      setShowModal(false);
      setFormData({
        title: "",
        description: "",
        activity_type: "task",
        priority: "medium",
        status: "pending",
        due_date: "",
        account_id: "",
        opportunity_id: "",
        product_line: "",
        assigned_to_id: "",
      });
      fetchData();
    } catch (error) {
      console.error("Error creating activity:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (activity, newStatus) => {
    try {
      await activitiesAPI.updateStatus(activity.id, newStatus);
      fetchData();
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const filteredActivities = activities.filter(
    (act) =>
      act.title.toLowerCase().includes(search.toLowerCase()) ||
      act.account_name?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      key: "title",
      label: "Activity",
      render: (val, row) => (
        <div>
          <p className="font-medium text-slate-900">{val}</p>
          <p className="text-sm text-slate-500">
            {row.account_name || row.opportunity_name || row.product_line || "—"}
          </p>
        </div>
      ),
    },
    {
      key: "activity_type",
      label: "Type",
      render: (val) => (
        <span className="capitalize text-slate-600">{val}</span>
      ),
    },
    {
      key: "priority",
      label: "Priority",
      render: (val) => <PriorityBadge priority={val} />,
    },
    {
      key: "due_date",
      label: "Due Date",
      render: (val, row) => (
        <span
          className={cn(
            isOverdue(val, row.status) && "text-red-600 font-medium flex items-center gap-1"
          )}
        >
          {isOverdue(val, row.status) && <AlertTriangle className="w-3 h-3" />}
          {formatDate(val)}
        </span>
      ),
    },
    {
      key: "assigned_to_name",
      label: "Assigned To",
      render: (val) => val || "Unassigned",
    },
    {
      key: "status",
      label: "Status",
      render: (val, row) => (
        <select
          value={val}
          onChange={(e) => handleStatusChange(row, e.target.value)}
          className={cn(
            "text-xs font-semibold px-2 py-1 rounded-full border cursor-pointer",
            val === "completed" && "bg-emerald-50 text-emerald-700 border-emerald-200",
            val === "in_progress" && "bg-blue-50 text-blue-700 border-blue-200",
            val === "pending" && "bg-amber-50 text-amber-700 border-amber-200",
            val === "cancelled" && "bg-slate-50 text-slate-700 border-slate-200"
          )}
          data-testid={`status-select-${row.id}`}
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      ),
    },
  ];

  // Calculate stats
  const pending = activities.filter((a) => a.status === "pending").length;
  const inProgress = activities.filter((a) => a.status === "in_progress").length;
  const completed = activities.filter((a) => a.status === "completed").length;
  const overdue = activities.filter((a) => isOverdue(a.due_date, a.status)).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="animate-in space-y-6" data-testid="activities-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <ListTodo className="w-8 h-8 text-blue-600" />
            Activities
          </h1>
          <p className="text-slate-600 mt-1">
            Manage tasks, meetings, and follow-ups
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
          data-testid="add-activity-btn"
        >
          <Plus className="w-4 h-4" />
          Add Activity
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search activities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
            data-testid="search-input"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input w-auto"
          data-testid="status-filter"
        >
          <option value="">All Status</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="label">Pending</p>
            <p className="text-2xl font-bold text-slate-900">{pending}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <ListTodo className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="label">In Progress</p>
            <p className="text-2xl font-bold text-slate-900">{inProgress}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="label">Completed</p>
            <p className="text-2xl font-bold text-slate-900">{completed}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="label">Overdue</p>
            <p className="text-2xl font-bold text-red-600">{overdue}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card" data-testid="activities-table">
        <DataTable
          columns={columns}
          data={filteredActivities}
          emptyMessage="No activities found"
        />
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" data-testid="activity-modal">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Add New Activity</h2>
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
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input"
                  required
                  data-testid="activity-title-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Type
                  </label>
                  <select
                    value={formData.activity_type}
                    onChange={(e) => setFormData({ ...formData, activity_type: e.target.value })}
                    className="input"
                    data-testid="activity-type-select"
                  >
                    {ACTIVITY_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="input"
                    data-testid="activity-priority-select"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Due Date
                </label>
                <input
                  type="datetime-local"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Account
                </label>
                <select
                  value={formData.account_id}
                  onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                  className="input"
                >
                  <option value="">Select account...</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Opportunity
                </label>
                <select
                  value={formData.opportunity_id}
                  onChange={(e) => setFormData({ ...formData, opportunity_id: e.target.value })}
                  className="input"
                >
                  <option value="">Select opportunity...</option>
                  {opportunities.map((opp) => (
                    <option key={opp.id} value={opp.id}>
                      {opp.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Product Line
                </label>
                <select
                  value={formData.product_line}
                  onChange={(e) => setFormData({ ...formData, product_line: e.target.value })}
                  className="input"
                >
                  <option value="">Select product...</option>
                  {PRODUCT_LINES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
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
                  data-testid="save-activity-btn"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Activity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Activities;
