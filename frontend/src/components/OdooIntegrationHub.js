import React, { useState, useEffect } from "react";
import api from "../services/api";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import {
  Database,
  RefreshCw,
  Check,
  X,
  AlertCircle,
  Play,
  Link2,
  ArrowRight,
  Loader2,
  Save,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  ChevronRight,
  Building2,
  Calendar,
  Zap,
  TestTube,
  History,
  Search,
  Globe,
  User,
  Key,
  Server,
  Shield,
  ArrowLeftRight,
  Sparkles,
  Info,
  ExternalLink,
} from "lucide-react";

// ===================== MAIN INTEGRATION HUB =====================

const OdooIntegrationHub = () => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("connection");
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await api.get("/odoo/config");
      setConfig(response.data);
      if (response.data.connection?.is_connected) {
        setConnectionStatus({ 
          success: true, 
          message: `Connected to Odoo ${response.data.connection.odoo_version}` 
        });
      }
    } catch (error) {
      console.error("Failed to fetch Odoo config:", error);
      toast.error("Failed to load Odoo configuration");
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const response = await api.post("/odoo/test-connection");
      setConnectionStatus(response.data);
      if (response.data.success) {
        toast.success("Connection successful!");
        fetchConfig();
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      setConnectionStatus({ 
        success: false, 
        message: error.response?.data?.detail || "Connection failed" 
      });
      toast.error("Connection test failed");
    } finally {
      setTestingConnection(false);
    }
  };

  const handleUpdateConnection = async (connectionData) => {
    try {
      await api.put("/odoo/config/connection", connectionData);
      toast.success("Connection settings saved");
      fetchConfig();
      return true;
    } catch (error) {
      toast.error("Failed to save connection settings");
      return false;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-purple-500 mx-auto mb-4" />
          <p className="text-slate-500">Loading Odoo Integration...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "connection", label: "Connection", icon: Globe, description: "Configure Odoo credentials" },
    { id: "mappings", label: "Field Mapping", icon: ArrowLeftRight, description: "Map Odoo fields to local" },
    { id: "sync", label: "Sync Data", icon: RefreshCw, description: "Preview & sync records" },
    { id: "logs", label: "History", icon: History, description: "View sync logs" },
  ];

  return (
    <div className="h-full flex flex-col bg-slate-50" data-testid="odoo-integration-hub">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Database className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Odoo Integration Hub</h2>
              <p className="text-purple-100 mt-1">
                Connect your Odoo ERP to sync Contacts, Opportunities & Activities
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {config?.connection?.is_connected ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 backdrop-blur border border-green-400/30 rounded-full">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="font-medium">Connected</span>
                <span className="text-green-200">v{config.connection.odoo_version}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 backdrop-blur border border-amber-400/30 rounded-full">
                <AlertCircle className="w-4 h-4 text-amber-300" />
                <span className="font-medium">Not Connected</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b shadow-sm">
        <div className="flex">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isDisabled = tab.id !== "connection" && !config?.connection?.is_connected;
            
            return (
              <button
                key={tab.id}
                onClick={() => !isDisabled && setActiveTab(tab.id)}
                disabled={isDisabled}
                className={cn(
                  "flex-1 px-6 py-4 text-sm font-medium flex flex-col items-center gap-1 border-b-2 transition-all",
                  isActive
                    ? "border-purple-600 text-purple-600 bg-purple-50/50"
                    : isDisabled
                    ? "border-transparent text-slate-300 cursor-not-allowed"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                )}
                data-testid={`tab-${tab.id}`}
              >
                <Icon className={cn("w-5 h-5", isDisabled && "opacity-40")} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "connection" && (
          <ConnectionTab
            config={config}
            onUpdate={handleUpdateConnection}
            onTest={handleTestConnection}
            testing={testingConnection}
            status={connectionStatus}
          />
        )}
        {activeTab === "mappings" && (
          <FieldMappingsTab config={config} onRefresh={fetchConfig} />
        )}
        {activeTab === "sync" && (
          <SyncTab config={config} onRefresh={fetchConfig} />
        )}
        {activeTab === "logs" && (
          <SyncLogsTab />
        )}
      </div>
    </div>
  );
};

// ===================== CONNECTION TAB =====================

const ConnectionTab = ({ config, onUpdate, onTest, testing, status }) => {
  const [formData, setFormData] = useState({
    url: config?.connection?.url || "",
    database: config?.connection?.database || "",
    username: config?.connection?.username || "",
    api_key: "",
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);

  // Normalize URL (remove trailing /odoo or /web if present)
  const normalizeUrl = (url) => {
    let normalized = url.trim();
    normalized = normalized.replace(/\/(odoo|web|jsonrpc)\/?$/i, "");
    normalized = normalized.replace(/\/+$/, "");
    return normalized;
  };

  const handleSave = async () => {
    if (!formData.url || !formData.database || !formData.username) {
      toast.error("Please fill in URL, Database, and Username");
      return;
    }
    
    setSaving(true);
    const normalizedData = {
      ...formData,
      url: normalizeUrl(formData.url),
    };
    
    // Only include api_key if user entered a new one
    if (!formData.api_key && config?.connection?.api_key) {
      delete normalizedData.api_key;
    }
    
    const success = await onUpdate(normalizedData);
    setSaving(false);
    
    if (success) {
      // Auto-test after saving
      onTest();
    }
  };

  const handleQuickFill = () => {
    // Pre-fill with the provided credentials
    setFormData({
      url: "https://securadotest.odoo.com",
      database: "securadotest",
      username: "krishna@securado.net",
      api_key: "",
    });
    toast.info("Credentials pre-filled. Enter your API key to connect.");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Connection Form */}
      <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-600" />
              Odoo Connection Settings
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Connect to Odoo 17, 18, or 19 using secure JSON-RPC API
            </p>
          </div>
          {!config?.connection?.is_connected && (
            <button
              onClick={handleQuickFill}
              className="text-xs bg-purple-50 text-purple-600 px-3 py-1.5 rounded-full hover:bg-purple-100 transition flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              Quick Fill Demo
            </button>
          )}
        </div>

        <div className="grid gap-5">
          {/* URL Field */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Globe className="w-4 h-4 text-slate-400" />
              Odoo Instance URL
            </label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              className="input w-full"
              placeholder="https://your-company.odoo.com"
              data-testid="odoo-url-input"
            />
            <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Your Odoo cloud or self-hosted instance URL
            </p>
          </div>

          {/* Database Field */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Server className="w-4 h-4 text-slate-400" />
              Database Name
            </label>
            <input
              type="text"
              value={formData.database}
              onChange={(e) => setFormData({ ...formData, database: e.target.value })}
              className="input w-full"
              placeholder="your_database_name"
              data-testid="odoo-database-input"
            />
            <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Usually visible in your Odoo URL or Settings
            </p>
          </div>

          {/* Username Field */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <User className="w-4 h-4 text-slate-400" />
              Username (Email)
            </label>
            <input
              type="email"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="input w-full"
              placeholder="admin@your-company.com"
              data-testid="odoo-username-input"
            />
          </div>

          {/* API Key Field */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Key className="w-4 h-4 text-slate-400" />
              API Key
              {config?.connection?.api_key && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  Saved
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={formData.api_key}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                className="input w-full pr-20"
                placeholder={config?.connection?.api_key ? "••••••••••••" : "Enter your Odoo API key"}
                data-testid="odoo-apikey-input"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                {showApiKey ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        </div>

        {/* Connection Status */}
        {status && (
          <div className={cn(
            "p-4 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2",
            status.success 
              ? "bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200" 
              : "bg-gradient-to-r from-red-50 to-rose-50 border border-red-200"
          )}>
            {status.success ? (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className={cn("font-semibold", status.success ? "text-green-800" : "text-red-800")}>
                {status.success ? "Connection Successful!" : "Connection Failed"}
              </p>
              <p className={cn("text-sm mt-0.5", status.success ? "text-green-600" : "text-red-600")}>
                {status.message}
              </p>
              {status.version && (
                <p className="text-sm text-green-600 mt-1">
                  Odoo Version: {status.version}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving || testing}
            className="btn-primary flex-1 flex items-center justify-center gap-2 py-3"
            data-testid="save-connection-btn"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save & Connect
          </button>
          <button
            onClick={onTest}
            disabled={testing || saving}
            className="btn-secondary flex items-center gap-2 px-6"
            data-testid="test-connection-btn"
          >
            {testing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <TestTube className="w-4 h-4" />
            )}
            Test
          </button>
        </div>
      </div>

      {/* Help Card */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5">
        <h4 className="font-semibold text-blue-900 flex items-center gap-2 mb-3">
          <Key className="w-4 h-4" />
          How to Get Your Odoo API Key
        </h4>
        <ol className="text-sm text-blue-700 space-y-2">
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
            Log in to your Odoo instance as Administrator
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
            Go to <strong>Settings → Users & Companies → Users</strong>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
            Select your user account
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
            Click <strong>"Account Security"</strong> tab → <strong>"New API Key"</strong>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">5</span>
            Copy the generated key and paste it above
          </li>
        </ol>
        <a 
          href="https://www.odoo.com/documentation/17.0/developer/reference/external_api.html" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mt-3"
        >
          <ExternalLink className="w-3 h-3" />
          Odoo API Documentation
        </a>
      </div>

      {/* Connected Info */}
      {config?.connection?.is_connected && config?.connection?.last_connected_at && (
        <div className="bg-white rounded-xl border p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-slate-900">Last Connected</p>
              <p className="text-sm text-slate-500">
                {new Date(config.connection.last_connected_at).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500">Odoo Version</p>
            <p className="font-semibold text-slate-900">{config.connection.odoo_version}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ===================== FIELD MAPPINGS TAB =====================

const FieldMappingsTab = ({ config, onRefresh }) => {
  const [selectedMapping, setSelectedMapping] = useState(null);
  const [mappings, setMappings] = useState(config?.entity_mappings || []);
  const [odooFields, setOdooFields] = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);

  const entityIcons = {
    "res.partner": Building2,
    "crm.lead": Zap,
    "mail.activity": Calendar,
  };

  const entityColors = {
    "res.partner": "purple",
    "crm.lead": "blue",
    "mail.activity": "amber",
  };

  const fetchOdooFields = async (model) => {
    setLoadingFields(true);
    try {
      const response = await api.get(`/odoo/fields/${model}`);
      setOdooFields(response.data.dynamic_fields.length > 0 
        ? response.data.dynamic_fields 
        : response.data.static_fields
      );
    } catch (error) {
      toast.error("Failed to fetch Odoo fields");
    } finally {
      setLoadingFields(false);
    }
  };

  const handleSelectMapping = (mapping) => {
    setSelectedMapping(mapping);
    fetchOdooFields(mapping.odoo_model);
  };

  const handleSaveFieldMappings = async (mappingId, fieldMappings) => {
    try {
      await api.put(`/odoo/mappings/${mappingId}/fields`, fieldMappings);
      toast.success("Field mappings saved successfully!");
      onRefresh();
    } catch (error) {
      toast.error("Failed to save field mappings");
    }
  };

  return (
    <div className="flex gap-6 h-full min-h-[600px]">
      {/* Entity List */}
      <div className="w-80 flex-shrink-0">
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="p-4 border-b bg-gradient-to-r from-slate-50 to-slate-100">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-500" />
              Entity Mappings
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Select an entity to configure field mappings
            </p>
          </div>
          <div className="divide-y">
            {mappings.map((mapping) => {
              const Icon = entityIcons[mapping.odoo_model] || Database;
              const color = entityColors[mapping.odoo_model] || "slate";
              
              return (
                <button
                  key={mapping.id}
                  onClick={() => handleSelectMapping(mapping)}
                  className={cn(
                    "w-full p-4 text-left hover:bg-slate-50 transition-all",
                    selectedMapping?.id === mapping.id && `bg-${color}-50 border-l-4 border-${color}-500`
                  )}
                  data-testid={`mapping-${mapping.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center",
                      mapping.sync_enabled 
                        ? `bg-${color}-100` 
                        : "bg-slate-100"
                    )}>
                      <Icon className={cn(
                        "w-5 h-5", 
                        mapping.sync_enabled 
                          ? `text-${color}-600` 
                          : "text-slate-400"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900">{mapping.name}</p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {mapping.odoo_model} → {mapping.local_collection}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full font-medium",
                          mapping.sync_enabled 
                            ? "bg-green-100 text-green-700" 
                            : "bg-slate-100 text-slate-500"
                        )}>
                          {mapping.sync_enabled ? "Active" : "Disabled"}
                        </span>
                        <span className="text-xs text-slate-400">
                          {mapping.field_mappings?.length || 0} fields
                        </span>
                      </div>
                    </div>
                    <ChevronRight className={cn(
                      "w-5 h-5 text-slate-300 transition-transform",
                      selectedMapping?.id === mapping.id && "rotate-90 text-slate-500"
                    )} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Field Mapper */}
      <div className="flex-1">
        {selectedMapping ? (
          <VisualFieldMapper
            mapping={selectedMapping}
            odooFields={odooFields}
            loadingFields={loadingFields}
            onSave={handleSaveFieldMappings}
          />
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border p-12 text-center h-full flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <ArrowLeftRight className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700">Select an Entity</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-xs">
              Choose an entity from the left panel to configure how Odoo fields map to your local database
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ===================== VISUAL FIELD MAPPER (XSOAR-Style) =====================

const VisualFieldMapper = ({ mapping, odooFields, loadingFields, onSave }) => {
  const [fieldMappings, setFieldMappings] = useState(mapping.field_mappings || []);
  const [searchOdoo, setSearchOdoo] = useState("");
  const [searchLocal, setSearchLocal] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiMapping, setAiMapping] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [showAiConfirmModal, setShowAiConfirmModal] = useState(false);
  const [pendingAiMappings, setPendingAiMappings] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);

  // Update field mappings when mapping changes
  useEffect(() => {
    setFieldMappings(mapping.field_mappings || []);
  }, [mapping.id, mapping.field_mappings]);

  const localFieldTypes = [
    { id: "text", label: "Text" },
    { id: "email", label: "Email" },
    { id: "phone", label: "Phone" },
    { id: "url", label: "URL" },
    { id: "number", label: "Number" },
    { id: "currency", label: "Currency" },
    { id: "percentage", label: "Percentage" },
    { id: "date", label: "Date" },
    { id: "textarea", label: "Text Area" },
    { id: "dropdown", label: "Dropdown" },
    { id: "relationship", label: "Relationship" },
  ];

  const filteredOdooFields = odooFields.filter(f => 
    f.name.toLowerCase().includes(searchOdoo.toLowerCase()) ||
    f.label?.toLowerCase().includes(searchOdoo.toLowerCase())
  );

  const handleToggleMapping = (fieldId, enabled) => {
    setFieldMappings(fieldMappings.map(m => 
      m.id === fieldId ? { ...m, enabled } : m
    ));
  };

  const handleAddMapping = (newMapping) => {
    setFieldMappings([...fieldMappings, {
      id: `custom_${Date.now()}`,
      ...newMapping,
      enabled: true,
      is_system: false,
    }]);
    setShowAddModal(false);
    toast.success("Field mapping added");
  };

  const handleRemoveMapping = (fieldId) => {
    const mappingToRemove = fieldMappings.find(m => m.id === fieldId);
    if (mappingToRemove?.is_system) {
      toast.error("Cannot remove system mappings");
      return;
    }
    setFieldMappings(fieldMappings.filter(m => m.id !== fieldId));
    toast.success("Field mapping removed");
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(mapping.id, fieldMappings);
    setSaving(false);
  };

  // AI Auto-Mapping - Get suggestions first
  const handleAiAutoMap = async () => {
    setAiMapping(true);
    setAiSuggestions(null);
    
    try {
      // Prepare source fields from Odoo fields
      const sourceFields = odooFields.map(f => ({
        name: f.name,
        type: f.type || "string",
        sample_value: f.sample_value || null,
        description: f.label || null
      }));

      // Get entity type from mapping
      let entityType = "contacts";
      if (mapping.local_collection?.includes("account")) entityType = "accounts";
      else if (mapping.local_collection?.includes("opportunit")) entityType = "opportunities";
      else if (mapping.local_collection?.includes("activit")) entityType = "activities";

      const response = await api.post("/ai-mapping/suggest", {
        source_name: "Odoo",
        entity_type: entityType,
        source_fields: sourceFields
      });

      setAiSuggestions(response.data);
      
      // Show confirmation modal instead of applying directly
      if (response.data.suggestions?.length > 0) {
        setPendingAiMappings(response.data.suggestions);
        setShowAiConfirmModal(true);
      } else {
        toast.info("No mapping suggestions found");
      }
    } catch (error) {
      console.error("AI mapping error:", error);
      toast.error("AI mapping failed. Please try again.");
    } finally {
      setAiMapping(false);
    }
  };

  // Apply confirmed AI mappings
  const handleConfirmAiMappings = (selectedMappings) => {
    const updatedMappings = [...fieldMappings];
    
    selectedMappings.forEach(suggestion => {
      const existingIdx = updatedMappings.findIndex(
        m => m.odoo_field === suggestion.source_field || m.source_field === suggestion.source_field
      );
      
      if (existingIdx >= 0) {
        updatedMappings[existingIdx] = {
          ...updatedMappings[existingIdx],
          local_field: suggestion.target_field,
          enabled: true,
          ai_confidence: suggestion.confidence,
          ai_reasoning: suggestion.reasoning
        };
      } else {
        updatedMappings.push({
          id: `ai_${Date.now()}_${suggestion.source_field}`,
          odoo_field: suggestion.source_field,
          local_field: suggestion.target_field,
          enabled: true,
          is_system: false,
          ai_confidence: suggestion.confidence,
          ai_reasoning: suggestion.reasoning
        });
      }
    });
    
    setFieldMappings(updatedMappings);
    setShowAiConfirmModal(false);
    setPendingAiMappings([]);
    toast.success(`Applied ${selectedMappings.length} AI-suggested mappings!`);
  };

  const enabledCount = fieldMappings.filter(m => m.enabled).length;

  return (
    <div className={cn(
      "bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col transition-all duration-300",
      isExpanded ? "fixed inset-4 z-50" : "h-full"
    )}>
      {/* Backdrop for expanded mode */}
      {isExpanded && (
        <div 
          className="fixed inset-0 bg-black/50 -z-10" 
          onClick={() => setIsExpanded(false)}
        />
      )}
      
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-slate-50 to-slate-100 flex items-center justify-between flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-purple-600 flex-shrink-0" />
            <span className="truncate">{mapping.name} - Field Mapping</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {mapping.odoo_model} → {mapping.local_collection} • {enabledCount} active mappings
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleAiAutoMap}
            disabled={aiMapping || loadingFields}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 transition-all"
            data-testid="ai-auto-map-btn"
          >
            {aiMapping ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">AI Auto-Map</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-secondary text-sm flex items-center gap-1 px-3 py-1.5"
          >
            <Link2 className="w-4 h-4" />
            <span className="hidden sm:inline">Add</span>
          </button>
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="btn-primary text-sm flex items-center gap-1 px-3 py-1.5"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span className="hidden sm:inline">Save</span>
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? (
              <X className="w-5 h-5 text-slate-600" />
            ) : (
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* AI Confirmation Modal */}
      {showAiConfirmModal && (
        <AiMappingConfirmModal
          suggestions={pendingAiMappings}
          onConfirm={handleConfirmAiMappings}
          onCancel={() => {
            setShowAiConfirmModal(false);
            setPendingAiMappings([]);
          }}
        />
      )}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {mapping.odoo_model} → {mapping.local_collection} • {enabledCount} active mappings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAiAutoMap}
            disabled={aiMapping || loadingFields}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 transition-all"
            data-testid="ai-auto-map-btn"
          >
            {aiMapping ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            AI Auto-Map
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-secondary text-sm flex items-center gap-1.5"
          >
            <Link2 className="w-4 h-4" /> Add Mapping
          </button>
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Mappings
          </button>
        </div>
      </div>

      {/* Three-Panel Mapper */}
      <div className="flex-1 overflow-hidden flex">
        {/* Odoo Fields (Source) - Left Panel */}
        <div className="w-1/3 border-r flex flex-col bg-purple-50/30">
          <div className="p-3 border-b bg-purple-100/50">
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-4 h-4 text-purple-600" />
              <span className="font-medium text-purple-900 text-sm">Odoo Fields</span>
              <span className="text-xs bg-purple-200 text-purple-800 px-1.5 py-0.5 rounded-full">
                {filteredOdooFields.length}
              </span>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchOdoo}
                onChange={(e) => setSearchOdoo(e.target.value)}
                className="input w-full pl-9 text-sm py-2"
                placeholder="Search Odoo fields..."
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {loadingFields ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
              </div>
            ) : (
              <div className="space-y-1">
                {filteredOdooFields.map((field) => {
                  const isMapped = fieldMappings.some(m => m.source_field === field.name && m.enabled);
                  return (
                    <div
                      key={field.name}
                      className={cn(
                        "p-2.5 rounded-lg text-sm transition-all",
                        isMapped 
                          ? "bg-green-100 border border-green-300" 
                          : "bg-white hover:bg-slate-50 border border-slate-200"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-700 truncate">
                          {field.label || field.name}
                        </span>
                        {isMapped && <Check className="w-4 h-4 text-green-600 flex-shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {field.name}
                        </code>
                        <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                          {field.type}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Mapping Lines (Center Panel) */}
        <div className="w-1/3 border-r flex flex-col bg-slate-50">
          <div className="p-3 border-b">
            <div className="flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-slate-500" />
              <span className="font-medium text-slate-700 text-sm">Active Mappings</span>
              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                {enabledCount}
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <div className="space-y-2">
              {fieldMappings.map((fm) => (
                <div
                  key={fm.id}
                  className={cn(
                    "p-3 rounded-lg border transition-all",
                    fm.enabled 
                      ? "bg-white border-slate-200 shadow-sm" 
                      : "bg-slate-100 border-dashed border-slate-300 opacity-60"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleMapping(fm.id, !fm.enabled)}
                        className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                          fm.enabled 
                            ? "bg-green-500 border-green-500" 
                            : "bg-white border-slate-300 hover:border-slate-400"
                        )}
                      >
                        {fm.enabled && <Check className="w-3 h-3 text-white" />}
                      </button>
                      {fm.is_key_field && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                          KEY
                        </span>
                      )}
                      {fm.is_required && (
                        <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">
                          REQ
                        </span>
                      )}
                    </div>
                    {!fm.is_system && (
                      <button
                        onClick={() => handleRemoveMapping(fm.id)}
                        className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-purple-700 bg-purple-50 px-2 py-1 rounded truncate max-w-[90px]" title={fm.source_field}>
                      {fm.source_field}
                    </span>
                    <ArrowRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <span className="font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded truncate max-w-[90px]" title={fm.target_field}>
                      {fm.target_field}
                    </span>
                  </div>
                  {fm.transform_type && fm.transform_type !== "direct" && (
                    <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      Transform: {fm.transform_type}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Local Fields (Target) - Right Panel */}
        <div className="w-1/3 flex flex-col bg-blue-50/30">
          <div className="p-3 border-b bg-blue-100/50">
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-blue-900 text-sm">Local Fields</span>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchLocal}
                onChange={(e) => setSearchLocal(e.target.value)}
                className="input w-full pl-9 text-sm py-2"
                placeholder="Search local fields..."
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <div className="space-y-1">
              {fieldMappings
                .filter(m => m.target_field.toLowerCase().includes(searchLocal.toLowerCase()))
                .map((fm) => (
                  <div
                    key={fm.id}
                    className={cn(
                      "p-2.5 rounded-lg text-sm border transition-all",
                      fm.enabled 
                        ? "bg-green-100 border-green-300" 
                        : "bg-white border-slate-200 opacity-60"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-700">{fm.target_field}</span>
                      {fm.enabled && <Check className="w-4 h-4 text-green-600" />}
                    </div>
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded mt-1 inline-block">
                      {fm.target_field_type}
                    </span>
                  </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Add Mapping Modal */}
      {showAddModal && (
        <AddMappingModal
          odooFields={odooFields}
          localFieldTypes={localFieldTypes}
          onAdd={handleAddMapping}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
};

// ===================== ADD MAPPING MODAL =====================

const AddMappingModal = ({ odooFields, localFieldTypes, onAdd, onClose }) => {
  const [formData, setFormData] = useState({
    source_field: "",
    source_field_type: "char",
    target_field: "",
    target_field_type: "text",
    transform_type: "direct",
    is_required: false,
    is_key_field: false,
  });

  const handleSubmit = () => {
    if (!formData.source_field || !formData.target_field) {
      toast.error("Please fill in source and target fields");
      return;
    }
    onAdd(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in">
      <div className="bg-white rounded-2xl w-full max-w-md m-4 shadow-2xl animate-in zoom-in-95">
        <div className="p-5 border-b">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-purple-600" />
            Add Field Mapping
          </h3>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Source Field (Odoo)</label>
            <select
              value={formData.source_field}
              onChange={(e) => {
                const field = odooFields.find(f => f.name === e.target.value);
                setFormData({ 
                  ...formData, 
                  source_field: e.target.value,
                  source_field_type: field?.type || "char"
                });
              }}
              className="input w-full mt-1.5"
            >
              <option value="">Select Odoo field...</option>
              {odooFields.map(f => (
                <option key={f.name} value={f.name}>
                  {f.label || f.name} ({f.type})
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="text-sm font-medium text-slate-700">Target Field (Local)</label>
            <input
              type="text"
              value={formData.target_field}
              onChange={(e) => setFormData({ ...formData, target_field: e.target.value })}
              className="input w-full mt-1.5"
              placeholder="e.g., company_name"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium text-slate-700">Target Field Type</label>
            <select
              value={formData.target_field_type}
              onChange={(e) => setFormData({ ...formData, target_field_type: e.target.value })}
              className="input w-full mt-1.5"
            >
              {localFieldTypes.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="text-sm font-medium text-slate-700">Transform Type</label>
            <select
              value={formData.transform_type}
              onChange={(e) => setFormData({ ...formData, transform_type: e.target.value })}
              className="input w-full mt-1.5"
            >
              <option value="direct">Direct Copy</option>
              <option value="lookup">Lookup (Many2One)</option>
              <option value="format">Format (HTML Strip, etc.)</option>
              <option value="default">Default Value</option>
            </select>
          </div>
          
          <div className="flex gap-4 pt-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_required}
                onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              Required Field
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_key_field}
                onChange={(e) => setFormData({ ...formData, is_key_field: e.target.checked })}
                className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              Key Field
            </label>
          </div>
        </div>
        <div className="p-5 border-t bg-slate-50 rounded-b-2xl flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} className="btn-primary">Add Mapping</button>
        </div>
      </div>
    </div>
  );
};

// ===================== SYNC TAB =====================

const SyncTab = ({ config, onRefresh }) => {
  const [syncing, setSyncing] = useState({});
  const [previewing, setPreviewing] = useState({});
  const [previewData, setPreviewData] = useState({});

  const handleSync = async (mappingId) => {
    setSyncing({ ...syncing, [mappingId]: true });
    try {
      const response = await api.post(`/odoo/sync/${mappingId}`);
      const result = response.data;
      toast.success(
        `Sync complete: ${result.created} created, ${result.updated} updated` +
        (result.failed > 0 ? `, ${result.failed} failed` : "")
      );
      onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Sync failed");
    } finally {
      setSyncing({ ...syncing, [mappingId]: false });
    }
  };

  const handleSyncAll = async () => {
    setSyncing({ all: true });
    try {
      const response = await api.post("/odoo/sync-all");
      const results = response.data.results;
      const totalCreated = results.reduce((sum, r) => sum + r.created, 0);
      const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);
      toast.success(`Full sync complete: ${totalCreated} created, ${totalUpdated} updated`);
      onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Sync failed");
    } finally {
      setSyncing({ all: false });
    }
  };

  const handlePreview = async (mappingId) => {
    setPreviewing({ ...previewing, [mappingId]: true });
    try {
      const response = await api.get(`/odoo/preview/${mappingId}?limit=3`);
      setPreviewData({ ...previewData, [mappingId]: response.data });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Preview failed");
    } finally {
      setPreviewing({ ...previewing, [mappingId]: false });
    }
  };

  const mappings = config?.entity_mappings || [];
  const entityIcons = {
    "res.partner": Building2,
    "crm.lead": Zap,
    "mail.activity": Calendar,
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Sync All Card */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Full Synchronization
            </h3>
            <p className="text-purple-100 mt-1">
              Sync all enabled entities from Odoo to your local database
            </p>
          </div>
          <button
            onClick={handleSyncAll}
            disabled={syncing.all || !config?.connection?.is_connected}
            className="bg-white text-purple-600 hover:bg-purple-50 px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncing.all ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Play className="w-5 h-5" />
            )}
            Sync All Now
          </button>
        </div>
      </div>

      {/* Individual Entity Sync Cards */}
      {mappings.map((mapping) => {
        const Icon = entityIcons[mapping.odoo_model] || Database;
        const preview = previewData[mapping.id];
        
        return (
          <div key={mapping.id} className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center",
                  mapping.sync_enabled ? "bg-purple-100" : "bg-slate-100"
                )}>
                  <Icon className={cn(
                    "w-6 h-6",
                    mapping.sync_enabled ? "text-purple-600" : "text-slate-400"
                  )} />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">{mapping.name}</h4>
                  <p className="text-sm text-slate-500">
                    {mapping.odoo_model} → {mapping.local_collection}
                  </p>
                  {mapping.last_sync_at && (
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      Last sync: {new Date(mapping.last_sync_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handlePreview(mapping.id)}
                  disabled={previewing[mapping.id] || !config?.connection?.is_connected}
                  className="btn-secondary flex items-center gap-2"
                >
                  {previewing[mapping.id] ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                  Preview
                </button>
                <button
                  onClick={() => handleSync(mapping.id)}
                  disabled={syncing[mapping.id] || !mapping.sync_enabled || !config?.connection?.is_connected}
                  className="btn-primary flex items-center gap-2"
                >
                  {syncing[mapping.id] ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Sync Now
                </button>
              </div>
            </div>

            {/* Preview Data */}
            {preview && (
              <div className="border-t bg-slate-50 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-slate-500" />
                    <span className="font-medium text-slate-700">
                      Preview Data
                    </span>
                    <span className="text-sm text-slate-500">
                      ({preview.total_in_odoo} total records in Odoo)
                    </span>
                  </div>
                  <button 
                    onClick={() => setPreviewData({ ...previewData, [mapping.id]: null })} 
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  {preview.preview?.map((item, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-xl border">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-semibold text-purple-700 mb-2 flex items-center gap-1">
                            <Database className="w-3 h-3" />
                            Odoo Data
                          </p>
                          <pre className="text-xs text-slate-600 bg-purple-50 p-2 rounded overflow-x-auto max-h-32">
                            {JSON.stringify(item.odoo, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1">
                            <ArrowRight className="w-3 h-3" />
                            Mapped Data
                          </p>
                          <pre className="text-xs text-slate-600 bg-blue-50 p-2 rounded overflow-x-auto max-h-32">
                            {JSON.stringify(item.mapped, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ===================== SYNC LOGS TAB =====================

const SyncLogsTab = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await api.get("/odoo/sync-logs?limit=50");
      setLogs(response.data);
    } catch (error) {
      toast.error("Failed to load sync logs");
    } finally {
      setLoading(false);
    }
  };

  const statusConfig = {
    success: { icon: CheckCircle, color: "green", label: "Success" },
    failed: { icon: XCircle, color: "red", label: "Failed" },
    partial: { icon: AlertCircle, color: "amber", label: "Partial" },
    running: { icon: Loader2, color: "blue", label: "Running" },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            Sync History
          </h3>
          <button 
            onClick={fetchLogs} 
            className="btn-secondary text-sm flex items-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
        <div className="divide-y">
          {logs.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <History className="w-8 h-8 text-slate-300" />
              </div>
              <h4 className="font-medium text-slate-700">No Sync History</h4>
              <p className="text-sm text-slate-500 mt-1">
                Sync logs will appear here after you run your first sync
              </p>
            </div>
          ) : (
            logs.map((log) => {
              const status = statusConfig[log.status] || statusConfig.running;
              const StatusIcon = status.icon;
              
              return (
                <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center",
                        `bg-${status.color}-100`
                      )}>
                        <StatusIcon className={cn(
                          "w-5 h-5",
                          `text-${status.color}-600`,
                          log.status === "running" && "animate-spin"
                        )} />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          {log.entity_mapping_id}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(log.started_at).toLocaleString()}
                          {log.completed_at && (
                            <span className="ml-2">
                              Duration: {Math.round((new Date(log.completed_at) - new Date(log.started_at)) / 1000)}s
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-green-600 font-medium">
                          +{log.records_created}
                        </span>
                        <span className="text-blue-600 font-medium">
                          ~{log.records_updated}
                        </span>
                        {log.records_failed > 0 && (
                          <span className="text-red-600 font-medium">
                            !{log.records_failed}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {log.records_processed} processed
                      </p>
                    </div>
                  </div>
                  {log.errors?.length > 0 && (
                    <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                      <p className="text-xs font-medium text-red-700 mb-1">Errors:</p>
                      {log.errors.slice(0, 3).map((err, idx) => (
                        <p key={idx} className="text-xs text-red-600">
                          {err.error || JSON.stringify(err)}
                        </p>
                      ))}
                      {log.errors.length > 3 && (
                        <p className="text-xs text-red-500 mt-1">
                          +{log.errors.length - 3} more errors
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default OdooIntegrationHub;
