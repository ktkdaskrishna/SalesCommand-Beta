/**
 * Field Mapping Page
 * AI-powered field mapping interface for integrations
 */
import React, { useState, useEffect } from 'react';
import { integrationsAPI } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
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
  ChevronUp,
  Edit3,
  Trash2,
  Plus,
  List,
  Eye,
  EyeOff,
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
  const [showMappedData, setShowMappedData] = useState(true);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editForm, setEditForm] = useState({ source_field: '', target_field: '', transform: '' });

  // Transform options for field mapping
  const TRANSFORM_OPTIONS = [
    { value: '', label: 'None (Direct)' },
    { value: 'extract_id', label: 'Extract ID (Many2One)' },
    { value: 'extract_name', label: 'Extract Name (Many2One)' },
    { value: 'to_string', label: 'Convert to String' },
    { value: 'to_float', label: 'Convert to Number' },
    { value: 'to_int', label: 'Convert to Integer' },
    { value: 'boolean', label: 'Convert to Boolean' },
  ];

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
      setCanonicalSchema(mappingsRes.data.canonical_schema || getDefaultCanonicalSchema(selectedEntity));
      setMappings(mappingsRes.data.mappings || []);
    } catch (error) {
      console.error('Failed to load mapping data:', error);
      setCanonicalSchema(getDefaultCanonicalSchema(selectedEntity));
    } finally {
      setLoading(false);
    }
  };

  const getDefaultOdooFields = (entity) => {
    const defaults = {
      account: {
        id: { string: 'ID', type: 'integer' },
        name: { string: 'Company Name', type: 'char' },
        email: { string: 'Email', type: 'char' },
        phone: { string: 'Phone', type: 'char' },
        website: { string: 'Website', type: 'char' },
        street: { string: 'Street Address', type: 'char' },
        street2: { string: 'Street Address 2', type: 'char' },
        city: { string: 'City', type: 'char' },
        zip: { string: 'ZIP Code', type: 'char' },
        state_id: { string: 'State', type: 'many2one' },
        country_id: { string: 'Country', type: 'many2one' },
        user_id: { string: 'Salesperson', type: 'many2one' },
        create_date: { string: 'Created On', type: 'datetime' },
        write_date: { string: 'Last Updated', type: 'datetime' },
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
        description: { string: 'Internal Notes', type: 'text' },
        create_date: { string: 'Created On', type: 'datetime' },
        write_date: { string: 'Last Updated', type: 'datetime' },
      },
      contact: {
        id: { string: 'ID', type: 'integer' },
        name: { string: 'Contact Name', type: 'char' },
        email: { string: 'Email', type: 'char' },
        phone: { string: 'Phone', type: 'char' },
        parent_id: { string: 'Company', type: 'many2one' },
        function: { string: 'Job Position', type: 'char' },
        create_date: { string: 'Created On', type: 'datetime' },
        write_date: { string: 'Last Updated', type: 'datetime' },
      },
      order: {
        id: { string: 'ID', type: 'integer' },
        name: { string: 'Order Reference', type: 'char' },
        partner_id: { string: 'Customer', type: 'many2one' },
        amount_total: { string: 'Total Amount', type: 'monetary' },
        amount_untaxed: { string: 'Untaxed Amount', type: 'monetary' },
        amount_tax: { string: 'Tax Amount', type: 'monetary' },
        state: { string: 'Status', type: 'selection' },
        date_order: { string: 'Order Date', type: 'datetime' },
        user_id: { string: 'Salesperson', type: 'many2one' },
        create_date: { string: 'Created On', type: 'datetime' },
        write_date: { string: 'Last Updated', type: 'datetime' },
      },
      invoice: {
        id: { string: 'ID', type: 'integer' },
        name: { string: 'Invoice Number', type: 'char' },
        partner_id: { string: 'Customer', type: 'many2one' },
        amount_total: { string: 'Total Amount', type: 'monetary' },
        amount_residual: { string: 'Amount Due', type: 'monetary' },
        state: { string: 'Status', type: 'selection' },
        payment_state: { string: 'Payment Status', type: 'selection' },
        invoice_date: { string: 'Invoice Date', type: 'date' },
        invoice_date_due: { string: 'Due Date', type: 'date' },
        user_id: { string: 'Salesperson', type: 'many2one' },
        create_date: { string: 'Created On', type: 'datetime' },
        write_date: { string: 'Last Updated', type: 'datetime' },
      },
    };
    return defaults[entity] || {};
  };

  // Canonical schema now matches Odoo field names more closely
  const getDefaultCanonicalSchema = (entity) => {
    const schemas = {
      account: {
        name: { type: 'string', required: true, description: 'Company Name' },
        email: { type: 'string', required: false, description: 'Email Address' },
        phone: { type: 'string', required: false, description: 'Phone Number' },
        website: { type: 'string', required: false, description: 'Website URL' },
        street: { type: 'string', required: false, description: 'Street Address' },
        city: { type: 'string', required: false, description: 'City' },
        zip: { type: 'string', required: false, description: 'ZIP/Postal Code' },
        state_name: { type: 'string', required: false, description: 'State/Region' },
        country_name: { type: 'string', required: false, description: 'Country' },
        salesperson_name: { type: 'string', required: false, description: 'Salesperson' },
        create_date: { type: 'datetime', required: false, description: 'Created On' },
        write_date: { type: 'datetime', required: false, description: 'Last Updated' },
      },
      opportunity: {
        name: { type: 'string', required: true, description: 'Opportunity Name' },
        partner_name: { type: 'string', required: false, description: 'Customer Name' },
        partner_id: { type: 'integer', required: false, description: 'Customer ID' },
        expected_revenue: { type: 'number', required: false, description: 'Expected Revenue' },
        probability: { type: 'number', required: false, description: 'Probability (%)' },
        stage_name: { type: 'string', required: false, description: 'Stage Name' },
        date_deadline: { type: 'date', required: false, description: 'Expected Closing' },
        description: { type: 'string', required: false, description: 'Internal Notes' },
        salesperson_name: { type: 'string', required: false, description: 'Salesperson' },
        salesperson_id: { type: 'integer', required: false, description: 'Salesperson ID' },
        create_date: { type: 'datetime', required: false, description: 'Created On' },
        write_date: { type: 'datetime', required: false, description: 'Last Updated' },
      },
      contact: {
        name: { type: 'string', required: true, description: 'Contact Name' },
        email: { type: 'string', required: false, description: 'Email Address' },
        phone: { type: 'string', required: false, description: 'Phone Number' },
        company_name: { type: 'string', required: false, description: 'Company Name' },
        company_id: { type: 'integer', required: false, description: 'Company ID' },
        function: { type: 'string', required: false, description: 'Job Position' },
        create_date: { type: 'datetime', required: false, description: 'Created On' },
        write_date: { type: 'datetime', required: false, description: 'Last Updated' },
      },
      order: {
        name: { type: 'string', required: true, description: 'Order Reference' },
        partner_name: { type: 'string', required: false, description: 'Customer Name' },
        partner_id: { type: 'integer', required: false, description: 'Customer ID' },
        amount_total: { type: 'number', required: false, description: 'Total Amount' },
        amount_untaxed: { type: 'number', required: false, description: 'Untaxed Amount' },
        amount_tax: { type: 'number', required: false, description: 'Tax Amount' },
        state: { type: 'string', required: false, description: 'Status' },
        date_order: { type: 'datetime', required: false, description: 'Order Date' },
        salesperson_name: { type: 'string', required: false, description: 'Salesperson' },
        create_date: { type: 'datetime', required: false, description: 'Created On' },
        write_date: { type: 'datetime', required: false, description: 'Last Updated' },
      },
      invoice: {
        name: { type: 'string', required: true, description: 'Invoice Number' },
        partner_name: { type: 'string', required: false, description: 'Customer Name' },
        partner_id: { type: 'integer', required: false, description: 'Customer ID' },
        amount_total: { type: 'number', required: false, description: 'Total Amount' },
        amount_residual: { type: 'number', required: false, description: 'Amount Due' },
        state: { type: 'string', required: false, description: 'Status' },
        payment_state: { type: 'string', required: false, description: 'Payment Status' },
        invoice_date: { type: 'date', required: false, description: 'Invoice Date' },
        invoice_date_due: { type: 'date', required: false, description: 'Due Date' },
        salesperson_name: { type: 'string', required: false, description: 'Salesperson' },
        create_date: { type: 'datetime', required: false, description: 'Created On' },
        write_date: { type: 'datetime', required: false, description: 'Last Updated' },
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
      applyDefaultMappings();
    } finally {
      setAutoMapping(false);
    }
  };

  const applyDefaultMappings = () => {
    const defaultMaps = {
      opportunity: [
        { source_field: 'name', target_field: 'name', confidence: 1.0, is_ai_suggested: false, transform: '' },
        { source_field: 'partner_id', target_field: 'account_name', confidence: 0.9, is_ai_suggested: false, transform: 'extract_name' },
        { source_field: 'expected_revenue', target_field: 'value', confidence: 0.95, is_ai_suggested: false, transform: 'to_float' },
        { source_field: 'probability', target_field: 'probability', confidence: 1.0, is_ai_suggested: false, transform: '' },
        { source_field: 'stage_id', target_field: 'stage', confidence: 0.95, is_ai_suggested: false, transform: 'extract_name' },
        { source_field: 'user_id', target_field: 'owner_name', confidence: 0.9, is_ai_suggested: false, transform: 'extract_name' },
        { source_field: 'date_deadline', target_field: 'close_date', confidence: 0.95, is_ai_suggested: false, transform: '' },
      ],
      account: [
        { source_field: 'name', target_field: 'name', confidence: 1.0, is_ai_suggested: false, transform: '' },
        { source_field: 'email', target_field: 'email', confidence: 1.0, is_ai_suggested: false, transform: '' },
        { source_field: 'phone', target_field: 'phone', confidence: 1.0, is_ai_suggested: false, transform: '' },
        { source_field: 'website', target_field: 'website', confidence: 1.0, is_ai_suggested: false, transform: '' },
        { source_field: 'street', target_field: 'address_street', confidence: 0.95, is_ai_suggested: false, transform: '' },
        { source_field: 'city', target_field: 'address_city', confidence: 0.95, is_ai_suggested: false, transform: '' },
        { source_field: 'state_id', target_field: 'address_state', confidence: 0.9, is_ai_suggested: false, transform: 'extract_name' },
        { source_field: 'country_id', target_field: 'address_country', confidence: 0.9, is_ai_suggested: false, transform: 'extract_name' },
        { source_field: 'user_id', target_field: 'owner_name', confidence: 0.9, is_ai_suggested: false, transform: 'extract_name' },
      ],
      contact: [
        { source_field: 'name', target_field: 'name', confidence: 1.0, is_ai_suggested: false, transform: '' },
        { source_field: 'email', target_field: 'email', confidence: 1.0, is_ai_suggested: false, transform: '' },
        { source_field: 'phone', target_field: 'phone', confidence: 1.0, is_ai_suggested: false, transform: '' },
        { source_field: 'parent_id', target_field: 'account_name', confidence: 0.9, is_ai_suggested: false, transform: 'extract_name' },
        { source_field: 'function', target_field: 'title', confidence: 0.85, is_ai_suggested: false, transform: '' },
      ],
      order: [
        { source_field: 'name', target_field: 'order_number', confidence: 0.95, is_ai_suggested: false, transform: '' },
        { source_field: 'partner_id', target_field: 'account_name', confidence: 0.9, is_ai_suggested: false, transform: 'extract_name' },
        { source_field: 'amount_total', target_field: 'total_amount', confidence: 0.95, is_ai_suggested: false, transform: 'to_float' },
        { source_field: 'state', target_field: 'status', confidence: 0.9, is_ai_suggested: false, transform: '' },
        { source_field: 'date_order', target_field: 'order_date', confidence: 0.95, is_ai_suggested: false, transform: '' },
        { source_field: 'user_id', target_field: 'owner_name', confidence: 0.9, is_ai_suggested: false, transform: 'extract_name' },
      ],
      invoice: [
        { source_field: 'name', target_field: 'invoice_number', confidence: 0.95, is_ai_suggested: false, transform: '' },
        { source_field: 'partner_id', target_field: 'account_name', confidence: 0.9, is_ai_suggested: false, transform: 'extract_name' },
        { source_field: 'amount_total', target_field: 'total_amount', confidence: 0.95, is_ai_suggested: false, transform: 'to_float' },
        { source_field: 'amount_residual', target_field: 'amount_due', confidence: 0.95, is_ai_suggested: false, transform: 'to_float' },
        { source_field: 'state', target_field: 'status', confidence: 0.9, is_ai_suggested: false, transform: '' },
        { source_field: 'invoice_date', target_field: 'invoice_date', confidence: 1.0, is_ai_suggested: false, transform: '' },
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

  const removeMapping = (index) => {
    setMappings(mappings.filter((_, i) => i !== index));
    toast.success('Mapping removed');
  };

  const startEditing = (index) => {
    const mapping = mappings[index];
    setEditForm({
      source_field: mapping.source_field,
      target_field: mapping.target_field,
      transform: mapping.transform || '',
    });
    setEditingIndex(index);
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setEditForm({ source_field: '', target_field: '', transform: '' });
  };

  const saveEditing = () => {
    if (!editForm.source_field || !editForm.target_field) {
      toast.error('Please select both source and target fields');
      return;
    }
    
    const updated = [...mappings];
    updated[editingIndex] = {
      ...updated[editingIndex],
      source_field: editForm.source_field,
      target_field: editForm.target_field,
      transform: editForm.transform,
      is_ai_suggested: false,
    };
    setMappings(updated);
    setEditingIndex(null);
    setEditForm({ source_field: '', target_field: '', transform: '' });
    toast.success('Mapping updated');
  };

  const addNewMapping = () => {
    setMappings([
      ...mappings,
      { source_field: '', target_field: '', confidence: 0.5, is_ai_suggested: false, transform: '' },
    ]);
    setEditingIndex(mappings.length);
    setEditForm({ source_field: '', target_field: '', transform: '' });
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.9) return 'text-emerald-400 bg-emerald-500/20';
    if (confidence >= 0.7) return 'text-yellow-400 bg-yellow-500/20';
    return 'text-red-400 bg-red-500/20';
  };

  const getTransformLabel = (transform) => {
    const option = TRANSFORM_OPTIONS.find(t => t.value === transform);
    return option ? option.label : 'None';
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

      {/* Current Mappings Section - Expandable */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowMappedData(!showMappedData)}
          className="w-full p-4 flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/20">
              <List className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="text-left">
              <h3 className="text-white font-medium">Current Field Mappings</h3>
              <p className="text-sm text-zinc-500">{mappings.length} mappings configured for {ODOO_MODELS[selectedEntity]?.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500">Click to {showMappedData ? 'collapse' : 'expand'}</span>
            {showMappedData ? (
              <ChevronUp className="w-5 h-5 text-zinc-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-zinc-400" />
            )}
          </div>
        </button>

        {showMappedData && (
          <div className="border-t border-zinc-800 p-4">
            {/* Action Buttons */}
            <div className="flex gap-3 mb-4">
              <Button
                onClick={handleAutoMap}
                disabled={autoMapping}
                size="sm"
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
                data-testid="auto-map-btn"
              >
                {autoMapping ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4 mr-2" />
                )}
                AI Auto-Map
              </Button>
              <Button
                onClick={addNewMapping}
                variant="outline"
                size="sm"
                className="border-zinc-700 text-zinc-300"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Mapping
              </Button>
              <Button
                onClick={applyDefaultMappings}
                variant="outline"
                size="sm"
                className="border-zinc-700 text-zinc-300"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reset to Defaults
              </Button>
            </div>

            {/* Mappings Table */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
              </div>
            ) : mappings.length === 0 ? (
              <div className="text-center py-8 bg-zinc-800/30 rounded-lg">
                <Sparkles className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-400">No mappings configured yet</p>
                <p className="text-zinc-500 text-sm mt-1">Click &quot;AI Auto-Map&quot; or &quot;Add Mapping&quot; to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-zinc-800/50 rounded-lg text-xs text-zinc-500 font-medium">
                  <div className="col-span-3">SOURCE FIELD (Odoo)</div>
                  <div className="col-span-1 text-center">→</div>
                  <div className="col-span-3">TARGET FIELD (Canonical)</div>
                  <div className="col-span-2">TRANSFORM</div>
                  <div className="col-span-1 text-center">CONFIDENCE</div>
                  <div className="col-span-2 text-right">ACTIONS</div>
                </div>

                {/* Mapping Rows */}
                {mappings.map((mapping, index) => (
                  <div
                    key={index}
                    className={`grid grid-cols-12 gap-4 px-4 py-3 rounded-lg border transition-colors ${
                      editingIndex === index
                        ? 'bg-cyan-500/10 border-cyan-500/30'
                        : 'bg-zinc-800/30 border-zinc-700/50 hover:bg-zinc-800/50'
                    }`}
                  >
                    {editingIndex === index ? (
                      /* Edit Mode */
                      <>
                        <div className="col-span-3">
                          <select
                            value={editForm.source_field}
                            onChange={(e) => setEditForm({ ...editForm, source_field: e.target.value })}
                            className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-600 rounded text-sm text-white focus:border-cyan-500 focus:outline-none"
                          >
                            <option value="">Select source field...</option>
                            {Object.entries(sourceFields).map(([field, info]) => (
                              <option key={field} value={field}>
                                {field} ({info.type})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-1 flex items-center justify-center">
                          <ArrowRight className="w-4 h-4 text-cyan-400" />
                        </div>
                        <div className="col-span-3">
                          <select
                            value={editForm.target_field}
                            onChange={(e) => setEditForm({ ...editForm, target_field: e.target.value })}
                            className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-600 rounded text-sm text-white focus:border-cyan-500 focus:outline-none"
                          >
                            <option value="">Select target field...</option>
                            {Object.entries(canonicalSchema).map(([field, info]) => (
                              <option key={field} value={field}>
                                {field} ({info.type})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <select
                            value={editForm.transform}
                            onChange={(e) => setEditForm({ ...editForm, transform: e.target.value })}
                            className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-600 rounded text-sm text-white focus:border-cyan-500 focus:outline-none"
                          >
                            {TRANSFORM_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-1"></div>
                        <div className="col-span-2 flex items-center justify-end gap-2">
                          <Button
                            onClick={saveEditing}
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-500 px-3 py-1 h-8"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={cancelEditing}
                            size="sm"
                            variant="outline"
                            className="border-zinc-600 px-3 py-1 h-8"
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      /* View Mode */
                      <>
                        <div className="col-span-3 flex items-center">
                          <span className="text-purple-400 font-mono text-sm">{mapping.source_field || '—'}</span>
                        </div>
                        <div className="col-span-1 flex items-center justify-center">
                          <ArrowRight className="w-4 h-4 text-zinc-500" />
                        </div>
                        <div className="col-span-3 flex items-center">
                          <span className="text-emerald-400 font-mono text-sm">{mapping.target_field || '—'}</span>
                        </div>
                        <div className="col-span-2 flex items-center">
                          <span className="text-xs text-zinc-400 bg-zinc-800 px-2 py-1 rounded">
                            {getTransformLabel(mapping.transform)}
                          </span>
                        </div>
                        <div className="col-span-1 flex items-center justify-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getConfidenceColor(mapping.confidence)}`}>
                            {Math.round(mapping.confidence * 100)}%
                          </span>
                        </div>
                        <div className="col-span-2 flex items-center justify-end gap-2">
                          <button
                            onClick={() => startEditing(index)}
                            className="p-1.5 text-zinc-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded transition-colors"
                            title="Edit mapping"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removeMapping(index)}
                            className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                            title="Delete mapping"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Source Fields & Target Schema Reference */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Source Fields (Odoo) */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Database className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-white font-medium">Available Odoo Fields</h3>
              <p className="text-xs text-zinc-500">{ODOO_MODELS[selectedEntity]?.model} - Reference</p>
            </div>
          </div>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
              </div>
            ) : (
              Object.entries(sourceFields).slice(0, 15).map(([field, info]) => (
                <div
                  key={field}
                  className={`p-3 rounded-lg transition-colors ${
                    mappings.some(m => m.source_field === field)
                      ? 'bg-purple-500/10 border border-purple-500/30'
                      : 'bg-zinc-800/50 hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-white font-mono">{field}</p>
                    {mappings.some(m => m.source_field === field) && (
                      <CheckCircle2 className="w-4 h-4 text-purple-400" />
                    )}
                  </div>
                  <p className="text-xs text-zinc-500">
                    {info.string || field} ({info.type})
                  </p>
                </div>
              ))
            )}
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
              <p className="text-xs text-zinc-500">Your standard fields - Reference</p>
            </div>
          </div>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
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
              Understanding how to configure field mappings
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4 space-y-4">
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <h4 className="text-white font-medium mb-2">What is Field Mapping?</h4>
              <p className="text-zinc-400 text-sm">
                Field mapping translates data from Odoo&apos;s format to your standardized canonical schema.
                For example, Odoo uses <code className="text-purple-400">partner_id</code> but your 
                system uses <code className="text-emerald-400">account_name</code>.
              </p>
            </div>
            
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <h4 className="text-white font-medium mb-2">How to Edit Mappings</h4>
              <ol className="text-zinc-400 text-sm space-y-2 list-decimal list-inside">
                <li>Click the <Edit3 className="w-4 h-4 inline text-cyan-400" /> edit icon on any mapping row</li>
                <li>Select new source field, target field, and transform</li>
                <li>Click <CheckCircle2 className="w-4 h-4 inline text-emerald-400" /> to save or <XCircle className="w-4 h-4 inline text-red-400" /> to cancel</li>
                <li>Click &quot;Save Mappings&quot; to persist all changes</li>
              </ol>
            </div>

            <div className="bg-zinc-800/50 rounded-lg p-4">
              <h4 className="text-white font-medium mb-2">Transform Options</h4>
              <div className="space-y-1 text-sm">
                <p className="text-zinc-400"><span className="text-cyan-400">Extract ID</span> - Gets ID from Odoo Many2One fields like [1, &quot;Name&quot;]</p>
                <p className="text-zinc-400"><span className="text-cyan-400">Extract Name</span> - Gets Name from Odoo Many2One fields</p>
                <p className="text-zinc-400"><span className="text-cyan-400">To String/Number</span> - Converts field to specific type</p>
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-lg p-4">
              <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-purple-400" />
                AI Auto-Mapping
              </h4>
              <p className="text-zinc-400 text-sm">
                Uses AI to intelligently analyze field names and suggest optimal mappings 
                with confidence scores. You can then review and adjust as needed.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FieldMapping;
