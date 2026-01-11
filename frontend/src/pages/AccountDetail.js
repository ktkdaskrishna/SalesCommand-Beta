import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { formatCurrency, cn } from "../lib/utils";
import { toast } from "sonner";
import {
  Building2,
  ArrowLeft,
  RefreshCw,
  Loader2,
  Save,
  Edit2,
  X,
  DollarSign,
  ShoppingCart,
  FileText,
  Calendar,
  Users,
  FolderOpen,
  CheckCircle,
  Clock,
  AlertCircle,
  ExternalLink,
  Mail,
  Phone,
  MapPin,
  Globe,
  Hash,
  Type,
  List,
  ToggleLeft,
  Link as LinkIcon,
} from "lucide-react";

// Field type to icon mapping
const fieldTypeIcons = {
  text: Type,
  textarea: FileText,
  number: Hash,
  currency: DollarSign,
  percentage: Hash,
  date: Calendar,
  datetime: Calendar,
  dropdown: List,
  multi_select: List,
  checkbox: ToggleLeft,
  url: Globe,
  email: Mail,
  phone: Phone,
  file: FolderOpen,
  image: FolderOpen,
  rich_text: FileText,
  relationship: Users,
  computed: RefreshCw,
};

// Status colors for invoices/orders
const statusColors = {
  paid: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  overdue: "bg-red-100 text-red-700",
  delivered: "bg-green-100 text-green-700",
  in_progress: "bg-blue-100 text-blue-700",
  cancelled: "bg-slate-100 text-slate-500",
};

const AccountDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [activeTab, setActiveTab] = useState("overview");
  const [accountFields, setAccountFields] = useState(null);
  const [users, setUsers] = useState([]);

  // Check if user can edit (super_admin or ceo)
  const canEdit = user?.role === "super_admin" || user?.role === "ceo";

  useEffect(() => {
    fetchAccount();
    fetchAccountFields();
    fetchUsers();
  }, [id]);

  const fetchAccount = async () => {
    try {
      const response = await api.get(`/accounts/${id}`);
      setAccount(response.data);
      setEditData(response.data);
    } catch (error) {
      console.error("Error fetching account:", error);
      toast.error("Failed to load account");
      navigate("/accounts");
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

  const fetchUsers = async () => {
    try {
      const response = await api.get("/config/users");
      setUsers(response.data);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const handleEnrich = async () => {
    setEnriching(true);
    try {
      const response = await api.post(`/accounts/${id}/enrich`);
      toast.success(`Enriched: ${response.data.summary.orders_count} orders, ${response.data.summary.invoices_count} invoices`);
      fetchAccount();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to enrich");
    } finally {
      setEnriching(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/accounts/${id}`, editData);
      toast.success("Account updated");
      setAccount(editData);
      setIsEditing(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const renderFieldValue = (field, value) => {
    if (value === null || value === undefined || value === "") {
      return <span className="text-slate-400 italic">Not set</span>;
    }

    switch (field.field_type) {
      case "currency":
        return formatCurrency(value);
      case "date":
        return new Date(value).toLocaleDateString();
      case "datetime":
        return new Date(value).toLocaleString();
      case "url":
        return (
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
            {value.replace(/^https?:\/\//, "")} <ExternalLink className="w-3 h-3" />
          </a>
        );
      case "email":
        return <a href={`mailto:${value}`} className="text-blue-600 hover:underline">{value}</a>;
      case "phone":
        return <a href={`tel:${value}`} className="text-blue-600 hover:underline">{value}</a>;
      case "dropdown":
        const option = field.options?.find(o => o.value === value);
        return option?.label || value;
      case "checkbox":
        return value ? "Yes" : "No";
      case "relationship":
        if (field.related_entity === "users") {
          const relatedUser = users.find(u => u.id === value);
          return relatedUser?.name || value;
        }
        return value;
      case "computed":
        return typeof value === "number" ? formatCurrency(value) : value;
      default:
        return String(value);
    }
  };

  const renderFieldInput = (field) => {
    const value = editData[field.id] || "";
    const onChange = (val) => setEditData({ ...editData, [field.id]: val });

    if (!field.editable && field.field_type !== "computed") {
      return <span className="text-slate-600">{renderFieldValue(field, value)}</span>;
    }

    switch (field.field_type) {
      case "textarea":
      case "rich_text":
        return (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="input w-full h-24"
            placeholder={field.placeholder}
          />
        );
      case "number":
      case "currency":
      case "percentage":
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : "")}
            className="input w-full"
            placeholder={field.placeholder}
          />
        );
      case "date":
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="input w-full"
          />
        );
      case "datetime":
        return (
          <input
            type="datetime-local"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="input w-full"
          />
        );
      case "dropdown":
        return (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="input w-full"
          >
            <option value="">Select...</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        );
      case "checkbox":
        return (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span className="text-sm">{field.name}</span>
          </label>
        );
      case "relationship":
        if (field.related_entity === "users") {
          return (
            <select
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="input w-full"
            >
              <option value="">Select User...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          );
        }
        return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="input w-full" />;
      case "computed":
        return <span className="text-slate-600 font-medium">{renderFieldValue(field, account?.[field.id])}</span>;
      default:
        return (
          <input
            type={field.field_type === "email" ? "email" : field.field_type === "url" ? "url" : "text"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="input w-full"
            placeholder={field.placeholder}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!account) {
    return null;
  }

  const fields = accountFields?.fields || [];
  const sections = accountFields?.layout?.sections || [];
  const tabs = accountFields?.layout?.tabs || [
    { id: "overview", name: "Overview", icon: "info" },
    { id: "orders", name: "Orders", icon: "shopping-cart" },
    { id: "invoices", name: "Invoices", icon: "file-text" },
    { id: "activities", name: "Activities", icon: "calendar" },
    { id: "blue_sheet", name: "Blue Sheet", icon: "file-check" },
    { id: "documents", name: "Documents", icon: "folder" },
  ];

  const tabIcons = {
    overview: Building2,
    orders: ShoppingCart,
    invoices: FileText,
    activities: Calendar,
    blue_sheet: CheckCircle,
    documents: FolderOpen,
  };

  return (
    <div className="space-y-6" data-testid="account-detail-page">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <button onClick={() => navigate("/accounts")} className="p-2 hover:bg-slate-100 rounded-lg mt-1">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                <Building2 className="w-6 h-6" style={{ color: "#800000" }} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{account.name}</h1>
                <div className="flex items-center gap-3 mt-1">
                  {account.industry && (
                    <span className="text-sm text-slate-500 capitalize">{account.industry.replace(/_/g, " ")}</span>
                  )}
                  {account.relationship_maturity && (
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full capitalize",
                      account.relationship_maturity === "strategic" ? "bg-emerald-100 text-emerald-700" :
                      account.relationship_maturity === "established" ? "bg-amber-100 text-amber-700" :
                      account.relationship_maturity === "developing" ? "bg-blue-100 text-blue-700" :
                      "bg-slate-100 text-slate-600"
                    )}>
                      {account.relationship_maturity}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleEnrich}
            disabled={enriching}
            className="btn-secondary flex items-center gap-2"
            data-testid="enrich-account-btn"
          >
            {enriching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Enrich from Odoo
          </button>
          {canEdit && !isEditing && (
            <button onClick={() => setIsEditing(true)} className="btn-primary flex items-center gap-2" data-testid="edit-account-btn">
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          )}
          {isEditing && (
            <>
              <button onClick={() => { setIsEditing(false); setEditData(account); }} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </button>
            </>
          )}
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(account.total_budget || 0)}</p>
              <p className="text-xs text-slate-500">Total Budget</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(account.total_orders || 0)}</p>
              <p className="text-xs text-slate-500">Total Orders</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(account.total_paid || 0)}</p>
              <p className="text-xs text-slate-500">Total Paid</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(account.outstanding_amount || 0)}</p>
              <p className="text-xs text-slate-500">Outstanding</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const TabIcon = tabIcons[tab.id] || Building2;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-4 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition",
                  activeTab === tab.id
                    ? "border-[#800000] text-[#800000]"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                )}
                data-testid={`tab-${tab.id}`}
              >
                <TabIcon className="w-4 h-4" />
                {tab.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {/* Overview Tab - Dynamic Fields */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {sections.sort((a, b) => a.order - b.order).map((section) => {
              const sectionFields = fields.filter(f => f.section_id === section.id && f.visible !== false);
              if (sectionFields.length === 0) return null;

              return (
                <div key={section.id} className="card overflow-hidden" data-testid={`section-${section.id}`}>
                  <div className="bg-slate-50 px-4 py-3 border-b">
                    <h3 className="font-medium text-slate-900 flex items-center gap-2">
                      {section.icon && <span>{section.icon}</span>}
                      {section.name}
                    </h3>
                  </div>
                  <div className="p-4">
                    <div className={cn("grid gap-4", `grid-cols-${Math.min(section.columns || 2, 4)}`)}>
                      {sectionFields.sort((a, b) => a.order - b.order).map((field) => (
                        <div key={field.id} className={field.field_type === "textarea" || field.field_type === "rich_text" ? "col-span-full" : ""}>
                          <label className="text-xs text-slate-500 mb-1 block">{field.name}</label>
                          {isEditing ? (
                            renderFieldInput(field)
                          ) : (
                            <div className="text-sm text-slate-900">
                              {renderFieldValue(field, account[field.id])}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Last Enriched Info */}
            {account.last_enriched_at && (
              <div className="text-xs text-slate-400 text-right">
                Last enriched: {new Date(account.last_enriched_at).toLocaleString()} (Source: {account.enrichment_source || "Odoo"})
              </div>
            )}
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <div className="card overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-medium text-slate-900">Orders from Odoo</h3>
              <span className="text-sm text-slate-500">{account.orders?.length || 0} orders</span>
            </div>
            {account.orders && account.orders.length > 0 ? (
              <table className="w-full">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left p-3 text-xs font-semibold text-slate-600">Order #</th>
                    <th className="text-left p-3 text-xs font-semibold text-slate-600">Date</th>
                    <th className="text-left p-3 text-xs font-semibold text-slate-600">Products</th>
                    <th className="text-right p-3 text-xs font-semibold text-slate-600">Amount</th>
                    <th className="text-center p-3 text-xs font-semibold text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {account.orders.map((order, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-3 font-medium text-slate-900">{order.id}</td>
                      <td className="p-3 text-sm text-slate-600">{order.date}</td>
                      <td className="p-3 text-sm text-slate-600">{order.products}</td>
                      <td className="p-3 text-right font-medium text-slate-900">{formatCurrency(order.amount)}</td>
                      <td className="p-3 text-center">
                        <span className={cn("text-xs px-2 py-1 rounded-full capitalize", statusColors[order.status] || "bg-slate-100")}>
                          {order.status?.replace(/_/g, " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-slate-500">
                <ShoppingCart className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p>No orders yet. Click "Enrich from Odoo" to sync.</p>
              </div>
            )}
          </div>
        )}

        {/* Invoices Tab */}
        {activeTab === "invoices" && (
          <div className="card overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-medium text-slate-900">Invoices from Odoo</h3>
              <span className="text-sm text-slate-500">{account.invoices?.length || 0} invoices</span>
            </div>
            {account.invoices && account.invoices.length > 0 ? (
              <table className="w-full">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left p-3 text-xs font-semibold text-slate-600">Invoice #</th>
                    <th className="text-left p-3 text-xs font-semibold text-slate-600">Date</th>
                    <th className="text-left p-3 text-xs font-semibold text-slate-600">Due Date</th>
                    <th className="text-right p-3 text-xs font-semibold text-slate-600">Amount</th>
                    <th className="text-right p-3 text-xs font-semibold text-slate-600">Paid</th>
                    <th className="text-center p-3 text-xs font-semibold text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {account.invoices.map((inv, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-3 font-medium text-slate-900">{inv.id}</td>
                      <td className="p-3 text-sm text-slate-600">{inv.date}</td>
                      <td className="p-3 text-sm text-slate-600">{inv.due_date}</td>
                      <td className="p-3 text-right font-medium text-slate-900">{formatCurrency(inv.amount)}</td>
                      <td className="p-3 text-right text-sm text-green-600">{formatCurrency(inv.paid_amount)}</td>
                      <td className="p-3 text-center">
                        <span className={cn("text-xs px-2 py-1 rounded-full capitalize", statusColors[inv.status] || "bg-slate-100")}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-slate-500">
                <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p>No invoices yet. Click "Enrich from Odoo" to sync.</p>
              </div>
            )}
          </div>
        )}

        {/* Activities Tab */}
        {activeTab === "activities" && (
          <div className="card p-8 text-center text-slate-500">
            <Calendar className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="font-medium">Activities</p>
            <p className="text-sm mt-1">Activity tracking will be available after Microsoft 365 integration.</p>
          </div>
        )}

        {/* Blue Sheet Tab */}
        {activeTab === "blue_sheet" && (
          <div className="card p-8 text-center text-slate-500">
            <CheckCircle className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="font-medium">Blue Sheet Analysis</p>
            <p className="text-sm mt-1">Navigate to Opportunities to access Blue Sheet for specific deals.</p>
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === "documents" && (
          <div className="card p-8 text-center text-slate-500">
            <FolderOpen className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="font-medium">Documents</p>
            <p className="text-sm mt-1">Document management coming soon.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountDetail;
