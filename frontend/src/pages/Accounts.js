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

      {/* Create Account Modal - Dynamic fields from config */}
      {showModal && canCreateAccount && (
        <DynamicAccountForm
          accountFields={accountFields}
          onSave={handleSubmit}
          onCancel={() => setShowModal(false)}
          saving={saving}
        />
      )}
    </div>
  );
};

// Dynamic Account Form Component - Uses Account Fields Config
const DynamicAccountForm = ({ accountFields, onSave, onCancel, saving }) => {
  const [formData, setFormData] = useState({});
  const [users, setUsers] = useState([]);

  useEffect(() => {
    // Fetch users for relationship fields
    const fetchUsers = async () => {
      try {
        const response = await api.get("/config/users");
        setUsers(response.data);
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };
    fetchUsers();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Convert numeric fields
    const processedData = { ...formData };
    accountFields?.fields?.forEach(field => {
      if ((field.field_type === "number" || field.field_type === "currency") && processedData[field.id]) {
        processedData[field.id] = parseFloat(processedData[field.id]);
      }
    });
    onSave(e, processedData);
  };

  const renderField = (field) => {
    const value = formData[field.id] || "";
    const onChange = (val) => setFormData({ ...formData, [field.id]: val });

    // Skip computed fields in create form
    if (field.field_type === "computed") return null;

    switch (field.field_type) {
      case "textarea":
      case "rich_text":
        return (
          <div key={field.id} className="col-span-2">
            <label className="text-sm text-slate-600">{field.name} {field.validation?.required && "*"}</label>
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="input w-full h-24"
              placeholder={field.placeholder || field.description}
              required={field.validation?.required}
            />
          </div>
        );
      case "number":
      case "currency":
      case "percentage":
        return (
          <div key={field.id}>
            <label className="text-sm text-slate-600">{field.name} {field.validation?.required && "*"}</label>
            <input
              type="number"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="input w-full"
              placeholder={field.placeholder || "0"}
              required={field.validation?.required}
            />
          </div>
        );
      case "date":
        return (
          <div key={field.id}>
            <label className="text-sm text-slate-600">{field.name} {field.validation?.required && "*"}</label>
            <input
              type="date"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="input w-full"
              required={field.validation?.required}
            />
          </div>
        );
      case "dropdown":
        return (
          <div key={field.id}>
            <label className="text-sm text-slate-600">{field.name} {field.validation?.required && "*"}</label>
            <select
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="input w-full"
              required={field.validation?.required}
            >
              <option value="">Select {field.name}...</option>
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        );
      case "checkbox":
        return (
          <div key={field.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
              className="rounded border-slate-300"
            />
            <label className="text-sm text-slate-600">{field.name}</label>
          </div>
        );
      case "relationship":
        if (field.related_entity === "users") {
          return (
            <div key={field.id}>
              <label className="text-sm text-slate-600">{field.name} {field.validation?.required && "*"}</label>
              <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="input w-full"
                required={field.validation?.required}
              >
                <option value="">Select User...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>
          );
        }
        return null;
      default:
        return (
          <div key={field.id}>
            <label className="text-sm text-slate-600">{field.name} {field.validation?.required && "*"}</label>
            <input
              type={field.field_type === "email" ? "email" : field.field_type === "url" ? "url" : "text"}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="input w-full"
              placeholder={field.placeholder || field.description}
              required={field.validation?.required}
            />
          </div>
        );
    }
  };

  const fields = accountFields?.fields || [];
  const sections = accountFields?.layout?.sections || [];

  // Section icons mapping
  const sectionIcons = {
    basic: Building2,
    financial: DollarSign,
    contacts: Users,
    address: MapPin,
    notes: FileText,
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto m-4">
        <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold">Create New Account</h2>
          <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Render sections from config */}
          {sections
            .filter(section => section.id !== "erp_summary") // Skip computed fields section
            .sort((a, b) => a.order - b.order)
            .map((section) => {
              const sectionFields = fields.filter(
                f => f.section_id === section.id && 
                f.editable !== false && 
                f.field_type !== "computed"
              );
              if (sectionFields.length === 0) return null;

              const SectionIcon = sectionIcons[section.id] || FileText;

              return (
                <div key={section.id}>
                  <h3 className="font-medium text-slate-900 mb-4 flex items-center gap-2">
                    <SectionIcon className="w-4 h-4" />
                    {section.name}
                  </h3>
                  <div className={cn("grid gap-4", `grid-cols-${Math.min(section.columns || 2, 2)}`)}>
                    {sectionFields.sort((a, b) => a.order - b.order).map(renderField)}
                  </div>
                </div>
              );
            })}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onCancel} className="btn-secondary">
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
  );
};

// Add missing icon import
const MapPin = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
    <circle cx="12" cy="10" r="3"></circle>
  </svg>
);

export default Accounts;
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
