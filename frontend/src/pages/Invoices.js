/**
 * Invoices Page (Read-only)
 * Displays synced invoice data from Odoo ERP via data_lake_serving
 * For sales awareness only - accounting is managed in Odoo
 */
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import {
  DollarSign,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  Database,
  RefreshCw,
  Info,
  Loader2,
  Search,
  Filter,
  Download,
  Lock,
} from 'lucide-react';

// Data Source Badge
const DataSourceBadge = ({ source, lastSync }) => {
  const formatSyncTime = (timestamp) => {
    if (!timestamp) return "Never";
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

// Read-only Banner
const ReadOnlyBanner = () => (
  <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
    <Lock className="w-4 h-4 flex-shrink-0" />
    <div>
      <span className="font-medium">Read-only view</span>
      <span className="text-amber-600"> — Accounting is managed in Odoo. This view is for sales awareness.</span>
    </div>
  </div>
);

// Empty State
const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
      <FileText className="w-8 h-8 text-slate-400" />
    </div>
    <h4 className="font-semibold text-slate-700 mb-2">No invoices synced yet</h4>
    <p className="text-sm text-slate-500 max-w-md">
      Invoice data will appear here once synced from Odoo. Invoices are automatically pulled from your connected ERP.
    </p>
    <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
      <Info className="w-3.5 h-3.5" />
      <span>Data syncs automatically from Odoo ERP</span>
    </div>
  </div>
);

// Payment Status Badge
const PaymentStatusBadge = ({ status }) => {
  const configs = {
    paid: { label: 'Paid', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
    partial: { label: 'Partial', className: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
    pending: { label: 'Pending', className: 'bg-slate-100 text-slate-700 border-slate-200', icon: Clock },
    overdue: { label: 'Overdue', className: 'bg-red-50 text-red-700 border-red-200', icon: AlertCircle },
    in_payment: { label: 'In Payment', className: 'bg-blue-50 text-blue-700 border-blue-200', icon: Clock },
  };
  
  const config = configs[status?.toLowerCase()] || configs.pending;
  const Icon = config.icon;
  
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
      config.className
    )}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
};

const Receivables = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSalesperson, setFilterSalesperson] = useState('all'); // NEW
  const [filterAccount, setFilterAccount] = useState('all'); // NEW

  useEffect(() => {
    fetchReceivables();
  }, []);

  const fetchReceivables = async () => {
    try {
      setLoading(true);
      const response = await api.get('/receivables');
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load receivables');
    } finally {
      setLoading(false);
    }
  };

  // Get unique salespersons and accounts for filters
  const salespersons = [...new Set(data?.invoices?.map(i => i.salesperson).filter(Boolean))] || [];
  const accounts = [...new Set(data?.invoices?.map(i => i.customer_name).filter(Boolean))] || [];

  // Filter invoices with enhanced filters
  const filteredInvoices = data?.invoices?.filter(inv => {
    const matchesSearch = !searchQuery || 
      inv.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.salesperson?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || inv.payment_status === filterStatus;
    const matchesSalesperson = filterSalesperson === 'all' || inv.salesperson === filterSalesperson;
    const matchesAccount = filterAccount === 'all' || inv.customer_name === filterAccount;
    
    return matchesSearch && matchesStatus && matchesSalesperson && matchesAccount;
  }) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-red-500">
        <AlertCircle className="w-12 h-12 mb-4" />
        <p className="font-medium">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="invoices-page">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Invoices</h1>
          <p className="text-slate-600 mt-1">View synced invoices from Odoo ERP</p>
          <div className="mt-3 flex items-center gap-3">
            <DataSourceBadge source="Odoo" lastSync={data?.invoices?.[0]?.last_synced} />
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={fetchReceivables} className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Read-only Banner */}
      <ReadOnlyBanner />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Receivables</p>
              <p className="text-xl font-bold text-slate-900">{formatCurrency(data?.summary?.total_receivables || 0)}</p>
            </div>
          </div>
        </div>
        
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Collected</p>
              <p className="text-xl font-bold text-slate-900">{formatCurrency(data?.summary?.total_collected || 0)}</p>
            </div>
          </div>
        </div>
        
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Pending Invoices</p>
              <p className="text-xl font-bold text-slate-900">{data?.summary?.pending_count || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Overdue</p>
              <p className="text-xl font-bold text-slate-900">{data?.summary?.overdue_count || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search invoices, customers, salesperson..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
            data-testid="search-invoices"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="input w-auto min-w-[150px]"
          data-testid="filter-status"
        >
          <option value="all">All Statuses</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
          <option value="overdue">Overdue</option>
        </select>
        
        {/* ENHANCED: Salesperson Filter */}
        {salespersons.length > 0 && (
          <select
            value={filterSalesperson}
            onChange={(e) => setFilterSalesperson(e.target.value)}
            className="input w-auto min-w-[150px]"
            data-testid="filter-salesperson"
          >
            <option value="all">All Salespersons</option>
            {salespersons.map(sp => (
              <option key={sp} value={sp}>{sp}</option>
            ))}
          </select>
        )}
        
        {/* ENHANCED: Account Filter */}
        {accounts.length > 1 && (
          <select
            value={filterAccount}
            onChange={(e) => setFilterAccount(e.target.value)}
            className="input w-auto min-w-[150px]"
            data-testid="filter-account"
          >
            <option value="all">All Accounts</option>
            {accounts.map(acc => (
              <option key={acc} value={acc}>{acc}</option>
            ))}
          </select>
        )}
      </div>

      {/* Invoices Table */}
      {filteredInvoices.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Invoice #</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount Due</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Invoice Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Due Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice) => (
                  <tr 
                    key={invoice.id} 
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    data-testid={`invoice-row-${invoice.id}`}
                  >
                    <td className="px-4 py-4">
                      <span className="font-mono font-medium text-indigo-600">
                        {invoice.invoice_number || `INV-${invoice.id}`}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-slate-900">{invoice.customer_name || '—'}</span>
                    </td>
                    <td className="px-4 py-4 text-right font-medium text-slate-900">
                      {formatCurrency(invoice.total_amount)}
                    </td>
                    <td className="px-4 py-4 text-right font-medium">
                      <span className={invoice.amount_due > 0 ? 'text-amber-600' : 'text-slate-400'}>
                        {formatCurrency(invoice.amount_due)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <PaymentStatusBadge status={invoice.payment_status} />
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-500">
                      {invoice.invoice_date ? formatDate(invoice.invoice_date) : '—'}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-500">
                      {invoice.due_date ? formatDate(invoice.due_date) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Data Note */}
      {data?.data_note && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Info className="w-4 h-4" />
          <span>{data.data_note}</span>
        </div>
      )}
    </div>
  );
};

export default Receivables;
