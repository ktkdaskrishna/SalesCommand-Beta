/**
 * Activity Detail Card - Expandable View
 * Shows complete activity information when clicked
 */
import React from 'react';
import { X, CheckCircle, Edit, ArrowRight, Calendar, User, Building2, Clock, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';

const ActivityDetailCard = ({ activity, onClose, onMarkComplete, onViewOpportunity }) => {
  if (!activity) return null;

  const { opportunity, assigned_to, state, due_date, note, presales_category, summary } = activity;
  
  // Calculate days until due
  const daysUntilDue = due_date 
    ? Math.ceil((new Date(due_date) - new Date()) / (1000 * 60 * 60 * 24))
    : null;
  
  const getRiskLevel = () => {
    if (state === 'overdue') return { level: 'high', color: 'red', text: 'Overdue' };
    if (state === 'done') return { level: 'none', color: 'emerald', text: 'Completed' };
    if (daysUntilDue !== null) {
      if (daysUntilDue < 0) return { level: 'high', color: 'red', text: 'Overdue' };
      if (daysUntilDue <= 1) return { level: 'high', color: 'orange', text: 'Due Soon' };
      if (daysUntilDue <= 3) return { level: 'medium', color: 'yellow', text: 'Upcoming' };
    }
    return { level: 'low', color: 'blue', text: 'On Track' };
  };
  
  const risk = getRiskLevel();

  return (
    <div className="border-l-4 border-indigo-500 bg-gradient-to-r from-indigo-50 via-blue-50 to-white p-6 rounded-lg shadow-lg my-4 animate-in slide-in-from-top">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold bg-${risk.color}-100 text-${risk.color}-700 border border-${risk.color}-200`}>
              {risk.text}
            </span>
            {presales_category && presales_category !== 'Other' && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                {presales_category}
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-slate-900">{summary || 'Activity'}</h3>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <X className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Assigned To */}
        {assigned_to && (
          <div className="flex items-start gap-3">
            <User className="w-5 h-5 text-indigo-600 mt-0.5" />
            <div>
              <p className="text-xs text-slate-500">Assigned To</p>
              <p className="font-medium text-slate-900">{assigned_to.name || 'Unassigned'}</p>
              {assigned_to.email && (
                <p className="text-xs text-slate-600">{assigned_to.email}</p>
              )}
            </div>
          </div>
        )}

        {/* Due Date */}
        <div className="flex items-start gap-3">
          <Calendar className="w-5 h-5 text-indigo-600 mt-0.5" />
          <div>
            <p className="text-xs text-slate-500">Due Date</p>
            <p className="font-medium text-slate-900">
              {due_date && due_date !== false ? new Date(due_date).toLocaleDateString() : 'Not set'}
            </p>
            {daysUntilDue !== null && (
              <p className={`text-xs font-medium ${
                daysUntilDue < 0 ? 'text-red-600' :
                daysUntilDue <= 1 ? 'text-orange-600' :
                'text-slate-600'
              }`}>
                {daysUntilDue < 0 
                  ? `${Math.abs(daysUntilDue)} days overdue`
                  : daysUntilDue === 0
                  ? 'Due today'
                  : `Due in ${daysUntilDue} days`
                }
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Linked Opportunity */}
      {opportunity && opportunity.name && (
        <div className="card p-4 bg-white border-indigo-100 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <p className="text-xs text-slate-500 font-medium">Related Opportunity</p>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="font-semibold text-slate-900">{opportunity.name}</p>
              <div className="flex items-center gap-3 text-sm text-slate-600 mt-1">
                <span>${opportunity.value?.toLocaleString() || '0'}</span>
                <span>•</span>
                <span>{opportunity.stage}</span>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onViewOpportunity && onViewOpportunity(opportunity)}
            >
              View <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Notes */}
      {note && note !== false && (
        <div className="mb-4">
          <p className="text-xs text-slate-500 font-medium mb-2">Notes</p>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{note}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t border-slate-200">
        {state !== 'done' && (
          <Button 
            onClick={() => onMarkComplete && onMarkComplete(activity)}
            className="bg-emerald-600 hover:bg-emerald-700"
            size="sm"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Mark Complete
          </Button>
        )}
        <Button variant="outline" size="sm">
          <Edit className="w-4 h-4 mr-2" />
          Edit
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
};

export default ActivityDetailCard;
