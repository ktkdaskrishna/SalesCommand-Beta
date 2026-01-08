import React, { useState, useEffect } from "react";
import { integrationsAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { cn } from "../lib/utils";
import {
  Settings,
  Loader2,
  Check,
  X,
  ExternalLink,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

const INTEGRATIONS = [
  {
    type: "odoo",
    name: "Odoo ERP",
    description: "Sync accounts, opportunities, and revenue data from Odoo",
    icon: "🔗",
    fields: ["api_url", "api_key"],
  },
  {
    type: "office365",
    name: "Microsoft Office 365",
    description: "Sync calendar, emails, and meetings from Outlook",
    icon: "📧",
    fields: ["client_id", "client_secret", "tenant_id"],
  },
];

const Integrations = () => {
  const { isExecutive } = useAuth();
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [editingIntegration, setEditingIntegration] = useState(null);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      const response = await integrationsAPI.getAll();
      setIntegrations(response.data);
    } catch (error) {
      console.error("Error fetching integrations:", error);
    } finally {
      setLoading(false);
    }
  };

  const getIntegrationData = (type) => {
    return integrations.find((i) => i.integration_type === type) || {
      integration_type: type,
      enabled: false,
      status: "disconnected",
    };
  };

  const handleEdit = (integration) => {
    setEditingIntegration(integration.type);
    setFormData({
      integration_type: integration.type,
      enabled: getIntegrationData(integration.type).enabled,
      api_url: "",
      api_key: "",
      client_id: "",
      client_secret: "",
      tenant_id: "",
      sync_interval_minutes: 60,
    });
  };

  const handleSave = async (type) => {
    setSaving(type);
    try {
      await integrationsAPI.save({
        ...formData,
        integration_type: type,
      });
      await fetchIntegrations();
      setEditingIntegration(null);
    } catch (error) {
      console.error("Error saving integration:", error);
    } finally {
      setSaving(null);
    }
  };

  const handleToggle = async (type, enabled) => {
    setSaving(type);
    try {
      const existing = getIntegrationData(type);
      await integrationsAPI.save({
        integration_type: type,
        enabled: !enabled,
        sync_interval_minutes: existing.sync_interval_minutes || 60,
        settings: {},
      });
      await fetchIntegrations();
    } catch (error) {
      console.error("Error toggling integration:", error);
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!isExecutive()) {
    return (
      <div className="card p-12 text-center">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 mb-2">
          Access Restricted
        </h3>
        <p className="text-slate-500">
          Only administrators can manage integrations.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-in space-y-6" data-testid="integrations-page">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <Settings className="w-8 h-8 text-blue-600" />
          Integrations
        </h1>
        <p className="text-slate-600 mt-1">
          Connect external systems to sync data automatically
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-900">
            Integration Configuration
          </p>
          <p className="text-sm text-blue-700 mt-1">
            These integrations are configurable for future connection to Odoo ERP and Microsoft Office 365.
            Currently in mock mode for demonstration purposes.
          </p>
        </div>
      </div>

      {/* Integration Cards */}
      <div className="space-y-4">
        {INTEGRATIONS.map((integration) => {
          const data = getIntegrationData(integration.type);
          const isEditing = editingIntegration === integration.type;
          const isSaving = saving === integration.type;

          return (
            <div key={integration.type} className="card" data-testid={`integration-${integration.type}`}>
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl">
                      {integration.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 text-lg">
                        {integration.name}
                      </h3>
                      <p className="text-sm text-slate-500">
                        {integration.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "px-2.5 py-0.5 rounded-full text-xs font-semibold border",
                        data.status === "connected"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : data.status === "error"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-slate-50 text-slate-700 border-slate-200"
                      )}
                    >
                      {data.status === "connected" ? "Connected" : data.status === "error" ? "Error" : "Not Connected"}
                    </span>

                    <button
                      onClick={() => handleToggle(integration.type, data.enabled)}
                      disabled={isSaving}
                      className={cn(
                        "relative w-12 h-6 rounded-full transition-colors",
                        data.enabled ? "bg-blue-600" : "bg-slate-200"
                      )}
                      data-testid={`toggle-${integration.type}`}
                    >
                      <span
                        className={cn(
                          "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow",
                          data.enabled ? "translate-x-7" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>
                </div>

                {/* Configuration Form */}
                {isEditing ? (
                  <div className="mt-6 border-t border-slate-100 pt-6 space-y-4">
                    {integration.fields.includes("api_url") && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          API URL
                        </label>
                        <input
                          type="url"
                          value={formData.api_url}
                          onChange={(e) => setFormData({ ...formData, api_url: e.target.value })}
                          className="input"
                          placeholder="https://your-odoo-instance.com"
                        />
                      </div>
                    )}

                    {integration.fields.includes("api_key") && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          API Key
                        </label>
                        <input
                          type="password"
                          value={formData.api_key}
                          onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                          className="input"
                          placeholder="Enter API key"
                        />
                      </div>
                    )}

                    {integration.fields.includes("client_id") && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Client ID
                          </label>
                          <input
                            type="text"
                            value={formData.client_id}
                            onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                            className="input"
                            placeholder="Azure AD Client ID"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Tenant ID
                          </label>
                          <input
                            type="text"
                            value={formData.tenant_id}
                            onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
                            className="input"
                            placeholder="Azure AD Tenant ID"
                          />
                        </div>
                      </div>
                    )}

                    {integration.fields.includes("client_secret") && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Client Secret
                        </label>
                        <input
                          type="password"
                          value={formData.client_secret}
                          onChange={(e) => setFormData({ ...formData, client_secret: e.target.value })}
                          className="input"
                          placeholder="Enter client secret"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Sync Interval (minutes)
                      </label>
                      <select
                        value={formData.sync_interval_minutes}
                        onChange={(e) => setFormData({ ...formData, sync_interval_minutes: parseInt(e.target.value) })}
                        className="input w-auto"
                      >
                        <option value={15}>Every 15 minutes</option>
                        <option value={30}>Every 30 minutes</option>
                        <option value={60}>Every hour</option>
                        <option value={120}>Every 2 hours</option>
                      </select>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        onClick={() => setEditingIntegration(null)}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSave(integration.type)}
                        disabled={isSaving}
                        className="btn-primary flex items-center gap-2"
                      >
                        {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                        Save Configuration
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex items-center gap-4">
                    <button
                      onClick={() => handleEdit(integration)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      data-testid={`configure-${integration.type}`}
                    >
                      Configure
                    </button>
                    {data.last_sync && (
                      <span className="text-sm text-slate-500 flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" />
                        Last sync: {new Date(data.last_sync).toLocaleString()}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Help Section */}
      <div className="card p-6">
        <h3 className="font-semibold text-slate-900 mb-3">Need Help?</h3>
        <div className="space-y-2 text-sm text-slate-600">
          <p>
            <strong>Odoo ERP:</strong> You'll need API credentials from your Odoo administrator.
            <a href="https://www.odoo.com/documentation" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-1 inline-flex items-center gap-1">
              View docs <ExternalLink className="w-3 h-3" />
            </a>
          </p>
          <p>
            <strong>Office 365:</strong> Requires Azure AD app registration with appropriate permissions.
            <a href="https://docs.microsoft.com/azure/active-directory/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-1 inline-flex items-center gap-1">
              View docs <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Integrations;
