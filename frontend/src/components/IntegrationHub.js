import React, { useState, useEffect, useCallback } from "react";
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
  Layers,
  FileText,
  BarChart3,
  Cloud,
  Settings,
  Filter,
  GitMerge,
  Upload,
} from "lucide-react";

// ===================== MAIN INTEGRATION HUB =====================

const IntegrationHub = () => {
  const [loading, setLoading] = useState(true);
  const [activeIntegration, setActiveIntegration] = useState("odoo");
  const [activeTab, setActiveTab] = useState("connection");
  const [integrations, setIntegrations] = useState({
    odoo: { connected: false, config: null, lastSync: null },
    salesforce: { connected: false, config: null, lastSync: null },
    hubspot: { connected: false, config: null, lastSync: null },
    ms365: { connected: false, config: null, lastSync: null },
  });
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [dataLakeStats, setDataLakeStats] = useState({
    raw: { records: 0, collections: [] },
    canonical: { records: 0 },
    serving: { aggregates: 0 },
  });

  // Integration metadata
  const integrationMeta = {
    odoo: {
      name: "Odoo ERP",
      icon: "🟣",
      color: "purple",
      description: "Connect your Odoo ERP to sync Contacts, Opportunities & Activities",
      gradient: "from-purple-600 to-indigo-600",
    },
    salesforce: {
      name: "Salesforce",
      icon: "☁️",
      color: "blue",
      description: "Connect Salesforce CRM to sync Accounts, Contacts & Opportunities",
      gradient: "from-blue-600 to-cyan-600",
    },
    hubspot: {
      name: "HubSpot",
      icon: "🟠",
      color: "orange",
      description: "Connect HubSpot for Marketing & Sales data synchronization",
      gradient: "from-orange-500 to-amber-500",
    },
    ms365: {
      name: "Microsoft 365",
      icon: "🔷",
      color: "cyan",
      description: "Enable SSO and Calendar sync with Microsoft 365",
      gradient: "from-cyan-600 to-blue-600",
    },
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Odoo config
      try {
        const odooRes = await api.get("/odoo/config");
        setIntegrations(prev => ({
          ...prev,
          odoo: {
            connected: odooRes.data.connection?.is_connected || false,
            config: odooRes.data,
            lastSync: odooRes.data.connection?.last_connected_at,
            version: odooRes.data.connection?.odoo_version,
          },
        }));
        if (odooRes.data.connection?.is_connected) {
          setConnectionStatus({
            success: true,
            message: `Connected to Odoo ${odooRes.data.connection.odoo_version}`,
          });
        }
      } catch (e) {
        console.log("Odoo config not available");
      }

      // Fetch sync status
      try {
        const syncRes = await api.get("/sync/status");
        Object.entries(syncRes.data.sources || {}).forEach(([source, status]) => {
          setIntegrations(prev => ({
            ...prev,
            [source]: {
              ...prev[source],
              connected: status.connected || prev[source]?.connected,
              lastSync: status.last_sync || prev[source]?.lastSync,
            },
          }));
        });
      } catch (e) {
        console.log("Sync status not available");
      }

      // Fetch data lake stats
      try {
        const statsRes = await api.get("/data-lake/stats");
        const rawTotal = statsRes.data.raw_zone?.total_records || 0;
        const canonicalTotal = Object.values(statsRes.data.canonical_zone || {}).reduce(
          (a, b) => a + (typeof b === "number" ? b : 0),
          0
        );
        const servingTotal = Object.values(statsRes.data.serving_zone || {}).reduce(
          (a, b) => a + (typeof b === "number" ? b : 0),
          0
        );
        setDataLakeStats({
          raw: { records: rawTotal, collections: statsRes.data.raw_zone?.collections || [] },
          canonical: { records: canonicalTotal, ...statsRes.data.canonical_zone },
          serving: { aggregates: servingTotal, ...statsRes.data.serving_zone },
        });
      } catch (e) {
        console.log("Data lake stats not available");
      }
    } catch (error) {
      console.error("Failed to fetch integration data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const response = await api.post(`/${activeIntegration}/test-connection`);
      setConnectionStatus(response.data);
      if (response.data.success) {
        toast.success("Connection successful!");
        fetchData();
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      setConnectionStatus({
        success: false,
        message: error.response?.data?.detail || "Connection failed",
      });
      toast.error("Connection test failed");
    } finally {
      setTestingConnection(false);
    }
  };

  const handleUpdateConnection = async (connectionData) => {
    try {
      await api.put(`/${activeIntegration}/config/connection`, connectionData);
      toast.success("Connection settings saved");
      fetchData();
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
          <p className="text-slate-500">Loading Integration Hub...</p>
        </div>
      </div>
    );
  }

  const currentMeta = integrationMeta[activeIntegration];
  const currentIntegration = integrations[activeIntegration];

  const tabs = [
    { id: "connection", label: "Connection", icon: Globe, description: "Configure credentials" },
    { id: "mappings", label: "Field Mapping", icon: ArrowLeftRight, description: "Map source fields" },
    { id: "sync", label: "Sync Data", icon: RefreshCw, description: "Preview & sync" },
    { id: "datalake", label: "Data Lake", icon: Layers, description: "View data zones" },
    { id: "logs", label: "History", icon: History, description: "View sync logs" },
  ];

  return (
    <div className="h-full flex flex-col bg-slate-50" data-testid="integration-hub">
      {/* Integration Selector */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-slate-500">Integration:</span>
          <div className="flex gap-2">
            {Object.entries(integrationMeta).map(([key, meta]) => {
              const isActive = activeIntegration === key;
              const isConnected = integrations[key]?.connected;
              return (
                <button
                  key={key}
                  onClick={() => {
                    setActiveIntegration(key);
                    setConnectionStatus(null);
                  }}
                  className={cn(
                    "px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all",
                    isActive
                      ? `bg-${meta.color}-100 text-${meta.color}-700 ring-2 ring-${meta.color}-500`
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                  data-testid={`integration-tab-${key}`}
                >
                  <span className="text-lg">{meta.icon}</span>
                  {meta.name}
                  {isConnected && (
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Header */}
      <div className={cn("bg-gradient-to-r text-white p-6", currentMeta.gradient)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <span className="text-3xl">{currentMeta.icon}</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold">{currentMeta.name} Integration</h2>
              <p className="text-white/80 mt-1">{currentMeta.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {currentIntegration?.connected ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 backdrop-blur border border-green-400/30 rounded-full">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="font-medium">Connected</span>
                {currentIntegration.version && (
                  <span className="text-green-200">v{currentIntegration.version}</span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 backdrop-blur border border-amber-400/30 rounded-full">
                <AlertCircle className="w-4 h-4 text-amber-300" />
                <span className="font-medium">Not Connected</span>
              </div>
            )}
            <button
              onClick={fetchData}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              data-testid="refresh-btn"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b shadow-sm">
        <div className="flex">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isDisabled = tab.id !== "connection" && tab.id !== "datalake" && !currentIntegration?.connected;

            return (
              <button
                key={tab.id}
                onClick={() => !isDisabled && setActiveTab(tab.id)}
                disabled={isDisabled}
                className={cn(
                  "flex-1 px-6 py-4 text-sm font-medium flex flex-col items-center gap-1 border-b-2 transition-all",
                  isActive
                    ? `border-${currentMeta.color}-600 text-${currentMeta.color}-600 bg-${currentMeta.color}-50/50`
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
            integration={activeIntegration}
            config={currentIntegration?.config}
            onUpdate={handleUpdateConnection}
            onTest={handleTestConnection}
            testing={testingConnection}
            status={connectionStatus}
            meta={currentMeta}
          />
        )}
        {activeTab === "mappings" && (
          <FieldMappingsTab
            integration={activeIntegration}
            config={currentIntegration?.config}
            onRefresh={fetchData}
            meta={currentMeta}
          />
        )}
        {activeTab === "sync" && (
          <SyncTab
            integration={activeIntegration}
            config={currentIntegration?.config}
            onRefresh={fetchData}
            meta={currentMeta}
          />
        )}
        {activeTab === "datalake" && (
          <DataLakeTab stats={dataLakeStats} onRefresh={fetchData} />
        )}
        {activeTab === "logs" && (
          <SyncLogsTab integration={activeIntegration} />
        )}
      </div>
    </div>
  );
};

// ===================== CONNECTION TAB =====================

const ConnectionTab = ({ integration, config, onUpdate, onTest, testing, status, meta }) => {
  const getDefaultFormData = () => {
    if (integration === "odoo") {
      return {
        url: config?.connection?.url || "",
        database: config?.connection?.database || "",
        username: config?.connection?.username || "",
        api_key: "",
      };
    } else if (integration === "salesforce") {
      return {
        instance_url: "",
        access_token: "",
        api_version: "v58.0",
      };
    } else if (integration === "hubspot") {
      return {
        api_key: "",
        portal_id: "",
      };
    } else if (integration === "ms365") {
      return {
        tenant_id: "",
        client_id: "",
        client_secret: "",
      };
    }
    return {};
  };

  const [formData, setFormData] = useState(getDefaultFormData());
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFormData(getDefaultFormData());
  }, [integration, config]);

  const handleSave = async () => {
    setSaving(true);
    const success = await onUpdate(formData);
    setSaving(false);
    if (success) {
      onTest();
    }
  };

  const getFields = () => {
    if (integration === "odoo") {
      return [
        { key: "url", label: "Odoo Instance URL", icon: Globe, placeholder: "https://your-company.odoo.com" },
        { key: "database", label: "Database Name", icon: Server, placeholder: "your_database_name" },
        { key: "username", label: "Username (Email)", icon: User, placeholder: "admin@your-company.com", type: "email" },
        { key: "api_key", label: "API Key", icon: Key, placeholder: "Enter your Odoo API key", type: "password" },
      ];
    } else if (integration === "salesforce") {
      return [
        { key: "instance_url", label: "Instance URL", icon: Globe, placeholder: "https://yourcompany.salesforce.com" },
        { key: "access_token", label: "Access Token", icon: Key, placeholder: "OAuth 2.0 access token", type: "password" },
        { key: "api_version", label: "API Version", icon: Settings, placeholder: "v58.0" },
      ];
    } else if (integration === "hubspot") {
      return [
        { key: "api_key", label: "API Key", icon: Key, placeholder: "HubSpot API key", type: "password" },
        { key: "portal_id", label: "Portal ID", icon: Building2, placeholder: "12345678" },
      ];
    } else if (integration === "ms365") {
      return [
        { key: "tenant_id", label: "Tenant ID", icon: Building2, placeholder: "Azure AD Tenant ID" },
        { key: "client_id", label: "Client ID", icon: Key, placeholder: "App Client ID" },
        { key: "client_secret", label: "Client Secret", icon: Shield, placeholder: "App Client Secret", type: "password" },
      ];
    }
    return [];
  };

  const fields = getFields();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Connection Form */}
      <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Shield className={`w-5 h-5 text-${meta.color}-600`} />
              {meta.name} Connection Settings
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Configure your API credentials to enable data synchronization
            </p>
          </div>
        </div>

        <div className="grid gap-5">
          {fields.map((field) => {
            const Icon = field.icon;
            return (
              <div key={field.key}>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                  <Icon className="w-4 h-4 text-slate-400" />
                  {field.label}
                </label>
                <div className="relative">
                  <input
                    type={field.type === "password" && !showSecret ? "password" : field.type || "text"}
                    value={formData[field.key] || ""}
                    onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                    className="input w-full"
                    placeholder={field.placeholder}
                    data-testid={`${integration}-${field.key}-input`}
                  />
                  {field.type === "password" && (
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      {showSecret ? "Hide" : "Show"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Connection Status */}
        {status && (
          <div
            className={cn(
              "p-4 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2",
              status.success
                ? "bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200"
                : "bg-gradient-to-r from-red-50 to-rose-50 border border-red-200"
            )}
          >
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
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save & Connect
          </button>
          <button
            onClick={onTest}
            disabled={testing || saving}
            className="btn-secondary flex items-center gap-2 px-6"
            data-testid="test-connection-btn"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
            Test
          </button>
        </div>
      </div>

      {/* Help Card */}
      <div className={cn("bg-gradient-to-br border rounded-2xl p-5", `from-${meta.color}-50 to-indigo-50 border-${meta.color}-200`)}>
        <h4 className={cn("font-semibold flex items-center gap-2 mb-3", `text-${meta.color}-900`)}>
          <Key className="w-4 h-4" />
          How to Get Your API Credentials
        </h4>
        <ol className={cn("text-sm space-y-2", `text-${meta.color}-700`)}>
          {integration === "odoo" && (
            <>
              <li className="flex items-start gap-2">
                <span className={cn("w-5 h-5 rounded-full text-xs flex items-center justify-center flex-shrink-0 mt-0.5", `bg-${meta.color}-200 text-${meta.color}-800`)}>1</span>
                Log in to your Odoo instance as Administrator
              </li>
              <li className="flex items-start gap-2">
                <span className={cn("w-5 h-5 rounded-full text-xs flex items-center justify-center flex-shrink-0 mt-0.5", `bg-${meta.color}-200 text-${meta.color}-800`)}>2</span>
                Go to <strong>Settings → Users & Companies → Users</strong>
              </li>
              <li className="flex items-start gap-2">
                <span className={cn("w-5 h-5 rounded-full text-xs flex items-center justify-center flex-shrink-0 mt-0.5", `bg-${meta.color}-200 text-${meta.color}-800`)}>3</span>
                Click <strong>"Account Security"</strong> tab → <strong>"New API Key"</strong>
              </li>
            </>
          )}
          {integration === "salesforce" && (
            <>
              <li className="flex items-start gap-2">
                <span className={cn("w-5 h-5 rounded-full text-xs flex items-center justify-center flex-shrink-0 mt-0.5", `bg-${meta.color}-200 text-${meta.color}-800`)}>1</span>
                Go to Salesforce <strong>Setup → App Manager</strong>
              </li>
              <li className="flex items-start gap-2">
                <span className={cn("w-5 h-5 rounded-full text-xs flex items-center justify-center flex-shrink-0 mt-0.5", `bg-${meta.color}-200 text-${meta.color}-800`)}>2</span>
                Create a <strong>Connected App</strong> with OAuth settings
              </li>
              <li className="flex items-start gap-2">
                <span className={cn("w-5 h-5 rounded-full text-xs flex items-center justify-center flex-shrink-0 mt-0.5", `bg-${meta.color}-200 text-${meta.color}-800`)}>3</span>
                Obtain your <strong>Access Token</strong> via OAuth 2.0 flow
              </li>
            </>
          )}
          {integration === "ms365" && (
            <>
              <li className="flex items-start gap-2">
                <span className={cn("w-5 h-5 rounded-full text-xs flex items-center justify-center flex-shrink-0 mt-0.5", `bg-${meta.color}-200 text-${meta.color}-800`)}>1</span>
                Go to <strong>Azure Portal → App Registrations</strong>
              </li>
              <li className="flex items-start gap-2">
                <span className={cn("w-5 h-5 rounded-full text-xs flex items-center justify-center flex-shrink-0 mt-0.5", `bg-${meta.color}-200 text-${meta.color}-800`)}>2</span>
                Create a new application and note the <strong>Client ID & Tenant ID</strong>
              </li>
              <li className="flex items-start gap-2">
                <span className={cn("w-5 h-5 rounded-full text-xs flex items-center justify-center flex-shrink-0 mt-0.5", `bg-${meta.color}-200 text-${meta.color}-800`)}>3</span>
                Generate a <strong>Client Secret</strong> under Certificates & Secrets
              </li>
            </>
          )}
        </ol>
      </div>
    </div>
  );
};

// ===================== FIELD MAPPINGS TAB =====================

const FieldMappingsTab = ({ integration, config, onRefresh, meta }) => {
  const [selectedEntity, setSelectedEntity] = useState(null);

  const entities = {
    odoo: [
      { id: "contacts", name: "Contacts", model: "res.partner", icon: User, fields: 12 },
      { id: "opportunities", name: "Opportunities", model: "crm.lead", icon: Zap, fields: 15 },
      { id: "activities", name: "Activities", model: "mail.activity", icon: Calendar, fields: 8 },
    ],
    salesforce: [
      { id: "accounts", name: "Accounts", model: "Account", icon: Building2, fields: 14 },
      { id: "contacts", name: "Contacts", model: "Contact", icon: User, fields: 16 },
      { id: "opportunities", name: "Opportunities", model: "Opportunity", icon: Zap, fields: 18 },
      { id: "leads", name: "Leads", model: "Lead", icon: Sparkles, fields: 12 },
    ],
    hubspot: [
      { id: "companies", name: "Companies", model: "companies", icon: Building2, fields: 10 },
      { id: "contacts", name: "Contacts", model: "contacts", icon: User, fields: 14 },
      { id: "deals", name: "Deals", model: "deals", icon: Zap, fields: 12 },
    ],
    ms365: [
      { id: "users", name: "Users", model: "users", icon: User, fields: 8 },
      { id: "calendar", name: "Calendar Events", model: "events", icon: Calendar, fields: 10 },
    ],
  };

  const currentEntities = entities[integration] || [];

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
            <p className="text-xs text-slate-500 mt-1">Select an entity to configure field mappings</p>
          </div>
          <div className="divide-y">
            {currentEntities.map((entity) => {
              const Icon = entity.icon;
              return (
                <button
                  key={entity.id}
                  onClick={() => setSelectedEntity(entity)}
                  className={cn(
                    "w-full p-4 text-left hover:bg-slate-50 transition-all",
                    selectedEntity?.id === entity.id && `bg-${meta.color}-50 border-l-4 border-${meta.color}-500`
                  )}
                  data-testid={`entity-${entity.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", `bg-${meta.color}-100`)}>
                      <Icon className={`w-5 h-5 text-${meta.color}-600`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900">{entity.name}</p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{entity.model}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                          Active
                        </span>
                        <span className="text-xs text-slate-400">{entity.fields} fields</span>
                      </div>
                    </div>
                    <ChevronRight
                      className={cn(
                        "w-5 h-5 text-slate-300 transition-transform",
                        selectedEntity?.id === entity.id && "rotate-90 text-slate-500"
                      )}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Field Mapper */}
      <div className="flex-1">
        {selectedEntity ? (
          <VisualFieldMapper entity={selectedEntity} integration={integration} meta={meta} />
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border p-12 text-center h-full flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <ArrowLeftRight className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700">Select an Entity</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-xs">
              Choose an entity from the left panel to view and configure field mappings
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ===================== VISUAL FIELD MAPPER =====================

const VisualFieldMapper = ({ entity, integration, meta }) => {
  const fieldMappings = {
    contacts: [
      { source: "id", target: "_source_id", enabled: true, isKey: true },
      { source: "name", target: "name", enabled: true, required: true },
      { source: "email", target: "email", enabled: true },
      { source: "phone", target: "phone", enabled: true },
      { source: "title", target: "job_title", enabled: true },
      { source: "city", target: "city", enabled: true },
    ],
    opportunities: [
      { source: "id", target: "_source_id", enabled: true, isKey: true },
      { source: "name", target: "name", enabled: true, required: true },
      { source: "amount", target: "value", enabled: true },
      { source: "stage", target: "stage", enabled: true },
      { source: "probability", target: "probability", enabled: true },
      { source: "close_date", target: "expected_close_date", enabled: true },
    ],
  };

  const mappings = fieldMappings[entity.id] || [];

  return (
    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden h-full flex flex-col">
      <div className="p-4 border-b bg-gradient-to-r from-slate-50 to-slate-100 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <ArrowLeftRight className={`w-4 h-4 text-${meta.color}-600`} />
            {entity.name} - Field Mapping
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {entity.model} → canonical_{entity.id} • {mappings.filter((m) => m.enabled).length} active mappings
          </p>
        </div>
        <button className="btn-primary text-sm flex items-center gap-1.5">
          <Save className="w-4 h-4" />
          Save Mappings
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {mappings.map((fm, idx) => (
            <div
              key={idx}
              className={cn(
                "p-4 rounded-lg border transition-all",
                fm.enabled ? "bg-white border-slate-200 shadow-sm" : "bg-slate-100 border-dashed border-slate-300 opacity-60"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center",
                      fm.enabled ? "bg-green-500 border-green-500" : "bg-white border-slate-300"
                    )}
                  >
                    {fm.enabled && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className={cn("font-medium px-3 py-1 rounded text-sm", `bg-${meta.color}-100 text-${meta.color}-700`)}>
                    {fm.source}
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                  <span className="font-medium bg-green-100 text-green-700 px-3 py-1 rounded text-sm">{fm.target}</span>
                </div>
                <div className="flex items-center gap-2">
                  {fm.isKey && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium">KEY</span>
                  )}
                  {fm.required && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">REQ</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ===================== SYNC TAB =====================

const SyncTab = ({ integration, config, onRefresh, meta }) => {
  const [syncing, setSyncing] = useState({});
  const [previewData, setPreviewData] = useState({});

  const entities = {
    odoo: [
      { id: "contacts", name: "Contacts", icon: User },
      { id: "opportunities", name: "Opportunities", icon: Zap },
      { id: "activities", name: "Activities", icon: Calendar },
    ],
    salesforce: [
      { id: "accounts", name: "Accounts", icon: Building2 },
      { id: "contacts", name: "Contacts", icon: User },
      { id: "opportunities", name: "Opportunities", icon: Zap },
    ],
  };

  const currentEntities = entities[integration] || entities.odoo;

  const handleSyncAll = async () => {
    setSyncing({ all: true });
    try {
      if (integration === "odoo") {
        await api.post("/odoo/sync-all");
      } else {
        await api.post(`/${integration}/sync`, { entity_types: null, mode: "full" });
      }
      toast.success("Full sync completed!");
      onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Sync failed");
    } finally {
      setSyncing({ all: false });
    }
  };

  const handleSyncEntity = async (entityId) => {
    setSyncing((prev) => ({ ...prev, [entityId]: true }));
    try {
      if (integration === "odoo") {
        await api.post(`/odoo/sync/${entityId}`);
      } else {
        await api.post(`/${integration}/sync`, { entity_types: [entityId], mode: "incremental" });
      }
      toast.success(`${entityId} sync completed!`);
      onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Sync failed");
    } finally {
      setSyncing((prev) => ({ ...prev, [entityId]: false }));
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Sync All Card */}
      <div className={cn("bg-gradient-to-r rounded-2xl p-6 text-white", meta.gradient)}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Full Synchronization
            </h3>
            <p className="text-white/80 mt-1">Sync all entities from {meta.name} to your Data Lake</p>
          </div>
          <button
            onClick={handleSyncAll}
            disabled={syncing.all}
            className="bg-white text-slate-800 hover:bg-slate-100 px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
            data-testid="sync-all-btn"
          >
            {syncing.all ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
            Sync All Now
          </button>
        </div>
      </div>

      {/* Individual Entity Sync Cards */}
      {currentEntities.map((entity) => {
        const Icon = entity.icon;
        return (
          <div key={entity.id} className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", `bg-${meta.color}-100`)}>
                  <Icon className={`w-6 h-6 text-${meta.color}-600`} />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">{entity.name}</h4>
                  <p className="text-sm text-slate-500">{integration} → canonical_{entity.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="btn-secondary flex items-center gap-2" data-testid={`preview-${entity.id}-btn`}>
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
                <button
                  onClick={() => handleSyncEntity(entity.id)}
                  disabled={syncing[entity.id]}
                  className="btn-primary flex items-center gap-2"
                  data-testid={`sync-${entity.id}-btn`}
                >
                  {syncing[entity.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Sync Now
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ===================== DATA LAKE TAB =====================

const DataLakeTab = ({ stats, onRefresh }) => {
  const zones = [
    {
      id: "raw",
      name: "Raw Zone",
      icon: FileText,
      color: "blue",
      gradient: "from-blue-600 to-blue-700",
      description: "Immutable source data archive. Every record from every sync is preserved here for audit and replay.",
      records: stats.raw.records,
      collections: stats.raw.collections,
    },
    {
      id: "canonical",
      name: "Canonical Zone",
      icon: Database,
      color: "green",
      gradient: "from-green-600 to-emerald-600",
      description: "Unified normalized entities. Data from all sources merged and deduplicated into standard models.",
      records: stats.canonical.records,
      entities: ["contacts", "accounts", "opportunities", "activities", "users"],
    },
    {
      id: "serving",
      name: "Serving Zone",
      icon: BarChart3,
      color: "purple",
      gradient: "from-purple-600 to-indigo-600",
      description: "Dashboard-optimized pre-computed aggregates. Fast reads for real-time dashboards and reports.",
      records: stats.serving.aggregates,
      aggregates: ["dashboard_stats", "pipeline_summary", "kpi_snapshots"],
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Data Lake Architecture</h2>
        <p className="text-slate-500 mt-2">Three-zone architecture for scalable, auditable data management</p>
      </div>

      {/* Pipeline Visualization */}
      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <div className="flex items-center justify-between">
          {zones.map((zone, idx) => {
            const Icon = zone.icon;
            return (
              <React.Fragment key={zone.id}>
                <div className="flex-1 text-center">
                  <div className={cn("w-20 h-20 rounded-2xl mx-auto flex items-center justify-center bg-gradient-to-br", zone.gradient)}>
                    <Icon className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="font-bold text-slate-900 mt-3">{zone.name}</h3>
                  <p className={cn("text-2xl font-bold mt-1", `text-${zone.color}-600`)}>{zone.records.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">records</p>
                </div>
                {idx < zones.length - 1 && (
                  <div className="flex items-center px-4">
                    <ArrowRight className="w-8 h-8 text-slate-300" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Zone Details */}
      <div className="grid grid-cols-3 gap-6">
        {zones.map((zone) => {
          const Icon = zone.icon;
          return (
            <div key={zone.id} className={cn("bg-gradient-to-br rounded-2xl p-5 border", `from-${zone.color}-50 to-slate-50 border-${zone.color}-200`)}>
              <div className="flex items-center gap-3 mb-4">
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", `bg-${zone.color}-100`)}>
                  <Icon className={`w-5 h-5 text-${zone.color}-600`} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{zone.name}</h3>
                  <p className={cn("text-lg font-bold", `text-${zone.color}-600`)}>{zone.records.toLocaleString()}</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-4">{zone.description}</p>
              <div className="space-y-1">
                {zone.collections && (
                  <>
                    <p className="text-xs font-semibold text-slate-500 uppercase">Collections</p>
                    {zone.collections.slice(0, 3).map((c) => (
                      <div key={c} className="text-xs bg-white/80 px-2 py-1 rounded text-slate-600">
                        {c}
                      </div>
                    ))}
                  </>
                )}
                {zone.entities && (
                  <>
                    <p className="text-xs font-semibold text-slate-500 uppercase">Entities</p>
                    <div className="flex flex-wrap gap-1">
                      {zone.entities.map((e) => (
                        <span key={e} className="text-xs bg-white/80 px-2 py-1 rounded text-slate-600">
                          {e}
                        </span>
                      ))}
                    </div>
                  </>
                )}
                {zone.aggregates && (
                  <>
                    <p className="text-xs font-semibold text-slate-500 uppercase">Aggregates</p>
                    {zone.aggregates.map((a) => (
                      <div key={a} className="text-xs bg-white/80 px-2 py-1 rounded text-slate-600">
                        {a}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Refresh Button */}
      <div className="text-center">
        <button onClick={onRefresh} className="btn-secondary flex items-center gap-2 mx-auto">
          <RefreshCw className="w-4 h-4" />
          Refresh Stats
        </button>
      </div>
    </div>
  );
};

// ===================== SYNC LOGS TAB =====================

const SyncLogsTab = ({ integration }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, [integration]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/${integration}/sync-logs?limit=50`);
      setLogs(response.data);
    } catch (error) {
      // Fallback - logs not available for this integration
      setLogs([]);
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
          <button onClick={fetchLogs} className="btn-secondary text-sm flex items-center gap-1.5">
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
              <p className="text-sm text-slate-500 mt-1">Sync logs will appear here after you run your first sync</p>
            </div>
          ) : (
            logs.map((log) => {
              const status = statusConfig[log.status] || statusConfig.running;
              const StatusIcon = status.icon;

              return (
                <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", `bg-${status.color}-100`)}>
                        <StatusIcon className={cn("w-5 h-5", `text-${status.color}-600`, log.status === "running" && "animate-spin")} />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{log.entity_mapping_id}</p>
                        <p className="text-xs text-slate-500">{new Date(log.started_at).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-green-600 font-medium">+{log.records_created}</span>
                        <span className="text-blue-600 font-medium">~{log.records_updated}</span>
                        {log.records_failed > 0 && <span className="text-red-600 font-medium">!{log.records_failed}</span>}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{log.records_processed} processed</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default IntegrationHub;
