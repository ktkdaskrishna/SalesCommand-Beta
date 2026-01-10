import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api, { accountsAPI } from "../services/api";
import { formatCurrency, cn } from "../lib/utils";
import { toast } from "sonner";
import {
  Building2,
  Plus,
  Search,
  Filter,
  Loader2,
  X,
  RefreshCw,
  DollarSign,
  FileText,
  ShoppingCart,
  Users,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

const relationshipColors = {
  new: "bg-slate-100 text-slate-700 border-slate-200",
  developing: "bg-blue-100 text-blue-700 border-blue-200",
  established: "bg-amber-100 text-amber-700 border-amber-200",
  strategic: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const Accounts = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [enriching, setEnriching] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    industry: "",
    website: "",
    annual_revenue: "",
    employee_count: "",
    business_overview: "",
    relationship_maturity: "new",
    strategic_notes: "",
    total_budget: "",
  });
  const [saving, setSaving] = useState(false);
  const [accountFields, setAccountFields] = useState(null);

  // Check if user can create accounts (only super_admin and ceo)
  const canCreateAccount = user?.role === "super_admin" || user?.role === "ceo";

  useEffect(() => {
    fetchAccounts();
    fetchAccountFields();
  }, []);

  const fetchAccounts = async () => {
    try {
      const response = await accountsAPI.getAll();
      setAccounts(response.data);
    } catch (error) {
      console.error("Error fetching accounts:", error);
      toast.error("Failed to load accounts");
    } finally {
      setLoading(false);
    }
  };

  const fetchAccountFields = async () => {
    try {
      const response = await api.get("/config/account-fields");
      setAccountFields(response.data);
    } catch (error) {
      console.error("Error fetching account fields:", error);
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
        total_budget: formData.total_budget ? parseFloat(formData.total_budget) : null,
      });
      toast.success("Account created successfully");
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
        total_budget: "",
      });
      fetchAccounts();
    } catch (error) {
      console.error("Error creating account:", error);
      toast.error(error.response?.data?.detail || "Failed to create account");
    } finally {
      setSaving(false);
    }
  };

  const handleEnrich = async (accountId) => {
    setEnriching(accountId);
    try {
      const response = await api.post(`/accounts/${accountId}/enrich`);
      toast.success(`Account enriched: ${response.data.summary.orders_count} orders, ${response.data.summary.invoices_count} invoices synced`);
      fetchAccounts();
    } catch (error) {
      console.error("Error enriching account:", error);
      toast.error(error.response?.data?.detail || "Failed to enrich account");
    } finally {
      setEnriching(null);
    }
  };

  const filteredAccounts = accounts.filter(
    (a) =>
      a.name?.toLowerCase().includes(search.toLowerCase()) ||
      a.industry?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="accounts-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Building2 className="w-7 h-7" style={{ color: "#800000" }} />
            Accounts
          </h1>
          <p className="text-slate-500 mt-1">
            {canCreateAccount ? "Manage customer accounts and organizations" : "View your assigned accounts"}
          </p>
        </div>
        {canCreateAccount && (
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary flex items-center gap-2"
            data-testid="create-account-btn"
          >
            <Plus className="w-4 h-4" />
            Create Account
          </button>
        )}
      </div>

      {/* Search & Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search accounts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10 w-full"
            data-testid="search-accounts"
          />
        </div>
        <button className="btn-secondary flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Filters
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{accounts.length}</p>
              <p className="text-xs text-slate-500">Total Accounts</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {formatCurrency(accounts.reduce((sum, a) => sum + (a.total_budget || 0), 0))}
              </p>
              <p className="text-xs text-slate-500">Total Budget</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {formatCurrency(accounts.reduce((sum, a) => sum + (a.total_orders || 0), 0))}
              </p>
              <p className="text-xs text-slate-500">Total Orders</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {formatCurrency(accounts.reduce((sum, a) => sum + (a.outstanding_amount || 0), 0))}
              </p>
              <p className="text-xs text-slate-500">Outstanding</p>
            </div>
          </div>
        </div>
      </div>

      {/* Accounts List */}
      <div className="card overflow-hidden">
        <table className="w-full" data-testid="accounts-table">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left p-4 text-xs font-semibold text-slate-600">Account</th>
              <th className="text-left p-4 text-xs font-semibold text-slate-600">Industry</th>
              <th className="text-left p-4 text-xs font-semibold text-slate-600">Status</th>
              <th className="text-left p-4 text-xs font-semibold text-slate-600">Total Budget</th>
              <th className="text-left p-4 text-xs font-semibold text-slate-600">Total Orders</th>
              <th className="text-left p-4 text-xs font-semibold text-slate-600">Outstanding</th>
              <th className="text-left p-4 text-xs font-semibold text-slate-600">Assigned AM</th>
              <th className="text-right p-4 text-xs font-semibold text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredAccounts.map((account) => (
              <tr
                key={account.id}
                className="hover:bg-slate-50 cursor-pointer"
                onClick={() => navigate(`/accounts/${account.id}`)}
                data-testid={`account-row-${account.id}`}
              >
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{account.name}</p>
                      {account.website && (
                        <a
                          href={account.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {account.website.replace(/^https?:\/\//, "")}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <span className="text-sm text-slate-600 capitalize">
                    {account.industry?.replace(/_/g, " ") || "-"}
                  </span>
                </td>
                <td className="p-4">
                  <span
                    className={cn(
                      "text-xs px-2 py-1 rounded-full border capitalize",
                      relationshipColors[account.relationship_maturity] || relationshipColors.new
                    )}
                  >
                    {account.relationship_maturity || "new"}
                  </span>
                </td>
                <td className="p-4">
                  <span className="font-medium text-slate-900">
                    {account.total_budget ? formatCurrency(account.total_budget) : "-"}
                  </span>
                </td>
                <td className="p-4">
                  <span className={cn("font-medium", account.total_orders > 0 ? "text-emerald-600" : "text-slate-400")}>
                    {account.total_orders ? formatCurrency(account.total_orders) : "-"}
                  </span>
                </td>
                <td className="p-4">
                  <span className={cn("font-medium", account.outstanding_amount > 0 ? "text-red-600" : "text-slate-400")}>
                    {account.outstanding_amount ? formatCurrency(account.outstanding_amount) : "-"}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
                      <Users className="w-3 h-3 text-slate-600" />
                    </div>
                    <span className="text-sm text-slate-600">
                      {account.assigned_am_name || "Unassigned"}
                    </span>
                  </div>
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleEnrich(account.id)}
                      disabled={enriching === account.id}
                      className="btn-secondary text-xs flex items-center gap-1"
                      title="Enrich from Odoo"
                      data-testid={`enrich-btn-${account.id}`}
                    >
                      {enriching === account.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      Enrich
                    </button>
                    <button
                      onClick={() => navigate(`/accounts/${account.id}`)}
                      className="p-2 hover:bg-slate-100 rounded"
                    >
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredAccounts.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            {search ? "No accounts match your search" : "No accounts yet"}
          </div>
        )}
      </div>

      {/* Create Account Modal - Only visible to admins */}
      {showModal && canCreateAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold">Create New Account</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Info Section */}
              <div>
                <h3 className="font-medium text-slate-900 mb-4 flex items-center gap-2">
                  <Building2 className="w-4 h-4" /> Basic Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-sm text-slate-600">Company Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="input w-full"
                      data-testid="account-name-input"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-600">Industry</label>
                    <select
                      value={formData.industry}
                      onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                      className="input w-full"
                    >
                      <option value="">Select Industry</option>
                      <option value="technology">Technology</option>
                      <option value="cybersecurity">Cybersecurity</option>
                      <option value="financial_services">Financial Services</option>
                      <option value="healthcare">Healthcare</option>
                      <option value="manufacturing">Manufacturing</option>
                      <option value="retail">Retail</option>
                      <option value="government">Government</option>
                      <option value="education">Education</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-600">Website</label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      placeholder="https://company.com"
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-600">Relationship Status</label>
                    <select
                      value={formData.relationship_maturity}
                      onChange={(e) => setFormData({ ...formData, relationship_maturity: e.target.value })}
                      className="input w-full"
                    >
                      <option value="new">New</option>
                      <option value="developing">Developing</option>
                      <option value="established">Established</option>
                      <option value="strategic">Strategic</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-600">Employee Count</label>
                    <input
                      type="number"
                      value={formData.employee_count}
                      onChange={(e) => setFormData({ ...formData, employee_count: e.target.value })}
                      className="input w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Financial Section */}
              <div>
                <h3 className="font-medium text-slate-900 mb-4 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" /> Financial
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-600">Total Budget</label>
                    <input
                      type="number"
                      value={formData.total_budget}
                      onChange={(e) => setFormData({ ...formData, total_budget: e.target.value })}
                      className="input w-full"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-600">Annual Revenue</label>
                    <input
                      type="number"
                      value={formData.annual_revenue}
                      onChange={(e) => setFormData({ ...formData, annual_revenue: e.target.value })}
                      className="input w-full"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Notes Section */}
              <div>
                <h3 className="font-medium text-slate-900 mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Notes
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-slate-600">Business Overview</label>
                    <textarea
                      value={formData.business_overview}
                      onChange={(e) => setFormData({ ...formData, business_overview: e.target.value })}
                      className="input w-full h-24"
                      placeholder="Brief description of the company..."
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-600">Strategic Notes</label>
                    <textarea
                      value={formData.strategic_notes}
                      onChange={(e) => setFormData({ ...formData, strategic_notes: e.target.value })}
                      className="input w-full h-24"
                      placeholder="Key strategic considerations..."
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
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
