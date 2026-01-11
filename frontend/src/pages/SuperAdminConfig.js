import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { cn } from "../lib/utils";
import AccountFormBuilder from "../components/AccountFormBuilder";
import VisualDataFlowHub from "../components/VisualDataFlowHub";
import {
  Settings,
  Users,
  Shield,
  Palette,
  Sparkles,
  Link,
  FileText,
  ChevronRight,
  Save,
  RotateCcw,
  Loader2,
  CheckCircle2,
  Plus,
  Trash2,
  Edit2,
  AlertTriangle,
  Eye,
  EyeOff,
  Building2,
  Bot,
  UserPlus,
  Key,
  Play,
  Copy,
  MessageSquare,
  FolderTree,
  Contact2,
  Mail,
  Database,
  GripVertical,
  Type,
  Hash,
  Calendar,
  DollarSign,
  List,
  ToggleLeft,
  LinkIcon,
  FileUp,
} from "lucide-react";
import { toast } from "sonner";

// Sidebar navigation items - Phase 3 enhanced with Account Form Builder
const navItems = [
  { id: "organization", label: "Organization", icon: Building2 },
  { id: "account-fields", label: "Account Form Builder", icon: Database },
  { id: "departments", label: "Departments", icon: FolderTree },
  { id: "users", label: "User Management", icon: Users },
  { id: "roles", label: "Roles & Permissions", icon: Shield },
  { id: "contact-roles", label: "Contact Roles", icon: Contact2 },
  { id: "ai-agents", label: "AI Agents", icon: Bot },
  { id: "ai-chatbot", label: "AI Chatbot", icon: MessageSquare },
  { id: "llm-providers", label: "LLM Providers", icon: Sparkles },
  { id: "blue-sheet", label: "Blue Sheet", icon: FileText },
  { id: "ui", label: "UI & Branding", icon: Palette },
  { id: "email", label: "Email Config", icon: Mail },
  { id: "integrations", label: "Integrations", icon: Link },
];

// Role Permission Editor Component
const RolePermissionEditor = ({ role, modules, onSave, onCancel }) => {
  const [permissions, setPermissions] = useState(role?.permissions || []);
  const [saving, setSaving] = useState(false);

  const togglePermission = (moduleId, featureId, actionId) => {
    const existingPermIdx = permissions.findIndex(
      (p) => p.module_id === moduleId && p.feature_id === featureId
    );

    if (existingPermIdx === -1) {
      // Add new permission with this action
      setPermissions([
        ...permissions,
        { module_id: moduleId, feature_id: featureId, action_ids: [actionId] },
      ]);
    } else {
      const perm = permissions[existingPermIdx];
      const hasAction = perm.action_ids.includes(actionId);
      
      if (hasAction) {
        // Remove action
        const newActions = perm.action_ids.filter((a) => a !== actionId);
        if (newActions.length === 0) {
          // Remove entire permission
          setPermissions(permissions.filter((_, i) => i !== existingPermIdx));
        } else {
          const newPerms = [...permissions];
          newPerms[existingPermIdx] = { ...perm, action_ids: newActions };
          setPermissions(newPerms);
        }
      } else {
        // Add action
        const newPerms = [...permissions];
        newPerms[existingPermIdx] = {
          ...perm,
          action_ids: [...perm.action_ids, actionId],
        };
        setPermissions(newPerms);
      }
    }
  };

  const isActionEnabled = (moduleId, featureId, actionId) => {
    const perm = permissions.find(
      (p) => p.module_id === moduleId && p.feature_id === featureId
    );
    return perm?.action_ids?.includes(actionId) || false;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(permissions);
      toast.success("Permissions saved successfully");
    } catch (error) {
      toast.error("Failed to save permissions");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">
          Edit Permissions for: {role?.name}
        </h3>
        <div className="flex gap-2">
          <button onClick={onCancel} className="btn-secondary text-sm">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary text-sm flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Permissions
          </button>
        </div>
      </div>

      <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
        {modules.map((module) => (
          <div key={module.id} className="border border-slate-200 rounded-lg p-4">
            <h4 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              {module.name}
            </h4>
            <div className="space-y-3">
              {module.features?.map((feature) => (
                <div key={feature.id} className="pl-4 border-l-2 border-slate-100">
                  <p className="text-sm font-medium text-slate-700 mb-2">{feature.name}</p>
                  <div className="flex flex-wrap gap-2">
                    {feature.actions?.map((action) => (
                      <label
                        key={action.id}
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs cursor-pointer transition-colors",
                          isActionEnabled(module.id, feature.id, action.id)
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isActionEnabled(module.id, feature.id, action.id)}
                          onChange={() => togglePermission(module.id, feature.id, action.id)}
                          className="sr-only"
                        />
                        {isActionEnabled(module.id, feature.id, action.id) ? (
                          <Eye className="w-3 h-3" />
                        ) : (
                          <EyeOff className="w-3 h-3" />
                        )}
                        {action.name}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Organization Tab
const OrganizationTab = ({ config, onConfigUpdate }) => {
  const [orgConfig, setOrgConfig] = useState(config?.organization || {});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setOrgConfig(config?.organization || {});
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/config/organization", orgConfig);
      toast.success("Organization settings saved");
      onConfigUpdate();
    } catch (error) {
      toast.error("Failed to save organization settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Organization Settings</h3>
          <p className="text-sm text-slate-500">Configure company-wide settings</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary text-sm flex items-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      {/* Basic Info */}
      <div className="card p-4">
        <h4 className="font-medium text-slate-900 mb-4">Basic Information</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-500">Organization Name</label>
            <input type="text" value={orgConfig.name || ""} onChange={(e) => setOrgConfig({ ...orgConfig, name: e.target.value })} className="input w-full" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Domain</label>
            <input type="text" value={orgConfig.domain || ""} onChange={(e) => setOrgConfig({ ...orgConfig, domain: e.target.value })} className="input w-full" placeholder="company.com" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Industry</label>
            <select value={orgConfig.industry || ""} onChange={(e) => setOrgConfig({ ...orgConfig, industry: e.target.value })} className="input w-full">
              <option value="">Select Industry</option>
              <option value="technology">Technology</option>
              <option value="cybersecurity">Cybersecurity</option>
              <option value="financial_services">Financial Services</option>
              <option value="healthcare">Healthcare</option>
              <option value="manufacturing">Manufacturing</option>
              <option value="retail">Retail</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500">Timezone</label>
            <select value={orgConfig.timezone || "UTC"} onChange={(e) => setOrgConfig({ ...orgConfig, timezone: e.target.value })} className="input w-full">
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time</option>
              <option value="America/Chicago">Central Time</option>
              <option value="America/Denver">Mountain Time</option>
              <option value="America/Los_Angeles">Pacific Time</option>
              <option value="Europe/London">London</option>
              <option value="Asia/Kolkata">India</option>
            </select>
          </div>
        </div>
      </div>

      {/* Financial Settings */}
      <div className="card p-4">
        <h4 className="font-medium text-slate-900 mb-4">Financial Settings</h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-slate-500">Currency</label>
            <select value={orgConfig.currency || "USD"} onChange={(e) => setOrgConfig({ ...orgConfig, currency: e.target.value })} className="input w-full">
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="INR">INR (₹)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500">Fiscal Year Start</label>
            <select value={orgConfig.fiscal_year_start_month || 1} onChange={(e) => setOrgConfig({ ...orgConfig, fiscal_year_start_month: parseInt(e.target.value) })} className="input w-full">
              <option value={1}>January</option>
              <option value={4}>April</option>
              <option value={7}>July</option>
              <option value={10}>October</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500">Quota Period</label>
            <select value={orgConfig.quota_period || "quarterly"} onChange={(e) => setOrgConfig({ ...orgConfig, quota_period: e.target.value })} className="input w-full">
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500">Default Commission Rate (%)</label>
            <input type="number" step="0.01" value={(orgConfig.default_commission_rate || 0.05) * 100} onChange={(e) => setOrgConfig({ ...orgConfig, default_commission_rate: parseFloat(e.target.value) / 100 })} className="input w-full" />
          </div>
        </div>
      </div>

      {/* Feature Toggles */}
      <div className="card p-4">
        <h4 className="font-medium text-slate-900 mb-4">Feature Toggles</h4>
        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-sm text-slate-700">Enable AI Features</span>
            <input type="checkbox" checked={orgConfig.enable_ai_features ?? true} onChange={(e) => setOrgConfig({ ...orgConfig, enable_ai_features: e.target.checked })} className="rounded border-slate-300" />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm text-slate-700">Enable Referral Program</span>
            <input type="checkbox" checked={orgConfig.enable_referrals ?? true} onChange={(e) => setOrgConfig({ ...orgConfig, enable_referrals: e.target.checked })} className="rounded border-slate-300" />
          </label>
        </div>
      </div>

      {/* Contact Info */}
      <div className="card p-4">
        <h4 className="font-medium text-slate-900 mb-4">Contact Information</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-500">Contact Email</label>
            <input type="email" value={orgConfig.contact_email || ""} onChange={(e) => setOrgConfig({ ...orgConfig, contact_email: e.target.value })} className="input w-full" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Contact Phone</label>
            <input type="text" value={orgConfig.contact_phone || ""} onChange={(e) => setOrgConfig({ ...orgConfig, contact_phone: e.target.value })} className="input w-full" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-slate-500">Address</label>
            <textarea value={orgConfig.address || ""} onChange={(e) => setOrgConfig({ ...orgConfig, address: e.target.value })} className="input w-full h-20" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Field Type Icons and Labels
const fieldTypeConfig = {
  text: { icon: Type, label: "Text", color: "bg-blue-100 text-blue-600" },
  textarea: { icon: FileText, label: "Text Area", color: "bg-blue-100 text-blue-600" },
  number: { icon: Hash, label: "Number", color: "bg-green-100 text-green-600" },
  currency: { icon: DollarSign, label: "Currency", color: "bg-emerald-100 text-emerald-600" },
  percentage: { icon: Hash, label: "Percentage", color: "bg-teal-100 text-teal-600" },
  date: { icon: Calendar, label: "Date", color: "bg-purple-100 text-purple-600" },
  datetime: { icon: Calendar, label: "Date Time", color: "bg-purple-100 text-purple-600" },
  dropdown: { icon: List, label: "Dropdown", color: "bg-amber-100 text-amber-600" },
  multi_select: { icon: List, label: "Multi Select", color: "bg-amber-100 text-amber-600" },
  checkbox: { icon: ToggleLeft, label: "Checkbox", color: "bg-slate-100 text-slate-600" },
  url: { icon: LinkIcon, label: "URL", color: "bg-indigo-100 text-indigo-600" },
  email: { icon: Mail, label: "Email", color: "bg-rose-100 text-rose-600" },
  phone: { icon: Contact2, label: "Phone", color: "bg-pink-100 text-pink-600" },
  file: { icon: FileUp, label: "File Upload", color: "bg-orange-100 text-orange-600" },
  image: { icon: FileUp, label: "Image", color: "bg-orange-100 text-orange-600" },
  rich_text: { icon: FileText, label: "Rich Text", color: "bg-cyan-100 text-cyan-600" },
  relationship: { icon: Users, label: "Relationship", color: "bg-violet-100 text-violet-600" },
  computed: { icon: Sparkles, label: "Computed", color: "bg-yellow-100 text-yellow-600" },
};

// Account Fields Tab - ERP Style Field Configuration
const AccountFieldsTab = ({ config, onConfigUpdate }) => {
  const [fieldsConfig, setFieldsConfig] = useState(config?.account_fields || { fields: [], layout: { sections: [] } });
  const [saving, setSaving] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [showNewField, setShowNewField] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [showNewSection, setShowNewSection] = useState(false);
  const [activeView, setActiveView] = useState("fields"); // "fields" or "layout"

  useEffect(() => {
    setFieldsConfig(config?.account_fields || { fields: [], layout: { sections: [] } });
  }, [config]);

  const handleSaveFields = async () => {
    setSaving(true);
    try {
      await api.put("/config/account-fields", fieldsConfig);
      toast.success("Account fields saved");
      onConfigUpdate();
    } catch (error) {
      toast.error("Failed to save account fields");
    } finally {
      setSaving(false);
    }
  };

  const handleAddField = async (newField) => {
    try {
      const res = await api.post("/config/account-fields/field", newField);
      toast.success("Field added");
      onConfigUpdate();
      setShowNewField(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to add field");
    }
  };

  const handleUpdateField = async (fieldId, fieldData) => {
    try {
      await api.put(`/config/account-fields/field/${fieldId}`, fieldData);
      toast.success("Field updated");
      onConfigUpdate();
      setEditingField(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update field");
    }
  };

  const handleDeleteField = async (fieldId) => {
    if (!window.confirm("Delete this field? Data in existing accounts will be preserved but not displayed.")) return;
    try {
      await api.delete(`/config/account-fields/field/${fieldId}`);
      toast.success("Field deleted");
      onConfigUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete field");
    }
  };

  const handleAddSection = async (newSection) => {
    try {
      const res = await api.post("/config/account-fields/section", newSection);
      toast.success("Section added");
      onConfigUpdate();
      setShowNewSection(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to add section");
    }
  };

  const fields = fieldsConfig?.fields || [];
  const sections = fieldsConfig?.layout?.sections || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Account Field Definitions</h3>
          <p className="text-sm text-slate-500">Configure fields and layout for account/organization records</p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button onClick={() => setActiveView("fields")} className={cn("px-3 py-1.5 text-sm rounded-md transition", activeView === "fields" ? "bg-white shadow text-slate-900" : "text-slate-500")}>
              Fields
            </button>
            <button onClick={() => setActiveView("layout")} className={cn("px-3 py-1.5 text-sm rounded-md transition", activeView === "layout" ? "bg-white shadow text-slate-900" : "text-slate-500")}>
              Layout
            </button>
          </div>
          <button onClick={handleSaveFields} disabled={saving} className="btn-primary text-sm flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save All
          </button>
        </div>
      </div>

      {/* Fields View */}
      {activeView === "fields" && (
        <div className="space-y-4">
          {/* Add Field Button */}
          <div className="flex justify-end">
            <button onClick={() => setShowNewField(true)} className="btn-secondary text-sm flex items-center gap-2" data-testid="add-field-btn">
              <Plus className="w-4 h-4" /> Add Custom Field
            </button>
          </div>

          {/* New Field Form */}
          {showNewField && (
            <FieldEditForm
              field={null}
              sections={sections}
              onSave={handleAddField}
              onCancel={() => setShowNewField(false)}
            />
          )}

          {/* Edit Field Form */}
          {editingField && (
            <FieldEditForm
              field={editingField}
              sections={sections}
              onSave={(data) => handleUpdateField(editingField.id, data)}
              onCancel={() => setEditingField(null)}
            />
          )}

          {/* Fields List by Section */}
          {sections.map((section) => {
            const sectionFields = fields.filter(f => f.section_id === section.id);
            return (
              <div key={section.id} className="card overflow-hidden" data-testid={`section-${section.id}`}>
                <div className="bg-slate-50 px-4 py-3 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-slate-400" />
                    <h4 className="font-medium text-slate-900">{section.name}</h4>
                    <span className="text-xs text-slate-500">({sectionFields.length} fields)</span>
                  </div>
                  <span className="text-xs bg-slate-200 px-2 py-1 rounded">{section.columns} columns</span>
                </div>
                <div className="divide-y">
                  {sectionFields.map((field) => {
                    const typeConfig = fieldTypeConfig[field.field_type] || fieldTypeConfig.text;
                    const TypeIcon = typeConfig.icon;
                    return (
                      <div key={field.id} className="p-4 flex items-center justify-between hover:bg-slate-50" data-testid={`field-${field.id}`}>
                        <div className="flex items-center gap-4">
                          <GripVertical className="w-4 h-4 text-slate-300 cursor-move" />
                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", typeConfig.color)}>
                            <TypeIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-900">{field.name}</span>
                              {field.is_system && <span className="text-xs bg-slate-200 px-1.5 py-0.5 rounded">System</span>}
                              {field.validation?.required && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Required</span>}
                              {field.show_in_list && <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">In List</span>}
                              {field.show_in_card && <span className="text-xs bg-green-100 text-green-600 px-1.5 py-0.5 rounded">In Card</span>}
                            </div>
                            <p className="text-xs text-slate-500">{typeConfig.label} • ID: {field.id}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setEditingField(field)} className="p-1.5 hover:bg-slate-100 rounded" title="Edit" data-testid={`edit-field-${field.id}`}>
                            <Edit2 className="w-4 h-4 text-slate-500" />
                          </button>
                          {!field.is_system && (
                            <button onClick={() => handleDeleteField(field.id)} className="p-1.5 hover:bg-red-50 rounded" title="Delete">
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {sectionFields.length === 0 && (
                    <div className="p-4 text-center text-sm text-slate-400">No fields in this section</div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Unassigned Fields */}
          {(() => {
            const unassignedFields = fields.filter(f => !f.section_id || !sections.find(s => s.id === f.section_id));
            if (unassignedFields.length === 0) return null;
            return (
              <div className="card overflow-hidden border-dashed border-2 border-slate-200">
                <div className="bg-slate-50 px-4 py-3 border-b">
                  <h4 className="font-medium text-slate-700">Unassigned Fields</h4>
                </div>
                <div className="divide-y">
                  {unassignedFields.map((field) => {
                    const typeConfig = fieldTypeConfig[field.field_type] || fieldTypeConfig.text;
                    const TypeIcon = typeConfig.icon;
                    return (
                      <div key={field.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                        <div className="flex items-center gap-4">
                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", typeConfig.color)}>
                            <TypeIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-medium text-slate-900">{field.name}</span>
                            <p className="text-xs text-slate-500">{typeConfig.label}</p>
                          </div>
                        </div>
                        <button onClick={() => setEditingField(field)} className="p-1.5 hover:bg-slate-100 rounded">
                          <Edit2 className="w-4 h-4 text-slate-500" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Layout View */}
      {activeView === "layout" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowNewSection(true)} className="btn-secondary text-sm flex items-center gap-2" data-testid="add-section-btn">
              <Plus className="w-4 h-4" /> Add Section
            </button>
          </div>

          {/* New Section Form */}
          {showNewSection && (
            <div className="card p-4 border-2 border-blue-200 space-y-4">
              <h4 className="font-medium">New Section</h4>
              <SectionEditForm
                section={null}
                onSave={handleAddSection}
                onCancel={() => setShowNewSection(false)}
              />
            </div>
          )}

          {/* Sections List */}
          <div className="space-y-4">
            {sections.sort((a, b) => a.order - b.order).map((section) => (
              <div key={section.id} className="card overflow-hidden" data-testid={`layout-section-${section.id}`}>
                <div className="bg-slate-50 px-4 py-3 border-b flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GripVertical className="w-4 h-4 text-slate-400 cursor-move" />
                    <span className="text-xl">{section.icon || "📋"}</span>
                    <div>
                      <h4 className="font-medium text-slate-900">{section.name}</h4>
                      <p className="text-xs text-slate-500">{section.columns} columns • Order: {section.order}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditingSection(section)} className="p-1.5 hover:bg-slate-100 rounded">
                      <Edit2 className="w-4 h-4 text-slate-500" />
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-sm text-slate-600 mb-2">Fields in this section:</p>
                  <div className="flex flex-wrap gap-2">
                    {(section.field_ids || []).map(fieldId => {
                      const field = fields.find(f => f.id === fieldId);
                      if (!field) return null;
                      return (
                        <span key={fieldId} className="text-xs bg-slate-100 px-2 py-1 rounded">{field.name}</span>
                      );
                    })}
                    {(!section.field_ids || section.field_ids.length === 0) && (
                      <span className="text-xs text-slate-400 italic">No fields assigned</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Section Edit Modal */}
          {editingSection && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl w-full max-w-lg m-4 p-6">
                <h3 className="text-lg font-semibold mb-4">Edit Section: {editingSection.name}</h3>
                <SectionEditForm
                  section={editingSection}
                  fields={fields}
                  onSave={async (data) => {
                    const newSections = sections.map(s => s.id === editingSection.id ? { ...s, ...data } : s);
                    const newLayout = { ...fieldsConfig.layout, sections: newSections };
                    try {
                      await api.put("/config/account-fields/layout", newLayout);
                      toast.success("Section updated");
                      onConfigUpdate();
                      setEditingSection(null);
                    } catch (error) {
                      toast.error("Failed to update section");
                    }
                  }}
                  onCancel={() => setEditingSection(null)}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Field Edit Form Component
const FieldEditForm = ({ field, sections, onSave, onCancel }) => {
  const [formData, setFormData] = useState(field || {
    name: "",
    field_type: "text",
    description: "",
    placeholder: "",
    section_id: sections[0]?.id || "",
    validation: { required: false },
    visible: true,
    editable: true,
    show_in_list: false,
    show_in_card: false,
    options: [],
  });
  const [newOption, setNewOption] = useState({ value: "", label: "" });

  const handleSave = () => {
    if (!formData.name) {
      toast.error("Field name is required");
      return;
    }
    onSave(formData);
  };

  const addOption = () => {
    if (!newOption.value || !newOption.label) return;
    setFormData({
      ...formData,
      options: [...(formData.options || []), newOption]
    });
    setNewOption({ value: "", label: "" });
  };

  const removeOption = (idx) => {
    setFormData({
      ...formData,
      options: formData.options.filter((_, i) => i !== idx)
    });
  };

  return (
    <div className="card p-4 border-2 border-blue-200 space-y-4" data-testid="field-edit-form">
      <h4 className="font-medium">{field ? `Edit: ${field.name}` : "New Field"}</h4>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-slate-500">Field Name *</label>
          <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input w-full" placeholder="e.g., Contract Renewal Date" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Field Type</label>
          <select value={formData.field_type} onChange={(e) => setFormData({ ...formData, field_type: e.target.value })} className="input w-full" disabled={field?.is_system}>
            {Object.entries(fieldTypeConfig).map(([type, config]) => (
              <option key={type} value={type}>{config.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">Section</label>
          <select value={formData.section_id || ""} onChange={(e) => setFormData({ ...formData, section_id: e.target.value })} className="input w-full">
            <option value="">Unassigned</option>
            {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">Placeholder</label>
          <input type="text" value={formData.placeholder || ""} onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })} className="input w-full" />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-slate-500">Description</label>
          <input type="text" value={formData.description || ""} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input w-full" />
        </div>
      </div>

      {/* Options for Dropdown/Multi-select */}
      {(formData.field_type === "dropdown" || formData.field_type === "multi_select") && (
        <div>
          <label className="text-xs text-slate-500 mb-2 block">Options</label>
          <div className="space-y-2">
            {(formData.options || []).map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded">
                <span className="text-sm flex-1">{opt.label} ({opt.value})</span>
                <button onClick={() => removeOption(idx)} className="text-red-500 hover:text-red-700">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input type="text" value={newOption.value} onChange={(e) => setNewOption({ ...newOption, value: e.target.value })} className="input flex-1" placeholder="Value" />
              <input type="text" value={newOption.label} onChange={(e) => setNewOption({ ...newOption, label: e.target.value })} className="input flex-1" placeholder="Label" />
              <button onClick={addOption} className="btn-secondary text-sm">Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Display Options */}
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={formData.validation?.required || false} onChange={(e) => setFormData({ ...formData, validation: { ...formData.validation, required: e.target.checked } })} className="rounded border-slate-300" />
          Required
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={formData.show_in_list || false} onChange={(e) => setFormData({ ...formData, show_in_list: e.target.checked })} className="rounded border-slate-300" />
          Show in List
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={formData.show_in_card || false} onChange={(e) => setFormData({ ...formData, show_in_card: e.target.checked })} className="rounded border-slate-300" />
          Show in Card
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={formData.editable !== false} onChange={(e) => setFormData({ ...formData, editable: e.target.checked })} className="rounded border-slate-300" />
          Editable
        </label>
      </div>

      <div className="flex gap-2 pt-2">
        <button onClick={handleSave} className="btn-primary text-sm" data-testid="save-field-btn">
          {field ? "Update Field" : "Add Field"}
        </button>
        <button onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );
};

// Section Edit Form Component
const SectionEditForm = ({ section, fields = [], onSave, onCancel }) => {
  const [formData, setFormData] = useState(section || {
    name: "",
    icon: "📋",
    columns: 2,
    order: 1,
    collapsed_by_default: false,
    field_ids: [],
  });

  const handleSave = () => {
    if (!formData.name) {
      toast.error("Section name is required");
      return;
    }
    onSave(formData);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-slate-500">Section Name *</label>
          <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input w-full" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Icon (emoji)</label>
          <input type="text" value={formData.icon || ""} onChange={(e) => setFormData({ ...formData, icon: e.target.value })} className="input w-full" placeholder="📋" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Columns</label>
          <select value={formData.columns} onChange={(e) => setFormData({ ...formData, columns: parseInt(e.target.value) })} className="input w-full">
            <option value={1}>1 Column</option>
            <option value={2}>2 Columns</option>
            <option value={3}>3 Columns</option>
            <option value={4}>4 Columns</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">Order</label>
          <input type="number" value={formData.order} onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })} className="input w-full" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={formData.collapsed_by_default || false} onChange={(e) => setFormData({ ...formData, collapsed_by_default: e.target.checked })} className="rounded border-slate-300" />
        Collapsed by default
      </label>
      <div className="flex gap-2 pt-2">
        <button onClick={handleSave} className="btn-primary text-sm">{section ? "Update" : "Add"} Section</button>
        <button onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );
};

// User Management Tab
const UserManagementTab = ({ config, onConfigUpdate }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewUser, setShowNewUser] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [newUser, setNewUser] = useState({ email: "", name: "", role: "account_manager", password: "", quota: 500000 });
  const [generatedPassword, setGeneratedPassword] = useState(null);

  const fetchUsers = async () => {
    try {
      const res = await api.get("/config/users");
      setUsers(res.data);
    } catch (error) {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.name || !newUser.role) {
      toast.error("Email, name, and role are required");
      return;
    }
    try {
      const res = await api.post("/config/users", newUser);
      toast.success("User created successfully");
      if (res.data.user?.generated_password) {
        setGeneratedPassword(res.data.user.generated_password);
      }
      fetchUsers();
      setShowNewUser(false);
      setNewUser({ email: "", name: "", role: "account_manager", password: "", quota: 500000 });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create user");
    }
  };

  const handleUpdateUser = async () => {
    try {
      await api.put(`/config/users/${editingUser.id}`, {
        name: editingUser.name,
        role: editingUser.role,
        quota: editingUser.quota,
        is_active: editingUser.is_active,
        department_id: editingUser.department_id || null,
      });
      toast.success("User updated");
      fetchUsers();
      setEditingUser(null);
    } catch (error) {
      toast.error("Failed to update user");
    }
  };

  const handleResetPassword = async (userId) => {
    if (!confirm("Reset this user's password?")) return;
    try {
      const res = await api.post(`/config/users/${userId}/reset-password`);
      setGeneratedPassword(res.data.new_password);
      toast.success("Password reset successfully");
    } catch (error) {
      toast.error("Failed to reset password");
    }
  };

  const handleDeactivate = async (userId) => {
    if (!confirm("Deactivate this user?")) return;
    try {
      await api.delete(`/config/users/${userId}`);
      toast.success("User deactivated");
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to deactivate user");
    }
  };

  const roles = config?.roles || [];
  const departments = config?.departments?.departments || [];

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">User Management</h3>
          <p className="text-sm text-slate-500">Create, edit, and manage user accounts with department assignments</p>
        </div>
        <button onClick={() => setShowNewUser(true)} className="btn-primary text-sm flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {/* Generated Password Alert */}
      {generatedPassword && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-green-900">Generated Password</p>
            <p className="text-lg font-mono text-green-700">{generatedPassword}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { navigator.clipboard.writeText(generatedPassword); toast.success("Copied!"); }} className="btn-secondary text-sm flex items-center gap-1">
              <Copy className="w-4 h-4" /> Copy
            </button>
            <button onClick={() => setGeneratedPassword(null)} className="text-green-600 hover:text-green-800">✕</button>
          </div>
        </div>
      )}

      {/* New User Form */}
      {showNewUser && (
        <div className="card p-4 space-y-4 border-2 border-blue-200">
          <h4 className="font-medium text-slate-900">Create New User</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500">Email *</label>
              <input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="input w-full" placeholder="user@company.com" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Full Name *</label>
              <input type="text" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} className="input w-full" placeholder="John Doe" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Role *</label>
              <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className="input w-full">
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Department</label>
              <select value={newUser.department_id || ""} onChange={(e) => setNewUser({ ...newUser, department_id: e.target.value || null })} className="input w-full">
                <option value="">No Department</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Quota</label>
              <input type="number" value={newUser.quota} onChange={(e) => setNewUser({ ...newUser, quota: parseFloat(e.target.value) })} className="input w-full" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-500">Password (leave empty to auto-generate)</label>
              <input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="input w-full" placeholder="Auto-generate if empty" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreateUser} className="btn-primary text-sm">Create User</button>
            <button onClick={() => setShowNewUser(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="card p-4 space-y-4 border-2 border-amber-200">
          <h4 className="font-medium text-slate-900">Edit User: {editingUser.email}</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500">Full Name</label>
              <input type="text" value={editingUser.name} onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })} className="input w-full" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Role</label>
              <select value={editingUser.role} onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })} className="input w-full">
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Department</label>
              <select value={editingUser.department_id || ""} onChange={(e) => setEditingUser({ ...editingUser, department_id: e.target.value || null })} className="input w-full">
                <option value="">No Department</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Quota</label>
              <input type="number" value={editingUser.quota || 0} onChange={(e) => setEditingUser({ ...editingUser, quota: parseFloat(e.target.value) })} className="input w-full" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={editingUser.is_active ?? true} onChange={(e) => setEditingUser({ ...editingUser, is_active: e.target.checked })} className="rounded border-slate-300" />
                <span className="text-sm">Active</span>
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleUpdateUser} className="btn-primary text-sm" data-testid="edit-user-save-btn">Save Changes</button>
            <button onClick={() => setEditingUser(null)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="card overflow-hidden">
        <table className="w-full" data-testid="users-table">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left p-3 text-xs font-semibold text-slate-600">User</th>
              <th className="text-left p-3 text-xs font-semibold text-slate-600">Role</th>
              <th className="text-left p-3 text-xs font-semibold text-slate-600">Department</th>
              <th className="text-left p-3 text-xs font-semibold text-slate-600">Quota</th>
              <th className="text-left p-3 text-xs font-semibold text-slate-600">Status</th>
              <th className="text-right p-3 text-xs font-semibold text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => {
              const userDept = departments.find(d => d.id === u.department_id);
              return (
                <tr key={u.id} className={cn("hover:bg-slate-50", !u.is_active && "opacity-50")} data-testid={`user-row-${u.id}`}>
                  <td className="p-3">
                    <div>
                      <p className="font-medium text-slate-900">{u.name}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="text-xs bg-slate-100 px-2 py-1 rounded">{roles.find(r => r.id === u.role)?.name || u.role}</span>
                  </td>
                  <td className="p-3">
                    {userDept ? (
                      <span className="text-xs px-2 py-1 rounded text-white" style={{ backgroundColor: userDept.color || '#800000' }}>
                        {userDept.name}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 italic">No Department</span>
                    )}
                  </td>
                  <td className="p-3 text-sm text-slate-600">${(u.quota || 0).toLocaleString()}</td>
                  <td className="p-3">
                    <span className={cn("text-xs px-2 py-1 rounded", u.is_active !== false ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                      {u.is_active !== false ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setEditingUser(u)} className="p-1 hover:bg-slate-100 rounded" title="Edit" data-testid={`edit-user-${u.id}`}>
                        <Edit2 className="w-4 h-4 text-slate-500" />
                      </button>
                      <button onClick={() => handleResetPassword(u.id)} className="p-1 hover:bg-slate-100 rounded" title="Reset Password">
                        <Key className="w-4 h-4 text-slate-500" />
                      </button>
                      <button onClick={() => handleDeactivate(u.id)} className="p-1 hover:bg-red-50 rounded" title="Deactivate">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// AI Agents Tab
const AIAgentsTab = ({ config, onConfigUpdate }) => {
  const [agentsConfig, setAgentsConfig] = useState(config?.ai_agents || {});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [showNewAgent, setShowNewAgent] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  
  // Get configured LLM providers
  const llmProviders = config?.llm_providers?.providers || [];
  const enabledProviders = llmProviders.filter(p => p.is_enabled);

  useEffect(() => {
    setAgentsConfig(config?.ai_agents || {});
  }, [config]);

  const handleSaveGlobal = async () => {
    setSaving(true);
    try {
      await api.put("/config/ai-agents", agentsConfig);
      toast.success("AI agents configuration saved");
      onConfigUpdate();
    } catch (error) {
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleTestAgent = async (agent) => {
    setTesting(agent.id);
    setTestResult(null);
    try {
      // Create sample test data based on agent type
      const testData = {
        opportunity_name: "Test Enterprise Deal",
        opportunity_value: 250000,
        stage: "Proposal",
        score: 65,
        economic_buyer_status: "Identified but not engaged",
        coach_status: "Active coach in place",
        red_flags: "Budget approval pending",
        business_results: "Improved security posture",
        user_role: "Account Manager",
        active_opportunities: 12,
        pipeline_value: 1500000,
        won_deals: 5,
        pending_activities: 8,
      };
      const res = await api.post(`/config/ai-agents/${agent.id}/test`, testData);
      setTestResult(res.data);
    } catch (error) {
      setTestResult({ success: false, error: error.response?.data?.detail || "Test failed" });
    } finally {
      setTesting(null);
    }
  };

  const handleToggleAgent = async (agentId, enabled) => {
    const agents = agentsConfig.agents?.map(a => a.id === agentId ? { ...a, is_enabled: enabled } : a);
    setAgentsConfig({ ...agentsConfig, agents });
  };

  const handleDeleteAgent = async (agentId) => {
    if (!confirm("Delete this AI agent?")) return;
    try {
      await api.delete(`/config/ai-agents/${agentId}`);
      toast.success("Agent deleted");
      onConfigUpdate();
    } catch (error) {
      toast.error("Failed to delete agent");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">AI Agents Configuration</h3>
          <p className="text-sm text-slate-500">Configure AI-powered assistants and workflows</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowNewAgent(true)} className="btn-secondary text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Agent
          </button>
          <button onClick={handleSaveGlobal} disabled={saving} className="btn-primary text-sm flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save All
          </button>
        </div>
      </div>

      {/* Global Settings */}
      <div className="card p-4">
        <h4 className="font-medium text-slate-900 mb-4">Global Settings</h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-slate-500">Global Rate Limit (per day)</label>
            <input type="number" value={agentsConfig.global_rate_limit || 10000} onChange={(e) => setAgentsConfig({ ...agentsConfig, global_rate_limit: parseInt(e.target.value) })} className="input w-full" />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={agentsConfig.enable_usage_tracking ?? true} onChange={(e) => setAgentsConfig({ ...agentsConfig, enable_usage_tracking: e.target.checked })} className="rounded border-slate-300" />
              <span className="text-sm">Track Usage</span>
            </label>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={agentsConfig.cost_tracking_enabled ?? true} onChange={(e) => setAgentsConfig({ ...agentsConfig, cost_tracking_enabled: e.target.checked })} className="rounded border-slate-300" />
              <span className="text-sm">Track Costs</span>
            </label>
          </div>
        </div>
      </div>

      {/* Test Result */}
      {testResult && (
        <div className={cn("rounded-lg p-4 border", testResult.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200")}>
          <div className="flex items-center justify-between mb-2">
            <h4 className={cn("font-medium", testResult.success ? "text-green-900" : "text-red-900")}>
              {testResult.success ? "✓ Test Successful" : "✗ Test Failed"}
            </h4>
            <button onClick={() => setTestResult(null)} className="text-slate-500">✕</button>
          </div>
          {testResult.success ? (
            <div className="bg-white rounded p-3 text-sm text-slate-700 whitespace-pre-wrap max-h-60 overflow-y-auto">
              {testResult.response}
            </div>
          ) : (
            <p className="text-sm text-red-700">{testResult.error}</p>
          )}
        </div>
      )}

      {/* Agents List */}
      <div className="space-y-4">
        {agentsConfig.agents?.map((agent) => {
          const provider = llmProviders.find(p => p.id === agent.llm_provider || p.provider === agent.llm_provider);
          return (
            <div key={agent.id} className={cn("card p-4 border-2", agent.is_enabled ? "border-slate-200" : "border-slate-100 opacity-60")} data-testid={`ai-agent-${agent.id}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center", agent.is_enabled ? "bg-blue-100" : "bg-slate-100")}>
                    <Bot className={cn("w-6 h-6", agent.is_enabled ? "text-blue-600" : "text-slate-400")} />
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-900">{agent.name}</h4>
                    <p className="text-sm text-slate-500 mt-1">{agent.description}</p>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <span className={cn("text-xs px-2 py-1 rounded", provider?.api_key_configured ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>
                        {provider?.name || agent.llm_provider}
                        {!provider?.api_key_configured && " (No Key)"}
                      </span>
                      <span className="text-xs bg-slate-100 px-2 py-1 rounded">{agent.model}</span>
                      <span className="text-xs bg-slate-100 px-2 py-1 rounded">Temp: {agent.temperature}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleTestAgent(agent)} disabled={testing === agent.id || !provider?.api_key_configured} className="btn-secondary text-xs flex items-center gap-1" title={!provider?.api_key_configured ? "Configure API key first" : "Test agent"}>
                    {testing === agent.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    Test
                  </button>
                  <button onClick={() => setEditingAgent(agent)} className="p-1 hover:bg-slate-100 rounded" data-testid={`edit-agent-${agent.id}`}>
                    <Edit2 className="w-4 h-4 text-slate-500" />
                  </button>
                  <button onClick={() => handleDeleteAgent(agent.id)} className="p-1 hover:bg-red-50 rounded">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                  <label className="relative inline-flex items-center cursor-pointer ml-2">
                    <input type="checkbox" checked={agent.is_enabled} onChange={(e) => handleToggleAgent(agent.id, e.target.checked)} className="sr-only peer" />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Agent Modal */}
      {editingAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4 p-6">
            <h3 className="text-lg font-semibold mb-4">Edit Agent: {editingAgent.name}</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500">Name</label>
                  <input type="text" value={editingAgent.name} onChange={(e) => setEditingAgent({ ...editingAgent, name: e.target.value })} className="input w-full" />
                </div>
                <div>
                  <label className="text-xs text-slate-500">LLM Provider *</label>
                  <select 
                    value={editingAgent.llm_provider} 
                    onChange={(e) => {
                      const selectedProvider = llmProviders.find(p => p.id === e.target.value);
                      setEditingAgent({ 
                        ...editingAgent, 
                        llm_provider: e.target.value,
                        // Update model to provider's default if available
                        model: selectedProvider?.default_model || editingAgent.model
                      });
                    }} 
                    className="input w-full"
                    data-testid="agent-llm-provider-select"
                  >
                    {llmProviders.map((p) => (
                      <option key={p.id} value={p.id} disabled={!p.is_enabled}>
                        {p.name} {!p.is_enabled && "(Disabled)"} {!p.api_key_configured && "(No Key)"}
                      </option>
                    ))}
                  </select>
                  {!llmProviders.find(p => p.id === editingAgent.llm_provider)?.api_key_configured && (
                    <p className="text-xs text-amber-600 mt-1">⚠️ Configure API key in LLM Providers tab first</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-slate-500">Model</label>
                  <select value={editingAgent.model} onChange={(e) => setEditingAgent({ ...editingAgent, model: e.target.value })} className="input w-full">
                    {/* OpenAI models */}
                    <optgroup label="OpenAI">
                      <option value="gpt-4o">GPT-4o</option>
                      <option value="gpt-4o-mini">GPT-4o Mini</option>
                      <option value="gpt-4-turbo">GPT-4 Turbo</option>
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                    </optgroup>
                    {/* Google models */}
                    <optgroup label="Google Gemini">
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                      <option value="gemini-pro">Gemini Pro</option>
                    </optgroup>
                    {/* Local models */}
                    <optgroup label="Local (Ollama)">
                      <option value="llama3">Llama 3</option>
                      <option value="mistral">Mistral</option>
                      <option value="codellama">Code Llama</option>
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Temperature</label>
                  <input type="number" step="0.1" min="0" max="2" value={editingAgent.temperature} onChange={(e) => setEditingAgent({ ...editingAgent, temperature: parseFloat(e.target.value) })} className="input w-full" />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Max Tokens</label>
                  <input type="number" value={editingAgent.max_tokens} onChange={(e) => setEditingAgent({ ...editingAgent, max_tokens: parseInt(e.target.value) })} className="input w-full" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500">System Prompt</label>
                <textarea value={editingAgent.system_prompt} onChange={(e) => setEditingAgent({ ...editingAgent, system_prompt: e.target.value })} className="input w-full h-24" />
              </div>
              <div>
                <label className="text-xs text-slate-500">User Prompt Template</label>
                <textarea value={editingAgent.user_prompt_template} onChange={(e) => setEditingAgent({ ...editingAgent, user_prompt_template: e.target.value })} className="input w-full h-32" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500">Rate Limit (per user/day)</label>
                  <input type="number" value={editingAgent.rate_limit_per_user} onChange={(e) => setEditingAgent({ ...editingAgent, rate_limit_per_user: parseInt(e.target.value) })} className="input w-full" />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Cache TTL (minutes)</label>
                  <input type="number" value={editingAgent.cache_ttl_minutes} onChange={(e) => setEditingAgent({ ...editingAgent, cache_ttl_minutes: parseInt(e.target.value) })} className="input w-full" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditingAgent(null)} className="btn-secondary">Cancel</button>
              <button onClick={async () => {
                try {
                  await api.put(`/config/ai-agents/${editingAgent.id}`, editingAgent);
                  toast.success("Agent updated");
                  onConfigUpdate();
                  setEditingAgent(null);
                } catch (error) {
                  toast.error("Failed to update agent");
                }
              }} className="btn-primary" data-testid="save-agent-btn">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Departments Tab
const DepartmentsTab = ({ config, onConfigUpdate }) => {
  const [departments, setDepartments] = useState(config?.departments?.departments || []);
  const [teams, setTeams] = useState(config?.departments?.teams || []);
  const [showNewDept, setShowNewDept] = useState(false);
  const [newDept, setNewDept] = useState({ name: "", code: "", description: "", color: "#800000" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDepartments(config?.departments?.departments || []);
    setTeams(config?.departments?.teams || []);
  }, [config]);

  const handleCreateDept = async () => {
    if (!newDept.name || !newDept.code) {
      toast.error("Name and code are required");
      return;
    }
    try {
      await api.post("/config/departments", newDept);
      toast.success("Department created");
      onConfigUpdate();
      setShowNewDept(false);
      setNewDept({ name: "", code: "", description: "", color: "#800000" });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create department");
    }
  };

  const handleDeleteDept = async (deptId) => {
    if (!confirm("Delete this department?")) return;
    try {
      await api.delete(`/config/departments/${deptId}`);
      toast.success("Department deleted");
      onConfigUpdate();
    } catch (error) {
      toast.error("Failed to delete department");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Department Management</h3>
          <p className="text-sm text-slate-500">Configure organizational departments and teams</p>
        </div>
        <button onClick={() => setShowNewDept(true)} className="btn-primary text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Department
        </button>
      </div>

      {showNewDept && (
        <div className="card p-4 border-2 border-blue-200 space-y-4">
          <h4 className="font-medium text-slate-900">Create New Department</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500">Name *</label>
              <input type="text" value={newDept.name} onChange={(e) => setNewDept({ ...newDept, name: e.target.value })} className="input w-full" placeholder="Sales" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Code *</label>
              <input type="text" value={newDept.code} onChange={(e) => setNewDept({ ...newDept, code: e.target.value.toUpperCase() })} className="input w-full" placeholder="SALES" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Color</label>
              <input type="color" value={newDept.color} onChange={(e) => setNewDept({ ...newDept, color: e.target.value })} className="w-full h-10 rounded cursor-pointer" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Description</label>
              <input type="text" value={newDept.description} onChange={(e) => setNewDept({ ...newDept, description: e.target.value })} className="input w-full" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreateDept} className="btn-primary text-sm">Create</button>
            <button onClick={() => setShowNewDept(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {departments.map((dept) => (
          <div key={dept.id} className="card p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold" style={{ backgroundColor: dept.color }}>
                {dept.code?.substring(0, 2)}
              </div>
              <div>
                <h4 className="font-medium text-slate-900">{dept.name}</h4>
                <p className="text-sm text-slate-500">{dept.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-slate-100 px-2 py-1 rounded">{dept.code}</span>
              <button onClick={() => handleDeleteDept(dept.id)} className="p-1 hover:bg-red-50 rounded">
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Contact Roles Tab
const ContactRolesTab = ({ config, onConfigUpdate }) => {
  const [contactRoles, setContactRoles] = useState(config?.blue_sheet?.contact_roles || {});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setContactRoles(config?.blue_sheet?.contact_roles || {});
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/config/contact-roles", contactRoles);
      toast.success("Contact roles saved");
      onConfigUpdate();
    } catch (error) {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const updateRole = (roleId, field, value) => {
    const roles = contactRoles.roles?.map((r) => r.id === roleId ? { ...r, [field]: value } : r);
    setContactRoles({ ...contactRoles, roles });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Blue Sheet Contact Roles</h3>
          <p className="text-sm text-slate-500">Configure contact roles for opportunity qualification</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary text-sm flex items-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      <div className="card p-4">
        <h4 className="font-medium text-slate-900 mb-4">Qualification Requirements</h4>
        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-sm text-slate-700">Require Economic Buyer Identification</span>
            <input type="checkbox" checked={contactRoles.require_economic_buyer ?? true} onChange={(e) => setContactRoles({ ...contactRoles, require_economic_buyer: e.target.checked })} className="rounded border-slate-300" />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm text-slate-700">Require Coach Engagement</span>
            <input type="checkbox" checked={contactRoles.require_coach ?? true} onChange={(e) => setContactRoles({ ...contactRoles, require_coach: e.target.checked })} className="rounded border-slate-300" />
          </label>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-700">Minimum Contacts for Qualification</span>
            <input type="number" min="1" max="10" value={contactRoles.min_contacts_for_qualification || 3} onChange={(e) => setContactRoles({ ...contactRoles, min_contacts_for_qualification: parseInt(e.target.value) })} className="w-20 input text-sm" />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {contactRoles.roles?.map((role) => (
          <div key={role.id} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: role.color + "20", color: role.color }}>
                  <Contact2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-medium text-slate-900">{role.name}</h4>
                  <p className="text-xs text-slate-500">{role.role_type}</p>
                </div>
              </div>
              <label className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Required</span>
                <input type="checkbox" checked={role.is_required_for_qualification} onChange={(e) => updateRole(role.id, "is_required_for_qualification", e.target.checked)} className="rounded border-slate-300" />
              </label>
            </div>
            <p className="text-sm text-slate-600 mb-3">{role.description}</p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">Weight:</label>
                <input type="number" min="1" max="10" value={role.importance_weight} onChange={(e) => updateRole(role.id, "importance_weight", parseInt(e.target.value))} className="w-16 input text-sm" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">Color:</label>
                <input type="color" value={role.color} onChange={(e) => updateRole(role.id, "color", e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// AI Chatbot Tab
const AIChatbotTab = ({ config, onConfigUpdate }) => {
  const [chatbot, setChatbot] = useState(config?.ai_chatbot || {});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setChatbot(config?.ai_chatbot || {});
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/config/ai-chatbot", chatbot);
      toast.success("AI Chatbot configuration saved");
      onConfigUpdate();
    } catch (error) {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (enabled) => {
    try {
      await api.post(`/config/ai-chatbot/toggle?enable=${enabled}`);
      toast.success(`AI Chatbot ${enabled ? "enabled" : "disabled"}`);
      onConfigUpdate();
    } catch (error) {
      toast.error("Failed to toggle chatbot");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">AI Chatbot Configuration</h3>
          <p className="text-sm text-slate-500">Configure the AI assistant chatbot</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary text-sm flex items-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center", chatbot.is_enabled ? "bg-green-100" : "bg-slate-100")}>
              <MessageSquare className={cn("w-6 h-6", chatbot.is_enabled ? "text-green-600" : "text-slate-400")} />
            </div>
            <div>
              <h4 className="font-medium text-slate-900">{chatbot.name || "AI Chatbot"}</h4>
              <p className="text-sm text-slate-500">{chatbot.is_enabled ? "Active and available to users" : "Disabled - not visible to users"}</p>
            </div>
          </div>
          <button onClick={() => handleToggle(!chatbot.is_enabled)} className={cn("px-4 py-2 rounded-lg text-sm font-medium", chatbot.is_enabled ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-green-100 text-green-700 hover:bg-green-200")}>
            {chatbot.is_enabled ? "Disable" : "Enable"}
          </button>
        </div>
      </div>

      <div className="card p-4 space-y-4">
        <h4 className="font-medium text-slate-900">Basic Settings</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-500">Chatbot Name</label>
            <input type="text" value={chatbot.name || ""} onChange={(e) => setChatbot({ ...chatbot, name: e.target.value })} className="input w-full" />
          </div>
          <div>
            <label className="text-xs text-slate-500">LLM Provider</label>
            <select value={chatbot.llm_provider || "openai"} onChange={(e) => setChatbot({ ...chatbot, llm_provider: e.target.value })} className="input w-full">
              <option value="openai">OpenAI</option>
              <option value="google">Google</option>
              <option value="ollama">Ollama (Local)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500">Model</label>
            <select value={chatbot.model || "gpt-4o"} onChange={(e) => setChatbot({ ...chatbot, model: e.target.value })} className="input w-full">
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-4o-mini">GPT-4o Mini</option>
              <option value="gpt-4-turbo">GPT-4 Turbo</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500">Rate Limit (per user/day)</label>
            <input type="number" value={chatbot.rate_limit_per_user || 50} onChange={(e) => setChatbot({ ...chatbot, rate_limit_per_user: parseInt(e.target.value) })} className="input w-full" />
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-500">Welcome Message</label>
          <textarea value={chatbot.welcome_message || ""} onChange={(e) => setChatbot({ ...chatbot, welcome_message: e.target.value })} className="input w-full h-20" />
        </div>
        <div>
          <label className="text-xs text-slate-500">System Prompt</label>
          <textarea value={chatbot.system_prompt || ""} onChange={(e) => setChatbot({ ...chatbot, system_prompt: e.target.value })} className="input w-full h-32" />
        </div>
      </div>

      <div className="card p-4">
        <h4 className="font-medium text-slate-900 mb-4">Advanced Settings</h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-slate-500">Temperature</label>
            <input type="number" step="0.1" min="0" max="2" value={chatbot.temperature || 0.7} onChange={(e) => setChatbot({ ...chatbot, temperature: parseFloat(e.target.value) })} className="input w-full" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Max Tokens</label>
            <input type="number" value={chatbot.max_tokens || 2000} onChange={(e) => setChatbot({ ...chatbot, max_tokens: parseInt(e.target.value) })} className="input w-full" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Context Window</label>
            <input type="number" value={chatbot.context_window || 10} onChange={(e) => setChatbot({ ...chatbot, context_window: parseInt(e.target.value) })} className="input w-full" />
          </div>
        </div>
      </div>
    </div>
  );
};

// LLM Providers Tab - Enhanced with API Key Input
const LLMProvidersTab = ({ config, onConfigUpdate }) => {
  const [providers, setProviders] = useState(config?.llm_providers || {});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(null);
  const [editingKey, setEditingKey] = useState(null);
  const [newApiKey, setNewApiKey] = useState("");
  const [useEnvVar, setUseEnvVar] = useState(false);
  const [envVarName, setEnvVarName] = useState("");

  useEffect(() => {
    setProviders(config?.llm_providers || {});
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/config/llm-providers", providers);
      toast.success("LLM providers saved");
      onConfigUpdate();
    } catch (error) {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleSetApiKey = async (providerId) => {
    try {
      await api.post(`/config/llm-providers/${providerId}/api-key`, {
        api_key: useEnvVar ? "" : newApiKey,
        use_env: useEnvVar,
        api_key_env: useEnvVar ? envVarName : ""
      });
      toast.success("API key updated");
      onConfigUpdate();
      setEditingKey(null);
      setNewApiKey("");
      setUseEnvVar(false);
      setEnvVarName("");
    } catch (error) {
      toast.error("Failed to set API key");
    }
  };

  const handleTest = async (provider) => {
    setTesting(provider.id);
    try {
      const res = await api.post("/config/llm/test-connection", {
        provider: provider.provider,
        api_key_env: provider.api_key_env,
        model: provider.default_model
      });
      if (res.data.success) {
        toast.success(`${provider.name} connection successful!`);
      } else {
        toast.error(res.data.error || "Connection failed");
      }
    } catch (error) {
      toast.error("Test failed");
    } finally {
      setTesting(null);
    }
  };

  const toggleProvider = (providerId, enabled) => {
    const providerList = providers.providers?.map((p) => p.id === providerId ? { ...p, is_enabled: enabled } : p);
    setProviders({ ...providers, providers: providerList });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">LLM Providers</h3>
          <p className="text-sm text-slate-500">Configure AI language model providers and API keys</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary text-sm flex items-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      <div className="space-y-4">
        {providers.providers?.map((provider) => (
          <div key={provider.id} className={cn("card p-4 border-2", provider.is_enabled ? "border-green-200" : "border-slate-200")}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold", provider.is_enabled && provider.api_key_configured ? "bg-green-500" : provider.is_enabled ? "bg-amber-500" : "bg-slate-400")}>
                  {provider.provider?.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-medium text-slate-900 flex items-center gap-2">
                    {provider.name}
                    {provider.api_key_configured ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Key Configured</span>
                    ) : (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">No API Key</span>
                    )}
                  </h4>
                  <p className="text-sm text-slate-500">
                    Model: {provider.default_model}
                    {provider.api_key_masked && ` | Key: ${provider.api_key_masked}`}
                    {provider.api_key_env && ` | Env: ${provider.api_key_env}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setEditingKey(editingKey === provider.id ? null : provider.id)} className="btn-secondary text-xs flex items-center gap-1">
                  <Key className="w-3 h-3" />
                  {editingKey === provider.id ? "Cancel" : "Set Key"}
                </button>
                <button onClick={() => handleTest(provider)} disabled={testing === provider.id || !provider.api_key_configured} className="btn-secondary text-xs flex items-center gap-1">
                  {testing === provider.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                  Test
                </button>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={provider.is_enabled} onChange={(e) => toggleProvider(provider.id, e.target.checked)} className="sr-only peer" />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                </label>
              </div>
            </div>
            
            {/* API Key Configuration */}
            {editingKey === provider.id && (
              <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                <h5 className="font-medium text-slate-700">Configure API Key for {provider.name}</h5>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={!useEnvVar} onChange={() => setUseEnvVar(false)} name={`keyType-${provider.id}`} />
                    <span className="text-sm">Enter API Key</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={useEnvVar} onChange={() => setUseEnvVar(true)} name={`keyType-${provider.id}`} />
                    <span className="text-sm">Use Environment Variable</span>
                  </label>
                </div>
                {!useEnvVar ? (
                  <div>
                    <label className="text-xs text-slate-500">API Key</label>
                    <input
                      type="password"
                      value={newApiKey}
                      onChange={(e) => setNewApiKey(e.target.value)}
                      className="input w-full"
                      placeholder="sk-..."
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-xs text-slate-500">Environment Variable Name</label>
                    <input
                      type="text"
                      value={envVarName}
                      onChange={(e) => setEnvVarName(e.target.value)}
                      className="input w-full"
                      placeholder="OPENAI_API_KEY or EMERGENT_LLM_KEY"
                    />
                    <p className="text-xs text-slate-400 mt-1">Use EMERGENT_LLM_KEY for platform-provided key</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => handleSetApiKey(provider.id)} className="btn-primary text-sm">Save API Key</button>
                  <button onClick={() => { setEditingKey(null); setNewApiKey(""); setUseEnvVar(false); }} className="btn-secondary text-sm">Cancel</button>
                </div>
              </div>
            )}
            
            {provider.is_enabled && editingKey !== provider.id && (
              <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-4 gap-4 text-xs">
                <div><span className="text-slate-500">Max Tokens:</span> {provider.max_tokens_limit}</div>
                <div><span className="text-slate-500">Rate Limit:</span> {provider.rate_limit_rpm}/min</div>
                <div><span className="text-slate-500">Input Cost:</span> ${provider.cost_per_1k_input_tokens}/1K</div>
                <div><span className="text-slate-500">Output Cost:</span> ${provider.cost_per_1k_output_tokens}/1K</div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card p-4">
        <h4 className="font-medium text-slate-900 mb-4">Global Settings</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-500">Default Provider</label>
            <select value={providers.default_provider_id || "openai"} onChange={(e) => setProviders({ ...providers, default_provider_id: e.target.value })} className="input w-full">
              {providers.providers?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={providers.enable_cost_tracking ?? true} onChange={(e) => setProviders({ ...providers, enable_cost_tracking: e.target.checked })} className="rounded border-slate-300" />
              <span className="text-sm">Enable Cost Tracking</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

// Email Configuration Tab
const EmailConfigTab = ({ config, onConfigUpdate }) => {
  const [emailConfig, setEmailConfig] = useState(config?.email || {});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEmailConfig(config?.email || {});
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/config/email", emailConfig);
      toast.success("Email configuration saved");
      onConfigUpdate();
    } catch (error) {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Email Configuration</h3>
          <p className="text-sm text-slate-500">Configure email provider for notifications and invitations</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary text-sm flex items-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-slate-900">Email Service</h4>
          <label className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Enabled</span>
            <input type="checkbox" checked={emailConfig.is_enabled ?? false} onChange={(e) => setEmailConfig({ ...emailConfig, is_enabled: e.target.checked })} className="rounded border-slate-300" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-500">Provider</label>
            <select value={emailConfig.provider || "office365"} onChange={(e) => setEmailConfig({ ...emailConfig, provider: e.target.value })} className="input w-full">
              <option value="office365">Microsoft Office 365</option>
              <option value="sendgrid">SendGrid</option>
              <option value="resend">Resend</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500">From Email</label>
            <input type="email" value={emailConfig.from_email || ""} onChange={(e) => setEmailConfig({ ...emailConfig, from_email: e.target.value })} className="input w-full" />
          </div>
          <div>
            <label className="text-xs text-slate-500">From Name</label>
            <input type="text" value={emailConfig.from_name || ""} onChange={(e) => setEmailConfig({ ...emailConfig, from_name: e.target.value })} className="input w-full" />
          </div>
        </div>
      </div>

      {emailConfig.provider === "office365" && (
        <div className="card p-4">
          <h4 className="font-medium text-slate-900 mb-4">Office 365 Configuration</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500">Tenant ID</label>
              <input type="text" value={emailConfig.tenant_id || ""} onChange={(e) => setEmailConfig({ ...emailConfig, tenant_id: e.target.value })} className="input w-full" placeholder="your-tenant-id" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Client ID</label>
              <input type="text" value={emailConfig.client_id || ""} onChange={(e) => setEmailConfig({ ...emailConfig, client_id: e.target.value })} className="input w-full" placeholder="your-client-id" />
            </div>
          </div>
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 inline mr-1" />
              Client Secret should be set as environment variable: <code className="bg-amber-100 px-1 rounded">{emailConfig.client_secret_env || "OFFICE365_CLIENT_SECRET"}</code>
            </p>
          </div>
        </div>
      )}

      <div className="card p-4">
        <h4 className="font-medium text-slate-900 mb-4">Email Templates</h4>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-500">User Invitation Subject</label>
            <input type="text" value={emailConfig.user_invitation_subject || ""} onChange={(e) => setEmailConfig({ ...emailConfig, user_invitation_subject: e.target.value })} className="input w-full" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Password Reset Subject</label>
            <input type="text" value={emailConfig.password_reset_subject || ""} onChange={(e) => setEmailConfig({ ...emailConfig, password_reset_subject: e.target.value })} className="input w-full" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Roles Management Tab
const RolesTab = ({ config, onConfigUpdate }) => {
  const [selectedRole, setSelectedRole] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [showNewRole, setShowNewRole] = useState(false);
  const [newRole, setNewRole] = useState({ id: "", name: "", description: "" });

  const handleCreateRole = async () => {
    if (!newRole.id || !newRole.name) {
      toast.error("Role ID and Name are required");
      return;
    }
    try {
      await api.post("/config/roles", {
        id: newRole.id.toLowerCase().replace(/\s+/g, "_"),
        name: newRole.name,
        description: newRole.description,
        permissions: [],
      });
      toast.success("Role created successfully");
      onConfigUpdate();
      setShowNewRole(false);
      setNewRole({ id: "", name: "", description: "" });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create role");
    }
  };

  const handleDeleteRole = async (roleId) => {
    if (!confirm("Are you sure you want to delete this role?")) return;
    try {
      await api.delete(`/config/roles/${roleId}`);
      toast.success("Role deleted");
      onConfigUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete role");
    }
  };

  const handleSavePermissions = async (permissions) => {
    await api.put(`/config/roles/${editingRole.id}/permissions`, permissions);
    onConfigUpdate();
    setEditingRole(null);
  };

  if (editingRole) {
    return (
      <RolePermissionEditor
        role={editingRole}
        modules={config?.modules || []}
        onSave={handleSavePermissions}
        onCancel={() => setEditingRole(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Role Management</h3>
          <p className="text-sm text-slate-500">
            Define roles and assign feature permissions
          </p>
        </div>
        <button
          onClick={() => setShowNewRole(true)}
          className="btn-primary text-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Role
        </button>
      </div>

      {showNewRole && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <h4 className="font-medium text-blue-900">Create New Role</h4>
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Role ID (e.g., regional_manager)"
              value={newRole.id}
              onChange={(e) => setNewRole({ ...newRole, id: e.target.value })}
              className="input text-sm"
            />
            <input
              type="text"
              placeholder="Role Name"
              value={newRole.name}
              onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
              className="input text-sm"
            />
          </div>
          <input
            type="text"
            placeholder="Description"
            value={newRole.description}
            onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
            className="input text-sm w-full"
          />
          <div className="flex gap-2">
            <button onClick={handleCreateRole} className="btn-primary text-sm">
              Create
            </button>
            <button
              onClick={() => setShowNewRole(false)}
              className="btn-secondary text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {config?.roles?.map((role) => (
          <div
            key={role.id}
            className={cn(
              "border rounded-lg p-4 transition-all cursor-pointer hover:border-blue-300",
              selectedRole?.id === role.id && "border-blue-500 bg-blue-50"
            )}
            onClick={() => setSelectedRole(selectedRole?.id === role.id ? null : role)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    role.is_system_role ? "bg-slate-100" : "bg-blue-100"
                  )}
                >
                  <Shield
                    className={cn(
                      "w-5 h-5",
                      role.is_system_role ? "text-slate-600" : "text-blue-600"
                    )}
                  />
                </div>
                <div>
                  <h4 className="font-medium text-slate-900 flex items-center gap-2">
                    {role.name}
                    {role.is_system_role && (
                      <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded">
                        System
                      </span>
                    )}
                  </h4>
                  <p className="text-sm text-slate-500">{role.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">
                  {role.permissions?.length || 0} permissions
                </span>
                <ChevronRight
                  className={cn(
                    "w-4 h-4 text-slate-400 transition-transform",
                    selectedRole?.id === role.id && "rotate-90"
                  )}
                />
              </div>
            </div>

            {selectedRole?.id === role.id && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-slate-700">Assigned Features:</p>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingRole(role);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit Permissions
                    </button>
                    {!role.is_system_role && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRole(role.id);
                        }}
                        className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {role.permissions?.map((perm, idx) => (
                    <span
                      key={idx}
                      className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded"
                    >
                      {perm.module_id}.{perm.feature_id}
                    </span>
                  ))}
                  {(!role.permissions || role.permissions.length === 0) && (
                    <span className="text-xs text-slate-400">No permissions assigned</span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Blue Sheet Configuration Tab
const BlueSheetTab = ({ config, onConfigUpdate }) => {
  const [blueSheet, setBlueSheet] = useState(config?.blue_sheet || {});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBlueSheet(config?.blue_sheet || {});
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/config/blue-sheet", blueSheet);
      toast.success("Blue Sheet configuration saved");
      onConfigUpdate();
    } catch (error) {
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const updateElement = (elementId, field, value) => {
    const elements = blueSheet.elements?.map((el) =>
      el.id === elementId ? { ...el, [field]: value } : el
    );
    setBlueSheet({ ...blueSheet, elements });
  };

  const updateStage = (stageId, field, value) => {
    const stages = blueSheet.stages?.map((st) =>
      st.id === stageId ? { ...st, [field]: value } : st
    );
    setBlueSheet({ ...blueSheet, stages });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Blue Sheet Configuration</h3>
          <p className="text-sm text-slate-500">
            Configure opportunity scoring elements and pipeline stages
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary text-sm flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      {/* Scoring Elements */}
      <div className="card p-4">
        <h4 className="font-medium text-slate-900 mb-4">Scoring Elements</h4>
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {blueSheet.elements?.map((element) => (
            <div
              key={element.id}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg",
                element.is_negative ? "bg-red-50" : "bg-slate-50"
              )}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={element.is_enabled}
                  onChange={(e) => updateElement(element.id, "is_enabled", e.target.checked)}
                  className="rounded border-slate-300"
                />
                <div>
                  <p className="text-sm font-medium text-slate-900">{element.name}</p>
                  <p className="text-xs text-slate-500">
                    {element.category} • {element.element_type}
                    {element.is_negative && " • Negative"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">Weight:</label>
                <input
                  type="number"
                  value={element.weight}
                  onChange={(e) => updateElement(element.id, "weight", parseInt(e.target.value))}
                  className="w-16 input text-sm"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline Stages */}
      <div className="card p-4">
        <h4 className="font-medium text-slate-900 mb-4">Pipeline Stages</h4>
        <div className="space-y-3">
          {blueSheet.stages?.map((stage) => (
            <div
              key={stage.id}
              className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: stage.color }}
                />
                <div>
                  <p className="text-sm font-medium text-slate-900">{stage.name}</p>
                  <p className="text-xs text-slate-500">Order: {stage.order}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">Probability:</label>
                  <input
                    type="number"
                    value={stage.probability_default}
                    onChange={(e) =>
                      updateStage(stage.id, "probability_default", parseInt(e.target.value))
                    }
                    className="w-16 input text-sm"
                  />
                  <span className="text-xs text-slate-400">%</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">Color:</label>
                  <input
                    type="color"
                    value={stage.color}
                    onChange={(e) => updateStage(stage.id, "color", e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Enhancement */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-slate-900">AI Enhancement</h4>
            <p className="text-sm text-slate-500">
              Enable AI-powered probability analysis recommendations
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={blueSheet.ai_enhancement_enabled}
              onChange={(e) =>
                setBlueSheet({ ...blueSheet, ai_enhancement_enabled: e.target.checked })
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>
    </div>
  );
};

// LLM Configuration Tab
const LLMTab = ({ config, onConfigUpdate }) => {
  const [llmConfig, setLlmConfig] = useState(config?.llm || {});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLlmConfig(config?.llm || {});
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/config/llm", llmConfig);
      toast.success("LLM configuration saved");
      onConfigUpdate();
    } catch (error) {
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const updatePrompt = (promptId, field, value) => {
    const templates = llmConfig.prompt_templates?.map((p) =>
      p.id === promptId ? { ...p, [field]: value } : p
    );
    setLlmConfig({ ...llmConfig, prompt_templates: templates });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">AI / LLM Settings</h3>
          <p className="text-sm text-slate-500">
            Configure AI providers and prompt templates
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary text-sm flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      {/* Provider Settings */}
      <div className="card p-4">
        <h4 className="font-medium text-slate-900 mb-4">LLM Provider</h4>
        <div className="space-y-4">
          {llmConfig.providers?.map((provider, idx) => (
            <div key={idx} className="p-3 bg-slate-50 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900 capitalize">
                    {provider.provider}
                  </span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                    {provider.model}
                  </span>
                </div>
                <label className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Enabled</span>
                  <input
                    type="checkbox"
                    checked={provider.is_enabled}
                    onChange={(e) => {
                      const providers = [...llmConfig.providers];
                      providers[idx] = { ...provider, is_enabled: e.target.checked };
                      setLlmConfig({ ...llmConfig, providers });
                    }}
                    className="rounded border-slate-300"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500">Temperature</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={provider.temperature}
                    onChange={(e) => {
                      const providers = [...llmConfig.providers];
                      providers[idx] = { ...provider, temperature: parseFloat(e.target.value) };
                      setLlmConfig({ ...llmConfig, providers });
                    }}
                    className="input text-sm w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Max Tokens</label>
                  <input
                    type="number"
                    value={provider.max_tokens}
                    onChange={(e) => {
                      const providers = [...llmConfig.providers];
                      providers[idx] = { ...provider, max_tokens: parseInt(e.target.value) };
                      setLlmConfig({ ...llmConfig, providers });
                    }}
                    className="input text-sm w-full"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Prompt Templates */}
      <div className="card p-4">
        <h4 className="font-medium text-slate-900 mb-4">Prompt Templates</h4>
        <div className="space-y-4">
          {llmConfig.prompt_templates?.map((prompt) => (
            <div key={prompt.id} className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h5 className="font-medium text-slate-900">{prompt.name}</h5>
                  <p className="text-xs text-slate-500">Category: {prompt.category}</p>
                </div>
                <label className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Enabled</span>
                  <input
                    type="checkbox"
                    checked={prompt.is_enabled}
                    onChange={(e) => updatePrompt(prompt.id, "is_enabled", e.target.checked)}
                    className="rounded border-slate-300"
                  />
                </label>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500">System Prompt</label>
                  <textarea
                    value={prompt.system_prompt}
                    onChange={(e) => updatePrompt(prompt.id, "system_prompt", e.target.value)}
                    className="input text-sm w-full h-20"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">User Prompt Template</label>
                  <textarea
                    value={prompt.user_prompt_template}
                    onChange={(e) => updatePrompt(prompt.id, "user_prompt_template", e.target.value)}
                    className="input text-sm w-full h-24"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Caching */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-slate-900">Response Caching</h4>
            <p className="text-sm text-slate-500">Cache LLM responses to reduce API costs</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">TTL (minutes):</label>
              <input
                type="number"
                value={llmConfig.cache_ttl_minutes || 60}
                onChange={(e) =>
                  setLlmConfig({ ...llmConfig, cache_ttl_minutes: parseInt(e.target.value) })
                }
                className="w-20 input text-sm"
              />
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={llmConfig.enable_caching}
                onChange={(e) => setLlmConfig({ ...llmConfig, enable_caching: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

// UI Configuration Tab
const UITab = ({ config, onConfigUpdate }) => {
  const [uiConfig, setUiConfig] = useState(config?.ui || {});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setUiConfig(config?.ui || {});
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/config/ui", uiConfig);
      toast.success("UI configuration saved");
      onConfigUpdate();
    } catch (error) {
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const updateColor = (colorKey, value) => {
    setUiConfig({
      ...uiConfig,
      colors: { ...uiConfig.colors, [colorKey]: value },
    });
  };

  const updateBranding = (field, value) => {
    setUiConfig({
      ...uiConfig,
      branding: { ...uiConfig.branding, [field]: value },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">UI & Branding</h3>
          <p className="text-sm text-slate-500">
            Customize colors, typography, and branding
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary text-sm flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      {/* Branding */}
      <div className="card p-4">
        <h4 className="font-medium text-slate-900 mb-4">Branding</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-500">App Name</label>
            <input
              type="text"
              value={uiConfig.branding?.app_name || ""}
              onChange={(e) => updateBranding("app_name", e.target.value)}
              className="input w-full"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Tagline</label>
            <input
              type="text"
              value={uiConfig.branding?.tagline || ""}
              onChange={(e) => updateBranding("tagline", e.target.value)}
              className="input w-full"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Logo URL</label>
            <input
              type="text"
              value={uiConfig.branding?.logo_url || ""}
              onChange={(e) => updateBranding("logo_url", e.target.value)}
              className="input w-full"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Favicon URL</label>
            <input
              type="text"
              value={uiConfig.branding?.favicon_url || ""}
              onChange={(e) => updateBranding("favicon_url", e.target.value)}
              className="input w-full"
              placeholder="https://..."
            />
          </div>
        </div>
      </div>

      {/* Theme */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-slate-900">Theme Mode</h4>
          <div className="flex gap-2">
            {["light", "dark", "system"].map((mode) => (
              <button
                key={mode}
                onClick={() => setUiConfig({ ...uiConfig, theme_mode: mode })}
                className={cn(
                  "px-3 py-1 rounded-lg text-sm capitalize transition-colors",
                  uiConfig.theme_mode === mode
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Colors */}
      <div className="card p-4">
        <h4 className="font-medium text-slate-900 mb-4">Color Palette</h4>
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(uiConfig.colors || {}).map(([key, value]) => (
            <div key={key} className="flex items-center gap-3">
              <input
                type="color"
                value={value}
                onChange={(e) => updateColor(key, e.target.value)}
                className="w-10 h-10 rounded cursor-pointer"
              />
              <div>
                <p className="text-sm font-medium text-slate-900 capitalize">
                  {key.replace(/_/g, " ")}
                </p>
                <p className="text-xs text-slate-500">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Typography */}
      <div className="card p-4">
        <h4 className="font-medium text-slate-900 mb-4">Typography</h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-slate-500">Heading Font</label>
            <input
              type="text"
              value={uiConfig.typography?.heading_font || ""}
              onChange={(e) =>
                setUiConfig({
                  ...uiConfig,
                  typography: { ...uiConfig.typography, heading_font: e.target.value },
                })
              }
              className="input w-full"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Body Font</label>
            <input
              type="text"
              value={uiConfig.typography?.body_font || ""}
              onChange={(e) =>
                setUiConfig({
                  ...uiConfig,
                  typography: { ...uiConfig.typography, body_font: e.target.value },
                })
              }
              className="input w-full"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Mono Font</label>
            <input
              type="text"
              value={uiConfig.typography?.mono_font || ""}
              onChange={(e) =>
                setUiConfig({
                  ...uiConfig,
                  typography: { ...uiConfig.typography, mono_font: e.target.value },
                })
              }
              className="input w-full"
            />
          </div>
        </div>
      </div>

      {/* UI Options */}
      <div className="card p-4">
        <h4 className="font-medium text-slate-900 mb-4">UI Options</h4>
        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-sm text-slate-700">Sidebar Collapsed by Default</span>
            <input
              type="checkbox"
              checked={uiConfig.sidebar_collapsed}
              onChange={(e) => setUiConfig({ ...uiConfig, sidebar_collapsed: e.target.checked })}
              className="rounded border-slate-300"
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm text-slate-700">Compact Mode</span>
            <input
              type="checkbox"
              checked={uiConfig.compact_mode}
              onChange={(e) => setUiConfig({ ...uiConfig, compact_mode: e.target.checked })}
              className="rounded border-slate-300"
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm text-slate-700">Enable Animations</span>
            <input
              type="checkbox"
              checked={uiConfig.animations_enabled}
              onChange={(e) => setUiConfig({ ...uiConfig, animations_enabled: e.target.checked })}
              className="rounded border-slate-300"
            />
          </label>
        </div>
      </div>
    </div>
  );
};

// Integrations Tab
const IntegrationsTab = ({ config, onConfigUpdate }) => {
  return <OdooIntegrationHub />;
};

// Main Super Admin Config Page
const SuperAdminConfig = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("organization");
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchConfig = async () => {
    try {
      const response = await api.get("/config/system");
      setConfig(response.data);
    } catch (error) {
      console.error("Error fetching config:", error);
      toast.error("Failed to load configuration");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  // Check if user is super admin
  if (user?.role !== "super_admin") {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <Shield className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Access Denied</h2>
        <p className="text-slate-500">
          You need Super Admin privileges to access this page.
        </p>
      </div>
    );
  }

  const renderTab = () => {
    switch (activeTab) {
      case "organization":
        return <OrganizationTab config={config} onConfigUpdate={fetchConfig} />;
      case "account-fields":
        return <AccountFormBuilder />;
      case "departments":
        return <DepartmentsTab config={config} onConfigUpdate={fetchConfig} />;
      case "users":
        return <UserManagementTab config={config} onConfigUpdate={fetchConfig} />;
      case "roles":
        return <RolesTab config={config} onConfigUpdate={fetchConfig} />;
      case "contact-roles":
        return <ContactRolesTab config={config} onConfigUpdate={fetchConfig} />;
      case "ai-agents":
        return <AIAgentsTab config={config} onConfigUpdate={fetchConfig} />;
      case "ai-chatbot":
        return <AIChatbotTab config={config} onConfigUpdate={fetchConfig} />;
      case "llm-providers":
        return <LLMProvidersTab config={config} onConfigUpdate={fetchConfig} />;
      case "blue-sheet":
        return <BlueSheetTab config={config} onConfigUpdate={fetchConfig} />;
      case "llm":
        return <LLMTab config={config} onConfigUpdate={fetchConfig} />;
      case "ui":
        return <UITab config={config} onConfigUpdate={fetchConfig} />;
      case "email":
        return <EmailConfigTab config={config} onConfigUpdate={fetchConfig} />;
      case "integrations":
        return <IntegrationsTab config={config} onConfigUpdate={fetchConfig} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6" data-testid="super-admin-config">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <Settings className="w-8 h-8" style={{ color: "#800000" }} />
          Securado System Configuration
        </h1>
        <p className="text-slate-600 mt-1">
          Configure roles, departments, AI settings, and system branding
        </p>
      </div>

      {/* Tab Navigation & Content */}
      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors",
                  activeTab === item.id
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-slate-600 hover:bg-slate-50"
                )}
                data-testid={`config-tab-${item.id}`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </button>
            ))}
          </nav>

          {/* Reset Defaults */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <button
              onClick={async () => {
                if (confirm("Reset all configuration to defaults?")) {
                  try {
                    await api.post("/config/reset-defaults");
                    toast.success("Configuration reset to defaults");
                    fetchConfig();
                  } catch (error) {
                    toast.error("Failed to reset configuration");
                  }
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to Defaults
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">{renderTab()}</div>
      </div>
    </div>
  );
};

export default SuperAdminConfig;
