import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { cn } from "../lib/utils";
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
} from "lucide-react";
import { toast } from "sonner";

// Sidebar navigation items
const navItems = [
  { id: "roles", label: "Roles & Permissions", icon: Shield },
  { id: "blue-sheet", label: "Blue Sheet Config", icon: FileText },
  { id: "llm", label: "AI / LLM Settings", icon: Sparkles },
  { id: "ui", label: "UI & Branding", icon: Palette },
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
  const integrations = [
    {
      id: "odoo",
      name: "Odoo ERP",
      description: "Sync accounts, opportunities, and invoices",
      icon: "🏢",
      status: "mocked",
    },
    {
      id: "office365",
      name: "Microsoft 365",
      description: "Sync emails and calendar events",
      icon: "📧",
      status: "mocked",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Integrations</h3>
        <p className="text-sm text-slate-500">
          Configure external system integrations
        </p>
      </div>

      <div className="grid gap-4">
        {integrations.map((integration) => (
          <div
            key={integration.id}
            className="card p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-2xl">
                {integration.icon}
              </div>
              <div>
                <h4 className="font-medium text-slate-900">{integration.name}</h4>
                <p className="text-sm text-slate-500">{integration.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "text-xs px-2 py-1 rounded-full",
                  integration.status === "connected"
                    ? "bg-green-100 text-green-700"
                    : integration.status === "mocked"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-600"
                )}
              >
                {integration.status === "mocked" ? "Mocked" : integration.status}
              </span>
              <button className="btn-secondary text-sm">Configure</button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
        <div>
          <h4 className="font-medium text-amber-900">Integration Note</h4>
          <p className="text-sm text-amber-700">
            Odoo and Microsoft 365 integrations are currently mocked. To enable real
            data synchronization, provide API credentials and configure sync settings.
          </p>
        </div>
      </div>
    </div>
  );
};

// Main Super Admin Config Page
const SuperAdminConfig = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("roles");
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
      case "roles":
        return <RolesTab config={config} onConfigUpdate={fetchConfig} />;
      case "blue-sheet":
        return <BlueSheetTab config={config} onConfigUpdate={fetchConfig} />;
      case "llm":
        return <LLMTab config={config} onConfigUpdate={fetchConfig} />;
      case "ui":
        return <UITab config={config} onConfigUpdate={fetchConfig} />;
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
          <Settings className="w-8 h-8 text-blue-600" />
          System Configuration
        </h1>
        <p className="text-slate-600 mt-1">
          Configure roles, permissions, AI settings, and system branding
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
