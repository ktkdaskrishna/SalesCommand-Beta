/**
 * Field Mapping Page
 * AI-powered field mapping interface for integrations
 */
import React, { useState, useEffect } from 'react';
import { integrationsAPI } from '../services/api';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import {
  Wand2,
  Save,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Sparkles,
  Database,
  Layers,
  Info,
  ChevronDown,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../components/ui/dialog';

// Odoo model mappings
const ODOO_MODELS = {
  account: { model: 'res.partner', label: 'Accounts (Companies)' },
  contact: { model: 'res.partner', label: 'Contacts (People)' },
  opportunity: { model: 'crm.lead', label: 'Opportunities (CRM)' },
  order: { model: 'sale.order', label: 'Sales Orders' },
  invoice: { model: 'account.move', label: 'Invoices' },
};

const FieldMapping = () => {
  const [selectedEntity, setSelectedEntity] = useState('opportunity');
  const [sourceFields, setSourceFields] = useState({});
  const [canonicalSchema, setCanonicalSchema] = useState({});
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [autoMapping, setAutoMapping] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    loadMappingData();
  }, [selectedEntity]);

  const loadMappingData = async () => {
    setLoading(true);
    try {
      // Load source fields from Odoo
      const modelInfo = ODOO_MODELS[selectedEntity];
      if (modelInfo) {
        try {
          const fieldsRes = await integrationsAPI.getOdooFields(modelInfo.model);
          setSourceFields(fieldsRes.data.fields || {});
        } catch (e) {
          console.log('Could not load Odoo fields, using defaults');
          setSourceFields(getDefaultOdooFields(selectedEntity));
        }
      }

      // Load existing mappings and canonical schema
      const mappingsRes = await integrationsAPI.getMappings('odoo', selectedEntity);
      setCanonicalSchema(mappingsRes.data.canonical_schema || {});
      setMappings(mappingsRes.data.mappings || []);
    } catch (error) {
      console.error('Failed to load mapping data:', error);
      // Use default canonical schema
      setCanonicalSchema(getDefaultCanonicalSchema(selectedEntity));
    } finally {
      setLoading(false);
    }
  };

  const getDefaultOdooFields = (entity) => {
    const defaults = {
      account: {
        id: { string: 'ID', type: 'integer' },
        name: { string: 'Name', type: 'char' },
        email: { string: 'Email', type: 'char' },
        phone: { string: 'Phone', type: 'char' },
        mobile: { string: 'Mobile', type: 'char' },
        website: { string: 'Website', type: 'char' },
        street: { string: 'Street', type: 'char' },
        city: { string: 'City', type: 'char' },
        zip: { string: 'ZIP', type: 'char' },
        state_id: { string: 'State', type: 'many2one' },
        country_id: { string: 'Country', type: 'many2one' },
        industry_id: { string: 'Industry', type: 'many2one' },
        user_id: { string: 'Salesperson', type: 'many2one' },
        create_date: { string: 'Created', type: 'datetime' },
        write_date: { string: 'Modified', type: 'datetime' },
      },
      opportunity: {
        id: { string: 'ID', type: 'integer' },
        name: { string: 'Opportunity Name', type: 'char' },
        partner_id: { string: 'Customer', type: 'many2one' },
        expected_revenue: { string: 'Expected Revenue', type: 'monetary' },
        probability: { string: 'Probability (%)', type: 'float' },
        stage_id: { string: 'Stage', type: 'many2one' },
        user_id: { string: 'Salesperson', type: 'many2one' },
        date_deadline: { string: 'Expected Closing', type: 'date' },
        description: { string: 'Notes', type: 'text' },
        create_date: { string: 'Created', type: 'datetime' },
        write_date: { string: 'Modified', type: 'datetime' },
      },
      contact: {
        id: { string: 'ID', type: 'integer' },
        name: { string: 'Name', type: 'char' },
        email: { string: 'Email', type: 'char' },
        phone: { string: 'Phone', type: 'char' },
        mobile: { string: 'Mobile', type: 'char' },
        parent_id: { string: 'Company', type: 'many2one' },
        function: { string: 'Job Position', type: 'char' },
        create_date: { string: 'Created', type: 'datetime' },
        write_date: { string: 'Modified', type: 'datetime' },
      },
      order: {
        id: { string: 'ID', type: 'integer' },
        name: { string: 'Order Reference', type: 'char' },
        partner_id: { string: 'Customer', type: 'many2one' },
        amount_total: { string: 'Total', type: 'monetary' },
        amount_untaxed: { string: 'Untaxed Amount', type: 'monetary' },
        amount_tax: { string: 'Taxes', type: 'monetary' },
        state: { string: 'Status', type: 'selection' },
        date_order: { string: 'Order Date', type: 'datetime' },
        user_id: { string: 'Salesperson', type: 'many2one' },
        create_date: { string: 'Created', type: 'datetime' },
        write_date: { string: 'Modified', type: 'datetime' },
      },
      invoice: {
        id: { string: 'ID', type: 'integer' },
        name: { string: 'Number', type: 'char' },
        partner_id: { string: 'Customer', type: 'many2one' },
        amount_total: { string: 'Total', type: 'monetary' },
        amount_residual: { string: 'Amount Due', type: 'monetary' },
        state: { string: 'Status', type: 'selection' },
        payment_state: { string: 'Payment Status', type: 'selection' },
        invoice_date: { string: 'Invoice Date', type: 'date' },
        invoice_date_due: { string: 'Due Date', type: 'date' },
        user_id: { string: 'Salesperson', type: 'many2one' },
        create_date: { string: 'Created', type: 'datetime' },
        write_date: { string: 'Modified', type: 'datetime' },
      },
    };
    return defaults[entity] || {};
  };

  const getDefaultCanonicalSchema = (entity) => {
    const schemas = {
      account: {
        name: { type: 'string', required: true, description: 'Company name' },
        email: { type: 'string', required: false, description: 'Email' },
        phone: { type: 'string', required: false, description: 'Phone' },
        website: { type: 'string', required: false, description: 'Website' },
        industry: { type: 'string', required: false, description: 'Industry' },
        address_street: { type: 'string', required: false, description: 'Street' },
        address_city: { type: 'string', required: false, description: 'City' },
        address_state: { type: 'string', required: false, description: 'State' },
        address_country: { type: 'string', required: false, description: 'Country' },
        owner_name: { type: 'string', required: false, description: 'Owner' },
      },
      opportunity: {
        name: { type: 'string', required: true, description: 'Opportunity name' },
        account_name: { type: 'string', required: false, description: 'Account' },
        value: { type: 'number', required: false, description: 'Deal value' },
        probability: { type: 'integer', required: false, description: 'Win %' },
        stage: { type: 'string', required: false, description: 'Stage' },
        close_date: { type: 'datetime', required: false, description: 'Close date' },
        owner_name: { type: 'string', required: false, description: 'Owner' },
      },
      contact: {
        name: { type: 'string', required: true, description: 'Full name' },
        email: { type: 'string', required: false, description: 'Email' },
        phone: { type: 'string', required: false, description: 'Phone' },
        mobile: { type: 'string', required: false, description: 'Mobile' },
        account_name: { type: 'string', required: false, description: 'Company' },
        title: { type: 'string', required: false, description: 'Job title' },
      },
      order: {
        order_number: { type: 'string', required: true, description: 'Order #' },
        account_name: { type: 'string', required: false, description: 'Customer' },
        total_amount: { type: 'number', required: false, description: 'Total' },
        status: { type: 'string', required: false, description: 'Status' },
        order_date: { type: 'datetime', required: false, description: 'Date' },
        owner_name: { type: 'string', required: false, description: 'Sales rep' },
      },
      invoice: {
        invoice_number: { type: 'string', required: true, description: 'Invoice #' },
        account_name: { type: 'string', required: false, description: 'Customer' },
        total_amount: { type: 'number', required: false, description: 'Total' },
        amount_due: { type: 'number', required: false, description: 'Due' },
        status: { type: 'string', required: false, description: 'Status' },
        invoice_date: { type: 'datetime', required: false, description: 'Date' },
      },
    };
    return schemas[entity] || {};
  };

  const handleAutoMap = async () => {
    setAutoMapping(true);
    try {
      const response = await integrationsAPI.autoMap('odoo', selectedEntity);
      const suggestedMappings = response.data.suggested_mappings || [];
      
      if (suggestedMappings.length > 0) {
        setMappings(suggestedMappings);
        toast.success(`AI suggested ${suggestedMappings.length} field mappings`);
      } else {
        toast.info('No additional mappings suggested by AI');
      }
    } catch (error) {
      console.error('Auto-map failed:', error);
      toast.error('AI mapping failed. Using rule-based defaults.');
      // Apply default mappings
      applyDefaultMappings();
    } finally {
      setAutoMapping(false);
    }
  };

  const applyDefaultMappings = () => {
    const defaultMaps = {
      opportunity: [
        { source_field: 'name', target_field: 'name', confidence: 1.0, is_ai_suggested: false },
        { source_field: 'partner_id', target_field: 'account_name', confidence: 0.9, is_ai_suggested: false },
        { source_field: 'expected_revenue', target_field: 'value', confidence: 0.95, is_ai_suggested: false },
        { source_field: 'probability', target_field: 'probability', confidence: 1.0, is_ai_suggested: false },
        { source_field: 'stage_id', target_field: 'stage', confidence: 0.95, is_ai_suggested: false },
        { source_field: 'user_id', target_field: 'owner_name', confidence: 0.9, is_ai_suggested: false },
        { source_field: 'date_deadline', target_field: 'close_date', confidence: 0.95, is_ai_suggested: false },
      ],
      account: [
        { source_field: 'name', target_field: 'name', confidence: 1.0, is_ai_suggested: false },
        { source_field: 'email', target_field: 'email', confidence: 1.0, is_ai_suggested: false },
        { source_field: 'phone', target_field: 'phone', confidence: 1.0, is_ai_suggested: false },
        { source_field: 'website', target_field: 'website', confidence: 1.0, is_ai_suggested: false },
        { source_field: 'street', target_field: 'address_street', confidence: 0.95, is_ai_suggested: false },
        { source_field: 'city', target_field: 'address_city', confidence: 0.95, is_ai_suggested: false },
        { source_field: 'industry_id', target_field: 'industry', confidence: 0.9, is_ai_suggested: false },
        { source_field: 'user_id', target_field: 'owner_name', confidence: 0.9, is_ai_suggested: false },
      ],
      contact: [
        { source_field: 'name', target_field: 'name', confidence: 1.0, is_ai_suggested: false },
        { source_field: 'email', target_field: 'email', confidence: 1.0, is_ai_suggested: false },
        { source_field: 'phone', target_field: 'phone', confidence: 1.0, is_ai_suggested: false },
        { source_field: 'mobile', target_field: 'mobile', confidence: 1.0, is_ai_suggested: false },
        { source_field: 'parent_id', target_field: 'account_name', confidence: 0.9, is_ai_suggested: false },
        { source_field: 'function', target_field: 'title', confidence: 0.85, is_ai_suggested: false },
      ],
      order: [
        { source_field: 'name', target_field: 'order_number', confidence: 0.95, is_ai_suggested: false },
        { source_field: 'partner_id', target_field: 'account_name', confidence: 0.9, is_ai_suggested: false },
        { source_field: 'amount_total', target_field: 'total_amount', confidence: 0.95, is_ai_suggested: false },
        { source_field: 'state', target_field: 'status', confidence: 0.9, is_ai_suggested: false },
        { source_field: 'date_order', target_field: 'order_date', confidence: 0.95, is_ai_suggested: false },
        { source_field: 'user_id', target_field: 'owner_name', confidence: 0.9, is_ai_suggested: false },
      ],
      invoice: [
        { source_field: 'name', target_field: 'invoice_number', confidence: 0.95, is_ai_suggested: false },
        { source_field: 'partner_id', target_field: 'account_name', confidence: 0.9, is_ai_suggested: false },
        { source_field: 'amount_total', target_field: 'total_amount', confidence: 0.95, is_ai_suggested: false },
        { source_field: 'amount_residual', target_field: 'amount_due', confidence: 0.95, is_ai_suggested: false },
        { source_field: 'state', target_field: 'status', confidence: 0.9, is_ai_suggested: false },
        { source_field: 'invoice_date', target_field: 'invoice_date', confidence: 1.0, is_ai_suggested: false },
      ],
    };
    setMappings(defaultMaps[selectedEntity] || []);
    toast.success('Applied default mappings');
  };

  const handleSaveMappings = async () => {
    setSaving(true);
    try {
      await integrationsAPI.saveMappings('odoo', {
        entity_type: selectedEntity,
        mappings: mappings,
      });
      toast.success('Field mappings saved successfully');
    } catch (error) {
      console.error('Failed to save mappings:', error);
      toast.error('Failed to save mappings');
    } finally {
      setSaving(false);
    }
  };

  const updateMapping = (index, field, value) => {
    const updated = [...mappings];
    updated[index] = { ...updated[index], [field]: value };
    setMappings(updated);
  };

  const removeMapping = (index) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  const addMapping = () => {
    setMappings([
      ...mappings,
      { source_field: '', target_field: '', confidence: 0.5, is_ai_suggested: false },
    ]);
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.9) return 'text-emerald-400 bg-emerald-500/20';
    if (confidence >= 0.7) return 'text-yellow-400 bg-yellow-500/20';
    return 'text-red-400 bg-red-500/20';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Field Mapping</h1>
          <p className="text-zinc-400 mt-1">Configure how Odoo fields map to your canonical schema</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => setShowHelp(true)}
            variant="outline"
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            <Info className="w-4 h-4 mr-2" />
            Help
          </Button>
        </div>
      </div>

      {/* Entity Selector */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <h3 className="text-white font-medium mb-4">Select Entity Type</h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(ODOO_MODELS).map(([key, value]) => (
            <button
              key={key}
              onClick={() => setSelectedEntity(key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedEntity === key
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
              }`}
              data-testid={`entity-${key}`}
            >
              {value.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mapping Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Source Fields (Odoo) */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Database className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-white font-medium">Odoo Fields</h3>
              <p className="text-xs text-zinc-500">{ODOO_MODELS[selectedEntity]?.model}</p>
            </div>
          </div>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
              </div>
            ) : (
              Object.entries(sourceFields).slice(0, 20).map(([field, info]) => (
                <div
                  key={field}
                  className="p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  <p className="text-sm text-white font-mono">{field}</p>
                  <p className="text-xs text-zinc-500">
                    {info.string || field} ({info.type})
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Mappings */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <ArrowRight className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-white font-medium">Field Mappings</h3>
                <p className="text-xs text-zinc-500">{mappings.length} mappings</p>
              </div>
            </div>
            <Button
              onClick={handleAutoMap}
              disabled={autoMapping}
              size="sm"
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
              data-testid="auto-map-btn"
            >
              {autoMapping ? (
                <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4 mr-1" />
              )}
              AI Auto-Map
            </Button>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {mappings.length === 0 ? (
              <div className="text-center py-8">
                <Sparkles className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-zinc-500 text-sm">No mappings configured</p>
                <p className="text-zinc-600 text-xs">Click "AI Auto-Map" to start</p>
              </div>
            ) : (
              mappings.map((mapping, index) => (
                <div
                  key={index}
                  className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {mapping.is_ai_suggested && (
                        <Sparkles className="w-3 h-3 text-purple-400" />
                      )}
                      <span className={`px-2 py-0.5 rounded text-xs ${getConfidenceColor(mapping.confidence)}`}>
                        {Math.round(mapping.confidence * 100)}%
                      </span>
                    </div>
                    <button
                      onClick={() => removeMapping(index)}
                      className="text-zinc-500 hover:text-red-400"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-purple-400 font-mono">{mapping.source_field}</span>
                    <ArrowRight className="w-4 h-4 text-zinc-500" />
                    <span className="text-emerald-400 font-mono">{mapping.target_field}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <Button
              onClick={addMapping}
              variant="outline"
              size="sm"
              className="flex-1 border-zinc-700 text-zinc-300"
            >
              + Add Mapping
            </Button>
            <Button
              onClick={applyDefaultMappings}
              variant="outline"
              size="sm"
              className="border-zinc-700 text-zinc-300"
            >
              Reset to Defaults
            </Button>
          </div>
        </div>

        {/* Target Schema (Canonical) */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <Layers className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-white font-medium">Canonical Schema</h3>
              <p className="text-xs text-zinc-500">Your standard fields</p>
            </div>
          </div>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {Object.entries(canonicalSchema).map(([field, info]) => (
              <div
                key={field}
                className={`p-3 rounded-lg transition-colors ${
                  mappings.some(m => m.target_field === field)
                    ? 'bg-emerald-500/10 border border-emerald-500/30'
                    : 'bg-zinc-800/50 hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm text-white font-mono">{field}</p>
                  {mappings.some(m => m.target_field === field) ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <span className="text-xs text-zinc-500">unmapped</span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  {info.description} ({info.type})
                  {info.required && <span className="text-red-400 ml-1">*</span>}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <Button
          onClick={loadMappingData}
          variant="outline"
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Reload
        </Button>
        <Button
          onClick={handleSaveMappings}
          disabled={saving || mappings.length === 0}
          className="bg-emerald-600 hover:bg-emerald-500"
          data-testid="save-mappings-btn"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Mappings
        </Button>
      </div>

      {/* Help Dialog */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Field Mapping Guide</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Understanding how AI field mapping works
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4 space-y-4">
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <h4 className="text-white font-medium mb-2">What is Field Mapping?</h4>
              <p className="text-zinc-400 text-sm">
                Field mapping translates data from Odoo's format to your standardized canonical schema.
                For example, Odoo uses <code className="text-purple-400">partner_id</code> but your 
                system uses <code className="text-emerald-400">account_name</code>.
              </p>
            </div>
            
            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-lg p-4">
              <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-purple-400" />
                AI Auto-Mapping
              </h4>
              <p className="text-zinc-400 text-sm">
                Uses GPT-5.2 to intelligently analyze field names, types, and descriptions 
                to suggest optimal mappings. Each suggestion includes a confidence score 
                (higher = more certain).
              </p>
            </div>
            
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <h4 className="text-white font-medium mb-2">Confidence Scores</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">90%+</span>
                  <span className="text-zinc-400">High confidence - likely correct</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400">70-89%</span>
                  <span className="text-zinc-400">Medium confidence - review recommended</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400">&lt;70%</span>
                  <span className="text-zinc-400">Low confidence - manual review needed</span>
                </div>
              </div>
            </div>
            
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <h4 className="text-white font-medium mb-2">Workflow</h4>
              <ol className="text-zinc-400 text-sm space-y-1 list-decimal list-inside">
                <li>Select an entity type (Opportunity, Account, etc.)</li>
                <li>Click "AI Auto-Map" to generate suggestions</li>
                <li>Review and adjust mappings as needed</li>
                <li>Click "Save Mappings" to store configuration</li>
                <li>Run Sync to apply mappings to data</li>
              </ol>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FieldMapping;
