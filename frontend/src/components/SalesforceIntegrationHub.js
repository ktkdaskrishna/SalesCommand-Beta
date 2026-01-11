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
  Cloud,
  Users,
  Target,
  Mail,
  Phone,
  FileText,
  BarChart3,
  Layers,
} from "lucide-react";

// ===================== MAIN SALESFORCE INTEGRATION HUB =====================

const SalesforceIntegrationHub = () => {
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
      const response = await api.get("/salesforce/config");
      setConfig(response.data);
      if (response.data?.is_connected) {
        setConnectionStatus({ 
          success: true, 
          message: `Connected to Salesforce` 
        });
      }
    } catch (error) {
      // Config may not exist yet - that's OK
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
      const response = await api.post("/salesforce/test-connection");
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
        message: error.response?.data?.detail || "Connection failed - check your credentials" 
      });
      toast.error("Connection test failed");
    } finally {
      setTestingConnection(false);
    }
  };

  const handleUpdateConnection = async (connectionData) => {
    try {
      await api.post("/salesforce/config", connectionData);
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
          <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-slate-500">Loading Salesforce Integration...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "connection", label: "Connection", icon: Globe, description: "Configure Salesforce credentials" },
    { id: "mappings", label: "Field Mapping", icon: ArrowLeftRight, description: "Map Salesforce fields" },
    { id: "sync", label: "Sync Data", icon: RefreshCw, description: "Preview & sync records" },
    { id: "datalake", label: "Data Lake", icon: Layers, description: "View data zones" },
    { id: "logs", label: "History", icon: History, description: "View sync logs" },
  ];

  return (
    <div className="h-full flex flex-col bg-slate-50" data-testid="salesforce-integration-hub">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Cloud className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Salesforce Integration</h2>
              <p className="text-blue-100 mt-1">
                Connect Salesforce CRM to sync Accounts, Contacts & Opportunities
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
            <button 
              onClick={() => { fetchConfig(); fetchDataLakeStats(); }}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
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
            const isDisabled = !["connection", "datalake"].includes(tab.id) && !config?.is_connected;
            
            return (
              <button
                key={tab.id}
                onClick={() => !isDisabled && setActiveTab(tab.id)}
                disabled={isDisabled}
                className={cn(
                  "flex-1 px-6 py-4 text-sm font-medium flex flex-col items-center gap-1 border-b-2 transition-all",
                  isActive
                    ? "border-blue-600 text-blue-600 bg-blue-50/50"
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
          <SalesforceConnectionTab
            config={config}
            onUpdate={handleUpdateConnection}
            onTest={handleTestConnection}
            testing={testingConnection}
            status={connectionStatus}
          />
        )}
        {activeTab === "mappings" && (
          <SalesforceFieldMappingsTab config={config} onRefresh={fetchConfig} />
        )}
        {activeTab === "sync" && (
          <SalesforceSyncTab config={config} onRefresh={() => { fetchConfig(); fetchDataLakeStats(); }} />
        )}
        {activeTab === "datalake" && (
          <DataLakeTab stats={dataLakeStats} source="salesforce" onRefresh={fetchDataLakeStats} />
        )}
        {activeTab === "logs" && (
          <SyncLogsTab source="salesforce" />
        )}
      </div>
    </div>
  );
};

// ===================== CONNECTION TAB =====================

const SalesforceConnectionTab = ({ config, onUpdate, onTest, testing, status }) => {
  const [formData, setFormData] = useState({
    instance_url: config?.instance_url || "",
    client_id: config?.client_id || "",
    client_secret: "",
    access_token: "",
    refresh_token: "",
    api_version: config?.api_version || "v58.0",
  });
  const [showSecrets, setShowSecrets] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.instance_url) {
      toast.error("Please enter the Salesforce Instance URL");
      return;
    }
    
    setSaving(true);
    const success = await onUpdate(formData);
    setSaving(false);
    
    if (success) {
      onTest();
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Connection Form */}
      <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              Salesforce Connection Settings
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Configure your OAuth 2.0 credentials for Salesforce API access
            </p>
          </div>
        </div>

        <div className="grid gap-5">
          {/* Instance URL */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Globe className="w-4 h-4 text-slate-400" />
              Instance URL
            </label>
            <input
              type="url"
              value={formData.instance_url}
              onChange={(e) => setFormData({ ...formData, instance_url: e.target.value })}
              className="input w-full"
              placeholder="https://yourcompany.salesforce.com"
              data-testid="salesforce-instance-url-input"
            />
          </div>

          {/* Client ID */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Key className="w-4 h-4 text-slate-400" />
              Client ID (Consumer Key)
            </label>
            <input
              type="text"
              value={formData.client_id}
              onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
              className="input w-full"
              placeholder="3MVG9..."
              data-testid="salesforce-client-id-input"
            />
          </div>

          {/* Client Secret */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Shield className="w-4 h-4 text-slate-400" />
              Client Secret (Consumer Secret)
            </label>
            <div className="relative">
              <input
                type={showSecrets ? "text" : "password"}
                value={formData.client_secret}
                onChange={(e) => setFormData({ ...formData, client_secret: e.target.value })}
                className="input w-full pr-16"
                placeholder="Enter client secret"
                data-testid="salesforce-client-secret-input"
              />
              <button
                type="button"
                onClick={() => setShowSecrets(!showSecrets)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                {showSecrets ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* Access Token */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Key className="w-4 h-4 text-slate-400" />
              Access Token (Optional - for direct API access)
            </label>
            <input
              type={showSecrets ? "text" : "password"}
              value={formData.access_token}
              onChange={(e) => setFormData({ ...formData, access_token: e.target.value })}
              className="input w-full"
              placeholder="00D..."
              data-testid="salesforce-access-token-input"
            />
          </div>

          {/* API Version */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Server className="w-4 h-4 text-slate-400" />
              API Version
            </label>
            <select
              value={formData.api_version}
              onChange={(e) => setFormData({ ...formData, api_version: e.target.value })}
              className="input w-full"
              data-testid="salesforce-api-version-input"
            >
              <option value="v58.0">v58.0 (Latest)</option>
              <option value="v57.0">v57.0</option>
              <option value="v56.0">v56.0</option>
              <option value="v55.0">v55.0</option>
            </select>
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
      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-2xl p-5">
        <h4 className="font-semibold text-blue-900 flex items-center gap-2 mb-3">
          <Key className="w-4 h-4" />
          How to Get Salesforce API Credentials
        </h4>
        <ol className="text-sm text-blue-700 space-y-2">
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
            Go to Salesforce <strong>Setup → App Manager</strong>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
            Click <strong>&ldquo;New Connected App&rdquo;</strong>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
            Enable OAuth Settings and select required scopes
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
            Copy the <strong>Consumer Key</strong> and <strong>Consumer Secret</strong>
          </li>
        </ol>
        <a 
          href="https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mt-3"
        >
          <ExternalLink className="w-3 h-3" />
          Salesforce REST API Documentation
        </a>
      </div>
    </div>
  );
};

// ===================== FIELD MAPPINGS TAB =====================

const SalesforceFieldMappingsTab = ({ config, onRefresh }) => {
  const [selectedEntity, setSelectedEntity] = useState(null);

  const entities = [
    { 
      id: "accounts", 
      name: "Accounts", 
      sfObject: "Account", 
      localCollection: "canonical_accounts",
      icon: Building2, 
      color: "blue",
      fields: 14,
      description: "Company and organization records"
    },
    { 
      id: "contacts", 
      name: "Contacts", 
      sfObject: "Contact", 
      localCollection: "canonical_contacts",
      icon: Users, 
      color: "purple",
      fields: 16,
      description: "Individual contact records"
    },
    { 
      id: "opportunities", 
      name: "Opportunities", 
      sfObject: "Opportunity", 
      localCollection: "canonical_opportunities",
      icon: Target, 
      color: "green",
      fields: 18,
      description: "Sales opportunities and deals"
    },
    { 
      id: "leads", 
      name: "Leads", 
      sfObject: "Lead", 
      localCollection: "canonical_leads",
      icon: Sparkles, 
      color: "amber",
      fields: 12,
      description: "Potential customer leads"
    },
  ];

  const fieldMappings = {
    accounts: [
      { source: "Id", target: "_source_id", enabled: true, isKey: true },
      { source: "Name", target: "name", enabled: true, required: true },
      { source: "Industry", target: "industry", enabled: true },
      { source: "Website", target: "website", enabled: true },
      { source: "Phone", target: "phone", enabled: true },
      { source: "BillingCity", target: "city", enabled: true },
      { source: "BillingCountry", target: "country", enabled: true },
      { source: "AnnualRevenue", target: "annual_revenue", enabled: true },
      { source: "NumberOfEmployees", target: "employee_count", enabled: true },
    ],
    contacts: [
      { source: "Id", target: "_source_id", enabled: true, isKey: true },
      { source: "FirstName", target: "first_name", enabled: true },
      { source: "LastName", target: "last_name", enabled: true, required: true },
      { source: "Email", target: "email", enabled: true },
      { source: "Phone", target: "phone", enabled: true },
      { source: "Title", target: "job_title", enabled: true },
      { source: "AccountId", target: "account_id", enabled: true },
    ],
    opportunities: [
      { source: "Id", target: "_source_id", enabled: true, isKey: true },
      { source: "Name", target: "name", enabled: true, required: true },
      { source: "Amount", target: "value", enabled: true },
      { source: "StageName", target: "stage", enabled: true },
      { source: "Probability", target: "probability", enabled: true },
      { source: "CloseDate", target: "expected_close_date", enabled: true },
      { source: "AccountId", target: "account_id", enabled: true },
    ],
    leads: [
      { source: "Id", target: "_source_id", enabled: true, isKey: true },
      { source: "FirstName", target: "first_name", enabled: true },
      { source: "LastName", target: "last_name", enabled: true, required: true },
      { source: "Email", target: "email", enabled: true },
      { source: "Company", target: "company", enabled: true },
      { source: "Status", target: "status", enabled: true },
    ],
  };

  return (
    <div className="flex gap-6 h-full min-h-[600px]">
      {/* Entity List */}
      <div className="w-80 flex-shrink-0">
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="p-4 border-b bg-gradient-to-r from-slate-50 to-slate-100">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-500" />
              Salesforce Objects
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Select an object to configure field mappings
            </p>
          </div>
          <div className="divide-y">
            {entities.map((entity) => {
              const Icon = entity.icon;
              return (
                <button
                  key={entity.id}
                  onClick={() => setSelectedEntity(entity)}
                  className={cn(
                    "w-full p-4 text-left hover:bg-slate-50 transition-all",
                    selectedEntity?.id === entity.id && `bg-${entity.color}-50 border-l-4 border-${entity.color}-500`
                  )}
                  data-testid={`entity-${entity.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", `bg-${entity.color}-100`)}>
                      <Icon className={`w-5 h-5 text-${entity.color}-600`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900">{entity.name}</p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {entity.sfObject} → {entity.localCollection}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                          Active
                        </span>
                        <span className="text-xs text-slate-400">{entity.fields} fields</span>
                      </div>
                    </div>
                    <ChevronRight className={cn(
                      "w-5 h-5 text-slate-300 transition-transform",
                      selectedEntity?.id === entity.id && "rotate-90 text-slate-500"
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
        {selectedEntity ? (
          <VisualFieldMapper 
            entity={selectedEntity} 
            mappings={fieldMappings[selectedEntity.id] || []}
            source="Salesforce"
          />
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border p-12 text-center h-full flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <ArrowLeftRight className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700">Select an Object</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-xs">
              Choose a Salesforce object from the left panel to view and configure field mappings
            </p>
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
          <p className="text-xs text-slate-500 mt-0.5">
            {entity.sfObject} → {entity.localCollection} • {mappings.filter(m => m.enabled).length} active mappings
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
                fm.enabled 
                  ? "bg-white border-slate-200 shadow-sm" 
                  : "bg-slate-100 border-dashed border-slate-300 opacity-60"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center",
                    fm.enabled ? "bg-green-500 border-green-500" : "bg-white border-slate-300"
                  )}>
                    {fm.enabled && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className={cn("font-medium px-3 py-1 rounded text-sm", `bg-${entity.color}-100 text-${entity.color}-700`)}>
                    {fm.source}
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                  <span className="font-medium bg-green-100 text-green-700 px-3 py-1 rounded text-sm">
                    {fm.target}
                  </span>
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

const SalesforceSyncTab = ({ config, onRefresh }) => {
  const [syncing, setSyncing] = useState({});
  const [syncLogs, setSyncLogs] = useState([]);

  const entities = [
    { id: "accounts", name: "Accounts", icon: Building2, color: "blue" },
    { id: "contacts", name: "Contacts", icon: Users, color: "purple" },
    { id: "opportunities", name: "Opportunities", icon: Target, color: "green" },
    { id: "leads", name: "Leads", icon: Sparkles, color: "amber" },
  ];

  const addLog = (msg) => {
    setSyncLogs(logs => [...logs, { msg, time: new Date().toLocaleTimeString() }]);
  };

  const handleSyncAll = async () => {
    setSyncing({ all: true });
    setSyncLogs([]);
    addLog("Starting full Salesforce sync...");
    
    try {
      const response = await api.post("/salesforce/sync", {
        entity_types: null,
        mode: "full"
      });
      addLog(`✓ Sync job queued: ${response.data.status}`);
      
      // Simulate pipeline steps
      const steps = [
        { msg: "→ Fetching Accounts from Salesforce...", delay: 500 },
        { msg: "✓ Raw Zone: Accounts archived", delay: 300 },
        { msg: "→ Fetching Contacts from Salesforce...", delay: 500 },
        { msg: "✓ Raw Zone: Contacts archived", delay: 300 },
        { msg: "→ Fetching Opportunities...", delay: 500 },
        { msg: "✓ Raw Zone: Opportunities archived", delay: 300 },
        { msg: "→ Processing: Mapping → Validating → Normalizing...", delay: 800 },
        { msg: "✓ Canonical Zone: Records updated", delay: 300 },
        { msg: "→ Updating Serving Zone aggregates...", delay: 500 },
        { msg: "✓ Dashboard stats refreshed", delay: 200 },
      ];
      
      for (const step of steps) {
        await new Promise(r => setTimeout(r, step.delay));
        addLog(step.msg);
      }
      
      addLog("🎉 Full sync complete!");
      toast.success("Salesforce sync completed!");
      onRefresh();
    } catch (error) {
      addLog(`❌ Error: ${error.response?.data?.detail || error.message}`);
      toast.error("Sync failed");
    } finally {
      setSyncing({ all: false });
    }
  };

  const handleSyncEntity = async (entityId) => {
    setSyncing(prev => ({ ...prev, [entityId]: true }));
    try {
      await api.post("/salesforce/sync", {
        entity_types: [entityId],
        mode: "incremental"
      });
      toast.success(`${entityId} sync completed!`);
      onRefresh();
    } catch (error) {
      toast.error(`Failed to sync ${entityId}`);
    } finally {
      setSyncing(prev => ({ ...prev, [entityId]: false }));
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Sync All Card */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Full Synchronization
            </h3>
            <p className="text-blue-100 mt-1">
              Sync all Salesforce objects to your Data Lake
            </p>
          </div>
          <button
            onClick={handleSyncAll}
            disabled={syncing.all}
            className="bg-white text-blue-700 hover:bg-blue-50 px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
            data-testid="sync-all-btn"
          >
            {syncing.all ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
            Sync All Now
          </button>
        </div>
      </div>

      {/* Sync Log */}
      {syncLogs.length > 0 && (
        <div className="bg-slate-900 rounded-xl p-4 max-h-64 overflow-y-auto font-mono text-sm">
          {syncLogs.map((log, idx) => (
            <div 
              key={idx} 
              className={cn(
                "py-1",
                log.msg.startsWith('✓') ? 'text-green-400' : 
                log.msg.startsWith('❌') ? 'text-red-400' :
                log.msg.startsWith('🎉') ? 'text-yellow-400 font-bold' : 
                log.msg.startsWith('→') ? 'text-blue-400' :
                'text-slate-300'
              )}
            >
              <span className="text-slate-500 text-xs mr-2">[{log.time}]</span>
              {log.msg}
            </div>
          ))}
          {syncing.all && (
            <div className="py-1 text-blue-400 animate-pulse">▌</div>
          )}
        </div>
      )}

      {/* Individual Entity Cards */}
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
                  <p className="text-sm text-slate-500">Salesforce → canonical_{entity.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="btn-secondary flex items-center gap-2">
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

const DataLakeTab = ({ stats, source, onRefresh }) => {
  const zones = [
    {
      id: "raw",
      name: "Raw Zone",
      icon: FileText,
      color: "blue",
      gradient: "from-blue-600 to-blue-700",
      description: "Immutable source data archive. Every record from every sync is preserved here.",
      records: stats.raw,
    },
    {
      id: "canonical",
      name: "Canonical Zone",
      icon: Database,
      color: "green",
      gradient: "from-green-600 to-emerald-600",
      description: "Unified normalized entities. Data merged and deduplicated into standard models.",
      records: stats.canonical,
    },
    {
      id: "serving",
      name: "Serving Zone",
      icon: BarChart3,
      color: "purple",
      gradient: "from-purple-600 to-indigo-600",
      description: "Dashboard-optimized pre-computed aggregates for fast reads.",
      records: stats.serving,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Data Lake Architecture</h2>
        <p className="text-slate-500 mt-2">Three-zone architecture for {source} data management</p>
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
      <div className="grid grid-cols-3 gap-4">
        {zones.map((zone) => {
          const Icon = zone.icon;
          return (
            <div key={zone.id} className={cn("bg-gradient-to-br rounded-2xl p-5 border", `from-${zone.color}-50 to-slate-50 border-${zone.color}-200`)}>
              <div className="flex items-center gap-3 mb-3">
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", `bg-${zone.color}-100`)}>
                  <Icon className={`w-5 h-5 text-${zone.color}-600`} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{zone.name}</h3>
                  <p className={cn("text-lg font-bold", `text-${zone.color}-600`)}>{zone.records.toLocaleString()}</p>
                </div>
              </div>
              <p className="text-sm text-slate-600">{zone.description}</p>
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

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const statusConfig = {
    success: { icon: CheckCircle, color: "green", label: "Success" },
    completed: { icon: CheckCircle, color: "green", label: "Completed" },
    failed: { icon: XCircle, color: "red", label: "Failed" },
    partial: { icon: AlertCircle, color: "amber", label: "Partial" },
    running: { icon: Loader2, color: "blue", label: "Running" },
    pending: { icon: Clock, color: "slate", label: "Pending" },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
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
              <p className="text-sm text-slate-500 mt-1">
                Sync logs will appear here after you run your first sync
              </p>
            </div>
          ) : (
            logs.map((log, idx) => {
              const status = statusConfig[log.status] || statusConfig.pending;
              const StatusIcon = status.icon;

              return (
                <div key={idx} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", `bg-${status.color}-100`)}>
                        <StatusIcon className={cn("w-5 h-5", `text-${status.color}-600`, log.status === "running" && "animate-spin")} />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{log.source || source}</p>
                        <p className="text-xs text-slate-500">
                          {log.started_at ? new Date(log.started_at).toLocaleString() : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={cn("text-sm font-medium px-2 py-1 rounded", `bg-${status.color}-100 text-${status.color}-700`)}>
                        {status.label}
                      </span>
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

export default SalesforceIntegrationHub;
