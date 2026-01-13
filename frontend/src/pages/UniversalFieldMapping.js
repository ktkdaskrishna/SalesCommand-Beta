/**
 * Universal Field Mapping
 * Unified field mapping for ALL integrations (Odoo, MS365, Salesforce, etc.)
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  ArrowRight, Plus, Trash2, Save, Wand2, Loader2,
  AlertCircle, Check, X, Search, Database, Cloud
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const UniversalFieldMapping = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // State
  const [selectedIntegration, setSelectedIntegration] = useState('odoo');
  const [selectedEntity, setSelectedEntity] = useState('account');
  const [mappings, setMappings] = useState([]);
  const [sourceFields, setSourceFields] = useState([]);
  const [targetSchema, setTargetSchema] = useState([]);

  const integrations = [
    { value: 'odoo', label: 'Odoo ERP', icon: Database, color: 'purple' },
    { value: 'ms365', label: 'Microsoft 365', icon: Cloud, color: 'blue' },
    { value: 'salesforce', label: 'Salesforce', icon: Database, color: 'cyan' },
  ];

  const entityTypes = {
    odoo: [
      { value: 'account', label: 'Accounts (Partners)' },
      { value: 'contact', label: 'Contacts' },
      { value: 'opportunity', label: 'Opportunities (Leads)' },
      { value: 'order', label: 'Sale Orders' },
    ],
    ms365: [
      { value: 'user', label: 'Users (Directory)' },
      { value: 'email', label: 'Emails' },
      { value: 'calendar', label: 'Calendar Events' },
    ],
    salesforce: [
      { value: 'lead', label: 'Leads' },
      { value: 'account', label: 'Accounts' },
      { value: 'opportunity', label: 'Opportunities' },
    ],
  };

  useEffect(() => {
    if (selectedIntegration && selectedEntity) {
      fetchMappings();
    }
  }, [selectedIntegration, selectedEntity]);

  const fetchMappings = async () => {
    if (!token) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(
        `${API_URL}/api/integrations/mappings/${selectedIntegration}/${selectedEntity}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();

      if (res.ok) {
        setMappings(data.mappings || []);
        setTargetSchema(data.canonical_schema || []);
        // Source fields would come from integration
      } else {
        setError(data.detail || 'Failed to load mappings');
      }
    } catch (err) {
      setError('Failed to fetch mappings');
    } finally {
      setLoading(false);
    }
  };

  const saveMappings = async () => {
    if (!token) return;
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(
        `${API_URL}/api/integrations/mappings/${selectedIntegration}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            entity_type: selectedEntity,
            mappings: mappings,
          }),
        }
      );

      if (res.ok) {
        setSuccess('Mappings saved successfully!');
      } else {
        const data = await res.json();
        setError(data.detail || 'Failed to save mappings');
      }
    } catch (err) {
      setError('Failed to save mappings');
    } finally {
      setSaving(false);
    }
  };

  const addMapping = () => {
    setMappings([
      ...mappings,
      {
        source_field: '',
        target_field: '',
        transform: null,
        is_confirmed: false,
      },
    ]);
  };

  const updateMapping = (index, field, value) => {
    const newMappings = [...mappings];
    newMappings[index][field] = value;
    setMappings(newMappings);
  };

  const removeMapping = (index) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  const selectedIntegrationData = integrations.find(
    (i) => i.value === selectedIntegration
  );
  const IntegrationIcon = selectedIntegrationData?.icon || Database;
  const integrationColor = selectedIntegrationData?.color || 'emerald';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Universal Field Mapping</h1>
        <p className="text-zinc-500 mt-1">
          Map fields from external integrations to your unified data model
        </p>
      </div>

      {/* Integration & Entity Selection */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <Label className="text-zinc-300 mb-3 block">Select Integration</Label>
            <div className="grid grid-cols-2 gap-3">
              {integrations.map((intg) => {
                const Icon = intg.icon;
                return (
                  <button
                    key={intg.value}
                    onClick={() => {
                      setSelectedIntegration(intg.value);
                      setSelectedEntity(entityTypes[intg.value][0].value);
                    }}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                      selectedIntegration === intg.value
                        ? `border-${intg.color}-500 bg-${intg.color}-500/10`
                        : 'border-zinc-700 hover:border-zinc-600'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${selectedIntegration === intg.value ? `text-${intg.color}-400` : 'text-zinc-400'}`} />
                    <span className={selectedIntegration === intg.value ? 'text-white font-medium' : 'text-zinc-400'}>
                      {intg.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label className="text-zinc-300 mb-3 block">Select Entity Type</Label>
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white"
            >
              {(entityTypes[selectedIntegration] || []).map((entity) => (
                <option key={entity.value} value={entity.value}>
                  {entity.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          <AlertCircle className="w-4 h-4" />
          {error}
          <button onClick={() => setError('')} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
          <Check className="w-4 h-4" />
          {success}
        </div>
      )}

      {/* Mapping Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white">Field Mappings</h2>
            <div className="flex gap-3">
              <Button
                onClick={addMapping}
                variant="outline"
                className="border-zinc-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Mapping
              </Button>
              <Button
                onClick={saveMappings}
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-500"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Mappings
              </Button>
            </div>
          </div>

          {mappings.length === 0 ? (
            <div className="text-center py-12">
              <Database className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400">No mappings defined yet</p>
              <p className="text-zinc-600 text-sm mt-1">
                Click &quot;Add Mapping&quot; to start mapping fields
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {mappings.map((mapping, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 p-4 bg-zinc-800/50 rounded-lg"
                >
                  <div className="flex-1">
                    <Label className="text-xs text-zinc-500 mb-1 block">
                      Source Field ({selectedIntegrationData?.label})
                    </Label>
                    <Input
                      value={mapping.source_field}
                      onChange={(e) =>
                        updateMapping(index, 'source_field', e.target.value)
                      }
                      placeholder="e.g., name, email, partner_id"
                      className="bg-zinc-900 border-zinc-700"
                    />
                  </div>

                  <ArrowRight className="w-5 h-5 text-zinc-600 mt-5" />

                  <div className="flex-1">
                    <Label className="text-xs text-zinc-500 mb-1 block">
                      Target Field (Canonical)
                    </Label>
                    <Input
                      value={mapping.target_field}
                      onChange={(e) =>
                        updateMapping(index, 'target_field', e.target.value)
                      }
                      placeholder="e.g., company_name, email_address"
                      className="bg-zinc-900 border-zinc-700"
                    />
                  </div>

                  <div className="w-48">
                    <Label className="text-xs text-zinc-500 mb-1 block">
                      Transform
                    </Label>
                    <select
                      value={mapping.transform || ''}
                      onChange={(e) =>
                        updateMapping(index, 'transform', e.target.value || null)
                      }
                      className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white text-sm"
                    >
                      <option value="">None</option>
                      <option value="uppercase">Uppercase</option>
                      <option value="lowercase">Lowercase</option>
                      <option value="trim">Trim Spaces</option>
                      <option value="date_parse">Parse Date</option>
                    </select>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeMapping(index)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 mt-5"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UniversalFieldMapping;
