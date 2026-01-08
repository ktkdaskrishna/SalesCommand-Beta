import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { accountsAPI } from "../services/api";
import DataTable from "../components/DataTable";
import { Badge } from "../components/Badge";
import { formatCurrency, cn } from "../lib/utils";
import {
  Building2,
  Plus,
  Search,
  Filter,
  Loader2,
  X,
} from "lucide-react";

const relationshipColors = {
  new: "bg-slate-100 text-slate-700 border-slate-200",
  developing: "bg-blue-100 text-blue-700 border-blue-200",
  established: "bg-amber-100 text-amber-700 border-amber-200",
  strategic: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const Accounts = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    industry: "",
    website: "",
    annual_revenue: "",
    employee_count: "",
    business_overview: "",
    relationship_maturity: "new",
    strategic_notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const response = await accountsAPI.getAll();
      setAccounts(response.data);
    } catch (error) {
      console.error("Error fetching accounts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await accountsAPI.create({
        ...formData,
        annual_revenue: formData.annual_revenue ? parseFloat(formData.annual_revenue) : null,
        employee_count: formData.employee_count ? parseInt(formData.employee_count) : null,
      });
      setShowModal(false);
      setFormData({
        name: "",
        industry: "",
        website: "",
        annual_revenue: "",
        employee_count: "",
        business_overview: "",
        relationship_maturity: "new",
        strategic_notes: "",
      });
      fetchAccounts();
    } catch (error) {
      console.error("Error creating account:", error);
    } finally {
      setSaving(false);
    }
  };

  const filteredAccounts = accounts.filter((acc) =>
    acc.name.toLowerCase().includes(search.toLowerCase()) ||
    acc.industry?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      key: "name",
      label: "Account Name",
      render: (val, row) => (
        <div>
          <p className="font-medium text-slate-900">{val}</p>
          <p className="text-sm text-slate-500">{row.industry || "—"}</p>
        </div>
      ),
    },
    {
      key: "relationship_maturity",
      label: "Relationship",
      render: (val) => (
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize",
            relationshipColors[val]
          )}
        >
          {val}
        </span>
      ),
    },
    {
      key: "opportunity_count",
      label: "Opportunities",
      render: (val) => val || 0,
    },
    {
      key: "total_pipeline_value",
      label: "Pipeline Value",
      render: (val) => formatCurrency(val || 0),
    },
    {
      key: "assigned_am_name",
      label: "Account Manager",
      render: (val) => val || "Unassigned",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="animate-in space-y-6" data-testid="accounts-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Building2 className="w-8 h-8 text-blue-600" />
            Accounts
          </h1>
          <p className="text-slate-600 mt-1">
            Manage your customer accounts and relationships
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
          data-testid="add-account-btn"
        >
          <Plus className="w-4 h-4" />
          Add Account
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search accounts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
            data-testid="search-input"
          />
        </div>
        <button className="btn-secondary flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Filters
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="label">Total Accounts</p>
          <p className="text-2xl font-bold text-slate-900">{accounts.length}</p>
        </div>
        <div className="card p-4">
          <p className="label">Strategic</p>
          <p className="text-2xl font-bold text-emerald-600">
            {accounts.filter((a) => a.relationship_maturity === "strategic").length}
          </p>
        </div>
        <div className="card p-4">
          <p className="label">Total Pipeline</p>
          <p className="text-2xl font-bold text-blue-600">
            {formatCurrency(accounts.reduce((sum, a) => sum + (a.total_pipeline_value || 0), 0))}
          </p>
        </div>
        <div className="card p-4">
          <p className="label">Avg. Opportunities</p>
          <p className="text-2xl font-bold text-slate-900">
            {accounts.length > 0
              ? (accounts.reduce((sum, a) => sum + (a.opportunity_count || 0), 0) / accounts.length).toFixed(1)
              : 0}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="card" data-testid="accounts-table">
        <DataTable
          columns={columns}
          data={filteredAccounts}
          onRowClick={(row) => navigate(`/accounts/${row.id}`)}
          emptyMessage="No accounts found"
        />
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" data-testid="account-modal">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Add New Account</h2>
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
                  Account Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  required
                  data-testid="account-name-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Industry
                  </label>
                  <input
                    type="text"
                    value={formData.industry}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    className="input"
                    data-testid="account-industry-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Website
                  </label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="input"
                    placeholder="https://"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Annual Revenue
                  </label>
                  <input
                    type="number"
                    value={formData.annual_revenue}
                    onChange={(e) => setFormData({ ...formData, annual_revenue: e.target.value })}
                    className="input"
                    placeholder="$"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Employee Count
                  </label>
                  <input
                    type="number"
                    value={formData.employee_count}
                    onChange={(e) => setFormData({ ...formData, employee_count: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Relationship Maturity
                </label>
                <select
                  value={formData.relationship_maturity}
                  onChange={(e) => setFormData({ ...formData, relationship_maturity: e.target.value })}
                  className="input"
                  data-testid="relationship-select"
                >
                  <option value="new">New</option>
                  <option value="developing">Developing</option>
                  <option value="established">Established</option>
                  <option value="strategic">Strategic</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Business Overview
                </label>
                <textarea
                  value={formData.business_overview}
                  onChange={(e) => setFormData({ ...formData, business_overview: e.target.value })}
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
                  data-testid="save-account-btn"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Accounts;
