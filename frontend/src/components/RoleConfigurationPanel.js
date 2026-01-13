/**
 * Role Configuration Panel
 * Visual configuration for roles, navigation, and dashboard widgets
 */
import React, { useState, useEffect, useCallback } from 'react';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { configAPI } from '../services/api';
import {
  Settings, Plus, Save, Trash2, X, Check, GripVertical,
  LayoutDashboard, Building2, Target, BarChart3, Mail, FileText,
  Database, Plug2, Wand2, Users, ChevronDown, ChevronUp
} from 'lucide-react';

// Icon mapping
const ICON_MAP = {
  LayoutDashboard, Building2, Target, BarChart3, Mail, FileText,
  Database, Plug2, Wand2, Settings, Users
};

const RoleConfigurationPanel = ({ role, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    data_scope: 'own',
    permissions: [],
    navigation: { main_menu: [], admin_menu: [] },
    default_dashboard: { layout: [] },
    incentive_config: { commission_template_id: null, show_earnings: true, show_team_earnings: false }
  });
  
  const [availableWidgets, setAvailableWidgets] = useState({});
  const [availableNavItems, setAvailableNavItems] = useState({ main_menu: [], admin_menu: [] });
  const [commissionTemplates, setCommissionTemplates] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState('basic');

  // Load role data
  useEffect(() => {
    if (role) {
      setFormData({
        name: role.name || '',
        description: role.description || '',
        data_scope: role.data_scope || 'own',
        permissions: role.permissions || [],
        navigation: role.navigation || { main_menu: [], admin_menu: [] },
        default_dashboard: role.default_dashboard || { layout: [] },
        incentive_config: role.incentive_config || { commission_template_id: null, show_earnings: true, show_team_earnings: false }
      });
    }
  }, [role]);

  // Fetch config data
  useEffect(() => {
    const fetchConfigData = async () => {
      try {
        const [widgetsRes, navRes, templatesRes] = await Promise.all([
          configAPI.getWidgets(),
          configAPI.getNavigationItems(),
          configAPI.getRoles() // We'll need to get templates separately
        ]);
        
        setAvailableWidgets(widgetsRes.data.widgets || {});
        setAvailableNavItems(navRes.data || { main_menu: [], admin_menu: [] });
      } catch (err) {
        console.error('Failed to load config data:', err);
      }
    };
    
    fetchConfigData();
  }, []);

  // Handle navigation toggle
  const toggleNavItem = (menuType, itemId) => {
    setFormData(prev => {
      const menu = [...(prev.navigation[menuType] || [])];
      const existingIndex = menu.findIndex(item => item.id === itemId);
      
      if (existingIndex >= 0) {
        // Toggle enabled state
        menu[existingIndex] = { ...menu[existingIndex], enabled: !menu[existingIndex].enabled };
      } else {
        // Add new item as enabled
        const availableItem = availableNavItems[menuType]?.find(i => i.id === itemId);
        if (availableItem) {
          menu.push({ ...availableItem, enabled: true });
        }
      }
      
      return {
        ...prev,
        navigation: { ...prev.navigation, [menuType]: menu }
      };
    });
  };

  // Check if nav item is enabled
  const isNavItemEnabled = (menuType, itemId) => {
    const menu = formData.navigation[menuType] || [];
    const item = menu.find(i => i.id === itemId);
    return item?.enabled ?? false;
  };

  // Handle widget add to dashboard
  const addWidget = (widgetId) => {
    const widget = availableWidgets[widgetId];
    if (!widget) return;
    
    // Find next available position
    const layout = formData.default_dashboard.layout || [];
    const maxY = layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);
    
    const newWidget = {
      widget: widgetId,
      x: 0,
      y: maxY,
      w: widget.minW || 3,
      h: widget.minH || 2
    };
    
    setFormData(prev => ({
      ...prev,
      default_dashboard: {
        layout: [...prev.default_dashboard.layout, newWidget]
      }
    }));
  };

  // Remove widget from dashboard
  const removeWidget = (index) => {
    setFormData(prev => ({
      ...prev,
      default_dashboard: {
        layout: prev.default_dashboard.layout.filter((_, i) => i !== index)
      }
    }));
  };

  // Handle layout change from grid
  const onLayoutChange = (newLayout) => {
    setFormData(prev => ({
      ...prev,
      default_dashboard: {
        layout: prev.default_dashboard.layout.map((widget, i) => ({
          ...widget,
          x: newLayout[i]?.x ?? widget.x,
          y: newLayout[i]?.y ?? widget.y,
          w: newLayout[i]?.w ?? widget.w,
          h: newLayout[i]?.h ?? widget.h
        }))
      }
    }));
  };

  // Save role
  const handleSave = async () => {
    setLoading(true);
    setError('');
    
    try {
      await onSave(formData);
    } catch (err) {
      setError(err.message || 'Failed to save role');
    } finally {
      setLoading(false);
    }
  };

  // Render icon
  const renderIcon = (iconName, className = "w-4 h-4") => {
    const IconComponent = ICON_MAP[iconName];
    return IconComponent ? <IconComponent className={className} /> : null;
  };

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">
          {role ? `Edit Role: ${role.name}` : 'Create New Role'}
        </h2>
        <button onClick={onCancel} className="text-zinc-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Section Tabs */}
      <div className="flex gap-2 mb-6 border-b border-zinc-800 pb-4">
        {['basic', 'navigation', 'dashboard', 'incentives'].map(section => (
          <button
            key={section}
            onClick={() => setActiveSection(section)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSection === section
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            {section.charAt(0).toUpperCase() + section.slice(1)}
          </button>
        ))}
      </div>

      {/* Basic Info Section */}
      {activeSection === 'basic' && (
        <div className="space-y-4">
          <div>
            <Label className="text-zinc-300">Role Name</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Product Director"
              className="mt-1 bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
          
          <div>
            <Label className="text-zinc-300">Description</Label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Role description..."
              className="mt-1 bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
          
          <div>
            <Label className="text-zinc-300">Data Scope</Label>
            <select
              value={formData.data_scope}
              onChange={(e) => setFormData(prev => ({ ...prev, data_scope: e.target.value }))}
              className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white"
            >
              <option value="own">Own Data Only</option>
              <option value="team">Team Data</option>
              <option value="department">Department Data</option>
              <option value="all">All Data</option>
            </select>
          </div>
        </div>
      )}

      {/* Navigation Section */}
      {activeSection === 'navigation' && (
        <div className="space-y-6">
          {/* Main Menu */}
          <div>
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Main Navigation</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {availableNavItems.main_menu?.map(item => (
                <button
                  key={item.id}
                  onClick={() => toggleNavItem('main_menu', item.id)}
                  className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                    isNavItemEnabled('main_menu', item.id)
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  {isNavItemEnabled('main_menu', item.id) ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    renderIcon(item.icon)
                  )}
                  <span className="text-sm">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Admin Menu */}
          <div>
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Admin Navigation</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {availableNavItems.admin_menu?.map(item => (
                <button
                  key={item.id}
                  onClick={() => toggleNavItem('admin_menu', item.id)}
                  className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                    isNavItemEnabled('admin_menu', item.id)
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  {isNavItemEnabled('admin_menu', item.id) ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    renderIcon(item.icon)
                  )}
                  <span className="text-sm">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Dashboard Section */}
      {activeSection === 'dashboard' && (
        <div className="space-y-4">
          {/* Widget Palette */}
          <div>
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Available Widgets</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(availableWidgets).map(([id, widget]) => (
                <button
                  key={id}
                  onClick={() => addWidget(id)}
                  className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm text-zinc-300 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  {widget.name}
                </button>
              ))}
            </div>
          </div>

          {/* Dashboard Preview */}
          <div>
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Dashboard Layout (Drag to Arrange)</h3>
            <div className="bg-zinc-950 rounded-lg border border-zinc-800 p-4 min-h-[300px]">
              {formData.default_dashboard.layout.length === 0 ? (
                <div className="flex items-center justify-center h-[200px] text-zinc-500">
                  Click widgets above to add them to the dashboard
                </div>
              ) : (
                <GridLayout
                  className="layout"
                  layout={formData.default_dashboard.layout.map((w, i) => ({
                    i: String(i),
                    x: w.x,
                    y: w.y,
                    w: w.w,
                    h: w.h,
                    minW: availableWidgets[w.widget]?.minW || 2,
                    minH: availableWidgets[w.widget]?.minH || 2
                  }))}
                  cols={12}
                  rowHeight={40}
                  width={800}
                  onLayoutChange={(layout) => onLayoutChange(layout)}
                  draggableHandle=".drag-handle"
                >
                  {formData.default_dashboard.layout.map((widget, index) => (
                    <div
                      key={index}
                      className="bg-zinc-800 rounded-lg border border-zinc-700 flex flex-col"
                    >
                      <div className="flex items-center justify-between p-2 border-b border-zinc-700">
                        <div className="flex items-center gap-2">
                          <GripVertical className="w-4 h-4 text-zinc-500 drag-handle cursor-move" />
                          <span className="text-sm text-zinc-300">
                            {availableWidgets[widget.widget]?.name || widget.widget}
                          </span>
                        </div>
                        <button
                          onClick={() => removeWidget(index)}
                          className="text-zinc-500 hover:text-red-400"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex-1 flex items-center justify-center text-zinc-500 text-xs">
                        {availableWidgets[widget.widget]?.category || 'widget'}
                      </div>
                    </div>
                  ))}
                </GridLayout>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Incentives Section */}
      {activeSection === 'incentives' && (
        <div className="space-y-4">
          <div>
            <Label className="text-zinc-300">Commission Template</Label>
            <select
              value={formData.incentive_config.commission_template_id || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                incentive_config: { ...prev.incentive_config, commission_template_id: e.target.value || null }
              }))}
              className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white"
            >
              <option value="">Default Template</option>
              {commissionTemplates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.incentive_config.show_earnings}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  incentive_config: { ...prev.incentive_config, show_earnings: e.target.checked }
                }))}
                className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500"
              />
              <span className="text-sm text-zinc-300">Show Own Earnings</span>
            </label>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.incentive_config.show_team_earnings}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  incentive_config: { ...prev.incentive_config, show_team_earnings: e.target.checked }
                }))}
                className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500"
              />
              <span className="text-sm text-zinc-300">Show Team Earnings</span>
            </label>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-zinc-800">
        <Button
          variant="outline"
          onClick={onCancel}
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={loading || !formData.name}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {loading ? (
            <>
              <span className="animate-spin mr-2">⟳</span>
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Role
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default RoleConfigurationPanel;
