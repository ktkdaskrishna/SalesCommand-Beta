import React, { useState, useEffect, useCallback } from "react";
import api from "../services/api";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import ExpandableContainer from "./ExpandableContainer";
import {
  Database,
  RefreshCw,
  Check,
  X,
  AlertCircle,
  Play,
  ArrowRight,
  ArrowLeft,
  ArrowLeftRight,
  Loader2,
  Save,
  Clock,
  CheckCircle,
  XCircle,
  Building2,
  Calendar,
  Zap,
  History,
  Globe,
  User,
  Key,
  Server,
  Shield,
  Sparkles,
  Info,
  ExternalLink,
  Settings,
  Eye,
  FileText,
  Users,
  ShoppingCart,
  Activity,
  AlertTriangle,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  Link2,
  Unlink,
  HelpCircle,
  Copy,
  CheckCheck,
} from "lucide-react";

// ===================== MAIN VISUAL DATA FLOW HUB =====================

const VisualDataFlowHub = () => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState("canvas"); // canvas, settings, issues, logs
  const [syncingAll, setSyncingAll] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await api.get("/odoo/config");
      setConfig(response.data);
    } catch (error) {
      console.error("Failed to fetch config:", error);
      toast.error("Failed to load integration config");
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      const response = await api.post("/odoo/sync-all");
      const results = response.data.results || [];
      const totalCreated = results.reduce((sum, r) => sum + (r.created || 0), 0);
      const totalUpdated = results.reduce((sum, r) => sum + (r.updated || 0), 0);
      toast.success(`Sync complete: ${totalCreated} created, ${totalUpdated} updated`);
      fetchConfig();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Sync failed");
    } finally {
      setSyncingAll(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-purple-500 mx-auto mb-4" />
          <p className="text-slate-500">Loading Data Flow Hub...</p>
        </div>
      </div>
    );
  }

  const isConnected = config?.connection?.is_connected;

  return (
    <ExpandableContainer
      title="Visual Data Flow Hub"
      subtitle="Bi-directional sync between Odoo and your platform"
      icon={ArrowLeftRight}
      className="h-full"
    >
      <div className="flex flex-col h-full bg-slate-50" data-testid="visual-data-flow-hub">
        {/* Navigation Tabs */}
        <div className="bg-white border-b px-4">
          <div className="flex items-center justify-between">
            <div className="flex">
              {[
                { id: "canvas", label: "Data Flow", icon: ArrowLeftRight },
                { id: "settings", label: "Connection", icon: Settings },
                { id: "issues", label: "Issues", icon: AlertTriangle, badge: 0 },
                { id: "logs", label: "Sync History", icon: History },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveView(tab.id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all",
                      activeView === tab.id
                        ? "border-purple-600 text-purple-600"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    )}
                    data-testid={`tab-${tab.id}`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                    {tab.badge > 0 && (
                      <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            
            {/* Connection Status Badge */}
            <div className="flex items-center gap-3">
              {isConnected ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-green-700">
                    Connected to Odoo {config.connection.odoo_version}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-700">Not Connected</span>
                </div>
              )}
              
              <button
                onClick={handleSyncAll}
                disabled={syncingAll || !isConnected}
                className="btn-primary flex items-center gap-2"
                data-testid="sync-all-btn"
              >
                {syncingAll ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Sync All
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6">
          {activeView === "canvas" && (
            <DataFlowCanvas config={config} onRefresh={fetchConfig} />
          )}
          {activeView === "settings" && (
            <ConnectionSettings config={config} onRefresh={fetchConfig} />
          )}
          {activeView === "issues" && (
            <IssuesPanel />
          )}
          {activeView === "logs" && (
            <SyncLogsPanel />
          )}
        </div>
      </div>
    </ExpandableContainer>
  );
};

// ===================== DATA FLOW CANVAS =====================

const DataFlowCanvas = ({ config, onRefresh }) => {
  const [entities, setEntities] = useState([]);
  const [syncing, setSyncing] = useState({});

  useEffect(() => {
    if (config?.entity_mappings) {
      setEntities(config.entity_mappings.map(em => ({
        ...em,
        localEnabled: em.sync_enabled,
      })));
    }
  }, [config]);

  const entityConfig = {
    "partner_to_accounts": {
      icon: Building2,
      color: "purple",
      label: "Contacts & Companies",
      odooModel: "res.partner",
      localModel: "Accounts",
      description: "Customer and vendor contacts",
    },
    "lead_to_opportunities": {
      icon: Zap,
      color: "blue", 
      label: "Opportunities",
      odooModel: "crm.lead",
      localModel: "Opportunities",
      description: "Sales leads and deals",
    },
    "activity_to_activities": {
      icon: Calendar,
      color: "amber",
      label: "Activities",
      odooModel: "mail.activity",
      localModel: "Activities",
      description: "Tasks, calls, meetings",
    },
  };

  const handleToggleSync = async (entityId, enabled) => {
    try {
      await api.put(`/odoo/mappings/${entityId}/toggle`, { sync_enabled: enabled });
      setEntities(entities.map(e => 
        e.id === entityId ? { ...e, sync_enabled: enabled } : e
      ));
      toast.success(`${enabled ? 'Enabled' : 'Disabled'} sync for ${entityConfig[entityId]?.label || entityId}`);
    } catch (error) {
      toast.error("Failed to update sync status");
    }
  };

  const handleSyncEntity = async (entityId) => {
    setSyncing({ ...syncing, [entityId]: true });
    try {
      const response = await api.post(`/odoo/sync/${entityId}`);
      const result = response.data;
      toast.success(
        `Synced: ${result.created} created, ${result.updated} updated` +
        (result.failed > 0 ? `, ${result.failed} failed` : "")
      );
      onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Sync failed");
    } finally {
      setSyncing({ ...syncing, [entityId]: false });
    }
  };

  const isConnected = config?.connection?.is_connected;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Visual Flow Diagram */}
      <div className="bg-white rounded-2xl border shadow-sm p-8 mb-6">
        <div className="flex items-center justify-center gap-8">
          {/* Odoo System */}
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-lg">
              <Database className="w-12 h-12 text-white" />
            </div>
            <h3 className="mt-3 font-bold text-slate-900">Odoo ERP</h3>
            <p className="text-sm text-slate-500">Source System</p>
            {isConnected && (
              <span className="mt-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                v{config.connection.odoo_version}
              </span>
            )}
          </div>

          {/* Bi-directional Arrow */}
          <div className="flex flex-col items-center px-8">
            <div className="flex items-center gap-2">
              <ArrowLeft className="w-6 h-6 text-blue-500" />
              <div className="w-32 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 rounded-full" />
              <ArrowRight className="w-6 h-6 text-blue-500" />
            </div>
            <div className="mt-3 text-center">
              <p className="text-sm font-semibold text-slate-700">Real-time Sync</p>
              <p className="text-xs text-slate-500">Bi-directional</p>
            </div>
          </div>

          {/* This Platform */}
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center shadow-lg">
              <Activity className="w-12 h-12 text-white" />
            </div>
            <h3 className="mt-3 font-bold text-slate-900">Sales Platform</h3>
            <p className="text-sm text-slate-500">Reporting & Analytics</p>
          </div>
        </div>
      </div>

      {/* Entity Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {entities.map((entity) => {
          const ec = entityConfig[entity.id] || {
            icon: Database,
            color: "slate",
            label: entity.name,
            description: "",
          };
          const Icon = ec.icon;
          const isSyncing = syncing[entity.id];

          return (
            <div
              key={entity.id}
              className={cn(
                "bg-white rounded-xl border-2 p-5 transition-all",
                entity.sync_enabled 
                  ? `border-${ec.color}-200 shadow-md` 
                  : "border-slate-200 opacity-70"
              )}
              data-testid={`entity-card-${entity.id}`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center",
                    entity.sync_enabled ? `bg-${ec.color}-100` : "bg-slate-100"
                  )}>
                    <Icon className={cn(
                      "w-6 h-6",
                      entity.sync_enabled ? `text-${ec.color}-600` : "text-slate-400"
                    )} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">{ec.label}</h4>
                    <p className="text-xs text-slate-500">{ec.description}</p>
                  </div>
                </div>
                
                {/* Toggle */}
                <button
                  onClick={() => handleToggleSync(entity.id, !entity.sync_enabled)}
                  className={cn(
                    "p-1 rounded-full transition-colors",
                    entity.sync_enabled 
                      ? "text-green-600 hover:bg-green-50" 
                      : "text-slate-400 hover:bg-slate-100"
                  )}
                  title={entity.sync_enabled ? "Disable sync" : "Enable sync"}
                >
                  {entity.sync_enabled ? (
                    <ToggleRight className="w-8 h-8" />
                  ) : (
                    <ToggleLeft className="w-8 h-8" />
                  )}
                </button>
              </div>

              {/* Data Flow Indicator */}
              <div className="flex items-center justify-center gap-2 py-3 bg-slate-50 rounded-lg mb-4">
                <span className="text-xs font-medium text-purple-600">{entity.odoo_model}</span>
                <ArrowLeftRight className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-medium text-blue-600">{entity.local_collection}</span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="text-center p-2 bg-slate-50 rounded-lg">
                  <p className="text-lg font-bold text-slate-900">
                    {entity.field_mappings?.filter(f => f.enabled).length || 0}
                  </p>
                  <p className="text-xs text-slate-500">Fields Mapped</p>
                </div>
                <div className="text-center p-2 bg-slate-50 rounded-lg">
                  <p className="text-lg font-bold text-slate-900">
                    {entity.last_sync_at ? "✓" : "—"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {entity.last_sync_at 
                      ? new Date(entity.last_sync_at).toLocaleDateString()
                      : "Never synced"
                    }
                  </p>
                </div>
              </div>

              {/* Sync Button */}
              <button
                onClick={() => handleSyncEntity(entity.id)}
                disabled={isSyncing || !entity.sync_enabled || !isConnected}
                className={cn(
                  "w-full py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-all",
                  entity.sync_enabled && isConnected
                    ? `bg-${ec.color}-600 hover:bg-${ec.color}-700 text-white`
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                )}
              >
                {isSyncing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {isSyncing ? "Syncing..." : "Sync Now"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Conflict Resolution Settings */}
      <div className="mt-6 bg-white rounded-xl border p-5">
        <h4 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-purple-600" />
          Conflict Resolution Policy
        </h4>
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: "odoo_master", label: "Odoo is Master", desc: "Odoo data always wins" },
            { id: "last_updated", label: "Last Updated Wins", desc: "Most recent change wins" },
            { id: "smart_merge", label: "Smart Merge", desc: "Keep both, flag conflicts" },
          ].map((policy) => (
            <label
              key={policy.id}
              className={cn(
                "flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
                config?.conflict_policy === policy.id
                  ? "border-purple-500 bg-purple-50"
                  : "border-slate-200 hover:border-slate-300"
              )}
            >
              <input
                type="radio"
                name="conflict_policy"
                value={policy.id}
                checked={config?.conflict_policy === policy.id}
                onChange={() => {}}
                className="mt-1"
              />
              <div>
                <p className="font-medium text-slate-900">{policy.label}</p>
                <p className="text-xs text-slate-500">{policy.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Webhook Setup Info */}
      <div className="mt-6 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
        <h4 className="font-semibold text-blue-900 flex items-center gap-2 mb-3">
          <Zap className="w-5 h-5" />
          Real-Time Webhook Setup
        </h4>
        <p className="text-sm text-blue-700 mb-4">
          To enable real-time sync from Odoo, configure a webhook in Odoo Studio:
        </p>
        <WebhookInstructions />
      </div>
    </div>
  );
};

// ===================== WEBHOOK INSTRUCTIONS =====================

const WebhookInstructions = () => {
  const [copied, setCopied] = useState(false);
  const webhookUrl = `${window.location.origin}/api/webhooks/odoo`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-3 bg-white rounded-lg border">
        <code className="flex-1 text-sm text-slate-700 truncate">{webhookUrl}</code>
        <button
          onClick={copyToClipboard}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          {copied ? (
            <CheckCheck className="w-4 h-4 text-green-600" />
          ) : (
            <Copy className="w-4 h-4 text-slate-500" />
          )}
        </button>
      </div>
      <ol className="text-sm text-blue-700 space-y-1.5">
        <li className="flex items-start gap-2">
          <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
          Open Odoo Studio → Automations
        </li>
        <li className="flex items-start gap-2">
          <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
          Create new automation for each model (res.partner, crm.lead, etc.)
        </li>
        <li className="flex items-start gap-2">
          <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
          Set trigger: On Creation / On Update
        </li>
        <li className="flex items-start gap-2">
          <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
          Add action: &quot;Send Webhook&quot; with the URL above
        </li>
      </ol>
    </div>
  );
};

// ===================== CONNECTION SETTINGS =====================

const ConnectionSettings = ({ config, onRefresh }) => {
  const [formData, setFormData] = useState({
    url: config?.connection?.url || "",
    database: config?.connection?.database || "",
    username: config?.connection?.username || "",
    api_key: "",
  });
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleSave = async () => {
    if (!formData.url || !formData.database || !formData.username) {
      toast.error("Please fill in URL, Database, and Username");
      return;
    }
    
    setSaving(true);
    try {
      // Normalize URL
      let normalizedUrl = formData.url.trim().replace(/\/(odoo|web|jsonrpc)\/?$/i, "").replace(/\/+$/, "");
      
      await api.put("/odoo/config/connection", {
        ...formData,
        url: normalizedUrl,
      });
      toast.success("Connection settings saved");
      
      // Auto-test after save
      await handleTest();
      onRefresh();
    } catch (error) {
      toast.error("Failed to save connection settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await api.post("/odoo/test-connection");
      setTestResult(response.data);
      if (response.data.success) {
        toast.success("Connection successful!");
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error.response?.data?.detail || "Connection failed"
      });
      toast.error("Connection test failed");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-xl border p-6">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-6">
          <Globe className="w-5 h-5 text-purple-600" />
          Odoo Connection Settings
        </h3>

        <div className="space-y-4">
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
          </div>

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
          </div>

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

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Key className="w-4 h-4 text-slate-400" />
              API Key
              {config?.connection?.api_key && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Saved</span>
              )}
            </label>
            <input
              type="password"
              value={formData.api_key}
              onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
              className="input w-full"
              placeholder={config?.connection?.api_key ? "••••••••••••" : "Enter your Odoo API key"}
              data-testid="odoo-apikey-input"
            />
          </div>
        </div>

        {/* Test Result */}
        {testResult && (
          <div className={cn(
            "mt-4 p-4 rounded-xl flex items-start gap-3",
            testResult.success 
              ? "bg-green-50 border border-green-200" 
              : "bg-red-50 border border-red-200"
          )}>
            {testResult.success ? (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            )}
            <div>
              <p className={cn("font-semibold", testResult.success ? "text-green-800" : "text-red-800")}>
                {testResult.success ? "Connection Successful!" : "Connection Failed"}
              </p>
              <p className={cn("text-sm", testResult.success ? "text-green-600" : "text-red-600")}>
                {testResult.message}
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            data-testid="save-connection-btn"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save & Connect
          </button>
          <button
            onClick={handleTest}
            disabled={testing}
            className="btn-secondary flex items-center gap-2"
            data-testid="test-connection-btn"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Test
          </button>
        </div>
      </div>

      {/* Help Card */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5">
        <h4 className="font-semibold text-amber-900 flex items-center gap-2 mb-3">
          <HelpCircle className="w-5 h-5" />
          How to Get Your Odoo API Key
        </h4>
        <ol className="text-sm text-amber-700 space-y-2">
          <li>1. Log into your Odoo instance as Administrator</li>
          <li>2. Go to <strong>Settings → Users & Companies → Users</strong></li>
          <li>3. Select your user account</li>
          <li>4. Click <strong>"Account Security"</strong> tab → <strong>"New API Key"</strong></li>
          <li>5. Copy the generated key and paste it above</li>
        </ol>
      </div>
    </div>
  );
};

// ===================== ISSUES PANEL =====================

const IssuesPanel = () => {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch sync issues/conflicts
    setLoading(false);
    // Mock data for now
    setIssues([]);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {issues.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">No Sync Issues</h3>
          <p className="text-sm text-slate-500 mt-1">
            All data is synchronized correctly between Odoo and your platform
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {issues.map((issue, idx) => (
            <div key={idx} className="bg-white rounded-xl border p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-slate-900">{issue.title}</p>
                    <p className="text-sm text-slate-500">{issue.description}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn-secondary text-sm">Keep Odoo</button>
                  <button className="btn-secondary text-sm">Keep Platform</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ===================== SYNC LOGS PANEL =====================

const SyncLogsPanel = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await api.get("/odoo/sync-logs?limit=50");
      setLogs(response.data || []);
    } catch (error) {
      toast.error("Failed to load sync logs");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  const statusConfig = {
    success: { icon: CheckCircle, color: "green" },
    failed: { icon: XCircle, color: "red" },
    partial: { icon: AlertCircle, color: "amber" },
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-slate-500" />
            Sync History
          </h3>
          <button onClick={fetchLogs} className="btn-secondary text-sm flex items-center gap-1.5">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
        
        {logs.length === 0 ? (
          <div className="p-12 text-center">
            <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No sync history yet</p>
          </div>
        ) : (
          <div className="divide-y">
            {logs.map((log, idx) => {
              const status = statusConfig[log.status] || statusConfig.success;
              const StatusIcon = status.icon;
              
              return (
                <div key={idx} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full bg-${status.color}-100 flex items-center justify-center`}>
                        <StatusIcon className={`w-5 h-5 text-${status.color}-600`} />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{log.entity_mapping_id}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(log.started_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-green-600 font-medium">+{log.records_created}</span>
                        <span className="text-blue-600 font-medium">~{log.records_updated}</span>
                        {log.records_failed > 0 && (
                          <span className="text-red-600 font-medium">!{log.records_failed}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default VisualDataFlowHub;
