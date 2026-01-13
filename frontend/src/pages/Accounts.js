/**
 * Accounts Page
 * Shows synced account data from Odoo ERP via data_lake_serving
 * Modern light-themed design with glassmorphic cards
 */
import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { accountsAPI, opportunitiesAPI } from '../services/api';
import api from '../services/api';
import Account360Panel from '../components/Account360Panel';
import {
  Building2, Plus, Search, LayoutGrid, List,
  ChevronRight, TrendingUp, TrendingDown,
  Phone, Globe, MapPin, Users, DollarSign, X, Save,
  MoreVertical, Edit2, Trash2, ExternalLink, Filter,
  Database, RefreshCw, Info, Eye
} from 'lucide-react';

// Data Source Badge
const DataSourceBadge = ({ source, lastSync }) => {
  const formatSyncTime = (timestamp) => {
    if (!timestamp) return "Recently";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-sm">
      <Database className="w-3.5 h-3.5 text-blue-600" />
      <span className="text-blue-700 font-medium">Source: {source || "CRM"}</span>
      {lastSync && (
        <>
          <span className="text-blue-300">|</span>
          <RefreshCw className="w-3 h-3 text-blue-500" />
          <span className="text-blue-600">{formatSyncTime(lastSync)}</span>
        </>
      )}
    </div>
  );
};

const Accounts = () => {
  const [accounts, setAccounts] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('card');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [show360Panel, setShow360Panel] = useState(false);
  const [selected360AccountId, setSelected360AccountId] = useState(null);
  const [dataSource, setDataSource] = useState('');
  const [lastSync, setLastSync] = useState(null);

  // Form state - preserved from original
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

  // Fetch data - preserved from original
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch real accounts from data lake first, fallback to legacy
      let accountsData = [];
      try {
        const realAccountsRes = await api.get('/accounts/real');
        if (realAccountsRes.data?.accounts?.length > 0) {
          accountsData = realAccountsRes.data.accounts;
          setDataSource('Odoo');
          setLastSync(realAccountsRes.data.accounts[0]?.last_synced);
        }
      } catch (e) {
        console.log('Data lake accounts not available, using legacy');
      }
      
      // Fallback to legacy accounts if data lake is empty
      if (accountsData.length === 0) {
        const legacyRes = await accountsAPI.getAll();
        accountsData = legacyRes.data || [];
        setDataSource('CRM');
      }
      
      const oppsRes = await opportunitiesAPI.getAll();
      setAccounts(accountsData);
      setOpportunities(oppsRes.data || []);
    } catch (err) {
      setError('Failed to load accounts');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate account metrics - use backend data when available, fallback to local calculation
  const getAccountMetrics = (account) => {
    // If account has pre-calculated metrics from backend (Odoo data), use them
    if (account.pipeline_value !== undefined) {
      return {
        activeOpps: account.active_opportunities || 0,
        pipelineValue: account.pipeline_value || 0,
        wonValue: account.won_value || 0,
        winRate: null  // Win rate requires more data
      };
    }
    
    // Fallback: calculate from local opportunities (for legacy CRM data)
    const accountId = account.id;
    const accountName = (account.name || "").toLowerCase();
    
    // Match by ID or name
    const accountOpps = opportunities.filter(o => {
      if (o.account_id === accountId) return true;
      const oppAccountName = (o.account_name || "").toLowerCase();
      return accountName && oppAccountName && oppAccountName.includes(accountName);
    });
    
    const activeOpps = accountOpps.filter(o => !['closed_won', 'closed_lost', 'won', 'lost'].includes((o.stage || '').toLowerCase()));
    const wonOpps = accountOpps.filter(o => ['closed_won', 'won'].includes((o.stage || '').toLowerCase()));
    const lostOpps = accountOpps.filter(o => ['closed_lost', 'lost'].includes((o.stage || '').toLowerCase()));
    
    const pipelineValue = activeOpps.reduce((sum, o) => sum + (o.value || 0), 0);
    const wonValue = wonOpps.reduce((sum, o) => sum + (o.value || 0), 0);
    const winRate = (wonOpps.length + lostOpps.length) > 0 
      ? Math.round((wonOpps.length / (wonOpps.length + lostOpps.length)) * 100) 
      : null;

    return { activeOpps: activeOpps.length, pipelineValue, wonValue, winRate };
  };

  // Get health score - use account object for pre-calculated metrics
  const getHealthScore = (account) => {
    const metrics = getAccountMetrics(account);
    if (metrics.winRate === null && metrics.pipelineValue === 0 && metrics.wonValue === 0) return 'new';
    if (metrics.wonValue > 0 || (metrics.winRate !== null && metrics.winRate >= 60)) return 'healthy';
    if (metrics.pipelineValue > 0 || (metrics.winRate !== null && metrics.winRate >= 30)) return 'at-risk';
    return 'critical';
  };

  // Get unique industries - preserved from original
  const industries = [...new Set(accounts.map(a => a.industry).filter(Boolean))];

  // Create account - preserved from original
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

  // Format currency - preserved from original
  const formatCurrency = (value) => {
    if (!value) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  };

  // Filter accounts - preserved from original
  const filteredAccounts = accounts.filter(account => {
    const matchesSearch = account.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         account.industry?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesIndustry = !filterIndustry || account.industry === filterIndustry;
    return matchesSearch && matchesIndustry;
  });

  // Get health badge styling
  const getHealthBadgeStyle = (status) => {
    const styles = {
      healthy: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'at-risk': 'bg-amber-50 text-amber-700 border-amber-200',
      critical: 'bg-red-50 text-red-700 border-red-200',
      new: 'bg-blue-50 text-blue-700 border-blue-200'
    };
    return styles[status] || styles.new;
  };

  const getHealthLabel = (status) => {
    const labels = { healthy: 'Healthy', 'at-risk': 'At Risk', critical: 'Critical', new: 'New' };
    return labels[status] || 'New';
  };

  // Open 360° Account View
  const handleOpen360View = (accountId) => {
    setSelected360AccountId(accountId);
    setShow360Panel(true);
  };

  return (
    <div className="space-y-6 animate-in" data-testid="accounts-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            Accounts
          </h1>
          <p className="text-slate-500 mt-1">Manage your customer accounts and relationships</p>
          {/* Data Source Badge */}
          <div className="mt-3">
            <DataSourceBadge source={dataSource} lastSync={lastSync} />
          </div>
        </div>
        <Button 
          onClick={() => setShowCreateModal(true)} 
          className="btn-primary"
          data-testid="new-account-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Account
        </Button>
      </div>

      {/* Filters Bar */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="search-accounts"
              />
            </div>
            
            <select
              value={filterIndustry}
              onChange={(e) => setFilterIndustry(e.target.value)}
              className="input w-auto min-w-[140px]"
              data-testid="industry-filter"
            >
              <option value="">All Industries</option>
              {industries.map(ind => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('card')}
              className={`p-2 rounded-md transition-all ${viewMode === 'card' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
              data-testid="view-card-btn"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
              data-testid="view-table-btn"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
          <X className="w-4 h-4" />
          {error}
          <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No accounts found</h3>
          <p className="text-slate-500 mb-6">Create your first account to get started</p>
          <Button onClick={() => setShowCreateModal(true)} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Create Account
          </Button>
        </div>
      ) : viewMode === 'card' ? (
        /* Card View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAccounts.map(account => {
            const metrics = getAccountMetrics(account);
            const health = getHealthScore(account);
            
            return (
              <div
                key={account.id}
                className="card p-5 hover:shadow-lg hover:border-slate-300 transition-all cursor-pointer group"
                onClick={() => setSelectedAccount(account)}
                data-testid={`account-card-${account.id}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center group-hover:from-indigo-50 group-hover:to-indigo-100 transition-colors">
                      <Building2 className="w-6 h-6 text-slate-600 group-hover:text-indigo-600 transition-colors" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {account.name}
                      </h3>
                      <p className="text-xs text-slate-500">{account.industry || 'No industry'}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getHealthBadgeStyle(health)}`}>
                    {getHealthLabel(health)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                    <p className="text-xs text-slate-500 mb-1">Pipeline</p>
                    <p className="text-sm font-semibold text-slate-900">{formatCurrency(metrics.pipelineValue)}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                    <p className="text-xs text-emerald-600 mb-1">Won Revenue</p>
                    <p className="text-sm font-semibold text-emerald-700">{formatCurrency(metrics.wonValue)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    {metrics.activeOpps} active opportunities
                  </span>
                  {metrics.winRate !== null && (
                    <span className={`font-medium ${metrics.winRate >= 50 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {metrics.winRate}% win rate
                    </span>
                  )}
                </div>

                {account.website && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
                    <Globe className="w-3 h-3" />
                    <a 
                      href={account.website} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="hover:text-indigo-600 transition-colors truncate"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {account.website.replace(/^https?:\/\//, '')}
                    </a>
                    <ExternalLink className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                )}
                
                {/* 360° View Button */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpen360View(account.id);
                    }}
                    className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                    data-testid={`account-360-btn-${account.id}`}
                  >
                    <Eye className="w-3.5 h-3.5 mr-1.5" />
                    360° View
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Account</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Industry</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Health</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Pipeline</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Won</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Opps</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((account, idx) => {
                const metrics = getAccountMetrics(account);
                const health = getHealthScore(account);
                
                return (
                  <tr 
                    key={account.id} 
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedAccount(account)}
                    data-testid={`account-row-${idx}`}
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-slate-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{account.name}</p>
                          {account.website && (
                            <p className="text-xs text-slate-500 truncate max-w-[200px]">
                              {account.website.replace(/^https?:\/\//, '')}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">{account.industry || '-'}</td>
                    <td className="px-4 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getHealthBadgeStyle(health)}`}>
                        {getHealthLabel(health)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right text-sm font-medium text-slate-900">{formatCurrency(metrics.pipelineValue)}</td>
                    <td className="px-4 py-4 text-right text-sm font-medium text-emerald-600">{formatCurrency(metrics.wonValue)}</td>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-sm font-medium text-slate-700">
                        {metrics.activeOpps}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          className="p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpen360View(account.id);
                          }}
                          title="360° View"
                          data-testid={`table-360-btn-${account.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal - Updated styling, preserved functionality */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Create New Account</h2>
                <p className="text-sm text-slate-500 mt-1">Add a new customer to your CRM</p>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)} 
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-slate-700 font-medium">Account Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Acme Corporation"
                  className="mt-1.5"
                  data-testid="account-name-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-700 font-medium">Industry</Label>
                  <Input
                    value={formData.industry}
                    onChange={(e) => setFormData(prev => ({ ...prev, industry: e.target.value }))}
                    placeholder="e.g., Technology"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label className="text-slate-700 font-medium">Website</Label>
                  <Input
                    value={formData.website}
                    onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                    placeholder="https://..."
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-700 font-medium">Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+1 555 123 4567"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label className="text-slate-700 font-medium">Employee Count</Label>
                  <Input
                    type="number"
                    value={formData.employee_count}
                    onChange={(e) => setFormData(prev => ({ ...prev, employee_count: e.target.value }))}
                    placeholder="e.g., 500"
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div>
                <Label className="text-slate-700 font-medium">Annual Revenue</Label>
                <Input
                  type="number"
                  value={formData.annual_revenue}
                  onChange={(e) => setFormData(prev => ({ ...prev, annual_revenue: e.target.value }))}
                  placeholder="e.g., 10000000"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label className="text-slate-700 font-medium">Address</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Street address"
                  className="mt-1.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-700 font-medium">City</Label>
                  <Input
                    value={formData.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="City"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label className="text-slate-700 font-medium">Country</Label>
                  <Input
                    value={formData.country}
                    onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                    placeholder="Country"
                    className="mt-1.5"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
              <Button 
                variant="outline" 
                onClick={() => setShowCreateModal(false)}
                className="btn-secondary"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreate} 
                disabled={!formData.name}
                className="btn-primary"
                data-testid="save-account-btn"
              >
                <Save className="w-4 h-4 mr-2" />
                Create Account
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 360° Account View Panel */}
      <Account360Panel
        accountId={selected360AccountId}
        isOpen={show360Panel}
        onClose={() => {
          setShow360Panel(false);
          setSelected360AccountId(null);
        }}
      />
    </div>
  );
};

export default Accounts;
