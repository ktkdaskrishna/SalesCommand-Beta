import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { 
  opportunitiesAPI, 
  dashboardAPI, 
  activitiesAPI 
} from "../services/api";
import api from "../services/api";
import KPICard from "../components/KPICard";
import ExpandableContainer from "../components/ExpandableContainer";
import { StageBadge, PriorityBadge } from "../components/Badge";
import { formatCurrency, formatDate, cn, getInitials } from "../lib/utils";
import {
  Target,
  DollarSign,
  TrendingUp,
  ListTodo,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  GripVertical,
  MoreHorizontal,
  Plus,
  Calculator,
  Sparkles,
  Search,
  FileText,
  Users,
  BarChart3,
  Kanban,
  Database,
  RefreshCw,
  Info,
  CheckCircle,
  AlertTriangle as AlertTriangleIcon,
} from "lucide-react";

// Sync Status Widget - shows integration health
const SyncStatusWidget = ({ integrations }) => {
  if (!integrations || integrations.length === 0) return null;
  
  const getStatusIcon = (status) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />;
      case 'needs_refresh':
        return <AlertTriangleIcon className="w-3.5 h-3.5 text-amber-500" />;
      default:
        return <AlertTriangleIcon className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="flex items-center gap-3">
      {integrations.map((integration, i) => (
        <div
          key={i}
          className="flex items-center gap-1.5 text-xs"
          title={integration.note || `${integration.name}: ${integration.status}`}
        >
          {getStatusIcon(integration.status)}
          <span className={
            integration.status === 'connected' ? 'text-slate-600' :
            integration.status === 'needs_refresh' ? 'text-amber-600' :
            'text-slate-400'
          }>
            {integration.name.split(' ')[0]}
          </span>
        </div>
      ))}
    </div>
  );
};

// Data Source Badge Component - shows where data comes from
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

// Empty State Explainer Component
const EmptyStateExplainer = ({ type, userRole }) => {
  const messages = {
    opportunities: {
      title: "No opportunities assigned yet",
      description: userRole === "account_manager" 
        ? "Opportunities will appear here once they're synced from Odoo and assigned to your account."
        : "No opportunities found in the data lake. Data syncs automatically from connected sources.",
      icon: Target,
    },
    activities: {
      title: "No pending activities",
      description: "You're all caught up! Activities will appear here when created or assigned to you.",
      icon: CheckCircle2,
    },
    pipeline: {
      title: "Pipeline data loading",
      description: "Your sales pipeline will populate once opportunities are synced from Odoo.",
      icon: Kanban,
    },
  };

  const config = messages[type] || messages.opportunities;
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
      <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-slate-400" />
      </div>
      <h4 className="font-semibold text-slate-700 mb-2">{config.title}</h4>
      <p className="text-sm text-slate-500 max-w-sm">{config.description}</p>
      <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
        <Info className="w-3.5 h-3.5" />
        <span>Data syncs automatically from Odoo ERP</span>
      </div>
    </div>
  );
};
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const CHART_COLORS = ["#2563EB", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#6B7280"];

// Opportunity Card for Kanban
const OpportunityCard = ({ opportunity, index, onCalculateProbability }) => {
  return (
    <Draggable draggableId={opportunity.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn(
            "bg-white rounded-lg border p-4 mb-3 shadow-sm hover:shadow-md transition-all",
            snapshot.isDragging && "shadow-lg ring-2 ring-blue-500"
          )}
          data-testid={`opp-card-${opportunity.id}`}
        >
          <div className="flex items-start justify-between mb-2">
            <div {...provided.dragHandleProps} className="cursor-grab">
              <GripVertical className="w-4 h-4 text-slate-400" />
            </div>
            <button className="text-slate-400 hover:text-slate-600">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
          
          <h4 className="font-medium text-slate-900 mb-1 line-clamp-2">
            {opportunity.name}
          </h4>
          <p className="text-sm text-slate-500 mb-3">{opportunity.account_name}</p>
          
          {/* Deal Value */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-lg font-bold text-slate-900">
              {formatCurrency(opportunity.value)}
            </span>
            <span className={cn(
              "text-sm font-medium px-2 py-0.5 rounded-full",
              opportunity.probability >= 70 ? "bg-emerald-100 text-emerald-700" :
              opportunity.probability >= 40 ? "bg-amber-100 text-amber-700" :
              "bg-red-100 text-red-700"
            )}>
              {opportunity.probability}%
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                opportunity.probability >= 70 ? "bg-emerald-500" :
                opportunity.probability >= 40 ? "bg-amber-500" :
                "bg-red-500"
              )}
              style={{ width: `${opportunity.probability}%` }}
            />
          </div>
          
          {/* Meta Info */}
          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <ListTodo className="w-3 h-3" />
              <span>{opportunity.activity_count || 0} activities</span>
            </div>
            {opportunity.product_lines?.length > 0 && (
              <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                {opportunity.product_lines[0]}
              </span>
            )}
          </div>
          
          {/* Get Deal Confidence Button */}
          <button
            onClick={() => onCalculateProbability(opportunity)}
            className="mt-3 w-full text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-1 py-1.5 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
            data-testid={`calc-prob-${opportunity.id}`}
            title="Get guidance based on configurable deal factors"
          >
            <Sparkles className="w-3 h-3" />
            Get Deal Confidence
          </button>
        </div>
      )}
    </Draggable>
  );
};

// Kanban Column
const KanbanColumn = ({ stage, opportunities, onCalculateProbability }) => {
  return (
    <div className="flex-shrink-0 w-72">
      <div
        className="rounded-t-lg px-4 py-3 flex items-center justify-between"
        style={{ backgroundColor: `${stage.color}15`, borderTop: `3px solid ${stage.color}` }}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-900">{stage.name}</span>
          <span className="bg-white px-2 py-0.5 rounded-full text-xs font-medium text-slate-600">
            {opportunities.length}
          </span>
        </div>
        <span className="text-sm font-medium text-slate-600">
          {formatCurrency(opportunities.reduce((sum, o) => sum + o.value, 0))}
        </span>
      </div>
      
      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "bg-slate-50 rounded-b-lg p-3 min-h-[400px] transition-colors",
              snapshot.isDraggingOver && "bg-blue-50"
            )}
          >
            {opportunities.map((opp, index) => (
              <OpportunityCard
                key={opp.id}
                opportunity={opp}
                index={index}
                onCalculateProbability={onCalculateProbability}
              />
            ))}
            {provided.placeholder}
            
            {opportunities.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No opportunities</p>
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
};

// Blue Sheet Probability Modal
const BlueSheetModal = ({ opportunity, isOpen, onClose, onCalculate }) => {
  const [analysis, setAnalysis] = useState({
    economic_buyer_identified: false,
    economic_buyer_favorable: false,
    user_buyers_identified: 0,
    user_buyers_favorable: 0,
    technical_buyers_identified: 0,
    technical_buyers_favorable: 0,
    coach_identified: false,
    coach_engaged: false,
    no_access_to_economic_buyer: false,
    reorganization_pending: false,
    budget_not_confirmed: true,
    competition_preferred: false,
    timeline_unclear: false,
    clear_business_results: false,
    quantifiable_value: false,
    next_steps_defined: false,
    mutual_action_plan: false,
  });
  const [result, setResult] = useState(null);
  const [calculating, setCalculating] = useState(false);

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const response = await api.post(`/opportunities/${opportunity.id}/calculate-probability`, {
        opportunity_id: opportunity.id,
        ...analysis
      });
      setResult(response.data);
      onCalculate(response.data);
    } catch (error) {
      console.error("Error calculating probability:", error);
    } finally {
      setCalculating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" data-testid="blue-sheet-modal">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            Deal Confidence Assessment
          </h2>
          <p className="text-sm text-slate-500 mt-1">{opportunity?.name}</p>
          <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
            <Info className="w-3 h-3" />
            Based on configurable factors. Use as guidance, not prediction.
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Buying Influences */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Buying Influences
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={analysis.economic_buyer_identified}
                  onChange={(e) => setAnalysis({...analysis, economic_buyer_identified: e.target.checked})}
                  className="rounded border-slate-300"
                />
                <span className="text-sm">Economic Buyer Identified</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={analysis.economic_buyer_favorable}
                  onChange={(e) => setAnalysis({...analysis, economic_buyer_favorable: e.target.checked})}
                  className="rounded border-slate-300"
                />
                <span className="text-sm">Economic Buyer Favorable</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={analysis.coach_identified}
                  onChange={(e) => setAnalysis({...analysis, coach_identified: e.target.checked})}
                  className="rounded border-slate-300"
                />
                <span className="text-sm">Coach Identified</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={analysis.coach_engaged}
                  onChange={(e) => setAnalysis({...analysis, coach_engaged: e.target.checked})}
                  className="rounded border-slate-300"
                />
                <span className="text-sm">Coach Actively Engaged</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm">User Buyers Favorable:</span>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={analysis.user_buyers_favorable}
                  onChange={(e) => setAnalysis({...analysis, user_buyers_favorable: parseInt(e.target.value) || 0})}
                  className="w-16 input text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">Technical Buyers Favorable:</span>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={analysis.technical_buyers_favorable}
                  onChange={(e) => setAnalysis({...analysis, technical_buyers_favorable: parseInt(e.target.value) || 0})}
                  className="w-16 input text-sm"
                />
              </div>
            </div>
          </div>

          {/* Red Flags */}
          <div>
            <h3 className="font-semibold text-red-700 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Red Flags
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={analysis.no_access_to_economic_buyer}
                  onChange={(e) => setAnalysis({...analysis, no_access_to_economic_buyer: e.target.checked})}
                  className="rounded border-slate-300"
                />
                <span className="text-sm text-red-700">No Access to Economic Buyer</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={analysis.budget_not_confirmed}
                  onChange={(e) => setAnalysis({...analysis, budget_not_confirmed: e.target.checked})}
                  className="rounded border-slate-300"
                />
                <span className="text-sm text-red-700">Budget Not Confirmed</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={analysis.competition_preferred}
                  onChange={(e) => setAnalysis({...analysis, competition_preferred: e.target.checked})}
                  className="rounded border-slate-300"
                />
                <span className="text-sm text-red-700">Competition Preferred</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={analysis.reorganization_pending}
                  onChange={(e) => setAnalysis({...analysis, reorganization_pending: e.target.checked})}
                  className="rounded border-slate-300"
                />
                <span className="text-sm text-red-700">Reorganization Pending</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={analysis.timeline_unclear}
                  onChange={(e) => setAnalysis({...analysis, timeline_unclear: e.target.checked})}
                  className="rounded border-slate-300"
                />
                <span className="text-sm text-red-700">Timeline Unclear</span>
              </label>
            </div>
          </div>

          {/* Win Results & Action Plan */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Win Results & Action Plan
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={analysis.clear_business_results}
                  onChange={(e) => setAnalysis({...analysis, clear_business_results: e.target.checked})}
                  className="rounded border-slate-300"
                />
                <span className="text-sm">Clear Business Results Defined</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={analysis.quantifiable_value}
                  onChange={(e) => setAnalysis({...analysis, quantifiable_value: e.target.checked})}
                  className="rounded border-slate-300"
                />
                <span className="text-sm">Quantifiable Value Proposition</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={analysis.next_steps_defined}
                  onChange={(e) => setAnalysis({...analysis, next_steps_defined: e.target.checked})}
                  className="rounded border-slate-300"
                />
                <span className="text-sm">Next Steps Defined</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={analysis.mutual_action_plan}
                  onChange={(e) => setAnalysis({...analysis, mutual_action_plan: e.target.checked})}
                  className="rounded border-slate-300"
                />
                <span className="text-sm">Mutual Action Plan Agreed</span>
              </label>
            </div>
          </div>

          {/* Results */}
          {result && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-slate-900">Deal Confidence Signal</h4>
                  <p className="text-xs text-slate-500">Use as guidance, not prediction</p>
                </div>
                <div className="text-center">
                  <span className={cn(
                    "text-2xl font-bold",
                    result.calculated_probability >= 70 ? "text-emerald-600" :
                    result.calculated_probability >= 40 ? "text-amber-600" :
                    "text-red-600"
                  )}>
                    {result.calculated_probability >= 70 ? "High" :
                     result.calculated_probability >= 40 ? "Medium" :
                     "Low"}
                  </span>
                  <p className="text-xs text-slate-400">{result.calculated_probability}% score</p>
                </div>
              </div>
              <p className="text-sm text-slate-700 mb-3">{result.analysis_summary}</p>
              
              {result.recommendations?.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-slate-700 mb-2">Suggested Actions:</h5>
                  <ul className="space-y-1">
                    {result.recommendations.map((rec, i) => (
                      <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                        <span className="text-blue-500 mt-1">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">
            Close
          </button>
          <button
            onClick={handleCalculate}
            disabled={calculating}
            className="btn-primary flex items-center gap-2"
            data-testid="calculate-probability-btn"
          >
            {calculating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Get Confidence Signal
          </button>
        </div>
      </div>
    </div>
  );
};

// Incentive Calculator Modal
const IncentiveCalculatorModal = ({ isOpen, onClose }) => {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [revenue, setRevenue] = useState(100000);
  const [quota, setQuota] = useState(500000);
  const [isNewLogo, setIsNewLogo] = useState(false);
  const [productLine, setProductLine] = useState("");
  const [result, setResult] = useState(null);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen]);

  const fetchTemplates = async () => {
    try {
      const response = await api.get("/commission-templates");
      setTemplates(response.data);
    } catch (error) {
      console.error("Error fetching templates:", error);
    }
  };

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const response = await api.post("/incentive-calculator", null, {
        params: {
          revenue,
          template_id: selectedTemplate || undefined,
          quota,
          is_new_logo: isNewLogo,
          product_line: productLine || undefined
        }
      });
      setResult(response.data);
    } catch (error) {
      console.error("Error calculating incentive:", error);
    } finally {
      setCalculating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full" data-testid="incentive-calculator-modal">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-blue-600" />
            Incentive Calculator
          </h2>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Commission Template
            </label>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="input"
            >
              <option value="">Default (5% Flat)</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Deal Revenue ($)
              </label>
              <input
                type="number"
                value={revenue}
                onChange={(e) => setRevenue(parseFloat(e.target.value) || 0)}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Quota ($)
              </label>
              <input
                type="number"
                value={quota}
                onChange={(e) => setQuota(parseFloat(e.target.value) || 0)}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Product Line
            </label>
            <select
              value={productLine}
              onChange={(e) => setProductLine(e.target.value)}
              className="input"
            >
              <option value="">Select product...</option>
              <option value="MSSP">MSSP</option>
              <option value="Application Security">Application Security</option>
              <option value="Network Security">Network Security</option>
              <option value="GRC">GRC</option>
            </select>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isNewLogo}
              onChange={(e) => setIsNewLogo(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span className="text-sm">New Logo (New Customer)</span>
          </label>

          {result && (
            <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg p-4 border border-emerald-100">
              <h4 className="font-semibold text-slate-900 mb-3">Commission Breakdown</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Revenue:</span>
                  <span className="font-medium">{formatCurrency(result.revenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Quota Attainment:</span>
                  <span className="font-medium">{result.attainment}%</span>
                </div>
                {result.template_name && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Template:</span>
                    <span className="font-medium">{result.template_name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-600">Base Commission:</span>
                  <span className="font-medium">{formatCurrency(result.base_commission)}</span>
                </div>
                {result.multipliers_applied?.map((m, i) => (
                  <div key={i} className="flex justify-between text-blue-700">
                    <span>× {m.type.replace(/_/g, " ")}:</span>
                    <span className="font-medium">{m.value}x</span>
                  </div>
                ))}
                <div className="flex justify-between pt-2 border-t border-emerald-200 text-lg">
                  <span className="font-semibold text-slate-900">Final Commission:</span>
                  <span className="font-bold text-emerald-600">{formatCurrency(result.final_commission)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">
            Close
          </button>
          <button
            onClick={handleCalculate}
            disabled={calculating}
            className="btn-primary flex items-center gap-2"
          >
            {calculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
            Calculate
          </button>
        </div>
      </div>
    </div>
  );
};

// Main Account Manager Dashboard
const AccountManagerDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [kanbanData, setKanbanData] = useState({ stages: [], kanban: {} });
  const [recentActivities, setRecentActivities] = useState([]);
  const [salesMetrics, setSalesMetrics] = useState(null);
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [showBlueSheet, setShowBlueSheet] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [integrations, setIntegrations] = useState([]);

  useEffect(() => {
    fetchDashboardData();
    fetchIntegrationsHealth();
  }, []);

  const fetchIntegrationsHealth = async () => {
    try {
      const res = await api.get("/integrations/health");
      setIntegrations(res.data.integrations || []);
    } catch (e) {
      console.log("Could not fetch integration health");
    }
  };

  const fetchDashboardData = async () => {
    try {
      // Fetch REAL data from data_lake_serving (Odoo-synced)
      const [realDataRes, activitiesRes] = await Promise.all([
        api.get("/dashboard/real"),
        activitiesAPI.getAll({ status: "pending" }),
      ]);

      const realData = realDataRes.data;
      
      // Set stats from real data - map to expected field names
      setStats({
        total_pipeline_value: realData.metrics.pipeline_value,
        won_revenue: realData.metrics.won_revenue,
        active_opportunities: realData.metrics.active_opportunities,
        activity_completion_rate: 0, // Will calculate from activities
        total_receivables: realData.metrics.total_receivables,
        pending_invoices: realData.metrics.pending_invoices,
      });

      // Convert real opportunities to kanban format with proper stage objects
      const stageConfigs = [
        { id: "New", name: "New", color: "#6366F1" },
        { id: "Qualification", name: "Qualification", color: "#8B5CF6" },
        { id: "Proposal", name: "Proposal", color: "#F59E0B" },
        { id: "Negotiation", name: "Negotiation", color: "#F97316" },
        { id: "Won", name: "Won", color: "#10B981" },
        { id: "Lost", name: "Lost", color: "#EF4444" },
      ];
      const kanban = {};
      stageConfigs.forEach(s => kanban[s.id] = { stage: s, opportunities: [], total_value: 0, count: 0 });
      
      realData.opportunities.forEach(opp => {
        const stage = opp.stage || "New";
        // Map Odoo stages to our stages
        let mappedStage = stage;
        if (stage.toLowerCase().includes("won")) mappedStage = "Won";
        else if (stage.toLowerCase().includes("lost")) mappedStage = "Lost";
        else if (stage.toLowerCase().includes("negot")) mappedStage = "Negotiation";
        else if (stage.toLowerCase().includes("propos")) mappedStage = "Proposal";
        else if (stage.toLowerCase().includes("qualif")) mappedStage = "Qualification";
        else mappedStage = "New";
        
        if (!kanban[mappedStage]) {
          kanban[mappedStage] = { stage: { id: mappedStage, name: mappedStage, color: "#6B7280" }, opportunities: [], total_value: 0, count: 0 };
        }
        kanban[mappedStage].opportunities.push({
          id: String(opp.id),
          name: opp.name,
          account_name: opp.account_name,
          value: opp.value,
          probability: opp.probability,
          stage: mappedStage,
          source: "odoo",
        });
        kanban[mappedStage].total_value += opp.value || 0;
        kanban[mappedStage].count += 1;
      });

      setKanbanData({ stages: stageConfigs, kanban, source: "data_lake_serving" });
      setRecentActivities(activitiesRes.data.slice(0, 5));

      // Note: Data is from Odoo sync
      console.log("Dashboard loaded from data_lake_serving:", realData.data_note);
    } catch (error) {
      console.error("Dashboard error:", error);
      // Fallback to legacy endpoint if real data fails
      try {
        const [statsRes, kanbanRes, activitiesRes] = await Promise.all([
          dashboardAPI.getStats(),
          api.get("/opportunities/kanban"),
          activitiesAPI.getAll({ status: "pending" }),
        ]);
        setStats(statsRes.data);
        setKanbanData(kanbanRes.data);
        setRecentActivities(activitiesRes.data.slice(0, 5));
      } catch (fallbackError) {
        console.error("Fallback also failed:", fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    
    const { draggableId, destination } = result;
    const newStage = destination.droppableId;
    
    try {
      await api.patch(`/opportunities/${draggableId}/stage?new_stage=${newStage}`);
      fetchDashboardData();
    } catch (error) {
      console.error("Error moving opportunity:", error);
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length >= 2) {
      try {
        const response = await api.get(`/search?q=${encodeURIComponent(query)}`);
        setSearchResults(response.data.results);
      } catch (error) {
        console.error("Search error:", error);
      }
    } else {
      setSearchResults([]);
    }
  };

  const handleCalculateProbability = (opp) => {
    setSelectedOpp(opp);
    setShowBlueSheet(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="am-dashboard">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Welcome back, {user?.name?.split(" ")[0]}
          </h1>
          <p className="text-slate-600 mt-1">
            Your sales dashboard and pipeline management
          </p>
          {/* Data Source Badge + Sync Status */}
          <div className="mt-3 flex items-center gap-4">
            <DataSourceBadge 
              source={kanbanData?.source === "data_lake_serving" ? "Odoo" : "CRM"} 
              lastSync={new Date().toISOString()} 
            />
            <SyncStatusWidget integrations={integrations} />
          </div>
        </div>
        
        {/* Global Search */}
        <div className="relative w-full lg:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search accounts, opportunities, activities..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="input pl-10"
            data-testid="global-search"
          />
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 z-50 max-h-80 overflow-y-auto">
              {searchResults.map((result, i) => (
                <a
                  key={i}
                  href={`/${result.type}s/${result.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                >
                  <span className="text-slate-400 capitalize">{result.type}</span>
                  <span className="font-medium text-slate-900">{result.name}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions - Simplified for Beta */}
      <div className="flex gap-3">
        <button
          onClick={() => setShowCalculator(true)}
          className="btn-secondary flex items-center gap-2"
          data-testid="open-calculator-btn"
        >
          <Calculator className="w-4 h-4" />
          Incentive Calculator
        </button>
      </div>

      {/* KPI Cards Row - Simplified: Only show metrics tied to real data */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <KPICard
          title="Pipeline Value"
          value={stats?.total_pipeline_value || 0}
          unit="currency"
          trend="stable"
          icon={DollarSign}
        />
        <KPICard
          title="Active Opportunities"
          value={stats?.active_opportunities || 0}
          unit="number"
          trend="stable"
          icon={Target}
        />
      </div>

      {/* Pipeline Kanban - Expandable */}
      <ExpandableContainer
        title="Opportunity Pipeline"
        subtitle="Drag and drop to move opportunities between stages"
        icon={Target}
        className="mb-8"
        data-testid="kanban-board"
      >
        <div className="p-4 overflow-x-auto">
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-4 min-w-max">
              {kanbanData.stages.map((stage) => (
                <KanbanColumn
                  key={stage.id}
                  stage={stage}
                  opportunities={kanbanData.kanban[stage.id]?.opportunities || []}
                  onCalculateProbability={handleCalculateProbability}
                />
              ))}
            </div>
          </DragDropContext>
        </div>
      </ExpandableContainer>

      {/* Recent Activities */}
      <div className="card" data-testid="recent-activities">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            Pending Activities
          </h3>
          {stats?.overdue_activities > 0 && (
            <span className="badge-error flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {stats.overdue_activities} overdue
            </span>
          )}
        </div>
        <div className="divide-y divide-slate-100">
          {recentActivities.map((activity) => (
            <div key={activity.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
              <div>
                <p className="font-medium text-slate-900">{activity.title}</p>
                <p className="text-sm text-slate-500">
                  {activity.account_name || activity.opportunity_name || "—"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <PriorityBadge priority={activity.priority} />
                <span className="text-sm text-slate-500">{formatDate(activity.due_date)}</span>
              </div>
            </div>
          ))}
          {recentActivities.length === 0 && (
            <EmptyStateExplainer type="activities" userRole={user?.role} />
          )}
        </div>
      </div>

      {/* Blue Sheet Modal */}
      <BlueSheetModal
        opportunity={selectedOpp}
        isOpen={showBlueSheet}
        onClose={() => {
          setShowBlueSheet(false);
          setSelectedOpp(null);
        }}
        onCalculate={(result) => {
          fetchDashboardData();
        }}
      />

      {/* Incentive Calculator Modal */}
      <IncentiveCalculatorModal
        isOpen={showCalculator}
        onClose={() => setShowCalculator(false)}
      />
    </div>
  );
};

export default AccountManagerDashboard;
