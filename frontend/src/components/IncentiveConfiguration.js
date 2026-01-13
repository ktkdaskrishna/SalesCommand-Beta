/**
 * Incentive Configuration Component
 * Manages commission templates, tiers, service lines, and assignments
 */
import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { configAPI, incentiveAPI } from '../services/api';
import {
  DollarSign, Plus, Edit2, Trash2, Save, X, ChevronDown, ChevronUp,
  Percent, TrendingUp, Award, Settings
} from 'lucide-react';

const IncentiveConfiguration = () => {
  const [activeTab, setActiveTab] = useState('templates');
  const [templates, setTemplates] = useState([]);
  const [serviceLines, setServiceLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Modal states
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showServiceLineModal, setShowServiceLineModal] = useState(false);
  const [editingServiceLine, setEditingServiceLine] = useState(null);

  // Template form
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    template_type: 'tiered_attainment',
    base_rate: 0.05,
    tiers: [
      { min_attainment: 0, max_attainment: 50, multiplier: 0.5 },
      { min_attainment: 50, max_attainment: 100, multiplier: 1.0 },
      { min_attainment: 100, max_attainment: 150, multiplier: 1.5 },
      { min_attainment: 150, max_attainment: 200, multiplier: 2.0 },
    ],
    new_logo_multiplier: 1.5
  });

  // Service line form
  const [serviceLineForm, setServiceLineForm] = useState({
    code: '',
    name: '',
    commission_weight: 1.0,
    is_recurring: false
  });

  // Fetch data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [templatesRes, linesRes] = await Promise.all([
        incentiveAPI.getTemplates(),
        configAPI.getServiceLines()
      ]);
      setTemplates(templatesRes.data || []);
      setServiceLines(linesRes.data || []);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Add tier to template
  const addTier = () => {
    const lastTier = templateForm.tiers[templateForm.tiers.length - 1];
    const newMin = lastTier ? lastTier.max_attainment : 0;
    setTemplateForm(prev => ({
      ...prev,
      tiers: [...prev.tiers, { min_attainment: newMin, max_attainment: newMin + 50, multiplier: 1.0 }]
    }));
  };

  // Remove tier
  const removeTier = (index) => {
    setTemplateForm(prev => ({
      ...prev,
      tiers: prev.tiers.filter((_, i) => i !== index)
    }));
  };

  // Update tier
  const updateTier = (index, field, value) => {
    setTemplateForm(prev => ({
      ...prev,
      tiers: prev.tiers.map((tier, i) => 
        i === index ? { ...tier, [field]: parseFloat(value) || 0 } : tier
      )
    }));
  };

  // Save template
  const saveTemplate = async () => {
    setLoading(true);
    setError('');
    try {
      await incentiveAPI.createTemplate(templateForm);
      setSuccess('Template saved successfully');
      setShowTemplateModal(false);
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  // Save service line
  const saveServiceLine = async () => {
    setLoading(true);
    setError('');
    try {
      if (editingServiceLine) {
        await configAPI.updateServiceLine(editingServiceLine.id, serviceLineForm);
      } else {
        await configAPI.createServiceLine(serviceLineForm);
      }
      setSuccess('Service line saved successfully');
      setShowServiceLineModal(false);
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save service line');
    } finally {
      setLoading(false);
    }
  };

  // Open edit modal
  const openEditTemplate = (template) => {
    setTemplateForm({
      name: template.name,
      description: template.description || '',
      template_type: template.template_type,
      base_rate: template.base_rate,
      tiers: template.tiers || [],
      new_logo_multiplier: template.new_logo_multiplier || 1.5
    });
    setEditingTemplate(template);
    setShowTemplateModal(true);
  };

  const openEditServiceLine = (line) => {
    setServiceLineForm({
      code: line.code,
      name: line.name,
      commission_weight: line.commission_weight,
      is_recurring: line.is_recurring
    });
    setEditingServiceLine(line);
    setShowServiceLineModal(true);
  };

  // Reset forms
  const resetTemplateForm = () => {
    setTemplateForm({
      name: '',
      description: '',
      template_type: 'tiered_attainment',
      base_rate: 0.05,
      tiers: [
        { min_attainment: 0, max_attainment: 50, multiplier: 0.5 },
        { min_attainment: 50, max_attainment: 100, multiplier: 1.0 },
        { min_attainment: 100, max_attainment: 150, multiplier: 1.5 },
      ],
      new_logo_multiplier: 1.5
    });
    setEditingTemplate(null);
  };

  const resetServiceLineForm = () => {
    setServiceLineForm({
      code: '',
      name: '',
      commission_weight: 1.0,
      is_recurring: false
    });
    setEditingServiceLine(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Incentive Configuration</h2>
          <p className="text-sm text-zinc-400 mt-1">Manage commission templates and service line weights</p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/50 rounded-lg text-emerald-400 text-sm">
          {success}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-800 pb-4">
        <button
          onClick={() => setActiveTab('templates')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'templates'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
        >
          <Award className="w-4 h-4" />
          Commission Templates
        </button>
        <button
          onClick={() => setActiveTab('service-lines')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'service-lines'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
        >
          <Settings className="w-4 h-4" />
          Service Lines
        </button>
      </div>

      {/* Commission Templates Tab */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => { resetTemplateForm(); setShowTemplateModal(true); }}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Template
            </Button>
          </div>

          {/* Templates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map(template => (
              <div
                key={template.id}
                className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 hover:border-zinc-600 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-white">{template.name}</h3>
                    <p className="text-sm text-zinc-400">{template.description || 'No description'}</p>
                  </div>
                  <button
                    onClick={() => openEditTemplate(template)}
                    className="text-zinc-400 hover:text-white"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Type:</span>
                    <span className="text-white capitalize">{template.template_type?.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Base Rate:</span>
                    <span className="text-emerald-400">{(template.base_rate * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">New Logo Bonus:</span>
                    <span className="text-emerald-400">{template.new_logo_multiplier}x</span>
                  </div>
                  
                  {/* Tiers Preview */}
                  {template.tiers && template.tiers.length > 0 && (
                    <div className="pt-2 border-t border-zinc-700 mt-2">
                      <span className="text-zinc-400 text-xs">Tiers:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {template.tiers.map((tier, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-zinc-700 rounded text-xs text-zinc-300"
                          >
                            {tier.min_attainment}-{tier.max_attainment}%: {tier.multiplier}x
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Service Lines Tab */}
      {activeTab === 'service-lines' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => { resetServiceLineForm(); setShowServiceLineModal(true); }}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Service Line
            </Button>
          </div>

          {/* Service Lines Table */}
          <div className="bg-zinc-800/30 rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-3 text-sm font-medium text-zinc-400">Code</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-zinc-400">Name</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-zinc-400">Weight</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-zinc-400">Recurring</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-zinc-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {serviceLines.map(line => (
                  <tr key={line.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="px-4 py-3 text-sm font-mono text-emerald-400">{line.code}</td>
                    <td className="px-4 py-3 text-sm text-white">{line.name}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-0.5 rounded ${
                        line.commission_weight > 1 
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : line.commission_weight < 1
                            ? 'bg-orange-500/20 text-orange-400'
                            : 'bg-zinc-700 text-zinc-300'
                      }`}>
                        {line.commission_weight}x
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {line.is_recurring ? (
                        <span className="text-emerald-400">Yes</span>
                      ) : (
                        <span className="text-zinc-500">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEditServiceLine(line)}
                        className="text-zinc-400 hover:text-white"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">
                {editingTemplate ? 'Edit Template' : 'New Commission Template'}
              </h3>
              <button onClick={() => setShowTemplateModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-zinc-300">Template Name</Label>
                  <Input
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Cybersecurity Standard"
                    className="mt-1 bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-zinc-300">Base Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={(templateForm.base_rate * 100).toFixed(1)}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, base_rate: parseFloat(e.target.value) / 100 }))}
                    className="mt-1 bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
              </div>

              <div>
                <Label className="text-zinc-300">Description</Label>
                <Input
                  value={templateForm.description}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Template description..."
                  className="mt-1 bg-zinc-800 border-zinc-700 text-white"
                />
              </div>

              <div>
                <Label className="text-zinc-300">New Logo Multiplier</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={templateForm.new_logo_multiplier}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, new_logo_multiplier: parseFloat(e.target.value) || 1 }))}
                  className="mt-1 bg-zinc-800 border-zinc-700 text-white w-32"
                />
              </div>

              {/* Tiers */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-zinc-300">Attainment Tiers</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={addTier}
                    className="border-zinc-700 text-zinc-300"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Tier
                  </Button>
                </div>
                <div className="space-y-2">
                  {templateForm.tiers.map((tier, index) => (
                    <div key={index} className="flex items-center gap-2 bg-zinc-800/50 p-2 rounded-lg">
                      <Input
                        type="number"
                        value={tier.min_attainment}
                        onChange={(e) => updateTier(index, 'min_attainment', e.target.value)}
                        className="w-20 bg-zinc-800 border-zinc-700 text-white text-sm"
                        placeholder="Min %"
                      />
                      <span className="text-zinc-500">-</span>
                      <Input
                        type="number"
                        value={tier.max_attainment}
                        onChange={(e) => updateTier(index, 'max_attainment', e.target.value)}
                        className="w-20 bg-zinc-800 border-zinc-700 text-white text-sm"
                        placeholder="Max %"
                      />
                      <span className="text-zinc-500">% →</span>
                      <Input
                        type="number"
                        step="0.1"
                        value={tier.multiplier}
                        onChange={(e) => updateTier(index, 'multiplier', e.target.value)}
                        className="w-20 bg-zinc-800 border-zinc-700 text-white text-sm"
                        placeholder="Mult"
                      />
                      <span className="text-zinc-400 text-sm">x</span>
                      <button
                        onClick={() => removeTier(index)}
                        className="text-zinc-500 hover:text-red-400 ml-auto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-zinc-800">
              <Button
                variant="outline"
                onClick={() => setShowTemplateModal(false)}
                className="border-zinc-700 text-zinc-300"
              >
                Cancel
              </Button>
              <Button
                onClick={saveTemplate}
                disabled={loading || !templateForm.name}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Template
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Service Line Modal */}
      {showServiceLineModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">
                {editingServiceLine ? 'Edit Service Line' : 'New Service Line'}
              </h3>
              <button onClick={() => setShowServiceLineModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-zinc-300">Code</Label>
                <Input
                  value={serviceLineForm.code}
                  onChange={(e) => setServiceLineForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g., MCD"
                  disabled={!!editingServiceLine}
                  className="mt-1 bg-zinc-800 border-zinc-700 text-white font-mono"
                />
              </div>

              <div>
                <Label className="text-zinc-300">Name</Label>
                <Input
                  value={serviceLineForm.name}
                  onChange={(e) => setServiceLineForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Managed Cyber Defense"
                  className="mt-1 bg-zinc-800 border-zinc-700 text-white"
                />
              </div>

              <div>
                <Label className="text-zinc-300">Commission Weight</Label>
                <Input
                  type="number"
                  step="0.05"
                  value={serviceLineForm.commission_weight}
                  onChange={(e) => setServiceLineForm(prev => ({ ...prev, commission_weight: parseFloat(e.target.value) || 1 }))}
                  className="mt-1 bg-zinc-800 border-zinc-700 text-white w-32"
                />
                <p className="text-xs text-zinc-500 mt-1">1.0 = standard, &gt;1 = premium, &lt;1 = reduced</p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={serviceLineForm.is_recurring}
                  onChange={(e) => setServiceLineForm(prev => ({ ...prev, is_recurring: e.target.checked }))}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500"
                />
                <span className="text-sm text-zinc-300">Is Recurring Revenue (MRR/ARR)</span>
              </label>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-zinc-800">
              <Button
                variant="outline"
                onClick={() => setShowServiceLineModal(false)}
                className="border-zinc-700 text-zinc-300"
              >
                Cancel
              </Button>
              <Button
                onClick={saveServiceLine}
                disabled={loading || !serviceLineForm.code || !serviceLineForm.name}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IncentiveConfiguration;
