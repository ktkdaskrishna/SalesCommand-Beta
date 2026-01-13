/**
 * Accounts Page
 * List and manage customer accounts with table/card toggle view
 */
import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { accountsAPI, opportunitiesAPI } from '../services/api';
import {
  Building2, Plus, Search, LayoutGrid, List, Filter,
  ChevronRight, TrendingUp, TrendingDown, Minus,
  Phone, Globe, MapPin, Users, DollarSign, X, Save,
  MoreVertical, Edit2, Trash2, ExternalLink
} from 'lucide-react';

const Accounts = () => {
  const [accounts, setAccounts] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'table'
  const [searchQuery, setSearchQuery] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    website: '',
    phone: '',
    address: '',
    city: '',
    country: '',
    annual_revenue: '',
    employee_count: ''
  });

  // Fetch data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [accountsRes, oppsRes] = await Promise.all([
        accountsAPI.getAll(),
        opportunitiesAPI.getAll()
      ]);
      setAccounts(accountsRes.data || []);
      setOpportunities(oppsRes.data || []);
    } catch (err) {
      setError('Failed to load accounts');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate account metrics
  const getAccountMetrics = (accountId) => {
    const accountOpps = opportunities.filter(o => o.account_id === accountId);
    const activeOpps = accountOpps.filter(o => !['closed_won', 'closed_lost'].includes(o.stage));
    const wonOpps = accountOpps.filter(o => o.stage === 'closed_won');
    const lostOpps = accountOpps.filter(o => o.stage === 'closed_lost');
    
    const pipelineValue = activeOpps.reduce((sum, o) => sum + (o.value || 0), 0);
    const wonValue = wonOpps.reduce((sum, o) => sum + (o.value || 0), 0);
    const winRate = (wonOpps.length + lostOpps.length) > 0 
      ? Math.round((wonOpps.length / (wonOpps.length + lostOpps.length)) * 100) 
      : null;

    return { activeOpps: activeOpps.length, pipelineValue, wonValue, winRate };
  };

  // Get health score
  const getHealthScore = (accountId) => {
    const metrics = getAccountMetrics(accountId);
    if (metrics.winRate === null) return 'new';
    if (metrics.winRate >= 60) return 'healthy';
    if (metrics.winRate >= 30) return 'at-risk';
    return 'critical';
  };

  // Filter accounts
  const filteredAccounts = accounts.filter(account => {
    const matchesSearch = account.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         account.industry?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesIndustry = !filterIndustry || account.industry === filterIndustry;
    return matchesSearch && matchesIndustry;
  });

  // Get unique industries
  const industries = [...new Set(accounts.map(a => a.industry).filter(Boolean))];

  // Create account
  const handleCreate = async () => {
    try {
      await accountsAPI.create({
        ...formData,
        annual_revenue: formData.annual_revenue ? parseFloat(formData.annual_revenue) : null,
        employee_count: formData.employee_count ? parseInt(formData.employee_count) : null
      });
      setShowCreateModal(false);
      setFormData({ name: '', industry: '', website: '', phone: '', address: '', city: '', country: '', annual_revenue: '', employee_count: '' });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create account');
    }
  };

  // Format currency
  const formatCurrency = (value) => {
    if (!value) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  };

  // Health badge component
  const HealthBadge = ({ status }) => {
    const styles = {
      healthy: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
      'at-risk': 'bg-amber-500/20 text-amber-400 border-amber-500/50',
      critical: 'bg-red-500/20 text-red-400 border-red-500/50',
      new: 'bg-blue-500/20 text-blue-400 border-blue-500/50'
    };
    const labels = { healthy: 'Healthy', 'at-risk': 'At Risk', critical: 'Critical', new: 'New' };
    
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Accounts</h1>
          <p className="text-sm text-zinc-400 mt-1">Manage your customer accounts and relationships</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="bg-emerald-600 hover:bg-emerald-500">
          <Plus className="w-4 h-4 mr-2" />
          New Account
        </Button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
        <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              placeholder="Search accounts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
          
          <select
            value={filterIndustry}
            onChange={(e) => setFilterIndustry(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300"
          >
            <option value="">All Industries</option>
            {industries.map(ind => (
              <option key={ind} value={ind}>{ind}</option>
            ))}
          </select>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-zinc-800 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('card')}
            className={`p-2 rounded ${viewMode === 'card' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded ${viewMode === 'table' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-zinc-400">No accounts found</h3>
          <p className="text-sm text-zinc-500 mt-1">Create your first account to get started</p>
          <Button onClick={() => setShowCreateModal(true)} className="mt-4 bg-emerald-600 hover:bg-emerald-500">
            <Plus className="w-4 h-4 mr-2" />
            Create Account
          </Button>
        </div>
      ) : viewMode === 'card' ? (
        /* Card View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAccounts.map(account => {
            const metrics = getAccountMetrics(account.id);
            const health = getHealthScore(account.id);
            
            return (
              <div
                key={account.id}
                className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-all cursor-pointer group"
                onClick={() => setSelectedAccount(account)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white group-hover:text-emerald-400 transition-colors">
                        {account.name}
                      </h3>
                      <p className="text-xs text-zinc-500">{account.industry || 'No industry'}</p>
                    </div>
                  </div>
                  <HealthBadge status={health} />
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-zinc-800/50 rounded-lg p-3">
                    <p className="text-xs text-zinc-500 mb-1">Pipeline</p>
                    <p className="text-sm font-semibold text-white">{formatCurrency(metrics.pipelineValue)}</p>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-3">
                    <p className="text-xs text-zinc-500 mb-1">Won Revenue</p>
                    <p className="text-sm font-semibold text-emerald-400">{formatCurrency(metrics.wonValue)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>{metrics.activeOpps} active opportunities</span>
                  {metrics.winRate !== null && (
                    <span className={metrics.winRate >= 50 ? 'text-emerald-400' : 'text-amber-400'}>
                      {metrics.winRate}% win rate
                    </span>
                  )}
                </div>

                {account.website && (
                  <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center gap-2 text-xs text-zinc-500">
                    <Globe className="w-3 h-3" />
                    <a href={account.website} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400" onClick={(e) => e.stopPropagation()}>
                      {account.website.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-sm font-medium text-zinc-400">Account</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-zinc-400">Industry</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-zinc-400">Health</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-zinc-400">Pipeline</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-zinc-400">Won</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-zinc-400">Opportunities</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-zinc-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map(account => {
                const metrics = getAccountMetrics(account.id);
                const health = getHealthScore(account.id);
                
                return (
                  <tr 
                    key={account.id} 
                    className="border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer"
                    onClick={() => setSelectedAccount(account)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">{account.name}</p>
                          {account.website && (
                            <p className="text-xs text-zinc-500">{account.website.replace(/^https?:\/\//, '')}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-300">{account.industry || '-'}</td>
                    <td className="px-4 py-3"><HealthBadge status={health} /></td>
                    <td className="px-4 py-3 text-right text-sm text-white">{formatCurrency(metrics.pipelineValue)}</td>
                    <td className="px-4 py-3 text-right text-sm text-emerald-400">{formatCurrency(metrics.wonValue)}</td>
                    <td className="px-4 py-3 text-center text-sm text-zinc-300">{metrics.activeOpps}</td>
                    <td className="px-4 py-3 text-right">
                      <button className="p-1 text-zinc-400 hover:text-white" onClick={(e) => e.stopPropagation()}>
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Create New Account</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-zinc-300">Account Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Acme Corporation"
                  className="mt-1 bg-zinc-800 border-zinc-700 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-zinc-300">Industry</Label>
                  <Input
                    value={formData.industry}
                    onChange={(e) => setFormData(prev => ({ ...prev, industry: e.target.value }))}
                    placeholder="e.g., Technology"
                    className="mt-1 bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-zinc-300">Website</Label>
                  <Input
                    value={formData.website}
                    onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                    placeholder="https://..."
                    className="mt-1 bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-zinc-300">Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+1 555 123 4567"
                    className="mt-1 bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-zinc-300">Employee Count</Label>
                  <Input
                    type="number"
                    value={formData.employee_count}
                    onChange={(e) => setFormData(prev => ({ ...prev, employee_count: e.target.value }))}
                    placeholder="e.g., 500"
                    className="mt-1 bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
              </div>

              <div>
                <Label className="text-zinc-300">Annual Revenue</Label>
                <Input
                  type="number"
                  value={formData.annual_revenue}
                  onChange={(e) => setFormData(prev => ({ ...prev, annual_revenue: e.target.value }))}
                  placeholder="e.g., 10000000"
                  className="mt-1 bg-zinc-800 border-zinc-700 text-white"
                />
              </div>

              <div>
                <Label className="text-zinc-300">Address</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Street address"
                  className="mt-1 bg-zinc-800 border-zinc-700 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-zinc-300">City</Label>
                  <Input
                    value={formData.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="City"
                    className="mt-1 bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-zinc-300">Country</Label>
                  <Input
                    value={formData.country}
                    onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                    placeholder="Country"
                    className="mt-1 bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-zinc-800">
              <Button variant="outline" onClick={() => setShowCreateModal(false)} className="border-zinc-700 text-zinc-300">
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!formData.name} className="bg-emerald-600 hover:bg-emerald-500">
                <Save className="w-4 h-4 mr-2" />
                Create Account
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Accounts;
