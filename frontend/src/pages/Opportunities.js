import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { opportunitiesAPI, accountsAPI, salesAPI } from "../services/api";
import DataTable from "../components/DataTable";
import OpportunityDetailPanel from "../components/OpportunityDetailPanel";
import { StageBadge } from "../components/Badge";
import { formatCurrency, formatDate, cn } from "../lib/utils";
import {
  Target,
  Plus,
  Search,
  Loader2,
  X,
  LayoutGrid,
  List,
  GripVertical,
  Calculator,
  Users,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Activity,
  Tag,
  Eye,
} from "lucide-react";

const STAGES = [
  { value: "lead", label: "Lead", color: "bg-slate-500" },
  { value: "qualification", label: "Qualification", color: "bg-blue-500" },
  { value: "discovery", label: "Discovery", color: "bg-cyan-500" },
  { value: "proposal", label: "Proposal", color: "bg-amber-500" },
  { value: "negotiation", label: "Negotiation", color: "bg-purple-500" },
  { value: "closed_won", label: "Closed Won", color: "bg-emerald-500" },
  { value: "closed_lost", label: "Closed Lost", color: "bg-red-500" },
];

const PRODUCT_LINES = [
  "MSSP",
  "Application Security",
  "Network Security",
  "GRC",
];

// Blue Sheet Modal Component
const BlueSheetModal = ({ opportunity, onClose, onSave }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [analysis, setAnalysis] = useState({
    opportunity_id: opportunity.id,
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
    budget_not_confirmed: false,
    competition_preferred: false,
    timeline_unclear: false,
    clear_business_results: false,
    quantifiable_value: false,
    next_steps_defined: false,
    mutual_action_plan: false,
  });

  // Load existing blue sheet data
  useEffect(() => {
    if (opportunity.blue_sheet_analysis) {
      setAnalysis(prev => ({
        ...prev,
        ...opportunity.blue_sheet_analysis,
        opportunity_id: opportunity.id
      }));
    }
  }, [opportunity]);

  const calculateProbability = async () => {
    setLoading(true);
    try {
      console.log("Calling calculateProbability API for opportunity:", opportunity.id);
      const res = await salesAPI.calculateProbability(opportunity.id, analysis);
      console.log("API Response:", res.data);
      // Map API response to expected format
      const mappedResult = {
        probability: res.data.calculated_probability,
        confidence: res.data.confidence_level,
        recommendations: res.data.recommendations,
        analysis_summary: res.data.analysis_summary,
        score_breakdown: res.data.score_breakdown,
        analysis: analysis
      };
      console.log("Mapped Result:", mappedResult);
      setResult(mappedResult);
      if (onSave) onSave(mappedResult);
    } catch (err) {
      console.error("Error calculating probability:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-scale-in">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Calculator className="w-6 h-6 text-blue-600" />
                Blue Sheet Probability Analysis
              </h2>
              <p className="text-sm text-slate-600 mt-1">{opportunity.name}</p>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Buying Influences */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-blue-600" />
              Buying Influences
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={analysis.economic_buyer_identified}
                  onChange={(e) => setAnalysis(prev => ({ ...prev, economic_buyer_identified: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-slate-700">Economic Buyer Identified</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={analysis.economic_buyer_favorable}
                  onChange={(e) => setAnalysis(prev => ({ ...prev, economic_buyer_favorable: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-slate-700">Economic Buyer Favorable</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={analysis.coach_identified}
                  onChange={(e) => setAnalysis(prev => ({ ...prev, coach_identified: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-slate-700">Coach Identified</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={analysis.coach_engaged}
                  onChange={(e) => setAnalysis(prev => ({ ...prev, coach_engaged: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-slate-700">Coach Actively Engaged</span>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="text-sm text-slate-600 mb-1 block">User Buyers Favorable</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={analysis.user_buyers_favorable}
                  onChange={(e) => setAnalysis(prev => ({ ...prev, user_buyers_favorable: parseInt(e.target.value) || 0 }))}
                  className="input"
                />
              </div>
              <div>
                <label className="text-sm text-slate-600 mb-1 block">Technical Buyers Favorable</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={analysis.technical_buyers_favorable}
                  onChange={(e) => setAnalysis(prev => ({ ...prev, technical_buyers_favorable: parseInt(e.target.value) || 0 }))}
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* Red Flags */}
          <div className="card p-5 border-red-200 bg-red-50/30">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Red Flags
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "no_access_to_economic_buyer", label: "No Access to Economic Buyer" },
                { key: "reorganization_pending", label: "Reorganization Pending" },
                { key: "budget_not_confirmed", label: "Budget Not Confirmed" },
                { key: "competition_preferred", label: "Competition Preferred" },
                { key: "timeline_unclear", label: "Timeline Unclear" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 p-3 bg-white rounded-lg cursor-pointer hover:bg-red-50 transition-colors border border-red-100">
                  <input
                    type="checkbox"
                    checked={analysis[key]}
                    onChange={(e) => setAnalysis(prev => ({ ...prev, [key]: e.target.checked }))}
                    className="w-4 h-4 text-red-600 rounded"
                  />
                  <span className="text-sm text-slate-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Win Results & Action Plan */}
          <div className="card p-5 border-emerald-200 bg-emerald-50/30">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Win Results & Action Plan
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "clear_business_results", label: "Clear Business Results Defined" },
                { key: "quantifiable_value", label: "Quantifiable Value Proposition" },
                { key: "next_steps_defined", label: "Next Steps Defined" },
                { key: "mutual_action_plan", label: "Mutual Action Plan Agreed" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 p-3 bg-white rounded-lg cursor-pointer hover:bg-emerald-50 transition-colors border border-emerald-100">
                  <input
                    type="checkbox"
                    checked={analysis[key]}
                    onChange={(e) => setAnalysis(prev => ({ ...prev, [key]: e.target.checked }))}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span className="text-sm text-slate-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Result Display */}
          {result && (
            <div className="card p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-blue-600" />
                  AI Analysis Result
                </h3>
                <div className={cn(
                  "text-3xl font-bold",
                  result.probability >= 70 ? "text-emerald-600" :
                  result.probability >= 40 ? "text-amber-600" : "text-red-600"
                )}>
                  {result.probability}%
                </div>
              </div>
              
              <div className="mb-4">
                <div className="h-3 bg-white rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      result.probability >= 70 ? "bg-emerald-500" :
                      result.probability >= 40 ? "bg-amber-500" : "bg-red-500"
                    )}
                    style={{ width: `${result.probability}%` }}
                  />
                </div>
                <p className="text-sm text-slate-600 mt-2">
                  Confidence: <span className="font-medium capitalize">{result.confidence}</span>
                </p>
              </div>

              {result.recommendations && result.recommendations.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">AI Recommendations:</h4>
                  <ul className="space-y-2">
                    {result.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                        <span className="text-blue-500 mt-0.5">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button 
            onClick={calculateProbability} 
            disabled={loading}
            className="btn-primary"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Calculator className="w-4 h-4 mr-2" />
            )}
            Calculate Probability
          </button>
        </div>
      </div>
    </div>
  );
};

// Enhanced Kanban Card with Blue Sheet, Activities, and Segment
const KanbanCard = ({ opportunity, index, onOpenBlueSheet, onViewDetails }) => {
  const productTag = opportunity.product_lines?.[0] || null;
  const activityCount = opportunity.activity_count || 0;
  
  return (
    <Draggable draggableId={opportunity.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn(
            "bg-white rounded-lg border p-4 mb-3 shadow-sm hover:shadow-md transition-all cursor-pointer",
            snapshot.isDragging && "shadow-lg ring-2 ring-blue-500"
          )}
          onClick={() => onViewDetails && onViewDetails(opportunity)}
          data-testid={`opp-card-${opportunity.id}`}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <div {...provided.dragHandleProps} className="cursor-grab p-1 -ml-1 rounded hover:bg-slate-100" onClick={(e) => e.stopPropagation()}>
              <GripVertical className="w-4 h-4 text-slate-400" />
            </div>
            {/* Product/Segment Tag */}
            {productTag && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-200">
                <Tag className="w-3 h-3" />
                {productTag}
              </span>
            )}
          </div>
          
          {/* Title */}
          <h4 className="font-medium text-slate-900 mb-1 line-clamp-2">
            {opportunity.name}
          </h4>
          <p className="text-sm text-slate-500 mb-3">{opportunity.account_name || 'No account'}</p>
          
          {/* Deal Value & Probability */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-lg font-bold text-slate-900">
              {formatCurrency(opportunity.value)}
            </span>
            <span className={cn(
              "text-sm font-medium px-2 py-0.5 rounded-full",
              opportunity.probability >= 70 ? "bg-emerald-100 text-emerald-700" :
              opportunity.probability >= 40 ? "bg-amber-100 text-amber-700" :
              "bg-slate-100 text-slate-700"
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
                "bg-slate-400"
              )}
              style={{ width: `${opportunity.probability}%` }}
            />
          </div>
          
          {/* Activities Count */}
          <div className="flex items-center justify-between mb-3">
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <Activity className="w-3.5 h-3.5" />
              {activityCount} {activityCount === 1 ? 'activity' : 'activities'}
            </span>
            {opportunity.expected_close_date && (
              <span className="text-xs text-slate-400">
                Close: {formatDate(opportunity.expected_close_date)}
              </span>
            )}
          </div>
          
          {/* Calculate Probability Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenBlueSheet(opportunity);
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-medium rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all shadow-sm"
            data-testid={`calc-prob-${opportunity.id}`}
          >
            <Calculator className="w-4 h-4" />
            Get Deal Confidence
          </button>
          
          {/* View Details Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails && onViewDetails(opportunity);
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 mt-2 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-100 transition-all"
            data-testid={`view-details-${opportunity.id}`}
          >
            <Eye className="w-4 h-4" />
            View Details
          </button>
        </div>
      )}
    </Draggable>
  );
};

// Kanban Column Component
const KanbanColumn = ({ stage, opportunities, onOpenBlueSheet, onViewDetails }) => {
  const columnValue = opportunities.reduce((sum, opp) => sum + (opp.value || 0), 0);
  
  return (
    <div className="flex-shrink-0 w-80">
      <div className={cn(
        "rounded-t-lg px-4 py-3 flex items-center justify-between",
        stage.color
      )}>
        <div className="flex items-center gap-2">
          <span className="font-medium text-white">{stage.label}</span>
          <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
            {opportunities.length}
          </span>
        </div>
        <span className="text-xs text-white/80 font-medium">
          {formatCurrency(columnValue)}
        </span>
      </div>
      
      <Droppable droppableId={stage.value}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "bg-slate-50 border border-t-0 border-slate-200 rounded-b-lg p-3 min-h-[400px] transition-colors",
              snapshot.isDraggingOver && "bg-blue-50"
            )}
          >
            {opportunities.map((opp, index) => (
              <KanbanCard 
                key={opp.id} 
                opportunity={opp} 
                index={index}
                onOpenBlueSheet={onOpenBlueSheet}
                onViewDetails={onViewDetails}
              />
            ))}
            {provided.placeholder}
            {opportunities.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-sm">
                Drop opportunities here
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
};

const Opportunities = () => {
  const [opportunities, setOpportunities] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [viewMode, setViewMode] = useState("kanban");
  const [showModal, setShowModal] = useState(false);
  const [blueSheetOpp, setBlueSheetOpp] = useState(null);
  const [selectedOpp, setSelectedOpp] = useState(null);  // For detail panel
  const [formData, setFormData] = useState({
    name: "",
    account_id: "",
    value: "",
    stage: "qualification",
    probability: 10,
    expected_close_date: "",
    product_lines: [],
    description: "",
    single_sales_objective: "",
    competition: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [stageFilter]);

  const fetchData = async () => {
    try {
      const [oppsRes, accountsRes] = await Promise.all([
        opportunitiesAPI.getAll({ stage: stageFilter || undefined }),
        accountsAPI.getAll(),
      ]);
      setOpportunities(oppsRes.data);
      setAccounts(accountsRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await opportunitiesAPI.create({
        ...formData,
        value: parseFloat(formData.value),
        probability: parseInt(formData.probability),
        expected_close_date: formData.expected_close_date || null,
      });
      setShowModal(false);
      setFormData({
        name: "",
        account_id: "",
        value: "",
        stage: "qualification",
        probability: 10,
        expected_close_date: "",
        product_lines: [],
        description: "",
        single_sales_objective: "",
        competition: "",
      });
      fetchData();
    } catch (error) {
      console.error("Error creating opportunity:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    
    const { draggableId, destination } = result;
    const newStage = destination.droppableId;
    
    // Optimistic update
    const previousOpportunities = [...opportunities];
    setOpportunities(prev => 
      prev.map(opp => 
        opp.id === draggableId 
          ? { ...opp, stage: newStage }
          : opp
      )
    );
    
    try {
      await opportunitiesAPI.updateStage(draggableId, newStage);
    } catch (error) {
      console.error("Error updating opportunity stage:", error);
      
      // Revert optimistic update
      setOpportunities(previousOpportunities);
      
      // Show error toast/message
      const errorDetail = error.response?.data?.detail;
      if (errorDetail && typeof errorDetail === 'object') {
        // Structured error from backend
        alert(`Stage Transition Blocked\n\n${errorDetail.message}`);
      } else if (typeof errorDetail === 'string') {
        alert(`Error: ${errorDetail}`);
      } else {
        alert("Failed to update stage. Please try again.");
      }
    }
  };

  const handleBlueSheetSave = (result) => {
    setOpportunities(prev =>
      prev.map(opp =>
        opp.id === blueSheetOpp.id
          ? { ...opp, probability: result.probability, blue_sheet_analysis: result.analysis }
          : opp
      )
    );
  };

  const getKanbanData = () => {
    const data = {};
    STAGES.forEach(stage => {
      data[stage.value] = opportunities.filter(opp => opp.stage === stage.value);
    });
    return data;
  };

  const filteredOpportunities = opportunities.filter((opp) =>
    opp.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalPipeline = opportunities
    .filter((o) => !["closed_won", "closed_lost"].includes(o.stage))
    .reduce((sum, o) => sum + (o.value || 0), 0);
    
  const wonValue = opportunities
    .filter((o) => o.stage === "closed_won")
    .reduce((sum, o) => sum + (o.value || 0), 0);
    
  const avgDealSize = opportunities.length > 0
    ? opportunities.reduce((sum, o) => sum + (o.value || 0), 0) / opportunities.length
    : 0;

  const columns = [
    {
      key: "name",
      label: "Opportunity",
      render: (val, row) => (
        <div>
          <p className="font-medium text-slate-900">{val}</p>
          <p className="text-sm text-slate-500">{row?.account_name || "-"}</p>
        </div>
      ),
    },
    {
      key: "value",
      label: "Value",
      render: (val) => (
        <span className="font-medium text-slate-900">
          {formatCurrency(val)}
        </span>
      ),
    },
    {
      key: "stage",
      label: "Stage",
      render: (val) => <StageBadge stage={val} />,
    },
    {
      key: "probability",
      label: "Probability",
      render: (val) => (
        <span className={cn(
          "px-2 py-0.5 rounded-full text-sm font-medium",
          val >= 70 ? "bg-emerald-100 text-emerald-700" :
          val >= 40 ? "bg-amber-100 text-amber-700" :
          "bg-slate-100 text-slate-600"
        )}>
          {val}%
        </span>
      ),
    },
    {
      key: "product_lines",
      label: "Products",
      render: (val) => val?.length > 0 ? val.join(", ") : "—",
    },
    {
      key: "expected_close_date",
      label: "Expected Close",
      render: (val) => val ? formatDate(val) : "—",
    },
    {
      key: "owner_email",
      label: "Owner",
      render: (val) => val || "—",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const kanbanData = getKanbanData();

  return (
    <div className="animate-in space-y-6" data-testid="opportunities-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Target className="w-5 h-5 text-white" />
            </div>
            Opportunities
          </h1>
          <p className="text-slate-500 mt-1">
            Track and manage your sales pipeline
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
          data-testid="add-opportunity-btn"
        >
          <Plus className="w-4 h-4" />
          Add Opportunity
        </button>
      </div>

      {/* Search & View Toggle */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search opportunities..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-10"
                data-testid="search-input"
              />
            </div>
            
            {viewMode === 'table' && (
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="input w-auto min-w-[140px]"
                data-testid="stage-filter"
              >
                <option value="">All Stages</option>
                {STAGES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('kanban')}
              className={cn(
                "p-2 rounded-md transition-all flex items-center gap-2",
                viewMode === 'kanban' 
                  ? 'bg-white shadow-sm text-slate-900' 
                  : 'text-slate-500 hover:text-slate-700'
              )}
              data-testid="view-kanban-btn"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="text-sm font-medium hidden sm:inline">Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                "p-2 rounded-md transition-all flex items-center gap-2",
                viewMode === 'table' 
                  ? 'bg-white shadow-sm text-slate-900' 
                  : 'text-slate-500 hover:text-slate-700'
              )}
              data-testid="view-table-btn"
            >
              <List className="w-4 h-4" />
              <span className="text-sm font-medium hidden sm:inline">Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 hover:shadow-lg transition-all">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Total Pipeline</p>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalPipeline)}</p>
        </div>
        <div className="card p-5 hover:shadow-lg transition-all">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Won Revenue</p>
          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(wonValue)}</p>
        </div>
        <div className="card p-5 hover:shadow-lg transition-all">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Active Deals</p>
          <p className="text-2xl font-bold text-slate-900">
            {opportunities.filter((o) => !["closed_won", "closed_lost"].includes(o.stage)).length}
          </p>
        </div>
        <div className="card p-5 hover:shadow-lg transition-all">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Avg. Deal Size</p>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(avgDealSize)}</p>
        </div>
      </div>

      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <div className="card overflow-hidden" data-testid="kanban-board">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              Pipeline Board
              <span className="text-sm font-normal text-slate-500">
                (Drag cards to move between stages)
              </span>
            </h3>
          </div>
          <div className="p-4 overflow-x-auto">
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="flex gap-4 min-w-max pb-4">
                {STAGES.map((stage) => (
                  <KanbanColumn
                    key={stage.value}
                    stage={stage}
                    opportunities={kanbanData[stage.value] || []}
                    onOpenBlueSheet={setBlueSheetOpp}
                    onViewDetails={setSelectedOpp}
                  />
                ))}
              </div>
            </DragDropContext>
          </div>
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="card" data-testid="opportunities-table">
          <DataTable
            columns={columns}
            data={filteredOpportunities}
            emptyMessage="No opportunities found"
            onRowClick={(row) => setSelectedOpp(row)}
          />
        </div>
      )}

      {/* Opportunity Detail Panel */}
      <OpportunityDetailPanel
        opportunity={selectedOpp}
        isOpen={!!selectedOpp}
        onClose={() => setSelectedOpp(null)}
        onBlueSheet={setBlueSheetOpp}
      />

      {/* Blue Sheet Modal */}
      {blueSheetOpp && (
        <BlueSheetModal
          opportunity={blueSheetOpp}
          onClose={() => setBlueSheetOpp(null)}
          onSave={handleBlueSheetSave}
        />
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Add Opportunity</h2>
                <p className="text-sm text-slate-500 mt-1">Create a new sales opportunity</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Opportunity Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input"
                    required
                    data-testid="opp-name-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Account *
                  </label>
                  <select
                    value={formData.account_id}
                    onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                    className="input"
                    required
                    data-testid="account-select"
                  >
                    <option value="">Select account...</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Value ($) *
                  </label>
                  <input
                    type="number"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    className="input"
                    required
                    data-testid="value-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Stage
                  </label>
                  <select
                    value={formData.stage}
                    onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                    className="input"
                    data-testid="stage-select"
                  >
                    {STAGES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Expected Close Date
                  </label>
                  <input
                    type="date"
                    value={formData.expected_close_date}
                    onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })}
                    className="input"
                    data-testid="close-date-input"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Product Lines
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PRODUCT_LINES.map((pl) => (
                      <label
                        key={pl}
                        className={cn(
                          "cursor-pointer px-3 py-1.5 rounded-full text-sm font-medium border transition-all",
                          formData.product_lines.includes(pl)
                            ? "bg-blue-50 border-blue-300 text-blue-700"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={formData.product_lines.includes(pl)}
                          onChange={(e) => {
                            const newLines = e.target.checked
                              ? [...formData.product_lines, pl]
                              : formData.product_lines.filter((p) => p !== pl);
                            setFormData({ ...formData, product_lines: newLines });
                          }}
                          className="sr-only"
                        />
                        {pl}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input min-h-[80px]"
                    data-testid="description-input"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary"
                  data-testid="submit-opp-btn"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Create Opportunity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Opportunities;
