/**
 * Account 360° View Panel
 * Slide-over component showing complete account view with all related entities
 */
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import {
  X,
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  DollarSign,
  Target,
  FileText,
  Users,
  Calendar,
  TrendingUp,
  TrendingDown,
  Loader2,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  Clock,
  Activity,
} from 'lucide-react';

// Summary Card Component
const SummaryCard = ({ title, value, subtitle, icon: Icon, color = "blue", trend }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
        <p className={cn("text-2xl font-bold mt-1", `text-${color}-600`)}>{value}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", `bg-${color}-50`)}>
        <Icon className={cn("w-5 h-5", `text-${color}-600`)} />
      </div>
    </div>
    {trend && (
      <div className="mt-2 flex items-center gap-1 text-xs">
        {trend > 0 ? (
          <>
            <TrendingUp className="w-3 h-3 text-emerald-500" />
            <span className="text-emerald-600">+{trend}%</span>
          </>
        ) : (
          <>
            <TrendingDown className="w-3 h-3 text-red-500" />
            <span className="text-red-600">{trend}%</span>
          </>
        )}
        <span className="text-slate-400">vs last period</span>
      </div>
    )}
  </div>
);

// Collapsible Section Component
const CollapsibleSection = ({ title, icon: Icon, count, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
        data-testid={`section-${title.toLowerCase().replace(/\s/g, '-')}`}
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-slate-600" />
          <span className="font-semibold text-slate-900">{title}</span>
          {count !== undefined && (
            <span className="bg-slate-200 text-slate-600 text-xs font-medium px-2 py-0.5 rounded-full">
              {count}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-slate-400" />
        )}
      </button>
      {isOpen && <div className="p-4 bg-white">{children}</div>}
    </div>
  );
};

// Opportunity Row
const OpportunityRow = ({ opportunity }) => {
  const getStageColor = (stage) => {
    const s = (stage || '').toLowerCase();
    if (s.includes('won')) return 'bg-emerald-100 text-emerald-700';
    if (s.includes('lost')) return 'bg-red-100 text-red-700';
    if (s.includes('negot')) return 'bg-purple-100 text-purple-700';
    if (s.includes('propos')) return 'bg-amber-100 text-amber-700';
    return 'bg-blue-100 text-blue-700';
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 px-2 rounded-lg transition-colors">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 truncate">{opportunity.name}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", getStageColor(opportunity.stage))}>
            {opportunity.stage}
          </span>
          <span className="text-xs text-slate-500">{opportunity.salesperson}</span>
        </div>
      </div>
      <div className="text-right ml-4">
        <p className="font-bold text-slate-900">{formatCurrency(opportunity.value)}</p>
        <p className="text-xs text-slate-500">{opportunity.probability}% prob.</p>
      </div>
    </div>
  );
};

// Invoice Row
const InvoiceRow = ({ invoice }) => {
  const getStatusColor = (status) => {
    if (status === 'paid' || status === 'in_payment') return 'bg-emerald-100 text-emerald-700';
    if (status === 'not_paid') return 'bg-red-100 text-red-700';
    return 'bg-amber-100 text-amber-700';
  };

  const getStatusLabel = (status) => {
    if (status === 'paid') return 'Paid';
    if (status === 'in_payment') return 'In Payment';
    if (status === 'not_paid') return 'Unpaid';
    return status || 'Pending';
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 px-2 rounded-lg transition-colors">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900">{invoice.number || 'Draft'}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", getStatusColor(invoice.payment_status))}>
            {getStatusLabel(invoice.payment_status)}
          </span>
          <span className="text-xs text-slate-500">
            {invoice.invoice_date ? formatDate(invoice.invoice_date) : 'No date'}
          </span>
        </div>
      </div>
      <div className="text-right ml-4">
        <p className="font-bold text-slate-900">{formatCurrency(invoice.amount_total)}</p>
        {invoice.amount_due > 0 && (
          <p className="text-xs text-red-600">Due: {formatCurrency(invoice.amount_due)}</p>
        )}
      </div>
    </div>
  );
};

// Activity Row
const ActivityRow = ({ activity }) => {
  const getStatusIcon = (status) => {
    if (status === 'completed') return <CheckCircle className="w-4 h-4 text-emerald-500" />;
    if (status === 'in_progress') return <Clock className="w-4 h-4 text-amber-500" />;
    return <AlertCircle className="w-4 h-4 text-slate-400" />;
  };

  const getPriorityColor = (priority) => {
    if (priority === 'high') return 'text-red-600';
    if (priority === 'medium') return 'text-amber-600';
    return 'text-slate-600';
  };

  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
      {getStatusIcon(activity.status)}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 truncate">{activity.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn("text-xs font-medium", getPriorityColor(activity.priority))}>
            {activity.priority}
          </span>
          <span className="text-xs text-slate-400">•</span>
          <span className="text-xs text-slate-500">{activity.activity_type}</span>
        </div>
      </div>
      {activity.due_date && (
        <span className="text-xs text-slate-500">{formatDate(activity.due_date)}</span>
      )}
    </div>
  );
};

// Contact Row
const ContactRow = ({ contact }) => (
  <div className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
      {contact.name?.charAt(0) || '?'}
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-slate-900">{contact.name}</p>
      {contact.job_title && (
        <p className="text-xs text-slate-500">{contact.job_title}</p>
      )}
    </div>
    <div className="flex items-center gap-2">
      {contact.email && (
        <a href={`mailto:${contact.email}`} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <Mail className="w-4 h-4 text-slate-400" />
        </a>
      )}
      {contact.phone && (
        <a href={`tel:${contact.phone}`} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <Phone className="w-4 h-4 text-slate-400" />
        </a>
      )}
    </div>
  </div>
);

// Main Account 360 Panel Component
const Account360Panel = ({ accountId, isOpen, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (isOpen && accountId) {
      fetchAccountData();
    }
  }, [isOpen, accountId]);

  const fetchAccountData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/accounts/${accountId}/360`);
      setData(response.data);
    } catch (err) {
      console.error('Error fetching account 360 view:', err);
      setError(err.response?.data?.detail || 'Failed to load account details');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" data-testid="account-360-panel">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="relative w-full max-w-2xl bg-slate-50 shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                <Building2 className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  {loading ? 'Loading...' : data?.account?.name || 'Account Details'}
                </h2>
                <p className="text-indigo-100 text-sm mt-0.5">360° Account View</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              data-testid="close-360-panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          ) : data ? (
            <>
              {/* Account Info Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-500" />
                  Account Information
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {data.account.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <a href={`mailto:${data.account.email}`} className="text-blue-600 hover:underline">
                        {data.account.email}
                      </a>
                    </div>
                  )}
                  {data.account.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <a href={`tel:${data.account.phone}`} className="text-slate-700">
                        {data.account.phone}
                      </a>
                    </div>
                  )}
                  {data.account.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-slate-400" />
                      <a 
                        href={data.account.website.startsWith('http') ? data.account.website : `https://${data.account.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        {data.account.website.replace(/^https?:\/\//, '')}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                  {(data.account.city || data.account.country) && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-700">
                        {[data.account.city, data.account.state, data.account.country].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}
                  {data.account.industry && (
                    <div className="flex items-center gap-2 col-span-2">
                      <Activity className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-700">Industry: {data.account.industry}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-4">
                <SummaryCard
                  title="Pipeline Value"
                  value={formatCurrency(data.summary.total_pipeline_value)}
                  subtitle={`${data.summary.total_opportunities} opportunities`}
                  icon={Target}
                  color="blue"
                />
                <SummaryCard
                  title="Won Revenue"
                  value={formatCurrency(data.summary.total_won_value)}
                  icon={TrendingUp}
                  color="emerald"
                />
                <SummaryCard
                  title="Total Invoiced"
                  value={formatCurrency(data.summary.total_invoiced)}
                  icon={FileText}
                  color="purple"
                />
                <SummaryCard
                  title="Outstanding"
                  value={formatCurrency(data.summary.total_outstanding)}
                  subtitle={data.summary.total_outstanding > 0 ? 'Payment pending' : 'All clear'}
                  icon={DollarSign}
                  color={data.summary.total_outstanding > 0 ? "amber" : "emerald"}
                />
              </div>

              {/* Opportunities Section */}
              <CollapsibleSection
                title="Opportunities"
                icon={Target}
                count={data.opportunities.length}
                defaultOpen={data.opportunities.length > 0}
              >
                {data.opportunities.length > 0 ? (
                  <div className="space-y-1">
                    {data.opportunities.map((opp, idx) => (
                      <OpportunityRow key={opp.id || idx} opportunity={opp} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">No opportunities found</p>
                )}
              </CollapsibleSection>

              {/* Invoices Section */}
              <CollapsibleSection
                title="Invoices"
                icon={FileText}
                count={data.invoices.length}
                defaultOpen={false}
              >
                {data.invoices.length > 0 ? (
                  <div className="space-y-1">
                    {data.invoices.map((inv, idx) => (
                      <InvoiceRow key={inv.id || idx} invoice={inv} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">No invoices found</p>
                )}
              </CollapsibleSection>

              {/* Activities Section */}
              <CollapsibleSection
                title="Activities"
                icon={Calendar}
                count={data.activities.length}
                defaultOpen={false}
              >
                {data.activities.length > 0 ? (
                  <div className="space-y-1">
                    {data.activities.map((act, idx) => (
                      <ActivityRow key={act.id || idx} activity={act} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">No activities found</p>
                )}
              </CollapsibleSection>

              {/* Contacts Section */}
              <CollapsibleSection
                title="Contacts"
                icon={Users}
                count={data.contacts.length}
                defaultOpen={false}
              >
                {data.contacts.length > 0 ? (
                  <div className="space-y-1">
                    {data.contacts.map((contact, idx) => (
                      <ContactRow key={contact.id || idx} contact={contact} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">No contacts found</p>
                )}
              </CollapsibleSection>

              {/* Data Source Footer */}
              <div className="bg-slate-100 rounded-lg px-4 py-3 text-xs text-slate-500 flex items-center justify-between">
                <span>Source: {data.account.source === 'odoo' ? 'Odoo ERP' : 'CRM'}</span>
                {data.account.last_synced && (
                  <span>Last synced: {formatDate(data.account.last_synced)}</span>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Account360Panel;
