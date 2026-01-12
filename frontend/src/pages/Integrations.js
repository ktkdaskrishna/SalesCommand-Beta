/**
 * Integrations Page
 * Manage all ERP integrations (Odoo, Salesforce, etc.)
 */
import React, { useState, useEffect } from 'react';
import { integrationsAPI } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import {
  Plug2,
  Settings,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Play,
  AlertCircle,
  Wand2,
  Save,
  ChevronRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../components/ui/dialog';

const Integrations = () => {
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [configModal, setConfigModal] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);

  // Odoo config form
  const [odooConfig, setOdooConfig] = useState({
    url: '',
    database: '',
    username: '',
    api_key: '',
  });

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    setLoading(true);
    try {
      const response = await integrationsAPI.list();
      setIntegrations(response.data);
    } catch (error) {
      console.error('Failed to fetch integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigureOdoo = () => {
    setSelectedIntegration('odoo');
    setConfigModal(true);
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    setTestResult({ testing: true });
    try {
      const response = await integrationsAPI.testOdoo(odooConfig);
      setTestResult(response.data);
    } catch (error) {
      setTestResult({
        success: false,
        message: error.response?.data?.detail || 'Connection test failed',
      });
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      await integrationsAPI.configureOdoo(odooConfig);
      toast.success('Odoo integration configured successfully!');
      setConfigModal(false);
      setTestResult(null);
      // Refresh integrations list
      await fetchIntegrations();
    } catch (error) {
      console.error('Failed to save config:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerSync = async (integrationType) => {
    try {
      toast.info('Starting sync...');
      const response = await integrationsAPI.triggerSync(integrationType);
      toast.success(`Sync job started: ${response.data.job_id}`);
      // Refresh to show updated status
      await fetchIntegrations();
    } catch (error) {
      console.error('Failed to trigger sync:', error);
      toast.error(error.response?.data?.detail || 'Failed to start sync');
    }
  };
  };

  const getIntegrationDetails = (type) => {
    const details = {
      odoo: {
        name: 'Odoo ERP',
        description: 'Connect to Odoo 16+ for accounts, opportunities, orders, and invoices.',
        color: 'purple',
      },
      salesforce: {
        name: 'Salesforce',
        description: 'Sync with Salesforce CRM for unified sales data.',
        color: 'blue',
      },
      ms365: {
        name: 'Microsoft 365',
        description: 'SSO authentication and calendar integration.',
        color: 'cyan',
      },
      hubspot: {
        name: 'HubSpot',
        description: 'Marketing and sales automation integration.',
        color: 'orange',
      },
    };
    return details[type] || { name: type, description: '', color: 'zinc' };
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Integrations</h1>
          <p className="text-zinc-400 mt-1">Connect and manage your ERP systems</p>
        </div>
        <Button
          onClick={fetchIntegrations}
          variant="outline"
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 text-zinc-500 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {integrations.map((integration) => {
            const details = getIntegrationDetails(integration.integration_type);
            return (
              <div
                key={integration.id}
                className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6"
                data-testid={`integration-panel-${integration.integration_type}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl bg-${details.color}-500/10`}>
                      <Plug2 className={`w-6 h-6 text-${details.color}-500`} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">{details.name}</h3>
                      <p className="text-zinc-500 text-sm">{details.description}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    integration.enabled 
                      ? 'bg-emerald-500/10 text-emerald-400' 
                      : 'bg-zinc-500/10 text-zinc-400'
                  }`}>
                    {integration.enabled ? 'Connected' : 'Not Connected'}
                  </span>
                </div>

                {/* Status Info */}
                <div className="bg-zinc-800/50 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-zinc-500">Status</p>
                      <p className="text-white capitalize">{integration.sync_status}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Last Sync</p>
                      <p className="text-white">
                        {integration.last_sync 
                          ? new Date(integration.last_sync).toLocaleString()
                          : 'Never'
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  {integration.integration_type === 'odoo' && (
                    <Button
                      onClick={handleConfigureOdoo}
                      className="flex-1 bg-purple-600 hover:bg-purple-500"
                      data-testid="configure-odoo-btn"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Configure
                    </Button>
                  )}
                  {integration.enabled && (
                    <Button
                      onClick={() => handleTriggerSync(integration.integration_type)}
                      variant="outline"
                      className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                      data-testid={`sync-${integration.integration_type}-btn`}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Sync Now
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Odoo Configuration Modal */}
      <Dialog open={configModal} onOpenChange={setConfigModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Configure Odoo Integration</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Connect to your Odoo instance using REST API credentials
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-zinc-300">Odoo URL</Label>
              <Input
                value={odooConfig.url}
                onChange={(e) => setOdooConfig({ ...odooConfig, url: e.target.value })}
                placeholder="https://yourcompany.odoo.com"
                className="bg-zinc-800 border-zinc-700 text-white"
                data-testid="odoo-url-input"
              />
              <p className="text-xs text-zinc-500">Base URL only. No /web or /odoo suffix needed.</p>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300">Database Name</Label>
              <Input
                value={odooConfig.database}
                onChange={(e) => setOdooConfig({ ...odooConfig, database: e.target.value })}
                placeholder="yourcompany"
                className="bg-zinc-800 border-zinc-700 text-white"
                data-testid="odoo-database-input"
              />
              <p className="text-xs text-zinc-500">Usually your subdomain (e.g., "securadotest")</p>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300">Username / Email</Label>
              <Input
                value={odooConfig.username}
                onChange={(e) => setOdooConfig({ ...odooConfig, username: e.target.value })}
                placeholder="admin@yourcompany.com"
                className="bg-zinc-800 border-zinc-700 text-white"
                data-testid="odoo-username-input"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300">API Key</Label>
              <Input
                type="password"
                value={odooConfig.api_key}
                onChange={(e) => setOdooConfig({ ...odooConfig, api_key: e.target.value })}
                placeholder="••••••••••••••••"
                className="bg-zinc-800 border-zinc-700 text-white"
                data-testid="odoo-apikey-input"
              />
              <p className="text-xs text-zinc-500">Generate in Odoo: Settings → Users → API Keys</p>
            </div>

            {/* Test Result */}
            {testResult && (
              <div className={`p-3 rounded-lg ${
                testResult.testing 
                  ? 'bg-zinc-800 border border-zinc-700'
                  : testResult.success 
                    ? 'bg-emerald-500/10 border border-emerald-500/20'
                    : 'bg-red-500/10 border border-red-500/20'
              }`}>
                {testResult.testing ? (
                  <div className="flex items-center gap-2 text-zinc-400 text-sm">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Testing connection...
                  </div>
                ) : testResult.success ? (
                  <div className="flex items-center gap-2 text-emerald-400 text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    {testResult.message}
                  </div>
                ) : (
                  <div className="flex items-start gap-2 text-red-400 text-sm">
                    <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{testResult.message}</span>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleTestConnection}
                variant="outline"
                className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                data-testid="test-odoo-connection-btn"
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                Test
              </Button>
              <Button
                onClick={handleSaveConfig}
                disabled={saving || !testResult?.success}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500"
                data-testid="save-odoo-config-btn"
              >
                {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Integrations;
