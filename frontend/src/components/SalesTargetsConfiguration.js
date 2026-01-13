/**
 * Sales Targets Configuration Component
 * Admin UI for assigning sales quotas/targets to users
 */
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Target,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Calendar,
  DollarSign,
  Users,
  TrendingUp,
  Info,
} from 'lucide-react';

// Format currency
const formatCurrency = (value) => {
  if (!value) return '$0';
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    maximumFractionDigits: 0 
  }).format(value);
};

// Format date
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Period type badge
const PeriodBadge = ({ type }) => {
  const configs = {
    monthly: { label: 'Monthly', className: 'bg-blue-50 text-blue-700 border-blue-200' },
    quarterly: { label: 'Quarterly', className: 'bg-purple-50 text-purple-700 border-purple-200' },
    yearly: { label: 'Yearly', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  };
  const config = configs[type] || configs.monthly;
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${config.className}`}>
      {config.label}
    </span>
  );
};

// Target Form Modal
const TargetFormModal = ({ isOpen, onClose, onSave, target, users }) => {
  const [formData, setFormData] = useState({
    user_id: '',
    period_type: 'monthly',
    period_start: '',
    period_end: '',
    target_revenue: 0,
    target_deals: 0,
    target_activities: 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (target) {
      setFormData({
        user_id: target.user_id || '',
        period_type: target.period_type || 'monthly',
        period_start: target.period_start?.split('T')[0] || '',
        period_end: target.period_end?.split('T')[0] || '',
        target_revenue: target.target_revenue || 0,
        target_deals: target.target_deals || 0,
        target_activities: target.target_activities || 0,
      });
    } else {
      // Default to current month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setFormData({
        user_id: '',
        period_type: 'monthly',
        period_start: startOfMonth.toISOString().split('T')[0],
        period_end: endOfMonth.toISOString().split('T')[0],
        target_revenue: 100000,
        target_deals: 5,
        target_activities: 50,
      });
    }
  }, [target]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!formData.user_id) {
      setError('Please select a user');
      return;
    }
    if (!formData.period_start || !formData.period_end) {
      setError('Please set period dates');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...formData,
        period_start: new Date(formData.period_start).toISOString(),
        period_end: new Date(formData.period_end).toISOString(),
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save target');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full" data-testid="target-form-modal">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-600" />
            {target ? 'Edit Target' : 'Create Sales Target'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* User Selection */}
          <div>
            <Label htmlFor="user_id">Assign To</Label>
            <select
              id="user_id"
              value={formData.user_id}
              onChange={(e) => setFormData({...formData, user_id: e.target.value})}
              className="input w-full mt-1"
              data-testid="target-user-select"
            >
              <option value="">Select a user...</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
          </div>

          {/* Period Type */}
          <div>
            <Label htmlFor="period_type">Period Type</Label>
            <select
              id="period_type"
              value={formData.period_type}
              onChange={(e) => setFormData({...formData, period_type: e.target.value})}
              className="input w-full mt-1"
              data-testid="target-period-type"
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          {/* Period Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="period_start">Start Date</Label>
              <Input
                id="period_start"
                type="date"
                value={formData.period_start}
                onChange={(e) => setFormData({...formData, period_start: e.target.value})}
                className="mt-1"
                data-testid="target-start-date"
              />
            </div>
            <div>
              <Label htmlFor="period_end">End Date</Label>
              <Input
                id="period_end"
                type="date"
                value={formData.period_end}
                onChange={(e) => setFormData({...formData, period_end: e.target.value})}
                className="mt-1"
                data-testid="target-end-date"
              />
            </div>
          </div>

          {/* Target Values */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="target_revenue">Revenue Target ($)</Label>
              <Input
                id="target_revenue"
                type="number"
                value={formData.target_revenue}
                onChange={(e) => setFormData({...formData, target_revenue: parseFloat(e.target.value) || 0})}
                className="mt-1"
                data-testid="target-revenue"
              />
            </div>
            <div>
              <Label htmlFor="target_deals">Deals Target</Label>
              <Input
                id="target_deals"
                type="number"
                value={formData.target_deals}
                onChange={(e) => setFormData({...formData, target_deals: parseInt(e.target.value) || 0})}
                className="mt-1"
                data-testid="target-deals"
              />
            </div>
            <div>
              <Label htmlFor="target_activities">Activities Target</Label>
              <Input
                id="target_activities"
                type="number"
                value={formData.target_activities}
                onChange={(e) => setFormData({...formData, target_activities: parseInt(e.target.value) || 0})}
                className="mt-1"
                data-testid="target-activities"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {target ? 'Update Target' : 'Create Target'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

const SalesTargetsConfiguration = () => {
  const [targets, setTargets] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingTarget, setEditingTarget] = useState(null);
  const [filterPeriod, setFilterPeriod] = useState('');

  useEffect(() => {
    fetchData();
  }, [filterPeriod]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [targetsRes, usersRes] = await Promise.all([
        api.get(`/config/targets${filterPeriod ? `?period_type=${filterPeriod}` : ''}`),
        api.get('/auth/users')
      ]);
      setTargets(targetsRes.data || []);
      setUsers(usersRes.data || []);
    } catch (err) {
      setError('Failed to load targets');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data) => {
    await api.post('/config/targets', data);
    setSuccess('Target created successfully');
    setTimeout(() => setSuccess(''), 3000);
    fetchData();
  };

  const handleUpdate = async (data) => {
    await api.put(`/config/targets/${editingTarget.id}`, null, { params: data });
    setSuccess('Target updated successfully');
    setTimeout(() => setSuccess(''), 3000);
    fetchData();
  };

  const handleDelete = async (targetId) => {
    if (!window.confirm('Are you sure you want to delete this target?')) return;
    
    try {
      await api.delete(`/config/targets/${targetId}`);
      setSuccess('Target deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete target');
    }
  };

  const getUserName = (userId) => {
    const user = users.find(u => u.id === userId);
    return user ? user.name : 'Unknown User';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="sales-targets-config">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-600" />
            Sales Targets
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Assign revenue and activity targets to sales team members
          </p>
        </div>
        <Button onClick={() => { setEditingTarget(null); setShowModal(true); }} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          New Target
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          {success}
        </div>
      )}

      {/* Info Banner */}
      <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">Target Assignment</p>
          <p className="text-blue-600 mt-1">
            Set revenue goals, deal counts, and activity targets for each team member. 
            Targets are used for quota attainment calculations and performance tracking.
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <select
          value={filterPeriod}
          onChange={(e) => setFilterPeriod(e.target.value)}
          className="input w-auto"
          data-testid="filter-period"
        >
          <option value="">All Periods</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
        </select>
        <span className="text-sm text-slate-500">{targets.length} target(s)</span>
      </div>

      {/* Targets Table */}
      {targets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <Target className="w-8 h-8 text-slate-400" />
          </div>
          <h4 className="font-semibold text-slate-700 mb-2">No targets assigned yet</h4>
          <p className="text-sm text-slate-500 max-w-md">
            Create targets to track sales team performance against revenue and activity goals.
          </p>
          <Button onClick={() => { setEditingTarget(null); setShowModal(true); }} className="mt-4 btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Create First Target
          </Button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Period</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Revenue Target</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Deals</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Activities</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {targets.map((target) => (
                  <tr key={target.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors" data-testid={`target-row-${target.id}`}>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                          <Users className="w-4 h-4 text-indigo-600" />
                        </div>
                        <span className="font-medium text-slate-900">{getUserName(target.user_id)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <PeriodBadge type={target.period_type} />
                        <p className="text-xs text-slate-500">
                          {formatDate(target.period_start)} - {formatDate(target.period_end)}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="font-semibold text-slate-900">{formatCurrency(target.target_revenue)}</span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-slate-700">{target.target_deals}</span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-slate-700">{target.target_activities}</span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setEditingTarget(target); setShowModal(true); }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                          data-testid={`edit-target-${target.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(target.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          data-testid={`delete-target-${target.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      <TargetFormModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingTarget(null); }}
        onSave={editingTarget ? handleUpdate : handleCreate}
        target={editingTarget}
        users={users}
      />
    </div>
  );
};

export default SalesTargetsConfiguration;
