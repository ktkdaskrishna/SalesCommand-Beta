/**
 * Opportunity Detail Panel
 * Slide-over panel for viewing full opportunity details
 * Preserves navigation state and provides quick access to all related data
 */
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { StageBadge, PriorityBadge } from './Badge';
import {
  X,
  Building2,
  DollarSign,
  Calendar,
  User,
  Phone,
  Mail,
  Target,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  MessageSquare,
  Sparkles,
  ChevronRight,
  Edit2,
  ExternalLink,
  Loader2,
  Activity,
  Users,
  Tag,
  Percent,
} from 'lucide-react';

// Tab component
const Tab = ({ active, onClick, children, icon: Icon }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
      active 
        ? "text-indigo-600 border-indigo-600" 
        : "text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300"
    )}
  >
    {Icon && <Icon className="w-4 h-4" />}
    {children}
  </button>
);

// Info Row component
const InfoRow = ({ icon: Icon, label, value, className = "" }) => (
  <div className={cn("flex items-start gap-3 py-2", className)}>
    <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
      <Icon className="w-4 h-4 text-slate-500" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-slate-900 break-words">{value || '—'}</p>
    </div>
  </div>
);

// Activity Item component
const ActivityItem = ({ activity }) => {
  const statusIcons = {
    pending: Clock,
    completed: CheckCircle2,
    overdue: AlertCircle,
  };
  const StatusIcon = statusIcons[activity.status] || Clock;
  
  return (
    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
        activity.status === 'completed' ? 'bg-emerald-100' :
        activity.status === 'overdue' ? 'bg-red-100' : 'bg-amber-100'
      )}>
        <StatusIcon className={cn(
          "w-4 h-4",
          activity.status === 'completed' ? 'text-emerald-600' :
          activity.status === 'overdue' ? 'text-red-600' : 'text-amber-600'
        )} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900">{activity.title || activity.type}</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {activity.due_date ? formatDate(activity.due_date) : 'No due date'}
        </p>
        {activity.notes && (
          <p className="text-xs text-slate-400 mt-1 truncate">{activity.notes}</p>
        )}
      </div>
    </div>
  );
};

const OpportunityDetailPanel = ({ opportunity, isOpen, onClose, onEdit, onBlueSheet }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [activities, setActivities] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    if (isOpen && opportunity?.id) {
      fetchRelatedData();
    }
  }, [isOpen, opportunity?.id]);

  const fetchRelatedData = async () => {
    setLoading(true);
    try {
      // Fetch activities from both local and Odoo sources
      const [localActivities, odooActivities] = await Promise.all([
        api.get(`/activities?opportunity_id=${opportunity.id}`).catch(() => ({ data: [] })),
        // Also fetch Odoo activities linked to this opportunity's res_id
        api.get(`/activities/opportunity/${opportunity.odoo_id || opportunity.id}`).catch(() => ({ data: { activities: [] } })),
      ]);
      
      // Combine and dedupe activities
      const localActs = localActivities.data || [];
      const odooActs = (odooActivities.data?.activities || []).map(a => ({
        ...a,
        source: 'odoo',
        status: a.state || 'pending',
        title: a.summary || a.activity_type,
        due_date: a.due_date,
        notes: a.note,
        type: a.activity_type,
      }));
      
      // Merge both sources, removing duplicates by id
      const seenIds = new Set();
      const mergedActivities = [...localActs, ...odooActs].filter(a => {
        const key = a.id || a.odoo_id || `${a.type}-${a.due_date}`;
        if (seenIds.has(key)) return false;
        seenIds.add(key);
        return true;
      });
      
      setActivities(mergedActivities);
    } catch (err) {
      console.error('Failed to fetch related data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const pendingActivities = activities.filter(a => a.status === 'pending');
  const completedActivities = activities.filter(a => a.status === 'completed');

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div 
        className="fixed top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out overflow-hidden flex flex-col"
        data-testid="opportunity-detail-panel"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-blue-50 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-2 mb-2">
                <StageBadge stage={opportunity.stage} />
                {opportunity.priority && <PriorityBadge priority={opportunity.priority} />}
              </div>
              <h2 className="text-xl font-bold text-slate-900 truncate">
                {opportunity.name}
              </h2>
              <p className="text-sm text-slate-600 flex items-center gap-2 mt-1">
                <Building2 className="w-4 h-4" />
                {opportunity.account_name || 'No account'}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {onEdit && (
                <button
                  onClick={() => onEdit(opportunity)}
                  className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors"
                  title="Edit"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className="flex items-center gap-6 mt-4">
            <div>
              <p className="text-xs text-slate-500 uppercase">Value</p>
              <p className="text-lg font-bold text-slate-900">{formatCurrency(opportunity.value)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase">Probability</p>
              <p className="text-lg font-bold text-indigo-600">{opportunity.probability || 0}%</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase">Expected Close</p>
              <p className="text-lg font-bold text-slate-900">
                {opportunity.close_date ? formatDate(opportunity.close_date) : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 flex-shrink-0">
          <div className="flex px-6">
            <Tab 
              active={activeTab === 'overview'} 
              onClick={() => setActiveTab('overview')}
              icon={FileText}
            >
              Overview
            </Tab>
            <Tab 
              active={activeTab === 'activities'} 
              onClick={() => setActiveTab('activities')}
              icon={Activity}
            >
              Activities ({activities.length})
            </Tab>
            <Tab 
              active={activeTab === 'bluesheet'} 
              onClick={() => setActiveTab('bluesheet')}
              icon={Sparkles}
            >
              Deal Confidence
            </Tab>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Key Details */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-3">Key Details</h3>
                    <div className="grid grid-cols-2 gap-x-6">
                      <InfoRow icon={DollarSign} label="Deal Value" value={formatCurrency(opportunity.value)} />
                      <InfoRow icon={Percent} label="Probability" value={`${opportunity.probability || 0}%`} />
                      <InfoRow icon={Calendar} label="Close Date" value={opportunity.close_date ? formatDate(opportunity.close_date) : 'Not set'} />
                      <InfoRow icon={Calendar} label="Created" value={formatDate(opportunity.created_at)} />
                      <InfoRow icon={User} label="Owner" value={opportunity.owner_name || opportunity.salesperson_name || 'Unassigned'} />
                      <InfoRow icon={Tag} label="Product Line" value={opportunity.product_line || opportunity.segment || '—'} />
                    </div>
                  </div>

                  {/* Description */}
                  {opportunity.description && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 mb-2">Description</h3>
                      <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
                        {opportunity.description}
                      </p>
                    </div>
                  )}

                  {/* Account Info */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-3">Account</h3>
                    <div className="bg-slate-50 rounded-lg p-4">
                      {opportunity.account_linked && opportunity.account_name ? (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-indigo-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{opportunity.account_name}</p>
                            <p className="text-xs text-indigo-600">Account ID: {opportunity.account_id}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 text-slate-400">
                          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                            <Building2 className="w-5 h-5" />
                          </div>
                          <p>No account linked</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Source Info (if from Odoo) */}
                  {opportunity.source === 'odoo' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs text-blue-600 flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" />
                        Synced from Odoo • Last updated: {opportunity.synced_at ? formatDate(opportunity.synced_at) : 'Unknown'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Activities Tab */}
              {activeTab === 'activities' && (
                <div className="space-y-6">
                  {/* Pending Activities */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-500" />
                      Pending ({pendingActivities.length})
                    </h3>
                    {pendingActivities.length > 0 ? (
                      <div className="space-y-2">
                        {pendingActivities.map(activity => (
                          <ActivityItem key={activity.id} activity={activity} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 bg-slate-50 rounded-lg p-4 text-center">
                        No pending activities
                      </p>
                    )}
                  </div>

                  {/* Completed Activities */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Completed ({completedActivities.length})
                    </h3>
                    {completedActivities.length > 0 ? (
                      <div className="space-y-2">
                        {completedActivities.slice(0, 5).map(activity => (
                          <ActivityItem key={activity.id} activity={activity} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 bg-slate-50 rounded-lg p-4 text-center">
                        No completed activities
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Blue Sheet Tab */}
              {activeTab === 'bluesheet' && (
                <div className="space-y-6">
                  {/* Current Confidence */}
                  <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-6 text-center">
                    <p className="text-sm text-slate-600 mb-2">Current Deal Confidence</p>
                    <p className={cn(
                      "text-4xl font-bold",
                      opportunity.probability >= 70 ? "text-emerald-600" :
                      opportunity.probability >= 40 ? "text-amber-600" : "text-red-600"
                    )}>
                      {opportunity.probability >= 70 ? 'High' :
                       opportunity.probability >= 40 ? 'Medium' : 'Low'}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">{opportunity.probability || 0}% score</p>
                  </div>

                  {/* Blue Sheet Analysis Summary */}
                  {opportunity.blue_sheet_analysis && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 mb-3">Last Analysis</h3>
                      <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className={cn(
                            "w-4 h-4",
                            opportunity.blue_sheet_analysis.economic_buyer_identified ? "text-emerald-500" : "text-slate-300"
                          )} />
                          <span className="text-sm text-slate-700">Economic Buyer Identified</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className={cn(
                            "w-4 h-4",
                            opportunity.blue_sheet_analysis.coach_identified ? "text-emerald-500" : "text-slate-300"
                          )} />
                          <span className="text-sm text-slate-700">Coach Identified</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className={cn(
                            "w-4 h-4",
                            opportunity.blue_sheet_analysis.clear_business_results ? "text-emerald-500" : "text-slate-300"
                          )} />
                          <span className="text-sm text-slate-700">Clear Business Results</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Run Analysis Button */}
                  <button
                    onClick={() => onBlueSheet && onBlueSheet(opportunity)}
                    className="w-full btn-primary flex items-center justify-center gap-2"
                    data-testid="run-bluesheet-btn"
                  >
                    <Sparkles className="w-4 h-4" />
                    Run Deal Confidence Analysis
                  </button>

                  <p className="text-xs text-slate-500 text-center">
                    Based on configurable factors. Use as guidance, not prediction.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="btn-secondary"
            >
              Close
            </button>
            {onEdit && (
              <button
                onClick={() => onEdit(opportunity)}
                className="btn-primary flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Edit Opportunity
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default OpportunityDetailPanel;
