import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { opportunitiesAPI, accountsAPI } from "../services/api";
import DataTable from "../components/DataTable";
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
  MoreHorizontal,
  DollarSign,
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

// Kanban Card Component
const KanbanCard = ({ opportunity, index }) => {
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
          <p className="text-sm text-slate-500 mb-3">{opportunity.account_name || 'No account'}</p>
          
          {/* Deal Value */}
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
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
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
          
          {/* Expected Close */}
          {opportunity.expected_close_date && (
            <p className="text-xs text-slate-400 mt-2">
              Close: {formatDate(opportunity.expected_close_date)}
            </p>
          )}
        </div>
      )}
    </Draggable>
  );
};

// Kanban Column Component
const KanbanColumn = ({ stage, opportunities }) => {
  const columnValue = opportunities.reduce((sum, opp) => sum + (opp.value || 0), 0);
  
  return (
    <div className="flex-shrink-0 w-72">
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
        <span className="text-xs text-white/80">
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
              <KanbanCard key={opp.id} opportunity={opp} index={index} />
            ))}
            {provided.placeholder}
            {opportunities.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-sm">
                No opportunities
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
  const [viewMode, setViewMode] = useState("kanban"); // kanban or table
  const [showModal, setShowModal] = useState(false);
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

  // Handle drag and drop for Kanban
  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    
    const { draggableId, destination } = result;
    const newStage = destination.droppableId;
    
    // Update local state optimistically
    setOpportunities(prev => 
      prev.map(opp => 
        opp.id === draggableId 
          ? { ...opp, stage: newStage }
          : opp
      )
    );
    
    // Update in backend
    try {
      await opportunitiesAPI.update(draggableId, { stage: newStage });
    } catch (error) {
      console.error("Error updating opportunity stage:", error);
      fetchData(); // Revert on error
    }
  };

  // Group opportunities by stage for Kanban
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

  // Calculate stats
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
      header: "Opportunity",
      render: (opp) => (
        <div>
          <p className="font-medium text-slate-900">{opp.name}</p>
          <p className="text-sm text-slate-500">{opp.account_name || "-"}</p>
        </div>
      ),
    },
    {
      key: "value",
      header: "Value",
      render: (opp) => (
        <span className="font-medium text-slate-900">
          {formatCurrency(opp.value)}
        </span>
      ),
    },
    {
      key: "stage",
      header: "Stage",
      render: (opp) => <StageBadge stage={opp.stage} />,
    },
    {
      key: "probability",
      header: "Probability",
      render: (opp) => (
        <span className={cn(
          "px-2 py-0.5 rounded-full text-sm font-medium",
          opp.probability >= 70 ? "bg-emerald-100 text-emerald-700" :
          opp.probability >= 40 ? "bg-amber-100 text-amber-700" :
          "bg-slate-100 text-slate-600"
        )}>
          {opp.probability}%
        </span>
      ),
    },
    {
      key: "product_lines",
      header: "Products",
      render: (opp) =>
        opp?.product_lines?.length > 0 ? opp.product_lines.join(", ") : "—",
    },
    {
      key: "expected_close_date",
      header: "Expected Close",
      render: (opp) =>
        opp.expected_close_date ? formatDate(opp.expected_close_date) : "—",
    },
    {
      key: "owner",
      header: "Owner",
      render: (opp) => opp.owner_email || "—",
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

          {/* View Toggle */}
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
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-blue-600" />
              Pipeline Board
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
          />
        </div>
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
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
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
                    onChange={(e) =>
                      setFormData({ ...formData, account_id: e.target.value })
                    }
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
                    onChange={(e) =>
                      setFormData({ ...formData, value: e.target.value })
                    }
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
                    onChange={(e) =>
                      setFormData({ ...formData, stage: e.target.value })
                    }
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
                    Probability (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.probability}
                    onChange={(e) =>
                      setFormData({ ...formData, probability: e.target.value })
                    }
                    className="input"
                    data-testid="probability-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Expected Close Date
                  </label>
                  <input
                    type="date"
                    value={formData.expected_close_date}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        expected_close_date: e.target.value,
                      })
                    }
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
                    Single Sales Objective (SSO)
                  </label>
                  <textarea
                    value={formData.single_sales_objective}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        single_sales_objective: e.target.value,
                      })
                    }
                    className="input min-h-[80px]"
                    placeholder="What specific problem does this solve for the customer?"
                    data-testid="sso-input"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
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
