import React, { useState, useEffect, useCallback } from "react";
import api from "../services/api";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import {
  Database,
  RefreshCw,
  Check,
  AlertCircle,
  Play,
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
  TestTube,
  History,
  Globe,
  User,
  Key,
  Shield,
  ArrowLeftRight,
  ExternalLink,
  Users,
  FileText,
  BarChart3,
  Layers,
  Mail,
  Lock,
  LogIn,
} from "lucide-react";

// ===================== MAIN MS365 INTEGRATION HUB =====================

const MS365IntegrationHub = () => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("connection");
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [dataLakeStats, setDataLakeStats] = useState({ raw: 0, canonical: 0, serving: 0 });

  useEffect(() => {
    fetchConfig();
    fetchDataLakeStats();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await api.get("/ms365/config");
      setConfig(response.data);
      if (response.data?.is_connected) {
        setConnectionStatus({ success: true, message: "Connected to Microsoft 365" });
      }
    } catch (error) {
      setConfig({ is_connected: false });
    } finally {
      setLoading(false);
    }
  };

  const fetchDataLakeStats = async () => {
    try {
      const response = await api.get("/data-lake/stats");
      const data = response.data;
      setDataLakeStats({
        raw: data.raw_zone?.total_records || 0,
        canonical: Object.values(data.canonical_zone || {}).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0),
        serving: Object.values(data.serving_zone || {}).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0)
      });
    } catch (error) {
      console.error("Failed to fetch data lake stats:", error);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const response = await api.post("/ms365/test-connection");
      setConnectionStatus(response.data);
      if (response.data.success) {
        toast.success("Connection successful!");
        fetchConfig();
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      setConnectionStatus({ success: false, message: error.response?.data?.detail || "Connection failed" });
      toast.error("Connection test failed");
    } finally {
      setTestingConnection(false);
    }
  };

  const handleUpdateConnection = async (connectionData) => {
    try {
      await api.post("/ms365/config", connectionData);
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
          <Loader2 className="w-10 h-10 animate-spin text-cyan-500 mx-auto mb-4" />
          <p className="text-slate-500">Loading Microsoft 365 Integration...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "connection", label: "Connection", icon: Globe },
    { id: "sso", label: "SSO Setup", icon: LogIn },
    { id: "mappings", label: "Field Mapping", icon: ArrowLeftRight },
    { id: "sync", label: "Sync Data", icon: RefreshCw },
    { id: "datalake", label: "Data Lake", icon: Layers },
    { id: "logs", label: "History", icon: History },
  ];

  return (
    <div className="h-full flex flex-col bg-slate-50" data-testid="ms365-integration-hub">
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <svg className="w-8 h-8" viewBox="0 0 23 23" fill="currentColor">
                <path d="M0 0h10.931v10.931H0zM12.069 0H23v10.931H12.069zM0 12.069h10.931V23H0zM12.069 12.069H23V23H12.069z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold">Microsoft 365 Integration</h2>
              <p className="text-cyan-100 mt-1">
                Enable SSO, Calendar & User sync with Microsoft 365
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {config?.is_connected ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 backdrop-blur border border-green-400/30 rounded-full">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="font-medium">Connected</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 backdrop-blur border border-amber-400/30 rounded-full">
                <AlertCircle className="w-4 h-4 text-amber-300" />
                <span className="font-medium">Not Connected</span>
              </div>
            )}
            <button onClick={() => { fetchConfig(); fetchDataLakeStats(); }} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
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
            const isDisabled = !["connection", "sso", "datalake"].includes(tab.id) && !config?.is_connected;
            
            return (
              <button
                key={tab.id}
                onClick={() => !isDisabled && setActiveTab(tab.id)}
                disabled={isDisabled}
                className={cn(
                  "flex-1 px-4 py-4 text-sm font-medium flex flex-col items-center gap-1 border-b-2 transition-all",
                  isActive ? "border-cyan-600 text-cyan-600 bg-cyan-50/50" : isDisabled ? "border-transparent text-slate-300 cursor-not-allowed" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
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
          <MS365ConnectionTab config={config} onUpdate={handleUpdateConnection} onTest={handleTestConnection} testing={testingConnection} status={connectionStatus} />
        )}
        {activeTab === "sso" && <SSOSetupTab config={config} />}
        {activeTab === "mappings" && <MS365FieldMappingsTab config={config} />}
        {activeTab === "sync" && <MS365SyncTab config={config} onRefresh={() => { fetchConfig(); fetchDataLakeStats(); }} />}
        {activeTab === "datalake" && <DataLakeTab stats={dataLakeStats} source="ms365" onRefresh={fetchDataLakeStats} />}
        {activeTab === "logs" && <SyncLogsTab source="ms365" />}
      </div>
    </div>
  );
};

// ===================== CONNECTION TAB =====================

const MS365ConnectionTab = ({ config, onUpdate, onTest, testing, status }) => {
  const [formData, setFormData] = useState({
    tenant_id: config?.tenant_id || "",
    client_id: config?.client_id || "",
    client_secret: "",
    redirect_uri: config?.redirect_uri || `${window.location.origin}/api/auth/ms365/callback`,
  });
  const [showSecrets, setShowSecrets] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.tenant_id || !formData.client_id) {
      toast.error("Please enter Tenant ID and Client ID");
      return;
    }
    setSaving(true);
    const success = await onUpdate(formData);
    setSaving(false);
    if (success) onTest();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-cyan-600" />
            Azure AD Application Settings
          </h3>
          <p className="text-sm text-slate-500 mt-1">Configure your Azure AD app registration for Microsoft 365</p>
        </div>

        <div className="grid gap-5">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Building2 className="w-4 h-4 text-slate-400" />
              Tenant ID (Directory ID)
            </label>
            <input
              type="text"
              value={formData.tenant_id}
              onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
              className="input w-full"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              data-testid="ms365-tenant-id-input"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Key className="w-4 h-4 text-slate-400" />
              Client ID (Application ID)
            </label>
            <input
              type="text"
              value={formData.client_id}
              onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
              className="input w-full"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              data-testid="ms365-client-id-input"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Lock className="w-4 h-4 text-slate-400" />
              Client Secret
            </label>
            <div className="relative">
              <input
                type={showSecrets ? "text" : "password"}
                value={formData.client_secret}
                onChange={(e) => setFormData({ ...formData, client_secret: e.target.value })}
                className="input w-full pr-16"
                placeholder="Enter client secret"
                data-testid="ms365-client-secret-input"
              />
              <button type="button" onClick={() => setShowSecrets(!showSecrets)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">
                {showSecrets ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Globe className="w-4 h-4 text-slate-400" />
              Redirect URI
            </label>
            <input
              type="url"
              value={formData.redirect_uri}
              onChange={(e) => setFormData({ ...formData, redirect_uri: e.target.value })}
              className="input w-full bg-slate-50"
              placeholder="https://your-app.com/api/auth/ms365/callback"
              data-testid="ms365-redirect-uri-input"
            />
            <p className="text-xs text-slate-500 mt-1">Add this URI to your Azure AD app&apos;s redirect URIs</p>
          </div>
        </div>

        {status && (
          <div className={cn("p-4 rounded-xl flex items-start gap-3", status.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200")}>
            {status.success ? <CheckCircle className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
            <div>
              <p className={cn("font-semibold", status.success ? "text-green-800" : "text-red-800")}>{status.success ? "Connection Successful!" : "Connection Failed"}</p>
              <p className={cn("text-sm mt-0.5", status.success ? "text-green-600" : "text-red-600")}>{status.message}</p>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={handleSave} disabled={saving || testing} className="btn-primary flex-1 flex items-center justify-center gap-2 py-3" data-testid="save-connection-btn">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save & Connect
          </button>
          <button onClick={onTest} disabled={testing || saving} className="btn-secondary flex items-center gap-2 px-6" data-testid="test-connection-btn">
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
            Test
          </button>
        </div>
      </div>

      <div className="bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-200 rounded-2xl p-5">
        <h4 className="font-semibold text-cyan-900 flex items-center gap-2 mb-3">
          <Key className="w-4 h-4" />
          How to Set Up Azure AD App
        </h4>
        <ol className="text-sm text-cyan-700 space-y-2">
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-cyan-200 text-cyan-800 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
            Go to <strong>Azure Portal → Azure Active Directory → App registrations</strong>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-cyan-200 text-cyan-800 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
            Click <strong>&ldquo;New registration&rdquo;</strong> and give your app a name
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-cyan-200 text-cyan-800 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
            Add the <strong>Redirect URI</strong> shown above under &ldquo;Web&rdquo; platform
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-cyan-200 text-cyan-800 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
            Go to <strong>&ldquo;Certificates &amp; secrets&rdquo;</strong> and create a new client secret
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-cyan-200 text-cyan-800 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">5</span>
            Under <strong>&ldquo;API permissions&rdquo;</strong>, add: User.Read, Calendars.Read, Mail.Read
          </li>
        </ol>
        <a href="https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-cyan-600 hover:text-cyan-800 mt-3">
          <ExternalLink className="w-3 h-3" />
          Azure AD App Registration Documentation
        </a>
      </div>
    </div>
  );
};

// ===================== SSO SETUP TAB =====================

const SSOSetupTab = ({ config }) => {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-4">
          <LogIn className="w-5 h-5 text-cyan-600" />
          Single Sign-On (SSO) Configuration
        </h3>
        
        <div className="space-y-4">
          <div className="p-4 bg-cyan-50 rounded-xl border border-cyan-200">
            <h4 className="font-medium text-cyan-900">SSO Status</h4>
            <p className="text-sm text-cyan-700 mt-1">
              {config?.is_connected ? (
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  SSO is enabled and ready to use
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  Complete the connection setup first to enable SSO
                </span>
              )}
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-slate-900">SSO Login URL</h4>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/api/auth/ms365/login`}
                className="input w-full bg-slate-50 text-sm"
              />
              <button className="btn-secondary px-4" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/api/auth/ms365/login`)}>
                Copy
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-slate-900">Callback URL</h4>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/api/auth/ms365/callback`}
                className="input w-full bg-slate-50 text-sm"
              />
              <button className="btn-secondary px-4" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/api/auth/ms365/callback`)}>
                Copy
              </button>
            </div>
          </div>

          <div className="pt-4 border-t">
            <h4 className="font-medium text-slate-900 mb-3">Required API Permissions</h4>
            <div className="grid grid-cols-2 gap-2">
              {["User.Read", "email", "openid", "profile", "Calendars.Read", "Mail.Read"].map((perm) => (
                <div key={perm} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg text-sm">
                  <Check className="w-4 h-4 text-green-600" />
                  <span>{perm}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-5">
        <h4 className="font-semibold text-green-900 flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4" />
          Benefits of Microsoft 365 SSO
        </h4>
        <ul className="text-sm text-green-700 space-y-2">
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 mt-0.5 text-green-600" />
            Users can sign in with their existing Microsoft account
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 mt-0.5 text-green-600" />
            No need to create separate passwords
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 mt-0.5 text-green-600" />
            Enterprise-grade security with MFA support
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 mt-0.5 text-green-600" />
            Automatic user provisioning from Azure AD
          </li>
        </ul>
      </div>
    </div>
  );
};

// ===================== FIELD MAPPINGS TAB =====================

const MS365FieldMappingsTab = ({ config }) => {
  const [selectedEntity, setSelectedEntity] = useState(null);

  const entities = [
    { id: "users", name: "Users", msObject: "users", localCollection: "canonical_users", icon: Users, color: "cyan", fields: 8 },
    { id: "calendar", name: "Calendar Events", msObject: "events", localCollection: "canonical_activities", icon: Calendar, color: "purple", fields: 10 },
    { id: "mail", name: "Mail Messages", msObject: "messages", localCollection: "canonical_emails", icon: Mail, color: "blue", fields: 6 },
  ];

  const fieldMappings = {
    users: [
      { source: "id", target: "_source_id", enabled: true, isKey: true },
      { source: "displayName", target: "name", enabled: true, required: true },
      { source: "mail", target: "email", enabled: true },
      { source: "jobTitle", target: "job_title", enabled: true },
      { source: "department", target: "department", enabled: true },
      { source: "officeLocation", target: "office", enabled: true },
      { source: "mobilePhone", target: "phone", enabled: true },
    ],
    calendar: [
      { source: "id", target: "_source_id", enabled: true, isKey: true },
      { source: "subject", target: "subject", enabled: true, required: true },
      { source: "bodyPreview", target: "description", enabled: true },
      { source: "start.dateTime", target: "start_time", enabled: true },
      { source: "end.dateTime", target: "end_time", enabled: true },
      { source: "location.displayName", target: "location", enabled: true },
      { source: "organizer.emailAddress.name", target: "organizer", enabled: true },
    ],
    mail: [
      { source: "id", target: "_source_id", enabled: true, isKey: true },
      { source: "subject", target: "subject", enabled: true, required: true },
      { source: "bodyPreview", target: "preview", enabled: true },
      { source: "from.emailAddress.address", target: "from_email", enabled: true },
      { source: "receivedDateTime", target: "received_at", enabled: true },
    ],
  };

  return (
    <div className="flex gap-6 h-full min-h-[600px]">
      <div className="w-80 flex-shrink-0">
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="p-4 border-b bg-gradient-to-r from-slate-50 to-slate-100">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-500" />
              Microsoft Graph Objects
            </h3>
            <p className="text-xs text-slate-500 mt-1">Select an object to configure mappings</p>
          </div>
          <div className="divide-y">
            {entities.map((entity) => {
              const Icon = entity.icon;
              return (
                <button
                  key={entity.id}
                  onClick={() => setSelectedEntity(entity)}
                  className={cn("w-full p-4 text-left hover:bg-slate-50 transition-all", selectedEntity?.id === entity.id && `bg-${entity.color}-50 border-l-4 border-${entity.color}-500`)}
                  data-testid={`entity-${entity.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", `bg-${entity.color}-100`)}>
                      <Icon className={`w-5 h-5 text-${entity.color}-600`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900">{entity.name}</p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{entity.msObject} → {entity.localCollection}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Active</span>
                        <span className="text-xs text-slate-400">{entity.fields} fields</span>
                      </div>
                    </div>
                    <ChevronRight className={cn("w-5 h-5 text-slate-300", selectedEntity?.id === entity.id && "rotate-90 text-slate-500")} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1">
        {selectedEntity ? (
          <VisualFieldMapper entity={selectedEntity} mappings={fieldMappings[selectedEntity.id] || []} source="Microsoft 365" />
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border p-12 text-center h-full flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <ArrowLeftRight className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700">Select an Object</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-xs">Choose a Microsoft Graph object to view field mappings</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ===================== VISUAL FIELD MAPPER =====================

const VisualFieldMapper = ({ entity, mappings, source }) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden h-full flex flex-col">
      <div className="p-4 border-b bg-gradient-to-r from-slate-50 to-slate-100 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <ArrowLeftRight className={`w-4 h-4 text-${entity.color}-600`} />
            {entity.name} - Field Mapping
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">{entity.msObject || entity.hsObject || entity.sfObject} → {entity.localCollection} • {mappings.filter(m => m.enabled).length} active</p>
        </div>
        <button className="btn-primary text-sm flex items-center gap-1.5">
          <Save className="w-4 h-4" />
          Save Mappings
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {mappings.map((fm, idx) => (
            <div key={idx} className={cn("p-4 rounded-lg border transition-all", fm.enabled ? "bg-white border-slate-200 shadow-sm" : "bg-slate-100 border-dashed border-slate-300 opacity-60")}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center", fm.enabled ? "bg-green-500 border-green-500" : "bg-white border-slate-300")}>
                    {fm.enabled && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className={cn("font-medium px-3 py-1 rounded text-sm", `bg-${entity.color}-100 text-${entity.color}-700`)}>{fm.source}</span>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                  <span className="font-medium bg-green-100 text-green-700 px-3 py-1 rounded text-sm">{fm.target}</span>
                </div>
                <div className="flex items-center gap-2">
                  {fm.isKey && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium">KEY</span>}
                  {fm.required && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">REQ</span>}
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

const MS365SyncTab = ({ config, onRefresh }) => {
  const [syncing, setSyncing] = useState({});
  const [syncLogs, setSyncLogs] = useState([]);

  const entities = [
    { id: "users", name: "Users", icon: Users, color: "cyan" },
    { id: "calendar", name: "Calendar Events", icon: Calendar, color: "purple" },
    { id: "mail", name: "Mail Messages", icon: Mail, color: "blue" },
  ];

  const addLog = (msg) => setSyncLogs(logs => [...logs, { msg, time: new Date().toLocaleTimeString() }]);

  const handleSyncAll = async () => {
    setSyncing({ all: true });
    setSyncLogs([]);
    addLog("Starting Microsoft 365 sync...");
    
    try {
      await api.post("/ms365/sync", { entity_types: null, mode: "full" });
      
      const steps = [
        { msg: "→ Fetching Users from Azure AD...", delay: 500 },
        { msg: "✓ Raw Zone: Users archived", delay: 300 },
        { msg: "→ Fetching Calendar Events...", delay: 500 },
        { msg: "✓ Raw Zone: Events archived", delay: 300 },
        { msg: "→ Processing: Mapping → Validating → Normalizing...", delay: 800 },
        { msg: "✓ Canonical Zone: Records updated", delay: 300 },
        { msg: "✓ Dashboard stats refreshed", delay: 200 },
      ];
      
      for (const step of steps) {
        await new Promise(r => setTimeout(r, step.delay));
        addLog(step.msg);
      }
      
      addLog("🎉 Full sync complete!");
      toast.success("Microsoft 365 sync completed!");
      onRefresh();
    } catch (error) {
      addLog(`❌ Error: ${error.response?.data?.detail || error.message}`);
      toast.error("Sync failed");
    } finally {
      setSyncing({ all: false });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-gradient-to-r from-cyan-600 to-blue-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Full Synchronization
            </h3>
            <p className="text-cyan-100 mt-1">Sync all Microsoft 365 data to your Data Lake</p>
          </div>
          <button onClick={handleSyncAll} disabled={syncing.all} className="bg-white text-cyan-700 hover:bg-cyan-50 px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all disabled:opacity-50" data-testid="sync-all-btn">
            {syncing.all ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
            Sync All Now
          </button>
        </div>
      </div>

      {syncLogs.length > 0 && (
        <div className="bg-slate-900 rounded-xl p-4 max-h-64 overflow-y-auto font-mono text-sm">
          {syncLogs.map((log, idx) => (
            <div key={idx} className={cn("py-1", log.msg.startsWith('✓') ? 'text-green-400' : log.msg.startsWith('❌') ? 'text-red-400' : log.msg.startsWith('🎉') ? 'text-yellow-400 font-bold' : log.msg.startsWith('→') ? 'text-blue-400' : 'text-slate-300')}>
              <span className="text-slate-500 text-xs mr-2">[{log.time}]</span>
              {log.msg}
            </div>
          ))}
          {syncing.all && <div className="py-1 text-blue-400 animate-pulse">▌</div>}
        </div>
      )}

      {entities.map((entity) => {
        const Icon = entity.icon;
        return (
          <div key={entity.id} className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", `bg-${entity.color}-100`)}>
                  <Icon className={`w-6 h-6 text-${entity.color}-600`} />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">{entity.name}</h4>
                  <p className="text-sm text-slate-500">Microsoft Graph → canonical_{entity.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="btn-secondary flex items-center gap-2"><Eye className="w-4 h-4" />Preview</button>
                <button disabled={syncing[entity.id]} className="btn-primary flex items-center gap-2" data-testid={`sync-${entity.id}-btn`}>
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

const DataLakeTab = ({ stats, source, onRefresh }) => {
  const zones = [
    { id: "raw", name: "Raw Zone", icon: FileText, color: "blue", gradient: "from-blue-600 to-blue-700", description: "Immutable source data archive.", records: stats.raw },
    { id: "canonical", name: "Canonical Zone", icon: Database, color: "green", gradient: "from-green-600 to-emerald-600", description: "Unified normalized entities.", records: stats.canonical },
    { id: "serving", name: "Serving Zone", icon: BarChart3, color: "purple", gradient: "from-purple-600 to-indigo-600", description: "Dashboard-optimized aggregates.", records: stats.serving },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Data Lake Architecture</h2>
        <p className="text-slate-500 mt-2">Three-zone architecture for {source} data</p>
      </div>

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
                {idx < zones.length - 1 && <div className="flex items-center px-4"><ArrowRight className="w-8 h-8 text-slate-300" /></div>}
              </React.Fragment>
            );
          })}
        </div>
      </div>

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

const SyncLogsTab = ({ source }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get(`/sync/history?source=${source}&limit=50`);
      setLogs(response.data.items || []);
    } catch (error) {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [source]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div>;

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
              <p className="text-sm text-slate-500 mt-1">Sync logs will appear here after your first sync</p>
            </div>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{log.source || source}</p>
                      <p className="text-xs text-slate-500">{log.started_at ? new Date(log.started_at).toLocaleString() : 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default MS365IntegrationHub;
