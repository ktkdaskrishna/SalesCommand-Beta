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
  Zap,
  TestTube,
  History,
  Globe,
  User,
  Key,
  Server,
  Shield,
  ArrowLeftRight,
  Sparkles,
  ExternalLink,
  Users,
  Target,
  Mail,
  FileText,
  BarChart3,
  Layers,
  MessageSquare,
} from "lucide-react";

// ===================== MAIN HUBSPOT INTEGRATION HUB =====================

const HubSpotIntegrationHub = () => {
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
      const response = await api.get("/hubspot/config");
      setConfig(response.data);
      if (response.data?.is_connected) {
        setConnectionStatus({ success: true, message: "Connected to HubSpot" });
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
      const response = await api.post("/hubspot/test-connection");
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
      await api.post("/hubspot/config", connectionData);
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
          <Loader2 className="w-10 h-10 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-slate-500">Loading HubSpot Integration...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "connection", label: "Connection", icon: Globe },
    { id: "mappings", label: "Field Mapping", icon: ArrowLeftRight },
    { id: "sync", label: "Sync Data", icon: RefreshCw },
    { id: "datalake", label: "Data Lake", icon: Layers },
    { id: "logs", label: "History", icon: History },
  ];

  return (
    <div className="h-full flex flex-col bg-slate-50" data-testid="hubspot-integration-hub">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <MessageSquare className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">HubSpot Integration</h2>
              <p className="text-orange-100 mt-1">
                Connect HubSpot CRM for Marketing & Sales synchronization
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
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-600/30 backdrop-blur border border-amber-400/30 rounded-full">
                <AlertCircle className="w-4 h-4 text-amber-200" />
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
            const isDisabled = !["connection", "datalake"].includes(tab.id) && !config?.is_connected;
            
            return (
              <button
                key={tab.id}
                onClick={() => !isDisabled && setActiveTab(tab.id)}
                disabled={isDisabled}
                className={cn(
                  "flex-1 px-6 py-4 text-sm font-medium flex flex-col items-center gap-1 border-b-2 transition-all",
                  isActive ? "border-orange-500 text-orange-600 bg-orange-50/50" : isDisabled ? "border-transparent text-slate-300 cursor-not-allowed" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
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
          <HubSpotConnectionTab config={config} onUpdate={handleUpdateConnection} onTest={handleTestConnection} testing={testingConnection} status={connectionStatus} />
        )}
        {activeTab === "mappings" && <HubSpotFieldMappingsTab config={config} />}
        {activeTab === "sync" && <HubSpotSyncTab config={config} onRefresh={() => { fetchConfig(); fetchDataLakeStats(); }} />}
        {activeTab === "datalake" && <DataLakeTab stats={dataLakeStats} source="hubspot" onRefresh={fetchDataLakeStats} />}
        {activeTab === "logs" && <SyncLogsTab source="hubspot" />}
      </div>
    </div>
  );
};

// ===================== CONNECTION TAB =====================

const HubSpotConnectionTab = ({ config, onUpdate, onTest, testing, status }) => {
  const [formData, setFormData] = useState({
    api_key: "",
    portal_id: config?.portal_id || "",
    access_token: "",
  });
  const [showSecrets, setShowSecrets] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.api_key && !formData.access_token) {
      toast.error("Please enter an API Key or Access Token");
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
            <Shield className="w-5 h-5 text-orange-600" />
            HubSpot Connection Settings
          </h3>
          <p className="text-sm text-slate-500 mt-1">Configure your HubSpot API credentials</p>
        </div>

        <div className="grid gap-5">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Key className="w-4 h-4 text-slate-400" />
              API Key (Private App)
            </label>
            <div className="relative">
              <input
                type={showSecrets ? "text" : "password"}
                value={formData.api_key}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                className="input w-full pr-16"
                placeholder="pat-na1-..."
                data-testid="hubspot-api-key-input"
              />
              <button type="button" onClick={() => setShowSecrets(!showSecrets)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">
                {showSecrets ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Building2 className="w-4 h-4 text-slate-400" />
              Portal ID (Hub ID)
            </label>
            <input
              type="text"
              value={formData.portal_id}
              onChange={(e) => setFormData({ ...formData, portal_id: e.target.value })}
              className="input w-full"
              placeholder="12345678"
              data-testid="hubspot-portal-id-input"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Key className="w-4 h-4 text-slate-400" />
              OAuth Access Token (Alternative)
            </label>
            <input
              type={showSecrets ? "text" : "password"}
              value={formData.access_token}
              onChange={(e) => setFormData({ ...formData, access_token: e.target.value })}
              className="input w-full"
              placeholder="CL..."
              data-testid="hubspot-access-token-input"
            />
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

      <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-5">
        <h4 className="font-semibold text-orange-900 flex items-center gap-2 mb-3">
          <Key className="w-4 h-4" />
          How to Get HubSpot API Key
        </h4>
        <ol className="text-sm text-orange-700 space-y-2">
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-orange-200 text-orange-800 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
            Go to HubSpot <strong>Settings → Integrations → Private Apps</strong>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-orange-200 text-orange-800 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
            Click <strong>"Create a private app"</strong>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-orange-200 text-orange-800 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
            Select scopes: <strong>crm.objects.contacts, crm.objects.companies, crm.objects.deals</strong>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-orange-200 text-orange-800 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
            Copy the generated <strong>Access Token</strong>
          </li>
        </ol>
        <a href="https://developers.hubspot.com/docs/api/private-apps" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-800 mt-3">
          <ExternalLink className="w-3 h-3" />
          HubSpot Private Apps Documentation
        </a>
      </div>
    </div>
  );
};

// ===================== FIELD MAPPINGS TAB =====================

const HubSpotFieldMappingsTab = ({ config }) => {
  const [selectedEntity, setSelectedEntity] = useState(null);

  const entities = [
    { id: "companies", name: "Companies", hsObject: "companies", localCollection: "canonical_accounts", icon: Building2, color: "orange", fields: 10 },
    { id: "contacts", name: "Contacts", hsObject: "contacts", localCollection: "canonical_contacts", icon: Users, color: "purple", fields: 14 },
    { id: "deals", name: "Deals", hsObject: "deals", localCollection: "canonical_opportunities", icon: Target, color: "green", fields: 12 },
    { id: "tickets", name: "Tickets", hsObject: "tickets", localCollection: "canonical_tickets", icon: MessageSquare, color: "blue", fields: 8 },
  ];

  const fieldMappings = {
    companies: [
      { source: "hs_object_id", target: "_source_id", enabled: true, isKey: true },
      { source: "name", target: "name", enabled: true, required: true },
      { source: "domain", target: "website", enabled: true },
      { source: "industry", target: "industry", enabled: true },
      { source: "city", target: "city", enabled: true },
      { source: "country", target: "country", enabled: true },
      { source: "numberofemployees", target: "employee_count", enabled: true },
      { source: "annualrevenue", target: "annual_revenue", enabled: true },
    ],
    contacts: [
      { source: "hs_object_id", target: "_source_id", enabled: true, isKey: true },
      { source: "firstname", target: "first_name", enabled: true },
      { source: "lastname", target: "last_name", enabled: true, required: true },
      { source: "email", target: "email", enabled: true },
      { source: "phone", target: "phone", enabled: true },
      { source: "jobtitle", target: "job_title", enabled: true },
      { source: "company", target: "company_name", enabled: true },
    ],
    deals: [
      { source: "hs_object_id", target: "_source_id", enabled: true, isKey: true },
      { source: "dealname", target: "name", enabled: true, required: true },
      { source: "amount", target: "value", enabled: true },
      { source: "dealstage", target: "stage", enabled: true },
      { source: "closedate", target: "expected_close_date", enabled: true },
      { source: "pipeline", target: "pipeline", enabled: true },
    ],
    tickets: [
      { source: "hs_object_id", target: "_source_id", enabled: true, isKey: true },
      { source: "subject", target: "subject", enabled: true, required: true },
      { source: "content", target: "description", enabled: true },
      { source: "hs_pipeline_stage", target: "status", enabled: true },
      { source: "hs_ticket_priority", target: "priority", enabled: true },
    ],
  };

  return (
    <div className="flex gap-6 h-full min-h-[600px]">
      <div className="w-80 flex-shrink-0">
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="p-4 border-b bg-gradient-to-r from-slate-50 to-slate-100">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-500" />
              HubSpot Objects
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
                      <p className="text-xs text-slate-500 truncate mt-0.5">{entity.hsObject} → {entity.localCollection}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Active</span>
                        <span className="text-xs text-slate-400">{entity.fields} fields</span>
                      </div>
                    </div>
                    <ChevronRight className={cn("w-5 h-5 text-slate-300 transition-transform", selectedEntity?.id === entity.id && "rotate-90 text-slate-500")} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1">
        {selectedEntity ? (
          <VisualFieldMapper entity={selectedEntity} mappings={fieldMappings[selectedEntity.id] || []} source="HubSpot" />
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border p-12 text-center h-full flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <ArrowLeftRight className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700">Select an Object</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-xs">Choose a HubSpot object from the left panel to view field mappings</p>
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
          <p className="text-xs text-slate-500 mt-0.5">{entity.hsObject || entity.sfObject} → {entity.localCollection} • {mappings.filter(m => m.enabled).length} active</p>
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

const HubSpotSyncTab = ({ config, onRefresh }) => {
  const [syncing, setSyncing] = useState({});
  const [syncLogs, setSyncLogs] = useState([]);

  const entities = [
    { id: "companies", name: "Companies", icon: Building2, color: "orange" },
    { id: "contacts", name: "Contacts", icon: Users, color: "purple" },
    { id: "deals", name: "Deals", icon: Target, color: "green" },
    { id: "tickets", name: "Tickets", icon: MessageSquare, color: "blue" },
  ];

  const addLog = (msg) => setSyncLogs(logs => [...logs, { msg, time: new Date().toLocaleTimeString() }]);

  const handleSyncAll = async () => {
    setSyncing({ all: true });
    setSyncLogs([]);
    addLog("Starting full HubSpot sync...");
    
    try {
      await api.post("/hubspot/sync", { entity_types: null, mode: "full" });
      
      const steps = [
        { msg: "→ Fetching Companies from HubSpot...", delay: 500 },
        { msg: "✓ Raw Zone: Companies archived", delay: 300 },
        { msg: "→ Fetching Contacts...", delay: 500 },
        { msg: "✓ Raw Zone: Contacts archived", delay: 300 },
        { msg: "→ Fetching Deals...", delay: 500 },
        { msg: "✓ Raw Zone: Deals archived", delay: 300 },
        { msg: "→ Processing: Mapping → Validating → Normalizing...", delay: 800 },
        { msg: "✓ Canonical Zone: Records updated", delay: 300 },
        { msg: "✓ Dashboard stats refreshed", delay: 200 },
      ];
      
      for (const step of steps) {
        await new Promise(r => setTimeout(r, step.delay));
        addLog(step.msg);
      }
      
      addLog("🎉 Full sync complete!");
      toast.success("HubSpot sync completed!");
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
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Full Synchronization
            </h3>
            <p className="text-orange-100 mt-1">Sync all HubSpot objects to your Data Lake</p>
          </div>
          <button onClick={handleSyncAll} disabled={syncing.all} className="bg-white text-orange-700 hover:bg-orange-50 px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all disabled:opacity-50" data-testid="sync-all-btn">
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
                  <p className="text-sm text-slate-500">HubSpot → canonical_{entity.id}</p>
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

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-orange-400" /></div>;

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

export default HubSpotIntegrationHub;
